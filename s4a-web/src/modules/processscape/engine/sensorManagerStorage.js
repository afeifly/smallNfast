/**
 * Sensor Manager Storage Engine
 * Manages device detection across communication transports (USB, Ethernet TCP, BLE),
 * sensor hierarchy, locations, and measurement point assignments.
 * No fake data: starts empty and allows appending discovered sensors.
 */

import TauriSutoAPI from '../../../api/TauriSutoAPI';
import { getAllScapes, saveScape } from './scapeStorage';

export const STORAGE_KEY_SENSOR_LOCATIONS = 's4a_sensor_locations_v1';
export const STORAGE_KEY_SENSOR_DEVICES = 's4a_sensor_devices_v1';

export const DEFAULT_LOCATIONS = [];

function getStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

/**
 * Get all user locations from storage (defaults to empty)
 */
export function getLocations() {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY_SENSOR_LOCATIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[SensorManager] Error loading locations:', err);
    return [];
  }
}

/**
 * Save user locations to storage
 */
export function saveLocations(locations) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY_SENSOR_LOCATIONS, JSON.stringify(locations));
  } catch (err) {
    console.warn('[SensorManager] Error saving locations:', err);
  }
}

/**
 * Get saved detected devices from storage (defaults to empty)
 */
export function getSavedDevices() {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY_SENSOR_DEVICES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Auto-purge any corrupted items from earlier sessions (e.g. "ressure CH80" or "u0")
    const cleaned = parsed.filter(d => {
      if (!d || !d.name) return false;
      if (d.name.toLowerCase().includes('ressure ch80')) return false;
      return true;
    }).map(d => {
      const cleanSensors = (d.sensors || []).filter(s => {
        return !s.name?.toLowerCase()?.includes('ressure ch80');
      }).map(s => {
        const cleanChannels = (s.channels || []).filter(c => {
          return !c.name?.toLowerCase()?.includes('ressure ch80');
        }).map(c => ({
          ...c,
          name: /^ressure/i.test(c.name || '') ? 'P' + c.name : c.name,
          unit: (c.unit === 'u0' || c.unit === 'u255') ? '' : c.unit
        }));
        return { ...s, channels: cleanChannels };
      });

      // Auto-consolidate split transducer groups (e.g. "451" flow core + "Pressure" transducer on S403)
      const hasSplitTransducers = cleanSensors.length > 1 && cleanSensors.some(s => {
        const n = (s.name || '').toLowerCase();
        return n.includes('451') || n.includes('pressure') || n.includes('transducer');
      });
      const isStandaloneOrS403 = /S\s?40[1-9]|S\s?421|S\s?45[0-9]|S\s?530/i.test(d.name || d.model || '')
        || hasSplitTransducers;

      if (isStandaloneOrS403 && cleanSensors.length > 1) {
        const allChannels = [];
        cleanSensors.forEach(s => {
          if (Array.isArray(s.channels)) {
            allChannels.push(...s.channels);
          }
        });
        const modelMatch = (d.name || d.model || '').match(/([A-Z]\s?\d{3}[A-Z]?)/i);
        const unifiedName = modelMatch
          ? modelMatch[1].replace(/\s+/g, '').toUpperCase()
          : (d.model && !d.model.includes('Connected') ? d.model : (d.name || 'S403'));
        return {
          ...d,
          sensors: [{
            id: `sens_${d.id}_unified`,
            name: unifiedName,
            desc: d.serial ? `SN: ${d.serial}` : 'Industrial Multi-Parameter Sensor',
            channels: allChannels
          }]
        };
      }

      return { ...d, sensors: cleanSensors };
    });
    if (JSON.stringify(cleaned) !== raw) {
      storage.setItem(STORAGE_KEY_SENSOR_DEVICES, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (err) {
    console.warn('[SensorManager] Error loading devices:', err);
    return [];
  }
}

/**
 * Save detected devices list to storage
 */
export function saveDevices(devices) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY_SENSOR_DEVICES, JSON.stringify(devices));
  } catch (err) {
    console.warn('[SensorManager] Error saving devices:', err);
  }
}

/**
 * Build device structure from real hardware channels array
 */
export function buildDeviceFromRawChannels(list, devName, transportLabel, transportType, sysInfo = {}) {
  const safeTransport = (transportType || 'usb').toLowerCase();
  const devId = `dev_${safeTransport}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const sensorsMap = new Map();
  const rawList = Array.isArray(list) ? list : (list?.channels || list?.logging_chs || []);

  const rawDevName = sysInfo?.device_name || devName || 'SUTO Sensor';
  const modelMatch = rawDevName.match(/([A-Z]\s?\d{3}[A-Z]?)/i);
  const primaryModel = modelMatch ? modelMatch[1].replace(/\s+/g, '').toUpperCase() : (sysInfo?.device_name || devName || 'SUTO Sensor');

  const model = sysInfo?.device_name || sysInfo?.model || devName;
  const serial = sysInfo?.serial_number || sysInfo?.serial || (sysInfo?.device_id ? `SN-${sysInfo.device_id}` : `SN-${safeTransport.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`);

  // Detect whether this is a multi-slave logger (e.g. S330 with distinct RS485 slave addresses > 1)
  // or a standalone instrument (e.g. S403, S401, S421, S450, S530 with multiple parameters).
  const distinctSlaverAddrs = new Set(
    rawList.map(ch => ch.slaver_addr ?? ch.slaverAddr).filter(a => a !== undefined && a !== null && a !== 0)
  );
  const isMultiSlaveHub = distinctSlaverAddrs.size > 1;

  if (rawList.length === 0) {
    const fallbackSensName = primaryModel || devName || 'Sensor Transducer';
    sensorsMap.set(fallbackSensName, {
      id: `sens_${devId}_1`,
      name: fallbackSensName,
      desc: sysInfo?.serial_number ? `SN: ${sysInfo.serial_number}` : 'Industrial Transducer',
      channels: []
    });
  } else {
    rawList.forEach((ch, idx) => {
      // For standalone multi-parameter sensors like S403, group all channels (Flow, Consumption, Pressure)
      // under the primary sensor model (e.g. S403) rather than splitting into internal transducer board codes (e.g. "451", "Pressure").
      let sensName;
      if (!isMultiSlaveHub) {
        sensName = primaryModel;
      } else {
        const slaverAddr = ch.slaver_addr ?? ch.slaverAddr ?? 1;
        sensName = ch.sensor_description || ch.sensor_name || ch.sensorDescription || `Slave ${slaverAddr} Sensor`;
      }

      if (!sensorsMap.has(sensName)) {
        sensorsMap.set(sensName, {
          id: `sens_${devId}_${sensorsMap.size + 1}`,
          name: sensName,
          desc: ch.sensor_type || (sysInfo?.serial_number ? `SN: ${sysInfo.serial_number}` : 'Industrial Multi-Parameter Sensor'),
          channels: []
        });
      }
      const sens = sensorsMap.get(sensName);
      const rawUnit = ch.unit || ch.unit_in_ascii || '';
      const unit = (rawUnit === 'u0' || rawUnit === 'u255') ? '' : rawUnit;
      let chName = ch.channel_name || ch.name || ch.logic_channel_description || `Channel ${idx + 1}`;
      if (/^ressure/i.test(chName)) chName = 'P' + chName;

      sens.channels.push({
        id: `ch_${safeTransport}_${ch.channel_id ?? ch.id ?? idx + 1}_${idx}`,
        channel_id: ch.channel_id ?? ch.id ?? (idx + 1),
        name: chName,
        unit,
        device: devName,
        desc: ch.description || ch.fullName || ''
      });
    });
  }

  return {
    id: devId,
    name: devName,
    model,
    serial,
    transport: transportLabel || safeTransport.toUpperCase(),
    transportType: safeTransport,
    isOnline: true,
    sensors: Array.from(sensorsMap.values())
  };
}

/**
 * Detect devices and sensors from real connected hardware link (no fake mock data).
 * Supports querying currently active communication link.
 */
export async function detectSensorsByTransport(transportType = 'active', options = {}) {
  const results = [];

  const activeTransport = TauriSutoAPI?.getActiveTransport?.();
  if (activeTransport) {
    try {
      if (typeof TauriSutoAPI.getChannels === 'function') {
        const rawChs = await TauriSutoAPI.getChannels();
        const list = Array.isArray(rawChs) ? rawChs : (rawChs?.logging_chs || []);
        if (list && list.length > 0) {
          const sysInfo = await TauriSutoAPI.getSystemInfo?.().catch(() => null);
          const devName = sysInfo?.device_name || `Connected SUTO Device (${activeTransport.toUpperCase()})`;
          results.push(buildDeviceFromRawChannels(list, devName, `Live ${activeTransport.toUpperCase()}`, activeTransport, sysInfo));
        }
      }
    } catch (err) {
      console.warn('[SensorManager] Active link query note:', err);
    }
  }

  return results;
}

/**
 * Legacy compatible alias
 */
export async function detectConnectedSensors(transportType = 'all', options = {}) {
  return detectSensorsByTransport(transportType, options);
}

/**
 * Synchronize a measurement point into its matched ProcessScape
 */
export function syncMeasurementPointToScape(locationId, mpId, customLocations = null) {
  const locations = customLocations || getLocations();
  const loc = locations.find(l => l.id === locationId);
  if (!loc || !loc.scapeId) return { success: false, error: 'Location has no matched ProcessScape' };

  const mp = loc.measurementPoints?.find(m => m.id === mpId);
  if (!mp) return { success: false, error: 'Measurement point not found' };

  const allScapes = getAllScapes();
  const targetScape = allScapes.find(s => s.id === loc.scapeId);
  if (!targetScape) return { success: false, error: 'Matched ProcessScape not found' };

  const existingElements = targetScape.elements || [];
  const existingCardIdx = existingElements.findIndex(e => e.mpId === mp.id || e.id === `elem_${mp.id}`);

  // If measurement point has no channels assigned, remove it from the ProcessScape
  if (!mp.channels || mp.channels.length === 0) {
    if (existingCardIdx >= 0) {
      const updatedElements = existingElements.filter((_, idx) => idx !== existingCardIdx);
      saveScape({
        ...targetScape,
        elements: updatedElements
      });
    }
    return { success: true, removed: true, scapeId: loc.scapeId, scapeTitle: targetScape.title };
  }

  const formattedChannels = (mp.channels || []).map(ch => ({
    id: ch.id || `ch_${ch.channel_id}`,
    name: ch.name || ch.channelName || 'Channel',
    unit: ch.unit || '',
    val: (ch.val !== undefined && ch.val !== null) ? ch.val : '--.-',
    status: ch.status || 'normal',
    channel_id: ch.channel_id ?? ch.id
  }));

  let updatedElements;
  if (existingCardIdx >= 0) {
    // Update existing card
    updatedElements = [...existingElements];
    updatedElements[existingCardIdx] = {
      ...updatedElements[existingCardIdx],
      type: 'sensor_card',
      tag: mp.name,
      titlePosition: updatedElements[existingCardIdx].titlePosition || 'top',
      channels: formattedChannels,
      locationId: loc.id
    };
  } else {
    // Calculate safe placement position
    const offsetIdx = existingElements.filter(e => e.type === 'sensor_card').length;
    const newCard = {
      id: `elem_${mp.id}`,
      mpId: mp.id,
      locationId: loc.id,
      type: 'sensor_card',
      tag: mp.name,
      x: 340 + (offsetIdx * 140),
      y: 80,
      zIndex: 40,
      titlePosition: 'top',
      channels: formattedChannels
    };
    updatedElements = [...existingElements, newCard];
  }

  const updatedScape = {
    ...targetScape,
    elements: updatedElements
  };

  saveScape(updatedScape);
  return { success: true, scapeId: loc.scapeId, scapeTitle: targetScape.title };
}

/**
 * Synchronize all measurement points across all locations to their matched ProcessScapes
 */
export function syncAllLocationsToScapes(customLocations = null) {
  const locations = customLocations || getLocations();
  let syncCount = 0;
  const affectedScapeIds = new Set();
  const allScapes = getAllScapes();
  const scapeMap = new Map(allScapes.map(s => [s.id, { ...s, elements: [...(s.elements || [])] }]));

  scapeMap.forEach((targetScape, scapeId) => {
    // Find all locations matched to this scape
    const matchedLocs = locations.filter(l => l.scapeId === scapeId);
    if (matchedLocs.length === 0) {
      // If no locations are mapped to this scape, prune any lingering sensor cards
      const hasLingeringCards = (targetScape.elements || []).some(el => el.type === 'sensor_card');
      if (hasLingeringCards) {
        targetScape.elements = (targetScape.elements || []).filter(el => el.type !== 'sensor_card');
        affectedScapeIds.add(scapeId);
      }
      return;
    }

    affectedScapeIds.add(scapeId);

    // Build a map of valid measurement points that have at least 1 channel for this scape
    const validMpMap = new Map();
    matchedLocs.forEach(loc => {
      (loc.measurementPoints || []).forEach(mp => {
        if (Array.isArray(mp.channels) && mp.channels.length > 0) {
          validMpMap.set(mp.id, { mp, locationId: loc.id });
        }
      });
    });

    // Prune sensor cards: keep all non-sensor elements (machines, vessels, pipes, text notes)
    // and prune any sensor cards that do not correspond to an active measurement point with channels
    const remainingElements = (targetScape.elements || []).filter(el => {
      if (el.type !== 'sensor_card') return true;

      // Only keep if the measurement point is active, matched to this scape, and has assigned channels
      if (el.mpId && validMpMap.has(el.mpId)) {
        return true;
      }

      // Otherwise prune it
      return false;
    });

    const finalElements = [...remainingElements];

    // Upsert cards for valid measurement points that have channels
    validMpMap.forEach(({ mp, locationId }) => {
      const existingIdx = finalElements.findIndex(e => e.mpId === mp.id || e.id === `elem_${mp.id}`);

      const formattedChannels = mp.channels.map(ch => ({
        id: ch.id || `ch_${ch.channel_id}`,
        name: ch.name || ch.channelName || 'Channel',
        unit: ch.unit || '',
        val: (ch.val !== undefined && ch.val !== null) ? ch.val : '--.-',
        status: ch.status || 'normal',
        channel_id: ch.channel_id ?? ch.id
      }));

      if (existingIdx >= 0) {
        finalElements[existingIdx] = {
          ...finalElements[existingIdx],
          type: 'sensor_card',
          tag: mp.name,
          titlePosition: finalElements[existingIdx].titlePosition || 'top',
          channels: formattedChannels,
          locationId
        };
      } else {
        const offsetIdx = finalElements.filter(e => e.type === 'sensor_card').length;
        finalElements.push({
          id: `elem_${mp.id}`,
          mpId: mp.id,
          locationId,
          type: 'sensor_card',
          tag: mp.name,
          x: 340 + (offsetIdx * 140),
          y: 80,
          zIndex: 40,
          titlePosition: 'top',
          channels: formattedChannels
        });
      }
      syncCount++;
    });

    targetScape.elements = finalElements;
  });

  affectedScapeIds.forEach(scapeId => {
    const updatedScape = scapeMap.get(scapeId);
    if (updatedScape) {
      saveScape(updatedScape);
    }
  });

  return {
    success: true,
    syncCount,
    affectedScapeIds: Array.from(affectedScapeIds)
  };
}
