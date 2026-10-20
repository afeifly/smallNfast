//! SUTO Command Definitions & Struct Parsers
//!
//! Port of suto_lib/lib/communication/commands.dart and
//! tools/s4a_online/server/server.js DS310 protocol definitions.

use serde::{Deserialize, Serialize};

// ---- SUTO Category Constants (from suto_lib commands.dart) ----
pub const CTY_SYS_INFO: u8 = 0x01;
pub const CTY_COMM_CONFIG: u8 = 0x02;
pub const CTY_LOGGER: u8 = 0x03;
pub const CTY_MEASUREMENT: u8 = 0x04;
pub const CTY_ALARM: u8 = 0x06;
pub const CTY_DEVICE_RELATED: u8 = 0x09;
pub const CTY_S461: u8 = 0x0F;

// ---- Subcategories ----
pub const SUB_NONE: u8 = 0xFF;
pub const SCTY_COMMON: u8 = 0x01;
pub const SCTY_LOG: u8 = 0x01;
pub const SCTY_LOG_RTC: u8 = 0x02;
pub const SCTY_MEA_COMMON: u8 = 0x01;
pub const SCTY_VA_PRIVATE: u8 = 0x03;
pub const SCTY_COLOR_DISPLAY_PRIVATE: u8 = 0x08;

// ---- Device-Related Actions (Screenshots & Images) ----
pub const ACT_GET_IMG_FILE_COUNT: u8 = 0x0D;
pub const ACT_GET_IMG_FILE_INFO: u8 = 0x0E;
pub const ACT_READ_IMG_FILE: u8 = 0x0F;
pub const ACT_CLOSE_IMG_FILE: u8 = 0x11;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotEntry {
    pub name: String,
    pub size: u32,
    pub index: u32,
}

// ---- System Actions ----
pub const ACT_GET_SERIAL_NUMBER: u8 = 0x03;
pub const ACT_GET_DEVICE_ID: u8 = 0x07;
pub const ACT_GET_HW_VERSION_OPT: u8 = 0x08;
pub const ACT_GET_HW_VERSION: u8 = 0x09;
pub const ACT_GET_CALI_DATE: u8 = 0x0B;
pub const ACT_GET_DEVICE_INFO: u8 = 0x1C;
pub const ACT_GET_ITEM_NUM: u8 = 0x24;
pub const ACT_GET_PRODUCTION_DATE: u8 = 0x26;
pub const ACT_GET_FIRMWARE_VERSION: u8 = 0x39;
pub const ACT_GET_DEVICE_NAME: u8 = 0x51;

// ---- Measurement Actions ----
pub const ACT_GET_MEASUREMENT_VALUE: u8 = 0x01;
pub const ACT_GET_ANALYZED_MEASUREMENT_VALUE: u8 = 0x01;

// ---- Logger Actions ----
pub const ACT_GSET_LOG_EN: u8 = 0x01;
pub const ACT_GET_LOG_RECORDED_NUM: u8 = 0x02;
pub const ACT_GET_LOG_START_END_TIME: u8 = 0x03;
pub const ACT_LOGGER_REQUEST_ACCESS_CODE: u8 = 0x04;
pub const ACT_GET_LOG_CONTINUALLY: u8 = 0x05;
pub const ACT_LOGGER_GET_FILE_LIST: u8 = 0x07;
pub const ACT_LOGGER_READING_FINISHED: u8 = 0x0C;
pub const ACT_GET_LOG_PACKAGES_INTERVAL: u8 = 0x0C;
pub const ACT_LOGGER_GET_FILE_NUMBER: u8 = 0x12;
pub const ACT_LOGGER_GET_CSD_FILE_NUMBER: u8 = 0x24;
pub const ACT_GET_CSD_FILE_INFO: u8 = 0x25;
pub const ACT_CSD_TO_REPORT: u8 = 0x26;
pub const ACT_CSD_TO_REPORT_STATUS: u8 = 0x27;
pub const ACT_CSD_TO_REPORT_INFO: u8 = 0x28;
pub const ACT_CSD_TO_REPORT_FILE: u8 = 0x29;
pub const ACT_CSD_FILE_REPAIR: u8 = 0x30;
pub const ACT_RTC_GET_TIME: u8 = 0x02;

// S418 / S461 Specific Logger Actions
pub const ACT_S418_SET_LOG_CONTINUALLY_START_LINE: u8 = 0x04;
pub const ACT_S418_TIME_POSITION: u8 = 0x08;
pub const ACT_S418_TIMESTAMP_COMPENSATION: u8 = 0x09;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S461ReadoutResult {
    pub csv_text: String,
    pub row_count: usize,
    pub filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggerFileInfo {
    pub file_name: String,
    pub start_time: String,
    pub end_time: String,
    pub channels_count: u32,
    pub samples_per_channel: u32,
    pub sample_rate: u32,
    pub description: String,
    pub status: u32,
    pub is_recording: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S600CsdEntry {
    pub id: u32,
    pub name: String,
    pub size: u32,
    pub date: u32,
    pub date_str: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S600ReportDownloadResult {
    pub file_name: String,
    pub file_size: u32,
    pub file_date: u32,
    pub pdf_bytes: Vec<u8>,
}

// ---- DS310 New Protocol Command Bytes ----
pub const CMD_DISCOVERY_ASCII: u8 = 0x41; // 'A'
pub const CMD_GET_CH_COUNT: [u8; 3] = [0x04, 0x02, 0x03];
pub const CMD_GET_CH_SETTING_PREFIX: [u8; 3] = [0x04, 0x02, 0x02];
pub const CMD_GET_CH_SETTING_TRANSF_PREFIX: [u8; 3] = [0x04, 0x02, 0x0B];
pub const CMD_GET_ONLINE_VAL_PREFIX: [u8; 3] = [0x04, 0x01, 0x01];
// System-Info "get max channel count" (`Commands.commandGetMaxChannelCount`).
pub const CMD_GET_MAX_CHANNELS: [u8; 3] = [0x01, 0xFF, 0x23];

// Device identifications that require the transformed (0x0B) channel-settings
// command when firmware >= 1.54 (`CSCOMMExtend.refreshChannelInformation`).
pub const DEVICE_TYPE_S330: u16 = 0x1064;
pub const DEVICE_TYPE_S331: u16 = 0x1065;

/// Decoded device information from the discovery (`'A'` / 0x41) reply.
/// Mirrors CSLib `CSCOMM_DEVICE_ID` (8-byte struct).
#[derive(Debug, Clone, Copy, Default)]
pub struct DeviceInfo {
    pub bus_version: u8,
    pub identification: u16,
    pub software_version: u8,
}

impl DeviceInfo {
    /// Firmware version encoded as `raw / 100` (e.g. 0xCD -> 2.05).
    pub fn software_version_f32(&self) -> f32 {
        self.software_version as f32 / 100.0
    }

    /// Whether this device needs the transformed (0x0B) channel-settings
    /// command: S330/S331 with firmware >= 1.54.
    pub fn uses_transformed_channel_settings(&self) -> bool {
        matches!(self.identification, DEVICE_TYPE_S330 | DEVICE_TYPE_S331)
            && self.software_version_f32() >= 1.54
    }
}

/// Parse the raw `'A'` (0x41) device-info reply frame:
/// `[addr][len][status][bus_version][ident_lo][ident_hi][sw][serial(4)][cksum][0]`.
pub fn parse_device_info(frame: &[u8]) -> Option<DeviceInfo> {
    if frame.len() < 11 || frame[2] != super::protocol::COMM_SUCCESSFUL_CHAR {
        return None;
    }
    let p = &frame[3..];
    Some(DeviceInfo {
        bus_version: p[0],
        identification: u16::from_le_bytes([p[1], p[2]]),
        software_version: p[3],
    })
}

// ---- Unit lookup table ----
// Mirrors CSLib `CommConst.UNIT_STRING` exactly: index 0 is the *custom* unit
// (use the ASCII provided by the device), index 1 is °C, etc.
pub const CUSTOM_UNIT_INDEX: u8 = 0;

// Consumption / counter channels store their value as an integer, not a float
// (CSLib `CommConst.CSCOMM_CONSUMPTION_UNIT_INDEX`).
pub const CONSUMPTION_UNIT_INDEX: [u8; 6] = [24, 25, 26, 27, 28, 47];

pub fn is_consumption_unit(unit_index: u8) -> bool {
    CONSUMPTION_UNIT_INDEX.contains(&unit_index)
}

fn custom_unit_fallback(unit_index: u8, ascii_custom: &str) -> String {
    let trimmed = ascii_custom.trim();
    if !trimmed.is_empty() {
        trimmed.to_string()
    } else {
        format!("u{}", unit_index)
    }
}

pub fn lookup_unit(unit_index: u8, ascii_custom: &str) -> String {
    match unit_index {
        0 => ascii_custom.trim().to_string(), // custom unit supplied as ASCII
        1 => "°C".into(),
        2 => "°F".into(),
        3 => "%RH".into(),
        4 => "°Ctd".into(),
        5 => "°Ftd".into(),
        6 => "mg/Kg".into(),
        7 => "mg/m³".into(),
        8 => "g/Kg".into(),
        9 => "g/m³".into(),
        10 => "m/s".into(),
        11 => "ft/min".into(),
        12 => "Nm/s".into(),
        13 => "Nft/min".into(),
        14 => "m³/h".into(),
        15 => "m³/min".into(),
        16 => "l/min".into(),
        17 => "l/s".into(),
        18 => "cfm".into(),
        19 => "Nm³/h".into(),
        20 => "Nm³/min".into(),
        21 => "Nl/min".into(),
        22 => "Nl/s".into(),
        23 => "Ncfm".into(),
        24 => "m³".into(),
        25 => "l".into(),
        26 => "cf".into(),
        27 => "Nm³".into(),
        28 => "Nl".into(),
        29 => "Ncf".into(),
        30 => "ppm[v]".into(),
        31 => "°Ctd atm".into(),
        32 => "°Ftd atm".into(),
        33 => "Pa".into(),
        34 => "hPa".into(),
        35 => "KPa".into(),
        36 => "MPa".into(),
        37 => "mbar".into(),
        38 => "bar".into(),
        39 => "PSI".into(),
        40 => "mV".into(),
        41 => "V".into(),
        42 => "uV".into(),
        43 => "KV".into(),
        44 => "mA".into(),
        45 => "A".into(),
        46 => "kg/s".into(),
        47 => "kg".into(),
        _ => custom_unit_fallback(unit_index, ascii_custom),
    }
}

// ---- Data Models ----

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChannelInfo {
    pub id: u8,
    pub description: String,
    pub unit: String,
    pub unit_index: u8,
    pub resolution: u8,
    pub device_desc: String,
    pub sensor_desc: String,
    pub mb_output_value_type: u8,
    // Sensor / channel identity. Multiple channels can share one `sensor_id`
    // (they belong to the same physical sensor). Mirrors the CSLib channel
    // struct fields used by cs_monitor to group channels into sensors.
    pub device_id: i32,
    pub sub_device_id: i32,
    pub sensor_id: i32,
    pub channel_id: i32,
    pub slaver_type: u8,
    pub slaver_addr: u8,
    pub ch_optional_config: u8,
    /// CSLib sensor grouping key: `SlaverType&SlaverAddr&SubDeviceID&SensorID`.
    pub sensor_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeasurementValue {
    pub id: u8,
    pub value: Option<f64>,
    pub unit: String,
    pub unit_index: u8,
    pub resolution: u8,
    pub status: String, // "normal", "invalid", "overrange"
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SystemInfo {
    pub serial_number: Option<String>,
    pub device_id: Option<u16>,
    pub firmware_version: Option<String>,
    pub hardware_version: Option<String>,
    pub device_name: Option<String>,
    pub calibration_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LoggerStatus {
    pub enabled: bool,
    pub recorded_count: u32,
    pub start_time: Option<u32>,
    pub end_time: Option<u32>,
    pub package_interval: Option<u32>,
    pub rtc_time: Option<String>,
}

// ---- Struct Parsers ----

/// Decode a NUL-terminated description field as UTF-8, matching CSLib
/// `CSCOMMExtend.byteArrayToUTFStringStopAt0` (`new String(tmp, "UTF-8")`).
fn extract_utf8_string(bytes: &[u8]) -> String {
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).trim().to_string()
}

/// Parse 204-byte DS310 Channel Structs.
/// Specification §5.4:
/// - s[0]: logical channel number (0 or 0xFF -> invalid, skip)
/// - s[1..22]: device description
/// - s[22..43]: sub-device description
/// - s[43..64]: sensor description
/// - s[64..85]: channel description
/// - s[85]: resolution (u8)
/// - s[86]: unit index (u8)
/// - s[87..99]: unit ASCII (custom)
/// - s[138]: mb_output_value_type (u8)
///
/// Scans every 204-byte record in `payload` and returns the valid channels.
/// Structs whose logical channel number is 0 or 0xFF are rejected (and skipped),
/// mirroring CSLib `CSCOMM_DS310_CHANNEL_SETTING.parseByteArray` /
/// `getStructChannel`, which keeps reading past empty slots.
pub fn parse_channel_settings(payload: &[u8]) -> Vec<ChannelInfo> {
    const STRUCT_SIZE: usize = 204;
    let mut channels = Vec::new();

    let num_structs = payload.len() / STRUCT_SIZE;
    for i in 0..num_structs {
        let off = i * STRUCT_SIZE;
        let s = &payload[off..off + STRUCT_SIZE];

        let logical_channel_no = s[0];
        // Reject unconfigured/empty structs (logical channel 0 or 0xFF).
        if logical_channel_no == 0 || logical_channel_no == 0xFF {
            continue;
        }
        let ch_id = logical_channel_no;

        let dev_desc = extract_utf8_string(&s[1..22]);
        let sensor_desc = extract_utf8_string(&s[43..64]);
        let ch_desc = extract_utf8_string(&s[64..85]);
        let resolution = s[85];
        let unit_index = s[86];
        let unit_ascii = extract_utf8_string(&s[87..99]);
        let mb_type = s[138];

        // Sensor / channel identity fields (little-endian i32).
        let device_id = i32::from_le_bytes([s[99], s[100], s[101], s[102]]);
        let sub_device_id = i32::from_le_bytes([s[103], s[104], s[105], s[106]]);
        let sensor_id = i32::from_le_bytes([s[107], s[108], s[109], s[110]]);
        let channel_id = i32::from_le_bytes([s[111], s[112], s[113], s[114]]);
        let slaver_type = s[115];
        let slaver_addr = s[116];
        let ch_optional_config = s[196];

        // Channels with bit 3 of ChOptionalConfig set are hidden/disabled
        // (cs_monitor `CommonValue.intVailableChannels`: `& 0x08`).
        if ch_optional_config & 0x08 == 0x08 {
            continue;
        }

        let unit = lookup_unit(unit_index, &unit_ascii);
        let display_desc = if !ch_desc.is_empty() {
            ch_desc
        } else if !sensor_desc.is_empty() {
            sensor_desc.clone()
        } else if !dev_desc.is_empty() {
            format!("{} CH{}", dev_desc, ch_id)
        } else {
            format!("CH{}", ch_id)
        };

        // CSLib sensor grouping key (`refreshChannelInformation`):
        // `SlaverType&SlaverAddr&SubDeviceID&SensorID`.
        let sensor_key = format!("{}&{}&{}&{}", slaver_type, slaver_addr, sub_device_id, sensor_id);

        channels.push(ChannelInfo {
            id: ch_id,
            description: display_desc,
            unit,
            unit_index,
            resolution,
            device_desc: dev_desc,
            sensor_desc,
            mb_output_value_type: mb_type,
            device_id,
            sub_device_id,
            sensor_id,
            channel_id,
            slaver_type,
            slaver_addr,
            ch_optional_config,
            sensor_key,
        });
    }

    channels
}

/// Parse 7-byte DS310 Online Value Structs.
/// Specification §5.5:
/// - bytes 0..4: value depending on `mb_output_value_type` (4 -> i32, 6 -> u32, else -> f32)
/// - byte 4: resolution (u8)
/// - byte 5: unit index (u8)
/// - byte 6: status (0x04 invalid, 0x08 overrange)
///
/// The 4 value bytes are *not* always a float: consumption/counter channels
/// (unit indices 24,25,26,27,28,47) and MODBUS integer output types (4/6) are
/// stored as integers. Mirrors CSLib `CSCOMM_MEASUREMENT_VALUE.parseByteArray`.
/// `channels[i]` describes the i-th requested channel (ordered by id).
pub fn parse_measurement_values(payload: &[u8], channels: &[ChannelInfo]) -> Vec<MeasurementValue> {
    const VALUE_SIZE: usize = 7;
    let mut values = Vec::new();

    let n_vals = payload.len() / VALUE_SIZE;
    for i in 0..n_vals {
        let off = i * VALUE_SIZE;
        if off + VALUE_SIZE > payload.len() {
            break;
        }
        let v = &payload[off..off + VALUE_SIZE];

        let raw_val_bytes = [v[0], v[1], v[2], v[3]];
        let resolution = v[4];
        let unit_index = v[5];
        let status_byte = v[6];

        let ch = channels.get(i);
        let mb_type = ch.map(|c| c.mb_output_value_type).unwrap_or(0);

        let numeric = if is_consumption_unit(unit_index) {
            u32::from_le_bytes(raw_val_bytes) as f64
        } else {
            match mb_type {
                4 => i32::from_le_bytes(raw_val_bytes) as f64,
                6 => u32::from_le_bytes(raw_val_bytes) as f64,
                _ => f32::from_le_bytes(raw_val_bytes) as f64,
            }
        };

        let is_invalid = (status_byte & 0x04) != 0;
        let is_overrange = (status_byte & 0x08) != 0;

        let status_str = if is_invalid {
            "invalid".to_string()
        } else if is_overrange {
            "overrange".to_string()
        } else {
            "normal".to_string()
        };

        let ch_id = ch.map(|c| c.id).unwrap_or((i + 1) as u8);
        let unit = ch
            .map(|c| c.unit.clone())
            .filter(|u| !u.is_empty())
            .unwrap_or_else(|| lookup_unit(unit_index, ""));

        values.push(MeasurementValue {
            id: ch_id,
            value: if is_invalid { None } else { Some(numeric) },
            unit,
            unit_index,
            resolution,
            status: status_str,
        });
    }

    values
}
