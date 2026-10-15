//! Windows Native USB Direct Driver (Thesycon / cscdc.sys)
//!
//! Direct implementation of tools/tauri-usb-plugin-spec.md using Win32 API.
//! Requires Windows OS and the cscdc.sys device driver installed.

#![cfg(target_os = "windows")]

use super::logger::log_event;
use super::transport::SutoTransport;
use std::ffi::c_void;
use std::ptr::{null, null_mut};
use windows_sys::Win32::Devices::DeviceAndDriverInstallation::{
    SetupDiDestroyDeviceInfoList, SetupDiEnumDeviceInterfaces, SetupDiGetClassDevsW,
    SetupDiGetDeviceInterfaceDetailW, DIGCF_DEVICEINTERFACE, DIGCF_PRESENT, HDEVINFO,
    SP_DEVICE_INTERFACE_DATA, SP_DEVICE_INTERFACE_DETAIL_DATA_W,
};
use windows_sys::Win32::Foundation::{
    CloseHandle, GetLastError, ERROR_IO_PENDING, HANDLE, INVALID_HANDLE_VALUE, WAIT_OBJECT_0,
};
use windows_sys::Win32::Storage::FileSystem::{
    CreateFileW, ReadFile, WriteFile, FILE_FLAG_OVERLAPPED, FILE_SHARE_READ, FILE_SHARE_WRITE,
    GENERIC_READ, GENERIC_WRITE, OPEN_EXISTING,
};
use windows_sys::Win32::System::IO::{
    CancelIo, CreateEventW, DeviceIoControl, GetOverlappedResult, WaitForSingleObject, OVERLAPPED,
};

// Interface GUID: {325ddf96-938c-11d3-9e34-0080c82727f4}
const GUID_USBIO_IFACE: windows_sys::core::GUID = windows_sys::core::GUID {
    data1: 0x325ddf96,
    data2: 0x938c,
    data3: 0x11d3,
    data4: [0x9e, 0x34, 0x00, 0x80, 0xc8, 0x27, 0x27, 0xf4],
};

// Verified IOCTL codes from specification §3.1
const IOCTL_USBIO_INIT_DEVICE: u32 = 0x8094206C;
const IOCTL_USBIO_GET_DESCRIPTOR: u32 = 0x80942006;
const IOCTL_USBIO_SET_CONFIGURATION: u32 = 0x80942024;
const IOCTL_USBIO_GET_CONFIG_INFO: u32 = 0x80942050;
const IOCTL_USBIO_BIND_PIPE: u32 = 0x80942078;

const BULK_OUT_ENDPOINT: u8 = 0x03;
const BULK_IN_ENDPOINT: u8 = 0x81;

const GET_DESCRIPTOR_REQ: [u8; 8] = [0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00];

// Exact 260-byte SET_CONFIGURATION blob (API-hook capture, 2026-10-14).
// cfg_index = 0, nb_of_interfaces = 2, USBIO_MAX_INTERFACES = 32 entries.
// Replicate the captured bytes verbatim per spec §3.2.
const SET_CONFIGURATION_260: [u8; 260] = {
    let mut b = [0u8; 260];
    b[0] = 0x00; b[1] = 0x00;              // CfgIndex = 0
    b[2] = 0x02; b[3] = 0x00;              // NbOfInterfaces = 2
    // If0: interface 0, alt 0, observed tail 00 00 01 00
    b[4] = 0x00; b[5] = 0x00; b[6] = 0x00; b[7] = 0x00;
    b[8] = 0x00; b[9] = 0x00; b[10] = 0x01; b[11] = 0x00;
    // If1: interface 1, alt 0, observed tail 00 00 01 00
    b[12] = 0x01; b[13] = 0x00; b[14] = 0x00; b[15] = 0x00;
    b[16] = 0x00; b[17] = 0x00; b[18] = 0x01; b[19] = 0x00;
    // [20..260] already zero
    b
};

pub struct WindowsUsbTransport {
    main_handle: HANDLE,
    pipe_out: HANDLE,
    pipe_in: HANDLE,
}

unsafe impl Send for WindowsUsbTransport {}
unsafe impl Sync for WindowsUsbTransport {}

impl WindowsUsbTransport {
    pub fn new() -> Self {
        Self {
            main_handle: INVALID_HANDLE_VALUE,
            pipe_out: INVALID_HANDLE_VALUE,
            pipe_in: INVALID_HANDLE_VALUE,
        }
    }

    /// Enumerate USBIO device paths via SetupDi
    pub fn list_devices() -> Vec<String> {
        let mut paths = Vec::new();
        log_event(
            "INFO",
            "USB_ENUM",
            "Scanning SetupDi for SUTO USBIO devices {325ddf96-938c-11d3-9e34-0080c82727f4}...",
            None,
        );

        unsafe {
            let devs: HDEVINFO = SetupDiGetClassDevsW(
                &GUID_USBIO_IFACE,
                null(),
                null_mut(),
                DIGCF_PRESENT | DIGCF_DEVICEINTERFACE,
            );
            if devs == INVALID_HANDLE_VALUE {
                let err = GetLastError();
                log_event(
                    "ERROR",
                    "USB_ENUM",
                    &format!("SetupDiGetClassDevsW failed, GetLastError={}", err),
                    None,
                );
                return paths;
            }

            let mut ifd: SP_DEVICE_INTERFACE_DATA = std::mem::zeroed();
            ifd.cbSize = std::mem::size_of::<SP_DEVICE_INTERFACE_DATA>() as u32;

            let mut idx = 0;
            while SetupDiEnumDeviceInterfaces(devs, null_mut(), &GUID_USBIO_IFACE, idx, &mut ifd) != 0 {
                let mut need = 0;
                SetupDiGetDeviceInterfaceDetailW(devs, &ifd, null_mut(), 0, &mut need, null_mut());
                if need > 0 {
                    let mut buffer: Vec<u8> = vec![0; need as usize];
                    let detail_ptr = buffer.as_mut_ptr() as *mut SP_DEVICE_INTERFACE_DETAIL_DATA_W;
                    (*detail_ptr).cbSize = std::mem::size_of::<SP_DEVICE_INTERFACE_DETAIL_DATA_W>() as u32;

                    if SetupDiGetDeviceInterfaceDetailW(devs, &ifd, detail_ptr, need, null_mut(), null_mut()) != 0 {
                        let path_slice = (*detail_ptr).DevicePath.as_ptr();
                        let mut len = 0;
                        while *path_slice.add(len) != 0 {
                            len += 1;
                        }
                        let path_u16 = std::slice::from_raw_parts(path_slice, len);
                        if let Ok(path_str) = String::from_utf16(path_u16) {
                            log_event(
                                "INFO",
                                "USB_ENUM",
                                &format!("Found device interface [{}]: {}", idx, path_str),
                                None,
                            );
                            paths.push(path_str);
                        }
                    }
                }
                idx += 1;
            }
            SetupDiDestroyDeviceInfoList(devs);
        }

        log_event(
            "INFO",
            "USB_ENUM",
            &format!("SetupDi enumeration complete. Total SUTO device(s): {}", paths.len()),
            None,
        );
        paths
    }

    fn open_handle(wide_path: &[u16]) -> Result<HANDLE, String> {
        let path_str = String::from_utf16_lossy(wide_path);
        log_event(
            "DEBUG",
            "USB_OPEN",
            &format!("CreateFileW on {}", path_str),
            None,
        );

        unsafe {
            let h = CreateFileW(
                wide_path.as_ptr(),
                GENERIC_READ | GENERIC_WRITE,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                null(),
                OPEN_EXISTING,
                FILE_FLAG_OVERLAPPED,
                null_mut(),
            );
            if h == INVALID_HANDLE_VALUE {
                let err = GetLastError();
                let msg = format!("CreateFileW failed on {}, error code: {}", path_str, err);
                log_event("ERROR", "USB_OPEN", &msg, None);
                return Err(msg);
            }

            // Init device ioctl (0x8094206C)
            let mut out = [0u8; 12];
            let mut ret = 0;
            let ok = DeviceIoControl(
                h,
                IOCTL_USBIO_INIT_DEVICE,
                null(),
                0,
                out.as_mut_ptr() as *mut c_void,
                12,
                &mut ret,
                null_mut(),
            );
            if ok == 0 {
                let err = GetLastError();
                CloseHandle(h);
                let msg = format!("IOCTL_USBIO_INIT_DEVICE (0x6C) failed, error code: {}", err);
                log_event("ERROR", "USB_INIT", &msg, None);
                return Err(msg);
            }

            log_event(
                "INFO",
                "USB_INIT",
                &format!("IOCTL_USBIO_INIT_DEVICE (0x6C) succeeded, returned {} bytes", ret),
                Some(&out[..ret as usize]),
            );

            Ok(h)
        }
    }

    pub fn open(&mut self, path: Option<&str>) -> Result<(), String> {
        self.close()?;

        log_event(
            "INFO",
            "USB_OPEN",
            &format!("Initiating SUTO USB connection (requested path: {:?})", path),
            None,
        );

        let target_path = match path {
            Some(p) => p.to_string(),
            None => {
                let devs = Self::list_devices();
                devs.into_iter().next().ok_or_else(|| {
                    let msg = "No SUTO USB device found with GUID {325ddf96-938c-11d3-9e34-0080c82727f4}".to_string();
                    log_event("WARN", "USB_OPEN", &msg, None);
                    msg
                })?
            }
        };

        log_event("INFO", "USB_OPEN", &format!("Target device path selected: {}", target_path), None);

        let wide_path: Vec<u16> = target_path.encode_utf16().chain(std::iter::once(0)).collect();

        unsafe {
            // 1. Open Main Handle
            log_event("INFO", "USB_OPEN", "Step 1/5: Opening Main Device Handle...", None);
            let main_h = Self::open_handle(&wide_path)?;

            // 2. GET_DESCRIPTOR (18 bytes)
            log_event("INFO", "USB_OPEN", "Step 2/5: IOCTL_USBIO_GET_DESCRIPTOR (0x80942006)...", None);
            let mut desc_out = [0u8; 18];
            let mut ret = 0;
            let ok = DeviceIoControl(
                main_h,
                IOCTL_USBIO_GET_DESCRIPTOR,
                GET_DESCRIPTOR_REQ.as_ptr() as *const c_void,
                GET_DESCRIPTOR_REQ.len() as u32,
                desc_out.as_mut_ptr() as *mut c_void,
                18,
                &mut ret,
                null_mut(),
            );
            if ok == 0 || desc_out[0] != 0x12 || desc_out[1] != 0x01 {
                let err = GetLastError();
                CloseHandle(main_h);
                let msg = format!("GET_DESCRIPTOR failed, ok={}, err={}, desc={:02X?}", ok, err, desc_out);
                log_event("ERROR", "USB_DESC", &msg, None);
                return Err(msg);
            }

            log_event(
                "INFO",
                "USB_DESC",
                &format!(
                    "Device Descriptor verified (18 bytes). bcdUSB={:02X}{:02X}, idVendor={:02X}{:02X}, idProduct={:02X}{:02X}",
                    desc_out[3], desc_out[2], desc_out[9], desc_out[8], desc_out[11], desc_out[10]
                ),
                Some(&desc_out[..ret as usize]),
            );

            // 3. SET_CONFIGURATION (260 bytes verbatim per spec §3.2, best-effort)
            log_event("INFO", "USB_OPEN", "Step 3/5: IOCTL_USBIO_SET_CONFIGURATION (0x80942024, 260 bytes verbatim)...", None);
            let cfg_ok = DeviceIoControl(
                main_h,
                IOCTL_USBIO_SET_CONFIGURATION,
                SET_CONFIGURATION_260.as_ptr() as *const c_void,
                260,
                null_mut(),
                0,
                &mut ret,
                null_mut(),
            );
            log_event(
                if cfg_ok != 0 { "INFO" } else { "WARN" },
                "USB_CFG",
                &format!("IOCTL_USBIO_SET_CONFIGURATION returned code={}, ret={}, last_err={}", cfg_ok, ret, GetLastError()),
                Some(&SET_CONFIGURATION_260[..20]),
            );

            // 3.1 GET_CONFIG_INFO (0x80942050, 776 bytes out - read-only per spec §3.1/3.3)
            let mut cfg_info = [0u8; 776];
            let info_ok = DeviceIoControl(
                main_h,
                IOCTL_USBIO_GET_CONFIG_INFO,
                null(),
                0,
                cfg_info.as_mut_ptr() as *mut c_void,
                776,
                &mut ret,
                null_mut(),
            );
            log_event(
                "DEBUG",
                "USB_CFG",
                &format!("IOCTL_USBIO_GET_CONFIG_INFO returned code={}, ret={}", info_ok, ret),
                None,
            );

            // 4. Open OUT pipe (bind endpoint 0x03)
            log_event("INFO", "USB_OPEN", "Step 4/5: Binding OUT Pipe (endpoint 0x03)...", None);
            let pipe_out_h = Self::open_handle(&wide_path)?;
            let ep_out: u8 = BULK_OUT_ENDPOINT;
            let bind_out_ok = DeviceIoControl(
                pipe_out_h,
                IOCTL_USBIO_BIND_PIPE,
                &ep_out as *const _ as *const c_void,
                1,
                null_mut(),
                0,
                &mut ret,
                null_mut(),
            );
            if bind_out_ok == 0 {
                let err = GetLastError();
                CloseHandle(pipe_out_h);
                CloseHandle(main_h);
                let msg = format!("BIND_PIPE (OUT endpoint 0x03) failed, error: {}", err);
                log_event("ERROR", "USB_PIPE", &msg, None);
                return Err(msg);
            }
            log_event("INFO", "USB_PIPE", "OUT Pipe (endpoint 0x03) successfully bound", None);

            // 5. Open IN pipe (bind endpoint 0x81)
            log_event("INFO", "USB_OPEN", "Step 5/5: Binding IN Pipe (endpoint 0x81)...", None);
            let pipe_in_h = Self::open_handle(&wide_path)?;
            let ep_in: u8 = BULK_IN_ENDPOINT;
            let bind_in_ok = DeviceIoControl(
                pipe_in_h,
                IOCTL_USBIO_BIND_PIPE,
                &ep_in as *const _ as *const c_void,
                1,
                null_mut(),
                0,
                &mut ret,
                null_mut(),
            );
            if bind_in_ok == 0 {
                let err = GetLastError();
                CloseHandle(pipe_in_h);
                CloseHandle(pipe_out_h);
                CloseHandle(main_h);
                let msg = format!("BIND_PIPE (IN endpoint 0x81) failed, error: {}", err);
                log_event("ERROR", "USB_PIPE", &msg, None);
                return Err(msg);
            }
            log_event("INFO", "USB_PIPE", "IN Pipe (endpoint 0x81) successfully bound", None);

            self.main_handle = main_h;
            self.pipe_out = pipe_out_h;
            self.pipe_in = pipe_in_h;

            log_event("INFO", "USB_OPEN", "🎉 SUTO Direct USB Connection fully initialized and ready!", None);
            Ok(())
        }
    }
}

impl SutoTransport for WindowsUsbTransport {
    fn is_open(&self) -> bool {
        self.pipe_out != INVALID_HANDLE_VALUE && self.pipe_in != INVALID_HANDLE_VALUE
    }

    fn write(&mut self, data: &[u8], timeout_ms: u32) -> Result<usize, String> {
        if !self.is_open() {
            let msg = "Write failed: Device not open".to_string();
            log_event("ERROR", "USB_TX", &msg, None);
            return Err(msg);
        }

        log_event(
            "DEBUG",
            "USB_TX",
            &format!("Writing {} bytes to OUT pipe (timeout: {}ms)", data.len(), timeout_ms),
            Some(data),
        );

        unsafe {
            let mut ov: OVERLAPPED = std::mem::zeroed();
            ov.hEvent = CreateEventW(null(), 1, 0, null());
            if ov.hEvent == 0 {
                let err = GetLastError();
                let msg = format!("CreateEventW failed: {}", err);
                log_event("ERROR", "USB_TX", &msg, None);
                return Err(msg);
            }

            let mut written = 0;
            let r = WriteFile(
                self.pipe_out,
                data.as_ptr(),
                data.len() as u32,
                null_mut(),
                &mut ov,
            );

            let res = if r == 0 && GetLastError() == ERROR_IO_PENDING {
                if WaitForSingleObject(ov.hEvent, timeout_ms) == WAIT_OBJECT_0 {
                    GetOverlappedResult(self.pipe_out, &mut ov, &mut written, 0);
                    log_event("DEBUG", "USB_TX", &format!("Overlapped write completed: {} bytes", written), None);
                    Ok(written as usize)
                } else {
                    CancelIo(self.pipe_out);
                    let msg = format!("Write pipe timeout ({}ms)", timeout_ms);
                    log_event("WARN", "USB_TX", &msg, None);
                    Err(msg)
                }
            } else if r != 0 {
                GetOverlappedResult(self.pipe_out, &mut ov, &mut written, 0);
                log_event("DEBUG", "USB_TX", &format!("Synchronous write completed: {} bytes", written), None);
                Ok(written as usize)
            } else {
                let err = GetLastError();
                let msg = format!("WriteFile error: {}", err);
                log_event("ERROR", "USB_TX", &msg, None);
                Err(msg)
            };

            CloseHandle(ov.hEvent);
            res
        }
    }

    fn read(&mut self, max_len: usize, timeout_ms: u32) -> Result<Vec<u8>, String> {
        if !self.is_open() {
            let msg = "Read failed: Device not open".to_string();
            log_event("ERROR", "USB_RX", &msg, None);
            return Err(msg);
        }

        unsafe {
            let mut ov: OVERLAPPED = std::mem::zeroed();
            ov.hEvent = CreateEventW(null(), 1, 0, null());
            if ov.hEvent == 0 {
                let err = GetLastError();
                let msg = format!("CreateEventW failed: {}", err);
                log_event("ERROR", "USB_RX", &msg, None);
                return Err(msg);
            }

            let mut buf = vec![0u8; max_len];
            let mut read_bytes = 0;
            let r = ReadFile(
                self.pipe_in,
                buf.as_mut_ptr(),
                max_len as u32,
                null_mut(),
                &mut ov,
            );

            let res = if r == 0 && GetLastError() == ERROR_IO_PENDING {
                if WaitForSingleObject(ov.hEvent, timeout_ms) == WAIT_OBJECT_0 {
                    GetOverlappedResult(self.pipe_in, &mut ov, &mut read_bytes, 0);
                    buf.truncate(read_bytes as usize);
                    if read_bytes > 0 {
                        log_event(
                            "DEBUG",
                            "USB_RX",
                            &format!("Overlapped read completed: {} bytes", read_bytes),
                            Some(&buf),
                        );
                    }
                    Ok(buf)
                } else {
                    CancelIo(self.pipe_in);
                    Ok(Vec::new())
                }
            } else if r != 0 {
                GetOverlappedResult(self.pipe_in, &mut ov, &mut read_bytes, 0);
                buf.truncate(read_bytes as usize);
                if read_bytes > 0 {
                    log_event(
                        "DEBUG",
                        "USB_RX",
                        &format!("Synchronous read completed: {} bytes", read_bytes),
                        Some(&buf),
                    );
                }
                Ok(buf)
            } else {
                let err = GetLastError();
                let msg = format!("ReadFile error: {}", err);
                log_event("ERROR", "USB_RX", &msg, None);
                Err(msg)
            };

            CloseHandle(ov.hEvent);
            res
        }
    }

    fn close(&mut self) -> Result<(), String> {
        log_event("INFO", "USB_CLOSE", "Closing SUTO USB device handles...", None);
        unsafe {
            if self.pipe_in != INVALID_HANDLE_VALUE {
                CloseHandle(self.pipe_in);
                self.pipe_in = INVALID_HANDLE_VALUE;
            }
            if self.pipe_out != INVALID_HANDLE_VALUE {
                CloseHandle(self.pipe_out);
                self.pipe_out = INVALID_HANDLE_VALUE;
            }
            if self.main_handle != INVALID_HANDLE_VALUE {
                CloseHandle(self.main_handle);
                self.main_handle = INVALID_HANDLE_VALUE;
            }
        }
        log_event("INFO", "USB_CLOSE", "Handles successfully closed", None);
        Ok(())
    }
}
