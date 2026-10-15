//! Simulated / Mock SUTO USB Transport for Non-Windows Platforms (macOS / Linux)
//!
//! Provides realistic simulated hardware responses for local development and UI testing.

use super::commands::*;
use super::logger::log_event;
use super::protocol::*;
use super::transport::SutoTransport;

pub struct StubUsbTransport {
    is_open: bool,
    device_addr: u8,
    tx_buffer: Vec<u8>,
}

impl StubUsbTransport {
    pub fn new() -> Self {
        Self {
            is_open: false,
            device_addr: 1,
            tx_buffer: Vec::new(),
        }
    }

    pub fn list_devices() -> Vec<String> {
        let devs = vec![r"\\?\usb#vid_16c0&pid_0640#simulated_suto_ds300".to_string()];
        log_event("INFO", "USB_ENUM", &format!("(Stub) Found {} simulated device(s)", devs.len()), None);
        devs
    }

    pub fn open(&mut self, path: Option<&str>) -> Result<(), String> {
        self.is_open = true;
        self.device_addr = 1;
        self.tx_buffer.clear();
        log_event("INFO", "USB_OPEN", &format!("(Stub) Opened simulated SUTO transport (path: {:?})", path), None);
        Ok(())
    }
}

impl SutoTransport for StubUsbTransport {
    fn is_open(&self) -> bool {
        self.is_open
    }

    fn write(&mut self, data: &[u8], _timeout_ms: u32) -> Result<usize, String> {
        if !self.is_open {
            return Err("Device not open".into());
        }

        // Generate response based on received packet
        if data.len() < COMM_HEADER_LENGTH + COMM_TAIL_LENGTH {
            return Ok(data.len());
        }

        let payload = &data[COMM_HEADER_LENGTH..data.len() - COMM_TAIL_LENGTH];
        let resp_payload = self.handle_command(payload);

        let mut resp_frame = Vec::new();
        resp_frame.push(self.device_addr);
        resp_frame.push((resp_payload.len() + COMM_HEADER_LENGTH + COMM_TAIL_LENGTH + 1) as u8);
        resp_frame.push(COMM_SUCCESSFUL_CHAR); // '>'
        resp_frame.extend_from_slice(&resp_payload);

        let cksum = calculate_checksum(&resp_frame, resp_frame.len());
        resp_frame.push(cksum);
        resp_frame.push(0x00);

        self.tx_buffer = resp_frame;
        Ok(data.len())
    }

    fn read(&mut self, max_len: usize, _timeout_ms: u32) -> Result<Vec<u8>, String> {
        if !self.is_open {
            return Err("Device not open".into());
        }
        if self.tx_buffer.is_empty() {
            return Ok(Vec::new());
        }
        let take = max_len.min(self.tx_buffer.len());
        let chunk: Vec<u8> = self.tx_buffer.drain(..take).collect();
        Ok(chunk)
    }

    fn close(&mut self) -> Result<(), String> {
        self.is_open = false;
        self.tx_buffer.clear();
        Ok(())
    }
}

impl StubUsbTransport {
    fn handle_command(&mut self, payload: &[u8]) -> Vec<u8> {
        if payload.is_empty() {
            return Vec::new();
        }

        // 1. Discovery ('A' / 0x41)
        if payload == [CMD_DISCOVERY_ASCII] {
            return vec![self.device_addr];
        }

        // 2. GetChCount ([0x04, 0x02, 0x03])
        if payload == CMD_GET_CH_COUNT {
            // Returns 4-byte payload with channel count = 6
            return vec![6, 0, 0, 0];
        }

        // 3. GetChSetting ([0x04, 0x02, 0x02, start, count])
        if payload.len() >= 5 && &payload[0..3] == CMD_GET_CH_SETTING_PREFIX {
            return self.build_mock_channel_settings();
        }

        // 4. GetOnlineVal ([0x04, 0x01, 0x01, start, count])
        if payload.len() >= 5 && &payload[0..3] == CMD_GET_ONLINE_VAL_PREFIX {
            return self.build_mock_online_values();
        }

        // 5. System Commands (CTY_SYS_INFO = 0x01)
        if payload[0] == CTY_SYS_INFO {
            let act = payload.get(2).copied().unwrap_or(payload.get(1).copied().unwrap_or(0));
            match act {
                ACT_GET_SERIAL_NUMBER => {
                    // Serial number 20261015 (u32 LE)
                    return 20261015u32.to_le_bytes().to_vec();
                }
                ACT_GET_DEVICE_ID => {
                    // Device ID 403 (u16 LE)
                    return 403u16.to_le_bytes().to_vec();
                }
                ACT_GET_FIRMWARE_VERSION => {
                    return b"V2.1.4".to_vec();
                }
                ACT_GET_HW_VERSION | ACT_GET_HW_VERSION_OPT => {
                    return b"HW-Rev-C".to_vec();
                }
                ACT_GET_DEVICE_NAME => {
                    return b"SUTO S403 Flow Sensor".to_vec();
                }
                ACT_GET_CALI_DATE => {
                    return b"2026-05-12".to_vec();
                }
                ACT_GET_PRODUCTION_DATE => {
                    return b"2025-11-20".to_vec();
                }
                _ => return vec![0x00],
            }
        }

        // 6. Logger Commands (CTY_LOGGER = 0x03)
        if payload[0] == CTY_LOGGER {
            let scty = payload.get(1).copied().unwrap_or(0);
            let act = payload.get(2).copied().unwrap_or(scty);
            match (scty, act) {
                (SCTY_LOG, ACT_GSET_LOG_EN) => return vec![1], // enabled
                (SCTY_LOG, ACT_GET_LOG_RECORDED_NUM) => return 12500u32.to_le_bytes().to_vec(),
                (SCTY_LOG, ACT_GET_LOG_START_END_TIME) => {
                    let mut b = Vec::new();
                    b.extend_from_slice(&1730000000u32.to_le_bytes()); // start time
                    b.extend_from_slice(&1730050000u32.to_le_bytes()); // end time
                    return b;
                }
                (SCTY_LOG, ACT_GET_LOG_PACKAGES_INTERVAL) => return 60u32.to_le_bytes().to_vec(), // 60s
                (SCTY_LOG_RTC, ACT_RTC_GET_TIME) => return vec![26, 10, 15, 11, 0, 0],
                _ => return vec![0x00],
            }
        }

        // Default empty payload response
        vec![0x00]
    }

    fn build_mock_channel_settings(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(204 * 6);
        let channels = [
            (1u8, "SUTO DS310 Main", "Flow", 13u8, 1u8),
            (2u8, "SUTO DS310 Main", "Pressure", 7u8, 2u8),
            (3u8, "SUTO DS310 Main", "Dew Point", 1u8, 1u8),
            (4u8, "TCL Hao / S461 TCP", "Delta T", 0u8, 2u8),
            (5u8, "TCL Hao / S461 TCP", "Temperature inlet", 0u8, 1u8),
            (6u8, "TCL Hao / S461 TCP", "Temperature outlet", 0u8, 1u8),
        ];

        for (ch_id, dev_desc, ch_desc, unit_idx, res) in channels {
            let mut s = vec![0u8; 204];
            s[0] = ch_id; // logical channel number

            // s[1..22]: dev desc
            let dev_bytes = dev_desc.as_bytes();
            let d_len = dev_bytes.len().min(21);
            s[1..1 + d_len].copy_from_slice(&dev_bytes[..d_len]);

            // s[64..85]: channel desc
            let ch_bytes = ch_desc.as_bytes();
            let c_len = ch_bytes.len().min(21);
            s[64..64 + c_len].copy_from_slice(&ch_bytes[..c_len]);

            s[85] = res; // resolution
            s[86] = unit_idx; // unit index
            s[138] = 0; // mb_output_value_type (f32)

            out.extend_from_slice(&s);
        }

        out
    }

    fn build_mock_online_values(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(7 * 6);
        // Realistic simulated values
        let values: [(f32, u8, u8); 6] = [
            (145.2, 1, 13), // Flow: 145.2 m³/h
            (6.85, 2, 7),   // Pressure: 6.85 bar
            (-38.4, 1, 1),  // Dew Point: -38.4 °Ctd
            (3.84, 2, 0),   // Delta T: 3.84 ℃
            (28.6, 1, 0),   // Temperature inlet: 28.6 ℃
            (24.76, 2, 0),  // Temperature outlet: 24.76 ℃
        ];

        for (val, res, unit_idx) in values {
            let mut v = vec![0u8; 7];
            v[0..4].copy_from_slice(&val.to_le_bytes());
            v[4] = res;
            v[5] = unit_idx;
            v[6] = 0x00; // status normal
            out.extend_from_slice(&v);
        }

        out
    }
}
