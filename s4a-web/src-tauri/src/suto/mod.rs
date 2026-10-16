//! SUTO Unified Communication Engine for Tauri
//!
//! Provides the state manager and Tauri IPC commands for SUTO device operations,
//! including USB direct communication, DS310 new protocol, System, Measurement, and Logger commands.

pub mod commands;
pub mod logger;
pub mod protocol;
pub mod transport;

pub mod driver_tcp;

#[cfg(target_os = "windows")]
pub mod driver_windows;

#[cfg(not(target_os = "windows"))]
pub mod driver_stub;

use std::sync::Mutex;
use tauri::State;

use commands::*;
use logger::{log_event, SutoLogEntry};
use protocol::*;
use transport::SutoTransport;

#[cfg(target_os = "windows")]
type NativeUsb = driver_windows::WindowsUsbTransport;

#[cfg(not(target_os = "windows"))]
type NativeUsb = driver_stub::StubUsbTransport;

pub struct SutoState {
    pub transport: Mutex<Option<Box<dyn SutoTransport>>>,
    pub dev_addr: Mutex<u8>,
    pub cached_channels: Mutex<Vec<ChannelInfo>>,
    pub device_info: Mutex<Option<DeviceInfo>>,
}

impl SutoState {
    pub fn new() -> Self {
        Self {
            transport: Mutex::new(None),
            dev_addr: Mutex::new(1),
            cached_channels: Mutex::new(Vec::new()),
            device_info: Mutex::new(None),
        }
    }
}

// ---- Tauri Commands ----

#[tauri::command]
pub fn suto_list_usb_devices() -> Result<Vec<String>, String> {
    log_event("INFO", "SUTO_IPC", "suto_list_usb_devices invoked", None);
    #[cfg(target_os = "windows")]
    {
        Ok(driver_windows::WindowsUsbTransport::list_devices())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(driver_stub::StubUsbTransport::list_devices())
    }
}

#[tauri::command]
pub async fn suto_connect_usb(
    path: Option<String>,
    state: State<'_, SutoState>,
) -> Result<u8, String> {
    log_event("INFO", "SUTO_IPC", &format!("suto_connect_usb called with path: {:?}", path), None);

    let mut native = NativeUsb::new();
    native.open(path.as_deref())?;

    // Perform discovery by sending 'A' with address 0
    log_event("INFO", "SUTO_DISC", "Sending Address 0 Discovery Query (command 'A' / 0x41)...", None);
    let disc_pkt = pack_packet(0, &[CMD_DISCOVERY_ASCII]);
    let reply = native.write_and_read(&disc_pkt, 2000)?;

    // As per specification §5.1:
    // "Send ASCII 'A' framed with address 0 (broadcast).
    // The reply's byte 0 is the device's real address (observed: 1).
    // All subsequent commands use that address."
    let active_addr = if !reply.is_empty() && reply[0] != 0 {
        reply[0]
    } else {
        1
    };

    log_event(
        "INFO",
        "SUTO_DISC",
        &format!("Discovery successful! Device assigned active RS485/Bus address: {} (0x{:02X})", active_addr, active_addr),
        None,
    );

    {
        let mut t_lock = state.transport.lock().unwrap_or_else(|p| p.into_inner());
        *t_lock = Some(Box::new(native));

        let mut addr_lock = state.dev_addr.lock().unwrap_or_else(|p| p.into_inner());
        *addr_lock = active_addr;

        let mut info_lock = state.device_info.lock().unwrap_or_else(|p| p.into_inner());
        *info_lock = parse_device_info(&reply);
    }

    Ok(active_addr)
}

#[tauri::command]
pub async fn suto_connect_tcp(
    host: String,
    port: u16,
    state: State<'_, SutoState>,
) -> Result<u8, String> {
    log_event("INFO", "SUTO_IPC", &format!("suto_connect_tcp called with {}:{}", host, port), None);

    let mut tcp = driver_tcp::TcpTransport::new();
    tcp.connect(&host, port)?;

    // Perform discovery by sending 'A' with address 0
    log_event("INFO", "SUTO_DISC", "Sending Address 0 Discovery Query over Ethernet...", None);
    let disc_pkt = pack_packet(0, &[CMD_DISCOVERY_ASCII]);
    let reply = tcp.write_and_read(&disc_pkt, 2500)?;

    let active_addr = if !reply.is_empty() && reply[0] != 0 {
        reply[0]
    } else {
        1
    };

    log_event(
        "INFO",
        "SUTO_DISC",
        &format!("Ethernet discovery successful! Device assigned active RS485/Bus address: {} (0x{:02X})", active_addr, active_addr),
        None,
    );

    {
        let mut t_lock = state.transport.lock().unwrap_or_else(|p| p.into_inner());
        *t_lock = Some(Box::new(tcp));

        let mut addr_lock = state.dev_addr.lock().unwrap_or_else(|p| p.into_inner());
        *addr_lock = active_addr;

        let mut info_lock = state.device_info.lock().unwrap_or_else(|p| p.into_inner());
        *info_lock = parse_device_info(&reply);
    }

    Ok(active_addr)
}

#[tauri::command]
pub fn suto_disconnect(state: State<'_, SutoState>) -> Result<(), String> {
    log_event("INFO", "SUTO_IPC", "suto_disconnect called", None);
    let mut t_lock = state.transport.lock().unwrap_or_else(|p| p.into_inner());
    if let Some(mut t) = t_lock.take() {
        let _ = t.close();
    }
    log_event("INFO", "SUTO_IPC", "Device disconnected successfully", None);
    Ok(())
}

#[tauri::command]
pub async fn suto_get_channels(
    state: State<'_, SutoState>,
) -> Result<Vec<ChannelInfo>, String> {
    let addr = { *state.dev_addr.lock().map_err(|e| e.to_string())? };
    log_event("INFO", "SUTO_CH", &format!("Querying channels for device address {}", addr), None);

    // CSLib `getStructChannel` requests channels in batches and scans every
    // record, skipping empty slots (logical channel 0 / 0xFF) instead of
    // stopping at the first gap. Ethernet uses a smaller batch (5).
    const BATCH: usize = 5;
    // Upper bound of the scan (CSLib scans up to DS310_MAX_CHANNEL_PER_DEVICE);
    // capped to the range SUTO devices actually expose.
    const MAX_SCAN: usize = 100;

    let (channels, scanned_to, use_transf) = {
        let dev_info = { *state.device_info.lock().unwrap_or_else(|p| p.into_inner()) };
        let use_transf = dev_info.map(|d| d.uses_transformed_channel_settings()).unwrap_or(false);
        let prefix = if use_transf {
            CMD_GET_CH_SETTING_TRANSF_PREFIX
        } else {
            CMD_GET_CH_SETTING_PREFIX
        };
        if let Some(d) = dev_info {
            log_event(
                "INFO",
                "SUTO_CH",
                &format!(
                    "Device id=0x{:04X}, bus=v{}, fw={:.2} -> {} channel settings",
                    d.identification,
                    d.bus_version,
                    d.software_version_f32(),
                    if use_transf { "transformed (0x0B)" } else { "standard (0x02)" }
                ),
                None,
            );
        }

        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        let transport = t_lock.as_mut().ok_or("Device not connected")?;

        // 1. Max channel count (`[01 FF 23]`). Fall back to a full scan when the
        //    device does not support the command.
        let max_count = match transport.write_and_read(&pack_packet(addr, &CMD_GET_MAX_CHANNELS), 1500) {
            Ok(reply) => match deframe_multi_frame(&reply) {
                Ok(p) if p.first().is_some_and(|c| *c > 0) => p[0] as usize,
                _ => MAX_SCAN,
            },
            Err(_) => MAX_SCAN,
        };
        let max_count = max_count.clamp(1, MAX_SCAN);
        log_event("INFO", "SUTO_CH", &format!("Reported max channel count: {}", max_count), None);

        // 2. Scan channels in batches, collecting valid descriptors keyed by id.
        let mut channels: Vec<ChannelInfo> = Vec::new();
        let mut start = 1usize;
        while start <= max_count {
            let cnt = BATCH.min(max_count - start + 1);
            let mut cmd = Vec::from(prefix);
            cmd.push(start as u8);
            cmd.push(cnt as u8);
            match transport.write_and_read(&pack_packet(addr, &cmd), 2500) {
                Ok(reply) => match deframe_multi_frame(&reply) {
                    Ok(deframed) => {
                        for ch in parse_channel_settings(&deframed) {
                            if !channels.iter().any(|c| c.id == ch.id) {
                                channels.push(ch);
                            }
                        }
                    }
                    Err(e) => log_event("WARN", "SUTO_CH", &format!("Deframe failed at start={}: {}", start, e), None),
                },
                Err(e) => {
                    log_event("WARN", "SUTO_CH", &format!("Channel batch start={} failed: {}", start, e), None);
                }
            }
            if channels.len() >= max_count {
                break;
            }
            start += cnt;
        }

        channels.sort_by_key(|c| c.id);
        (channels, max_count, use_transf)
    };

    log_event(
        "INFO",
        "SUTO_CH",
        &format!(
            "Parsed {} channel descriptors (scanned 1..{} via {}):",
            channels.len(),
            scanned_to,
            if use_transf { "0x0B" } else { "0x02" }
        ),
        None,
    );
    for ch in &channels {
        log_event(
            "INFO",
            "SUTO_CH",
            &format!("  Ch #{}: desc='{}', unit='{}'", ch.id, ch.description, ch.unit),
            None,
        );
    }

    // Cache channels for value parsing
    {
        let mut ch_lock = state.cached_channels.lock().unwrap_or_else(|p| p.into_inner());
        *ch_lock = channels.clone();
    }

    Ok(channels)
}

#[tauri::command]
pub async fn suto_get_values(
    state: State<'_, SutoState>,
) -> Result<Vec<MeasurementValue>, String> {
    let (addr, channels) = {
        let addr = *state.dev_addr.lock().unwrap_or_else(|p| p.into_inner());
        let ch_lock = state.cached_channels.lock().unwrap_or_else(|p| p.into_inner());
        let mut chans = ch_lock.clone();
        chans.sort_by_key(|c| c.id);
        (addr, chans)
    };

    // Read values sequentially from channel 1..max, mirroring CSLib
    // `retrieveAllMeasurementValues` (which reads `1..getMaxChannelCount`).
    // Value index i maps to logical channel id (start + i).
    let start = 1u8;
    let max_id = channels.iter().map(|c| c.id).max().unwrap_or(4).max(1);
    let count = max_id;
    let ordered: Vec<ChannelInfo> = (start..=max_id)
        .map(|id| {
            channels
                .iter()
                .find(|c| c.id == id)
                .cloned()
                .unwrap_or(ChannelInfo {
                    id,
                    ..Default::default()
                })
        })
        .collect();

    let mut get_val_cmd = Vec::from(CMD_GET_ONLINE_VAL_PREFIX);
    get_val_cmd.push(start);
    get_val_cmd.push(count);

    let reply = {
        let mut t_lock = state.transport.lock().unwrap_or_else(|p| p.into_inner());
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        let pkt = pack_packet(addr, &get_val_cmd);
        transport.write_and_read(&pkt, 2500)?
    };

    let deframed = deframe_multi_frame(&reply)?;
    let values = parse_measurement_values(&deframed, &ordered);
    log_event(
        "DEBUG",
        "SUTO_VAL",
        &format!("Poll returned {} values: {:?}", values.len(), values.iter().map(|v| (v.id, v.value)).collect::<Vec<_>>()),
        None,
    );
    Ok(values)
}

#[tauri::command]
pub async fn suto_get_system_info(
    state: State<'_, SutoState>,
) -> Result<SystemInfo, String> {
    let addr = { *state.dev_addr.lock().unwrap_or_else(|p| p.into_inner()) };
    let mut info = SystemInfo::default();

    // Helper closure to send command
    let send_sys_cmd = |act: u8| -> Result<Vec<u8>, String> {
        let mut t_lock = state.transport.lock().unwrap_or_else(|p| p.into_inner());
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        let cmd = [CTY_SYS_INFO, SUB_NONE, act];
        let pkt = pack_packet(addr, &cmd);
        let raw = transport.write_and_read(&pkt, 1000)?;
        deframe_multi_frame(&raw)
    };

    // Serial number - if this fails/times out, device probably doesn't support CTY_SYS_INFO, so skip the rest
    if let Ok(res) = send_sys_cmd(ACT_GET_SERIAL_NUMBER) {
        if res.len() >= 4 {
            let sn = u32::from_le_bytes([res[0], res[1], res[2], res[3]]);
            info.serial_number = Some(sn.to_string());
        }

        // Device ID
        if let Ok(res) = send_sys_cmd(ACT_GET_DEVICE_ID) {
            if res.len() >= 2 {
                info.device_id = Some(u16::from_le_bytes([res[0], res[1]]));
            }
        }

        // Firmware version
        if let Ok(res) = send_sys_cmd(ACT_GET_FIRMWARE_VERSION) {
            let ver = String::from_utf8_lossy(&res).trim().to_string();
            if !ver.is_empty() {
                info.firmware_version = Some(ver);
            }
        }

        // Device Name
        if let Ok(res) = send_sys_cmd(ACT_GET_DEVICE_NAME) {
            let name = String::from_utf8_lossy(&res).trim().to_string();
            if !name.is_empty() {
                info.device_name = Some(name);
            }
        }

        // Calibration date
        if let Ok(res) = send_sys_cmd(ACT_GET_CALI_DATE) {
            let cali = String::from_utf8_lossy(&res).trim().to_string();
            if !cali.is_empty() {
                info.calibration_date = Some(cali);
            }
        }
    }

    Ok(info)
}

#[tauri::command]
pub async fn suto_get_logger_status(
    state: State<'_, SutoState>,
) -> Result<LoggerStatus, String> {
    let addr = { *state.dev_addr.lock().map_err(|e| e.to_string())? };
    let mut status = LoggerStatus::default();

    let send_log_cmd = |act: u8| -> Result<Vec<u8>, String> {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        let cmd = [CTY_LOGGER, SCTY_LOG, act];
        let pkt = pack_packet(addr, &cmd);
        let raw = transport.write_and_read(&pkt, 2000)?;
        deframe_multi_frame(&raw)
    };

    // Log enable
    if let Ok(res) = send_log_cmd(ACT_GSET_LOG_EN) {
        if !res.is_empty() {
            status.enabled = res[0] == 1;
        }
    }

    // Log recorded count
    if let Ok(res) = send_log_cmd(ACT_GET_LOG_RECORDED_NUM) {
        if res.len() >= 4 {
            status.recorded_count = u32::from_le_bytes([res[0], res[1], res[2], res[3]]);
        }
    }

    // Log start and end time
    if let Ok(res) = send_log_cmd(ACT_GET_LOG_START_END_TIME) {
        if res.len() >= 8 {
            status.start_time = Some(u32::from_le_bytes([res[0], res[1], res[2], res[3]]));
            status.end_time = Some(u32::from_le_bytes([res[4], res[5], res[6], res[7]]));
        }
    }

    // Log package interval
    if let Ok(res) = send_log_cmd(ACT_GET_LOG_PACKAGES_INTERVAL) {
        if res.len() >= 4 {
            status.package_interval = Some(u32::from_le_bytes([res[0], res[1], res[2], res[3]]));
        }
    }

    Ok(status)
}

#[tauri::command]
pub async fn suto_send_command(
    addr: Option<u8>,
    cty: u8,
    scty: u8,
    act: u8,
    data: Option<Vec<u8>>,
    state: State<'_, SutoState>,
) -> Result<Vec<u8>, String> {
    let target_addr = match addr {
        Some(a) => a,
        None => *state.dev_addr.lock().map_err(|e| e.to_string())?,
    };

    let mut payload = vec![cty, scty, act];
    if let Some(extra) = data {
        payload.extend_from_slice(&extra);
    }

    let pkt = pack_packet(target_addr, &payload);

    let reply = {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        transport.write_and_read(&pkt, 4000)?
    };

    deframe_multi_frame(&reply)
}

#[tauri::command]
pub async fn suto_send_raw(
    addr: u8,
    data: Vec<u8>,
    state: State<'_, SutoState>,
) -> Result<Vec<u8>, String> {
    let pkt = pack_packet(addr, &data);

    let reply = {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        transport.write_and_read(&pkt, 4000)?
    };

    deframe_multi_frame(&reply)
}

#[tauri::command]
pub fn suto_get_logs(since_id: Option<u64>) -> Result<Vec<SutoLogEntry>, String> {
    Ok(logger::get_logs(since_id.unwrap_or(0)))
}

#[tauri::command]
pub fn suto_clear_logs() -> Result<(), String> {
    logger::clear_logs();
    Ok(())
}

#[tauri::command]
pub fn suto_get_log_file_path() -> Result<String, String> {
    Ok(logger::get_log_file_path())
}

#[tauri::command]
pub fn suto_log_client_event(level: String, tag: String, message: String) -> Result<(), String> {
    logger::log_event(&level, &tag, &message, None);
    Ok(())
}
