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
});
