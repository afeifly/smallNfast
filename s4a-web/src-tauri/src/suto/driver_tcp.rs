//! SUTO Ethernet / TCP Socket Transport
//!
//! Implements CS-Bus over TCP for Ethernet-connected SUTO sensors, displays, and data loggers.
//! Works cross-platform on macOS, Windows, and Linux.

use super::logger::log_event;
use super::transport::SutoTransport;
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4, TcpStream, ToSocketAddrs, UdpSocket};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredEthernetDevice {
    pub ip: String,
    pub mac: String,
    pub device_number: u8,
    pub port: u16,
}

/// SUTO CSLib UDP Ethernet Broadcast Auto-Discovery
///
/// Sends CSLib broadcast command `A1 15 02 00 00 FF` to port 8800 on `255.255.255.255`
/// and any specific subnet broadcast, listening for returning 25-byte identification packets.
pub fn discover_ethernet_broadcast(
    timeout_ms: u64,
    subnet_broadcast: Option<String>,
) -> Result<Vec<DiscoveredEthernetDevice>, String> {
    const IPORT_BROADCAST_PORT: u16 = 8800;
    // CSLib initIPortBraodcastComm() [161, 21, 2, 0, 0, 255]
    const IPORT_BROADCAST_CMD: [u8; 6] = [0xA1, 0x15, 0x02, 0x00, 0x00, 0xFF];

    log_event(
        "INFO",
        "UDP_DISC",
        &format!(
            "Broadcasting CSLib query [A1 15 02 00 00 FF] to port {} (timeout: {}ms)...",
            IPORT_BROADCAST_PORT, timeout_ms
        ),
        Some(&IPORT_BROADCAST_CMD),
    );

    // CSLib uses LOCAL_DATAGRAM_PORT = 6789. Try binding to 6789 first, fallback to ephemeral port 0.
    let socket = UdpSocket::bind("0.0.0.0:6789")
        .or_else(|_| UdpSocket::bind("0.0.0.0:0"))
        .map_err(|e| format!("Failed to bind UDP socket for broadcast: {}", e))?;

    socket
        .set_broadcast(true)
        .map_err(|e| format!("Failed to enable UDP broadcast: {}", e))?;

    socket
        .set_read_timeout(Some(Duration::from_millis(250)))
        .map_err(|e| format!("Failed to set read timeout: {}", e))?;

    // Send to global broadcast 255.255.255.255:8800
    let global_target = SocketAddrV4::new(Ipv4Addr::new(255, 255, 255, 255), IPORT_BROADCAST_PORT);
    let _ = socket.send_to(&IPORT_BROADCAST_CMD, global_target);

    // If specific subnet broadcast provided (e.g. 192.168.5.255:8800), send there too
    if let Some(ref sub_bc) = subnet_broadcast {
        let host = sub_bc.trim();
        if !host.is_empty() {
            let target_str = if host.contains(':') {
                host.to_string()
            } else {
                format!("{}:{}", host, IPORT_BROADCAST_PORT)
            };
            if let Ok(addrs) = target_str.to_socket_addrs() {
                for addr in addrs {
                    let _ = socket.send_to(&IPORT_BROADCAST_CMD, addr);
                }
            }
        }
    }

    let start_time = std::time::Instant::now();
    let total_timeout = Duration::from_millis(timeout_ms.max(1200));
    let mut discovered: Vec<DiscoveredEthernetDevice> = Vec::new();
    let mut seen_ips = std::collections::HashSet::new();

    let mut buf = [0u8; 1024];
    while start_time.elapsed() < total_timeout {
        match socket.recv_from(&mut buf) {
            Ok((len, src)) => {
                log_event(
                    "DEBUG",
                    "UDP_RX",
                    &format!("Received {} bytes from UDP sender {}", len, src),
                    Some(&buf[..len]),
                );

                // CSLib response packet format (25 bytes):
                // 00 02 00 02 MAC(6 bytes) A1 FD 00 09 deviceNumber(1 byte) 01 09 IP(4 bytes) 0B BB 00 FF
                let mut ip_str = src.ip().to_string();
                let mut mac_str = String::new();
                let mut dev_num = 0u8;

                if len >= 10 {
                    mac_str = format!(
                        "{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
                        buf[4], buf[5], buf[6], buf[7], buf[8], buf[9]
                    );
                }
                if len > 14 {
                    dev_num = buf[14];
                }
                if len >= 21 {
                    let ip0 = buf[17];
                    let ip1 = buf[18];
                    let ip2 = buf[19];
                    let ip3 = buf[20];
                    if ip0 != 0 {
                        let payload_ip = format!("{}.{}.{}.{}", ip0, ip1, ip2, ip3);
                        if payload_ip != "0.0.0.0" {
                            ip_str = payload_ip;
                        }
                    }
                }

                if !seen_ips.contains(&ip_str) {
                    seen_ips.insert(ip_str.clone());
                    log_event(
                        "INFO",
                        "UDP_DISC",
                        &format!(
                            "🎉 Discovered SUTO Ethernet device: IP={} MAC={} DeviceNumber={}",
                            ip_str, mac_str, dev_num
                        ),
                        None,
                    );
                    discovered.push(DiscoveredEthernetDevice {
                        ip: ip_str,
                        mac: mac_str,
                        device_number: dev_num,
                        port: 502,
                    });
                }
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut || e.kind() == std::io::ErrorKind::WouldBlock => {
                // Timeout slice reached, continue listening until total_timeout
                continue;
            }
            Err(e) => {
                log_event("WARN", "UDP_RX", &format!("UDP recv error: {}", e), None);
                break;
            }
        }
    }

    log_event(
        "INFO",
        "UDP_DISC",
        &format!("CSLib broadcast finished: discovered {} device(s)", discovered.len()),
        None,
    );

    Ok(discovered)
}

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
