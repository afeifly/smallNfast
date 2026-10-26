import { describe, it, expect } from 'vitest';
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

  it('provides complete metadata on fallback dummy channels when no device descriptors are returned', async () => {
    // Force cachedChannels empty and get fallback
    BleSutoAPI.cachedChannels = [];
    const chs = await BleSutoAPI.getChannels();
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
});
