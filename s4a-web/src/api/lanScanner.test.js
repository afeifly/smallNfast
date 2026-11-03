import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TauriSutoAPI from './TauriSutoAPI';
import {
  getDefaultSubnet,
  probeDeviceAtIp,
  scanLanRange,
  discoverDevicesViaBroadcast,
  convertDiscoveredToSensorManagerDevice
} from './lanScanner';

describe('lanScanner Engine', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('getDefaultSubnet returns 192.168.5. by default or extracts from window.location', () => {
    const sub = getDefaultSubnet();
    expect(sub).toBeDefined();
    expect(sub.endsWith('.')).toBe(true);
  });

  it('probeDeviceAtIp detects S332 WebAPI device responding with classchannel', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes(':8080/channel/list')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              classchannel: [
                { channelid: 1, channeldescription: 'Dew point', Unitascii: '°C Td' },
                { channelid: 2, channeldescription: 'Temperature', Unitascii: '°C' }
              ]
            }
          })
        });
      }
      if (url.includes(':8080/system/device-info')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              devicename: 'S332',
              device_id: '0x108F',
              serialnumber: '12341234'
            }
          })
        });
      }
      if (url.includes(':8080/system/information')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              sn: '12341234',
              fw: '1.0.3-Atlas11'
            }
          })
        });
      }
      return Promise.reject(new Error('Connection refused'));
    });

    const dev = await probeDeviceAtIp('192.168.5.28', { timeoutMs: 300 });
    expect(dev).not.toBeNull();
    expect(dev.ip).toBe('192.168.5.28');
    expect(dev.name).toBe('S332');
    expect(dev.serial).toBe('12341234');
    expect(dev.firmware).toBe('1.0.3-Atlas11');
    expect(dev.channelsCount).toBe(2);
  });

  it('probeDeviceAtIp returns null when host is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Host unreachable'));
    const dev = await probeDeviceAtIp('192.168.5.99', { timeoutMs: 100 });
    expect(dev).toBeNull();
  });

  it('scanLanRange scans range, reports progress, and collects responding devices', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('192.168.5.28:8080/channel/list')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              classchannel: [{ channelid: 1, channeldescription: 'Flow', Unitascii: 'm³/h' }]
            }
          })
        });
      }
      return Promise.reject(new Error('Connection timed out'));
    });

    const progressReports = [];
    const discovered = [];

    const results = await scanLanRange({
      subnet: '192.168.5.',
      start: 25,
      end: 30,
      batchSize: 5,
      timeoutMs: 100,
      onProgress: (p) => progressReports.push(p),
      onDeviceFound: (d) => discovered.push(d)
    });

    expect(results.length).toBe(1);
    expect(results[0].ip).toBe('192.168.5.28');
    expect(discovered.length).toBe(1);
    expect(progressReports.length).toBeGreaterThan(0);
    expect(progressReports[progressReports.length - 1].percent).toBe(100);
  });

  it('convertDiscoveredToSensorManagerDevice produces a complete SensorManager device node', () => {
    const rawDisc = {
      ip: '192.168.5.28',
      name: 'S332',
      transport: 'API',
      transportLabel: 'S332 API (192.168.5.28)',
      serial: '12341234',
      rawChannels: [
        { channelid: 1, channeldescription: 'Dew point', Unitascii: '°C Td' },
        { channelid: 2, channeldescription: 'Temperature', Unitascii: '°C' }
      ],
      rawSysInfo: {
        device_name: 'S332',
        serial_number: '12341234'
      }
    };

    const smDev = convertDiscoveredToSensorManagerDevice(rawDisc);
    expect(smDev).not.toBeNull();
    expect(smDev.id).toBeDefined();
    expect(smDev.name).toBe('S332');
    expect(smDev.sensors.length).toBeGreaterThan(0);
    const allChs = smDev.sensors.flatMap(s => s.channels);
    expect(allChs.length).toBe(2);
    expect(allChs[0].name).toBe('Dew point');
  });

  it('discoverDevicesViaBroadcast uses CSLib UDP broadcast command and fetches device channels', async () => {
    vi.spyOn(TauriSutoAPI, 'discoverEthernetBroadcast').mockResolvedValueOnce([
      { ip: '192.168.5.28', mac: '00:08:DC:12:34:56', device_number: 23, port: 8800 }
    ]);

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes(':8080/channel/list')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              classchannel: [
                { channelid: 1, channeldescription: 'Dew point', Unitascii: '°C Td' }
              ]
            }
          })
        });
      }
      if (url.includes(':8080/system/device-info')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              devicename: 'S332 Station',
              serialnumber: 'SN-332999'
            }
          })
        });
      }
      return Promise.reject(new Error('unhandled mock url'));
    });

    const found = [];
    const devices = await discoverDevicesViaBroadcast({
      timeoutMs: 1000,
      subnet: '192.168.5.',
      onDeviceFound: (d) => found.push(d)
    });

    expect(devices.length).toBe(1);
    expect(devices[0].ip).toBe('192.168.5.28');
    expect(devices[0].mac).toBe('00:08:DC:12:34:56');
    expect(devices[0].name).toBe('S332 Station');
    expect(devices[0].channelsCount).toBe(1);
    expect(found.length).toBe(1);
  });
});

