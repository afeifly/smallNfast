//! SUTO Transport Abstraction
//!
//! Defines the common transport interface. Transports (USB, Ethernet, RS485, BLE)
//! implement this trait so the protocol engine remains decoupled from the medium.

use super::logger::log_event;

pub trait SutoTransport: Send + Sync {
    /// Check if transport handle is currently open and valid
    fn is_open(&self) -> bool;

    /// Write raw bytes to the device
    fn write(&mut self, data: &[u8], timeout_ms: u32) -> Result<usize, String>;

    /// Read raw bytes from the device
    fn read(&mut self, max_len: usize, timeout_ms: u32) -> Result<Vec<u8>, String>;

    /// Close the transport handles
    fn close(&mut self) -> Result<(), String>;

    /// Write a command frame and accumulate reply bytes until complete or timed out
    fn write_and_read(&mut self, packet: &[u8], timeout_ms: u32) -> Result<Vec<u8>, String> {
        log_event(
            "INFO",
            "COMM_TX",
            &format!(">> Sending packet ({} bytes)", packet.len()),
            Some(packet),
        );

        self.write(packet, 200)?;

        let start = std::time::Instant::now();
        let timeout = std::time::Duration::from_millis(timeout_ms as u64);
        let mut acc = Vec::new();
        let mut idle_count = 0;

        while start.elapsed() < timeout && idle_count < 10 {
            match self.read(8192, 200) {
                Ok(chunk) if !chunk.is_empty() => {
                    log_event(
                        "DEBUG",
                        "COMM_RX",
                        &format!("Chunk received: {} bytes (total acc: {})", chunk.len(), acc.len() + chunk.len()),
                        Some(&chunk),
                    );
                    acc.extend_from_slice(&chunk);
                    idle_count = 0;
                    // If we received at least header and full frame length
                    if acc.len() >= 2 && acc.len() >= acc[1] as usize {
                        break;
                    }
                }
                _ => {
                    idle_count += 1;
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(15));
        }

        let elapsed = start.elapsed().as_millis();
        if acc.is_empty() {
            let msg = format!("Communication timeout: no response from device within {}ms", timeout_ms);
            log_event("WARN", "COMM_RX", &msg, None);
            Err(msg)
        } else {
            log_event(
                "INFO",
                "COMM_RX",
                &format!("<< Complete response received ({} bytes in {}ms)", acc.len(), elapsed),
                Some(&acc),
            );
            Ok(acc)
        }
    }
}
