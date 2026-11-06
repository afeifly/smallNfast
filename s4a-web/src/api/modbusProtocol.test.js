import { describe, it, expect } from 'vitest';
import TauriSutoAPI from './TauriSutoAPI';
import {
  calculateCRC,
  calculateLRC,
  calculateCsChecksum,
  packCsBusFrame,
  unpackCsBusFrame,
  modbusData2Double,
  MODBUS_DATA_TYPES,
  packModbusRtuRead,
  parseModbusRtuResponse,
  packModbusTcpRead,
  parseModbusTcpResponse,
  packCsModbusRtu,
  parseCsModbusRtu,
  packCsModbusTcp,
  parseCsModbusTcp,
  applyModbusChannelScaling,
  parseCSCommChannelSetting,
  buildCSCommChannelSetting,
  CS_CHANNEL_STRUCT_SIZE,
  buildCsGetDeviceInfoCommand,
  buildCsBroadcastGetDeviceInfoCommand,
  parseCsDeviceInfoResponse,
  getSutoModelFromDeviceId,
  buildCsGetChannelCountCommand,
  parseCsChannelCountResponse,
  buildCsGetChannelStructCommand,
  parseCsChannelStructBatchResponse,
  channelSettingToModbusChannel,
  createMockS331ChannelSettings,
  normalizeModbusDataType,
  CS_MEASUREMENT_VALUE_SIZE,
  CONSUMPTION_UNIT_INDICES,
  buildCsGetOnlineMeasurementValuesCommand,
  parseCsOnlineMeasurementValues,
  createMockS331MeasurementValues
} from './modbusProtocol';

describe('modbusProtocol Engine', () => {
  describe('CRC-16 & LRC (MathUtil.java)', () => {
    it('calculates standard Modbus RTU CRC-16 correctly', () => {
      // Standard Modbus RTU read: Slave 1, FC 3, Reg 0, Count 2
      // Request bytes: [0x01, 0x03, 0x00, 0x00, 0x00, 0x02]
      // Expected CRC: 0xC4, 0x0B
      const req = new Uint8Array([0x01, 0x03, 0x00, 0x00, 0x00, 0x02]);
      const [crcLo, crcHi] = calculateCRC(req, 0, req.length);
      expect(crcLo).toBe(0xC4);
      expect(crcHi).toBe(0x0B);
    });

    it('calculates Modbus ASCII LRC correctly', () => {
      const data = new Uint8Array([0x01, 0x03, 0x00, 0x00, 0x00, 0x02]);
      const lrc = calculateLRC(data, 0, data.length);
      // sum = 1 + 3 + 0 + 0 + 0 + 2 = 6; (~6 + 1) & 0xFF = 0xFA
      expect(lrc).toBe(0xFA);
    });
  });

  describe('modbusData2Double (DataTypeConverter.java)', () => {
    it('converts Type 1 (INT16 signed)', () => {
      // -1000 in 16-bit signed is 0xFC18
      const bytes = new Uint8Array([0xFC, 0x18]);
      expect(modbusData2Double(1, bytes)).toBe(-1000);

      // +500 in 16-bit signed is 0x01F4
      const bytes2 = new Uint8Array([0x01, 0xF4]);
      expect(modbusData2Double(1, bytes2)).toBe(500);
    });

    it('converts Type 2 (UINT16 unsigned)', () => {
      // 0xFFFF is 65535
      const bytes = new Uint8Array([0xFF, 0xFF]);
      expect(modbusData2Double(2, bytes)).toBe(65535);

      const bytes2 = new Uint8Array([0x12, 0x34]);
      expect(modbusData2Double(2, bytes2)).toBe(0x1234);
    });

    it('converts Type 3 (INT32 Big-Endian ABCD)', () => {
      // -100000 in 32-bit signed is 0xFFFE7960
      const bytes = new Uint8Array([0xFF, 0xFE, 0x79, 0x60]);
      expect(modbusData2Double(3, bytes)).toBe(-100000);

      // +100000 is 0x000186A0
      const bytes2 = new Uint8Array([0x00, 0x01, 0x86, 0xA0]);
      expect(modbusData2Double(3, bytes2)).toBe(100000);
    });

    it('converts Type 4 (INT32 Word Swapped CDAB)', () => {
      // In ABCD: [0x00, 0x01, 0x86, 0xA0] = 100000
      // In CDAB (swapped words): [0x86, 0xA0, 0x00, 0x01]
      const bytes = new Uint8Array([0x86, 0xA0, 0x00, 0x01]);
      expect(modbusData2Double(4, bytes)).toBe(100000);
    });

    it('converts Type 5 (UINT32 Big-Endian ABCD)', () => {
      // 3000000000 in hex is 0xB2D05E00
      const bytes = new Uint8Array([0xB2, 0xD0, 0x5E, 0x00]);
      expect(modbusData2Double(5, bytes)).toBe(3000000000);
    });

    it('converts Type 6 (UINT32 Word Swapped CDAB)', () => {
      // 3000000000 in hex is ABCD: B2 D0 5E 00 -> CDAB: 5E 00 B2 D0
      const bytes = new Uint8Array([0x5E, 0x00, 0xB2, 0xD0]);
      expect(modbusData2Double(6, bytes)).toBe(3000000000);
    });

    it('converts Type 7 (FLOAT32 IEEE 754 Big-Endian ABCD)', () => {
      // 21.5f in IEEE 754 is 0x41AC0000
      const bytes = new Uint8Array([0x41, 0xAC, 0x00, 0x00]);
      expect(modbusData2Double(7, bytes)).toBeCloseTo(21.5, 3);
    });

    it('converts Type 8 (FLOAT32 IEEE 754 Word Swapped CDAB)', () => {
      // 21.5f ABCD is [0x41, 0xAC, 0x00, 0x00] -> CDAB is [0x00, 0x00, 0x41, 0xAC]
      const bytes = new Uint8Array([0x00, 0x00, 0x41, 0xAC]);
      expect(modbusData2Double(8, bytes)).toBeCloseTo(21.5, 3);
    });
  });

  describe('RTU Framing & Response Parsing', () => {
    it('packs and parses Modbus RTU Read frames', () => {
      const slaveId = 1;
      const funcCode = 3;
      const regAddr = 100;
      const regCount = 2;

      const req = packModbusRtuRead(slaveId, funcCode, regAddr, regCount);
      expect(req.length).toBe(8);
      expect(req[0]).toBe(slaveId);
      expect(req[1]).toBe(funcCode);
      expect((req[2] << 8) | req[3]).toBe(regAddr);
      expect((req[4] << 8) | req[5]).toBe(regCount);

      // Verify CRC of the generated request
      const [crcLo, crcHi] = calculateCRC(req, 0, 6);
      expect(req[6]).toBe(crcLo);
      expect(req[7]).toBe(crcHi);

      // Mock RTU response: 4 bytes of float data (21.5f = 0x41AC0000)
      const respPdu = [0x01, 0x03, 0x04, 0x41, 0xAC, 0x00, 0x00];
      const [rCrcLo, rCrcHi] = calculateCRC(new Uint8Array(respPdu), 0, respPdu.length);
      const fullResp = new Uint8Array([...respPdu, rCrcLo, rCrcHi]);

      const parsed = parseModbusRtuResponse(fullResp, 3);
      expect(parsed.success).toBe(true);
      expect(parsed.byteCount).toBe(4);
      expect(modbusData2Double(7, parsed.data)).toBeCloseTo(21.5, 3);
    });

    it('handles Modbus RTU Exception frames', () => {
      // Exception response for FC 3: 0x83, exception code 0x02 (Illegal Data Address)
      const respPdu = [0x01, 0x83, 0x02];
      const [crcLo, crcHi] = calculateCRC(new Uint8Array(respPdu), 0, respPdu.length);
      const exResp = new Uint8Array([...respPdu, crcLo, crcHi]);

      const parsed = parseModbusRtuResponse(exResp, 3);
      expect(parsed.success).toBe(false);
      expect(parsed.exceptionCode).toBe(2);
      expect(parsed.error).toContain('Illegal Data Address');
    });
  });

  describe('TCP Framing & Response Parsing', () => {
    it('packs and parses Modbus TCP Read frames', () => {
      const transId = 42;
      const unitId = 1;
      const funcCode = 4;
      const regAddr = 200;
      const regCount = 2;

      const req = packModbusTcpRead(transId, unitId, funcCode, regAddr, regCount);
      expect(req.length).toBe(12);
      expect((req[0] << 8) | req[1]).toBe(transId);
      expect((req[2] << 8) | req[3]).toBe(0); // Protocol ID
      expect((req[4] << 8) | req[5]).toBe(6); // Length
      expect(req[6]).toBe(unitId);
      expect(req[7]).toBe(funcCode);

      // Mock TCP response
      const tcpResp = new Uint8Array([
        0x00, 0x2A, // TransID = 42
        0x00, 0x00, // Proto = 0
        0x00, 0x07, // Length = 7 (UnitID + Func + ByteCount + 4 data bytes)
        0x01,       // UnitID = 1
        0x04,       // FuncCode = 4
        0x04,       // Byte count = 4
        0x41, 0xAC, 0x00, 0x00 // Data = 21.5f
      ]);

      const parsed = parseModbusTcpResponse(tcpResp, 42, 4);
      expect(parsed.success).toBe(true);
      expect(parsed.byteCount).toBe(4);
      expect(modbusData2Double(7, parsed.data)).toBeCloseTo(21.5, 3);
    });

    it('detects Modbus TCP Exception response', () => {
      const exResp = new Uint8Array([
        0x00, 0x2A,
        0x00, 0x00,
        0x00, 0x03,
        0x01,
        0x84, // 0x04 | 0x80 = 0x84
        0x01  // Exception code 1: Illegal Function
      ]);

      const parsed = parseModbusTcpResponse(exResp, 42, 4);
      expect(parsed.success).toBe(false);
      expect(parsed.exceptionCode).toBe(1);
      expect(parsed.error).toContain('Illegal Function');
    });
  });

  describe('CSModbusProtocolAdapter (FC 70 RTU & FC 71 TCP)', () => {
    it('wraps and extracts SUTO CS-Bus packets in Modbus RTU (FC 70)', () => {
      const fakeCsPacket = new Uint8Array([0x68, 0x04, 0x01, 0x16]);
      const wrapped = packCsModbusRtu(1, fakeCsPacket);
      expect(wrapped.length).toBe(fakeCsPacket.length + 5);
      expect(wrapped[0]).toBe(1);
      expect(wrapped[1]).toBe(70);
      expect(wrapped[2]).toBe(fakeCsPacket.length);

      const parsed = parseCsModbusRtu(wrapped);
      expect(parsed.success).toBe(true);
      expect(Array.from(parsed.csPacket)).toEqual(Array.from(fakeCsPacket));
    });

    it('wraps and extracts SUTO CS-Bus packets in Modbus TCP (FC 71)', () => {
      const fakeCsPacket = new Uint8Array([0x68, 0x04, 0x01, 0x16]);
      const wrapped = packCsModbusTcp(101, 1, fakeCsPacket);
      expect(wrapped.length).toBe(fakeCsPacket.length + 9);
      expect((wrapped[0] << 8) | wrapped[1]).toBe(101);
      expect(wrapped[6]).toBe(1);
      expect(wrapped[7]).toBe(71);
      expect(wrapped[8]).toBe(fakeCsPacket.length);

      const parsed = parseCsModbusTcp(wrapped, 101);
      expect(parsed.success).toBe(true);
      expect(Array.from(parsed.csPacket)).toEqual(Array.from(fakeCsPacket));
    });
  });

  describe('Channel Scaling & Range Validation (GetOnLineMeasureValueActionExecutor.java)', () => {
    it('applies linear scaling formula v = raw * a1 + a0', () => {
      const config = {
        mBA1: 0.1,
        mBA0: 5.0,
        chOptionalConfig: 0
      };
      const result = applyModbusChannelScaling(200.0, config);
      expect(result).toBeCloseTo(25.0, 4);
    });

    it('respects raw mode bit (& 0x01)', () => {
      const config = {
        mBA1: 10.0,
        mBA0: 100.0,
        chOptionalConfig: 0x01 // Raw mode
      };
      expect(applyModbusChannelScaling(5.0, config)).toBe(5.0);
    });

    it('respects disabled bit (& 0x02)', () => {
      const config = {
        chOptionalConfig: 0x02 // Disabled
      };
      expect(applyModbusChannelScaling(10.0, config)).toBeNull();
    });

    it('applies integer cast when & 0x04 is set', () => {
      const config = {
        mBA1: 1.0,
        mBA0: 0.8,
        chOptionalConfig: 0x04
      };
      expect(applyModbusChannelScaling(10.0, config)).toBe(10);
    });

    it('returns sentinel -9999.0 when raw value matches errorValue', () => {
      const config = {
        mBA1: 1.0,
        mBA0: 0.0,
        errorValue: 99999.0,
        chOptionalConfig: 0
      };
      expect(applyModbusChannelScaling(99999.0, config)).toBe(-9999.0);
    });

    it('validates ranges when & 0x80 is set', () => {
      const config = {
        mBA1: 1.0,
        mBA0: 0.0,
        mBScalingHi: 100.0,
        mBScalingLo: 0.0,
        mBRangeHi: 100.0,
        mBRangeLo: 0.0,
        chOptionalConfig: 0x80
      };
      expect(applyModbusChannelScaling(50.0, config)).toBe(50.0);
      expect(applyModbusChannelScaling(150.0, config)).toBe(-9999.0); // Out of range
      expect(applyModbusChannelScaling(-10.0, config)).toBe(-9999.0); // Out of range
    });
  });

  describe('204-byte CSCommChannelSetting Struct Serialization', () => {
    it('roundtrips a channel setting without data loss', () => {
      const original = {
        logicalChannelNo: 3,
        deviceDescription: 'SUTO Flow Meter',
        subDevDescription: 'SubDev 1',
        sensorDescription: 'Core Sensor S401',
        channelDescription: 'Compressed Air Flow',
        resolution: 2,
        unitIndex: 1,
        unitInASCII: 'm3/h',
        deviceID: 4178,
        subDeviceID: 0,
        sensorID: 10,
        channelID: 3,
        slaverType: 4,
        slaverAddr: 1,
        slaverInnerChannelNo: 1,
        measureType: 1,
        anaScalingHi: 1000.0,
        anaScalingLo: 0.0,
        mBA1: 1.0,
        mBA0: 0.0,
        mBValueAddr: 2048,
        mBInputValueType: 7, // Float32 Big Endian
        mBOutputValueType: 7,
        mBAccessFuncCode: 3,
        mBScalingHi: 1500.0,
        mBScalingLo: 0.0,
        mBRangeHi: 1500.0,
        mBRangeLo: 0.0,
        errorValue: -9999.0,
        virtualCalcFormula: '',
        virtualConstantValueA: 0.0,
        virtualConstantValueB: 0.0,
        virtualConstantValueC: 0.0,
        virtualConstantValueD: 0.0,
        chOptionalConfig: 0
      };

      const binary = buildCSCommChannelSetting(original);
      expect(binary.length).toBe(CS_CHANNEL_STRUCT_SIZE);

      const parsed = parseCSCommChannelSetting(binary);
      expect(parsed.logicalChannelNo).toBe(original.logicalChannelNo);
      expect(parsed.deviceDescription).toBe(original.deviceDescription);
      expect(parsed.sensorDescription).toBe(original.sensorDescription);
      expect(parsed.channelDescription).toBe(original.channelDescription);
      expect(parsed.unitInASCII).toBe(original.unitInASCII);
      expect(parsed.resolution).toBe(original.resolution);
      expect(parsed.deviceID).toBe(original.deviceID);
      expect(parsed.mBValueAddr).toBe(original.mBValueAddr);
      expect(parsed.mBInputValueType).toBe(original.mBInputValueType);
      expect(parsed.mBAccessFuncCode).toBe(original.mBAccessFuncCode);
      expect(parsed.anaScalingHi).toBeCloseTo(original.anaScalingHi, 1);
      expect(parsed.errorValue).toBeCloseTo(original.errorValue, 1);
    });
  });

  describe('S331 Auto-Channel Discovery over Modbus TCP (CSBusCommands + GetAllChannelStructActionExecutor)', () => {
    it('builds and parses channel count command', () => {
      const cmd = buildCsGetChannelCountCommand();
      expect(Array.from(cmd)).toEqual([4, 2, 3]);

      const count = parseCsChannelCountResponse(new Uint8Array([6]));
      expect(count).toBe(6);
    });

    it('builds channel struct batch command (standard and TRED)', () => {
      const stdCmd = buildCsGetChannelStructCommand(1, 5, false);
      expect(Array.from(stdCmd)).toEqual([4, 2, 2, 1, 5]);

      const tredCmd = buildCsGetChannelStructCommand(6, 5, true);
      expect(Array.from(tredCmd)).toEqual([4, 2, 11, 6, 5]);
    });

    it('parses multi-channel struct batch responses into UI-ready channel objects', () => {
      const mockBytes = createMockS331ChannelSettings();
      expect(mockBytes.length).toBe(6 * CS_CHANNEL_STRUCT_SIZE);

      const parsedSettings = parseCsChannelStructBatchResponse(mockBytes);
      expect(parsedSettings.length).toBe(6);

      const ch1 = channelSettingToModbusChannel(parsedSettings[0]);
      expect(ch1.id).toBe(1);
      expect(ch1.name).toBe('Flow');
      expect(ch1.unit).toBe('m³/h');
      expect(ch1.regAddr).toBe(4096);
      expect(ch1.funcCode).toBe(3);
      expect(ch1.dataType).toBe('FLOAT_B');
      expect(ch1.a1).toBe(1.0);
      expect(ch1.a0).toBe(0.0);
      expect(ch1.active).toBe(true);

      const ch3 = channelSettingToModbusChannel(parsedSettings[2]);
      expect(ch3.name).toBe('Pressure');
      expect(ch3.unit).toBe('bar');
      expect(ch3.regAddr).toBe(4100);

      const ch5 = channelSettingToModbusChannel(parsedSettings[4]);
      expect(ch5.name).toBe('Dew Point');
      expect(ch5.unit).toBe('°C Td');
      expect(ch5.regAddr).toBe(4104);
    });
  });

  describe('SUTO CS-Bus Framing & Device Identification', () => {
    it('computes 8-bit two\'s complement CS checksum correctly (CSBusProtocol.java)', () => {
      // Test vector: Address 1, Length 7, NetData [1, 255, 28]
      // Packet without checksum: [1, 7, 1, 255, 28]
      // Sum = 1 + 7 + 1 + 255 + 28 = 292 = 0x124 -> low byte = 0x24 = 36
      // Two's complement: (~36 + 1) & 0xFF = (219 + 1) & 0xFF = 220 = 0xDC
      const data = new Uint8Array([1, 7, 1, 255, 28]);
      const ck = calculateCsChecksum(data, data.length);
      expect(ck).toBe(0xDC);

      // Verify that data + ck sum low byte is 0
      const total = (data.reduce((a, b) => a + b, 0) + ck) & 0xFF;
      expect(total).toBe(0);
    });

    it('packs and unpackages a CS-Bus frame with tail byte 0x00', () => {
      const netData = new Uint8Array([1, 255, 28]);
      const frame = packCsBusFrame(1, netData);

      // Total length = netData.length + 4 = 7
      expect(frame.length).toBe(7);
      expect(frame[0]).toBe(1); // address
      expect(frame[1]).toBe(7); // length
      expect(frame[2]).toBe(1);
      expect(frame[3]).toBe(255);
      expect(frame[4]).toBe(28);
      expect(frame[5]).toBe(0xDC); // checksum
      expect(frame[6]).toBe(0x00); // tail byte

      // Unpack response: simulates SUTO device responding with '>' (0x3E)
      const respNetData = new Uint8Array([0x3E, 10, 20, 30]);
      const respFrame = packCsBusFrame(1, respNetData);

      const unpacked = unpackCsBusFrame(respFrame);
      expect(unpacked.success).toBe(true);
      expect(unpacked.address).toBe(1);
      // Unpack strips '>' and returns the payload in .data [10, 20, 30]
      expect(Array.from(unpacked.data)).toEqual([10, 20, 30]);
    });

    it('builds device info commands', () => {
      const infoCmd = buildCsGetDeviceInfoCommand();
      expect(Array.from(infoCmd)).toEqual([1, 255, 28]);

      const bcastCmd = buildCsBroadcastGetDeviceInfoCommand();
      expect(Array.from(bcastCmd)).toEqual([0x41]); // 'A'
    });

    it('identifies SUTO device models from device ID', () => {
      expect(getSutoModelFromDeviceId(0x1065)).toBe('SUTO S331');
      expect(getSutoModelFromDeviceId(0x1064)).toBe('SUTO S330');
      expect(getSutoModelFromDeviceId(0x1066)).toBe('SUTO S551');
      expect(getSutoModelFromDeviceId(0x1068)).toBe('SUTO S600');
      expect(getSutoModelFromDeviceId(0x1080)).toBe('SUTO S505 (DP500)');
    });

    it('parses 8-byte CSCommDeviceID response', () => {
      // 8 bytes: busVersion(1), devId(uint16 LE 0x1065), swVer(154 -> 1.54), serial(uint32 LE 33100123)
      const raw = new Uint8Array(8);
      const dv = new DataView(raw.buffer);
      dv.setUint8(0, 1);
      dv.setUint16(1, 0x1065, true); // SUTO S331
      dv.setUint8(3, 154); // v1.54
      dv.setUint32(4, 33100123, true);

      const parsed = parseCsDeviceInfoResponse(raw);
      expect(parsed).not.toBeNull();
      expect(parsed.model).toBe('SUTO S331');
      expect(parsed.serial).toBe('33100123');
      expect(parsed.softwareVersion).toBe('1.54');
      expect(parsed.busVersion).toBe(1);
      expect(parsed.deviceId).toBe(0x1065);
    });
  });

  describe('SUTO Online Measurement Values (CSCommMeasurementValue)', () => {
    it('normalizes string and number data types correctly', () => {
      expect(normalizeModbusDataType(1)).toBe(1);
      expect(normalizeModbusDataType(7)).toBe(7);
      expect(normalizeModbusDataType('INT16')).toBe(1);
      expect(normalizeModbusDataType('UINT16')).toBe(2);
      expect(normalizeModbusDataType('INT32_B')).toBe(3);
      expect(normalizeModbusDataType('INT32_L')).toBe(4);
      expect(normalizeModbusDataType('INT32_SWAP')).toBe(4);
      expect(normalizeModbusDataType('UINT32_B')).toBe(5);
      expect(normalizeModbusDataType('UINT32_L')).toBe(6);
      expect(normalizeModbusDataType('FLOAT_B')).toBe(7);
      expect(normalizeModbusDataType('FLOAT_L')).toBe(8);
      expect(normalizeModbusDataType('FLOAT32_SWAP')).toBe(8);
      expect(normalizeModbusDataType('unknown')).toBe(7); // default FLOAT_B
    });

    it('converts string data types in modbusData2Double', () => {
      // 100.0 as Float32 BE: [0x42, 0xC8, 0x00, 0x00]
      const bytes = new Uint8Array([0x42, 0xC8, 0x00, 0x00]);
      expect(modbusData2Double('FLOAT_B', bytes)).toBeCloseTo(100.0, 4);

      // -500 in INT16: [0xFE, 0x0C]
      const bytesInt = new Uint8Array([0xFE, 0x0C]);
      expect(modbusData2Double('INT16', bytesInt)).toBe(-500);
    });

    it('builds CS-Bus GET_ONLINE_MEASUREMENT_VALUE command', () => {
      const cmd = buildCsGetOnlineMeasurementValuesCommand(1, 6);
      expect(Array.from(cmd)).toEqual([0x04, 0x01, 0x01, 0x01, 0x06]);
    });

    it('parses 7-byte CSCommMeasurementValue binary payloads', () => {
      const mockBytes = createMockS331MeasurementValues([142.5, 120530, 6.82, 24.3, -42.1, 15.6]);
      expect(mockBytes.length).toBe(6 * CS_MEASUREMENT_VALUE_SIZE);

      const parsed = parseCsOnlineMeasurementValues(mockBytes, 6);
      expect(parsed).toHaveLength(6);

      // Channel 1: Flow (Float32 LE)
      expect(parsed[0].channelIndex).toBe(1);
      expect(parsed[0].value).toBeCloseTo(142.5, 2);
      expect(parsed[0].isValid).toBe(true);
      expect(parsed[0].isOverRange).toBe(false);

      // Channel 2: Consumption (Int32 LE)
      expect(parsed[1].channelIndex).toBe(2);
      expect(parsed[1].value).toBe(120530);
      expect(parsed[1].unitIndex).toBe(24);
      expect(parsed[1].isValid).toBe(true);

      // Channel 3: Pressure (Float32 LE)
      expect(parsed[2].channelIndex).toBe(3);
      expect(parsed[2].value).toBeCloseTo(6.82, 2);
      expect(parsed[2].resolution).toBe(2);
    });

    it('correctly handles sensor error and over-range flags in status byte', () => {
      const buf = new Uint8Array(CS_MEASUREMENT_VALUE_SIZE);
      const dv = new DataView(buf.buffer);
      dv.setFloat32(0, 99.9, true);
      dv.setUint8(4, 1); // resolution 1
      dv.setUint8(5, 1); // unit index 1
      dv.setUint8(6, 0x04); // status bit 2: invalid

      const parsed = parseCsOnlineMeasurementValues(buf);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].isValid).toBe(false);
      expect(parsed[0].value).toBeNull();
      expect(parsed[0].rawValue).toBeCloseTo(99.9, 1);

      // Over-range flag (bit 3 = 0x08)
      dv.setUint8(6, 0x08);
      const parsedOver = parseCsOnlineMeasurementValues(buf);
      expect(parsedOver[0].isValid).toBe(true);
      expect(parsedOver[0].isOverRange).toBe(true);
      expect(parsedOver[0].value).toBeCloseTo(99.9, 1);
    });

    it('tolerates command echo prefix [4, 1, 1] in device response', () => {
      const mockValues = createMockS331MeasurementValues([50.5, 1000]);
      // Prepend [4, 1, 1]
      const echoed = new Uint8Array(3 + mockValues.length);
      echoed.set([4, 1, 1], 0);
      echoed.set(mockValues, 3);

      const parsed = parseCsOnlineMeasurementValues(echoed, 2);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].value).toBeCloseTo(50.5, 2);
      expect(parsed[1].value).toBe(1000);
    });
  });

  describe('Single Device Logical Connection Handling', () => {
    it('handles one single device at a time when clearOthers is true', async () => {
      // 1. Simulate 3 sensors previously connected from ProcessScape
      await TauriSutoAPI.connectModbusTcp({
        host: '192.168.1.10',
        port: 502,
        slaveId: 1,
        name: 'Scape Sensor 1',
        channels: [{ id: 1, name: 'S1 Flow', unit: 'm3/h' }]
      });
      await TauriSutoAPI.connectModbusTcp({
        host: '192.168.1.11',
        port: 502,
        slaveId: 2,
        name: 'Scape Sensor 2',
        channels: [{ id: 2, name: 'S2 Pressure', unit: 'bar' }]
      });
      await TauriSutoAPI.connectModbusTcp({
        host: '192.168.1.12',
        port: 502,
        slaveId: 3,
        name: 'Scape Sensor 3',
        channels: [{ id: 3, name: 'S3 Temp', unit: '°C' }]
      });

      // All 3 devices are in activeModbusDevices
      const chsMulti = await TauriSutoAPI.getChannels();
      expect(chsMulti).toHaveLength(3);

      // 2. Now back to single device connect: connect ONE Modbus TCP device with clearOthers = true
      await TauriSutoAPI.connectModbusTcp({
        host: '192.168.1.99',
        port: 502,
        slaveId: 1,
        name: 'Single Target Sensor',
        channels: [
          { id: 101, name: 'Main Flow', unit: 'm3/h' },
          { id: 102, name: 'Main Pressure', unit: 'bar' }
        ],
        clearOthers: true
      });

      // 3. Online View queries getChannels: MUST only have the single device's 2 channels!
      const chsSingle = await TauriSutoAPI.getChannels();
      expect(chsSingle).toHaveLength(2);
      expect(chsSingle[0].channel_name).toBe('Main Flow');
      expect(chsSingle[1].channel_name).toBe('Main Pressure');
      expect(chsSingle[0].device_description).toBe('Single Target Sensor');

      // 4. Disconnect completely clears everything
      await TauriSutoAPI.disconnect();
      const chsEmpty = await TauriSutoAPI.getChannels();
      expect(chsEmpty).toHaveLength(0);
    });
  });
});


