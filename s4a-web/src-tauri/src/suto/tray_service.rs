//! Headless Background Service & System Tray / Menu Bar Engine (Windows & macOS)
//!
//! Implements Approach 2 (True Headless Rust Mode):
//! - Closing the main WebView window destroys the WebView (freeing ~100-250 MB RAM)
//!   while keeping `SutoState`, the Port 9080 LAN Web Server, hardware polling,
//!   alarm evaluation, and the native OS Tray / Menu Bar alive in Rust.
//! - Reopening the UI recreates the `"main"` WebviewWindow from `tauri.conf.json`
//!   and restores the live snapshot / alarm state seamlessly.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::Manager;

#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
#[cfg(desktop)]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

use super::commands::{is_consumption_unit, lookup_unit};
use super::logger::log_event;
use super::modbus::{
    exchange_cs_modbus_rtu, exchange_cs_modbus_tcp, read_modbus_rtu_registers,
    read_modbus_tcp_registers,
};
use super::webserver::{
    get_shared_state_entry, set_shared_state_entry, suto_get_webserver_status,
    suto_set_webserver_enabled,
};
use super::{poll_native_values_blocking, SutoState};

pub const HOST_BG_MODE_KEY: &str = "__host_background_mode";
pub const HOST_WEB_SERVER_KEY: &str = "__host_web_server_enabled";
pub const MAIN_TRAY_ID: &str = "s4a-main-tray";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TrayRecentValue {
    pub channel_id: String,
    pub name: String,
    pub value_text: String,
    pub unit: String,
    pub device_name: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TrayActiveAlarm {
    pub id: String,
    #[serde(rename = "locationId")]
    pub location_id: String,
    #[serde(rename = "locationName")]
    pub location_name: String,
    #[serde(rename = "scapeId")]
    pub scape_id: Option<String>,
    #[serde(rename = "measurementPointId")]
    pub measurement_point_id: String,
    #[serde(rename = "measurementPointName")]
    pub measurement_point_name: String,
    #[serde(rename = "channelId")]
    pub channel_id: String,
    #[serde(rename = "channelName")]
    pub channel_name: String,
    pub unit: String,
    pub severity: String,
    #[serde(rename = "ruleType")]
    pub rule_type: String,
    pub threshold: String,
    pub hysteresis: f64,
    #[serde(rename = "currentValue")]
    pub current_value: String,
    #[serde(rename = "rawValue")]
    pub raw_value: Option<f64>,
    pub resolution: u8,
    #[serde(rename = "triggeredAt")]
    pub triggered_at: u64,
    pub acknowledged: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ServiceStatus {
    pub background_mode: bool,
    pub tray_available: bool,
    pub ui_window_open: bool,
    pub connected_devices_count: usize,
    pub headless_polling_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ServiceSnapshot {
    pub connected_devices_count: usize,
    pub recent_values: Vec<TrayRecentValue>,
    pub active_alarms: Vec<TrayActiveAlarm>,
    pub last_updated_ms: u64,
    pub headless_active: bool,
}

#[derive(Debug, Clone, Default)]
struct EvalChannelState {
    first_violation_ms: Option<u64>,
    last_val: Option<f64>,
    last_time_ms: u64,
    flatline_start_ms: u64,
}

struct ServiceRuntime {
    background_mode: bool,
    snapshot: ServiceSnapshot,
    eval_states: HashMap<String, EvalChannelState>,
    last_menu_signature: String,
    last_menu_rebuild_ms: u64,
}

static BACKGROUND_MODE: AtomicBool = AtomicBool::new(false);
static QUIT_REQUESTED: AtomicBool = AtomicBool::new(false);
static TRAY_DIRTY: AtomicBool = AtomicBool::new(true);
static SERVICE_THREAD_STARTED: AtomicBool = AtomicBool::new(false);

static SERVICE_RUNTIME: LazyLock<Mutex<ServiceRuntime>> = LazyLock::new(|| {
    let saved_bg = get_shared_state_entry(HOST_BG_MODE_KEY)
        .map(|v| v == "true")
        .unwrap_or(false);
    BACKGROUND_MODE.store(saved_bg, Ordering::SeqCst);
    Mutex::new(ServiceRuntime {
        background_mode: saved_bg,
        snapshot: ServiceSnapshot::default(),
        eval_states: HashMap::new(),
        last_menu_signature: String::new(),
        last_menu_rebuild_ms: 0,
    })
});

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn notify_tray_dirty() {
    TRAY_DIRTY.store(true, Ordering::SeqCst);
}

pub fn is_background_mode_enabled() -> bool {
    BACKGROUND_MODE.load(Ordering::SeqCst)
}

fn format_value_with_res(val: f64, resolution: u8) -> String {
    let dec = (resolution as usize).min(6);
    format!("{:.1$}", val, dec)
}

fn parse_json_f64(v: &Value) -> Option<f64> {
    if let Some(n) = v.as_f64() {
        Some(n)
    } else if let Some(s) = v.as_str() {
        s.trim().parse::<f64>().ok()
    } else {
        None
    }
}

fn json_val_to_string(v: Option<&Value>) -> String {
    match v {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Number(n)) => n.to_string(),
        _ => String::new(),
    }
}

// ---- Tauri Commands ----

#[tauri::command]
pub fn suto_get_service_status(app: tauri::AppHandle) -> Result<ServiceStatus, String> {
    let bg = is_background_mode_enabled();
    let ui_open = {
        #[cfg(desktop)]
        {
            app.get_webview_window("main").is_some()
        }
        #[cfg(not(desktop))]
        {
            let _ = &app;
            true
        }
    };
    let rt = SERVICE_RUNTIME.lock().unwrap_or_else(|p| p.into_inner());
    let native_count = count_native_devices(&app);
    let modbus_count = load_active_modbus_devices().len();
    let fallback_count = native_count + modbus_count;
    let connected_devices_count = if rt.snapshot.connected_devices_count > 0 {
        rt.snapshot.connected_devices_count
    } else {
        fallback_count
    };

    Ok(ServiceStatus {
        background_mode: bg,
        tray_available: cfg!(desktop),
        ui_window_open: ui_open,
        connected_devices_count,
        headless_polling_active: bg && !ui_open,
    })
}

#[tauri::command]
pub fn suto_set_background_mode(
    enabled: bool,
    app: tauri::AppHandle,
) -> Result<ServiceStatus, String> {
    BACKGROUND_MODE.store(enabled, Ordering::SeqCst);
    set_shared_state_entry(HOST_BG_MODE_KEY, if enabled { "true" } else { "false" });
    {
        let mut rt = SERVICE_RUNTIME.lock().unwrap_or_else(|p| p.into_inner());
        rt.background_mode = enabled;
    }
    notify_tray_dirty();
    #[cfg(desktop)]
    refresh_tray_menu_now(&app);

    log_event(
        "INFO",
        "SERVICE",
        &format!(
            "Headless Background Tray Service {}",
            if enabled { "enabled" } else { "disabled" }
        ),
        None,
    );

    suto_get_service_status(app)
}

#[tauri::command]
pub fn suto_enter_headless_mode(app: tauri::AppHandle) -> Result<(), String> {
    BACKGROUND_MODE.store(true, Ordering::SeqCst);
    set_shared_state_entry(HOST_BG_MODE_KEY, "true");
    {
        let mut rt = SERVICE_RUNTIME.lock().unwrap_or_else(|p| p.into_inner());
        rt.background_mode = true;
    }

    #[cfg(desktop)]
    {
        let app_clone = app.clone();
        let _ = app.run_on_main_thread(move || {
            destroy_main_window_to_headless(&app_clone);
        });
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
    }

    Ok(())
}

#[tauri::command]
pub fn suto_show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let app_clone = app.clone();
        let _ = app.run_on_main_thread(move || {
            ensure_main_window_open(&app_clone);
        });
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
    }
    Ok(())
}

#[tauri::command]
pub fn suto_update_service_snapshot(
    connected_devices_count: usize,
    recent_values: Vec<TrayRecentValue>,
    active_alarms: Vec<TrayActiveAlarm>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    {
        let mut rt = SERVICE_RUNTIME.lock().unwrap_or_else(|p| p.into_inner());
        rt.snapshot.connected_devices_count = connected_devices_count;
        rt.snapshot.recent_values = recent_values;
        rt.snapshot.active_alarms = active_alarms;
        rt.snapshot.last_updated_ms = now_epoch_ms();
        rt.snapshot.headless_active = false;
    }
    notify_tray_dirty();
    #[cfg(desktop)]
    refresh_tray_menu_async(&app);
    #[cfg(not(desktop))]
    let _ = app;
    Ok(())
}

#[tauri::command]
pub fn suto_get_service_snapshot(app: tauri::AppHandle) -> Result<ServiceSnapshot, String> {
    let mut snap = {
        let rt = SERVICE_RUNTIME.lock().unwrap_or_else(|p| p.into_inner());
        rt.snapshot.clone()
    };
    if snap.connected_devices_count == 0 {
        snap.connected_devices_count =
            count_native_devices(&app) + load_active_modbus_devices().len();
    }
    Ok(snap)
}

// ---- Native + Modbus Headless Polling & Alarm Evaluation ----

fn count_native_devices(app: &tauri::AppHandle) -> usize {
    let state = app.state::<SutoState>();
    let tcp_len = state
        .tcp_devices
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .len();
    if tcp_len > 0 {
        return tcp_len;
    }
    let has_single = state
        .transport
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .is_some();
    if has_single {
        1
    } else {
        0
    }
}

#[derive(Debug, Clone)]
struct HeadlessTelemetryItem {
    channel_id: String,
    name: String,
    value: Option<f64>,
    unit: String,
    resolution: u8,
    status: String,
    device: Option<String>,
    device_id: Option<String>,
    serial_number: Option<String>,
    port: Option<u16>,
}

fn load_active_modbus_devices() -> Vec<Value> {
    let Some(raw) = get_shared_state_entry("s4a_shared_session_v1") else {
        return Vec::new();
    };
    let Ok(session) = serde_json::from_str::<Value>(&raw) else {
        return Vec::new();
    };
    let Some(entries) = session.get("activeModbusDevices").and_then(|v| v.as_array()) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for entry in entries {
        if let Some(pair) = entry.as_array() {
            if pair.len() == 2 && pair[1].is_object() {
                out.push(pair[1].clone());
            }
        }
    }
    out
}

fn normalize_modbus_data_type(val: Option<&Value>) -> u8 {
    match val {
        Some(Value::Number(n)) => {
            let num = n.as_u64().unwrap_or(7) as u8;
            if (1..=8).contains(&num) {
                num
            } else {
                7
            }
        }
        Some(Value::String(s)) => match s.trim().to_uppercase().as_str() {
            "INT16" => 1,
            "UINT16" => 2,
            "INT32" | "INT32_B" => 3,
            "INT32_L" => 4,
            "UINT32" | "UINT32_B" => 5,
            "UINT32_L" => 6,
            "FLOAT" | "FLOAT32" | "FLOAT_B" | "FLOAT32_B" => 7,
            "FLOAT_L" | "FLOAT32_L" => 8,
            _ => 7,
        },
        _ => 7,
    }
}

fn decode_modbus_bytes(data_type: u8, bytes: &[u8]) -> Option<f64> {
    match data_type {
        1 if bytes.len() >= 2 => Some(i16::from_be_bytes([bytes[0], bytes[1]]) as f64),
        2 if bytes.len() >= 2 => Some(u16::from_be_bytes([bytes[0], bytes[1]]) as f64),
        3 if bytes.len() >= 4 => {
            Some(i32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as f64)
        }
        4 if bytes.len() >= 4 => {
            Some(i32::from_be_bytes([bytes[2], bytes[3], bytes[0], bytes[1]]) as f64)
        }
        5 if bytes.len() >= 4 => {
            Some(u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as f64)
        }
        6 if bytes.len() >= 4 => {
            Some(u32::from_be_bytes([bytes[2], bytes[3], bytes[0], bytes[1]]) as f64)
        }
        7 if bytes.len() >= 4 => {
            let f = f32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as f64;
            if f.is_nan() { None } else { Some(f) }
        }
        8 if bytes.len() >= 4 => {
            let f = f32::from_be_bytes([bytes[2], bytes[3], bytes[0], bytes[1]]) as f64;
            if f.is_nan() { None } else { Some(f) }
        }
        _ => None,
    }
}

fn apply_modbus_scaling(raw_val: f64, ch: &Value) -> Option<f64> {
    let opt_cfg = ch
        .get("chOptionalConfig")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    if (opt_cfg & 0x02) == 0x02 {
        return None;
    }
    if (opt_cfg & 0x01) == 0x01 {
        return Some(raw_val);
    }

    let eps = 1e-6_f64;
    let mut a1 = ch
        .get("mBA1")
        .and_then(parse_json_f64)
        .filter(|v| v.abs() > 1e-9)
        .or_else(|| ch.get("a1").and_then(parse_json_f64).filter(|v| v.abs() > 1e-9));
    let mut a0 = ch
        .get("mBA0")
        .and_then(parse_json_f64)
        .or_else(|| ch.get("a0").and_then(parse_json_f64));

    let x0 = ch
        .get("x0")
        .and_then(parse_json_f64)
        .or_else(|| ch.get("mBRangeLo").and_then(parse_json_f64))
        .or_else(|| ch.get("rangeLo").and_then(parse_json_f64));
    let x1 = ch
        .get("x1")
        .and_then(parse_json_f64)
        .or_else(|| ch.get("mBRangeHi").and_then(parse_json_f64))
        .or_else(|| ch.get("rangeHi").and_then(parse_json_f64));
    let y0 = ch
        .get("y0")
        .and_then(parse_json_f64)
        .or_else(|| ch.get("mBScalingLo").and_then(parse_json_f64))
        .or_else(|| ch.get("scalingLo").and_then(parse_json_f64));
    let y1 = ch
        .get("y1")
        .and_then(parse_json_f64)
        .or_else(|| ch.get("mBScalingHi").and_then(parse_json_f64))
        .or_else(|| ch.get("scalingHi").and_then(parse_json_f64));

    if let (Some(x0v), Some(x1v), Some(y0v), Some(y1v)) = (x0, x1, y0, y1) {
        if (x1v - x0v).abs() > 1e-9 {
            let calc_a1 = (y1v - y0v) / (x1v - x0v);
            let calc_a0 = y0v - calc_a1 * x0v;
            if a1.is_none()
                || a0.is_none()
                || (calc_a1 - 1.0).abs() > 1e-9
                || calc_a0.abs() > 1e-9
            {
                a1 = Some(if calc_a1.abs() > 1e-9 { calc_a1 } else { 1.0 });
                a0 = Some(calc_a0);
            }
        }
    }

    let final_a1 = a1.filter(|v| v.abs() >= 1e-9).unwrap_or(1.0);
    let final_a0 = a0.unwrap_or(0.0);
    let mut v = raw_val * final_a1 + final_a0;

    let out_type = ch
        .get("mBOutputValueType")
        .and_then(|x| x.as_u64())
        .unwrap_or(0);
    if (opt_cfg & 0x04) == 0x04 {
        v = (v + eps).floor();
    } else if out_type == 6 {
        v = ((v + eps).floor() as u32) as f64;
    } else {
        let err_val = ch
            .get("errorValue")
            .and_then(parse_json_f64)
            .unwrap_or(-9999.0);
        if (v - err_val).abs() < eps {
            return Some(-9999.0);
        }
    }

    if (opt_cfg & 0x80) != 0 {
        let s_hi = ch.get("mBScalingHi").and_then(parse_json_f64).unwrap_or(0.0);
        let s_lo = ch.get("mBScalingLo").and_then(parse_json_f64).unwrap_or(0.0);
        let r_lo = ch.get("mBRangeLo").and_then(parse_json_f64).unwrap_or(s_lo);
        if s_hi > s_lo && (v > s_hi || v < r_lo) {
            return Some(-9999.0);
        }
    }

    Some(v)
}

fn has_custom_scaling(ch: &Value) -> bool {
    let check_ne_one = |k: &str| {
        ch.get(k)
            .and_then(parse_json_f64)
            .map(|v| (v - 1.0).abs() > 1e-9)
            .unwrap_or(false)
    };
    let check_ne_zero = |k: &str| {
        ch.get(k)
            .and_then(parse_json_f64)
            .map(|v| v.abs() > 1e-9)
            .unwrap_or(false)
    };
    check_ne_one("mBA1") || check_ne_one("a1") || check_ne_zero("mBA0") || check_ne_zero("a0")
}

fn parse_cs_online_values_headless(
    raw_payload: &[u8],
    expected_count: usize,
) -> Vec<(Option<f64>, u8, u8, u8)> {
    const ITEM_SIZE: usize = 7;
    if raw_payload.is_empty() {
        return Vec::new();
    }
    let mut offset = 0usize;
    if raw_payload.len() >= 10 && raw_payload[0] == 4 && raw_payload[1] == 1 && raw_payload[2] == 1
    {
        offset = 3;
        if (raw_payload.len() - 5) % ITEM_SIZE == 0 && (raw_payload.len() - 3) % ITEM_SIZE != 0 {
            offset = 5;
        }
    } else if raw_payload.len() % ITEM_SIZE == 1 {
        offset = 1;
    } else if raw_payload.len() % ITEM_SIZE != 0 {
        for test_off in 1..=8 {
            if raw_payload.len() > test_off && (raw_payload.len() - test_off) % ITEM_SIZE == 0 {
                offset = test_off;
                break;
            }
        }
    }

    let available = (raw_payload.len().saturating_sub(offset)) / ITEM_SIZE;
    let count = expected_count.min(available);
    let mut out = Vec::with_capacity(count);
    for i in 0..count {
        let pos = offset + i * ITEM_SIZE;
        let b = &raw_payload[pos..pos + ITEM_SIZE];
        let resolution = b[4];
        let unit_index = b[5];
        let status = b[6];
        let raw_bytes = [b[0], b[1], b[2], b[3]];
        let val = if is_consumption_unit(unit_index) {
            let mut v = i32::from_le_bytes(raw_bytes) as f64;
            if resolution > 0 {
                v /= 10_f64.powi(resolution as i32);
            }
            v
        } else {
            f32::from_le_bytes(raw_bytes) as f64
        };
        let is_invalid = (status & 0x04) != 0 || val.is_nan();
        out.push((
            if is_invalid { None } else { Some(val) },
            resolution,
            unit_index,
            status,
        ));
    }
    out
}

fn poll_modbus_devices_headless(devices: &[Value]) -> Vec<HeadlessTelemetryItem> {
    let mut items = Vec::new();
    for dev in devices {
        let host = dev
            .get("host")
            .and_then(|v| v.as_str())
            .unwrap_or("127.0.0.1");
        let port = dev.get("port").and_then(|v| v.as_u64()).unwrap_or(502) as u16;
        let slave_id = dev.get("slaveId").and_then(|v| v.as_u64()).unwrap_or(1) as u8;
        let is_rtu = dev.get("isRtu").and_then(|v| v.as_bool()).unwrap_or(false);
        let dev_name = dev
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Modbus Device")
            .to_string();
        let dev_id = dev
            .get("deviceId")
            .or_else(|| dev.get("id"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let dev_serial = dev
            .get("serial")
            .or_else(|| dev.get("serial_number"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let Some(ch_list) = dev.get("channels").and_then(|v| v.as_array()) else {
            continue;
        };
        if ch_list.is_empty() {
            continue;
        }

        let is_suto = dev
            .get("isSutoDevice")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
            || dev.get("detectedSutoInfo").is_some_and(|v| !v.is_null())
            || ch_list.iter().any(|c| {
                c.get("isSuto").and_then(|v| v.as_bool()).unwrap_or(false)
                    || c.get("isSutoDevice")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false)
            });

        let mut suto_batch_ok = false;
        if is_suto {
            let cmd = [0x04u8, 0x01, 0x01, 0x01, (ch_list.len().min(255)) as u8];
            let resp_res = if is_rtu {
                exchange_cs_modbus_rtu(host, port, slave_id, &cmd, 2000)
            } else {
                exchange_cs_modbus_tcp(host, port, slave_id, &cmd, 2000)
            };
            if let Ok(resp_bytes) = resp_res {
                let parsed = parse_cs_online_values_headless(&resp_bytes, ch_list.len());
                if !parsed.is_empty() {
                    suto_batch_ok = true;
                    for (idx, (val_opt, res_u8, unit_idx, status_u8)) in parsed.into_iter().enumerate()
                    {
                        let Some(ch) = ch_list.get(idx) else {
                            continue;
                        };
                        let ch_id = ch
                            .get("channel_id")
                            .or_else(|| ch.get("id"))
                            .map(|v| json_val_to_string(Some(v)))
                            .filter(|s| !s.is_empty())
                            .unwrap_or_else(|| (idx + 1).to_string());
                        let ch_name = ch
                            .get("name")
                            .or_else(|| ch.get("channel_name"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("Channel")
                            .to_string();
                        let unit = ch
                            .get("unit")
                            .and_then(|v| v.as_str())
                            .filter(|s| !s.is_empty())
                            .map(|s| s.to_string())
                            .unwrap_or_else(|| lookup_unit(unit_idx, ""));
                        let final_val = val_opt.and_then(|raw| {
                            if has_custom_scaling(ch) {
                                apply_modbus_scaling(raw, ch)
                            } else {
                                Some(raw)
                            }
                        });
                        let status = if (status_u8 & 0x04) != 0 || final_val.is_none() {
                            "invalid"
                        } else if (status_u8 & 0x08) != 0 {
                            "overrange"
                        } else {
                            "normal"
                        };
                        items.push(HeadlessTelemetryItem {
                            channel_id: ch_id,
                            name: ch_name,
                            value: final_val,
                            unit,
                            resolution: if res_u8 > 0 {
                                res_u8
                            } else {
                                ch.get("resolution").and_then(|v| v.as_u64()).unwrap_or(2) as u8
                            },
                            status: status.to_string(),
                            device: Some(dev_name.clone()),
                            device_id: dev_id.clone(),
                            serial_number: dev_serial.clone(),
                            port: Some(port),
                        });
                    }
                }
            }
        }

        if !suto_batch_ok {
            for (idx, ch) in ch_list.iter().enumerate() {
                let ch_id = ch
                    .get("channel_id")
                    .or_else(|| ch.get("id"))
                    .map(|v| json_val_to_string(Some(v)))
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| (idx + 1).to_string());
                let ch_name = ch
                    .get("name")
                    .or_else(|| ch.get("channel_name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Channel")
                    .to_string();
                let unit = ch
                    .get("unit")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let res = ch.get("resolution").and_then(|v| v.as_u64()).unwrap_or(2) as u8;
                let ch_slave = ch
                    .get("slaverAddr")
                    .or_else(|| ch.get("slaveId"))
                    .and_then(|v| v.as_u64())
                    .map(|v| v as u8)
                    .unwrap_or(slave_id);
                let fc = ch
                    .get("mBAccessFuncCode")
                    .and_then(|v| v.as_u64())
                    .filter(|&v| v > 0)
                    .or_else(|| ch.get("funcCode").and_then(|v| v.as_u64()))
                    .unwrap_or(3) as u8;
                let reg_addr = ch
                    .get("mBValueAddr")
                    .or_else(|| ch.get("regAddr"))
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0) as u16;
                let data_type = normalize_modbus_data_type(
                    ch.get("mBInputValueType").or_else(|| ch.get("dataType")),
                );
                let reg_count = if data_type == 1 || data_type == 2 { 1 } else { 2 };

                let reg_res = if is_rtu {
                    read_modbus_rtu_registers(host, port, ch_slave, fc, reg_addr, reg_count, 2000)
                } else {
                    read_modbus_tcp_registers(host, port, ch_slave, fc, reg_addr, reg_count, 2000)
                };
                let val = reg_res
                    .ok()
                    .and_then(|bytes| decode_modbus_bytes(data_type, &bytes))
                    .and_then(|raw| apply_modbus_scaling(raw, ch));

                items.push(HeadlessTelemetryItem {
                    channel_id: ch_id,
                    name: ch_name,
                    value: val,
                    unit,
                    resolution: res,
                    status: if val.is_some() {
                        "normal".to_string()
                    } else {
                        "invalid".to_string()
                    },
                    device: Some(dev_name.clone()),
                    device_id: dev_id.clone(),
                    serial_number: dev_serial.clone(),
                    port: Some(port),
                });
            }
        }
    }
    items
}

fn append_alarm_history_headless(event: Value) {
    let mut list: Vec<Value> = get_shared_state_entry("s4a_alarm_history_v1")
        .and_then(|raw| serde_json::from_str::<Vec<Value>>(&raw).ok())
        .unwrap_or_default();
    list.insert(0, event);
    if list.len() > 500 {
        list.truncate(500);
    }
    if let Ok(serialized) = serde_json::to_string(&list) {
        set_shared_state_entry("s4a_alarm_history_v1", &serialized);
    }
}

fn evaluate_alarms_headless(
    telemetry: &[HeadlessTelemetryItem],
    rt: &mut ServiceRuntime,
) {
    let Some(raw_locs) = get_shared_state_entry("s4a_sensor_locations_v1") else {
        return;
    };
    let Ok(locs_val) = serde_json::from_str::<Value>(&raw_locs) else {
        return;
    };
    let Some(locs) = locs_val.as_array() else {
        return;
    };
    if locs.is_empty() {
        return;
    }

    let mut by_dev_id: HashMap<String, &HeadlessTelemetryItem> = HashMap::new();
    let mut by_id: HashMap<String, &HeadlessTelemetryItem> = HashMap::new();
    let mut by_name: HashMap<String, &HeadlessTelemetryItem> = HashMap::new();

    for (idx, item) in telemetry.iter().enumerate() {
        let dev_keys: Vec<String> = [
            item.device_id.as_deref(),
            item.serial_number.as_deref(),
            item.device.as_deref(),
        ]
        .into_iter()
        .flatten()
        .map(|s| s.to_lowercase())
        .chain(item.port.map(|p| p.to_string()))
        .collect();

        for dk in &dev_keys {
            by_dev_id
                .entry(format!("{}_{}", dk, item.channel_id.to_lowercase()))
                .or_insert(item);
            by_dev_id
                .entry(format!("{}_idx_{}", dk, idx + 1))
                .or_insert(item);
        }
        by_id.entry(item.channel_id.to_lowercase()).or_insert(item);
        by_id.entry(format!("idx_{}", idx + 1)).or_insert(item);

        let nm = item.name.trim().to_lowercase();
        if !nm.is_empty() {
            by_name.entry(nm.clone()).or_insert(item);
            for dk in &dev_keys {
                by_name.entry(format!("{}_{}", dk, nm)).or_insert(item);
            }
        }
    }

    let now = now_epoch_ms();
    let mut enabled_alarm_ids: HashSet<String> = HashSet::new();

    for loc in locs {
        let loc_id = json_val_to_string(loc.get("id"));
        let loc_name = json_val_to_string(loc.get("name"));
        let scape_id = loc
            .get("scapeId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let Some(mps) = loc.get("measurementPoints").and_then(|v| v.as_array()) else {
            continue;
        };

        for mp in mps {
            let mp_id = json_val_to_string(mp.get("id"));
            let mp_name = json_val_to_string(mp.get("name"));
            let Some(chs) = mp.get("channels").and_then(|v| v.as_array()) else {
                continue;
            };

            for ch in chs {
                let Some(cfg) = ch.get("alarmConfig") else {
                    continue;
                };
                if !cfg.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false) {
                    continue;
                }

                let ch_raw_id = json_val_to_string(ch.get("id").or_else(|| ch.get("channel_id")));
                let ch_key = json_val_to_string(ch.get("channel_id").or_else(|| ch.get("id")))
                    .to_lowercase();
                let ch_name_raw = ch
                    .get("displayName")
                    .or_else(|| ch.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Channel")
                    .to_string();
                let ch_name_key = ch
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .trim()
                    .to_lowercase();
                let dev_key = [
                    ch.get("deviceId"),
                    ch.get("deviceSerial"),
                    ch.get("devicePort"),
                    ch.get("device"),
                ]
                .into_iter()
                .flatten()
                .map(|v| json_val_to_string(Some(v)))
                .find(|s| !s.is_empty())
                .unwrap_or_default()
                .to_lowercase();

                let rule_type = cfg
                    .get("type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("high")
                    .to_string();
                let alarm_id = format!(
                    "alarm_{}_{}_{}_{}",
                    loc_id, mp_id, ch_raw_id, rule_type
                );
                enabled_alarm_ids.insert(alarm_id.clone());

                let matched = if !dev_key.is_empty() && !ch_key.is_empty() {
                    by_dev_id.get(&format!("{}_{}", dev_key, ch_key)).copied()
                } else {
                    None
                }
                .or_else(|| {
                    if !dev_key.is_empty() && !ch_name_key.is_empty() {
                        by_name.get(&format!("{}_{}", dev_key, ch_name_key)).copied()
                    } else {
                        None
                    }
                })
                .or_else(|| by_id.get(&ch_key).copied())
                .or_else(|| by_name.get(&ch_name_key).copied());

                let val = matched.and_then(|m| {
                    m.value.filter(|&v| !v.is_nan() && (v - (-8888.0)).abs() > 1e-6 && (v - (-9999.0)).abs() > 1e-6)
                });
                let is_offline = val.is_none();
                let res = matched
                    .map(|m| m.resolution)
                    .or_else(|| ch.get("resolution").and_then(|v| v.as_u64()).map(|n| n as u8))
                    .unwrap_or(2);
                let unit = ch
                    .get("unit")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty())
                    .or_else(|| matched.map(|m| m.unit.as_str()))
                    .unwrap_or("")
                    .to_string();

                let eval_key = format!("{}_{}_{}", loc_id, mp_id, ch_raw_id);
                let eval_state = rt
                    .eval_states
                    .entry(eval_key)
                    .or_insert_with(|| EvalChannelState {
                        first_violation_ms: None,
                        last_val: val,
                        last_time_ms: now,
                        flatline_start_ms: now,
                    });

                let hyst = cfg.get("hysteresis").and_then(parse_json_f64).unwrap_or(0.0);
                let thresh = cfg.get("threshold").and_then(parse_json_f64).unwrap_or(0.0);
                let min_t = cfg.get("min").and_then(parse_json_f64).unwrap_or(0.0);
                let max_t = cfg.get("max").and_then(parse_json_f64).unwrap_or(0.0);
                let delay_ms = (cfg.get("delaySeconds").and_then(parse_json_f64).unwrap_or(0.0)
                    * 1000.0) as u64;
                let severity = cfg
                    .get("severity")
                    .and_then(|v| v.as_str())
                    .unwrap_or("critical")
                    .to_string();
                let message = cfg
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let mut is_violating = false;
                let mut is_recovered = false;

                match rule_type.as_str() {
                    "high" => {
                        if let Some(v) = val {
                            if v > thresh {
                                is_violating = true;
                            } else if v <= thresh - hyst {
                                is_recovered = true;
                            }
                        } else {
                            is_recovered = true;
                        }
                    }
                    "low" => {
                        if let Some(v) = val {
                            if v < thresh {
                                is_violating = true;
                            } else if v >= thresh + hyst {
                                is_recovered = true;
                            }
                        } else {
                            is_recovered = true;
                        }
                    }
                    "out_of_range" => {
                        if let Some(v) = val {
                            if v < min_t || v > max_t {
                                is_violating = true;
                            } else if v >= min_t + hyst && v <= max_t - hyst {
                                is_recovered = true;
                            }
                        } else {
                            is_recovered = true;
                        }
                    }
                    "rate_of_change" => {
                        if let (Some(v), Some(prev)) = (val, eval_state.last_val) {
                            if now > eval_state.last_time_ms {
                                let dt_min = ((now - eval_state.last_time_ms) as f64 / 60000.0)
                                    .max(0.01);
                                let rate = (v - prev).abs() / dt_min;
                                if rate > thresh {
                                    is_violating = true;
                                } else if rate <= (thresh - hyst).max(0.0) {
                                    is_recovered = true;
                                }
                            }
                        }
                    }
                    "flatline" => {
                        if let (Some(v), Some(prev)) = (val, eval_state.last_val) {
                            let tol = if hyst > 0.0 { hyst } else { 0.0001 };
                            if (v - prev).abs() <= tol {
                                let flat_sec =
                                    (now.saturating_sub(eval_state.flatline_start_ms)) as f64
                                        / 1000.0;
                                if flat_sec >= thresh.max(5.0) {
                                    is_violating = true;
                                }
                            } else {
                                eval_state.flatline_start_ms = now;
                                is_recovered = true;
                            }
                        }
                    }
                    "offline" => {
                        if is_offline {
                            if eval_state.first_violation_ms.is_none() {
                                eval_state.first_violation_ms = Some(now);
                            }
                            let off_sec = (now
                                .saturating_sub(eval_state.first_violation_ms.unwrap_or(now)))
                                as f64
                                / 1000.0;
                            if off_sec >= thresh.max(2.0) {
                                is_violating = true;
                            }
                        } else {
                            is_recovered = true;
                        }
                    }
                    _ => {}
                }

                eval_state.last_val = val;
                eval_state.last_time_ms = now;

                let existing_idx = rt
                    .snapshot
                    .active_alarms
                    .iter()
                    .position(|a| a.id == alarm_id);

                if is_violating {
                    let first_ms = *eval_state.first_violation_ms.get_or_insert(now);
                    if now.saturating_sub(first_ms) >= delay_ms {
                        let formatted_val = val
                            .map(|v| format_value_with_res(v, res))
                            .unwrap_or_else(|| "Offline".to_string());
                        let formatted_thresh = if rule_type == "out_of_range" {
                            format!(
                                "{} ~ {}",
                                format_value_with_res(min_t, res),
                                format_value_with_res(max_t, res)
                            )
                        } else if rule_type == "flatline" || rule_type == "offline" {
                            thresh.to_string()
                        } else {
                            format_value_with_res(thresh, res)
                        };

                        if let Some(idx) = existing_idx {
                            rt.snapshot.active_alarms[idx].current_value = formatted_val;
                            rt.snapshot.active_alarms[idx].raw_value = val;
                        } else {
                            let new_alarm = TrayActiveAlarm {
                                id: alarm_id.clone(),
                                location_id: loc_id.clone(),
                                location_name: loc_name.clone(),
                                scape_id: scape_id.clone(),
                                measurement_point_id: mp_id.clone(),
                                measurement_point_name: mp_name.clone(),
                                channel_id: ch_raw_id.clone(),
                                channel_name: ch_name_raw.clone(),
                                unit: unit.clone(),
                                severity: severity.clone(),
                                rule_type: rule_type.clone(),
                                threshold: formatted_thresh.clone(),
                                hysteresis: hyst,
                                current_value: formatted_val.clone(),
                                raw_value: val,
                                resolution: res,
                                triggered_at: now,
                                acknowledged: false,
                                message: message.clone(),
                            };
                            rt.snapshot.active_alarms.push(new_alarm);
                            append_alarm_history_headless(json!({
                                "id": format!("hist_{}_rust", now),
                                "timestamp": now,
                                "alarmId": alarm_id,
                                "locationId": loc_id,
                                "locationName": loc_name,
                                "measurementPointName": mp_name,
                                "channelName": ch_name_raw,
                                "unit": unit,
                                "ruleType": rule_type,
                                "threshold": formatted_thresh,
                                "currentValue": formatted_val,
                                "eventType": "triggered",
                                "severity": severity,
                            }));
                            notify_tray_dirty();
                        }
                    }
                } else if is_recovered {
                    eval_state.first_violation_ms = None;
                    if let Some(idx) = existing_idx {
                        let cleared = rt.snapshot.active_alarms.remove(idx);
                        let restored_val = val
                            .map(|v| format_value_with_res(v, res))
                            .unwrap_or_else(|| "Restored".to_string());
                        append_alarm_history_headless(json!({
                            "id": format!("hist_{}_rust_clr", now),
                            "timestamp": now,
                            "alarmId": cleared.id,
                            "locationId": cleared.location_id,
                            "locationName": cleared.location_name,
                            "measurementPointName": cleared.measurement_point_name,
                            "channelName": cleared.channel_name,
                            "unit": cleared.unit,
                            "ruleType": cleared.rule_type,
                            "threshold": cleared.threshold,
                            "currentValue": restored_val,
                            "eventType": "cleared",
                            "severity": cleared.severity,
                            "durationMs": now.saturating_sub(cleared.triggered_at),
                        }));
                        notify_tray_dirty();
                    }
                } else if let Some(idx) = existing_idx {
                    if let Some(v) = val {
                        rt.snapshot.active_alarms[idx].current_value = format_value_with_res(v, res);
                        rt.snapshot.active_alarms[idx].raw_value = Some(v);
                    }
                }
            }
        }
    }

    // Clear orphaned alarms whose rules were disabled
    let before = rt.snapshot.active_alarms.len();
    rt.snapshot
        .active_alarms
        .retain(|a| enabled_alarm_ids.contains(&a.id));
    if rt.snapshot.active_alarms.len() != before {
        notify_tray_dirty();
    }
}

fn run_headless_poll_cycle(app: &tauri::AppHandle) {
    let state = app.state::<SutoState>();
    let native_count = count_native_devices(app);
    let modbus_devices = load_active_modbus_devices();
    let total_devices = native_count + modbus_devices.len();

    let mut telemetry: Vec<HeadlessTelemetryItem> = Vec::new();

    // 1. Poll native SutoState channels (USB / native TCP / native BLE)
    if native_count > 0 {
        let cached_chans = {
            state
                .cached_channels
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .clone()
        };
        if let Ok(vals) = poll_native_values_blocking(&state) {
            for v in vals {
                let ch_name = cached_chans
                    .iter()
                    .find(|c| c.id == v.id)
                    .map(|c| c.description.clone())
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| format!("Channel {}", v.id));
                telemetry.push(HeadlessTelemetryItem {
                    channel_id: v.id.to_string(),
                    name: ch_name,
                    value: v.value,
                    unit: v.unit,
                    resolution: v.resolution,
                    status: v.status,
                    device: v.device,
                    device_id: v.device_id,
                    serial_number: v.serial_number,
                    port: v.port,
                });
            }
        }
    }

    // 2. Poll registered Modbus TCP / RTU devices
    if !modbus_devices.is_empty() {
        let mut modbus_items = poll_modbus_devices_headless(&modbus_devices);
        telemetry.append(&mut modbus_items);
    }

    let recent_values: Vec<TrayRecentValue> = telemetry
        .iter()
        .take(12)
        .map(|t| TrayRecentValue {
            channel_id: t.channel_id.clone(),
            name: t.name.clone(),
            value_text: t
                .value
                .map(|v| format_value_with_res(v, t.resolution))
                .unwrap_or_else(|| "--.-".to_string()),
            unit: t.unit.clone(),
            device_name: t.device.clone().unwrap_or_default(),
            status: t.status.clone(),
        })
        .collect();

    let mut rt = SERVICE_RUNTIME.lock().unwrap_or_else(|p| p.into_inner());
    rt.snapshot.connected_devices_count = total_devices;
    rt.snapshot.recent_values = recent_values;
    rt.snapshot.last_updated_ms = now_epoch_ms();
    rt.snapshot.headless_active = true;
    evaluate_alarms_headless(&telemetry, &mut rt);
}

// ---- Desktop Tray Menu, Window Recreation & RunEvent Lifecycle ----

#[cfg(desktop)]
fn copy_text_to_os_clipboard(text: &str) {
    #[cfg(target_os = "macos")]
    {
        use std::io::Write;
        if let Ok(mut child) = std::process::Command::new("pbcopy")
            .stdin(std::process::Stdio::piped())
            .spawn()
        {
            if let Some(stdin) = child.stdin.as_mut() {
                let _ = stdin.write_all(text.as_bytes());
            }
            let _ = child.wait();
        }
    }
    #[cfg(target_os = "windows")]
    {
        use std::io::Write;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        if let Ok(mut child) = std::process::Command::new("cmd")
            .args(["/C", "clip"])
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(std::process::Stdio::piped())
            .spawn()
        {
            if let Some(stdin) = child.stdin.as_mut() {
                let _ = stdin.write_all(text.as_bytes());
            }
            let _ = child.wait();
        }
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let _ = text;
    }
}

#[cfg(desktop)]
fn build_tray_menu(app: &tauri::AppHandle) -> Result<(Menu<tauri::Wry>, String, String), String> {
    let ui_open = app.get_webview_window("main").is_some();
    let ws_status = suto_get_webserver_status().unwrap_or(super::webserver::WebServerStatus {
        enabled: false,
        port: 9080,
        primary_url: "http://localhost:9080".to_string(),
        urls: vec!["http://localhost:9080".to_string()],
    });

    let (dev_count, recent_values, active_alarms) = {
        let rt = SERVICE_RUNTIME.lock().unwrap_or_else(|p| p.into_inner());
        let fallback_devs = count_native_devices(app) + load_active_modbus_devices().len();
        let count = if rt.snapshot.connected_devices_count > 0 || ui_open {
            rt.snapshot.connected_devices_count.max(fallback_devs)
        } else {
            fallback_devs
        };
        (
            count,
            rt.snapshot.recent_values.clone(),
            rt.snapshot.active_alarms.clone(),
        )
    };

    let mode_label = if ui_open {
        "S4A Data Studio · UI Active"
    } else {
        "S4A Data Studio · Headless Service"
    };
    let ws_label = if ws_status.enabled {
        format!("LAN Server: {} (ON)", ws_status.primary_url)
    } else {
        "LAN Server (:9080): Stopped".to_string()
    };
    let dev_label = format!("Connected Devices: {}", dev_count);
    let alarm_header_label = if active_alarms.is_empty() {
        "Active Alarms: None (0)".to_string()
    } else {
        let unacked = active_alarms.iter().filter(|a| !a.acknowledged).count();
        format!(
            "Active Alarms: {} ({} Unacked)",
            active_alarms.len(),
            unacked
        )
    };

    let mut sig = format!(
        "{}|{}|{}|{}|",
        mode_label, ws_label, dev_label, alarm_header_label
    );

    let menu = Menu::new(app).map_err(|e| e.to_string())?;

    let header_item = MenuItem::with_id(app, "hdr_mode", mode_label, false, None::<&str>)
        .map_err(|e| e.to_string())?;
    let ws_item = MenuItem::with_id(app, "hdr_ws", &ws_label, false, None::<&str>)
        .map_err(|e| e.to_string())?;
    menu.append(&header_item).map_err(|e| e.to_string())?;
    menu.append(&ws_item).map_err(|e| e.to_string())?;
    menu.append(&PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;

    // Devices count
    let dev_item = MenuItem::with_id(app, "hdr_devs", &dev_label, false, None::<&str>)
        .map_err(|e| e.to_string())?;
    menu.append(&dev_item).map_err(|e| e.to_string())?;

    // Recent Values (top 4 inline + submenu if more)
    if recent_values.is_empty() {
        let no_val = MenuItem::with_id(app, "hdr_no_val", "Recent Values: None", false, None::<&str>)
            .map_err(|e| e.to_string())?;
        menu.append(&no_val).map_err(|e| e.to_string())?;
        sig.push_str("vals:none|");
    } else {
        let val_hdr = MenuItem::with_id(
            app,
            "hdr_vals",
            format!("Recent Values ({}):", recent_values.len()),
            false,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?;
        menu.append(&val_hdr).map_err(|e| e.to_string())?;

        for (i, rv) in recent_values.iter().take(4).enumerate() {
            let line = if rv.unit.is_empty() {
                format!("  {} = {}", rv.name, rv.value_text)
            } else {
                format!("  {} = {} {}", rv.name, rv.value_text, rv.unit)
            };
            sig.push_str(&line);
            sig.push(';');
            let item = MenuItem::with_id(
                app,
                format!("val_{}", i),
                &line,
                false,
                None::<&str>,
            )
            .map_err(|e| e.to_string())?;
            menu.append(&item).map_err(|e| e.to_string())?;
        }

        if recent_values.len() > 4 {
            let more_sub = Submenu::new(
                app,
                format!("All Values ({})...", recent_values.len()),
                true,
            )
            .map_err(|e| e.to_string())?;
            for (i, rv) in recent_values.iter().enumerate() {
                let line = if rv.unit.is_empty() {
                    format!("{}: {}", rv.name, rv.value_text)
                } else {
                    format!("{}: {} {}", rv.name, rv.value_text, rv.unit)
                };
                sig.push_str(&line);
                let item = MenuItem::with_id(
                    app,
                    format!("sub_val_{}", i),
                    &line,
                    false,
                    None::<&str>,
                )
                .map_err(|e| e.to_string())?;
                more_sub.append(&item).map_err(|e| e.to_string())?;
            }
            menu.append(&more_sub).map_err(|e| e.to_string())?;
        }
    }

    // Active Alarms (up to 3 inline + submenu if more)
    let alarm_hdr = MenuItem::with_id(app, "hdr_alarms", &alarm_header_label, false, None::<&str>)
        .map_err(|e| e.to_string())?;
    menu.append(&alarm_hdr).map_err(|e| e.to_string())?;
    for (i, al) in active_alarms.iter().take(3).enumerate() {
        let line = format!(
            "  ! [{}] {}: {} {}",
            al.severity.to_uppercase(),
            al.channel_name,
            al.current_value,
            al.unit
        );
        sig.push_str(&line);
        sig.push(';');
        let item = MenuItem::with_id(
            app,
            format!("al_{}", i),
            &line,
            false,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?;
        menu.append(&item).map_err(|e| e.to_string())?;
    }
    if active_alarms.len() > 3 {
        let al_sub = Submenu::new(
            app,
            format!("All Active Alarms ({})...", active_alarms.len()),
            true,
        )
        .map_err(|e| e.to_string())?;
        for (i, al) in active_alarms.iter().enumerate() {
            let line = format!(
                "[{}] {} · {} = {} {} ({})",
                al.severity.to_uppercase(),
                al.location_name,
                al.channel_name,
                al.current_value,
                al.unit,
                al.threshold
            );
            sig.push_str(&line);
            let item = MenuItem::with_id(
                app,
                format!("sub_al_{}", i),
                &line,
                false,
                None::<&str>,
            )
            .map_err(|e| e.to_string())?;
            al_sub.append(&item).map_err(|e| e.to_string())?;
        }
        menu.append(&al_sub).map_err(|e| e.to_string())?;
    }

    menu.append(&PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;

    // Action items
    if ui_open {
        let hide_item = MenuItem::with_id(
            app,
            "hide_ui",
            "Close UI to Headless Tray",
            true,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?;
        menu.append(&hide_item).map_err(|e| e.to_string())?;
    } else {
        let open_item =
            MenuItem::with_id(app, "open_ui", "Open Full UI Window", true, None::<&str>)
                .map_err(|e| e.to_string())?;
        menu.append(&open_item).map_err(|e| e.to_string())?;
    }

    let toggle_ws_text = if ws_status.enabled {
        "Stop LAN Web Server (:9080)"
    } else {
        "Start LAN Web Server (:9080)"
    };
    let toggle_ws_item =
        MenuItem::with_id(app, "toggle_webserver", toggle_ws_text, true, None::<&str>)
            .map_err(|e| e.to_string())?;
    menu.append(&toggle_ws_item).map_err(|e| e.to_string())?;

    if ws_status.enabled {
        let copy_item = MenuItem::with_id(
            app,
            "copy_url",
            format!("Copy URL ({})", ws_status.primary_url),
            true,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?;
        menu.append(&copy_item).map_err(|e| e.to_string())?;
    }

    menu.append(&PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit S4A", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    menu.append(&quit_item).map_err(|e| e.to_string())?;

    let tooltip = format!(
        "S4A Data Studio ({}) · Devices: {} · Alarms: {}",
        if ws_status.enabled {
            ws_status.primary_url.as_str()
        } else {
            "Local"
        },
        dev_count,
        active_alarms.len()
    );

    Ok((menu, sig, tooltip))
}

#[cfg(desktop)]
pub fn refresh_tray_menu_now(app: &tauri::AppHandle) {
    let app_c = app.clone();
    let _ = app.run_on_main_thread(move || {
        refresh_tray_menu_throttled(&app_c, true);
    });
}

#[cfg(desktop)]
pub fn refresh_tray_menu_async(app: &tauri::AppHandle) {
    let app_c = app.clone();
    let _ = app.run_on_main_thread(move || {
        refresh_tray_menu_throttled(&app_c, false);
    });
}

#[cfg(desktop)]
fn refresh_tray_menu_throttled(app: &tauri::AppHandle, force: bool) {
    let Some(tray) = app.tray_by_id(MAIN_TRAY_ID) else {
        return;
    };
    let now = now_epoch_ms();
    if !force {
        let rt = SERVICE_RUNTIME.lock().unwrap_or_else(|p| p.into_inner());
        if now.saturating_sub(rt.last_menu_rebuild_ms) < 2500 {
            return;
        }
    }
    let Ok((menu, sig, tooltip)) = build_tray_menu(app) else {
        return;
    };
    let should_apply_menu = {
        let mut rt = SERVICE_RUNTIME.lock().unwrap_or_else(|p| p.into_inner());
        if force || rt.last_menu_signature != sig {
            rt.last_menu_signature = sig;
            rt.last_menu_rebuild_ms = now;
            true
        } else {
            false
        }
    };
    let _ = tray.set_tooltip(Some(tooltip));
    if should_apply_menu {
        let _ = tray.set_menu(Some(menu));
    }
    TRAY_DIRTY.store(false, Ordering::SeqCst);
}

#[cfg(desktop)]
pub fn ensure_main_window_open(app: &tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);

    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        refresh_tray_menu_now(app);
        return;
    }

    if let Some(win_cfg) = app.config().app.windows.first() {
        match tauri::WebviewWindowBuilder::from_config(app, win_cfg) {
            Ok(builder) => match builder.build() {
                Ok(win) => {
                    let icon = tauri::include_image!("icons/128x128@2x.png");
                    let _ = win.set_icon(icon);
                    let _ = win.show();
                    let _ = win.set_focus();
                    log_event(
                        "INFO",
                        "SERVICE",
                        "Recreated main UI WebView window from headless tray mode.",
                        None,
                    );
                }
                Err(e) => {
                    log_event(
                        "ERROR",
                        "SERVICE",
                        &format!("Failed to build main WebView window: {}", e),
                        None,
                    );
                }
            },
            Err(e) => {
                log_event(
                    "ERROR",
                    "SERVICE",
                    &format!("Failed to initialize WebviewWindowBuilder: {}", e),
                    None,
                );
            }
        }
    }
    refresh_tray_menu_now(app);
}

#[cfg(desktop)]
pub fn destroy_main_window_to_headless(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.destroy();
    }
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    refresh_tray_menu_now(app);
}

#[cfg(desktop)]
pub fn init_tray_and_service(app: &tauri::AppHandle) -> Result<(), String> {
    // 1. Auto-start LAN Web Server on port 9080 at Rust startup if previously enabled
    let auto_ws = get_shared_state_entry(HOST_WEB_SERVER_KEY)
        .map(|v| v == "true")
        .unwrap_or(false);
    if auto_ws {
        if let Err(e) = suto_set_webserver_enabled(true, None, app.clone()) {
            log_event(
                "WARN",
                "WEB_SERVER",
                &format!("Auto-start LAN Web Server on startup skipped: {}", e),
                None,
            );
        }
    }

    // 2. Build initial Tray / Menu Bar icon
    let (initial_menu, sig, tooltip) = build_tray_menu(app)?;
    {
        let mut rt = SERVICE_RUNTIME.lock().unwrap_or_else(|p| p.into_inner());
        rt.last_menu_signature = sig;
        rt.last_menu_rebuild_ms = now_epoch_ms();
    }

    let tray_icon = tauri::include_image!("icons/64x64.png");
    TrayIconBuilder::with_id(MAIN_TRAY_ID)
        .icon(tray_icon)
        .icon_as_template(false)
        .tooltip(&tooltip)
        .menu(&initial_menu)
        .show_menu_on_left_click(cfg!(target_os = "macos"))
        .on_menu_event(|app_handle, event| match event.id().as_ref() {
            "open_ui" => {
                ensure_main_window_open(app_handle);
            }
            "hide_ui" => {
                BACKGROUND_MODE.store(true, Ordering::SeqCst);
                set_shared_state_entry(HOST_BG_MODE_KEY, "true");
                destroy_main_window_to_headless(app_handle);
            }
            "toggle_webserver" => {
                let is_on = suto_get_webserver_status()
                    .map(|s| s.enabled)
                    .unwrap_or(false);
                if let Err(e) = suto_set_webserver_enabled(!is_on, None, app_handle.clone()) {
                    log_event(
                        "ERROR",
                        "WEB_SERVER",
                        &format!("Tray toggle web server failed: {}", e),
                        None,
                    );
                }
                refresh_tray_menu_now(app_handle);
            }
            "copy_url" => {
                if let Ok(st) = suto_get_webserver_status() {
                    copy_text_to_os_clipboard(&st.primary_url);
                }
            }
            "quit" => {
                QUIT_REQUESTED.store(true, Ordering::SeqCst);
                let _ = suto_set_webserver_enabled(false, None, app_handle.clone());
                app_handle.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if !cfg!(target_os = "macos") {
                match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    }
                    | TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } => {
                        ensure_main_window_open(tray.app_handle());
                    }
                    _ => {}
                }
            }
        })
        .build(app)
        .map_err(|e| format!("Failed to create tray icon: {}", e))?;

    // 3. Support headless launch flags (--tray / --headless / --minimized)
    let start_headless = std::env::args().any(|a| {
        a == "--tray" || a == "--headless" || a == "--minimized"
    });
    if start_headless {
        BACKGROUND_MODE.store(true, Ordering::SeqCst);
        set_shared_state_entry(HOST_BG_MODE_KEY, "true");
        destroy_main_window_to_headless(app);
    }

    // 4. Spawn Rust headless monitor & tray refresh worker (runs once)
    if !SERVICE_THREAD_STARTED.swap(true, Ordering::SeqCst) {
        let app_handle = app.clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_millis(2000));
            if QUIT_REQUESTED.load(Ordering::SeqCst) {
                break;
            }
            let ui_open = app_handle.get_webview_window("main").is_some();
            if !ui_open {
                run_headless_poll_cycle(&app_handle);
                refresh_tray_menu_async(&app_handle);
            } else if TRAY_DIRTY.load(Ordering::SeqCst) {
                refresh_tray_menu_async(&app_handle);
            }
        });
    }

    Ok(())
}

#[cfg(desktop)]
pub fn handle_run_event(app: &tauri::AppHandle, event: &tauri::RunEvent) {
    match event {
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::Destroyed,
            ..
        } if label == "main" => {
            if is_background_mode_enabled() && !QUIT_REQUESTED.load(Ordering::SeqCst) {
                #[cfg(target_os = "macos")]
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                log_event(
                    "INFO",
                    "SERVICE",
                    "Main UI WebView destroyed; continuing in true headless Rust tray service mode.",
                    None,
                );
                refresh_tray_menu_now(app);
            }
        }
        tauri::RunEvent::ExitRequested { api, code, .. } => {
            if code.is_none()
                && !QUIT_REQUESTED.load(Ordering::SeqCst)
                && is_background_mode_enabled()
            {
                api.prevent_exit();
            }
        }
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen {
            has_visible_windows,
            ..
        } => {
            if !*has_visible_windows {
                ensure_main_window_open(app);
            }
        }
        _ => {}
    }
}
