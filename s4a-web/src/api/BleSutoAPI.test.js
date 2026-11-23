import { describe, it, expect, vi } from 'vitest';
import { BleSutoAPI } from './BleSutoAPI';
import TauriSutoAPI from './TauriSutoAPI';

describe('BleSutoAPI channel parsing & normalization', () => {
  it('parses raw 204-byte channel struct without ReferenceError and sets all required view fields', () => {
    const raw = new Uint8Array(204);
    raw[0] = 1; // logical channel 1
    // ChDesc at offset 64
    const desc = new TextEncoder().encode('Flow Rate');
    raw.set(desc, 64);
    raw[85] = 0; // resolution 0 (tests resolveChannelResolution path that previously triggered TDZ bug)
    raw[86] = 14; // unitIndex 14 -> m³/h
    // SensorDesc at offset 43
    const sDesc = new TextEncoder().encode('Flow Sensor');
    raw.set(sDesc, 43);

    // Identity fields: device_id (99), sub_device_id (103), sensor_id (107), channel_id (111)
    const dv = new DataView(raw.buffer);
    dv.setInt32(99, 10, true);
    dv.setInt32(103, 0, true);
    dv.setInt32(107, 2, true);
    dv.setInt32(111, 1, true);

    const parsed = BleSutoAPI._parseChannelStructs(raw);
    expect(parsed.length).toBe(1);
    const ch = parsed[0];
    expect(ch.channel_id).toBe(1);
    expect(ch.channel_name).toBe('Flow Rate');
    expect(ch.name).toBe('Flow Rate');
    expect(ch.fullName).toBe('Flow Rate');
    expect(ch.logic_channel_description).toBe('Flow Rate');
    expect(ch.full_channel_name).toBe('Flow Rate');
    expect(ch.unit).toBe('m³/h');
    expect(ch.unit_in_ascii).toBe('m³/h');
    expect(ch.location_id).toBe(1);
    expect(ch.sensor_id).toBe(2);
    expect(ch.sensor_description).toBe('Flow Sensor');
    expect(ch.sensorDescription).toBe('Flow Sensor');
  });

  it('returns empty channels by default when no descriptors are returned (zero fake data)', async () => {
    BleSutoAPI.cachedChannels = [];
    const chs = await BleSutoAPI.getChannels();
    expect(chs.length).toBe(0);
  });

  it('provides complete metadata on fallback dummy channels when allowFallback is explicitly enabled', async () => {
    // Force cachedChannels empty and get fallback with explicit allowFallback flag
    BleSutoAPI.cachedChannels = [];
    const chs = await BleSutoAPI.getChannels({ allowFallback: true });
    expect(chs.length).toBe(3);

    for (const ch of chs) {
      expect(ch.location_id).toBe(1);
      expect(ch.channel_name).toBeDefined();
      expect(ch.name).toBeDefined();
      expect(ch.fullName).toBeDefined();
      expect(ch.logic_channel_description).toBeDefined();
      expect(ch.full_channel_name).toBeDefined();
      expect(ch.unit).toBeDefined();
      expect(ch.unit_in_ascii).toBeDefined();
      expect(ch.sensor_description).toBeDefined();
      expect(ch.sensorDescription).toBeDefined();
      expect(ch.sensor_id).toBeDefined();
    }
  });

  it('resumeBleConnection finds matching authorized device from navigator.bluetooth.getDevices', async () => {
    const mockDevice = {
      id: 'mock-ble-guid-123',
      name: 'SUTO S401',
      gatt: {
        connect: async () => ({
          getPrimaryServices: async () => []
        })
      },
      addEventListener: () => {}
    };

    // Spy on _setupGattAndIdentify
    const setupSpy = vi.spyOn(BleSutoAPI, '_setupGattAndIdentify').mockResolvedValue({
      address: 1,
      device: 'SUTO S401',
      name: 'SUTO S401',
      serial: '12345678',
      serial_number: '12345678',
      deviceId: 'mock-ble-guid-123',
      type: 'BLE',
      transport: 'BLE'
    });

    // Mock navigator.bluetooth
    const origNav = global.navigator;
    global.navigator = {
      ...origNav,
      bluetooth: {
        getDevices: async () => [mockDevice]
      }
    };

    const res = await BleSutoAPI.resumeBleConnection({ deviceId: 'mock-ble-guid-123' });
    expect(res).toBeDefined();
    expect(res.deviceId).toBe('mock-ble-guid-123');
    expect(res.serial_number).toBe('12345678');
    expect(setupSpy).toHaveBeenCalledWith(mockDevice);

    setupSpy.mockRestore();
    global.navigator = origNav;
  });

  it('getLoggerStatus correctly queries ACT_GET_LOG_RECORDED_NUM (0x02) and ACT_GET_LOG_START_END_TIME (0x03)', async () => {
    const makeReply = (payload) => {
      const pkt = [1, 2 + 1 + payload.length + 2, 0x3e, ...payload];
      const ck = BleSutoAPI._calculateChecksum(pkt, pkt.length);
      pkt.push(ck, 0x00);
      return pkt;
    };

    const sentCommands = [];
    vi.spyOn(BleSutoAPI, 'isConnected').mockReturnValue(true);
    BleSutoAPI.devAddr = 1;
    BleSutoAPI.systemInfo = { device_id: 0x1230, device_name: 'SUTO S403' };

    vi.spyOn(BleSutoAPI, 'writeAndRead').mockImplementation(async (pkt) => {
      // pkt: [addr, totalLen, CTY, SCTY, ACT, ...cksum, 0x00]
      const cmd = pkt.slice(2, pkt.length - 2);
      sentCommands.push(Array.from(cmd));

      const act = cmd[2];
      if (act === 0x01) {
        // Log enable
        return makeReply([1]);
      }
      if (act === 0x02) {
        // ACT_GET_LOG_RECORDED_NUM -> returns 4 bytes (e.g. 1500 records)
        const buf = new Uint8Array(4);
        new DataView(buf.buffer).setUint32(0, 1500, true);
        return makeReply(Array.from(buf));
      }
      if (act === 0x03) {
        // ACT_GET_LOG_START_END_TIME -> returns 8 bytes (start: 1700000000, end: 1700086400)
        const buf = new Uint8Array(8);
        const dv = new DataView(buf.buffer);
        dv.setUint32(0, 1700000000, true);
        dv.setUint32(4, 1700086400, true);
        return makeReply(Array.from(buf));
      }
      if (cmd[0] === 0x03 && cmd[1] === 0x02 && cmd[2] === 0x04) {
        // Log sample rate for S403
        const buf = new Uint8Array(4);
        new DataView(buf.buffer).setUint32(0, 60, true);
        return makeReply(Array.from(buf));
      }
      return makeReply([]);
    });

    const status = await BleSutoAPI.getLoggerStatus();
    expect(status).toBeDefined();
    expect(status.enabled).toBe(true);
    expect(status.recorded_count).toBe(1500);
    expect(status.start_time).toBe(1700000000);
    expect(status.end_time).toBe(1700086400);
    expect(status.package_interval).toBe(60);

    // Verify opcodes:
    // Recorded num must use act=0x02: [0x03, 0x01, 0x02]
    expect(sentCommands.some(c => c[0] === 0x03 && c[1] === 0x01 && c[2] === 0x02)).toBe(true);
    // Start/end time must use act=0x03: [0x03, 0x01, 0x03]
    expect(sentCommands.some(c => c[0] === 0x03 && c[1] === 0x01 && c[2] === 0x03)).toBe(true);

    vi.restoreAllMocks();
  });

  it('readS403Log uses ACT_GET_LOG_CONTINUALLY (0x05) to read chunks', async () => {
    const makeReply = (payload) => {
      const pkt = [1, 2 + 1 + payload.length + 2, 0x3e, ...payload];
      const ck = BleSutoAPI._calculateChecksum(pkt, pkt.length);
      pkt.push(ck, 0x00);
      return pkt;
    };

    vi.spyOn(BleSutoAPI, 'isConnected').mockReturnValue(true);
    BleSutoAPI.devAddr = 1;
    BleSutoAPI.systemInfo = { device_id: 0x1230, device_name: 'SUTO S403' };

    const sentCommands = [];
    vi.spyOn(BleSutoAPI, 'writeAndRead').mockImplementation(async (pkt) => {
      const cmd = pkt.slice(2, pkt.length - 2);
      sentCommands.push(Array.from(cmd));

      // Time position cmd [0x03, 0x01, 0x08, startSec, stopSec]
      if (cmd[0] === 0x03 && cmd[1] === 0x01 && cmd[2] === 0x08) {
        const buf = new Uint8Array(8);
        const dv = new DataView(buf.buffer);
        dv.setInt32(0, 0, true); // startPos = 0
        dv.setInt32(4, 1, true); // endPos = 1 (1 record)
        return makeReply(Array.from(buf));
      }
      // Start line cmd [0x03, 0x01, 0x04, startPos]
      if (cmd[0] === 0x03 && cmd[1] === 0x01 && cmd[2] === 0x04) {
        return makeReply([]);
      }
      // VA query cmds [0x09, 0x03, act]
      if (cmd[0] === 0x09) {
        return makeReply([14]);
      }
      // Read continually cmd [0x03, 0x01, 0x05, chunkSize]
      if (cmd[0] === 0x03 && cmd[1] === 0x01 && cmd[2] === 0x05) {
        // Return 1 UI record (28 bytes)
        const rec = new Uint8Array(28);
        const dv = new DataView(rec.buffer);
        dv.setUint32(0, 1700000000, true); // ts
        dv.setFloat32(4, 120.5, true);     // flow
        dv.setFloat32(8, 15.2, true);      // velocity
        dv.setFloat64(12, 1000.0, true);   // cons
        dv.setFloat32(20, 6.5, true);      // press
        dv.setFloat32(24, 25.0, true);     // temp
        return makeReply(Array.from(rec));
      }
      return makeReply([]);
    });

    const result = await BleSutoAPI.readS403Log(1700000000, 1700086400);
    expect(result).toBeDefined();
    expect(result.row_count).toBe(1);
    expect(result.csv_text).toContain('120.5');

    // Verify ACT_GET_LOG_CONTINUALLY (0x05) was used
    expect(sentCommands.some(c => c[0] === 0x03 && c[1] === 0x01 && c[2] === 0x05)).toBe(true);

    vi.restoreAllMocks();
  });
});
