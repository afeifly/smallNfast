/**
 * Utility to manage ChannelId remarshaling and usage checks.
 */

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

  // Update the sensor list
  let nextConfigData = {
    ...configData,
    configs: {
      ...configData.configs,
      [listPath]: {
        ...currentList,
        cfgsensor: updatedSensors
      }
    }
  };

  // Update the logger to match new IDs
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
