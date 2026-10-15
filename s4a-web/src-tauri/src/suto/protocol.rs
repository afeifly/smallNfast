//! SUTO / CS-Bus Protocol Framing & Checksum Implementation
//!
//! Handles packet assembly, two's complement checksum calculation,
//! response validation, and multi-frame reassembly.

pub const COMM_HEADER_LENGTH: usize = 2;
pub const COMM_TAIL_LENGTH: usize = 2;
pub const COMM_SUCCESSFUL_CHAR: u8 = 0x3E; // '>' (62)
pub const COMM_CHECKSUM_ERROR_BYTE: u8 = 0x01;
pub const COMM_INVALID_COMMAND_BYTE: u8 = 0x3F; // '?' (63)

/// Calculate SUTO two's complement checksum over `length` bytes:
/// `(((sum ^ 0xFF) + 1) & 0xFF)`
pub fn calculate_checksum(data: &[u8], length: usize) -> u8 {
    let mut total: u32 = 0;
    let len = length.min(data.len());
    for &b in &data[..len] {
        total = (total + b as u32) & 0xFF;
    }
    let inverted = total ^ 0xFF;
    ((inverted + 1) & 0xFF) as u8
}

/// Pack a net data payload into a framed CS-Bus/SUTO packet:
/// `[address, total_len, payload..., checksum, 0x00]`
pub fn pack_packet(address: u8, payload: &[u8]) -> Vec<u8> {
    let total_len = payload.len() + COMM_HEADER_LENGTH + COMM_TAIL_LENGTH;
    assert!(total_len <= 255, "Packet total length cannot exceed 255 bytes");

    let mut packet = Vec::with_capacity(total_len);
    packet.push(address);
    packet.push(total_len as u8);
    packet.extend_from_slice(payload);

    let cksum = calculate_checksum(&packet, packet.len());
    packet.push(cksum);
    packet.push(0x00);
    packet
}

/// Unpack a single-frame response.
/// Verifies length, checksum, and status byte (`0x3E`).
/// Returns the payload slice without headers, status byte, and checksum trailer.
pub fn parse_single_frame(frame: &[u8]) -> Result<Vec<u8>, String> {
    if frame.len() < COMM_HEADER_LENGTH + COMM_TAIL_LENGTH + 1 {
        return Err(format!(
            "Frame too short: got {} bytes, minimum is {}",
            frame.len(),
            COMM_HEADER_LENGTH + COMM_TAIL_LENGTH + 1
        ));
    }

    let expected_len = frame[1] as usize;
    if frame.len() < expected_len {
        return Err(format!(
            "Incomplete frame: expected {} bytes from length header, but only have {}",
            expected_len,
            frame.len()
        ));
    }

    let cksum_idx = expected_len - COMM_TAIL_LENGTH;
    let expected_cksum = calculate_checksum(frame, cksum_idx);
    let actual_cksum = frame[cksum_idx];

    if actual_cksum != expected_cksum {
        return Err(format!(
            "Checksum mismatch: expected 0x{:02X}, got 0x{:02X}",
            expected_cksum, actual_cksum
        ));
    }

    let status = frame[COMM_HEADER_LENGTH];
    match status {
        COMM_SUCCESSFUL_CHAR => {
            // Status is '>' (0x3E), valid response
            let payload_start = COMM_HEADER_LENGTH + 1;
            let payload_end = expected_len - COMM_TAIL_LENGTH;
            Ok(frame[payload_start..payload_end].to_vec())
        }
        COMM_CHECKSUM_ERROR_BYTE => Err("Device reported our checksum was invalid (0x01)".into()),
        COMM_INVALID_COMMAND_BYTE => Err("Device reported invalid command (0x3F '?')".into()),
        other => Err(format!("Device returned error status: 0x{:02X}", other)),
    }
}

/// Deframe multi-frame replies (192-byte frames).
///
/// Frame 0: `[addr][len][0x3E][payload...][checksum][0x00]` (up to 188 bytes data)
/// Frame 1..n: `[addr][len][payload...][checksum][0x00]` (no status byte)
pub fn deframe_multi_frame(raw_bytes: &[u8]) -> Result<Vec<u8>, String> {
    if raw_bytes.len() < COMM_HEADER_LENGTH + COMM_TAIL_LENGTH + 1 {
        return Err("Data too short for deframing".into());
    }

    // Check if it's a simple single-frame response (length <= 255 and matches first frame)
    let first_frame_len = raw_bytes[1] as usize;
    if raw_bytes.len() == first_frame_len {
        return parse_single_frame(raw_bytes);
    }

    let mut result = Vec::new();
    let mut offset = 0;
    let mut frame_idx = 0;

    while offset < raw_bytes.len() {
        if offset + COMM_HEADER_LENGTH > raw_bytes.len() {
            break;
        }

        let frame_len = raw_bytes[offset + 1] as usize;
        if frame_len < COMM_HEADER_LENGTH + COMM_TAIL_LENGTH {
            return Err(format!("Invalid frame length {} at offset {}", frame_len, offset));
        }

        let frame_end = offset + frame_len;
        if frame_end > raw_bytes.len() {
            return Err(format!(
                "Truncated frame {}: requires offset {}, but total length is {}",
                frame_idx, frame_end, raw_bytes.len()
            ));
        }

        let frame = &raw_bytes[offset..frame_end];
        let cksum_idx = frame_len - COMM_TAIL_LENGTH;
        let expected_cksum = calculate_checksum(frame, cksum_idx);
        let actual_cksum = frame[cksum_idx];

        if actual_cksum != expected_cksum {
            return Err(format!(
                "Frame {} checksum mismatch: expected 0x{:02X}, got 0x{:02X}",
                frame_idx, expected_cksum, actual_cksum
            ));
        }

        if frame_idx == 0 {
            // First frame contains the status byte
            let status = frame[COMM_HEADER_LENGTH];
            if status != COMM_SUCCESSFUL_CHAR {
                return Err(format!("Device returned error status: 0x{:02X}", status));
            }
            let payload_start = COMM_HEADER_LENGTH + 1;
            let payload_end = frame_len - COMM_TAIL_LENGTH;
            result.extend_from_slice(&frame[payload_start..payload_end]);
        } else {
            // Continuation frames have no status byte
            let payload_start = COMM_HEADER_LENGTH;
            let payload_end = frame_len - COMM_TAIL_LENGTH;
            result.extend_from_slice(&frame[payload_start..payload_end]);
        }

        offset = frame_end;
        frame_idx += 1;
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_checksum() {
        // [1, 5, 65] -> 1 + 5 + 65 = 71. 71 ^ 0xFF = 184. 184 + 1 = 185 (0xB9)
        let data = [0x01, 0x05, 0x41];
        let cksum = calculate_checksum(&data, 3);
        assert_eq!(cksum, ((71u32 ^ 0xFF) + 1) as u8);
    }

    #[test]
    fn test_pack_packet_and_parse_single_frame() {
        let payload = b"TEST";
        let pkt = pack_packet(1, payload);
        assert_eq!(pkt[0], 1); // address
        assert_eq!(pkt[1], 8); // 4 + 2 + 2 = 8
        assert_eq!(&pkt[2..6], b"TEST");
        assert_eq!(pkt[7], 0x00);

        // Simulate a valid response frame: [addr=1, len=9, status='>', T, E, S, T, cksum, 0]
        let mut resp_payload = vec![COMM_SUCCESSFUL_CHAR];
        resp_payload.extend_from_slice(b"TEST");
        let resp_frame = pack_packet(1, &resp_payload);

        let parsed = parse_single_frame(&resp_frame).expect("Should parse valid frame");
        assert_eq!(parsed, b"TEST");
    }

    #[test]
    fn test_parse_error_status() {
        let resp_payload = vec![COMM_INVALID_COMMAND_BYTE];
        let resp_frame = pack_packet(1, &resp_payload);
        let err = parse_single_frame(&resp_frame).unwrap_err();
        assert!(err.contains("invalid command"));
    }

    #[test]
    fn test_set_configuration_blob_spec() {
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
            b
        };
        assert_eq!(SET_CONFIGURATION_260.len(), 260);
        assert_eq!(SET_CONFIGURATION_260[0..4], [0x00, 0x00, 0x02, 0x00]);
        assert_eq!(SET_CONFIGURATION_260[4..12], [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00]);
        assert_eq!(SET_CONFIGURATION_260[12..20], [0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00]);
        assert_eq!(SET_CONFIGURATION_260[20], 0x00);
        assert_eq!(SET_CONFIGURATION_260[259], 0x00);
    }
}
