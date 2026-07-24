import { describe, it, expect, vi } from 'vitest';
import {
  getUsedChannelIds,
  isSensorUsedInLogger,
  isChannelUsedInLogger,
  remarshalAll,
  getUsedLayoutChannelIds,
  isSensorUsedInAlarm,
  isSensorUsedInLayout,
  isChannelUsedInAlarm,
  isChannelUsedInLayout,
} from './remarshalUtils';

vi.mock('./alarmDbUtils', () => {
  return {
    openAlarmDb: vi.fn(async (fileMap) => {
      if (!fileMap) return null;
      return { db: { close: () => {} } };
    }),
    readAlarmConfigs: vi.fn((db) => {
      return [
        { channel_identify_id: '12345' },
        { channel_identify_id: '67890' }
      ];
    })
  };
});

function makeConfigData(configs) {
  return { configs };
}

describe('getUsedChannelIds', () => {
  it('returns an empty set when no configData is provided', () => {
    const result = getUsedChannelIds(null);
    expect(result).toEqual(new Set());
  });

  it('returns an empty set when configs is missing the logger paths', () => {
    const configData = makeConfigData({ 'other/file.json': {} });
    const result = getUsedChannelIds(configData);
    expect(result).toEqual(new Set());
  });

  it('extracts channel IDs from the cfglogger config', () => {
    const configData = makeConfigData({
      'config/cfglogger.json': {
        logger: {
          channelArray: [
            { channelid: 0 },
            { channelid: 3 },
            { channelid: 7 },
          ],
        },
      },
    });

    const result = getUsedChannelIds(configData);
    expect(result).toEqual(new Set([0, 3, 7]));
  });

  it('finds cfglogger at alternate paths', () => {
    const configData = makeConfigData({
      'cfglogger.json': {
        logger: { channelArray: [{ channelid: 1 }] },
      },
    });
    expect(getUsedChannelIds(configData)).toEqual(new Set([1]));
  });

  it('handles missing channelArray gracefully', () => {
    const configData = makeConfigData({
      'config/cfglogger.json': { logger: {} },
    });
    expect(getUsedChannelIds(configData)).toEqual(new Set());
  });
});

describe('isSensorUsedInLogger', () => {
  const configData = makeConfigData({
    'config/cfglogger.json': {
      logger: { channelArray: [{ channelid: 5 }, { channelid: 10 }] },
    },
  });

  it('returns null when no channel is in use', () => {
    const sensor = { cfgchannel: [{ ChannelId: 1 }] };
    expect(isSensorUsedInLogger(configData, sensor)).toBeNull();
  });

  it('returns the channel description when a channel is in use', () => {
    const sensor = {
      cfgchannel: [
        { ChannelId: 5, ChannelDescription: 'Flow Rate' },
      ],
    };
    expect(isSensorUsedInLogger(configData, sensor)).toBe('Flow Rate');
  });

  it('falls back to "CH <id>" when no description is present', () => {
    const sensor = { cfgchannel: [{ ChannelId: 10 }] };
    expect(isSensorUsedInLogger(configData, sensor)).toBe('CH 10');
  });

  it('supports channelid and ChannelID field variants', () => {
    expect(isSensorUsedInLogger(configData, { cfgchannel: [{ channelid: 5 }] })).toBeTruthy();
    expect(isSensorUsedInLogger(configData, { cfgchannel: [{ ChannelID: 10 }] })).toBeTruthy();
  });
});

describe('isChannelUsedInLogger', () => {
  const configData = makeConfigData({
    'config/cfglogger.json': {
      logger: { channelArray: [{ channelid: 7 }] },
    },
  });

  it('returns true when the channel ID is in the logger', () => {
    expect(isChannelUsedInLogger(configData, { ChannelId: 7 })).toBe(true);
  });

  it('returns false when the channel ID is not in the logger', () => {
    expect(isChannelUsedInLogger(configData, { ChannelId: 99 })).toBe(false);
  });

  it('returns false for undefined channel ID', () => {
    expect(isChannelUsedInLogger(configData, {})).toBe(false);
  });
});

describe('remarshalAll', () => {
  it('returns configData unchanged when no configs present', () => {
    expect(remarshalAll(null)).toBeNull();
    expect(remarshalAll({})).toEqual({});
  });

  it('re-numbers channel IDs starting from 0 across all sensors', () => {
    const configData = makeConfigData({
      'config/SUTO-SensorList.sutolist': {
        cfgsensor: [
          {
            cfgchannel: [
              { ChannelId: 10, ChannelDescription: 'A' },
              { ChannelId: 20, ChannelDescription: 'B' },
            ],
          },
          {
            cfgchannel: [{ ChannelId: 30, ChannelDescription: 'C' }],
          },
        ],
      },
    });

    const result = remarshalAll(configData);
    const sensors = result.configs['config/SUTO-SensorList.sutolist'].cfgsensor;

    expect(sensors[0].cfgchannel[0].ChannelId).toBe(0);
    expect(sensors[0].cfgchannel[1].ChannelId).toBe(1);
    expect(sensors[1].cfgchannel[0].ChannelId).toBe(2);
  });

  it('updates logger channel IDs to match remarshalled values', () => {
    const configData = makeConfigData({
      'config/cfglogger.json': {
        logger: { channelArray: [{ channelid: 10 }, { channelid: 30 }] },
      },
      'config/SUTO-SensorList.sutolist': {
        cfgsensor: [
          { cfgchannel: [{ ChannelId: 10 }] },
          { cfgchannel: [{ ChannelId: 30 }] },
        ],
      },
    });

    const result = remarshalAll(configData);
    const channelArray = result.configs['config/cfglogger.json'].logger.channelArray;

    expect(channelArray[0].channelid).toBe(0);
    expect(channelArray[1].channelid).toBe(1);
  });

  it('remarshals option board channels in cfgOptionBoard.json', () => {
    const configData = makeConfigData({
      'config/cfglogger.json': {
        logger: { channelArray: [{ channelid: 10 }, { channelid: 50 }] },
      },
      'config/SUTO-SensorList.sutolist': {
        cfgsensor: [
          { cfgchannel: [{ ChannelId: 10 }] }
        ],
      },
      'config/cfgOptionBoard.json': {
        cfgOptionBoard: [
          { ChannelId: 50, TerminalNo: 4 }
        ]
      }
    });

    const result = remarshalAll(configData);
    const sensorChannel = result.configs['config/SUTO-SensorList.sutolist'].cfgsensor[0].cfgchannel[0];
    const obChannel = result.configs['config/cfgOptionBoard.json'].cfgOptionBoard[0];
    const loggerArray = result.configs['config/cfglogger.json'].logger.channelArray;

    expect(sensorChannel.ChannelId).toBe(0);
    expect(obChannel.ChannelId).toBe(2004);
    expect(loggerArray[0].channelid).toBe(0);
    expect(loggerArray[1].channelid).toBe(2004);
  });

  it('syncs Logger boolean flag on channels and converts starttime to seconds', () => {
    const configData = makeConfigData({
      'config/cfglogger.json': {
        logger: {
          starttime: 1784822400000,
          channelArray: [{ channelid: 0 }]
        },
      },
      'config/SUTO-SensorList.sutolist': {
        cfgsensor: [
          {
            cfgchannel: [
              { ChannelId: 0, Logger: false },
              { ChannelId: 1, Logger: true }
            ]
          }
        ],
      }
    });

    const result = remarshalAll(configData);
    const channels = result.configs['config/SUTO-SensorList.sutolist'].cfgsensor[0].cfgchannel;
    const logger = result.configs['config/cfglogger.json'].logger;

    expect(channels[0].Logger).toBe(true);
    expect(channels[1].Logger).toBe(false);
    expect(logger.starttime).toBe(1784822400);
  });

  it('syncs EnableAlarm and alarm threshold parameters when activeAlarms array is passed', () => {
    const configData = makeConfigData({
      'config/SUTO-SensorList.sutolist': {
        cfgsensor: [
          {
            cfgchannel: [
              { ChannelId: 0, CreateTime: '10001', EnableAlarm: false },
              { ChannelId: 1, CreateTime: '10002', EnableAlarm: true }
            ]
          }
        ],
      }
    });

    const activeAlarms = [
      {
        channel_identify_id: '10001',
        threshold: 100.5,
        hysteresis: 2.5,
        direction: 'up',
        relay_id: 2
      }
    ];

    const result = remarshalAll(configData, activeAlarms);
    const channels = result.configs['config/SUTO-SensorList.sutolist'].cfgsensor[0].cfgchannel;

    expect(channels[0].EnableAlarm).toBe(true);
    expect(channels[0].MaxThreshold).toBe(100.5);
    expect(channels[0].MaxHysteresis).toBe(2.5);
    expect(channels[0].Direction).toBe(0); // up -> 0
    expect(channels[0].RelayIndex).toBe(2);

    expect(channels[1].EnableAlarm).toBe(false);
  });

  it('handles sensors with no channels', () => {
    const configData = makeConfigData({
      'config/SUTO-SensorList.sutolist': {
        cfgsensor: [{ name: 'no-channels' }],
      },
    });

    const result = remarshalAll(configData);
    const sensor = result.configs['config/SUTO-SensorList.sutolist'].cfgsensor[0];
    expect(sensor.cfgchannel).toEqual([]);
  });

  it('handles empty sensor list', () => {
    const configData = makeConfigData({
      'config/SUTO-SensorList.sutolist': { cfgsensor: [] },
    });

    const result = remarshalAll(configData);
    expect(result.configs['config/SUTO-SensorList.sutolist'].cfgsensor).toEqual([]);
  });
});

describe('layout and alarm checks', () => {
  describe('getUsedLayoutChannelIds', () => {
    it('returns empty set if layout config is missing', () => {
      expect(getUsedLayoutChannelIds(null)).toEqual(new Set());
      expect(getUsedLayoutChannelIds({})).toEqual(new Set());
    });

    it('extracts channel IDs from cfgLocation.json', () => {
      const configData = {
        configs: {
          'config/cfgLocation.json': {
            Locations: [
              {
                meapoints: [
                  { channels: ['100', '200'] },
                  { channels: ['300'] }
                ]
              }
            ]
          }
        }
      };
      expect(getUsedLayoutChannelIds(configData)).toEqual(new Set(['100', '200', '300']));
    });
  });

  describe('isSensorUsedInAlarm', () => {
    it('returns used channel name if channel is in alarm', async () => {
      const configData = { fileMap: new Map() };
      const sensor = {
        cfgchannel: [
          { CreateTime: '12345', ChannelDescription: 'Pressure' }
        ]
      };
      const result = await isSensorUsedInAlarm(configData, sensor);
      expect(result).toBe('Pressure');
    });

    it('returns null if no channels are in alarm', async () => {
      const configData = { fileMap: new Map() };
      const sensor = {
        cfgchannel: [
          { CreateTime: '99999', ChannelDescription: 'Pressure' }
        ]
      };
      const result = await isSensorUsedInAlarm(configData, sensor);
      expect(result).toBeNull();
    });
  });

  describe('isSensorUsedInLayout', () => {
    const configData = {
      configs: {
        'config/cfgLocation.json': {
          Locations: [
            { meapoints: [{ channels: ['100'] }] }
          ]
        }
      }
    };

    it('returns used channel name if channel is in layout', () => {
      const sensor = {
        cfgchannel: [
          { CreateTime: '100', ChannelDescription: 'Temperature' }
        ]
      };
      expect(isSensorUsedInLayout(configData, sensor)).toBe('Temperature');
    });

    it('returns null if no channels are in layout', () => {
      const sensor = {
        cfgchannel: [
          { CreateTime: '200', ChannelDescription: 'Temperature' }
        ]
      };
      expect(isSensorUsedInLayout(configData, sensor)).toBeNull();
    });
  });

  describe('isChannelUsedInAlarm', () => {
    it('returns true if channel is in alarm', async () => {
      const configData = { fileMap: new Map() };
      expect(await isChannelUsedInAlarm(configData, { CreateTime: '12345' })).toBe(true);
    });

    it('returns false if channel is not in alarm', async () => {
      const configData = { fileMap: new Map() };
      expect(await isChannelUsedInAlarm(configData, { CreateTime: '999' })).toBe(false);
    });
  });

  describe('isChannelUsedInLayout', () => {
    const configData = {
      configs: {
        'config/cfgLocation.json': {
          Locations: [
            { meapoints: [{ channels: ['100'] }] }
          ]
        }
      }
    };

    it('returns true if channel is in layout', () => {
      expect(isChannelUsedInLayout(configData, { CreateTime: '100' })).toBe(true);
    });

    it('returns false if channel is not in layout', () => {
      expect(isChannelUsedInLayout(configData, { CreateTime: '200' })).toBe(false);
    });
  });
});
