//! End-to-end test for scripts/s331-simulator.mjs.
//!
//! Spawns the Node simulator, then drives it through the REAL transport and
//! protocol engine — the same `TcpTransport::write_and_read`, `pack_packet`,
//! `deframe_multi_frame` and struct parsers that suto_connect_tcp /
//! suto_get_channels / suto_get_values / suto_get_logger_files /
//! suto_get_screenshots use in production.

use app_lib::suto::commands::{
    parse_channel_settings, parse_device_info, parse_measurement_values,
    ACT_GET_IMG_FILE_COUNT, ACT_GET_IMG_FILE_INFO, ACT_LOGGER_GET_FILE_LIST,
    ACT_LOGGER_GET_FILE_NUMBER, ACT_LOGGER_REQUEST_ACCESS_CODE, ACT_READ_IMG_FILE,
    CMD_DISCOVERY_ASCII, CMD_GET_CH_SETTING_TRANSF_PREFIX, CMD_GET_MAX_CHANNELS,
    CMD_GET_ONLINE_VAL_PREFIX, CTY_DEVICE_RELATED, CTY_LOGGER, DEVICE_TYPE_S331,
    SCTY_COLOR_DISPLAY_PRIVATE, SUB_NONE,
};
use app_lib::suto::driver_tcp::TcpTransport;
use app_lib::suto::protocol::{deframe_multi_frame, pack_packet};
use app_lib::suto::transport::SutoTransport;
use std::net::TcpStream;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

const PORT: u16 = 24331;

struct SimulatorGuard(Child);

impl Drop for SimulatorGuard {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

fn spawn_simulator() -> SimulatorGuard {
    let script = format!("{}/../scripts/s331-simulator.mjs", env!("CARGO_MANIFEST_DIR"));
    let child = Command::new("node")
        .arg(&script)
        .args(["--port", &PORT.to_string()])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("node must be available to run this test");

    let deadline = Instant::now() + Duration::from_secs(10);
    while Instant::now() < deadline {
        if TcpStream::connect(("127.0.0.1", PORT)).is_ok() {
            return SimulatorGuard(child);
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    panic!("simulator did not start listening within 10s");
}

fn xfer(tcp: &mut TcpTransport, payload: &[u8]) -> Vec<u8> {
    let raw = tcp.write_and_read(&pack_packet(1, payload), 5000).expect("write_and_read");
    deframe_multi_frame(&raw).expect("deframe")
}

#[test]
fn s331_simulator_end_to_end() {
    let _sim = spawn_simulator();

    let mut tcp = TcpTransport::new();
    tcp.connect("127.0.0.1", PORT).expect("TCP connect");

    // ---- Discovery (suto_connect_tcp path) ----
    let reply = tcp
        .write_and_read(&pack_packet(0, &[CMD_DISCOVERY_ASCII]), 2500)
        .unwrap();
    assert!(!reply.is_empty() && reply[0] != 0, "discovery must reveal device address");
    assert_eq!(reply[0], 1);
    let info = parse_device_info(&reply).expect("device info frame");
    assert_eq!(info.identification, DEVICE_TYPE_S331);
    assert_eq!(info.software_version_f32(), 1.80);
    assert!(
        info.uses_transformed_channel_settings(),
        "S331 fw >= 1.54 must select the 0x0B channel-settings command"
    );

    // ---- Max channel count (suto_get_channels step 1) ----
    let p = xfer(&mut tcp, &CMD_GET_MAX_CHANNELS);
    assert_eq!(p[0], 8, "max channel count");

    // ---- Channel settings, transformed prefix (suto_get_channels step 2) ----
    let mut cmd = Vec::from(CMD_GET_CH_SETTING_TRANSF_PREFIX);
    cmd.extend_from_slice(&[1, 8]);
    let deframed = xfer(&mut tcp, &cmd);
    assert_eq!(deframed.len(), 8 * 204, "eight 204-byte channel structs");
    let mut channels = parse_channel_settings(&deframed);
    assert_eq!(channels.len(), 8);
    channels.sort_by_key(|c| c.id);
    let expected = [
        ("Flow", "m³/h"),
        ("Velocity", "m/s"),
        ("Consumption", "m³"),
        ("Temperature", "°C"),
        ("Pressure", "bar"),
        ("Current A", "A"),
        ("Current B", "A"),
        ("Current C", "A"),
    ];
    for (ch, (desc, unit)) in channels.iter().zip(expected.iter()) {
        assert_eq!(ch.description, *desc, "channel {} description", ch.id);
        assert_eq!(ch.unit, *unit, "channel {} unit", ch.id);
    }

    // ---- Online values (suto_get_values path) ----
    let mut cmd = Vec::from(CMD_GET_ONLINE_VAL_PREFIX);
    cmd.extend_from_slice(&[1, 8]);
    let deframed = xfer(&mut tcp, &cmd);
    assert_eq!(deframed.len(), 8 * 7, "eight 7-byte value structs");
    let values = parse_measurement_values(&deframed, &channels);
    assert_eq!(values.len(), 8);
    assert!(values.iter().all(|v| v.status == "normal"), "all statuses normal");
    let flow = values[0].value.unwrap();
    assert!((60.0..200.0).contains(&flow), "plausible flow, got {flow}");
    let consumption = values[2].value.unwrap();
    assert!(
        consumption.fract() == 0.0 && consumption > 0.0,
        "consumption must be a positive integer (m³), got {consumption}"
    );
    for (name, v) in [("Current A", values[5].value), ("Current B", values[6].value), ("Current C", values[7].value)] {
        let v = v.unwrap_or(0.0);
        assert!((5.0..20.0).contains(&v), "{name} plausible, got {v}");
    }

    // ---- Logger file list (suto_get_logger_files path) ----
    let p = xfer(&mut tcp, &[CTY_LOGGER, SUB_NONE, ACT_LOGGER_GET_FILE_NUMBER]);
    assert_eq!(u32::from_le_bytes([p[0], p[1], p[2], p[3]]), 2, "two sessions");

    let code = xfer(&mut tcp, &[CTY_LOGGER, SUB_NONE, ACT_LOGGER_REQUEST_ACCESS_CODE]);
    assert_eq!(code.len(), 2, "access code");

    let length: u16 = 161 * 2 + 1;
    let cmd = [
        CTY_LOGGER,
        SUB_NONE,
        ACT_LOGGER_GET_FILE_LIST,
        (length & 0xFF) as u8,
        (length >> 8) as u8,
        0, // control: start from beginning
        code[0],
        code[1],
    ];
    let p = xfer(&mut tcp, &cmd);
    assert_eq!(p.len(), 1 + 2 * 161, "file list payload size");
    assert_eq!(p[0], 2, "files in this batch");
    let name = String::from_utf8_lossy(&p[1..13])
        .trim_end_matches('\0')
        .trim()
        .to_string();
    assert_eq!(name, "LOG0000");
    let samples = u32::from_le_bytes([p[21], p[22], p[23], p[24]]);
    assert_eq!(samples, 10080, "7 days @ 60 s");
    assert_eq!(p[25], 8, "8 channels");

    // ---- Screenshots (suto_get_screenshots + suto_read_screenshot path) ----
    let p = xfer(&mut tcp, &[CTY_DEVICE_RELATED, SCTY_COLOR_DISPLAY_PRIVATE, ACT_GET_IMG_FILE_COUNT]);
    assert_eq!(u32::from_le_bytes([p[0], p[1], p[2], p[3]]), 3, "3 screenshots");

    let mut cmd = vec![CTY_DEVICE_RELATED, SCTY_COLOR_DISPLAY_PRIVATE, ACT_GET_IMG_FILE_INFO];
    cmd.extend_from_slice(&0u32.to_le_bytes());
    cmd.extend_from_slice(&1u32.to_le_bytes());
    let p = xfer(&mut tcp, &cmd);
    assert_eq!(p.len(), 59, "one 59-byte info entry");
    let size = u32::from_le_bytes([p[0], p[1], p[2], p[3]]);
    assert_eq!(size, 54 + 240 * 160 * 3, "24-bit BMP 240x160 size");
    let name_len = p[4..59].iter().position(|&b| b == 0).unwrap_or(55);
    let img_name = String::from_utf8_lossy(&p[4..4 + name_len]).trim().to_string();
    assert!(img_name.ends_with(".png"), "screenshot name, got {img_name}");

    let mut cmd = vec![CTY_DEVICE_RELATED, SCTY_COLOR_DISPLAY_PRIVATE, ACT_READ_IMG_FILE];
    cmd.extend_from_slice(&0u32.to_le_bytes());
    cmd.extend_from_slice(&size.to_le_bytes());
    let mut name_bytes = [0u8; 55];
    name_bytes[..img_name.len()].copy_from_slice(&img_name.as_bytes()[..img_name.len()]);
    cmd.extend_from_slice(&name_bytes);
    let raw = tcp
        .write_and_read(&pack_packet(1, &cmd), (size / 80).max(10000))
        .unwrap();
    let img = deframe_multi_frame(&raw).unwrap();
    assert_eq!(img.len(), size as usize, "exact BMP size");
    assert_eq!(&img[..2], b"BM", "BMP magic");
}
