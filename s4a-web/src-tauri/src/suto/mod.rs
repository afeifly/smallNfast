//! SUTO Unified Communication Engine for Tauri
//!
//! Provides the state manager and Tauri IPC commands for SUTO device operations,
//! including USB direct communication, DS310 new protocol, System, Measurement, and Logger commands.

pub mod commands;
pub mod logger;
pub mod protocol;
pub mod transport;

pub mod driver_tcp;
pub mod files;

pub use files::{
    suto_add_recent_file, suto_get_file_stats, suto_get_recent_files, suto_pick_file,
    suto_read_file, suto_read_file_slice, suto_remove_recent_file, suto_save_binary_file,
    suto_pick_folder, suto_save_file_to_path, RecentFileEntry,
};

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

fn format_unix_time_str(sec: i64) -> String {
    if sec <= 0 {
        return "---".to_string();
    }
    let s = sec as u64;
    let days = s / 86400;
    let rem_sec = s % 86400;
    let hours = rem_sec / 3600;
    let mins = (rem_sec % 3600) / 60;
    let secs = rem_sec % 60;

    let mut year = 1970u32;
    let mut d = days;
    loop {
        let leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
        let days_in_year = if leap { 366 } else { 365 };
        if d < days_in_year {
            break;
        }
        d -= days_in_year;
        year += 1;
    }
    let leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
    let days_in_month = [
        31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ];
    let mut month = 1u32;
    for &dim in &days_in_month {
        if d < dim {
            break;
        }
        d -= dim;
        month += 1;
    }
    let day = d + 1;

    format!("{:04}-{:02}-{:02} {:02}:{:02}:{:02}", year, month, day, hours, mins, secs)
}

#[tauri::command]
pub async fn suto_get_logger_files(
    state: State<'_, SutoState>,
) -> Result<Vec<LoggerFileInfo>, String> {
    let addr = { *state.dev_addr.lock().map_err(|e| e.to_string())? };

    log_event("INFO", "SUTO_LOGGER", "Querying device recorded logger files...", None);

    // 1. Request access code (CTY_LOGGER=0x03, SUB=0xFF, ACT_LOGGER_REQUEST_ACCESS_CODE=0x04)
    let access_code: [u8; 2] = {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        let cmd = [CTY_LOGGER, 0xFF, ACT_LOGGER_REQUEST_ACCESS_CODE];
        let pkt = pack_packet(addr, &cmd);
        match transport.write_and_read(&pkt, 2500) {
            Ok(raw) => {
                let deframed = deframe_multi_frame(&raw).unwrap_or_default();
                if deframed.len() >= 2 {
                    [deframed[0], deframed[1]]
                } else {
                    [0, 0]
                }
            }
            Err(e) => {
                log_event("WARN", "SUTO_LOGGER", &format!("Request access code warning: {}", e), None);
                [0, 0]
            }
        }
    };

    // 2. Query file count:
    // First try ACT_LOGGER_GET_FILE_NUMBER (0x03, 0xFF, 0x12) for DS310 / S330 / S331
    let mut file_count = {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        let cmd = [CTY_LOGGER, 0xFF, ACT_LOGGER_GET_FILE_NUMBER];
        let pkt = pack_packet(addr, &cmd);
        match transport.write_and_read(&pkt, 3000) {
            Ok(raw) => {
                let deframed = deframe_multi_frame(&raw).unwrap_or_default();
                if deframed.len() >= 4 {
                    u32::from_le_bytes([deframed[0], deframed[1], deframed[2], deframed[3]])
                } else if deframed.len() >= 2 {
                    u16::from_le_bytes([deframed[0], deframed[1]]) as u32
                } else {
                    0
                }
            }
            Err(_) => 0,
        }
    };

    // Fallback: If 0 or error, also check S600 ACT_LOGGER_GET_CSD_FILE_NUMBER (0x03, 0xFF, 0x24)
    if file_count == 0 {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        if let Some(transport) = t_lock.as_mut() {
            let cmd = [CTY_LOGGER, 0xFF, ACT_LOGGER_GET_CSD_FILE_NUMBER];
            let pkt = pack_packet(addr, &cmd);
            if let Ok(raw) = transport.write_and_read(&pkt, 2500) {
                if let Ok(deframed) = deframe_multi_frame(&raw) {
                    if deframed.len() >= 4 {
                        file_count = u32::from_le_bytes([deframed[0], deframed[1], deframed[2], deframed[3]]);
                    } else if deframed.len() >= 2 {
                        file_count = u16::from_le_bytes([deframed[0], deframed[1]]) as u32;
                    }
                }
            }
        }
    }

    log_event("INFO", "SUTO_LOGGER", &format!("Device reported {} logger session file(s)", file_count), None);

    if file_count == 0 {
        return Ok(Vec::new());
    }

    // 3. Query file info entries
    let mut list: Vec<LoggerFileInfo> = Vec::new();
    let mut current_idx = 0u32;
    let batch_size = 10u32;

    while current_idx < file_count {
        let batch_num = (file_count - current_idx).min(batch_size);
        let control = if current_idx == 0 { 0u8 } else { 1u8 };
        let length = (161 * batch_num + 1) as u16;
        let len_bytes = length.to_le_bytes();

        let info_res = {
            let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
            let transport = t_lock.as_mut().ok_or("Device not connected")?;
            let cmd = [
                CTY_LOGGER, 0xFF, ACT_LOGGER_GET_FILE_LIST,
                len_bytes[0], len_bytes[1],
                control,
                access_code[0], access_code[1],
            ];
            let pkt = pack_packet(addr, &cmd);
            let raw = transport.write_and_read(&pkt, 5000)?;
            deframe_multi_frame(&raw)?
        };

        if info_res.is_empty() {
            break;
        }

        let resp_num_of_files = info_res[0] as usize;
        let one_len = 161usize;
        let mut offset = 1usize;
        let count_to_read = resp_num_of_files.min(batch_num as usize);

        for _ in 0..count_to_read {
            if offset + one_len > info_res.len() {
                break;
            }
            let chunk = &info_res[offset..offset + one_len];

            // fileName: bytes 0..12
            let name_raw = &chunk[0..12];
            let zero_pos = name_raw.iter().position(|&b| b == 0).unwrap_or(name_raw.len());
            let file_name = String::from_utf8_lossy(&name_raw[..zero_pos]).trim().to_string();

            // timeFirstSample: bytes 12..20 (i64, little endian)
            let time_first_sample = i64::from_le_bytes([
                chunk[12], chunk[13], chunk[14], chunk[15],
                chunk[16], chunk[17], chunk[18], chunk[19],
            ]);

            // numOfSample: bytes 20..24 (u32, little endian)
            let num_of_sample = u32::from_le_bytes([chunk[20], chunk[21], chunk[22], chunk[23]]);

            // numOfChannel: byte 24 (u8)
            let num_of_channel = chunk[24] as u32;

            // status: bytes 25..29 (u32, little endian)
            let status_val = u32::from_le_bytes([chunk[25], chunk[26], chunk[27], chunk[28]]);
            let is_recording = (status_val & 1) != 0;

            // sampleRate: bytes 29..33 (u32, little endian)
            let sample_rate = u32::from_le_bytes([chunk[29], chunk[30], chunk[31], chunk[32]]);

            // description: bytes 33..161 (128 bytes)
            let desc_raw = &chunk[33..161];
            let desc_zero = desc_raw.iter().position(|&b| b == 0).unwrap_or(desc_raw.len());
            let description = String::from_utf8_lossy(&desc_raw[..desc_zero]).trim().to_string();

            // Calculate formatted start and end time
            let start_sec = if time_first_sample > 1_000_000_000_000 {
                time_first_sample / 1000
            } else {
                time_first_sample
            };
            let rate_sec = if sample_rate == 0 { 1 } else { sample_rate as i64 };
            let total_dur = (num_of_sample.saturating_sub(1) as i64) * rate_sec;
            let end_sec = start_sec + total_dur;

            let start_time_str = format_unix_time_str(start_sec);
            let end_time_str = format_unix_time_str(end_sec);

            if !file_name.is_empty() {
                let entry = LoggerFileInfo {
                    file_name: file_name.clone(),
                    start_time: start_time_str,
                    end_time: end_time_str,
                    channels_count: num_of_channel,
                    samples_per_channel: num_of_sample,
                    sample_rate,
                    description,
                    status: status_val,
                    is_recording,
                };

                if let Some(existing) = list.iter_mut().find(|f| f.file_name == file_name) {
                    if entry.samples_per_channel >= existing.samples_per_channel {
                        *existing = entry;
                    }
                } else {
                    list.push(entry);
                }
            }

            offset += one_len;
        }

        if count_to_read == 0 {
            break;
        }
        current_idx += count_to_read as u32;
    }

    // 4. Release access right / finish reading
    {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        if let Some(transport) = t_lock.as_mut() {
            let cmd = [CTY_LOGGER, 0xFF, ACT_LOGGER_READING_FINISHED, access_code[0], access_code[1]];
            let pkt = pack_packet(addr, &cmd);
            let _ = transport.write_and_read(&pkt, 1500);
        }
    }

    // Sort by start_time descending (latest time on top)
    list.sort_by(|a, b| b.start_time.cmp(&a.start_time));

    log_event("INFO", "SUTO_LOGGER", &format!("Successfully parsed {} logger file(s) from device", list.len()), None);
    Ok(list)
}

#[tauri::command]
pub async fn suto_get_screenshots(
    state: State<'_, SutoState>,
) -> Result<Vec<ScreenshotEntry>, String> {
    let addr = { *state.dev_addr.lock().map_err(|e| e.to_string())? };

    log_event("INFO", "SUTO_SCREENSHOT", "Querying device screenshot count (0x09/0x08/0x0D)...", None);

    // 1. Get image file count
    let count_res = {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        let cmd = [CTY_DEVICE_RELATED, SCTY_COLOR_DISPLAY_PRIVATE, ACT_GET_IMG_FILE_COUNT];
        let pkt = pack_packet(addr, &cmd);
        let raw = transport.write_and_read(&pkt, 3000)?;
        deframe_multi_frame(&raw)?
    };

    if count_res.len() < 4 {
        log_event("WARN", "SUTO_SCREENSHOT", &format!("Unexpected screenshot count response length: {} bytes", count_res.len()), None);
        return Ok(Vec::new());
    }

    let count = u32::from_le_bytes([count_res[0], count_res[1], count_res[2], count_res[3]]);
    log_event("INFO", "SUTO_SCREENSHOT", &format!("Device reported {} screenshot file(s)", count), None);
    if count == 0 {
        return Ok(Vec::new());
    }

    // 2. Query file info list (start=0, count=count, in batches of at most 10)
    let mut list = Vec::new();
    let mut current_idx = 0u32;

    while current_idx < count {
        let batch_num = (count - current_idx).min(10);
        let info_res = {
            let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
            let transport = t_lock.as_mut().ok_or("Device not connected")?;
            let mut cmd = vec![CTY_DEVICE_RELATED, SCTY_COLOR_DISPLAY_PRIVATE, ACT_GET_IMG_FILE_INFO];
            cmd.extend_from_slice(&current_idx.to_le_bytes());
            cmd.extend_from_slice(&batch_num.to_le_bytes());
            let pkt = pack_packet(addr, &cmd);
            let raw = transport.write_and_read(&pkt, 4000)?;
            deframe_multi_frame(&raw)?
        };

        let one_len = 59usize; // 4 bytes size + 55 bytes name
        let mut offset = 0;
        let mut i = 0u32;
        while offset + one_len <= info_res.len() && i < batch_num {
            let chunk = &info_res[offset..offset + one_len];
            let size = u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
            let name_raw = &chunk[4..59];
            let zero_pos = name_raw.iter().position(|&b| b == 0).unwrap_or(name_raw.len());
            let mut name = String::from_utf8_lossy(&name_raw[..zero_pos]).trim().to_string();
            if name.to_lowercase().ends_with(".png.bmp") {
                name.truncate(name.len() - 4);
            }
            if !name.is_empty() {
                list.push(ScreenshotEntry {
                    name,
                    size,
                    index: current_idx + i,
                });
            }
            i += 1;
            offset += one_len;
        }

        current_idx += batch_num;
    }

    log_event("INFO", "SUTO_SCREENSHOT", &format!("Successfully parsed {} screenshot entries from device", list.len()), None);
    Ok(list)
}

#[tauri::command]
pub async fn suto_read_screenshot(
    name: String,
    size: u32,
    state: State<'_, SutoState>,
) -> Result<tauri::ipc::Response, String> {
    let addr = { *state.dev_addr.lock().map_err(|e| e.to_string())? };

    log_event("INFO", "SUTO_SCREENSHOT", &format!("Reading screenshot '{}' (size: {} bytes)...", name, size), None);

    let data_res = {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        let mut cmd = vec![CTY_DEVICE_RELATED, SCTY_COLOR_DISPLAY_PRIVATE, ACT_READ_IMG_FILE];
        cmd.extend_from_slice(&0u32.to_le_bytes()); // offset = 0
        cmd.extend_from_slice(&size.to_le_bytes()); // file size

        let mut name_bytes = [0u8; 55];
        let bytes = name.as_bytes();
        let copy_len = bytes.len().min(55);
        name_bytes[..copy_len].copy_from_slice(&bytes[..copy_len]);
        cmd.extend_from_slice(&name_bytes);

        let pkt = pack_packet(addr, &cmd);
        let timeout = (size / 80).max(10000);
        let raw = transport.write_and_read(&pkt, timeout)?;
        deframe_multi_frame(&raw)?
    };

    log_event("INFO", "SUTO_SCREENSHOT", &format!("Screenshot '{}' downloaded ({} bytes payload)", name, data_res.len()), None);

    // Optional close notification
    if let Ok(mut t_lock) = state.transport.lock() {
        if let Some(transport) = t_lock.as_mut() {
            let cmd = [CTY_DEVICE_RELATED, SCTY_COLOR_DISPLAY_PRIVATE, ACT_CLOSE_IMG_FILE];
            let pkt = pack_packet(addr, &cmd);
            let _ = transport.write_and_read(&pkt, 1500);
        }
    }

    Ok(tauri::ipc::Response::new(data_res))
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
