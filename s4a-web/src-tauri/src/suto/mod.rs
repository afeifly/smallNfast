//! SUTO Unified Communication Engine for Tauri
//!
//! Provides the state manager and Tauri IPC commands for SUTO device operations,
//! including USB direct communication, DS310 new protocol, System, Measurement, and Logger commands.

pub mod commands;
pub mod logger;
pub mod protocol;
pub mod transport;

pub mod driver_tcp;
pub mod driver_ble;
pub mod files;
pub mod modbus;

pub use modbus::suto_read_modbus_registers;
pub use files::{
    suto_add_recent_file, suto_get_file_stats, suto_get_recent_files, suto_pick_file,
    suto_read_file, suto_read_file_slice, suto_remove_recent_file, suto_save_binary_file,
    suto_pick_folder, suto_save_file_to_path, RecentFileEntry,
};

#[cfg(target_os = "windows")]
pub mod driver_windows;

#[cfg(target_os = "android")]
pub mod driver_android_usb;

#[cfg(target_os = "macos")]
pub mod driver_macos;

#[cfg(all(not(target_os = "windows"), not(target_os = "android"), not(target_os = "macos")))]
pub mod driver_stub;

use std::sync::Mutex;
use tauri::{Emitter, State};

use commands::*;
use logger::{log_event, SutoLogEntry};
use protocol::*;
use transport::SutoTransport;

#[cfg(target_os = "windows")]
type NativeUsb = driver_windows::WindowsUsbTransport;

#[cfg(target_os = "android")]
type NativeUsb = driver_android_usb::AndroidUsbTransport;

#[cfg(target_os = "macos")]
type NativeUsb = driver_macos::MacUsbTransport;

#[cfg(all(not(target_os = "windows"), not(target_os = "android"), not(target_os = "macos")))]
type NativeUsb = driver_stub::StubUsbTransport;

pub struct TcpDeviceSession {
    pub endpoint: String,
    pub host: String,
    pub port: u16,
    pub transport: Box<dyn SutoTransport>,
    pub dev_addr: u8,
    pub channels: Vec<ChannelInfo>,
    pub serial_number: Option<String>,
    pub device_name: Option<String>,
}

pub struct SutoState {
    pub transport: Mutex<Option<Box<dyn SutoTransport>>>,
    pub dev_addr: Mutex<u8>,
    pub cached_channels: Mutex<Vec<ChannelInfo>>,
    pub device_info: Mutex<Option<DeviceInfo>>,
    pub system_info: Mutex<Option<SystemInfo>>,
    pub tcp_devices: Mutex<std::collections::HashMap<String, TcpDeviceSession>>,
}

impl SutoState {
    pub fn new() -> Self {
        Self {
            transport: Mutex::new(None),
            dev_addr: Mutex::new(1),
            cached_channels: Mutex::new(Vec::new()),
            device_info: Mutex::new(None),
            system_info: Mutex::new(None),
            tcp_devices: Mutex::new(std::collections::HashMap::new()),
        }
    }
}

// ---- Tauri Commands ----

#[tauri::command]
pub fn suto_list_usb_devices() -> Result<Vec<String>, String> {
    log_event("INFO", "SUTO_IPC", "suto_list_usb_devices invoked", None);
    Ok(NativeUsb::list_devices())
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

        let mut sys_lock = state.system_info.lock().unwrap_or_else(|p| p.into_inner());
        *sys_lock = None;
    }

    Ok(active_addr)
}

#[tauri::command]
pub async fn suto_discover_ethernet_broadcast(
    timeout_ms: Option<u64>,
    subnet_broadcast: Option<String>,
) -> Result<Vec<driver_tcp::DiscoveredEthernetDevice>, String> {
    log_event("INFO", "SUTO_IPC", "suto_discover_ethernet_broadcast called (CSLib protocol)", None);
    let duration = timeout_ms.unwrap_or(1500);
    tokio::task::spawn_blocking(move || {
        driver_tcp::discover_ethernet_broadcast(duration, subnet_broadcast)
    })
    .await
    .map_err(|e| format!("Broadcast discovery task error: {}", e))?
}

#[tauri::command]
pub async fn suto_connect_tcp(
    host: String,
    port: u16,
    state: State<'_, SutoState>,
) -> Result<u8, String> {
    log_event("INFO", "SUTO_IPC", &format!("suto_connect_tcp called with {}:{}", host, port), None);

    let endpoint = format!("{}:{}", host, port);
    {
        let tcp_map = state.tcp_devices.lock().unwrap_or_else(|p| p.into_inner());
        if let Some(existing) = tcp_map.get(&endpoint) {
            if existing.transport.is_open() && !existing.channels.is_empty() {
                log_event(
                    "INFO",
                    "SUTO_IPC",
                    &format!("TCP session for {} already active with {} channels, reusing existing connection", endpoint, existing.channels.len()),
                    None,
                );
                return Ok(existing.dev_addr);
            }
        }
    }

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

    let parsed_info = parse_device_info(&reply);

    // Query system info directly on this device socket (serial number and device name)
    let mut sn = None;
    let mut dev_name = None;
    let cmd_sn = [CTY_SYS_INFO, SUB_NONE, ACT_GET_SERIAL_NUMBER];
    if let Ok(sn_raw) = tcp.write_and_read(&pack_packet(active_addr, &cmd_sn), 1500) {
        if let Ok(deframed) = deframe_multi_frame(&sn_raw) {
            if deframed.len() >= 4 {
                let n = u32::from_le_bytes([deframed[0], deframed[1], deframed[2], deframed[3]]);
                sn = Some(n.to_string());
            }
        }
    }
    let cmd_name = [CTY_SYS_INFO, SUB_NONE, ACT_GET_DEVICE_NAME];
    if let Ok(name_raw) = tcp.write_and_read(&pack_packet(active_addr, &cmd_name), 1500) {
        if let Ok(deframed) = deframe_multi_frame(&name_raw) {
            let n = String::from_utf8_lossy(&deframed).trim().to_string();
            if !n.is_empty() {
                dev_name = Some(n);
            }
        }
    }

    let endpoint = format!("{}:{}", host, port);
    let prev_channels = {
        let tcp_map = state.tcp_devices.lock().unwrap_or_else(|p| p.into_inner());
        if let Some(dev) = tcp_map.get(&endpoint) {
            if !dev.channels.is_empty() {
                dev.channels.clone()
            } else {
                state.cached_channels.lock().unwrap_or_else(|p| p.into_inner()).clone()
            }
        } else {
            state.cached_channels.lock().unwrap_or_else(|p| p.into_inner()).clone()
        }
    };
    let chs: Vec<ChannelInfo> = prev_channels;
    let cloned_tcp = tcp.try_clone().ok();

    {
        let mut tcp_map = state.tcp_devices.lock().unwrap_or_else(|p| p.into_inner());
        tcp_map.insert(
            endpoint.clone(),
            TcpDeviceSession {
                endpoint,
                host: host.clone(),
                port,
                transport: Box::new(tcp),
                dev_addr: active_addr,
                channels: chs.clone(),
                serial_number: sn,
                device_name: dev_name,
            },
        );
    }

    {
        if let Some(c_tcp) = cloned_tcp {
            let mut t_lock = state.transport.lock().unwrap_or_else(|p| p.into_inner());
            *t_lock = Some(Box::new(c_tcp));
        }

        let mut addr_lock = state.dev_addr.lock().unwrap_or_else(|p| p.into_inner());
        *addr_lock = active_addr;

        let mut info_lock = state.device_info.lock().unwrap_or_else(|p| p.into_inner());
        *info_lock = parsed_info;

        if !chs.is_empty() {
            let mut ch_lock = state.cached_channels.lock().unwrap_or_else(|p| p.into_inner());
            *ch_lock = chs;
        }
    }

    Ok(active_addr)
}

#[tauri::command]
pub async fn suto_list_ble_devices(
    timeout_ms: Option<u64>,
    suto_only: Option<bool>,
) -> Result<Vec<driver_ble::BleDeviceInfo>, String> {
    log_event("INFO", "SUTO_IPC", "suto_list_ble_devices called", None);
    let scan_duration = timeout_ms.unwrap_or(3000).max(1000).min(10000);
    let filter = suto_only.unwrap_or(false);
    driver_ble::BleTransport::list_devices(scan_duration, filter).await
}

#[tauri::command]
pub async fn suto_connect_ble(
    device_id: String,
    state: State<'_, SutoState>,
) -> Result<u8, String> {
    log_event("INFO", "SUTO_IPC", &format!("suto_connect_ble called with device_id: {}", device_id), None);

    let mut ble = driver_ble::BleTransport::connect(&device_id).await?;
    let dev_name = ble.device_name().to_string();

    // SUTO BLE sensors operate on Address 1 by default; query discovery with 'A'
    log_event("INFO", "SUTO_DISC", "Sending Address 1 Discovery Query over BLE...", None);
    let disc_pkt1 = pack_packet(1, &[CMD_DISCOVERY_ASCII]);
    let mut reply = ble.write_and_read(&disc_pkt1, 2000).unwrap_or_default();

    let mut active_addr = 1;
    if reply.is_empty() {
        log_event("INFO", "SUTO_DISC", "Address 1 query empty, falling back to Address 0 broadcast...", None);
        let disc_pkt0 = pack_packet(0, &[CMD_DISCOVERY_ASCII]);
        if let Ok(r0) = ble.write_and_read(&disc_pkt0, 2000) {
            reply = r0;
        }
    }

    if !reply.is_empty() && reply[0] != 0 {
        active_addr = reply[0];
    }

    log_event(
        "INFO",
        "SUTO_DISC",
        &format!("BLE discovery successful! Device '{}' assigned active address: {} (0x{:02X})", dev_name, active_addr, active_addr),
        None,
    );

    let parsed_info = parse_device_info(&reply);

    {
        let mut t_lock = state.transport.lock().unwrap_or_else(|p| p.into_inner());
        *t_lock = Some(Box::new(ble));

        let mut addr_lock = state.dev_addr.lock().unwrap_or_else(|p| p.into_inner());
        *addr_lock = active_addr;

        let mut info_lock = state.device_info.lock().unwrap_or_else(|p| p.into_inner());
        *info_lock = parsed_info;

        let mut sys_lock = state.system_info.lock().unwrap_or_else(|p| p.into_inner());
        *sys_lock = None;
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
    let mut tcp_map = state.tcp_devices.lock().unwrap_or_else(|p| p.into_inner());
    for (_, mut dev) in tcp_map.drain() {
        let _ = dev.transport.close();
    }
    let mut ch_lock = state.cached_channels.lock().unwrap_or_else(|p| p.into_inner());
    ch_lock.clear();
    let mut info_lock = state.device_info.lock().unwrap_or_else(|p| p.into_inner());
    *info_lock = None;
    let mut sys_lock = state.system_info.lock().unwrap_or_else(|p| p.into_inner());
    *sys_lock = None;
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

        // 1. Max channel count (`[01 FF 23]`).
        //    Determine safe fallback based on device model:
        //    - Multi-slave hubs / display loggers (is_hub_device): up to 32/64 channels.
        //    - Standalone sensors (S418, S461, S401, S415, S450, S505, S520, etc.) typically only have 2-6 channels: default max 16.
        let is_hub = dev_info.as_ref().map_or(false, |d| is_hub_device(d.identification));
        let default_scan_limit = if is_hub { 32 } else { 16 };

        let max_count = match transport.write_and_read(&pack_packet(addr, &CMD_GET_MAX_CHANNELS), 1500) {
            Ok(reply) => match deframe_multi_frame(&reply) {
                Ok(p) if p.first().is_some_and(|c| *c > 0) => (p[0] as usize).min(MAX_SCAN),
                _ => default_scan_limit,
            },
            Err(_) => default_scan_limit,
        };
        let max_count = max_count.clamp(1, MAX_SCAN);
        log_event("INFO", "SUTO_CH", &format!("Reported/effective max channel count: {} (is_hub={})", max_count, is_hub), None);

        // 2. Scan channels in batches, collecting valid descriptors keyed by id.
        let mut channels: Vec<ChannelInfo> = Vec::new();
        let mut start = 1usize;
        let mut consecutive_empty = 0usize;
        while start <= max_count {
            let cnt = BATCH.min(max_count - start + 1);
            let mut cmd = Vec::from(prefix);
            cmd.push(start as u8);
            cmd.push(cnt as u8);
            match transport.write_and_read(&pack_packet(addr, &cmd), 2500) {
                Ok(reply) => match deframe_multi_frame(&reply) {
                    Ok(deframed) => {
                        let parsed = parse_channel_settings(&deframed);
                        if parsed.is_empty() {
                            consecutive_empty += 1;
                        } else {
                            consecutive_empty = 0;
                            for ch in parsed {
                                if !channels.iter().any(|c| c.id == ch.id) {
                                    channels.push(ch);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        log_event("WARN", "SUTO_CH", &format!("Deframe failed at start={}: {}", start, e), None);
                        consecutive_empty += 1;
                    }
                },
                Err(e) => {
                    log_event("WARN", "SUTO_CH", &format!("Channel batch start={} failed: {}", start, e), None);
                    consecutive_empty += 1;
                }
            }
            if channels.len() >= max_count {
                break;
            }
            // Once we have discovered channels, if two consecutive batches beyond channel 10 return empty/error, stop early
            if !channels.is_empty() && consecutive_empty >= 2 && start >= 11 {
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

        let mut tcp_map = state.tcp_devices.lock().unwrap_or_else(|p| p.into_inner());
        for dev in tcp_map.values_mut() {
            if dev.dev_addr == addr && dev.channels.is_empty() {
                dev.channels = channels.clone();
            }
        }
    }

    Ok(channels)
}

fn poll_device_channels_values(
    transport: &mut Box<dyn SutoTransport>,
    addr: u8,
    channels: &[ChannelInfo],
) -> Vec<MeasurementValue> {
    let mut detected_count = 0u8;
    if channels.is_empty() {
        if let Ok(reply) = transport.write_and_read(&pack_packet(addr, &CMD_GET_CH_COUNT), 1500) {
            if let Ok(deframed) = deframe_multi_frame(&reply) {
                if let Some(c) = deframed.first() {
                    if *c > 0 && *c <= 128 {
                        detected_count = *c;
                    }
                }
            }
        }
        if detected_count == 0 {
            if let Ok(reply) = transport.write_and_read(&pack_packet(addr, &CMD_GET_MAX_CHANNELS), 1500) {
                if let Ok(deframed) = deframe_multi_frame(&reply) {
                    if let Some(c) = deframed.first() {
                        if *c > 0 && *c <= 128 {
                            detected_count = *c;
                        }
                    }
                }
            }
        }
    }

    let ranges: Vec<(u8, u8)> = if channels.is_empty() {
        let count = if detected_count > 0 { detected_count } else { 16u8 };
        vec![(1u8, count)]
    } else {
        let mut list: Vec<(u8, u8)> = Vec::new();
        let mut r_start = channels[0].id;
        let mut r_end = channels[0].id;

        for ch in channels.iter().skip(1) {
            if ch.id <= r_end.saturating_add(3) {
                r_end = ch.id;
            } else {
                list.push((r_start, r_end - r_start + 1));
                r_start = ch.id;
                r_end = ch.id;
            }
        }
        list.push((r_start, r_end - r_start + 1));
        list
    };

    let mut vals = Vec::new();
    const MAX_BATCH: u8 = 16;

    for (range_start, total_count) in ranges {
        let mut s = range_start;
        let mut remaining = total_count;

        while remaining > 0 {
            let count = remaining.min(MAX_BATCH);
            let ordered: Vec<ChannelInfo> = (s..s + count)
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
            get_val_cmd.push(s);
            get_val_cmd.push(count);

            let pkt = pack_packet(addr, &get_val_cmd);
            match transport.write_and_read(&pkt, 2500) {
                Ok(reply) => {
                    if let Ok(deframed) = deframe_multi_frame(&reply) {
                        let mut chunk = parse_measurement_values(&deframed, &ordered);
                        vals.append(&mut chunk);
                    }
                }
                Err(e) => {
                    log_event(
                        "WARN",
                        "SUTO_VAL",
                        &format!("Poll failed for channel range {}..={}: {}", s, s + count - 1, e),
                        None,
                    );
                }
            }

            s = s.saturating_add(count);
            remaining -= count;
        }
    }

    if !channels.is_empty() {
        vals.retain(|v| channels.iter().any(|c| c.id == v.id));
    }
    vals
}

#[tauri::command]
pub async fn suto_get_values(
    state: State<'_, SutoState>,
) -> Result<Vec<MeasurementValue>, String> {
    // 1. If we have multiple TCP devices connected (e.g. 502, 503, 504), poll each connected device
    let has_tcp_devices = {
        let tcp_map = state.tcp_devices.lock().unwrap_or_else(|p| p.into_inner());
        !tcp_map.is_empty()
    };

    if has_tcp_devices {
        let mut all_values = Vec::new();
        let mut tcp_map = state.tcp_devices.lock().unwrap_or_else(|p| p.into_inner());
        for (_endpoint, dev) in tcp_map.iter_mut() {
            let mut dev_vals = poll_device_channels_values(&mut dev.transport, dev.dev_addr, &dev.channels);
            let dev_id_str = dev.serial_number.as_ref()
                .map(|sn| format!("dev_tcp_sn_{}", sn))
                .unwrap_or_else(|| format!("dev_tcp_{}_{}", dev.host.replace('.', "_"), dev.port));
            for v in dev_vals.iter_mut() {
                v.device = dev.device_name.clone();
                v.device_id = Some(dev_id_str.clone());
                v.serial_number = dev.serial_number.clone();
                v.port = Some(dev.port);
            }
            all_values.append(&mut dev_vals);
        }
        return Ok(all_values);
    }

    // 2. Fallback to single transport (USB / BLE / single active connection)
    let (addr, channels) = {
        let addr = *state.dev_addr.lock().unwrap_or_else(|p| p.into_inner());
        let ch_lock = state.cached_channels.lock().unwrap_or_else(|p| p.into_inner());
        let mut chans = ch_lock.clone();
        chans.sort_by_key(|c| c.id);
        (addr, chans)
    };

    let mut t_lock = state.transport.lock().unwrap_or_else(|p| p.into_inner());
    let transport = t_lock.as_mut().ok_or("Device not connected")?;
    let mut all_values = poll_device_channels_values(transport, addr, &channels);

    let dev_info = { state.device_info.lock().unwrap_or_else(|p| p.into_inner()).clone() };
    let sys_info = { state.system_info.lock().unwrap_or_else(|p| p.into_inner()).clone() };
    for v in all_values.iter_mut() {
        if v.serial_number.is_none() {
            v.serial_number = sys_info.as_ref().and_then(|s| s.serial_number.clone());
        }
        if v.device.is_none() {
            v.device = sys_info.as_ref().and_then(|s| s.device_name.clone());
        }
        if v.device_id.is_none() {
            v.device_id = v.serial_number.as_ref()
                .map(|sn| format!("dev_single_sn_{}", sn))
                .or_else(|| dev_info.as_ref().map(|d| format!("dev_single_{}", d.identification)));
        }
    }

    log_event(
        "DEBUG",
        "SUTO_VAL",
        &format!(
            "Poll returned {} values: {:?}",
            all_values.len(),
            all_values.iter().map(|v| (v.id, v.value)).collect::<Vec<_>>()
        ),
        None,
    );
    Ok(all_values)
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

    // Fallback to discovery identification and model name if device_id or device_name was not populated
    let dev_info = { *state.device_info.lock().unwrap_or_else(|p| p.into_inner()) };
    if let Some(d) = dev_info {
        if info.device_id.is_none() {
            info.device_id = Some(d.identification);
        }
    }
    if info.device_name.is_none() {
        if let Some(id) = info.device_id {
            match id {
                0x1068 => info.device_name = Some("SUTO S600".to_string()),
                0x1069 => info.device_name = Some("SUTO S600-1".to_string()),
                0x106f => info.device_name = Some("SUTO S600-AC".to_string()),
                0x1049 => info.device_name = Some("SUTO S132".to_string()),
                0x121e => info.device_name = Some("SUTO S605I".to_string()),
                0x121f => info.device_name = Some("SUTO S605C".to_string()),
                0x1220 => info.device_name = Some("SUTO S606I".to_string()),
                0x1221 => info.device_name = Some("SUTO S606C".to_string()),
                0x1064 => info.device_name = Some("SUTO S330".to_string()),
                0x1065 => info.device_name = Some("SUTO S331".to_string()),
                0x1066 => info.device_name = Some("SUTO S551-P4".to_string()),
                0x1067 => info.device_name = Some("SUTO S551-P6".to_string()),
                DEVICE_TYPE_S461 => info.device_name = Some("SUTO S461".to_string()),
                DEVICE_TYPE_S463 => info.device_name = Some("SUTO S463".to_string()),
                _ => {}
            }
        }
    }

    {
        let mut sys_lock = state.system_info.lock().unwrap_or_else(|p| p.into_inner());
        *sys_lock = Some(info.clone());
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

fn format_s4a_time_str(sec: i64) -> String {
    if sec <= 0 {
        return "01-01-1970 00:00:00".to_string();
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

    format!("{:02}-{:02}-{:04} {:02}:{:02}:{:02}", day, month, year, hours, mins, secs)
}

#[tauri::command]
pub async fn suto_read_s461_log(
    app: tauri::AppHandle,
    state: State<'_, SutoState>,
    start_time: u32,
    stop_time: u32,
) -> Result<S461ReadoutResult, String> {
    let emit_prog = |percent: u32, current: usize, total: usize| {
        let _ = app.emit(
            "suto-readout-progress",
            serde_json::json!({
                "percent": percent.min(100),
                "current": current,
                "total": total,
            }),
        );
    };
    emit_prog(5, 0, 0);

    let addr = { *state.dev_addr.lock().map_err(|e| e.to_string())? };
    let dev_ident = {
        let info = state.device_info.lock().map_err(|e| e.to_string())?;
        info.map(|i| i.identification).unwrap_or(DEVICE_TYPE_S461)
    };
    let model_label = if dev_ident == DEVICE_TYPE_S463 { "S463" } else { "S461" };
    let dev_name = format!("SUTO_{:04X}", dev_ident);

    log_event(
        "INFO",
        "SUTO_LOGGER",
        &format!("Querying {} log position for range: {} .. {}", model_label, start_time, stop_time),
        None,
    );

    // 1. Get Log Time Position
    let (start_pos, end_pos) = {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        let mut cmd = vec![CTY_LOGGER, SCTY_LOG, ACT_S418_TIME_POSITION];
        cmd.extend_from_slice(&start_time.to_le_bytes());
        cmd.extend_from_slice(&stop_time.to_le_bytes());

        let pkt = pack_packet(addr, &cmd);
        let raw = transport.write_and_read(&pkt, 3000)?;
        let payload = deframe_multi_frame(&raw)?;
        if payload.len() < 8 {
            return Err("Invalid time position response from S461/S463 device".into());
        }
        let p_start = i32::from_le_bytes([payload[0], payload[1], payload[2], payload[3]]);
        let p_end = i32::from_le_bytes([payload[4], payload[5], payload[6], payload[7]]);
        (p_start, p_end)
    };

    log_event(
        "INFO",
        "SUTO_LOGGER",
        &format!("{} log positions: start = {}, end = {}", model_label, start_pos, end_pos),
        None,
    );

    if end_pos <= start_pos || start_pos < 0 {
        return Err("No recorded log data found in the selected time range on the device.".into());
    }

    let size_to_read = (end_pos - start_pos) as usize;
    emit_prog(12, 0, size_to_read);

    // 2. Timestamp compensation
    let now_sec = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as u32;
    {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        if let Some(transport) = t_lock.as_mut() {
            let mut cmd = vec![CTY_LOGGER, SCTY_LOG, ACT_S418_TIMESTAMP_COMPENSATION, 0x01];
            cmd.extend_from_slice(&now_sec.to_le_bytes());
            let pkt = pack_packet(addr, &cmd);
            let _ = transport.write_and_read(&pkt, 1500);
        }
    }

    // 3. Set Continually Start Line
    {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        let mut cmd = vec![CTY_LOGGER, SCTY_LOG, ACT_S418_SET_LOG_CONTINUALLY_START_LINE];
        cmd.extend_from_slice(&(start_pos as u32).to_le_bytes());
        let pkt = pack_packet(addr, &cmd);
        let _ = transport.write_and_read(&pkt, 2000)?;
    }

    // Helper to read a 1-byte S461/S463 setting command (`[0x0F, scty, act, 0x00]`)
    let query_s46x_byte = |scty: u8, act: u8| -> Option<u8> {
        let mut t_lock = state.transport.lock().ok()?;
        let transport = t_lock.as_mut()?;
        let cmd = [CTY_S461, scty, act, 0x00];
        let pkt = pack_packet(addr, &cmd);
        let raw = transport.write_and_read(&pkt, 1200).ok()?;
        let payload = deframe_multi_frame(&raw).ok()?;
        payload.first().copied()
    };

    // 4. Query Meter Type (0 = Flow meter, 1 = Energy meter)
    let meter_type = query_s46x_byte(0x00, 0x00).unwrap_or(0);
    let is_flow_meter = meter_type == 0;

    // For Energy meter, S463 ALWAYS uses the 44-byte AddConsumption record format;
    // S461 uses 44-byte AddConsumption when [0x0F, 0x03, 0x0B, 0x00] returns 1.
    let read_add_consumption = if is_flow_meter {
        false
    } else if dev_ident == DEVICE_TYPE_S463 {
        true
    } else {
        query_s46x_byte(0x03, 0x0B).unwrap_or(0) == 1
    };

    // 5. Query Units (matching S461FlowMeterLogReader & S461EnergyMeterLogReader)
    let mut flow_unit_idx = query_s46x_byte(0x00, 0x08).unwrap_or(0);
    if flow_unit_idx < 1 || flow_unit_idx == 255 {
        flow_unit_idx = 14; // m³/h
    }
    let mut velocity_unit_idx = query_s46x_byte(0x01, 0x1F).unwrap_or(0);
    if velocity_unit_idx < 1 || velocity_unit_idx == 255 {
        velocity_unit_idx = 10; // m/s
    }
    let mut consumption_unit_idx = query_s46x_byte(0x00, 0x0B).unwrap_or(0);
    if consumption_unit_idx < 1 || consumption_unit_idx == 255 {
        consumption_unit_idx = 24; // m³
    }
    let mut energy_flow_unit_idx = query_s46x_byte(0x01, 0x1A).unwrap_or(0);
    if energy_flow_unit_idx < 1 || energy_flow_unit_idx == 255 {
        energy_flow_unit_idx = 133; // GJ/h
    }
    let mut energy_unit_idx = query_s46x_byte(0x01, 0x1D).unwrap_or(0);
    if energy_unit_idx < 1 || energy_unit_idx == 255 {
        energy_unit_idx = 138; // GJ
    }
    let mut temp_unit_idx = query_s46x_byte(0x01, 0x23).unwrap_or(0);
    if temp_unit_idx < 1 || temp_unit_idx == 255 {
        temp_unit_idx = 1; // °C
    }

    let flow_unit = lookup_unit(flow_unit_idx, "");
    let velocity_unit = lookup_unit(velocity_unit_idx, "");
    let consumption_unit = lookup_unit(consumption_unit_idx, "");
    let energy_flow_unit = lookup_unit(energy_flow_unit_idx, "");
    let energy_unit = lookup_unit(energy_unit_idx, "");
    let temp_unit = lookup_unit(temp_unit_idx, "");

    log_event(
        "INFO",
        "SUTO_LOGGER",
        &format!(
            "{} readout mode: meter_type={}, add_consumption={}, flow_u={}, vel_u={}, cons_u={}, eflow_u={}, energy_u={}, temp_u={}",
            model_label, meter_type, read_add_consumption, flow_unit, velocity_unit, consumption_unit, energy_flow_unit, energy_unit, temp_unit
        ),
        None,
    );

    // 6. Continually read records
    let record_len: usize = if is_flow_meter {
        20
    } else if read_add_consumption {
        44
    } else {
        28
    };
    let batch_size: usize = if read_add_consumption { 44 } else { 50 };

    struct S46xRecord {
        timestamp: u32,
        flow: f32,
        velocity: f32,
        consumption: f32,
        rev_consumption: f32,
        energy_flow: f32,
        delta: f32,
        heat_energy: f32,
        cold_energy: f32,
        temp_inlet: f32,
        temp_outlet: f32,
    }

    let sanitize = |v: f32| -> f32 {
        if v.is_nan() || !v.is_finite() || v <= -8000.0 {
            -9999.0
        } else {
            v
        }
    };

    let mut records: Vec<S46xRecord> = Vec::with_capacity(size_to_read);
    let mut offset = 0usize;

    while offset < size_to_read {
        let chunk_size = (size_to_read - offset).min(batch_size);
        let mut cmd = vec![CTY_LOGGER, SCTY_LOG, ACT_GET_LOG_CONTINUALLY];
        cmd.extend_from_slice(&(chunk_size as u32).to_le_bytes());

        let raw = {
            let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
            let transport = t_lock.as_mut().ok_or("Device not connected")?;
            let pkt = pack_packet(addr, &cmd);
            transport.write_and_read(&pkt, 4000)?
        };

        let payload = deframe_multi_frame(&raw)?;
        if payload.len() < record_len {
            log_event(
                "WARN",
                "SUTO_LOGGER",
                &format!("Received short payload during {} readout: {} bytes (expected {})", model_label, payload.len(), record_len),
                None,
            );
            break;
        }

        let chunk_count = payload.len() / record_len;
        let read_f32 = |slice: &[u8], off: usize| -> f32 {
            sanitize(f32::from_le_bytes([slice[off], slice[off + 1], slice[off + 2], slice[off + 3]]))
        };

        for item in payload.chunks_exact(record_len) {
            let ts = u32::from_le_bytes([item[0], item[1], item[2], item[3]]);
            if is_flow_meter {
                // CSCOMM_S461_LOG_VALUE_FLOW_METER (20 bytes)
                records.push(S46xRecord {
                    timestamp: ts,
                    flow: read_f32(item, 4),
                    velocity: read_f32(item, 8),
                    consumption: read_f32(item, 12),
                    rev_consumption: read_f32(item, 16),
                    energy_flow: -9999.0,
                    delta: -9999.0,
                    heat_energy: -9999.0,
                    cold_energy: -9999.0,
                    temp_inlet: -9999.0,
                    temp_outlet: -9999.0,
                });
            } else if read_add_consumption {
                // CSCOMM_S461_LOG_VALUE_ENERGY_METER_ADD_CONSUMPTION (44 bytes)
                records.push(S46xRecord {
                    timestamp: ts,
                    flow: read_f32(item, 4),
                    velocity: read_f32(item, 8),
                    consumption: read_f32(item, 12),
                    rev_consumption: read_f32(item, 16),
                    energy_flow: read_f32(item, 20),
                    delta: read_f32(item, 24),
                    heat_energy: read_f32(item, 28),
                    cold_energy: read_f32(item, 32),
                    temp_inlet: read_f32(item, 36),
                    temp_outlet: read_f32(item, 40),
                });
            } else {
                // CSCOMM_S461_LOG_VALUE_ENERGY_METER (28 bytes)
                records.push(S46xRecord {
                    timestamp: ts,
                    flow: read_f32(item, 4),
                    velocity: read_f32(item, 8),
                    consumption: -9999.0,
                    rev_consumption: -9999.0,
                    energy_flow: read_f32(item, 12),
                    delta: read_f32(item, 16),
                    heat_energy: read_f32(item, 20),
                    cold_energy: read_f32(item, 24),
                    temp_inlet: -9999.0,
                    temp_outlet: -9999.0,
                });
            }
        }

        offset += chunk_count;
        let pct = 15 + ((offset as f64 / size_to_read.max(1) as f64) * 80.0).round() as u32;
        emit_prog(pct.min(95), offset.min(size_to_read), size_to_read);
        tokio::task::yield_now().await;
        if chunk_count < chunk_size {
            break;
        }
    }

    if records.is_empty() {
        return Err("No logger records retrieved from device".into());
    }

    // Helper unit conversion functions (exact mirror of S461FlowMeterLogReader & S461EnergyMeterLogReader)
    let is_valid = |x: f32| -> bool { !x.is_nan() && x.is_finite() && x > -8000.0 };

    let convert_flow = |v: f32| -> f64 {
        if !is_valid(v) { return -9999.0; }
        let x = v as f64;
        match flow_unit_idx {
            15 => x / 60.0,
            16 => 1000.0 * (x / 60.0),
            18 => 35.3146667 * (x / 60.0),
            83 => 35.3146667 * (x / 3600.0),
            143 => 264.1720524 * (x / 60.0),
            144 => 219.9692483 * (x / 60.0),
            145 => 6.2898108 * (x / 60.0),
            _ => x,
        }
    };
    let convert_velocity = |v: f32| -> f64 {
        if !is_valid(v) { return -9999.0; }
        let x = v as f64;
        match velocity_unit_idx {
            11 => 3.2808399 * 60.0 * x,
            _ => x,
        }
    };
    let convert_consumption = |v: f32| -> f64 {
        if !is_valid(v) { return -9999.0; }
        let x = v as f64;
        match consumption_unit_idx {
            25 => 1000.0 * x,
            26 => 35.3146667 * x,
            146 => 264.1720524 * x,
            147 => (264.1720524 / 42.0) * x,
            148 => 219.9692483 * x,
            _ => x,
        }
    };
    let convert_energy_flow = |v: f32| -> f64 {
        if !is_valid(v) { return -9999.0; }
        let x = v as f64;
        match energy_flow_unit_idx {
            134 => 238845.897 * x,
            135 => 947.817 * x,
            136 => 1000000.0 * x,
            137 => 947817.0 * x,
            102 => 277.8 * x,
            121 => 0.2778 * x,
            _ => x,
        }
    };
    let convert_energy = |v: f32| -> f64 {
        if !is_valid(v) { return -9999.0; }
        let x = v as f64;
        match energy_unit_idx {
            139 => 238845.897 * x,
            140 => 947.817 * x,
            141 => 1000000.0 * x,
            142 => 947817.0 * x,
            105 => 277.8 * x,
            122 => 0.2778 * x,
            _ => x,
        }
    };
    let convert_delta = |v: f32| -> f64 {
        if !is_valid(v) { return -9999.0; }
        let x = v as f64;
        if temp_unit_idx == 2 {
            (x * 1.8 * 10.0 + 0.5).floor() / 10.0
        } else {
            x
        }
    };
    let convert_temp = |v: f32| -> f64 {
        if !is_valid(v) { return -9999.0; }
        let x = v as f64;
        if temp_unit_idx == 2 {
            1.8 * x + 32.0
        } else {
            x
        }
    };

    let flow_prec: usize = if flow_unit_idx == 18 { 2 } else { 1 };
    let vel_prec: usize = if velocity_unit_idx == 11 { 0 } else { 2 };
    let cons_prec: usize = if consumption_unit_idx == 25 { 0 } else { 1 };
    let eflow_prec: usize = match energy_flow_unit_idx {
        134 | 136 | 137 => 0,
        133 | 135 => 2,
        102 => 1,
        121 => 3,
        _ => 2,
    };
    let fmt_val = |val: f64, prec: usize| -> String {
        if val <= -8000.0 {
            "-9999.0".to_string()
        } else {
            format!("{:.*}", prec, val)
        }
    };
    let step_str = |prec: usize| -> &'static str {
        match prec {
            0 => "1",
            1 => "0.1",
            2 => "0.01",
            _ => "0.001",
        }
    };

    // 7. Format CSV in standard S4A format
    let first_ts = records.first().map(|r| r.timestamp as i64).unwrap_or(start_time as i64);
    let last_ts = records.last().map(|r| r.timestamp as i64).unwrap_or(stop_time as i64);
    let interval = if records.len() > 1 {
        let diff = records[1].timestamp.saturating_sub(records[0].timestamp);
        if diff > 0 { diff } else { 1 }
    } else {
        1
    };

    let start_date_str = format_s4a_time_str(first_ts);
    let end_date_str = format_s4a_time_str(last_ts);

    let mut csv_lines = Vec::new();
    csv_lines.push(format!("{} Raw Data", dev_name));
    csv_lines.push("".to_string());
    csv_lines.push(format!("Start Date Time,{}", start_date_str));
    csv_lines.push(format!("End Date Time,{}", end_date_str));
    csv_lines.push(format!("Sample Rate(sec),{}", interval));

    if is_flow_meter {
        csv_lines.push("NO.Of Channels,4".to_string());
        csv_lines.push(format!("NO.Of Records,{}", records.len()));
        csv_lines.push("".to_string());
        csv_lines.push("No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point".to_string());
        csv_lines.push(format!("1,Flow,{},{},{},Location 1/Flow", model_label, flow_unit, step_str(flow_prec)));
        csv_lines.push(format!("2,Velocity,{},{},{},Location 1/Velocity", model_label, velocity_unit, step_str(vel_prec)));
        csv_lines.push(format!("3,Consumption,{},{},{},Location 1/Consumption", model_label, consumption_unit, step_str(cons_prec)));
        csv_lines.push(format!("4,Consumption Reverse,{},{},{},Location 1/Consumption Reverse", model_label, consumption_unit, step_str(cons_prec)));
        csv_lines.push("".to_string());
        csv_lines.push(format!("Date Time,Flow - {},Velocity - {},Consumption - {},Consumption Reverse - {}", flow_unit, velocity_unit, consumption_unit, consumption_unit));

        for r in &records {
            let dt = format_s4a_time_str(r.timestamp as i64);
            let s1 = fmt_val(convert_flow(r.flow), flow_prec);
            let s2 = fmt_val(convert_velocity(r.velocity), vel_prec);
            let s3 = fmt_val(convert_consumption(r.consumption), cons_prec);
            let s4 = fmt_val(convert_consumption(r.rev_consumption), cons_prec);
            csv_lines.push(format!("{},{},{},{},{}", dt, s1, s2, s3, s4));
        }
    } else if read_add_consumption {
        csv_lines.push("NO.Of Channels,10".to_string());
        csv_lines.push(format!("NO.Of Records,{}", records.len()));
        csv_lines.push("".to_string());
        csv_lines.push("No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point".to_string());
        csv_lines.push(format!("1,Energy Flow,{},{},{},Location 1/Energy Flow", model_label, energy_flow_unit, step_str(eflow_prec)));
        csv_lines.push(format!("2,Heat Total,{},{},0.1,Location 1/Heat Total", model_label, energy_unit));
        csv_lines.push(format!("3,Cold Total,{},{},0.1,Location 1/Cold Total", model_label, energy_unit));
        csv_lines.push(format!("4,Delta T,{},{},0.1,Location 1/Delta T", model_label, temp_unit));
        csv_lines.push(format!("5,Flow,{},{},{},Location 1/Flow", model_label, flow_unit, step_str(flow_prec)));
        csv_lines.push(format!("6,Velocity,{},{},{},Location 1/Velocity", model_label, velocity_unit, step_str(vel_prec)));
        csv_lines.push(format!("7,Consumption(F),{},{},{},Location 1/Consumption(F)", model_label, consumption_unit, step_str(cons_prec)));
        csv_lines.push(format!("8,Consumption(R),{},{},{},Location 1/Consumption(R)", model_label, consumption_unit, step_str(cons_prec)));
        csv_lines.push(format!("9,Temperature Inlet,{},{},0.1,Location 1/Temperature Inlet", model_label, temp_unit));
        csv_lines.push(format!("10,Temperature Outlet,{},{},0.1,Location 1/Temperature Outlet", model_label, temp_unit));
        csv_lines.push("".to_string());
        csv_lines.push(format!(
            "Date Time,Energy Flow - {},Heat Total - {},Cold Total - {},Delta T - {},Flow - {},Velocity - {},Consumption(F) - {},Consumption(R) - {},Temperature Inlet - {},Temperature Outlet - {}",
            energy_flow_unit, energy_unit, energy_unit, temp_unit, flow_unit, velocity_unit, consumption_unit, consumption_unit, temp_unit, temp_unit
        ));

        for r in &records {
            let dt = format_s4a_time_str(r.timestamp as i64);
            let s1 = fmt_val(convert_energy_flow(r.energy_flow), eflow_prec);
            let s2 = fmt_val(convert_energy(r.heat_energy), 1);
            let s3 = fmt_val(convert_energy(r.cold_energy), 1);
            let s4 = fmt_val(convert_delta(r.delta), 1);
            let s5 = fmt_val(convert_flow(r.flow), flow_prec);
            let s6 = fmt_val(convert_velocity(r.velocity), vel_prec);
            let s7 = fmt_val(convert_consumption(r.consumption), cons_prec);
            let s8 = fmt_val(convert_consumption(r.rev_consumption), cons_prec);
            let s9 = fmt_val(convert_temp(r.temp_inlet), 1);
            let s10 = fmt_val(convert_temp(r.temp_outlet), 1);
            csv_lines.push(format!("{},{},{},{},{},{},{},{},{},{},{}", dt, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10));
        }
    } else {
        csv_lines.push("NO.Of Channels,6".to_string());
        csv_lines.push(format!("NO.Of Records,{}", records.len()));
        csv_lines.push("".to_string());
        csv_lines.push("No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point".to_string());
        csv_lines.push(format!("1,Energy Flow,{},{},{},Location 1/Energy Flow", model_label, energy_flow_unit, step_str(eflow_prec)));
        csv_lines.push(format!("2,Heat Total,{},{},0.1,Location 1/Heat Total", model_label, energy_unit));
        csv_lines.push(format!("3,Cold Total,{},{},0.1,Location 1/Cold Total", model_label, energy_unit));
        csv_lines.push(format!("4,Delta T,{},{},0.1,Location 1/Delta T", model_label, temp_unit));
        csv_lines.push(format!("5,Flow,{},{},{},Location 1/Flow", model_label, flow_unit, step_str(flow_prec)));
        csv_lines.push(format!("6,Velocity,{},{},{},Location 1/Velocity", model_label, velocity_unit, step_str(vel_prec)));
        csv_lines.push("".to_string());
        csv_lines.push(format!(
            "Date Time,Energy Flow - {},Heat Total - {},Cold Total - {},Delta T - {},Flow - {},Velocity - {}",
            energy_flow_unit, energy_unit, energy_unit, temp_unit, flow_unit, velocity_unit
        ));

        for r in &records {
            let dt = format_s4a_time_str(r.timestamp as i64);
            let s1 = fmt_val(convert_energy_flow(r.energy_flow), eflow_prec);
            let s2 = fmt_val(convert_energy(r.heat_energy), 1);
            let s3 = fmt_val(convert_energy(r.cold_energy), 1);
            let s4 = fmt_val(convert_delta(r.delta), 1);
            let s5 = fmt_val(convert_flow(r.flow), flow_prec);
            let s6 = fmt_val(convert_velocity(r.velocity), vel_prec);
            csv_lines.push(format!("{},{},{},{},{},{},{}", dt, s1, s2, s3, s4, s5, s6));
        }
    }

    let csv_text = csv_lines.join("\r\n") + "\r\n";
    let safe_dev = dev_name.replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-', "_");
    let filename = format!("{}_Logger_Data.csv", safe_dev);

    log_event(
        "INFO",
        "SUTO_LOGGER",
        &format!("Successfully extracted {} real records from {} logger", records.len(), model_label),
        None,
    );

    emit_prog(100, records.len(), size_to_read);

    Ok(S461ReadoutResult {
        csv_text,
        row_count: records.len(),
        filename,
    })
}

#[tauri::command]
pub async fn suto_read_s418_log(
    app: tauri::AppHandle,
    state: State<'_, SutoState>,
    start_time: u32,
    stop_time: u32,
) -> Result<S461ReadoutResult, String> {
    let emit_prog = |percent: u32, current: usize, total: usize| {
        let _ = app.emit(
            "suto-readout-progress",
            serde_json::json!({
                "percent": percent.min(100),
                "current": current,
                "total": total,
            }),
        );
    };
    emit_prog(5, 0, 0);

    let addr = { *state.dev_addr.lock().map_err(|e| e.to_string())? };
    let dev_ident = {
        let info = state.device_info.lock().map_err(|e| e.to_string())?;
        info.map(|i| i.identification).unwrap_or(DEVICE_TYPE_S418_MIN)
    };
    let model_label = if matches!(dev_ident, 0x1212 | 0x1213 | 0x1214 | 0x1215 | 0x1219) {
        "S419"
    } else {
        "S418"
    };
    let dev_name = format!("SUTO_{:04X}", dev_ident);

    log_event(
        "INFO",
        "SUTO_LOGGER",
        &format!("Querying {} log position for range: {} .. {}", model_label, start_time, stop_time),
        None,
    );

    // 1. Get Log Time Position
    let (start_pos, end_pos) = {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        let mut cmd = vec![CTY_LOGGER, SCTY_LOG, ACT_S418_TIME_POSITION];
        cmd.extend_from_slice(&start_time.to_le_bytes());
        cmd.extend_from_slice(&stop_time.to_le_bytes());

        let pkt = pack_packet(addr, &cmd);
        let raw = transport.write_and_read(&pkt, 3000)?;
        let payload = deframe_multi_frame(&raw)?;
        if payload.len() < 8 {
            return Err("Invalid time position response from S418 device".into());
        }
        let p_start = i32::from_le_bytes([payload[0], payload[1], payload[2], payload[3]]);
        let p_end = i32::from_le_bytes([payload[4], payload[5], payload[6], payload[7]]);
        (p_start, p_end)
    };

    log_event(
        "INFO",
        "SUTO_LOGGER",
        &format!("{} log positions: start = {}, end = {}", model_label, start_pos, end_pos),
        None,
    );

    if end_pos <= start_pos || start_pos < 0 {
        return Err("No recorded log data found in the selected time range on the device.".into());
    }

    let size_to_read = (end_pos - start_pos) as usize;
    emit_prog(12, 0, size_to_read);

    // 2. Timestamp compensation
    let now_sec = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as u32;
    {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        if let Some(transport) = t_lock.as_mut() {
            let mut cmd = vec![CTY_LOGGER, SCTY_LOG, ACT_S418_TIMESTAMP_COMPENSATION, 0x01];
            cmd.extend_from_slice(&now_sec.to_le_bytes());
            let pkt = pack_packet(addr, &cmd);
            let _ = transport.write_and_read(&pkt, 1500);
        }
    }

    // 3. Set Continually Start Line
    {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        let mut cmd = vec![CTY_LOGGER, SCTY_LOG, ACT_S418_SET_LOG_CONTINUALLY_START_LINE];
        cmd.extend_from_slice(&(start_pos as u32).to_le_bytes());
        let pkt = pack_packet(addr, &cmd);
        let _ = transport.write_and_read(&pkt, 2000)?;
    }

    // 4. Query S418 units & gas density (matching S418LogReader.java & Commands.java)
    let query_s418_cmd = |cmd: &[u8]| -> Option<Vec<u8>> {
        let mut t_lock = state.transport.lock().ok()?;
        let transport = t_lock.as_mut()?;
        let pkt = pack_packet(addr, cmd);
        let raw = transport.write_and_read(&pkt, 1200).ok()?;
        deframe_multi_frame(&raw).ok()
    };

    let flow_unit_idx = query_s418_cmd(&[0x09, 0x03, 0x09])
        .and_then(|p| p.first().copied())
        .filter(|&u| u != 0 && u != 255)
        .unwrap_or(14);
    let cons_unit_idx = query_s418_cmd(&[0x09, 0x03, 0x67, 0x00])
        .and_then(|p| p.first().copied())
        .filter(|&u| u != 0 && u != 255)
        .unwrap_or(24);
    let press_unit_idx = query_s418_cmd(&[0x09, 0x03, 0x0B, 0x00])
        .and_then(|p| p.first().copied())
        .filter(|&u| u != 0 && u != 255)
        .unwrap_or(38);
    let temp_unit_idx = query_s418_cmd(&[0x09, 0x03, 0x69, 0x00])
        .and_then(|p| p.first().copied())
        .filter(|&u| u != 0 && u != 255)
        .unwrap_or(1);

    let gas_density = query_s418_cmd(&[0x09, 0x03, 0xA0])
        .and_then(|p| {
            if p.len() >= 4 {
                let d = f32::from_le_bytes([p[0], p[1], p[2], p[3]]);
                if !d.is_nan() && d.is_finite() && d > 0.0 {
                    Some(d as f64)
                } else {
                    None
                }
            } else {
                None
            }
        })
        .unwrap_or(1.293);

    // 5. Continually read 24-byte records (CSCOMM_S418_LOG_VALUE)
    const RECORD_LEN: usize = 24;
    const BATCH_SIZE: usize = 60;

    struct S418Record {
        timestamp: u32,
        flow: f32,
        consumption: f64,
        pressure: f32,
        temperature: f32,
    }

    let mut records: Vec<S418Record> = Vec::with_capacity(size_to_read);
    let mut offset = 0usize;

    while offset < size_to_read {
        let chunk_size = (size_to_read - offset).min(BATCH_SIZE);
        let mut cmd = vec![CTY_LOGGER, SCTY_LOG, ACT_GET_LOG_CONTINUALLY];
        cmd.extend_from_slice(&(chunk_size as u32).to_le_bytes());

        let raw = {
            let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
            let transport = t_lock.as_mut().ok_or("Device not connected")?;
            let pkt = pack_packet(addr, &cmd);
            transport.write_and_read(&pkt, 4000)?
        };

        let payload = deframe_multi_frame(&raw)?;
        if payload.len() < RECORD_LEN {
            log_event(
                "WARN",
                "SUTO_LOGGER",
                &format!("Received short payload during {} readout: {} bytes", model_label, payload.len()),
                None,
            );
            break;
        }

        let chunk_count = payload.len() / RECORD_LEN;
        for item in payload.chunks_exact(RECORD_LEN) {
            let ts = u32::from_le_bytes([item[0], item[1], item[2], item[3]]);
            let flow = f32::from_le_bytes([item[4], item[5], item[6], item[7]]);
            let cons = f64::from_le_bytes([
                item[8], item[9], item[10], item[11],
                item[12], item[13], item[14], item[15],
            ]);
            let press = f32::from_le_bytes([item[16], item[17], item[18], item[19]]);
            let temp = f32::from_le_bytes([item[20], item[21], item[22], item[23]]);

            records.push(S418Record {
                timestamp: ts,
                flow,
                consumption: cons,
                pressure: press,
                temperature: temp,
            });
        }

        offset += chunk_count;
        let pct = 15 + ((offset as f64 / size_to_read.max(1) as f64) * 80.0).round() as u32;
        emit_prog(pct.min(95), offset.min(size_to_read), size_to_read);
        tokio::task::yield_now().await;
        if chunk_count < chunk_size {
            break;
        }
    }

    if records.is_empty() {
        return Err("No logger records retrieved from device".into());
    }

    // 6. Format CSV with S418 unit conversions (matching S418LogReader.java)
    let flow_unit_str = match flow_unit_idx {
        16 => "l/min",
        18 => "cfm",
        52 => "kg/h",
        _ => "m³/h",
    };
    let cons_unit_str = match cons_unit_idx {
        25 => "l",
        26 => "cf",
        47 => "kg",
        _ => "m³",
    };
    let press_unit_str = match press_unit_idx {
        39 => "PSI",
        36 => "MPa",
        _ => "bar",
    };
    let temp_unit_str = if temp_unit_idx == 2 { "°F" } else { "°C" };

    let first_ts = records.first().map(|r| r.timestamp as i64).unwrap_or(start_time as i64);
    let last_ts = records.last().map(|r| r.timestamp as i64).unwrap_or(stop_time as i64);
    let interval = if records.len() > 1 {
        let diff = records[1].timestamp.saturating_sub(records[0].timestamp);
        if diff > 0 { diff } else { 1 }
    } else {
        1
    };

    let mut csv_lines = Vec::new();
    csv_lines.push(format!("{} Raw Data", dev_name));
    csv_lines.push("".to_string());
    csv_lines.push(format!("Start Date Time,{}", format_s4a_time_str(first_ts)));
    csv_lines.push(format!("End Date Time,{}", format_s4a_time_str(last_ts)));
    csv_lines.push(format!("Sample Rate(sec),{}", interval));
    csv_lines.push("NO.Of Channels,4".to_string());
    csv_lines.push(format!("NO.Of Records,{}", records.len()));
    csv_lines.push("".to_string());
    csv_lines.push("No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point".to_string());
    csv_lines.push(format!("1,Flow,{},{},0.1,Location 1/Flow", model_label, flow_unit_str));
    csv_lines.push(format!("2,Consumption,{},{},1,Location 1/Consumption", model_label, cons_unit_str));
    csv_lines.push(format!("3,Pressure,{},{},0.1,Location 1/Pressure", model_label, press_unit_str));
    csv_lines.push(format!("4,Temperature,{},{},0.1,Location 1/Temperature", model_label, temp_unit_str));
    csv_lines.push("".to_string());
    csv_lines.push(format!(
        "Date Time,Flow - {},Consumption - {},Pressure - {},Temperature - {}",
        flow_unit_str, cons_unit_str, press_unit_str, temp_unit_str
    ));

    let is_valid_f32 = |v: f32| -> bool { !v.is_nan() && v.is_finite() && v > -8000.0 };
    let is_valid_f64 = |v: f64| -> bool { !v.is_nan() && v.is_finite() && v > -8000.0 };

    for r in &records {
        let dt = format_s4a_time_str(r.timestamp as i64);

        let f_str = if !is_valid_f32(r.flow) {
            "-9999.0".to_string()
        } else {
            let mut v = r.flow as f64;
            match flow_unit_idx {
                16 => v *= 16.666667,
                18 => v *= 0.588578,
                52 => v *= gas_density,
                _ => {}
            }
            format!("{:.1}", v)
        };

        let c_str = if !is_valid_f64(r.consumption) {
            "-9999.0".to_string()
        } else {
            let mut v = r.consumption;
            match cons_unit_idx {
                25 => v *= 1000.0,
                26 => v *= 35.314667,
                47 => v *= gas_density,
                _ => {}
            }
            format!("{:.0}", v)
        };

        let p_str = if !is_valid_f32(r.pressure) {
            "-9999.0".to_string()
        } else {
            let mut v = r.pressure as f64;
            match press_unit_idx {
                39 => v *= 14.5037744,
                36 => v *= 0.1,
                _ => {}
            }
            format!("{:.1}", v)
        };

        let t_str = if !is_valid_f32(r.temperature) {
            "-9999.0".to_string()
        } else {
            let mut v = r.temperature as f64;
            if temp_unit_idx == 2 {
                v = v * 1.8 + 32.0;
            }
            format!("{:.1}", v)
        };

        csv_lines.push(format!("{},{},{},{},{}", dt, f_str, c_str, p_str, t_str));
    }

    let csv_text = csv_lines.join("\r\n") + "\r\n";
    let safe_dev = dev_name.replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-', "_");
    let filename = format!("{}_Logger_Data.csv", safe_dev);

    log_event(
        "INFO",
        "SUTO_LOGGER",
        &format!("Successfully extracted {} real records from {} logger", records.len(), model_label),
        None,
    );

    emit_prog(100, records.len(), size_to_read);

    Ok(S461ReadoutResult {
        csv_text,
        row_count: records.len(),
        filename,
    })
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

#[tauri::command]
pub async fn suto_get_600_csd_files(
    state: State<'_, SutoState>,
) -> Result<Vec<S600CsdEntry>, String> {
    let addr = { *state.dev_addr.lock().map_err(|e| e.to_string())? };
    log_event("INFO", "SUTO_S600", "Querying S600 CSD sessions for report generation...", None);

    let file_count = {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        let cmd = [CTY_LOGGER, 0xFF, ACT_LOGGER_GET_CSD_FILE_NUMBER];
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

    if file_count == 0 {
        return Ok(Vec::new());
    }

    let mut list = Vec::new();
    let mut current_idx = 0u32;
    let batch_size = 10u32;

    while current_idx < file_count {
        let batch_num = (file_count - current_idx).min(batch_size);
        let mut cmd = vec![CTY_LOGGER, 0xFF, ACT_GET_CSD_FILE_INFO];
        cmd.extend_from_slice(&current_idx.to_le_bytes());
        cmd.extend_from_slice(&batch_num.to_le_bytes());

        let res = {
            let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
            let transport = t_lock.as_mut().ok_or("Device not connected")?;
            let pkt = pack_packet(addr, &cmd);
            let raw = transport.write_and_read(&pkt, 4000)?;
            deframe_multi_frame(&raw)?
        };

        let one_len = 42usize;
        let mut offset = 0usize;
        let mut i = 0u32;
        while offset + one_len <= res.len() && i < batch_num {
            let chunk = &res[offset..offset + one_len];
            let id = u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
            let name_raw = &chunk[4..34];
            let zero_pos = name_raw.iter().position(|&b| b == 0).unwrap_or(name_raw.len());
            let name = String::from_utf8_lossy(&name_raw[..zero_pos]).trim().to_string();
            let size = u32::from_le_bytes([chunk[34], chunk[35], chunk[36], chunk[37]]);
            let date = u32::from_le_bytes([chunk[38], chunk[39], chunk[40], chunk[41]]);
            let date_str = format_unix_time_str(date as i64);

            if !name.is_empty() {
                list.push(S600CsdEntry {
                    id,
                    name,
                    size,
                    date,
                    date_str,
                });
            }
            i += 1;
            offset += one_len;
        }

        current_idx += batch_num;
    }

    log_event("INFO", "SUTO_S600", &format!("Retrieved {} S600 CSD session files for report", list.len()), None);
    Ok(list)
}

#[tauri::command]
pub async fn suto_generate_600_report(
    id: u32,
    name: String,
    size: u32,
    date: u32,
    state: State<'_, SutoState>,
) -> Result<S600ReportDownloadResult, String> {
    let addr = { *state.dev_addr.lock().map_err(|e| e.to_string())? };
    log_event("INFO", "SUTO_S600", &format!("Triggering S600 report generation for file '{}' (ID: {})...", name, id), None);

    // Build 42-byte CSCOMM_600CSD_FILE_INFO struct
    let mut csd_struct = Vec::with_capacity(42);
    csd_struct.extend_from_slice(&id.to_le_bytes());
    let mut name_buf = [0u8; 30];
    let nb = name.as_bytes();
    let copy_len = nb.len().min(30);
    name_buf[..copy_len].copy_from_slice(&nb[..copy_len]);
    csd_struct.extend_from_slice(&name_buf);
    csd_struct.extend_from_slice(&size.to_le_bytes());
    csd_struct.extend_from_slice(&date.to_le_bytes());

    // 1. Send ACT_CSD_TO_REPORT (0x03, 0xFF, 0x26)
    let reply = {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        let mut cmd = vec![CTY_LOGGER, 0xFF, ACT_CSD_TO_REPORT];
        cmd.extend_from_slice(&csd_struct);
        let pkt = pack_packet(addr, &cmd);
        let raw = transport.write_and_read(&pkt, 4000)?;
        let deframed = deframe_multi_frame(&raw)?;
        if deframed.len() >= 4 {
            i32::from_le_bytes([deframed[0], deframed[1], deframed[2], deframed[3]])
        } else {
            0
        }
    };

    if reply < 0 {
        if reply == -100663362 {
            log_event("WARN", "SUTO_S600", "Device reported CSD repair needed (-100663362). Attempting repair...", None);
            let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
            let transport = t_lock.as_mut().ok_or("Device not connected")?;
            let mut cmd = vec![CTY_LOGGER, 0xFF, ACT_CSD_FILE_REPAIR];
            cmd.extend_from_slice(&csd_struct);
            let pkt = pack_packet(addr, &cmd);
            let _ = transport.write_and_read(&pkt, 4000);

            // Retry generate after repair
            let mut cmd_retry = vec![CTY_LOGGER, 0xFF, ACT_CSD_TO_REPORT];
            cmd_retry.extend_from_slice(&csd_struct);
            let pkt_retry = pack_packet(addr, &cmd_retry);
            let raw = transport.write_and_read(&pkt_retry, 4000)?;
            let deframed = deframe_multi_frame(&raw)?;
            let rep2 = if deframed.len() >= 4 {
                i32::from_le_bytes([deframed[0], deframed[1], deframed[2], deframed[3]])
            } else {
                0
            };
            if rep2 < 0 {
                return Err(format!("Report generation failed after repair (code {})", rep2));
            }
        } else {
            return Err(format!("Report generation failed (code {})", reply));
        }
    }

    // 2. Poll ACT_CSD_TO_REPORT_STATUS (0x03, 0xFF, 0x27) until status == 0
    let mut finished = false;
    for attempt in 1..=45 {
        std::thread::sleep(std::time::Duration::from_millis(1000));
        let status = {
            let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
            let transport = t_lock.as_mut().ok_or("Device not connected")?;
            let cmd = [CTY_LOGGER, 0xFF, ACT_CSD_TO_REPORT_STATUS];
            let pkt = pack_packet(addr, &cmd);
            match transport.write_and_read(&pkt, 3000) {
                Ok(raw) => {
                    let deframed = deframe_multi_frame(&raw).unwrap_or_default();
                    if deframed.len() >= 4 {
                        i32::from_le_bytes([deframed[0], deframed[1], deframed[2], deframed[3]])
                    } else {
                        1
                    }
                }
                Err(_) => 1,
            }
        };

        log_event("INFO", "SUTO_S600", &format!("Polling S600 report status (attempt {}/45): {}", attempt, status), None);
        if status == 0 {
            finished = true;
            break;
        }
    }

    if !finished {
        return Err("Report generation timed out on device after 45 seconds.".into());
    }

    // 3. Query report info ACT_CSD_TO_REPORT_INFO (0x03, 0xFF, 0x28)
    let (rep_name, rep_size, rep_date) = {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        let cmd = [CTY_LOGGER, 0xFF, ACT_CSD_TO_REPORT_INFO];
        let pkt = pack_packet(addr, &cmd);
        let raw = transport.write_and_read(&pkt, 3000)?;
        let deframed = deframe_multi_frame(&raw)?;
        if deframed.len() < 58 {
            return Err("Invalid report info received from device".into());
        }
        let name_raw = &deframed[0..50];
        let zero_pos = name_raw.iter().position(|&b| b == 0).unwrap_or(name_raw.len());
        let name_str = String::from_utf8_lossy(&name_raw[..zero_pos]).trim().to_string();
        let f_size = u32::from_le_bytes([deframed[50], deframed[51], deframed[52], deframed[53]]);
        let f_date = u32::from_le_bytes([deframed[54], deframed[55], deframed[56], deframed[57]]);
        (name_str, f_size, f_date)
    };

    log_event("INFO", "SUTO_S600", &format!("Report generated: '{}' (size: {} bytes). Downloading...", rep_name, rep_size), None);

    // 4. Download report file ACT_CSD_TO_REPORT_FILE (0x03, 0xFF, 0x29)
    let pdf_bytes = {
        let mut t_lock = state.transport.lock().map_err(|e| e.to_string())?;
        let transport = t_lock.as_mut().ok_or("Device not connected")?;
        let cmd = [CTY_LOGGER, 0xFF, ACT_CSD_TO_REPORT_FILE];
        let pkt = pack_packet(addr, &cmd);
        let timeout = (rep_size / 80).max(15000);
        let raw = transport.write_and_read(&pkt, timeout)?;
        deframe_multi_frame(&raw)?
    };

    let final_name = if rep_name.is_empty() {
        format!("{}_Audit_Report.pdf", name.replace(".csd", "").replace(".CSD", ""))
    } else if !rep_name.to_lowercase().ends_with(".pdf") {
        format!("{}.pdf", rep_name)
    } else {
        rep_name
    };

    log_event("INFO", "SUTO_S600", &format!("Report PDF downloaded successfully ({} bytes payload)", pdf_bytes.len()), None);

    Ok(S600ReportDownloadResult {
        file_name: final_name,
        file_size: pdf_bytes.len() as u32,
        file_date: rep_date,
        pdf_bytes,
    })
}

