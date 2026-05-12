import { describe, it, expect } from 'vitest';
import {
  getUsedChannelIds,
  isSensorUsedInLogger,
  isChannelUsedInLogger,
  remarshalAll,
} from './remarshalUtils';

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
