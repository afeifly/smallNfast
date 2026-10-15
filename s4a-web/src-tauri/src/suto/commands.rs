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
pub const ACT_GET_LOG_CONTINUALLY: u8 = 0x05;
pub const ACT_GET_LOG_PACKAGES_INTERVAL: u8 = 0x0C;
pub const ACT_RTC_GET_TIME: u8 = 0x02;

// ---- DS310 New Protocol Command Bytes ----
pub const CMD_DISCOVERY_ASCII: u8 = 0x41; // 'A'
pub const CMD_GET_CH_COUNT: [u8; 3] = [0x04, 0x02, 0x03];
pub const CMD_GET_CH_SETTING_PREFIX: [u8; 3] = [0x04, 0x02, 0x02];
pub const CMD_GET_ONLINE_VAL_PREFIX: [u8; 3] = [0x04, 0x01, 0x01];

// ---- SUTO Unit Lookup Table (from CSLib CommConst.UNIT_STRING & server.js) ----
pub fn lookup_unit(unit_index: u8, ascii_custom: &str) -> String {
    match unit_index {
        0 => "°C".into(),
        1 => "°F".into(),
        2 => "K".into(),
        3 => "%rH".into(),
        4 => "m/s".into(),
        5 => "ft/min".into(),
        6 => "m³/min".into(),
        7 => "bar".into(),
        8 => "psi".into(),
        9 => "MPa".into(),
        10 => "kPa".into(),
        11 => "m³".into(),
        12 => "ft³".into(),
        13 => "m³/h".into(),
        14 => "m³/min".into(),
        15 => "l/min".into(),
        16 => "cfm".into(),
        17 => "l/s".into(),
        18 => "kg/h".into(),
        19 => "V".into(),
        20 => "A".into(),
        21 => "mA".into(),
        22 => "mV".into(),
        23 => "Hz".into(),
        24 => "kW".into(),
        25 => "kWh".into(),
        26 => "W".into(),
        27 => "VA".into(),
        28 => "var".into(),
        29 => "cos phi".into(),
        30 => "%".into(),
        31 => "ppm".into(),
        32 => "°Ctd".into(),
        33 => "°Ftd".into(),
        _ => {
            let trimmed = ascii_custom.trim();
            if !trimmed.is_empty() {
                trimmed.to_string()
            } else {
                format!("u{}", unit_index)
            }
        }
    }
}

// ---- Data Models ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelInfo {
    pub id: u8,
    pub description: String,
    pub unit: String,
    pub unit_index: u8,
    pub resolution: u8,
    pub device_desc: String,
    pub sensor_desc: String,
    pub mb_output_value_type: u8,
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

fn extract_latin1_string(bytes: &[u8]) -> String {
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    let valid_slice = &bytes[..end];
    valid_slice.iter().map(|&b| b as char).collect::<String>().trim().to_string()
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
pub fn parse_channel_settings(payload: &[u8]) -> Vec<ChannelInfo> {
    const STRUCT_SIZE: usize = 204;
    let mut channels = Vec::new();

    let num_structs = payload.len() / STRUCT_SIZE;
    for i in 0..num_structs {
        let off = i * STRUCT_SIZE;
        let s = &payload[off..off + STRUCT_SIZE];

        let logical_channel_no = s[0];
        let ch_id = if logical_channel_no > 0 && logical_channel_no < 0xFF {
            logical_channel_no
        } else {
            (i + 1) as u8
        };

        let dev_desc = extract_latin1_string(&s[1..22]);
        let sensor_desc = extract_latin1_string(&s[43..64]);
        let ch_desc = extract_latin1_string(&s[64..85]);
        let resolution = s[85];
        let unit_index = s[86];
        let unit_ascii = extract_latin1_string(&s[87..99]);
        let mb_type = s[138];

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

        channels.push(ChannelInfo {
            id: ch_id,
            description: display_desc,
            unit,
            unit_index,
            resolution,
            device_desc: dev_desc,
            sensor_desc,
            mb_output_value_type: mb_type,
        });
    }

    channels
}

/// Parse 7-byte DS310 Online Value Structs.
/// Specification §5.5:
/// - bytes 0..4: value depending on mb_output_value_type (4 -> i32, 6 -> u32, else -> f32)
/// - byte 4: resolution (u8)
/// - byte 5: unit index (u8)
/// - byte 6: status (0x04 invalid, 0x08 overrange)
pub fn parse_measurement_values(payload: &[u8], channel_ids: &[u8]) -> Vec<MeasurementValue> {
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
        let f_val = f32::from_le_bytes(raw_val_bytes);
        let resolution = v[4];
        let unit_index = v[5];
        let status_byte = v[6];

        let is_invalid = (status_byte & 0x04) != 0;
        let is_overrange = (status_byte & 0x08) != 0;

        let status_str = if is_invalid {
            "invalid".to_string()
        } else if is_overrange {
            "overrange".to_string()
        } else {
            "normal".to_string()
        };

        let ch_id = if i < channel_ids.len() {
            channel_ids[i]
        } else {
            (i + 1) as u8
        };

        values.push(MeasurementValue {
            id: ch_id,
            value: if is_invalid { None } else { Some(f_val as f64) },
            unit: lookup_unit(unit_index, ""),
            unit_index,
            resolution,
            status: status_str,
        });
    }

    values
}
