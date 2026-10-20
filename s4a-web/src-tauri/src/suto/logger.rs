//! SUTO Diagnostic & Communication Logger
//!
//! Provides in-memory ring-buffer logging, dedicated file logging (app_log.log),
//! and bridge to standard Rust `log` crate. Exposes log entries to the UI via Tauri IPC.

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{LazyLock, Mutex};
use std::time::SystemTime;

const MAX_LOG_ENTRIES: usize = 1000;
static LOG_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SutoLogEntry {
    pub id: u64,
    pub timestamp: String,
    pub level: String,
    pub tag: String,
    pub message: String,
    pub hex_data: Option<String>,
}

static LOG_BUFFER: LazyLock<Mutex<VecDeque<SutoLogEntry>>> =
    LazyLock::new(|| Mutex::new(VecDeque::with_capacity(MAX_LOG_ENTRIES)));

static LOG_FILE_PATH: LazyLock<PathBuf> = LazyLock::new(|| {
    // Attempt to write in the current executable directory or working directory
    let candidate = match std::env::current_exe() {
        Ok(mut p) => {
            p.pop();
            p.push("app_log.log");
            p
        }
        Err(_) => PathBuf::from("app_log.log"),
    };

    // Test write permission, otherwise fall back to temp dir
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&candidate) {
        let _ = writeln!(f, "\n=== APP LOG SESSION STARTED {} ===", get_iso_timestamp());
        candidate
    } else {
        let mut tmp = std::env::temp_dir();
        tmp.push("app_log.log");
        let _ = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&tmp)
            .and_then(|mut f| writeln!(f, "\n=== APP LOG SESSION STARTED {} ===", get_iso_timestamp()));
        tmp
    }
});

fn get_iso_timestamp() -> String {
    let now = SystemTime::now();
    let duration = now
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    let millis = duration.subsec_millis();

    // Convert UNIX seconds to UTC YYYY-MM-DD HH:MM:SS.mmm
    let days = secs / 86400;
    let rem_secs = secs % 86400;
    let hours = rem_secs / 3600;
    let mins = (rem_secs % 3600) / 60;
    let s = rem_secs % 60;

    // Approximate civil calendar calculation for simple standalone UTC timestamp
    let (year, month, day) = civil_from_days(days as i64);

    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:03}",
        year, month, day, hours, mins, s, millis
    )
}

fn civil_from_days(days: i64) -> (i64, u8, u8) {
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1024 + doe / 1461 - doe / 142401) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u8;
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u8;
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

pub fn format_hex(data: &[u8]) -> String {
    if data.len() <= 64 {
        data.iter()
            .map(|b| format!("{:02X}", b))
            .collect::<Vec<_>>()
            .join(" ")
    } else {
        let preview = data[..48]
            .iter()
            .map(|b| format!("{:02X}", b))
            .collect::<Vec<_>>()
            .join(" ");
        format!("{} ... ({} bytes total)", preview, data.len())
    }
}

pub fn log_event(level: &str, tag: &str, message: &str, hex_bytes: Option<&[u8]>) {
    let id = LOG_COUNTER.fetch_add(1, Ordering::Relaxed);
    let timestamp = get_iso_timestamp();
    let hex_data = hex_bytes.map(format_hex);

    // 1. Emit to standard Rust `log` crate
    match level {
        "ERROR" => {
            if let Some(ref hex) = hex_data {
                log::error!("[{}] {} | HEX: {}", tag, message, hex);
            } else {
                log::error!("[{}] {}", tag, message);
            }
        }
        "WARN" => {
            if let Some(ref hex) = hex_data {
                log::warn!("[{}] {} | HEX: {}", tag, message, hex);
            } else {
                log::warn!("[{}] {}", tag, message);
            }
        }
        "DEBUG" => {
            if let Some(ref hex) = hex_data {
                log::debug!("[{}] {} | HEX: {}", tag, message, hex);
            } else {
                log::debug!("[{}] {}", tag, message);
            }
        }
        _ => {
            if let Some(ref hex) = hex_data {
                log::info!("[{}] {} | HEX: {}", tag, message, hex);
            } else {
                log::info!("[{}] {}", tag, message);
            }
        }
    }

    // 2. Append to file
    let file_path = &*LOG_FILE_PATH;
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(file_path) {
        if let Some(ref hex) = hex_data {
            let _ = writeln!(
                f,
                "[{}] [{:<5}] [{:<8}] {}\n  HEX: {}",
                timestamp, level, tag, message, hex
            );
        } else {
            let _ = writeln!(
                f,
                "[{}] [{:<5}] [{:<8}] {}",
                timestamp, level, tag, message
            );
        }
    }

    // 3. Store in in-memory ring buffer
    let entry = SutoLogEntry {
        id,
        timestamp,
        level: level.to_string(),
        tag: tag.to_string(),
        message: message.to_string(),
        hex_data,
    };

    if let Ok(mut buf) = LOG_BUFFER.lock() {
        if buf.len() >= MAX_LOG_ENTRIES {
            buf.pop_front();
        }
        buf.push_back(entry);
    }
}

pub fn get_logs(since_id: u64) -> Vec<SutoLogEntry> {
    if let Ok(buf) = LOG_BUFFER.lock() {
        buf.iter()
            .filter(|e| e.id > since_id)
            .cloned()
            .collect()
    } else {
        Vec::new()
    }
}

pub fn clear_logs() {
    if let Ok(mut buf) = LOG_BUFFER.lock() {
        buf.clear();
    }
}

pub fn get_log_file_path() -> String {
    LOG_FILE_PATH.to_string_lossy().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_logger_buffer_and_hex() {
        clear_logs();
        let test_bytes = [0x3A, 0x01, 0x03, 0x00, 0x04];
        log_event("INFO", "TEST", "Testing logger functionality", Some(&test_bytes));

        let logs = get_logs(0);
        assert!(!logs.is_empty());
        let last = logs.last().unwrap();
        assert_eq!(last.tag, "TEST");
        assert_eq!(last.level, "INFO");
        assert_eq!(last.hex_data.as_deref(), Some("3A 01 03 00 04"));
    }
}
