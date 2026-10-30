import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiDeviceDriver } from './ApiDevice';

describe('ApiDeviceDriver', () => {
  let driver;

  beforeEach(() => {
    driver = new ApiDeviceDriver();
  });

  afterEach(() => {
    driver.disconnect();
    vi.restoreAllMocks();
  });

  it('correctly maps S332 classchannel response into standard S4A channels', async () => {
    const mockApiResponse = {
      status: 'OK',
      data: {
        classchannel: [
          {
            channelid: 0,
            channeldescription: 'Pressure',
            sensordescription: 'S011_Pr_Sensor#1',
            Unitascii: 'MPa(g)',
            Unitindex: 4,
            Resolution: 2,
            DValue: 6.25,
            SensorID: 101,
            deviceid: 1,
            Show: true,
            Status: 4,
          },
          {
            channelid: 1,
            channeldescription: 'Flow',
            sensordescription: 'S401',
            Unitascii: 'm3/h',
            Unitindex: 1,
            Resolution: 1,
            DValue: 120.5,
            SensorID: 102,
            deviceid: 1,
            Show: true,
            Status: 0,
          },
        ],
      },
    };

    vi.spyOn(driver, 'fetchJson').mockResolvedValue(mockApiResponse);

    const channels = await driver.getChannels();
    expect(channels.length).toBe(2);

    expect(channels[0]).toMatchObject({
      channel_id: 0,
      channel_name: 'Pressure',
      sensor_description: 'S011_Pr_Sensor#1',
      unit: 'MPa(g)',
      unit_in_ascii: 'MPa(g)',
      resolution: 2,
      sensor_id: 101,
      device_id: 1,
      active: true,
      selected: true,
    });

    expect(channels[1]).toMatchObject({
      channel_id: 1,
      channel_name: 'Flow',
      sensor_description: 'S401',
      unit: 'm3/h',
      resolution: 1,
      selected: false,
    });
  });

  it('fetches and normalizes layout points from cfgLayout.json', async () => {
    const mockLayout = {
      LayoutList: [
        {
          index: 0,
          location: 'S011',
          meapoint: 'S011',
          channels: ['1793260498947'],
        },
      ],
    };

    vi.spyOn(driver, 'fetchJson').mockResolvedValue(mockLayout);
    const layout = await driver.getLayoutInfo();
    expect(layout.length).toBe(1);
    expect(layout[0].location).toBe('S011');
    expect(layout[0].meapoint).toBe('S011');
    expect(layout[0].channels).toEqual(['1793260498947']);
  });

  it('correctly maps device-info and system information into normalized system info', async () => {
    vi.spyOn(driver, 'fetchJson').mockImplementation(async (path) => {
      if (path === '/system/information') {
        return {
          code: 200,
          data: {
            sn: '12341234',
            fw: '1.0.3-Atlas11',
            hw: 'v1.0.0-alpha.1',
            type: 'DL G2',
          },
          status: true,
        };
      }
      if (path === '/system/device-info') {
        return {
          code: 200,
          data: {
            device_id: '0x108F',
            device_name: 'S332',
            device_type: 'DL G2',
          },
          status: true,
        };
      }
      return {};
    });

    const info = await driver.getSystemInfo();
    expect(info).toEqual({
      device_id: '0x108F',
      device_name: 'S332',
      serial_number: '12341234',
      device_type: 'DL G2',
      firmware_version: '1.0.3-Atlas11',
      hardware_version: 'v1.0.0-alpha.1',
      calibration_date: null,
    });
  });

  it('fetches and calculates disk capacity correctly', async () => {
    vi.spyOn(driver, 'fetchJson').mockResolvedValue({
      status: true,
      code: 200,
      logger_space: {
        total: 10000,
        free: 8000,
      },
    });

    const disk = await driver.getDiskCapacity();
    expect(disk).toEqual({
      total: 10000,
      free: 8000,
      used: 2000,
      percentUsed: '20.0',
      userSpace: null,
    });
  });

  it('buffers online measurements from channel polling and formats measurement data', async () => {
    const mockChannelResp = {
      status: 'OK',
      data: {
        classchannel: [
          {
            channelid: 0,
            channeldescription: 'Pressure',
            sensordescription: 'S011',
            Unitascii: 'bar',
            Resolution: 2,
            DValue: 7.42,
          },
        ],
      },
    };

    vi.spyOn(driver, 'fetchJson').mockResolvedValue(mockChannelResp);
    driver.connected = true;

    // Simulate two polling ticks
    await driver.pollChannels();
    await driver.pollChannels();

    const mData = await driver.getMeasurementData();
    expect(mData.length).toBe(1);
    expect(mData[0].channel_id).toBe(0);
    expect(mData[0].current_value).toBe(7.42);
    expect(mData[0].measurementData[0].length).toBe(2);
    expect(mData[0].measurementData[0]).toEqual([7.42, 7.42]);
  });

  it('reads paged logger records and constructs valid CSV', async () => {
    const page1 = {
      code: 200,
      status: true,
      meta_data: {
        channel_info: [
          { index: 0, description: 'Consumption', unit_ascii: 'm3' },
        ],
        current_page: 1,
        total_pages: 2,
      },
      record_data: [
        { timestamp: 1700000000000, datas: [{ channel_index: 0, value: 100 }] },
      ],
    };

    const page2 = {
      code: 200,
      status: true,
      meta_data: {
        channel_info: [
          { index: 0, description: 'Consumption', unit_ascii: 'm3' },
        ],
        current_page: 2,
        total_pages: 2,
      },
      record_data: [
        { timestamp: 1700000001000, datas: [{ channel_index: 0, value: 105 }] },
      ],
    };

    vi.spyOn(driver, 'fetchJson').mockImplementation((endpoint) => {
      if (endpoint.includes('page_index=1')) return Promise.resolve(page1);
      if (endpoint.includes('page_index=2')) return Promise.resolve(page2);
      return Promise.reject(new Error('Unknown'));
    });

    const progressReports = [];
    const res = await driver.readLoggerData('test_log', (p) => progressReports.push(p.percent));

    expect(res.rowCount).toBe(2);
    expect(res.filename).toBe('test_log.csv');
    expect(res.rows.length).toBe(2);
    expect(res.rows[0].values[0]).toBe(100);
    expect(res.rows[1].values[0]).toBe(105);
    expect(progressReports).toEqual([50, 100]);
    expect(res.csv_text).toContain('Raw Data');
    expect(res.csv_text).toContain('No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point');
    expect(res.csv_text).toContain('Date Time,Consumption - m3');
    expect(res.csv_text).toContain('100.00');
    expect(res.csv_text).toContain('105.00');
  });

  it('rejects connection when device IP is unreachable', async () => {
    vi.spyOn(driver, 'fetchJson').mockRejectedValue(new Error('Network error: connect ETIMEDOUT'));

    await expect(driver.connect({ host: '192.168.99.99' })).rejects.toThrow(
      /Cannot reach S332 device at http:\/\/192.168.99.99:8080/
    );
    expect(driver.connected).toBe(false);
  });

  it('rejects connection when response is not a valid S332 device', async () => {
    // e.g. An arbitrary router or printer responding with other JSON
    vi.spyOn(driver, 'fetchJson').mockResolvedValue({ some_other_api: true });

    await expect(driver.connect({ host: '192.168.1.1' })).rejects.toThrow(
      /is not a valid S332 unit/
    );
    expect(driver.connected).toBe(false);
  });

  it('successfully connects when valid S332 channel/list response is received', async () => {
    vi.spyOn(driver, 'fetchJson').mockImplementation((endpoint) => {
      if (endpoint === '/channel/list') {
        return Promise.resolve({
          status: 'OK',
          data: {
            classchannel: [
              {
                channelid: 0,
                channeldescription: 'Pressure',
                sensordescription: 'S011',
                Unitascii: 'bar',
                Resolution: 2,
                DValue: 5.5,
              },
            ],
          },
        });
      }
      if (endpoint === '/system/device-info') {
        return Promise.resolve({
          code: 200,
          status: true,
          data: { device_id: '0x108F', device_name: 'S332-Real' },
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    const conn = await driver.connect({ host: '192.168.5.217' });
    expect(driver.connected).toBe(true);
    expect(conn.name).toBe('S332-Real');
    expect(conn.address).toBe('192.168.5.217'); // Clean host without :8080
    expect(driver.cachedChannels.length).toBe(1);
    expect(driver.cachedChannels[0].channel_name).toBe('Pressure');
  });

  it('correctly maps all S332 device ID variants (0x1088 - 0x108F)', async () => {
    const s332Variants = [
      { id: '0x1088', expected: 'S332+A3001' },
      { id: '0x1089', expected: 'S332+A3002' },
      { id: '0x108a', expected: 'S332-OPT-Relay2ch' },
      { id: '0x108b', expected: 'S332-OPT-Current' },
      { id: '0x108c', expected: 'S332-OPT-Voltage' },
      { id: '0x108d', expected: 'S332-OPT-Digital input' },
      { id: '0x108e', expected: 'S332-OPT-Relay4ch' },
      { id: '0x108f', expected: 'DL G2' },
    ];

    for (const v of s332Variants) {
      vi.spyOn(driver, 'fetchJson').mockImplementation((endpoint) => {
        if (endpoint === '/system/device-info') {
          return Promise.resolve({
            code: 200,
            status: true,
            data: { device_id: v.id },
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      const sys = await driver.getSystemInfo();
      expect(sys.device_name).toBe(v.expected);
    }
  });
});

