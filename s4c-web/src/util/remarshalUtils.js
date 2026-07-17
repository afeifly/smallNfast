/**
 * Utility to manage ChannelId remarshaling and usage checks.
 */

import { openAlarmDb, readAlarmConfigs } from './alarmDbUtils';

const CFGLOGGER_PATHS = [
  'config/cfglogger.json',
  '/config/cfglogger.json',
  'cfglogger.json',
];

const SUTOLIST_PATHS = [
  'config/SUTO-SensorList.sutolist',
  '/config/SUTO-SensorList.sutolist',
];

/** Find a config key by candidate paths */
function findPath(configs, paths) {
  if (!configs) return null;
  for (const p of paths) {
    if (configs[p] !== undefined) return p;
  }
  return null;
}

/** Get a set of ChannelIds currently used in the logger */
export function getUsedChannelIds(configData) {
  const path = findPath(configData?.configs, CFGLOGGER_PATHS);
  if (!path) return new Set();
  
  const logger = configData.configs[path]?.logger;
  const channelArray = logger?.channelArray || [];
  
  return new Set(channelArray.map(ch => ch.channelid));
}

/** 
 * Check if any channel in a sensor is used in the logger.
 * Returns the first used channel description if found, else null.
 */
export function isSensorUsedInLogger(configData, sensor) {
  const usedIds = getUsedChannelIds(configData);
  for (const ch of (sensor.cfgchannel || [])) {
    const cid = ch.ChannelId ?? ch.channelid ?? ch.ChannelID;
    if (cid !== undefined && usedIds.has(cid)) {
      return ch.ChannelDescription || `CH ${cid}`;
    }
  }
  return null;
}

/**
 * Check if a specific channel is used in the logger.
 */
export function isChannelUsedInLogger(configData, channel) {
  const usedIds = getUsedChannelIds(configData);
  const cid = channel.ChannelId ?? channel.channelid ?? channel.ChannelID;
  return (cid !== undefined && usedIds.has(cid));
}

/** Get a set of channel_identify_id (matching CreateTime) currently used in alarms */
export async function getUsedAlarmChannelIds(configData) {
  const fileMap = configData?.fileMap;
  if (!fileMap) return new Set();
  
  try {
    const result = await openAlarmDb(fileMap);
    if (!result) return new Set();
    const { db } = result;
    const alarms = readAlarmConfigs(db) || [];
    db.close();
    
    // channel_identify_id in DB corresponds to CreateTime
    return new Set(alarms.map(a => String(a.channel_identify_id)));
  } catch (err) {
    console.error('Error getting used alarm channel IDs:', err);
    return new Set();
  }
}

/** Get a set of ChannelIds (CreateTime strings) currently used in layout points */
export function getUsedLayoutChannelIds(configData) {
  if (!configData?.configs) return new Set();
  const path = Object.keys(configData.configs).find(p => p.endsWith('cfgLocation.json'));
  if (!path) return new Set();
  
  const locations = configData.configs[path]?.Locations || [];
  const usedIds = new Set();
  for (const loc of locations) {
    for (const mp of (loc.meapoints || [])) {
      for (const chId of (mp.channels || [])) {
        if (chId !== undefined && chId !== null) {
          usedIds.add(String(chId));
        }
      }
    }
  }
  return usedIds;
}

/** Check if any channel in a sensor is used in the alarm database. */
export async function isSensorUsedInAlarm(configData, sensor) {
  const usedIds = await getUsedAlarmChannelIds(configData);
  for (const ch of (sensor.cfgchannel || [])) {
    const cid = String(ch.CreateTime || ch.CreatedOn || ch.channelid || '');
    if (cid && usedIds.has(cid)) {
      return ch.ChannelDescription || `CH ${cid}`;
    }
  }
  return null;
}

/** Check if any channel in a sensor is used in the layout configuration. */
export function isSensorUsedInLayout(configData, sensor) {
  const usedIds = getUsedLayoutChannelIds(configData);
  for (const ch of (sensor.cfgchannel || [])) {
    const cid = String(ch.CreateTime || ch.CreatedOn || ch.channelid || '');
    if (cid && usedIds.has(cid)) {
      return ch.ChannelDescription || `CH ${cid}`;
    }
  }
  return null;
}

/** Check if a specific channel is used in alarms. */
export async function isChannelUsedInAlarm(configData, channel) {
  const usedIds = await getUsedAlarmChannelIds(configData);
  const cid = String(channel.CreateTime || channel.CreatedOn || channel.channelid || '');
  return cid !== '' && usedIds.has(cid);
}

/** Check if a specific channel is used in layout. */
export function isChannelUsedInLayout(configData, channel) {
  const usedIds = getUsedLayoutChannelIds(configData);
  const cid = String(channel.CreateTime || channel.CreatedOn || channel.channelid || '');
  return cid !== '' && usedIds.has(cid);
}

/**
 * Remarshal all ChannelIds across all sensors starting from 0.
 * Also updates the logger's channelid values to keep them in sync.
 */
export function remarshalAll(configData) {
  if (!configData?.configs) return configData;

  const listPath = findPath(configData.configs, SUTOLIST_PATHS);
  if (!listPath) return configData;

  const currentList = configData.configs[listPath];
  const sensors = [...(currentList.cfgsensor || [])];
  
  const idMap = new Map(); // oldId -> newId
  let nextId = 0;

  // 1. Remarshal sensors inside SUTO-SensorList.sutolist
  const updatedSensors = sensors.map(sensor => {
    const updatedChannels = (sensor.cfgchannel || []).map(ch => {
      const oldId = ch.ChannelId ?? ch.channelid ?? ch.ChannelID;
      const newId = nextId++;
      
      if (oldId !== undefined) {
        idMap.set(oldId, newId);
      }
      
      // Preserve the field name that was already there, but update the value
      // We'll standardize to ChannelId as requested, but keep other variants if they exist
      const newCh = { ...ch, ChannelId: newId };
      if (newCh.channelid !== undefined) newCh.channelid = newId;
      if (newCh.ChannelID !== undefined) newCh.ChannelID = newId;
      
      return newCh;
    });
    
    return { ...sensor, cfgchannel: updatedChannels };
  });

  let nextConfigs = {
    ...configData.configs,
    [listPath]: {
      ...currentList,
      cfgsensor: updatedSensors
    }
  };

  // 2. Remarshal Option Board channels in cfgOptionBoard.json
  const obPath = findPath(configData.configs, [
    'config/cfgOptionBoard.json',
    '/config/cfgOptionBoard.json',
    'cfgOptionBoard.json'
  ]);
  if (obPath && configData.configs[obPath]?.cfgOptionBoard) {
    const obConfig = configData.configs[obPath];
    const obChannels = obConfig.cfgOptionBoard || [];
    const updatedObChannels = obChannels.map(ch => {
      const oldId = ch.ChannelId ?? ch.channelid ?? ch.ChannelID;
      const correctId = 2000 + (ch.TerminalNo || 0);
      
      if (oldId !== undefined) {
        idMap.set(oldId, correctId);
      }
      
      const newCh = { ...ch, ChannelId: correctId };
      if (newCh.channelid !== undefined) newCh.channelid = correctId;
      if (newCh.ChannelID !== undefined) newCh.ChannelID = correctId;
      
      return newCh;
    });
    
    nextConfigs[obPath] = {
      ...obConfig,
      cfgOptionBoard: updatedObChannels
    };
  }

  // Update the sensor list
  let nextConfigData = {
    ...configData,
    configs: nextConfigs
  };

  // 3. Update the logger to match new IDs
  const loggerPath = findPath(configData.configs, CFGLOGGER_PATHS);
  if (loggerPath) {
    const loggerConfig = configData.configs[loggerPath];
    const logger = loggerConfig.logger;
    if (logger?.channelArray) {
      const updatedChannelArray = logger.channelArray.map(ch => {
        const oldId = ch.channelid;
        const newId = idMap.has(oldId) ? idMap.get(oldId) : oldId;
        return { ...ch, channelid: newId };
      });
      
      nextConfigData.configs[loggerPath] = {
        ...loggerConfig,
        logger: {
          ...logger,
          channelArray: updatedChannelArray
        }
      };
    }
  }

  return nextConfigData;
}
