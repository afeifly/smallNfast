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

    // Auto-heal: If any saved device has 0 channels, but locations still hold assigned channels for it,
    // restore those channels so the user never loses their device configuration.
    const locations = getLocations();
    const healed = cleaned.map(d => {
      const totalChannels = (d.sensors || []).reduce((acc, s) => acc + (s.channels?.length || 0), 0);
      if (totalChannels > 0) return d;

      // Find all channels assigned to any measurement point in any location for this device
      const recoveredChannels = [];
      locations.forEach(loc => {
        (loc.measurementPoints || []).forEach(mp => {
          (mp.channels || []).forEach(ch => {
            const matchesDev = (ch.device && d.name && (ch.device === d.name || ch.device.toLowerCase() === d.name.toLowerCase())) ||
              (ch.id && String(ch.id).includes(d.id)) ||
              (ch.deviceId && ch.deviceId === d.id);
            if (matchesDev && !recoveredChannels.some(rc => rc.id === ch.id || rc.channel_id === ch.channel_id)) {
              recoveredChannels.push({
                id: ch.id,
                channel_id: ch.channel_id ?? (recoveredChannels.length + 1),
                name: ch.name || 'Channel',
                unit: ch.unit || '',
                device: d.name,
                desc: ch.desc || ''
              });
            }
          });
        });
      });

      if (recoveredChannels.length > 0) {
        const sensName = d.sensors?.[0]?.name || d.name || 'Sensor';
        return {
          ...d,
          sensors: [
            {
              id: d.sensors?.[0]?.id || `sens_${d.id}_1`,
              name: sensName,
              desc: d.serial ? `SN: ${d.serial}` : 'Industrial Multi-Parameter Sensor',
              channels: recoveredChannels
            }
          ]
        };
      }
      return d;
    });

    if (JSON.stringify(healed) !== raw) {
      storage.setItem(STORAGE_KEY_SENSOR_DEVICES, JSON.stringify(healed));
    }
    return healed;
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
 * Generate a deterministic, consistent device ID based on hardware identifiers.
 * Prevents duplicate device entries when reconnecting or re-scanning.
 */
export function generateDeterministicDeviceId(transportType, sysInfo = {}, devName = '') {
  const safeTransport = (transportType || 'usb').toLowerCase();

  // 1. Web Bluetooth persistent ID (device.id)
  const bleId = sysInfo.deviceId || (safeTransport.includes('ble') && sysInfo.id);
  if (bleId) {
    return `dev_${safeTransport}_ble_${String(bleId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  // 2. Hardware Serial Number (if valid and not generic)
  const sn = sysInfo.serial_number || sysInfo.serial;
  const isGenericSn = (s) => !s || /^SN-(USB|TCP|BLE|API)-/i.test(String(s)) || String(s).length < 3;
  if (sn && !isGenericSn(sn)) {
    return `dev_${safeTransport}_sn_${String(sn).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  // 3. Network IP & Port (for TCP or API)
  const host = sysInfo.ip || sysInfo.host;
  if (host) {
    const port = sysInfo.port || (safeTransport === 'api' ? 8080 : 502);
    return `dev_${safeTransport}_${String(host).replace(/[^a-zA-Z0-9_-]/g, '_')}_${port}`;
  }

  // 4. USB Port Path
  if (sysInfo.path) {
    return `dev_${safeTransport}_${String(sysInfo.path).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  // 5. Hardware Device / Model ID
  if (sysInfo.device_id) {
    return `dev_${safeTransport}_devid_${sysInfo.device_id}`;
  }

  // Fallback to normalized device name
  const safeName = (devName || 'sensor').toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `dev_${safeTransport}_${safeName}`;
}

/**
 * Determine if two device records represent the exact same physical hardware.
 */
export function isSameDevice(d1, d2) {
  if (!d1 || !d2) return false;

  // 1. Exact ID match
  if (d1.id && d2.id && d1.id === d2.id) return true;

  // 2. Hardware Serial Number match (ignore generic placeholders like 'SN-USB-...')
  const extractSn = (d) => {
    const raw = String(d.serial || d.serial_number || d.connectionConfig?.serial || '').trim();
    if (raw && !/^SN-(USB|TCP|BLE|API)-/i.test(raw) && raw.length >= 3) return raw;
    const fromName = (d.name || d.connectionConfig?.name || '').match(/(\d{6,10})/);
    return fromName ? fromName[1] : '';
  };

  const sn1 = extractSn(d1);
  const sn2 = extractSn(d2);
  if (sn1 && sn2 && sn1 === sn2) {
    return true;
  }

  // 3. Web Bluetooth persistent device ID match
  const bleId1 = d1.connectionConfig?.deviceId || d1.deviceId;
  const bleId2 = d2.connectionConfig?.deviceId || d2.deviceId;
  if (bleId1 && bleId2 && bleId1 === bleId2) {
    return true;
  }

  // 4. Match by specific device name & transport (e.g. 'S403-12345678' via BLE)
  const n1 = (d1.name || d1.connectionConfig?.name || '').trim().toLowerCase();
  const n2 = (d2.name || d2.connectionConfig?.name || '').trim().toLowerCase();
  const t1 = (d1.transportType || d1.connectionConfig?.transport || d1.transport || '').toLowerCase();
  const t2 = (d2.transportType || d2.connectionConfig?.transport || d2.transport || '').toLowerCase();
  const sameTransport = t1 === t2 || (t1.includes('ble') && t2.includes('ble')) || (t1.includes('tcp') && t2.includes('tcp')) || (t1.includes('usb') && t2.includes('usb')) || (t1.includes('api') && t2.includes('api'));
  if (n1 && n2 && n1 === n2 && !['suto sensor', 'connected suto device', 'suto ble device'].includes(n1) && sameTransport) {
    return true;
  }

  // 5. Network IP / Host & Port match (for TCP / API)
  const host1 = d1.connectionConfig?.host || d1.host;
  const host2 = d2.connectionConfig?.host || d2.host;
  const isNet1 = t1.includes('tcp') || t1.includes('api');
  const isNet2 = t2.includes('tcp') || t2.includes('api');
  if (host1 && host2 && host1 === host2 && isNet1 && isNet2) {
    const port1 = d1.connectionConfig?.port || d1.port;
    const port2 = d2.connectionConfig?.port || d2.port;
    if (!port1 || !port2 || String(port1) === String(port2)) {
      return true;
    }
  }

  // 6. USB serial port path match
  const path1 = d1.connectionConfig?.path || d1.path;
  const path2 = d2.connectionConfig?.path || d2.path;
  if (path1 && path2 && path1 === path2 && t1.includes('usb') && t2.includes('usb')) {
    return true;
  }

  return false;
}

/**
 * Deduplicate and merge an incoming list of devices into an existing devices list.
 * Preserves existing device IDs and channel IDs so any existing measurement point
 * and ProcessScape bindings remain completely unbroken.
 */
export function upsertDeviceList(existingDevices = [], newDevices = []) {
  const result = [...existingDevices];

  for (const newDev of newDevices) {
    const matchIdx = result.findIndex(existing => isSameDevice(existing, newDev));

    if (matchIdx >= 0) {
      const existing = result[matchIdx];

      const newTotalChannels = (newDev.sensors || []).reduce((acc, s) => acc + (s.channels?.length || 0), 0);
      const existingTotalChannels = (existing.sensors || []).reduce((acc, s) => acc + (s.channels?.length || 0), 0);

      // CRITICAL SAFEGUARD: If incoming scan yielded 0 channels, but the existing device already has channels,
      // DO NOT wipe them out! Retain the existing configured sensors and channels.
      if (newTotalChannels === 0 && existingTotalChannels > 0) {
        result[matchIdx] = {
          ...existing,
          isOnline: true,
          connectionConfig: {
            ...existing.connectionConfig,
            ...newDev.connectionConfig
          }
        };
        continue;
      }

      // Build a map of existing channels by their channel_id or name or index
      const existingChannelsMap = new Map();
      (existing.sensors || []).forEach(s => {
        (s.channels || []).forEach((c, idx) => {
          if (c.channel_id !== undefined && c.channel_id !== null) {
            existingChannelsMap.set(`id_${c.channel_id}`, c);
          }
          if (c.name) {
            existingChannelsMap.set(`name_${c.name.toLowerCase()}`, c);
          }
          existingChannelsMap.set(`idx_${idx}`, c);
        });
      });

      // Map new sensors and preserve existing channel IDs if matched
      const mergedSensors = (newDev.sensors || []).map((newSens, sIdx) => {
        const mergedChannels = (newSens.channels || []).map((newCh, chIdx) => {
          const matchedCh =
            (newCh.channel_id !== undefined && existingChannelsMap.get(`id_${newCh.channel_id}`)) ||
            (newCh.name && existingChannelsMap.get(`name_${newCh.name.toLowerCase()}`)) ||
            existingChannelsMap.get(`idx_${chIdx}`);

          return {
            ...newCh,
            // Retain original channel id so any existing measurement point assignments in locations stay linked!
            id: matchedCh?.id || newCh.id,
            device: existing.name || newDev.name
          };
        });

        return {
          ...newSens,
          id: existing.sensors?.[sIdx]?.id || newSens.id,
          channels: mergedChannels
        };
      });

      // Update the existing device in place, retaining existing.id and preserving location links
      result[matchIdx] = {
        ...existing,
        ...newDev,
        id: existing.id, // KEEP existing device id
        name: existing.name || newDev.name,
        isOnline: true,
        connectionConfig: {
          ...existing.connectionConfig,
          ...newDev.connectionConfig
        },
        sensors: (mergedSensors.length > 0 && newTotalChannels > 0) ? mergedSensors : existing.sensors
      };
    } else {
      // New device: append to list
      result.push(newDev);
    }
  }

  return result;
}

/**
 * Build device structure from real hardware channels array
 */
export function buildDeviceFromRawChannels(list, devName, transportLabel, transportType, sysInfo = {}) {
  const safeTransport = (transportType || 'usb').toLowerCase();
  const devId = generateDeterministicDeviceId(safeTransport, sysInfo, devName);
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
        id: `ch_${devId}_${ch.channel_id ?? ch.id ?? idx + 1}_${idx}`,
        channel_id: ch.channel_id ?? ch.id ?? (idx + 1),
        name: chName,
        unit,
        device: devName,
        deviceId: devId,
        desc: ch.description || ch.fullName || ''
      });
    });
  }

  const host = sysInfo?.ip || sysInfo?.host || null;
  const port = sysInfo?.port || (safeTransport === 'api' ? 8080 : (safeTransport === 'tcp' ? 502 : null));

  return {
    id: devId,
    name: devName,
    model,
    serial,
    transport: transportLabel || safeTransport.toUpperCase(),
    transportType: safeTransport,
    isOnline: true,
    connectionConfig: {
      transport: safeTransport,
      host,
      port,
      path: sysInfo?.path || null,
      deviceId: sysInfo?.deviceId || (safeTransport.includes('ble') ? sysInfo?.id : null) || null,
      name: devName,
      serial: serial || null
    },
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
        name: ch.displayName || ch.name || ch.channelName || 'Channel',
        rawName: ch.name || ch.channelName,
        displayName: ch.displayName,
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

/**
 * Find all assignments of a device's channels across all locations and measurement points
 * @param {Object} device - Device object to inspect
 * @param {Array|null} customLocations - Optional locations list
 * @returns {Array} List of { channelId, channelName, channelUnit, locationId, locationName, mpId, mpName }
 */
export function getDeviceChannelAssignments(device, customLocations = null) {
  if (!device) return [];
  const locations = customLocations || getLocations();

  const devChannelIds = new Set();
  (device.sensors || []).forEach(s => {
    (s.channels || []).forEach(c => {
      if (c.id) devChannelIds.add(String(c.id));
      if (c.channel_id !== undefined && c.channel_id !== null) {
        devChannelIds.add(String(c.channel_id));
        devChannelIds.add(`cid_${c.channel_id}`);
      }
      if (c.channelId) devChannelIds.add(String(c.channelId));
    });
  });

  const assignments = [];
  locations.forEach(loc => {
    (loc.measurementPoints || []).forEach(mp => {
      (mp.channels || []).forEach(ch => {
        const matchesId = (ch.id && devChannelIds.has(String(ch.id))) ||
          (ch.channel_id !== undefined && devChannelIds.has(String(ch.channel_id))) ||
          (ch.channelId && devChannelIds.has(String(ch.channelId)));
        const matchesDeviceName = ch.device && device.name && ch.device === device.name;

        if (matchesId || matchesDeviceName) {
          assignments.push({
            channelId: ch.id || ch.channel_id,
            channelName: ch.name || ch.channelName || 'Channel',
            channelUnit: ch.unit || '',
            locationId: loc.id,
            locationName: loc.name || 'Location',
            mpId: mp.id,
            mpName: mp.name || 'Measurement Point'
          });
        }
      });
    });
  });

  return assignments;
}

/**
 * Remove a device from saved devices and unassign all of its channels from all measurement points.
 * Also synchronizes the changes to all affected ProcessScapes.
 * @param {string} deviceId - ID of device to delete
 * @returns {Object} { updatedDevices, updatedLocations, unassignedCount }
 */
export function removeDeviceAndUnassignChannels(deviceId) {
  const currentDevices = getSavedDevices();
  const targetDev = currentDevices.find(d => d.id === deviceId);
  if (!targetDev) {
    return {
      updatedDevices: currentDevices,
      updatedLocations: getLocations(),
      unassignedCount: 0
    };
  }

  // 1. Gather all channel identifiers belonging to this device
  const devChannelIds = new Set();
  (targetDev.sensors || []).forEach(s => {
    (s.channels || []).forEach(c => {
      if (c.id) devChannelIds.add(String(c.id));
      if (c.channel_id !== undefined && c.channel_id !== null) {
        devChannelIds.add(String(c.channel_id));
        devChannelIds.add(`cid_${c.channel_id}`);
      }
      if (c.channelId) devChannelIds.add(String(c.channelId));
    });
  });

  // 2. Remove device from devices storage
  const updatedDevices = currentDevices.filter(d => d.id !== deviceId);
  saveDevices(updatedDevices);

  // 3. Unassign its channels from all measurement points in all locations
  const currentLocations = getLocations();
  let unassignedCount = 0;

  const updatedLocations = currentLocations.map(loc => {
    const updatedMps = (loc.measurementPoints || []).map(mp => {
      const remainingChannels = (mp.channels || []).filter(ch => {
        const matchesId = (ch.id && devChannelIds.has(String(ch.id))) ||
          (ch.channel_id !== undefined && devChannelIds.has(String(ch.channel_id))) ||
          (ch.channelId && devChannelIds.has(String(ch.channelId)));
        const matchesDeviceName = ch.device && targetDev.name && ch.device === targetDev.name;

        if (matchesId || matchesDeviceName) {
          unassignedCount++;
          return false;
        }
        return true;
      });

      return {
        ...mp,
        channels: remainingChannels
      };
    });

    return {
      ...loc,
      measurementPoints: updatedMps
    };
  });

  saveLocations(updatedLocations);

  // 4. Synchronize all locations with their ProcessScapes (prunes or updates sensor cards)
  syncAllLocationsToScapes(updatedLocations);

  return {
    updatedDevices,
    updatedLocations,
    unassignedCount
  };
}

let autoReconnectPromise = null;

/**
 * Automatically reconnect to saved devices on startup or page refresh.
 * Restores hardware transport link and enables live polling data to flow immediately.
 */
export function autoReconnectSavedDevices() {
  if (autoReconnectPromise) {
    return autoReconnectPromise;
  }

  autoReconnectPromise = (async () => {
    try {
      if (typeof TauriSutoAPI?.isConnected === 'function' && TauriSutoAPI.isConnected()) {
        return { reconnected: true, alreadyConnected: true };
      }

      const devices = getSavedDevices();
      if (!devices || devices.length === 0) {
        return { reconnected: false, reason: 'no_saved_devices' };
      }

      for (const dev of devices) {
        const config = dev.connectionConfig || {};
        const transport = (config.transport || dev.transportType || dev.transport || '').toLowerCase();
        const host = config.host || (typeof dev.transport === 'string' && dev.transport.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1]);
        const port = config.port;

        try {
          if (transport.includes('api') && host) {
            await TauriSutoAPI.connectApi(host, port || 8080);
            return { reconnected: true, device: dev.name, transport: 'API' };
          } else if (transport.includes('tcp') && host) {
            await TauriSutoAPI.connectTcp(host, port || 502);
            return { reconnected: true, device: dev.name, transport: 'TCP' };
          } else if (transport.includes('usb') && typeof TauriSutoAPI.isAvailable === 'function' && TauriSutoAPI.isAvailable()) {
            await TauriSutoAPI.connectUsb();
            return { reconnected: true, device: dev.name, transport: 'USB' };
          } else if (transport.includes('ble')) {
            try {
              const bleRes = await TauriSutoAPI.resumeBleConnection({
                deviceId: config.deviceId || dev.id,
                name: config.name || dev.name
              });
              dev.isOnline = true;
              return { reconnected: true, device: dev.name, transport: 'BLE', ...bleRes };
            } catch (bleErr) {
              dev.isOnline = false;
              console.info(`[AutoReconnect] BLE device "${dev.name}" not in range currently (${bleErr?.message || bleErr}). Connect via "Detect" or ↻ when in range.`);
            }
          }
        } catch (err) {
          console.warn(`[AutoReconnect] Could not reconnect to "${dev.name}":`, err?.message || err);
        }
      }
      return { reconnected: false, reason: 'failed_all_devices' };
    } finally {
      autoReconnectPromise = null;
    }
  })();

  return autoReconnectPromise;
}
