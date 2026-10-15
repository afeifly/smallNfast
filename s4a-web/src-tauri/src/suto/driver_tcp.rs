//! SUTO Ethernet / TCP Socket Transport
//!
//! Implements CS-Bus over TCP for Ethernet-connected SUTO sensors, displays, and data loggers.
//! Works cross-platform on macOS, Windows, and Linux.

use super::logger::log_event;
use super::transport::SutoTransport;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::time::Duration;

pub struct TcpTransport {
    stream: Option<TcpStream>,
    endpoint: String,
}

impl TcpTransport {
    pub fn new() -> Self {
        Self {
            stream: None,
            endpoint: String::new(),
        }
    }

    pub fn connect(&mut self, host: &str, port: u16) -> Result<(), String> {
        let addr_str = format!("{}:{}", host, port);
        log_event(
            "INFO",
            "TCP_OPEN",
            &format!("Connecting to SUTO Ethernet device at {}...", addr_str),
            None,
        );

        let addrs: Vec<SocketAddr> = addr_str
            .to_socket_addrs()
            .map_err(|e| format!("Invalid host/port '{}': {}", addr_str, e))?
            .collect();

        if addrs.is_empty() {
            let msg = format!("Unable to resolve host address: {}", addr_str);
            log_event("ERROR", "TCP_OPEN", &msg, None);
            return Err(msg);
        }

        let stream = TcpStream::connect_timeout(&addrs[0], Duration::from_millis(3500))
            .map_err(|e| {
                let msg = format!("Failed to connect to {}: {}", addr_str, e);
                log_event("ERROR", "TCP_OPEN", &msg, None);
                msg
            })?;

        stream
            .set_read_timeout(Some(Duration::from_millis(150)))
            .map_err(|e| e.to_string())?;
        stream
            .set_write_timeout(Some(Duration::from_millis(500)))
            .map_err(|e| e.to_string())?;
        let _ = stream.set_nodelay(true);

        self.stream = Some(stream);
        self.endpoint = addr_str;

        log_event(
            "INFO",
            "TCP_OPEN",
            &format!("🎉 Successfully connected to SUTO Ethernet at {}", self.endpoint),
            None,
        );
        Ok(())
    }
}

impl SutoTransport for TcpTransport {
    fn is_open(&self) -> bool {
        self.stream.is_some()
    }

    fn write(&mut self, data: &[u8], timeout_ms: u32) -> Result<usize, String> {
        let stream = self.stream.as_mut().ok_or("TCP stream not open")?;
        stream
            .set_write_timeout(Some(Duration::from_millis(timeout_ms as u64)))
            .map_err(|e| e.to_string())?;

        log_event(
            "DEBUG",
            "TCP_TX",
            &format!("Writing {} bytes to TCP socket", data.len()),
            Some(data),
        );

        stream.write_all(data).map_err(|e| {
            let msg = format!("TCP write error: {}", e);
            log_event("ERROR", "TCP_TX", &msg, None);
            msg
        })?;
        stream.flush().map_err(|e| format!("TCP flush error: {}", e))?;
        Ok(data.len())
    }

    fn read(&mut self, max_len: usize, timeout_ms: u32) -> Result<Vec<u8>, String> {
        let stream = self.stream.as_mut().ok_or("TCP stream not open")?;
        stream
            .set_read_timeout(Some(Duration::from_millis(timeout_ms as u64)))
            .map_err(|e| e.to_string())?;

        let mut buf = vec![0u8; max_len.min(4096)];
        match stream.read(&mut buf) {
            Ok(0) => {
                log_event("WARN", "TCP_RX", "TCP socket closed by peer", None);
                Err("Connection closed by peer".into())
            }
            Ok(n) => {
                buf.truncate(n);
                log_event(
                    "DEBUG",
                    "TCP_RX",
                    &format!("Read {} bytes from TCP socket", n),
                    Some(&buf),
                );
                Ok(buf)
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut || e.kind() == std::io::ErrorKind::WouldBlock => {
                // Expected timeout while polling
                Ok(Vec::new())
            }
            Err(e) => {
                let msg = format!("TCP read error: {}", e);
                log_event("ERROR", "TCP_RX", &msg, None);
                Err(msg)
            }
        }
    }

    fn close(&mut self) -> Result<(), String> {
        log_event("INFO", "TCP_CLOSE", &format!("Closing TCP connection to {}", self.endpoint), None);
        if let Some(stream) = self.stream.take() {
            let _ = stream.shutdown(std::net::Shutdown::Both);
        }
        log_event("INFO", "TCP_CLOSE", "TCP connection closed", None);
        Ok(())
    }
}
