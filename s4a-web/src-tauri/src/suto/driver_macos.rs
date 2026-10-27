//! macOS Native USB Transport for SUTO hardware via rusb / IOKit
//!
//! Provides direct low-level USB bulk communication without requiring kernel drivers.

#![cfg(target_os = "macos")]

use super::logger::log_event;
use super::transport::SutoTransport;
use rusb::{Device, DeviceDescriptor, DeviceHandle, Direction, GlobalContext, TransferType};
use std::time::Duration;

pub const SUTO_VID: u16 = 0x16C0;
pub const DEFAULT_BULK_OUT: u8 = 0x03;
pub const DEFAULT_BULK_IN: u8 = 0x81;

pub struct MacUsbTransport {
    handle: Option<DeviceHandle<GlobalContext>>,
    interface_num: u8,
    ep_out: u8,
    ep_in: u8,
    is_open: bool,
}

impl MacUsbTransport {
    pub fn new() -> Self {
        Self {
            handle: None,
            interface_num: 0,
            ep_out: DEFAULT_BULK_OUT,
            ep_in: DEFAULT_BULK_IN,
            is_open: false,
        }
    }

    pub fn list_devices() -> Vec<String> {
        let mut results = Vec::new();
        let devices = match rusb::devices() {
            Ok(d) => d,
            Err(e) => {
                log_event("WARN", "USB_LIST", &format!("Failed to enumerate USB devices on macOS: {:?}", e), None);
                return results;
            }
        };

        for dev in devices.iter() {
            if let Ok(desc) = dev.device_descriptor() {
                let vid = desc.vendor_id();
                let pid = desc.product_id();
                let is_suto = vid == SUTO_VID;

                let product_name = if let Ok(h) = dev.open() {
                    h.read_product_string_ascii(&desc).unwrap_or_default()
                } else {
                    String::new()
                };

                let label = if !product_name.is_empty() {
                    product_name
                } else if is_suto {
                    "SUTO Sensor".to_string()
                } else {
                    "USB Device".to_string()
                };

                let entry = format!(
                    "Bus {:03} Device {:03} | VID:0x{:04X} PID:0x{:04X} ({})",
                    dev.bus_number(),
                    dev.address(),
                    vid,
                    pid,
                    label
                );

                if is_suto {
                    results.insert(0, entry); // Prioritize SUTO devices at the top
                } else {
                    results.push(entry);
                }
            }
        }

        log_event("INFO", "USB_LIST", &format!("Discovered {} USB devices on macOS", results.len()), None);
        results
    }

    pub fn open(&mut self, path: Option<&str>) -> Result<(), String> {
        log_event("INFO", "USB_OPEN", &format!("Attempting to open USB device on macOS (target: {:?})", path), None);

        let devices = rusb::devices().map_err(|e| format!("Failed to enumerate USB devices: {:?}", e))?;

        let mut target_device: Option<Device<GlobalContext>> = None;
        let mut target_desc: Option<DeviceDescriptor> = None;

        // 1. Search for device
        for dev in devices.iter() {
            if let Ok(desc) = dev.device_descriptor() {
                let matches_path = if let Some(p) = path {
                    let id_str = format!("VID:0x{:04X}", desc.vendor_id());
                    let id_str_lower = format!("vid:0x{:04x}", desc.vendor_id());
                    let bus_str = format!("Bus {:03} Device {:03}", dev.bus_number(), dev.address());
                    p.contains(&id_str) || p.contains(&id_str_lower) || p.contains(&bus_str)
                } else {
                    false
                };

                if matches_path || (path.is_none() && desc.vendor_id() == SUTO_VID) {
                    target_device = Some(dev);
                    target_desc = Some(desc);
                    break;
                }
            }
        }

        // Fallback: If no explicit match and no SUTO VID found, look for any device with bulk endpoints if specified
        if target_device.is_none() && path.is_none() {
            for dev in devices.iter() {
                if let Ok(desc) = dev.device_descriptor() {
                    // Skip root hubs
                    if desc.vendor_id() != 0x05ac && desc.vendor_id() != 0x0000 {
                        target_device = Some(dev);
                        target_desc = Some(desc);
                        break;
                    }
                }
            }
        }

        let dev = target_device.ok_or_else(|| {
            "No SUTO USB device detected. Please verify that your SUTO hardware is connected via USB-C.".to_string()
        })?;
        let desc = target_desc.unwrap();

        log_event(
            "INFO",
            "USB_OPEN",
            &format!("Found target USB device VID:0x{:04X} PID:0x{:04X}", desc.vendor_id(), desc.product_id()),
            None,
        );

        let handle = dev.open().map_err(|e| format!("Failed to open USB device: {:?}. Please check permissions.", e))?;

        // 2. Locate configuration and interface with Bulk IN and Bulk OUT endpoints
        let config_desc = dev.active_config_descriptor()
            .or_else(|_| dev.config_descriptor(0))
            .map_err(|e| format!("Failed to read USB config descriptor: {:?}", e))?;

        let mut selected_iface: Option<u8> = None;
        let mut selected_ep_out = DEFAULT_BULK_OUT;
        let mut selected_ep_in = DEFAULT_BULK_IN;
        let mut found_exact_endpoints = false;

        for iface in config_desc.interfaces() {
            for iface_desc in iface.descriptors() {
                let mut has_bulk_in: Option<u8> = None;
                let mut has_bulk_out: Option<u8> = None;

                for ep in iface_desc.endpoint_descriptors() {
                    if ep.transfer_type() == TransferType::Bulk {
                        if ep.direction() == Direction::In {
                            if ep.address() == DEFAULT_BULK_IN {
                                has_bulk_in = Some(ep.address());
                            } else if has_bulk_in.is_none() {
                                has_bulk_in = Some(ep.address());
                            }
                        } else if ep.direction() == Direction::Out {
                            if ep.address() == DEFAULT_BULK_OUT {
                                has_bulk_out = Some(ep.address());
                            } else if has_bulk_out.is_none() {
                                has_bulk_out = Some(ep.address());
                            }
                        }
                    }
                }

                if let (Some(ep_i), Some(ep_o)) = (has_bulk_in, has_bulk_out) {
                    selected_iface = Some(iface_desc.interface_number());
                    selected_ep_in = ep_i;
                    selected_ep_out = ep_o;
                    if ep_i == DEFAULT_BULK_IN && ep_o == DEFAULT_BULK_OUT {
                        found_exact_endpoints = true;
                        break;
                    }
                }
            }
            if found_exact_endpoints {
                break;
            }
        }

        let iface_num = selected_iface.ok_or_else(|| {
            "Could not find valid Bulk IN/OUT endpoints on USB device.".to_string()
        })?;

        // 3. Detach kernel driver if active on macOS
        if let Ok(active) = handle.kernel_driver_active(iface_num) {
            if active {
                log_event("INFO", "USB_OPEN", &format!("Detaching active kernel driver on interface {}", iface_num), None);
                let _ = handle.detach_kernel_driver(iface_num);
            }
        }

        // 4. Claim the interface
        handle.claim_interface(iface_num)
            .map_err(|e| format!("Failed to claim USB interface {}: {:?}", iface_num, e))?;

        log_event(
            "INFO",
            "USB_OPEN",
            &format!("Successfully claimed USB interface {} (IN=0x{:02X}, OUT=0x{:02X})", iface_num, selected_ep_in, selected_ep_out),
            None,
        );

        self.handle = Some(handle);
        self.interface_num = iface_num;
        self.ep_out = selected_ep_out;
        self.ep_in = selected_ep_in;
        self.is_open = true;

        Ok(())
    }
}

impl SutoTransport for MacUsbTransport {
    fn is_open(&self) -> bool {
        self.is_open && self.handle.is_some()
    }

    fn write(&mut self, data: &[u8], timeout_ms: u32) -> Result<usize, String> {
        let handle = self.handle.as_mut().ok_or("USB handle not open")?;
        let timeout = Duration::from_millis(timeout_ms as u64);

        match handle.write_bulk(self.ep_out, data, timeout) {
            Ok(n) => Ok(n),
            Err(rusb::Error::Timeout) => Ok(0),
            Err(e) => Err(format!("macOS USB bulk write error: {:?}", e)),
        }
    }

    fn read(&mut self, max_len: usize, timeout_ms: u32) -> Result<Vec<u8>, String> {
        let handle = self.handle.as_mut().ok_or("USB handle not open")?;
        let timeout = Duration::from_millis(timeout_ms as u64);
        let mut buf = vec![0u8; max_len];

        match handle.read_bulk(self.ep_in, &mut buf, timeout) {
            Ok(n) => {
                buf.truncate(n);
                Ok(buf)
            }
            Err(rusb::Error::Timeout) => Ok(Vec::new()),
            Err(e) => Err(format!("macOS USB bulk read error: {:?}", e)),
        }
    }

    fn close(&mut self) -> Result<(), String> {
        if let Some(handle) = self.handle.take() {
            let _ = handle.release_interface(self.interface_num);
            log_event("INFO", "USB_CLOSE", &format!("Released USB interface {}", self.interface_num), None);
        }
        self.is_open = false;
        Ok(())
    }
}
