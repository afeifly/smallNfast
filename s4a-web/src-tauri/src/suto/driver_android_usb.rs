//! Android USB OTG Transport for SUTO hardware
//!
//! Interfaces with android.hardware.usb via com.s4a.app.SutoUsbHelper using JNI.

#![cfg(target_os = "android")]

use super::driver_ble::get_java_vm;
use super::logger::log_event;
use super::transport::SutoTransport;
use jni::{jni_sig, jni_str};
use jni::objects::{Global, JClass, JObject, JString, JValue};
use std::sync::OnceLock;
use std::sync::atomic::{AtomicBool, Ordering};

static USB_HELPER_CLASS: OnceLock<Global<JClass>> = OnceLock::new();

pub fn init_usb_helper(env: &mut jni::Env) {
    match env.find_class(jni_str!("com/s4a/app/SutoUsbHelper")) {
        Ok(class) => match env.new_global_ref(class) {
            Ok(global) => {
                let _ = USB_HELPER_CLASS.set(global);
                log_event("INFO", "USB_INIT", "SutoUsbHelper class cached globally", None);
            }
            Err(e) => {
                log_event("ERROR", "USB_INIT", &format!("Failed to create GlobalRef for SutoUsbHelper: {:?}", e), None);
            }
        },
        Err(e) => {
            log_event("ERROR", "USB_INIT", &format!("Failed to find SutoUsbHelper during init: {:?}", e), None);
        }
    }
}

pub struct AndroidUsbTransport {
    is_open: AtomicBool,
}

impl AndroidUsbTransport {
    pub fn new() -> Self {
        Self {
            is_open: AtomicBool::new(false),
        }
    }

    pub fn list_devices() -> Vec<String> {
        let vm = match get_java_vm() {
            Some(v) => v,
            None => {
                log_event("WARN", "USB_LIST", "JVM not available for USB enumeration", None);
                return Vec::new();
            }
        };

        let result = vm.attach_current_thread(|env| -> Result<Vec<String>, jni::errors::Error> {
            let helper_class = match USB_HELPER_CLASS.get() {
                Some(c) => c,
                None => return Ok(Vec::new()),
            };
            let list_val = env.call_static_method(
                helper_class,
                jni_str!("listDevices"),
                jni_sig!("()Ljava/lang/String;"),
                &[],
            )?;
            let arr_obj = list_val.l()?;
            if arr_obj.is_null() {
                return Ok(Vec::new());
            }
            let jstr = unsafe { JString::from_raw(env, arr_obj.into_raw()) };
            let rust_str = jstr.to_string();
            let items: Vec<String> = rust_str
                .lines()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            Ok(items)
        });

        result.unwrap_or_else(|e: jni::errors::Error| {
            log_event("WARN", "USB_LIST", &format!("list_devices JNI error: {:?}", e), None);
            Vec::new()
        })
    }

    pub fn open(&mut self, path: Option<&str>) -> Result<(), String> {
        let vm = get_java_vm().ok_or_else(|| "JVM not initialized".to_string())?;
        let helper_class_ref = USB_HELPER_CLASS.get().ok_or_else(|| "SutoUsbHelper class not loaded".to_string())?;

        let err_opt = vm.attach_current_thread(|env| -> Result<Option<String>, jni::errors::Error> {
            let j_path_obj;
            let j_path_val = match path {
                Some(p) => {
                    j_path_obj = env.new_string(p)?;
                    JValue::Object(&j_path_obj.into())
                }
                None => JValue::Object(&JObject::null()),
            };

            let res_val = env.call_static_method(
                helper_class_ref,
                jni_str!("openDevice"),
                jni_sig!("(Ljava/lang/String;)Ljava/lang/String;"),
                &[j_path_val],
            )?;

            let err_obj = res_val.l()?;
            if !err_obj.is_null() {
                let jstr = unsafe { JString::from_raw(env, err_obj.into_raw()) };
                let msg = jstr.to_string();
                Ok(Some(msg))
            } else {
                Ok(None)
            }
        }).map_err(|e: jni::errors::Error| format!("openDevice call failed: {:?}", e))?;

        if let Some(err_msg) = err_opt {
            return Err(err_msg);
        }

        self.is_open.store(true, Ordering::SeqCst);
        log_event("INFO", "USB_OPEN", "SUTO USB OTG connection opened successfully", None);
        Ok(())
    }
}

impl SutoTransport for AndroidUsbTransport {
    fn is_open(&self) -> bool {
        self.is_open.load(Ordering::SeqCst)
    }

    fn write(&mut self, data: &[u8], timeout_ms: u32) -> Result<usize, String> {
        if !self.is_open() {
            return Err("USB Device not open".into());
        }

        let vm = get_java_vm().ok_or_else(|| "JVM not initialized".to_string())?;
        let helper_class_ref = USB_HELPER_CLASS.get().ok_or_else(|| "SutoUsbHelper class not loaded".to_string())?;

        vm.attach_current_thread(|env| -> Result<usize, jni::errors::Error> {
            let byte_arr = env.byte_array_from_slice(data)?;
            let res = env.call_static_method(
                helper_class_ref,
                jni_str!("writeData"),
                jni_sig!("([BI)I"),
                &[JValue::Object(byte_arr.as_ref()), JValue::Int(timeout_ms as i32)],
            )?;

            let written = res.i()?;
            if written < 0 {
                Err(jni::errors::Error::JavaException)
            } else {
                Ok(written as usize)
            }
        }).map_err(|e: jni::errors::Error| format!("USB write failed: {:?}", e))
    }

    fn read(&mut self, max_len: usize, timeout_ms: u32) -> Result<Vec<u8>, String> {
        if !self.is_open() {
            return Err("USB Device not open".into());
        }

        let vm = get_java_vm().ok_or_else(|| "JVM not initialized".to_string())?;
        let helper_class_ref = USB_HELPER_CLASS.get().ok_or_else(|| "SutoUsbHelper class not loaded".to_string())?;

        vm.attach_current_thread(|env| -> Result<Vec<u8>, jni::errors::Error> {
            let byte_arr = env.new_byte_array(max_len)?;
            let res = env.call_static_method(
                helper_class_ref,
                jni_str!("readData"),
                jni_sig!("([BI)I"),
                &[JValue::Object(byte_arr.as_ref()), JValue::Int(timeout_ms as i32)],
            )?;

            let read_len = res.i()?;
            if read_len <= 0 {
                return Ok(Vec::new());
            }

            let mut buf = vec![0i8; read_len as usize];
            let _ = byte_arr.get_region(env, 0, &mut buf)?;

            let u8_buf = buf.into_iter().map(|b| b as u8).collect();
            Ok(u8_buf)
        }).map_err(|e: jni::errors::Error| format!("USB read failed: {:?}", e))
    }

    fn close(&mut self) -> Result<(), String> {
        self.is_open.store(false, Ordering::SeqCst);
        if let (Some(vm), Some(helper_class_ref)) = (get_java_vm(), USB_HELPER_CLASS.get()) {
            let _ = vm.attach_current_thread(|env| -> Result<(), jni::errors::Error> {
                let _ = env.call_static_method(
                    helper_class_ref,
                    jni_str!("closeDevice"),
                    jni_sig!("()V"),
                    &[],
                );
                Ok(())
            });
        }
        Ok(())
    }
}
