//! SUTO Bluetooth Low Energy (BLE) Transport via btleplug
//!
//! Provides native cross-platform BLE communication (Windows, macOS, Linux).

use std::sync::{Arc, Condvar, Mutex, OnceLock};
use std::time::Duration;

use btleplug::api::{
    Central, CharPropFlags, Characteristic, Manager as _, Peripheral as _, ScanFilter, WriteType,
};
use btleplug::platform::{Adapter, Manager};
use futures::stream::StreamExt;
use serde::{Deserialize, Serialize};

use super::logger::log_event;
use super::transport::SutoTransport;

static SHARED_ADAPTER: OnceLock<Adapter> = OnceLock::new();

#[cfg(target_os = "android")]
#[derive(Debug)]
#[allow(dead_code)]
enum AndroidBleInitError {
    Jni(jni::errors::Error),
    Btle(btleplug::Error),
}

#[cfg(target_os = "android")]
impl From<jni::errors::Error> for AndroidBleInitError {
    fn from(e: jni::errors::Error) -> Self {
        AndroidBleInitError::Jni(e)
    }
}

#[cfg(target_os = "android")]
impl From<btleplug::Error> for AndroidBleInitError {
    fn from(e: btleplug::Error) -> Self {
        AndroidBleInitError::Btle(e)
    }
}

#[cfg(target_os = "android")]
static ANDROID_INIT: OnceLock<bool> = OnceLock::new();

#[cfg(target_os = "android")]
static JAVA_VM: OnceLock<jni::JavaVM> = OnceLock::new();

#[cfg(target_os = "android")]
pub fn get_java_vm() -> Option<&'static jni::JavaVM> {
    JAVA_VM.get()
}

#[cfg(target_os = "android")]
#[unsafe(no_mangle)]
pub extern "system" fn Java_com_s4a_app_MainActivity_initBtleplug<'frame>(
    mut unowned_env: jni::EnvUnowned<'frame>,
    _class: jni::objects::JClass,
) {
    let _ = unowned_env.with_env(|env| {
        if let Ok(vm) = env.get_java_vm() {
            let _ = JAVA_VM.set(vm);
        }
        super::driver_android_usb::init_usb_helper(env);
        if let Err(e) = btleplug::platform::init(env) {
            log_event("ERROR", "BLE_INIT", &format!("initBtleplug error: {:?}", e), None);
        } else {
            let _ = ANDROID_INIT.set(true);
            log_event("INFO", "BLE_INIT", "btleplug initialized successfully from Java", None);
        }
        Ok::<(), jni::errors::Error>(())
    });
}

#[cfg(target_os = "android")]
fn ensure_android_init() -> Result<(), String> {
    if ANDROID_INIT.get().is_some() {
        return Ok(());
    }
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    vm.attach_current_thread(|env| -> Result<(), AndroidBleInitError> {
        btleplug::platform::init(env)?;
        Ok(())
    })
    .map_err(|e| format!("Failed to init btleplug Android: {:?}", e))?;
    let _ = ANDROID_INIT.set(true);
    Ok(())
}

/// Obtain the shared system BLE adapter singleton
pub async fn get_shared_adapter() -> Result<Adapter, String> {
    if let Some(adapter) = SHARED_ADAPTER.get() {
        return Ok(adapter.clone());
    }

    #[cfg(target_os = "android")]
    ensure_android_init()?;

    let manager = Manager::new()
        .await
        .map_err(|e| format!("Failed to initialize BLE manager: {:?}", e))?;

    let adapters = manager
        .adapters()
        .await
        .map_err(|e| format!("Failed to get BLE adapters: {:?}", e))?;

    if adapters.is_empty() {
        return Err("No Bluetooth Low Energy adapters found on this system".into());
    }

    let adapter = adapters[0].clone();
    let _ = SHARED_ADAPTER.set(adapter.clone());
    Ok(adapter)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BleDeviceInfo {
    pub id: String,
    pub name: String,
    pub rssi: Option<i16>,
    pub is_suto: bool,
}

struct BleWriteMsg {
    data: Vec<u8>,
    reply: std::sync::mpsc::Sender<Result<usize, String>>,
}

pub struct BleTransport {
    write_tx: std::sync::mpsc::Sender<BleWriteMsg>,
    rx_buffer: Arc<Mutex<Vec<u8>>>,
    condvar: Arc<Condvar>,
    is_open: Arc<Mutex<bool>>,
    device_name: String,
}

impl BleTransport {
    /// List nearby BLE peripherals (scanning for duration_ms)
    pub async fn list_devices(
        duration_ms: u64,
        suto_only: bool,
    ) -> Result<Vec<BleDeviceInfo>, String> {
        let adapter = get_shared_adapter().await?;

        adapter
            .start_scan(ScanFilter::default())
            .await
            .map_err(|e| format!("Failed to start BLE scan: {:?}", e))?;

        log_event(
            "INFO",
            "BLE_SCAN",
            &format!("Started native BLE scan for {}ms...", duration_ms),
            None,
        );

        tokio::time::sleep(Duration::from_millis(duration_ms)).await;

        let peripherals = adapter
            .peripherals()
            .await
            .map_err(|e| format!("Failed to retrieve BLE peripherals: {:?}", e))?;

        let mut results = Vec::new();

        for p in peripherals {
            if let Ok(Some(props)) = p.properties().await {
                let name = props
                    .local_name
                    .unwrap_or_else(|| "Unnamed BLE Device".into());
                let id = p.id().to_string();
                let rssi = props.rssi;

                let is_suto_name = name.to_lowercase().contains("suto")
                    || name.to_lowercase().contains("s4")
                    || name.to_lowercase().contains("s5")
                    || name.to_lowercase().contains("s6")
                    || name.to_lowercase().contains("cs-")
                    || name.to_lowercase().contains("va5")
                    || name.to_lowercase().contains("fa5");

                let has_suto_service = props.services.iter().any(|uuid| {
                    let u_str = uuid.to_string().to_lowercase();
                    u_str.contains("49535343") // Microchip ISSC
                        || u_str.contains("6e400001") // Nordic NUS
                        || u_str.contains("ffe0") // TI / HM-10
                        || u_str.contains("ffe5")
                });

                let is_suto = is_suto_name || has_suto_service;

                if !suto_only || is_suto {
                    results.push(BleDeviceInfo {
                        id,
                        name,
                        rssi,
                        is_suto,
                    });
                }
            }
        }

        let _ = adapter.stop_scan().await;
        log_event(
            "INFO",
            "BLE_SCAN",
            &format!("Scan complete. Found {} BLE devices.", results.len()),
            None,
        );
        Ok(results)
    }

    /// Connect to a peripheral by device ID and establish communication transport
    pub async fn connect(device_id: &str) -> Result<Self, String> {
        let adapter = get_shared_adapter().await?;

        log_event(
            "INFO",
            "BLE_CONN",
            &format!("Searching adapter for peripheral ID: {}...", device_id),
            None,
        );

        // 1. Look in existing adapter peripheral list
        let mut target_peripheral = None;
        let peripherals = adapter.peripherals().await.unwrap_or_default();
        for p in peripherals {
            if p.id().to_string() == device_id {
                target_peripheral = Some(p);
                break;
            }
        }

        // 2. If not found in current cache, run a quick scan to discover it
        if target_peripheral.is_none() {
            log_event(
                "INFO",
                "BLE_CONN",
                "Device not found in current adapter cache; performing quick 2s scan...",
                None,
            );
            let _ = adapter.start_scan(ScanFilter::default()).await;
            tokio::time::sleep(Duration::from_millis(2000)).await;
            let _ = adapter.stop_scan().await;

            let rescanned = adapter.peripherals().await.unwrap_or_default();
            for p in rescanned {
                if p.id().to_string() == device_id {
                    target_peripheral = Some(p);
                    break;
                }
            }
        }

        let peripheral = match target_peripheral {
            Some(p) => p,
            None => {
                let msg = format!("BLE device with ID '{}' not found. Please scan again.", device_id);
                log_event("ERROR", "BLE_CONN", &msg, None);
                return Err(msg);
            }
        };

        log_event(
            "INFO",
            "BLE_CONN",
            &format!("Found peripheral. Connecting to BLE device (ID: {})...", device_id),
            None,
        );

        // Connect with a 7-second timeout
        match tokio::time::timeout(Duration::from_secs(7), peripheral.connect()).await {
            Ok(Ok(())) => {
                log_event("INFO", "BLE_CONN", "GATT connection established. Discovering services...", None);
            }
            Ok(Err(e)) => {
                let msg = format!("Failed to connect to BLE device: {:?}", e);
                log_event("ERROR", "BLE_CONN", &msg, None);
                return Err(msg);
            }
            Err(_) => {
                let msg = format!("Connection attempt to BLE device {} timed out after 7s", device_id);
                log_event("ERROR", "BLE_CONN", &msg, None);
                return Err(msg);
            }
        }

        peripheral
            .discover_services()
            .await
            .map_err(|e| {
                let msg = format!("Failed to discover BLE services: {:?}", e);
                log_event("ERROR", "BLE_CONN", &msg, None);
                msg
            })?;

        let device_name = peripheral
            .properties()
            .await
            .ok()
            .flatten()
            .and_then(|p| p.local_name)
            .unwrap_or_else(|| "SUTO BLE Device".into());

        // Locate TX (Write) and RX (Notify) characteristics
        let chars = peripheral.characteristics();
        let (write_char, notify_char) = Self::resolve_characteristics(&chars)?;

        let write_type = if write_char.properties.contains(CharPropFlags::WRITE) {
            WriteType::WithResponse
        } else {
            WriteType::WithoutResponse
        };

        log_event(
            "INFO",
            "BLE_CONN",
            &format!(
                "Configured BLE UART on '{}': Write Char = {}, Notify Char = {}",
                device_name, write_char.uuid, notify_char.uuid
            ),
            None,
        );

        // Subscribe to notifications
        peripheral
            .subscribe(&notify_char)
            .await
            .map_err(|e| {
                let msg = format!("Failed to subscribe to BLE notifications: {:?}", e);
                log_event("ERROR", "BLE_CONN", &msg, None);
                msg
            })?;

        let mut notification_stream = peripheral
            .notifications()
            .await
            .map_err(|e| {
                let msg = format!("Failed to get notification stream: {:?}", e);
                log_event("ERROR", "BLE_CONN", &msg, None);
                msg
            })?;

        let rx_buffer = Arc::new(Mutex::new(Vec::new()));
        let condvar = Arc::new(Condvar::new());
        let is_open = Arc::new(Mutex::new(true));

        // Background task to receive notifications into buffer
        let rx_buf_clone = rx_buffer.clone();
        let cond_clone = condvar.clone();
        let is_open_rx = is_open.clone();
        tokio::spawn(async move {
            while let Some(data) = notification_stream.next().await {
                if !*is_open_rx.lock().unwrap() {
                    break;
                }
                let mut buf = rx_buf_clone.lock().unwrap();
                buf.extend_from_slice(&data.value);
                cond_clone.notify_all();
            }
        });

        // Dedicated OS thread to process outgoing writes asynchronously without blocking Tokio runtime
        let (write_tx, write_rx) = std::sync::mpsc::channel::<BleWriteMsg>();
        let peripheral_clone = peripheral.clone();
        let write_char_clone = write_char.clone();
        let is_open_tx = is_open.clone();

        std::thread::Builder::new()
            .name("suto-ble-writer".into())
            .spawn(move || {
                let rt = match tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                {
                    Ok(r) => r,
                    Err(e) => {
                        log_event("ERROR", "BLE_CONN", &format!("Failed to build BLE worker runtime: {:?}", e), None);
                        return;
                    }
                };

                rt.block_on(async move {
                    while let Ok(msg) = write_rx.recv() {
                        if !*is_open_tx.lock().unwrap() {
                            let _ = msg.reply.send(Err("BLE transport closed".into()));
                            continue;
                        }

                        // Chunk writes into 20-byte BLE MTU slices with inter-packet pacing
                        const CHUNK_SIZE: usize = 20;
                        let mut total_written = 0;
                        let mut write_err = None;

                        for chunk in msg.data.chunks(CHUNK_SIZE) {
                            match peripheral_clone
                                .write(&write_char_clone, chunk, write_type)
                                .await
                            {
                                Ok(_) => {
                                    total_written += chunk.len();
                                    tokio::time::sleep(Duration::from_millis(15)).await;
                                }
                                Err(e) => {
                                    write_err = Some(format!("BLE write failed: {:?}", e));
                                    break;
                                }
                            }
                        }

                        if let Some(err) = write_err {
                            let _ = msg.reply.send(Err(err));
                        } else {
                            let _ = msg.reply.send(Ok(total_written));
                        }
                    }
                    let _ = peripheral_clone.disconnect().await;
                });
            })
            .map_err(|e| format!("Failed to spawn BLE worker thread: {:?}", e))?;

        log_event(
            "INFO",
            "BLE_CONN",
            &format!("Successfully established BLE link with '{}'!", device_name),
            None,
        );

        Ok(Self {
            write_tx,
            rx_buffer,
            condvar,
            is_open,
            device_name,
        })
    }

    fn resolve_characteristics(
        chars: &std::collections::BTreeSet<Characteristic>,
    ) -> Result<(Characteristic, Characteristic), String> {
        let mut write_char = None;
        let mut notify_char = None;

        // 1. Check known SUTO BLE UUID prefixes
        for ch in chars {
            let u_str = ch.uuid.to_string().to_lowercase();

            // Microchip ISSC Transparent UART
            if u_str.starts_with("49535343-8841-43f4") {
                write_char = Some(ch.clone());
            } else if u_str.starts_with("49535343-1e4d-4bd9") {
                notify_char = Some(ch.clone());
            }

            // Nordic NUS
            if u_str.starts_with("6e400002") {
                write_char = Some(ch.clone());
            } else if u_str.starts_with("6e400003") {
                notify_char = Some(ch.clone());
            }

            // TI / HM-10 UART
            if u_str.contains("ffe9") || (u_str.contains("ffe5") && write_char.is_none()) {
                write_char = Some(ch.clone());
            }
            if u_str.contains("ffe4") || (u_str.contains("ffe1") && notify_char.is_none()) {
                notify_char = Some(ch.clone());
            }
        }

        // 2. Generic fallback: find any characteristic that supports Write, and any that supports Notify
        if write_char.is_none() {
            write_char = chars.iter().find(|c| {
                c.properties.contains(CharPropFlags::WRITE)
                    || c.properties.contains(CharPropFlags::WRITE_WITHOUT_RESPONSE)
            }).cloned();
        }

        if notify_char.is_none() {
            notify_char = chars.iter().find(|c| {
                c.properties.contains(CharPropFlags::NOTIFY)
                    || c.properties.contains(CharPropFlags::INDICATE)
            }).cloned();
        }

        match (write_char, notify_char) {
            (Some(w), Some(n)) => Ok((w, n)),
            _ => Err("Could not find compatible BLE UART Write and Notify characteristics on this device".into()),
        }
    }

    pub fn device_name(&self) -> &str {
        &self.device_name
    }
}

impl SutoTransport for BleTransport {
    fn is_open(&self) -> bool {
        *self.is_open.lock().unwrap()
    }

    fn write(&mut self, data: &[u8], timeout_ms: u32) -> Result<usize, String> {
        if !self.is_open() {
            return Err("BLE transport is not open".into());
        }

        let (reply_tx, reply_rx) = std::sync::mpsc::channel();
        self.write_tx
            .send(BleWriteMsg {
                data: data.to_vec(),
                reply: reply_tx,
            })
            .map_err(|e| format!("Failed to enqueue BLE write: {:?}", e))?;

        reply_rx
            .recv_timeout(Duration::from_millis(timeout_ms as u64))
            .map_err(|e| format!("BLE write confirmation timeout: {:?}", e))?
    }

    fn read(&mut self, max_len: usize, timeout_ms: u32) -> Result<Vec<u8>, String> {
        let start = std::time::Instant::now();
        let timeout = Duration::from_millis(timeout_ms as u64);

        let mut lock = self.rx_buffer.lock().unwrap();
        while lock.is_empty() {
            let elapsed = start.elapsed();
            if elapsed >= timeout {
                return Ok(Vec::new());
            }
            let remaining = timeout - elapsed;
            let (new_lock, _) = self.condvar.wait_timeout(lock, remaining).unwrap();
            lock = new_lock;
        }

        let take_len = max_len.min(lock.len());
        let chunk: Vec<u8> = lock.drain(..take_len).collect();
        Ok(chunk)
    }

    fn close(&mut self) -> Result<(), String> {
        let mut open_lock = self.is_open.lock().unwrap();
        *open_lock = false;
        self.condvar.notify_all();
        Ok(())
    }
}
