//! SUTO Modbus Engine (RTU & TCP)
//!
//! Provides Modbus protocol framing, CRC-16 computation, and register reading
//! over TCP socket (Port 502 / gateway) or serial RTU.
//! Conforms to legacy Java core (MathUtil, ModbusCommands, ModbusUtil, CSModbusProtocolAdapter).

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicU16, Ordering};
use std::time::Duration;

use super::logger::log_event;

static MODBUS_TRANS_ID: AtomicU16 = AtomicU16::new(1);

fn next_trans_id() -> u16 {
    let mut id = MODBUS_TRANS_ID.fetch_add(1, Ordering::SeqCst);
    if id == 0 {
        id = MODBUS_TRANS_ID.fetch_add(1, Ordering::SeqCst);
    }
    id
}

pub const AUCH_CRC_HI: [u8; 256] = [
    0, 193, 129, 64, 1, 192, 128, 65, 1, 192, 128, 65, 0, 193, 129, 64, 1, 192, 128, 65,
    0, 193, 129, 64, 0, 193, 129, 64, 1, 192, 128, 65, 1, 192, 128, 65, 0, 193, 129, 64,
    0, 193, 129, 64, 1, 192, 128, 65, 0, 193, 129, 64, 1, 192, 128, 65, 1, 192, 128, 65,
    0, 193, 129, 64, 1, 192, 128, 65, 0, 193, 129, 64, 0, 193, 129, 64, 1, 192, 128, 65,
    0, 193, 129, 64, 1, 192, 128, 65, 1, 192, 128, 65, 0, 193, 129, 64, 0, 193, 129, 64,
    1, 192, 128, 65, 1, 192, 128, 65, 0, 193, 129, 64, 1, 192, 128, 65, 0, 193, 129, 64,
    0, 193, 129, 64, 1, 192, 128, 65, 1, 192, 128, 65, 0, 193, 129, 64, 0, 193, 129, 64,
    1, 192, 128, 65, 0, 193, 129, 64, 1, 192, 128, 65, 1, 192, 128, 65, 0, 193, 129, 64,
    0, 193, 129, 64, 1, 192, 128, 65, 1, 192, 128, 65, 0, 193, 129, 64, 1, 192, 128, 65,
    0, 193, 129, 64, 0, 193, 129, 64, 1, 192, 128, 65, 0, 193, 129, 64, 1, 192, 128, 65,
    1, 192, 128, 65, 0, 193, 129, 64, 1, 192, 128, 65, 0, 193, 129, 64, 0, 193, 129, 64,
    1, 192, 128, 65, 1, 192, 128, 65, 0, 193, 129, 64, 0, 193, 129, 64, 1, 192, 128, 65,
    0, 193, 129, 64, 1, 192, 128, 65, 1, 192, 128, 65, 0, 193, 129, 64,
];

pub const AUCH_CRC_LO: [u8; 256] = [
    0, 192, 193, 1, 195, 3, 2, 194, 198, 6, 7, 199, 5, 197, 196, 4, 204, 12, 13, 205,
    15, 207, 206, 14, 10, 202, 203, 11, 201, 9, 8, 200, 216, 24, 25, 217, 27, 219, 218, 26,
    30, 222, 223, 31, 221, 29, 28, 220, 20, 212, 213, 21, 215, 23, 22, 214, 210, 18, 19, 211,
    17, 209, 208, 16, 240, 48, 49, 241, 51, 243, 242, 50, 54, 246, 247, 55, 245, 53, 52, 244,
    60, 252, 253, 61, 255, 63, 62, 254, 250, 58, 59, 251, 57, 249, 248, 56, 40, 232, 233, 41,
    235, 43, 42, 234, 238, 46, 47, 239, 45, 237, 236, 44, 228, 36, 37, 229, 39, 231, 230, 38,
    34, 226, 227, 35, 225, 33, 32, 224, 160, 96, 97, 161, 99, 163, 162, 98, 102, 166, 167, 103,
    165, 101, 100, 164, 108, 172, 173, 109, 175, 111, 110, 174, 170, 106, 107, 171, 105, 169, 168, 104,
    120, 184, 185, 121, 187, 123, 122, 186, 190, 126, 127, 191, 125, 189, 188, 124, 180, 116, 117, 181,
    119, 183, 182, 118, 114, 178, 179, 115, 177, 113, 112, 176, 80, 144, 145, 81, 147, 83, 82, 146,
    150, 86, 87, 151, 85, 149, 148, 84, 156, 92, 93, 157, 95, 159, 158, 94, 90, 154, 155, 91,
    153, 89, 88, 152, 136, 72, 73, 137, 75, 139, 138, 74, 78, 142, 143, 79, 141, 77, 76, 140,
    68, 132, 133, 69, 135, 71, 70, 134, 130, 66, 67, 131, 65, 129, 128, 64,
];

pub fn calculate_crc16(data: &[u8]) -> (u8, u8) {
    let mut crc_lo = 255u8;
    let mut crc_hi = 255u8;
    for &byte in data {
        let u_index = (crc_lo ^ byte) as usize;
        crc_lo = crc_hi ^ AUCH_CRC_HI[u_index];
        crc_hi = AUCH_CRC_LO[u_index];
    }
    (crc_lo, crc_hi)
}

pub fn format_modbus_exception(code: u8) -> &'static str {
    match code {
        1 => "Illegal Function (FC not supported)",
        2 => "Illegal Data Address (Register address out of range)",
        3 => "Illegal Data Value (Data value or register count invalid)",
        4 => "Slave Device Failure (Unrecoverable device error)",
        5 => "Acknowledge (Operation in progress)",
        6 => "Slave Device Busy (Retry later)",
        7 => "Negative Acknowledge",
        8 => "Memory Parity Error",
        10 => "Gateway Path Unavailable",
        11 => "Gateway Target Device Failed to Respond",
        _ => "Unknown Modbus Exception",
    }
}

/// Connect to a Modbus TCP device, execute Read Registers (FC 03 / 04), and return the data bytes
pub fn read_modbus_tcp_registers(
    host: &str,
    port: u16,
    slave_id: u8,
    func_code: u8,
    reg_addr: u16,
    reg_count: u16,
    timeout_ms: u64,
) -> Result<Vec<u8>, String> {
    let addr_str = format!("{}:{}", host, port);
    let addrs: Vec<SocketAddr> = addr_str
        .to_socket_addrs()
        .map_err(|e| format!("Invalid host/port '{}': {}", addr_str, e))?
        .collect();

    if addrs.is_empty() {
        return Err(format!("Unable to resolve address: {}", addr_str));
    }

    let mut stream = TcpStream::connect_timeout(&addrs[0], Duration::from_millis(timeout_ms.min(3000)))
        .map_err(|e| format!("Failed to connect to Modbus TCP {}: {}", addr_str, e))?;

    let timeout = Duration::from_millis(timeout_ms.max(1000));
    stream.set_read_timeout(Some(timeout)).map_err(|e| e.to_string())?;
    stream.set_write_timeout(Some(Duration::from_millis(1500))).map_err(|e| e.to_string())?;
    let _ = stream.set_nodelay(true);

    let trans_id = next_trans_id();
    // Build Modbus TCP request (12 bytes)
    let mut req = [0u8; 12];
    req[0] = (trans_id >> 8) as u8;
    req[1] = trans_id as u8;
    req[2] = 0; // Protocol ID
    req[3] = 0;
    req[4] = 0; // Length = 6
    req[5] = 6;
    req[6] = slave_id;
    req[7] = func_code;
    req[8] = (reg_addr >> 8) as u8;
    req[9] = reg_addr as u8;
    req[10] = (reg_count >> 8) as u8;
    req[11] = reg_count as u8;

    log_event(
        "DEBUG",
        "MODBUS_TX",
        &format!("Modbus TCP TX to {}: trans_id={}, unit={}, fc={}, addr={}, cnt={}", addr_str, trans_id, slave_id, func_code, reg_addr, reg_count),
        Some(&req),
    );

    stream.write_all(&req).map_err(|e| format!("Modbus TCP write error: {}", e))?;
    stream.flush().map_err(|e| format!("Modbus TCP flush error: {}", e))?;

    // Read MBAP header: 6 bytes
    let mut mbap = [0u8; 6];
    stream.read_exact(&mut mbap).map_err(|e| format!("Modbus TCP read MBAP error: {}", e))?;

    let rx_trans_id = u16::from_be_bytes([mbap[0], mbap[1]]);
    let remaining_len = u16::from_be_bytes([mbap[4], mbap[5]]) as usize;

    if remaining_len < 2 || remaining_len > 300 {
        return Err(format!("Invalid Modbus TCP length in response: {}", remaining_len));
    }

    let mut pdu = vec![0u8; remaining_len];
    stream.read_exact(&mut pdu).map_err(|e| format!("Modbus TCP read PDU error: {}", e))?;

    log_event(
        "DEBUG",
        "MODBUS_RX",
        &format!("Modbus TCP RX from {}: trans_id={}, pdu_len={}", addr_str, rx_trans_id, remaining_len),
        Some(&pdu),
    );

    let rx_unit = pdu[0];
    if slave_id != 0 && slave_id != 255 && rx_unit != 0 && rx_unit != 255 && rx_unit != slave_id {
        return Err(format!("Modbus Unit ID mismatch: expected {}, got {}", slave_id, rx_unit));
    }
    let rx_fc = pdu[1];

    if (rx_fc & 0x80) != 0 {
        let ex_code = if pdu.len() > 2 { pdu[2] } else { 0 };
        return Err(format!("Modbus Exception (0x{:02X}): {}", rx_fc, format_modbus_exception(ex_code)));
    }

    if rx_fc != func_code {
        return Err(format!("Modbus Function Code mismatch: expected {}, got {}", func_code, rx_fc));
    }

    let byte_count = pdu[2] as usize;
    if pdu.len() < 3 + byte_count {
        return Err(format!("Incomplete Modbus TCP register payload: expected {} bytes, got {}", byte_count, pdu.len() - 3));
    }

    Ok(pdu[3..3 + byte_count].to_vec())
}

/// Connect to a Modbus RTU device over TCP gateway (or raw serial)
pub fn read_modbus_rtu_registers(
    host: &str,
    port: u16,
    slave_id: u8,
    func_code: u8,
    reg_addr: u16,
    reg_count: u16,
    timeout_ms: u64,
) -> Result<Vec<u8>, String> {
    let addr_str = format!("{}:{}", host, port);
    let addrs: Vec<SocketAddr> = addr_str
        .to_socket_addrs()
        .map_err(|e| format!("Invalid host/port '{}': {}", addr_str, e))?
        .collect();

    if addrs.is_empty() {
        return Err(format!("Unable to resolve address: {}", addr_str));
    }

    let mut stream = TcpStream::connect_timeout(&addrs[0], Duration::from_millis(timeout_ms.min(3000)))
        .map_err(|e| format!("Failed to connect to Modbus RTU gateway {}: {}", addr_str, e))?;

    let timeout = Duration::from_millis(timeout_ms.max(1000));
    stream.set_read_timeout(Some(timeout)).map_err(|e| e.to_string())?;
    stream.set_write_timeout(Some(Duration::from_millis(1500))).map_err(|e| e.to_string())?;
    let _ = stream.set_nodelay(true);

    // Build Modbus RTU request (8 bytes)
    let mut req = [0u8; 8];
    req[0] = slave_id;
    req[1] = func_code;
    req[2] = (reg_addr >> 8) as u8;
    req[3] = reg_addr as u8;
    req[4] = (reg_count >> 8) as u8;
    req[5] = reg_count as u8;
    let (crc_lo, crc_hi) = calculate_crc16(&req[0..6]);
    req[6] = crc_lo;
    req[7] = crc_hi;

    stream.write_all(&req).map_err(|e| format!("Modbus RTU write error: {}", e))?;
    stream.flush().map_err(|e| format!("Modbus RTU flush error: {}", e))?;

    let expected_data_len = (reg_count as usize) * 2;
    let expected_total_len = 3 + expected_data_len + 2; // slave + fc + count + data + 2 crc

    let mut buf = vec![0u8; expected_total_len.max(5)];
    let mut total_read = 0;
    let start = std::time::Instant::now();
    let read_limit = Duration::from_millis(timeout_ms.max(1200));

    while total_read < buf.len() && start.elapsed() < read_limit {
        match stream.read(&mut buf[total_read..]) {
            Ok(0) => break,
            Ok(n) => total_read += n,
            Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut || e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(10));
            }
            Err(e) => return Err(format!("Modbus RTU read error: {}", e)),
        }
    }

    if total_read < 5 {
        return Err(format!("Modbus RTU response too short ({} bytes)", total_read));
    }

    let resp = &buf[..total_read];
    let (calc_lo, calc_hi) = calculate_crc16(&resp[..resp.len() - 2]);
    if calc_lo != resp[resp.len() - 2] || calc_hi != resp[resp.len() - 1] {
        return Err("Modbus RTU CRC verification failed".to_string());
    }

    let rx_fc = resp[1];
    if (rx_fc & 0x80) != 0 {
        let ex_code = resp[2];
        return Err(format!("Modbus RTU Exception (0x{:02X}): {}", rx_fc, format_modbus_exception(ex_code)));
    }

    let byte_count = resp[2] as usize;
    if resp.len() < 3 + byte_count + 2 {
        return Err(format!("Incomplete Modbus RTU response: expected {} bytes, got {}", byte_count, resp.len() - 5));
    }

    Ok(resp[3..3 + byte_count].to_vec())
}

#[tauri::command]
pub async fn suto_read_modbus_registers(
    host: String,
    port: u16,
    slave_id: u8,
    func_code: u8,
    reg_addr: u16,
    reg_count: u16,
    is_rtu: Option<bool>,
    timeout_ms: Option<u64>,
) -> Result<Vec<u8>, String> {
    let t_ms = timeout_ms.unwrap_or(2500);
    if is_rtu.unwrap_or(false) {
        read_modbus_rtu_registers(&host, port, slave_id, func_code, reg_addr, reg_count, t_ms)
    } else {
        read_modbus_tcp_registers(&host, port, slave_id, func_code, reg_addr, reg_count, t_ms)
    }
}

pub fn calculate_csbus_checksum(data: &[u8]) -> u8 {
    let mut total: u16 = 0;
    for &b in data {
        total = total.wrapping_add(b as u16);
    }
    let sum = total as u8;
    (!sum).wrapping_add(1)
}

pub fn pack_csbus_packet(address: u8, net_data: &[u8]) -> Vec<u8> {
    let total_len = (net_data.len() + 4) as u8;
    let mut packet = Vec::with_capacity(total_len as usize);
    packet.push(address);
    packet.push(total_len);
    packet.extend_from_slice(net_data);
    let checksum = calculate_csbus_checksum(&packet);
    packet.push(checksum);
    packet.push(0x00);
    packet
}

pub fn unpack_csbus_packet(packet: &[u8]) -> Result<Vec<u8>, String> {
    if packet.len() < 5 {
        return Ok(packet.to_vec());
    }
    let total_len = packet[1] as usize;
    if packet.len() < total_len || total_len < 5 {
        return Ok(packet.to_vec());
    }
    let calc_check = calculate_csbus_checksum(&packet[..total_len - 2]);
    if calc_check != packet[total_len - 2] {
        return Err("CS-Bus checksum verification failed".to_string());
    }
    let status_char = packet[2];
    if status_char == 0x3E {
        // Status '>' indicating success, return inner data
        Ok(packet[3..total_len - 2].to_vec())
    } else {
        Ok(packet[2..total_len - 2].to_vec())
    }
}

/// Exchange a SUTO CS-Bus packet over Modbus TCP (FC 71) gateway
pub fn exchange_cs_modbus_tcp(
    host: &str,
    port: u16,
    slave_id: u8,
    cs_packet: &[u8],
    timeout_ms: u64,
) -> Result<Vec<u8>, String> {
    let addr_str = format!("{}:{}", host, port);
    let addrs: Vec<SocketAddr> = addr_str
        .to_socket_addrs()
        .map_err(|e| format!("Invalid host/port '{}': {}", addr_str, e))?
        .collect();

    if addrs.is_empty() {
        return Err(format!("Unable to resolve address: {}", addr_str));
    }

    let mut stream = TcpStream::connect_timeout(&addrs[0], Duration::from_millis(timeout_ms.min(3000)))
        .map_err(|e| format!("Failed to connect to Modbus TCP {}: {}", addr_str, e))?;

    let timeout = Duration::from_millis(timeout_ms.max(1000));
    stream.set_read_timeout(Some(timeout)).map_err(|e| e.to_string())?;
    stream.set_write_timeout(Some(Duration::from_millis(1500))).map_err(|e| e.to_string())?;
    let _ = stream.set_nodelay(true);

    let trans_id = next_trans_id();

    // Frame command payload into SUTO CS-Bus packet: [device_addr, total_len, cmd..., checksum, 0x00]
    let cs_pkg = if cs_packet.len() >= 5
        && cs_packet[1] as usize == cs_packet.len()
        && cs_packet[cs_packet.len() - 1] == 0x00
        && calculate_csbus_checksum(&cs_packet[..cs_packet.len() - 2]) == cs_packet[cs_packet.len() - 2]
    {
        cs_packet.to_vec()
    } else {
        pack_csbus_packet(slave_id, cs_packet)
    };

    let cs_len = cs_pkg.len();
    let pdu_len = 3 + cs_len; // unit_id (1) + fc (1) + len (1) + cs_payload

    let mut req = Vec::with_capacity(6 + pdu_len);
    req.push((trans_id >> 8) as u8);
    req.push(trans_id as u8);
    req.push(0); // Protocol ID 0
    req.push(0);
    req.push((pdu_len >> 8) as u8);
    req.push(pdu_len as u8);
    req.push(slave_id);
    req.push(71); // FC 71 (CSModbus TCP)
    req.push((cs_len & 0xFF) as u8);
    req.extend_from_slice(&cs_pkg);

    log_event(
        "DEBUG",
        "CSMODBUS_TX",
        &format!("CSModbus TCP TX to {}: trans_id={}, unit={}, cs_len={}", addr_str, trans_id, slave_id, cs_len),
        Some(&req),
    );

    stream.write_all(&req).map_err(|e| format!("CSModbus TCP write error: {}", e))?;
    stream.flush().map_err(|e| format!("CSModbus TCP flush error: {}", e))?;

    // Read MBAP header: 6 bytes
    let mut mbap = [0u8; 6];
    stream.read_exact(&mut mbap).map_err(|e| format!("CSModbus TCP read MBAP error: {}", e))?;

    let rx_trans_id = u16::from_be_bytes([mbap[0], mbap[1]]);
    let remaining_len = u16::from_be_bytes([mbap[4], mbap[5]]) as usize;

    if remaining_len < 2 || remaining_len > 4096 {
        return Err(format!("Invalid CSModbus TCP length in response: {}", remaining_len));
    }

    let mut pdu = vec![0u8; remaining_len];
    stream.read_exact(&mut pdu).map_err(|e| format!("CSModbus TCP read PDU error: {}", e))?;

    log_event(
        "DEBUG",
        "CSMODBUS_RX",
        &format!("CSModbus TCP RX from {}: trans_id={}, pdu_len={}", addr_str, rx_trans_id, remaining_len),
        Some(&pdu),
    );

    let rx_fc = pdu[1];
    if (rx_fc & 0x80) != 0 {
        let ex_code = if pdu.len() > 2 { pdu[2] } else { 0 };
        return Err(format!("Modbus Exception (0x{:02X}): {}", rx_fc, format_modbus_exception(ex_code)));
    }

    if rx_fc != 71 {
        return Err(format!("CSModbus FC mismatch: expected 71, got {}", rx_fc));
    }

    if pdu.len() < 3 {
        return Err("CSModbus response too short".to_string());
    }

    let raw_cs = &pdu[3..];
    unpack_csbus_packet(raw_cs)
}

/// Exchange a SUTO CS-Bus packet over Modbus RTU (FC 70) gateway
pub fn exchange_cs_modbus_rtu(
    host: &str,
    port: u16,
    slave_id: u8,
    cs_packet: &[u8],
    timeout_ms: u64,
) -> Result<Vec<u8>, String> {
    let addr_str = format!("{}:{}", host, port);
    let addrs: Vec<SocketAddr> = addr_str
        .to_socket_addrs()
        .map_err(|e| format!("Invalid host/port '{}': {}", addr_str, e))?
        .collect();

    if addrs.is_empty() {
        return Err(format!("Unable to resolve address: {}", addr_str));
    }

    let mut stream = TcpStream::connect_timeout(&addrs[0], Duration::from_millis(timeout_ms.min(3000)))
        .map_err(|e| format!("Failed to connect to Modbus RTU gateway {}: {}", addr_str, e))?;

    let timeout = Duration::from_millis(timeout_ms.max(1000));
    stream.set_read_timeout(Some(timeout)).map_err(|e| e.to_string())?;
    stream.set_write_timeout(Some(Duration::from_millis(1500))).map_err(|e| e.to_string())?;
    let _ = stream.set_nodelay(true);

    let cs_pkg = if cs_packet.len() >= 5
        && cs_packet[1] as usize == cs_packet.len()
        && cs_packet[cs_packet.len() - 1] == 0x00
        && calculate_csbus_checksum(&cs_packet[..cs_packet.len() - 2]) == cs_packet[cs_packet.len() - 2]
    {
        cs_packet.to_vec()
    } else {
        pack_csbus_packet(slave_id, cs_packet)
    };

    let cs_len = cs_pkg.len();
    let mut req = Vec::with_capacity(3 + cs_len + 2);
    req.push(slave_id);
    req.push(70); // FC 70 (CSModbus RTU)
    req.push((cs_len & 0xFF) as u8);
    req.extend_from_slice(&cs_pkg);
    let (crc_lo, crc_hi) = calculate_crc16(&req);
    req.push(crc_lo);
    req.push(crc_hi);

    log_event(
        "DEBUG",
        "CSMODBUS_RTU_TX",
        &format!("CSModbus RTU TX to {}: unit={}, cs_len={}", addr_str, slave_id, cs_len),
        Some(&req),
    );

    stream.write_all(&req).map_err(|e| format!("CSModbus RTU write error: {}", e))?;
    stream.flush().map_err(|e| format!("CSModbus RTU flush error: {}", e))?;

    let mut buf = vec![0u8; 1024];
    let mut total_read = 0;
    let start = std::time::Instant::now();
    let read_limit = Duration::from_millis(timeout_ms.max(1500));

    while start.elapsed() < read_limit {
        match stream.read(&mut buf[total_read..]) {
            Ok(0) => break,
            Ok(n) => {
                total_read += n;
                // Minimum valid CSModbus RTU frame is 5 bytes (slave + fc + len + data + 2 crc)
                if total_read >= 5 {
                    let data_len = buf[2] as usize;
                    if total_read >= 3 + data_len + 2 {
                        break;
                    }
                }
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut || e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(10));
            }
            Err(e) => return Err(format!("CSModbus RTU read error: {}", e)),
        }
    }

    if total_read < 5 {
        return Err(format!("CSModbus RTU response too short ({} bytes)", total_read));
    }

    let resp = &buf[..total_read];
    let (calc_lo, calc_hi) = calculate_crc16(&resp[..resp.len() - 2]);
    if calc_lo != resp[resp.len() - 2] || calc_hi != resp[resp.len() - 1] {
        return Err("CSModbus RTU CRC verification failed".to_string());
    }

    let rx_fc = resp[1];
    if (rx_fc & 0x80) != 0 {
        let ex_code = resp[2];
        return Err(format!("CSModbus RTU Exception (0x{:02X}): {}", rx_fc, format_modbus_exception(ex_code)));
    }

    if rx_fc != 70 {
        return Err(format!("CSModbus RTU FC mismatch: expected 70, got {}", rx_fc));
    }

    let payload_len = resp[2] as usize;
    if resp.len() < 3 + payload_len + 2 {
        return Err("Incomplete CSModbus RTU payload".to_string());
    }

    let raw_cs = &resp[3..3 + payload_len];
    unpack_csbus_packet(raw_cs)
}

#[tauri::command]
pub async fn suto_exchange_cs_modbus(
    host: String,
    port: u16,
    slave_id: u8,
    cs_packet: Vec<u8>,
    is_rtu: Option<bool>,
    timeout_ms: Option<u64>,
) -> Result<Vec<u8>, String> {
    let t_ms = timeout_ms.unwrap_or(2500);
    if is_rtu.unwrap_or(false) {
        exchange_cs_modbus_rtu(&host, port, slave_id, &cs_packet, t_ms)
    } else {
        exchange_cs_modbus_tcp(&host, port, slave_id, &cs_packet, t_ms)
    }
}
