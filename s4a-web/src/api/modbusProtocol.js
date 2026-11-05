/**
 * modbusProtocol.js
 *
 * SUTO Modbus & CS-Bus Protocol Implementation.
 * Ported from legacy SUTO Java core:
 *  - MathUtil.java (CRC-16, LRC)
 *  - DataTypeConverter.java (Types 1-8: INT16, UINT16, INT32, INT32_SWAP, UINT32, UINT32_SWAP, FLOAT32, FLOAT32_SWAP)
 *  - ModbusUtil.java (Exception codes 1-11)
 *  - ModbusRTUProtocolAdapter.java & ModbusTCPProtocolAdapter.java (FC 03, FC 04, FC 06, FC 16)
 *  - CSModbusProtocolAdapter.java (FC 70 RTU & FC 71 TCP CS-Bus gateway)
 *  - GetOnLineMeasureValueActionExecutor.java (Scaling, a1, a0, bitwise config, errorValue checking)
 *  - CSCommChannelSetting.java (204-byte Little-Endian channel configuration struct)
 */

// ==========================================
// 1. MathUtil: CRC-16 & LRC Lookup Tables
// ==========================================

export const auchCRCHi = new Uint8Array([
  0, 193, 129, 64, 1, 192, 128, 65, 1, 192,
  128, 65, 0, 193, 129, 64, 1, 192, 128, 65,
  0, 193, 129, 64, 0, 193, 129, 64, 1, 192,
  128, 65, 1, 192, 128, 65, 0, 193, 129, 64,
  0, 193, 129, 64, 1, 192, 128, 65, 0, 193,
  129, 64, 1, 192, 128, 65, 1, 192, 128, 65,
  0, 193, 129, 64, 1, 192, 128, 65, 0, 193,
  129, 64, 0, 193, 129, 64, 1, 192, 128, 65,
  0, 193, 129, 64, 1, 192, 128, 65, 1, 192,
  128, 65, 0, 193, 129, 64, 0, 193, 129, 64,
  1, 192, 128, 65, 1, 192, 128, 65, 0, 193,
  129, 64, 1, 192, 128, 65, 0, 193, 129, 64,
  0, 193, 129, 64, 1, 192, 128, 65, 1, 192,
  128, 65, 0, 193, 129, 64, 0, 193, 129, 64,
  1, 192, 128, 65, 0, 193, 129, 64, 1, 192,
  128, 65, 1, 192, 128, 65, 0, 193, 129, 64,
  0, 193, 129, 64, 1, 192, 128, 65, 1, 192,
  128, 65, 0, 193, 129, 64, 1, 192, 128, 65,
  0, 193, 129, 64, 0, 193, 129, 64, 1, 192,
  128, 65, 0, 193, 129, 64, 1, 192, 128, 65,
  1, 192, 128, 65, 0, 193, 129, 64, 1, 192,
  128, 65, 0, 193, 129, 64, 0, 193, 129, 64,
  1, 192, 128, 65, 1, 192, 128, 65, 0, 193,
  129, 64, 0, 193, 129, 64, 1, 192, 128, 65,
  0, 193, 129, 64, 1, 192, 128, 65, 1, 192,
  128, 65, 0, 193, 129, 64
]);

export const auchCRCLo = new Uint8Array([
  0, 192, 193, 1, 195, 3, 2, 194, 198, 6,
  7, 199, 5, 197, 196, 4, 204, 12, 13, 205,
  15, 207, 206, 14, 10, 202, 203, 11, 201, 9,
  8, 200, 216, 24, 25, 217, 27, 219, 218, 26,
  30, 222, 223, 31, 221, 29, 28, 220, 20, 212,
  213, 21, 215, 23, 22, 214, 210, 18, 19, 211,
  17, 209, 208, 16, 240, 48, 49, 241, 51, 243,
  242, 50, 54, 246, 247, 55, 245, 53, 52, 244,
  60, 252, 253, 61, 255, 63, 62, 254, 250, 58,
  59, 251, 57, 249, 248, 56, 40, 232, 233, 41,
  235, 43, 42, 234, 238, 46, 47, 239, 45, 237,
  236, 44, 228, 36, 37, 229, 39, 231, 230, 38,
  34, 226, 227, 35, 225, 33, 32, 224, 160, 96,
  97, 161, 99, 163, 162, 98, 102, 166, 167, 103,
  165, 101, 100, 164, 108, 172, 173, 109, 175, 111,
  110, 174, 170, 106, 107, 171, 105, 169, 168, 104,
  120, 184, 185, 121, 187, 123, 122, 186, 190, 126,
  127, 191, 125, 189, 188, 124, 180, 116, 117, 181,
  119, 183, 182, 118, 114, 178, 179, 115, 177, 113,
  112, 176, 80, 144, 145, 81, 147, 83, 82, 146,
  150, 86, 87, 151, 85, 149, 148, 84, 156, 92,
  93, 157, 95, 159, 158, 94, 90, 154, 155, 91,
  153, 89, 88, 152, 136, 72, 73, 137, 75, 139,
  138, 74, 78, 142, 143, 79, 141, 77, 76, 140,
  68, 132, 133, 69, 135, 71, 70, 134, 130, 66,
  67, 131, 65, 129, 128, 64
]);

/**
 * Calculate Modbus RTU CRC-16 (MathUtil.calculateCRC)
 * @param {Uint8Array|Array<number>} data
 * @param {number} [offset=0]
 * @param {number} [len]
 * @returns {[number, number]} [crcLo, crcHi]
 */
export function calculateCRC(data, offset = 0, len = undefined) {
  const bytes = (data instanceof Uint8Array) ? data : new Uint8Array(data);
  const actualLen = len === undefined ? (bytes.length - offset) : len;
  let crcLo = 255;
  let crcHi = 255;
  const end = Math.min(offset + actualLen, bytes.length);

  for (let i = offset; i < end; i++) {
    const nextByte = bytes[i] & 0xFF;
    const uIndex = crcLo ^ nextByte;
    crcLo = crcHi ^ auchCRCHi[uIndex];
    crcHi = auchCRCLo[uIndex];
  }
  return [crcLo, crcHi];
}

/**
 * Calculate Modbus ASCII Longitudinal Redundancy Check (LRC)
 * @param {Uint8Array|Array<number>} data
 * @param {number} [offset=0]
 * @param {number} [len]
 * @returns {number} 8-bit unsigned LRC
 */
export function calculateLRC(data, offset = 0, len = undefined) {
  const bytes = (data instanceof Uint8Array) ? data : new Uint8Array(data);
  const actualLen = len === undefined ? (bytes.length - offset) : len;
  let lrc = 0;
  const end = Math.min(offset + actualLen, bytes.length);
  for (let i = offset; i < end; i++) {
    lrc += (bytes[i] & 0xFF);
  }
  lrc = ((lrc ^ 0xFF) + 1) & 0xFF;
  return lrc;
}

// ==========================================
// 2. Modbus Data Types & Converter
// ==========================================

export const MODBUS_DATA_TYPES = {
  1: { id: 1, name: 'INT16', registers: 1, bytes: 2, label: 'INT16' },
  2: { id: 2, name: 'UINT16', registers: 1, bytes: 2, label: 'UINT16' },
  3: { id: 3, name: 'INT32_B', registers: 2, bytes: 4, label: 'INT32_B' },
  4: { id: 4, name: 'INT32_L', registers: 2, bytes: 4, label: 'INT32_L' },
  5: { id: 5, name: 'UINT32_B', registers: 2, bytes: 4, label: 'UINT32_B' },
  6: { id: 6, name: 'UINT32_L', registers: 2, bytes: 4, label: 'UINT32_L' },
  7: { id: 7, name: 'FLOAT_B', registers: 2, bytes: 4, label: 'FLOAT_B' },
  8: { id: 8, name: 'FLOAT_L', registers: 2, bytes: 4, label: 'FLOAT_L' }
};

/**
 * Convert raw Modbus register bytes to double value (DataTypeConverter.modbusData2Double)
 * @param {number} type 1 to 8
 * @param {Uint8Array|Array<number>} byteArray
 * @param {number} [offset=0]
 * @returns {number}
 */
export function modbusData2Double(type, byteArray, offset = 0) {
  const bytes = (byteArray instanceof Uint8Array)
    ? byteArray
    : new Uint8Array(byteArray);

  const view = new DataView(bytes.buffer, bytes.byteOffset + offset);

  switch (type) {
    case 1: // INT16
      return view.getInt16(0, false); // Big Endian
    case 2: // UINT16
      return view.getUint16(0, false); // Big Endian
    case 3: // INT32 Big-Endian (ABCD)
      return view.getInt32(0, false);
    case 4: { // INT32 Word Swapped (CDAB)
      // Original bytes: [b0, b1, b2, b3] -> reorder to [b2, b3, b0, b1]
      const buf = new Uint8Array(4);
      buf[0] = bytes[offset + 2];
      buf[1] = bytes[offset + 3];
      buf[2] = bytes[offset + 0];
      buf[3] = bytes[offset + 1];
      const dv = new DataView(buf.buffer);
      return dv.getInt32(0, false);
    }
    case 5: // UINT32 Big-Endian (ABCD)
      return view.getUint32(0, false);
    case 6: { // UINT32 Word Swapped (CDAB)
      const buf = new Uint8Array(4);
      buf[0] = bytes[offset + 2];
      buf[1] = bytes[offset + 3];
      buf[2] = bytes[offset + 0];
      buf[3] = bytes[offset + 1];
      const dv = new DataView(buf.buffer);
      return dv.getUint32(0, false);
    }
    case 7: // FLOAT32 IEEE 754 Big-Endian (ABCD)
      return view.getFloat32(0, false);
    case 8: { // FLOAT32 IEEE 754 Word Swapped (CDAB)
      const buf = new Uint8Array(4);
      buf[0] = bytes[offset + 2];
      buf[1] = bytes[offset + 3];
      buf[2] = bytes[offset + 0];
      buf[3] = bytes[offset + 1];
      const dv = new DataView(buf.buffer);
      return dv.getFloat32(0, false);
    }
    default:
      return 0.0;
  }
}

// ==========================================
// 3. Modbus Exceptions (ModbusUtil.java)
// ==========================================

export const MODBUS_EXCEPTIONS = {
  1: 'Illegal Function (FC not supported by device)',
  2: 'Illegal Data Address (Register address out of range)',
  3: 'Illegal Data Value (Data value or register count invalid)',
  4: 'Slave Device Failure (Unrecoverable error in slave)',
  5: 'Acknowledge (Slave accepted request, processing taking time)',
  6: 'Slave Device Busy (Specialized command in progress, retry later)',
  7: 'Negative Acknowledge (Cannot perform program function)',
  8: 'Memory Parity Error (Extended memory parity check failed)',
  10: 'Gateway Path Unavailable (Modbus gateway misconfigured)',
  11: 'Gateway Target Device Failed to Respond (No response from target slave)'
};

export function getModbusExceptionMessage(code) {
  return MODBUS_EXCEPTIONS[code] || `Unknown Modbus Exception Code (${code})`;
}

// ==========================================
// 4. Packet Framing: Modbus RTU & TCP
// ==========================================

let globalTransId = 1;

export function getNextTransactionId() {
  globalTransId = (globalTransId + 1) & 0xFFFF;
  if (globalTransId === 0) globalTransId = 1;
  return globalTransId;
}

/**
 * Pack a Modbus RTU Read Request
 * [SlaveID (1B) + FuncCode (1B) + RegAddr (2B) + RegCount (2B) + CRC16 (2B)]
 * @param {number} slaveId 1-247
 * @param {number} funcCode 3 (Holding) or 4 (Input)
 * @param {number} regAddr 0-65535
 * @param {number} regCount 1 or 2
 * @returns {Uint8Array} 8 bytes
 */
export function packModbusRtuRead(slaveId, funcCode, regAddr, regCount) {
  const packet = new Uint8Array(8);
  packet[0] = slaveId & 0xFF;
  packet[1] = funcCode & 0xFF;
  packet[2] = (regAddr >> 8) & 0xFF;
  packet[3] = regAddr & 0xFF;
  packet[4] = (regCount >> 8) & 0xFF;
  packet[5] = regCount & 0xFF;
  const [crcLo, crcHi] = calculateCRC(packet, 0, 6);
  packet[6] = crcLo;
  packet[7] = crcHi;
  return packet;
}

/**
 * Parse a Modbus RTU Response
 * @param {Uint8Array|Array<number>} response
 * @param {number} expectedFuncCode
 * @returns {{ success: boolean, byteCount?: number, data?: Uint8Array, error?: string, exceptionCode?: number }}
 */
export function parseModbusRtuResponse(response, expectedFuncCode) {
  const res = (response instanceof Uint8Array) ? response : new Uint8Array(response);
  if (res.length < 5) {
    return { success: false, error: 'Response packet too short for Modbus RTU (min 5 bytes)' };
  }

  // Check CRC16
  const [crcLo, crcHi] = calculateCRC(res, 0, res.length - 2);
  if (crcLo !== res[res.length - 2] || crcHi !== res[res.length - 1]) {
    return { success: false, error: 'Modbus RTU CRC verification failed' };
  }

  const func = res[1];
  // Check exception response
  if ((func & 0x80) === 0x80) {
    const exCode = res[2];
    return {
      success: false,
      exceptionCode: exCode,
      error: `Modbus Exception 0x${func.toString(16)}: ${getModbusExceptionMessage(exCode)}`
    };
  }

  if (expectedFuncCode && func !== expectedFuncCode) {
    return { success: false, error: `Modbus Function Code mismatch (got ${func}, expected ${expectedFuncCode})` };
  }

  const byteCount = res[2];
  if (res.length < 3 + byteCount + 2) {
    return { success: false, error: `Incomplete Modbus RTU data: expected ${byteCount} bytes, got ${res.length - 5}` };
  }

  const data = res.slice(3, 3 + byteCount);
  return { success: true, byteCount, data };
}

/**
 * Pack a Modbus TCP Read Request
 * [TransID (2B) + ProtoID 0x0000 (2B) + Length (2B) + UnitID (1B) + FuncCode (1B) + RegAddr (2B) + RegCount (2B)]
 * @param {number} transId 1-65535
 * @param {number} unitId 1-255
 * @param {number} funcCode 3 or 4
 * @param {number} regAddr 0-65535
 * @param {number} regCount 1 or 2
 * @returns {Uint8Array} 12 bytes
 */
export function packModbusTcpRead(transId, unitId, funcCode, regAddr, regCount) {
  const packet = new Uint8Array(12);
  packet[0] = (transId >> 8) & 0xFF;
  packet[1] = transId & 0xFF;
  packet[2] = 0; // Modbus protocol
  packet[3] = 0;
  packet[4] = 0; // Length high byte (length = 6: UnitId + Func + Addr + Count)
  packet[5] = 6;
  packet[6] = unitId & 0xFF;
  packet[7] = funcCode & 0xFF;
  packet[8] = (regAddr >> 8) & 0xFF;
  packet[9] = regAddr & 0xFF;
  packet[10] = (regCount >> 8) & 0xFF;
  packet[11] = regCount & 0xFF;
  return packet;
}

/**
 * Parse a Modbus TCP Response
 * @param {Uint8Array|Array<number>} response
 * @param {number} [expectedTransId]
 * @param {number} [expectedFuncCode]
 * @returns {{ success: boolean, transId?: number, byteCount?: number, data?: Uint8Array, error?: string, exceptionCode?: number }}
 */
export function parseModbusTcpResponse(response, expectedTransId, expectedFuncCode) {
  const res = (response instanceof Uint8Array) ? response : new Uint8Array(response);
  if (res.length < 8) {
    return { success: false, error: 'Response too short for Modbus TCP header (min 8 bytes)' };
  }

  const transId = (res[0] << 8) | res[1];
  if (expectedTransId !== undefined && expectedTransId !== null && transId !== expectedTransId) {
    return { success: false, error: `Modbus TCP Transaction ID mismatch (got ${transId}, expected ${expectedTransId})` };
  }

  const func = res[7];
  if ((func & 0x80) === 0x80) {
    const exCode = res[8];
    return {
      success: false,
      transId,
      exceptionCode: exCode,
      error: `Modbus Exception 0x${func.toString(16)}: ${getModbusExceptionMessage(exCode)}`
    };
  }

  if (expectedFuncCode && func !== expectedFuncCode) {
    return { success: false, error: `Modbus TCP Function Code mismatch (got ${func}, expected ${expectedFuncCode})` };
  }

  if (res.length < 9) {
    return { success: false, error: 'Modbus TCP response missing byte count' };
  }

  const byteCount = res[8];
  if (res.length < 9 + byteCount) {
    return { success: false, error: `Incomplete Modbus TCP payload: expected ${byteCount} bytes, got ${res.length - 9}` };
  }

  const data = res.slice(9, 9 + byteCount);
  return { success: true, transId, byteCount, data };
}

// ==========================================
// 5. SUTO CSModbusProtocolAdapter (FC 70 / 71)
// ==========================================

export const CS_MODBUS_FUNC_RTU = 70; // 0x46 (RS485 RTU)
export const CS_MODBUS_FUNC_TCP = 71; // 0x47 (Ethernet TCP)

/**
 * Pack a SUTO CS-Bus packet inside a Modbus RTU wrapper (FC 70, 5 extra bytes)
 * @param {number} deviceAddress
 * @param {Uint8Array} csPacket Standard SUTO CS-Bus packet (e.g. 0x68 ... 0x16)
 * @returns {Uint8Array}
 */
export function packCsModbusRtu(deviceAddress, csPacket) {
  const len = csPacket.length + 5;
  const modPkg = new Uint8Array(len);
  modPkg[0] = deviceAddress & 0xFF;
  modPkg[1] = CS_MODBUS_FUNC_RTU;
  modPkg[2] = csPacket.length & 0xFF;
  modPkg.set(csPacket, 3);
  const [crcLo, crcHi] = calculateCRC(modPkg, 0, len - 2);
  modPkg[len - 2] = crcLo;
  modPkg[len - 1] = crcHi;
  return modPkg;
}

/**
 * Parse a SUTO CSModbus RTU Response, extracting the internal CS-Bus packet
 * @param {Uint8Array|Array<number>} response
 * @returns {{ success: boolean, csPacket?: Uint8Array, error?: string }}
 */
export function parseCsModbusRtu(response) {
  const res = (response instanceof Uint8Array) ? response : new Uint8Array(response);
  if (res.length < 5) {
    return { success: false, error: 'CSModbus RTU response too short' };
  }
  const [crcLo, crcHi] = calculateCRC(res, 0, res.length - 2);
  if (crcLo !== res[res.length - 2] || crcHi !== res[res.length - 1]) {
    return { success: false, error: 'CSModbus RTU CRC failed' };
  }
  if ((res[1] & 0x80) === 0x80) {
    return { success: false, error: `CSModbus Exception: ${getModbusExceptionMessage(res[2])}` };
  }
  if (res[1] !== CS_MODBUS_FUNC_RTU) {
    return { success: false, error: `CSModbus RTU function code mismatch: ${res[1]}` };
  }
  const payloadLen = res[2];
  const csPacket = res.slice(3, 3 + payloadLen);
  return { success: true, csPacket };
}

/**
 * Pack a SUTO CS-Bus packet inside a Modbus TCP wrapper (FC 71, 9 extra bytes)
 * @param {number} transId
 * @param {number} deviceAddress
 * @param {Uint8Array} csPacket
 * @returns {Uint8Array}
 */
export function packCsModbusTcp(transId, deviceAddress, csPacket) {
  const len = csPacket.length + 9;
  const modPkg = new Uint8Array(len);
  modPkg[0] = (transId >> 8) & 0xFF;
  modPkg[1] = transId & 0xFF;
  modPkg[2] = 0;
  modPkg[3] = 0;
  const tcpLen = csPacket.length + 3;
  modPkg[4] = (tcpLen >> 8) & 0xFF;
  modPkg[5] = tcpLen & 0xFF;
  modPkg[6] = deviceAddress & 0xFF;
  modPkg[7] = CS_MODBUS_FUNC_TCP;
  modPkg[8] = csPacket.length & 0xFF;
  modPkg.set(csPacket, 9);
  return modPkg;
}

/**
 * Parse a SUTO CSModbus TCP Response, extracting the internal CS-Bus packet
 * @param {Uint8Array|Array<number>} response
 * @param {number} [expectedTransId]
 * @returns {{ success: boolean, csPacket?: Uint8Array, error?: string }}
 */
export function parseCsModbusTcp(response, expectedTransId) {
  const res = (response instanceof Uint8Array) ? response : new Uint8Array(response);
  if (res.length < 9) {
    return { success: false, error: 'CSModbus TCP response too short' };
  }
  const transId = (res[0] << 8) | res[1];
  if (expectedTransId !== undefined && expectedTransId !== null && transId !== expectedTransId) {
    return { success: false, error: `CSModbus TCP Transaction ID mismatch: got ${transId}, expected ${expectedTransId}` };
  }
  if ((res[7] & 0x80) === 0x80) {
    return { success: false, error: `CSModbus Exception: ${getModbusExceptionMessage(res[8])}` };
  }
  if (res[7] !== CS_MODBUS_FUNC_TCP) {
    return { success: false, error: `CSModbus TCP function code mismatch: ${res[7]}` };
  }
  const payloadLen = res[8];
  const csPacket = res.slice(9, 9 + payloadLen);
  return { success: true, csPacket };
}

// ==========================================
// 6. Channel Scaling & Validation (GetOnLineMeasureValueActionExecutor.java)
// ==========================================

const EPSILON = 1.0e-6;

/**
 * Apply linear scaling, rounding, and range validation to raw Modbus measurement value.
 * Exactly implements `GetOnLineMeasureValueActionExecutor.java`.
 *
 * @param {number} rawVal Raw decoded double value
 * @param {object} config Channel configuration object:
 *  - mBA1: slope (default 1.0)
 *  - mBA0: intercept (default 0.0)
 *  - chOptionalConfig: bitmask (default 0)
 *  - mBOutputValueType: output type id
 *  - errorValue: sensor error sentinel (default -9999.0)
 *  - mBScalingHi, mBScalingLo, mBRangeHi, mBRangeLo
 * @returns {number|null} Scaled value or -9999.0 on sensor error, or null if channel disabled
 */
export function applyModbusChannelScaling(rawVal, config = {}) {
  const chOptionalConfig = config.chOptionalConfig ?? 0;

  // Bit 1 (& 0x02): Channel is disabled
  if ((chOptionalConfig & 0x02) === 0x02) {
    return null;
  }

  // Bit 0 (& 0x01): Raw mode (bypass scaling formula)
  if ((chOptionalConfig & 0x01) === 0x01) {
    return rawVal;
  }

  const a1 = (typeof config.mBA1 === 'number') ? config.mBA1 : 1.0;
  const a0 = (typeof config.mBA0 === 'number') ? config.mBA0 : 0.0;
  let v = rawVal * a1 + a0;

  // Bit 2 (& 0x04): Force integer cast
  if ((chOptionalConfig & 0x04) === 0x04) {
    v = Math.floor(v + EPSILON);
  } else if (config.mBOutputValueType === 6) {
    // Unsigned 32-bit int representation
    v = (Math.floor(v + EPSILON) >>> 0);
  } else {
    // Sensor error sentinel check
    const errVal = (typeof config.errorValue === 'number') ? config.errorValue : -9999.0;
    if (Math.abs(v - errVal) < EPSILON) {
      return -9999.0;
    }
  }

  // Bit 7 (& 0x80 / -128 signed byte): Range validation
  if ((chOptionalConfig & 0x80) !== 0) {
    const sHi = config.mBScalingHi ?? 0;
    const sLo = config.mBScalingLo ?? 0;
    const rHi = config.mBRangeHi ?? sHi;
    const rLo = config.mBRangeLo ?? sLo;
    if (sHi > sLo) {
      if (v > sHi || v < rLo) {
        return -9999.0;
      }
    }
  }

  return v;
}

// ==========================================
// 7. 204-byte CSCommChannelSetting Struct
// ==========================================

export const CS_CHANNEL_STRUCT_SIZE = 204;

function readUtf8UntilNull(bytes, offset, maxLen) {
  let end = offset;
  const limit = offset + maxLen;
  while (end < limit && bytes[end] !== 0) {
    end++;
  }
  const slice = bytes.slice(offset, end);
  return new TextDecoder('utf-8').decode(slice).trim();
}

function writeUtf8Padded(target, offset, maxLen, str) {
  const encoded = new TextEncoder().encode(str || '');
  const copyLen = Math.min(encoded.length, maxLen);
  target.set(encoded.subarray(0, copyLen), offset);
  for (let i = copyLen; i < maxLen; i++) {
    target[offset + i] = 0;
  }
}

/**
 * Parse a 204-byte Little-Endian CSCommChannelSetting binary block.
 * @param {Uint8Array} bytes
 * @param {number} [offset=0]
 * @returns {object} Channel setting model
 */
export function parseCSCommChannelSetting(bytes, offset = 0) {
  const raw = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(bytes);
  const dv = new DataView(raw.buffer, raw.byteOffset + offset, CS_CHANNEL_STRUCT_SIZE);

  const logicalChannelNo = dv.getUint8(0);
  const deviceDescription = readUtf8UntilNull(raw, offset + 1, 21);
  const subDevDescription = readUtf8UntilNull(raw, offset + 22, 21);
  const sensorDescription = readUtf8UntilNull(raw, offset + 43, 21);
  const channelDescription = readUtf8UntilNull(raw, offset + 64, 21);
  const resolution = dv.getUint8(85);
  const unitIndex = dv.getUint8(86);
  const unitInASCII = readUtf8UntilNull(raw, offset + 87, 12);

  const deviceID = dv.getInt32(99, true);
  const subDeviceID = dv.getInt32(103, true);
  const sensorID = dv.getInt32(107, true);
  const channelID = dv.getInt32(111, true);

  const slaverType = dv.getUint8(115);
  const slaverAddr = dv.getUint8(116);
  const slaverInnerChannelNo = dv.getUint8(117);
  const measureType = dv.getUint8(118);

  const anaScalingHi = dv.getFloat32(119, true);
  const anaScalingLo = dv.getFloat32(123, true);
  const mBA1 = dv.getFloat32(127, true);
  const mBA0 = dv.getFloat32(131, true);

  const mBValueAddr = dv.getUint16(135, true);
  const mBInputValueType = dv.getUint8(137);
  const mBOutputValueType = dv.getUint8(138);
  const mBAccessFuncCode = dv.getUint8(139);

  const mBScalingHi = dv.getFloat32(140, true);
  const mBScalingLo = dv.getFloat32(144, true);
  const mBRangeHi = dv.getFloat32(148, true);
  const mBRangeLo = dv.getFloat32(152, true);

  // errorValue: parsed as int or float based on mBInputValueType
  let errorValue = -100.0;
  if (mBInputValueType >= 1 && mBInputValueType <= 6) {
    errorValue = dv.getInt32(156, true);
  } else if (mBInputValueType === 7 || mBInputValueType === 8) {
    errorValue = dv.getFloat32(156, true);
  }

  const virtualCalcFormula = readUtf8UntilNull(raw, offset + 160, 20);
  const virtualConstantValueA = dv.getFloat32(180, true);
  const virtualConstantValueB = dv.getFloat32(184, true);
  const virtualConstantValueC = dv.getFloat32(188, true);
  const virtualConstantValueD = dv.getFloat32(192, true);

  const chOptionalConfig = dv.getUint8(196);

  return {
    logicalChannelNo,
    deviceDescription,
    subDevDescription,
    sensorDescription,
    channelDescription,
    resolution,
    unitIndex,
    unitInASCII,
    deviceID,
    subDeviceID,
    sensorID,
    channelID,
    slaverType,
    slaverAddr,
    slaverInnerChannelNo,
    measureType,
    anaScalingHi,
    anaScalingLo,
    mBA1,
    mBA0,
    mBValueAddr,
    mBInputValueType,
    mBOutputValueType,
    mBAccessFuncCode,
    mBScalingHi,
    mBScalingLo,
    mBRangeHi,
    mBRangeLo,
    errorValue,
    virtualCalcFormula,
    virtualConstantValueA,
    virtualConstantValueB,
    virtualConstantValueC,
    virtualConstantValueD,
    chOptionalConfig
  };
}

/**
 * Build a 204-byte Little-Endian CSCommChannelSetting binary block.
 * @param {object} s
 * @returns {Uint8Array} Exactly 204 bytes
 */
export function buildCSCommChannelSetting(s = {}) {
  const bytes = new Uint8Array(CS_CHANNEL_STRUCT_SIZE);
  const dv = new DataView(bytes.buffer);

  dv.setUint8(0, s.logicalChannelNo ?? 1);
  writeUtf8Padded(bytes, 1, 21, s.deviceDescription || '');
  writeUtf8Padded(bytes, 22, 21, s.subDevDescription || '');
  writeUtf8Padded(bytes, 43, 21, s.sensorDescription || '');
  writeUtf8Padded(bytes, 64, 21, s.channelDescription || '');
  dv.setUint8(85, s.resolution ?? 1);
  dv.setUint8(86, s.unitIndex ?? 0);
  writeUtf8Padded(bytes, 87, 12, s.unitInASCII || '');

  dv.setInt32(99, s.deviceID ?? 1, true);
  dv.setInt32(103, s.subDeviceID ?? 0, true);
  dv.setInt32(107, s.sensorID ?? 1, true);
  dv.setInt32(111, s.channelID ?? 1, true);

  dv.setUint8(115, s.slaverType ?? 4); // default MEA_SLAVE_TYPE_BUS_SENSOR
  dv.setUint8(116, s.slaverAddr ?? 1);
  dv.setUint8(117, s.slaverInnerChannelNo ?? 1);
  dv.setUint8(118, s.measureType ?? 0);

  dv.setFloat32(119, s.anaScalingHi ?? 100.0, true);
  dv.setFloat32(123, s.anaScalingLo ?? 0.0, true);
  dv.setFloat32(127, s.mBA1 ?? 1.0, true);
  dv.setFloat32(131, s.mBA0 ?? 0.0, true);

  dv.setUint16(135, s.mBValueAddr ?? 0, true);
  const inType = s.mBInputValueType ?? 7; // default FLOAT32_BE
  dv.setUint8(137, inType);
  dv.setUint8(138, s.mBOutputValueType ?? inType);
  dv.setUint8(139, s.mBAccessFuncCode ?? 3); // default FC 03

  dv.setFloat32(140, s.mBScalingHi ?? 10000.0, true);
  dv.setFloat32(144, s.mBScalingLo ?? -10000.0, true);
  dv.setFloat32(148, s.mBRangeHi ?? 10000.0, true);
  dv.setFloat32(152, s.mBRangeLo ?? -10000.0, true);

  if (inType >= 1 && inType <= 6) {
    dv.setInt32(156, Math.floor(s.errorValue ?? -9999), true);
  } else {
    dv.setFloat32(156, s.errorValue ?? -9999.0, true);
  }

  writeUtf8Padded(bytes, 160, 20, s.virtualCalcFormula || '');
  dv.setFloat32(180, s.virtualConstantValueA ?? 0.0, true);
  dv.setFloat32(184, s.virtualConstantValueB ?? 0.0, true);
  dv.setFloat32(188, s.virtualConstantValueC ?? 0.0, true);
  dv.setFloat32(192, s.virtualConstantValueD ?? 0.0, true);

  dv.setUint8(196, s.chOptionalConfig ?? 0);
  // Bytes 197-203 reserved (already 0)

  return bytes;
}

// ==========================================
// 8. S330/S331 Auto-Channel Discovery over Modbus TCP (CSBusCommands + GetAllChannelStructActionExecutor)
// ==========================================

export const CS_CMD_GET_MEASUREMENT_CHANNEL_COUNT = new Uint8Array([4, 2, 3]);
export const CS_CMD_GET_MAX_CHANNEL_COUNT = new Uint8Array([1, 255, 35]); // [1, -1, 35]

/**
 * Builds the CS-Bus command to query channel count (CSBusCommands.GET_MEASUREMENT_CHANNEL_COUNT)
 * @returns {Uint8Array}
 */
export function buildCsGetChannelCountCommand() {
  return new Uint8Array([4, 2, 3]);
}

/**
 * Parses channel count from CS-Bus response payload (CSBusGetMeasurementChannelCountResponse)
 * @param {Uint8Array|Array<number>} csPayload Raw CS payload (without Modbus wrappers)
 * @returns {number} Channel count (0 if empty/invalid)
 */
export function parseCsChannelCountResponse(csPayload) {
  if (!csPayload || csPayload.length < 1) return 0;
  const raw = (csPayload instanceof Uint8Array) ? csPayload : new Uint8Array(csPayload);
  return raw[0] & 0xFF;
}

/**
 * Builds the CS-Bus command to get channel structure batch (CSBusCommands.GET_CHANNEL_STRUCT / GET_CHANNEL_STRUCT_TRED)
 * @param {number} startChannelNo 1-based start channel index (e.g. 1, 6, 11)
 * @param {number} numberOfChannels Number of channels to fetch in this batch (typically 5)
 * @param {boolean} [isTred=false] True if device firmware >= 1.31 uses GET_CHANNEL_STRUCT_TRED
 * @returns {Uint8Array}
 */
export function buildCsGetChannelStructCommand(startChannelNo, numberOfChannels, isTred = false) {
  return new Uint8Array([
    4,
    2,
    isTred ? 11 : 2, // 2: GET_MEASUREMENT_CH_SETTING, 11: GET_MEASUREMENT_CH_SETTING_TRED
    startChannelNo & 0xFF,
    numberOfChannels & 0xFF
  ]);
}

/**
 * Parses a batch of 204-byte CSCommChannelSetting structs from raw CS payload (CSBusGetChannelStructResponse)
 * @param {Uint8Array|Array<number>} csPayload Raw CS payload
 * @returns {Array<object>} Array of parsed CSCommChannelSetting objects
 */
export function parseCsChannelStructBatchResponse(csPayload) {
  if (!csPayload) return [];
  const raw = (csPayload instanceof Uint8Array) ? csPayload : new Uint8Array(csPayload);
  if (raw.length < CS_CHANNEL_STRUCT_SIZE) return [];

  const count = Math.floor(raw.length / CS_CHANNEL_STRUCT_SIZE);
  const channels = [];
  for (let i = 0; i < count; i++) {
    const offset = i * CS_CHANNEL_STRUCT_SIZE;
    const setting = parseCSCommChannelSetting(raw, offset);
    channels.push(setting);
  }
  return channels;
}

/**
 * Converts a parsed CSCommChannelSetting into a UI-ready Modbus channel definition
 * @param {object} setting Parsed CSCommChannelSetting struct
 * @returns {object} Channel definition matching UI state
 */
export function channelSettingToModbusChannel(setting) {
  const typeMap = {
    1: 'INT16',
    2: 'UINT16',
    3: 'INT32_B',
    4: 'INT32_L',
    5: 'UINT32_B',
    6: 'UINT32_L',
    7: 'FLOAT_B',
    8: 'FLOAT_L'
  };

  const dataType = typeMap[setting.mBInputValueType] || 'FLOAT_B';
  const name = setting.channelDescription?.trim()
    || setting.sensorDescription?.trim()
    || `Channel ${setting.logicalChannelNo}`;
  const unit = setting.unitInASCII?.trim() || '';
  const regAddr = setting.mBValueAddr || 0;
  const funcCode = setting.mBAccessFuncCode || 3;
  const a1 = (setting.mBA1 !== undefined && !Number.isNaN(setting.mBA1)) ? setting.mBA1 : 1.0;
  const a0 = (setting.mBA0 !== undefined && !Number.isNaN(setting.mBA0)) ? setting.mBA0 : 0.0;

  // Disabled if bit 1 of chOptionalConfig is set (& 0x02), or slaverType is -1, or regAddr is 0
  const isDisabled = (setting.chOptionalConfig & 0x02) === 2 || setting.slaverType === -1 || regAddr === 0;

  return {
    id: setting.logicalChannelNo,
    name,
    unit,
    regAddr,
    funcCode,
    dataType,
    a1,
    a0,
    active: !isDisabled,
    resolution: setting.resolution ?? 1,
    errorValue: setting.errorValue ?? -9999.0,
    scalingHi: setting.mBScalingHi ?? 1000.0,
    scalingLo: setting.mBScalingLo ?? 0.0,
    rangeHi: setting.mBRangeHi ?? 1000.0,
    rangeLo: setting.mBRangeLo ?? 0.0,
    deviceDescription: setting.deviceDescription?.trim() || ''
  };
}

/**
 * Creates default simulated S331 channel settings serialized into raw 204-byte bytes.
 * Used for mock/browser simulation of S331 auto-channel discovery.
 * @returns {Uint8Array}
 */
export function createMockS331ChannelSettings() {
  const mockDefs = [
    {
      logicalChannelNo: 1,
      channelDescription: 'Flow',
      sensorDescription: 'SUTO Flow Sensor',
      unitInASCII: 'm³/h',
      resolution: 1,
      mBValueAddr: 4096, // 0x1000
      mBAccessFuncCode: 3,
      mBInputValueType: 7, // FLOAT_B
      mBA1: 1.0,
      mBA0: 0.0,
      chOptionalConfig: 0
    },
    {
      logicalChannelNo: 2,
      channelDescription: 'Consumption',
      sensorDescription: 'SUTO Flow Sensor',
      unitInASCII: 'm³',
      resolution: 0,
      mBValueAddr: 4098, // 0x1002
      mBAccessFuncCode: 3,
      mBInputValueType: 7, // FLOAT_B
      mBA1: 1.0,
      mBA0: 0.0,
      chOptionalConfig: 0
    },
    {
      logicalChannelNo: 3,
      channelDescription: 'Pressure',
      sensorDescription: 'SUTO Pressure Sensor',
      unitInASCII: 'bar',
      resolution: 2,
      mBValueAddr: 4100, // 0x1004
      mBAccessFuncCode: 3,
      mBInputValueType: 7, // FLOAT_B
      mBA1: 1.0,
      mBA0: 0.0,
      chOptionalConfig: 0
    },
    {
      logicalChannelNo: 4,
      channelDescription: 'Temperature',
      sensorDescription: 'SUTO Temp Sensor',
      unitInASCII: '°C',
      resolution: 1,
      mBValueAddr: 4102, // 0x1006
      mBAccessFuncCode: 3,
      mBInputValueType: 7, // FLOAT_B
      mBA1: 1.0,
      mBA0: 0.0,
      chOptionalConfig: 0
    },
    {
      logicalChannelNo: 5,
      channelDescription: 'Dew Point',
      sensorDescription: 'SUTO Dew Point Sensor',
      unitInASCII: '°C Td',
      resolution: 1,
      mBValueAddr: 4104, // 0x1008
      mBAccessFuncCode: 3,
      mBInputValueType: 7, // FLOAT_B
      mBA1: 1.0,
      mBA0: 0.0,
      chOptionalConfig: 0
    },
    {
      logicalChannelNo: 6,
      channelDescription: 'Power',
      sensorDescription: 'SUTO Power Meter',
      unitInASCII: 'kW',
      resolution: 1,
      mBValueAddr: 4106, // 0x100A
      mBAccessFuncCode: 3,
      mBInputValueType: 7, // FLOAT_B
      mBA1: 1.0,
      mBA0: 0.0,
      chOptionalConfig: 0
    }
  ];

  const totalBytes = new Uint8Array(mockDefs.length * CS_CHANNEL_STRUCT_SIZE);
  mockDefs.forEach((def, idx) => {
    const chunk = buildCSCommChannelSetting(def);
    totalBytes.set(chunk, idx * CS_CHANNEL_STRUCT_SIZE);
  });
  return totalBytes;
}


