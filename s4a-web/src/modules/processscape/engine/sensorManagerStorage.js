/**
 * Sensor Manager Storage Engine
 * Manages device detection across communication transports (USB, Ethernet TCP, BLE),
 * sensor hierarchy, locations, and measurement point assignments.
 * No fake data: starts empty and allows appending discovered sensors.
 */

import TauriSutoAPI from '../../../api/TauriSutoAPI';
import { getAllScapes, saveScape, createNewScape, getActiveScapeId, getSavedScapeView } from './scapeStorage';
import { pollOnce } from '../../../util/liveDataSource';

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
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('sensor-locations-changed', { detail: locations }));
      } catch (_) {}
    }
  } catch (err) {
    console.warn('[SensorManager] Error saving locations:', err);
  }
}

/**
 * Check if any location has at least one measurement point with assigned channels
 */
export function hasAssignedChannels(locations) {
  const locs = locations || getLocations();
  if (!Array.isArray(locs) || locs.length === 0) return false;
  return locs.some(loc =>
    Array.isArray(loc?.measurementPoints) &&
    loc.measurementPoints.some(mp =>
      Array.isArray(mp?.channels) && mp.channels.some(ch => Boolean(ch && (ch.id || ch.channel_id || ch.name)))
    )
  );
}

/**
 * Count total number of assigned channels across all locations and measurement points
 */
export function countAssignedChannels(locations) {
  const locs = locations || getLocations();
  if (!Array.isArray(locs) || locs.length === 0) return 0;
  let count = 0;
  for (const loc of locs) {
    for (const mp of (loc?.measurementPoints || [])) {
      count += (mp?.channels || []).filter(ch => Boolean(ch && (ch.id || ch.channel_id || ch.name))).length;
    }
  }
  return count;
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
        }).map((c, cIdx) => {
          const chId = c.channel_id ?? c.channelId ?? (cIdx + 1);
          const cleanSerial = d.serial ? String(d.serial).replace(/[^a-zA-Z0-9_-]/g, '_') : 'dev';
          const cleanSensKey = String(s.name || 'sens').toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
          const isGenericId = !c.id || /^(?:cid_)?\d+$/i.test(String(c.id)) || /^ch_\d+$/i.test(String(c.id));
          return {
            ...c,
            id: (!isGenericId && c.id) ? c.id : `ch_sn_${cleanSerial}_${cleanSensKey}_${chId}_${cIdx}`,
            channel_id: chId,
            channelId: chId,
            name: /^ressure/i.test(c.name || '') ? 'P' + c.name : c.name,
            unit: (c.unit === 'u0' || c.unit === 'u255') ? '' : c.unit,
            device: c.device || d.name,
            deviceId: c.deviceId || d.id,
            deviceSerial: c.deviceSerial || d.serial,
            sensorName: c.sensorName || s.name,
            sensorId: c.sensorId || s.id
          };
        });
        return { ...s, channels: cleanChannels };
      });

      // Auto-consolidate split transducer groups ONLY for standalone instruments (e.g. S403 with internal flow core + pressure)
      // Never consolidate multi-sensor cards on data loggers / hubs (e.g. S331, S330, S551, Modbus gateways)
      const isKnownHub = /^(S\s?33[0-9]|S\s?32[0-9]|S\s?55[0-9]|DS\s?350|LOGGER|HUB)/i.test(d.name || d.model || '');
      const isStandaloneOrS403 = !isKnownHub && /S\s?40[1-9]|S\s?421|S\s?45[0-9]|S\s?530/i.test(d.name || d.model || '');

      const cleanedName = d.serial
        ? (d.name || '').replace(new RegExp(`\\s*\\(${d.serial}\\)$`, 'i'), '').trim()
        : (d.name || '').replace(/\s*\(\d{6,10}\)$/, '').trim();
      const cleanedTransport = (d.transport || '')
        .replace(/:502(?=[^0-9]|$)/, '')
        .replace(/\s+ID:\d+/i, '')
        .replace(/\s+SN:[a-zA-Z0-9_-]+/i, '')
        .trim();

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
          : (d.model && !d.model.includes('Connected') ? d.model : (cleanedName || d.name || 'S403'));
        return {
          ...d,
          name: cleanedName || d.name,
          transport: cleanedTransport || d.transport,
          sensors: [{
            id: `sens_${d.id}_unified`,
            name: unifiedName,
            desc: d.serial ? `SN: ${d.serial}` : 'Industrial Multi-Parameter Sensor',
            channels: allChannels
          }]
        };
      }

      return {
        ...d,
        name: cleanedName || d.name,
        transport: cleanedTransport || d.transport,
        sensors: cleanSensors
      };
    });

    // Auto-heal / normalize network devices and migrate corrupted IDs (e.g. dev_tcp_ble_4197 -> dev_tcp_127_0_0_1_502)
    const idMigrationMap = new Map();
    const normalizedDevices = cleaned.map(d => {
      const transportStr = (d.transportType || d.connectionConfig?.transport || d.transport || '').toLowerCase();
      const isNet = transportStr.includes('tcp') || transportStr.includes('api') || transportStr.includes('ethernet') || transportStr.includes('lan');
      if (isNet) {
        let host = d.connectionConfig?.host || d.connectionConfig?.ip || d.host || d.ip;
        let port = d.connectionConfig?.port || d.port;
        if ((!host || !port) && typeof d.transport === 'string') {
          const match = d.transport.match(/(\d+\.\d+\.\d+\.\d+)(?::(\d+))?/);
          if (match) {
            if (!host) host = match[1];
            if (!port && match[2]) port = parseInt(match[2], 10);
          }
        }
        if (!port && typeof d.id === 'string') {
          const idMatch = d.id.match(/_(\d{2,5})$/);
          if (idMatch) port = parseInt(idMatch[1], 10);
        }
        port = port || (transportStr.includes('api') ? 8080 : 502);
        host = host || '127.0.0.1';

        const cleanHost = String(host).replace(/[^a-zA-Z0-9_-]/g, '_');
        const expectedId = `dev_${d.transportType || 'tcp'}_${cleanHost}_${port}`;
        // Only heal IDs that were corrupted by the earlier bleId bug (e.g. dev_tcp_ble_4197)
        if (d.id && d.id.includes('_ble_')) {
          idMigrationMap.set(d.id, expectedId);
        }

        const finalId = idMigrationMap.get(d.id) || d.id || expectedId;
        const transportLabel = transportStr.includes('api')
          ? `S332 API (${host}:${port})`
          : `Ethernet (${host}:${port})`;

        return {
          ...d,
          id: finalId,
          transport: transportLabel,
          connectionConfig: {
            ...(d.connectionConfig || {}),
            host,
            port: Number(port),
            transport: d.transportType || d.connectionConfig?.transport || 'tcp'
          }
        };
      }
      return d;
    });

    if (idMigrationMap.size > 0) {
      try {
        const locs = getLocations();
        let locsChanged = false;
        locs.forEach(loc => {
          (loc.measurementPoints || []).forEach(mp => {
            (mp.channels || []).forEach(ch => {
              if (ch.deviceId && idMigrationMap.has(ch.deviceId)) {
                ch.deviceId = idMigrationMap.get(ch.deviceId);
                locsChanged = true;
              }
            });
          });
        });
        if (locsChanged) {
          saveLocations(locs);
        }
      } catch (_) {}
    }

    // Auto-heal: If any saved device has 0 channels, but locations still hold assigned channels for it,
    // restore those channels so the user never loses their device configuration.
    const locations = getLocations();
    const healed = normalizedDevices.map(d => {
      const totalChannels = (d.sensors || []).reduce((acc, s) => acc + (s.channels?.length || 0), 0);
      if (totalChannels > 0) return d;

      // Find all channels assigned to any measurement point in any location for this device
      const recoveredChannels = [];
      locations.forEach(loc => {
        (loc.measurementPoints || []).forEach(mp => {
          (mp.channels || []).forEach(ch => {
            const dTransport = (d.transportType || d.connectionConfig?.transport || d.transport || '').toLowerCase();
            const chTransport = (ch.transport || ch.transportType || '').toLowerCase();
            const isChExplicitModbus = chTransport.includes('modbus') || String(ch.id).toLowerCase().includes('modbus') || String(ch.device || '').toLowerCase().includes('modbus') || ch.regAddr !== undefined || ch.mBValueAddr !== undefined;
            const isDExplicitModbus = dTransport.includes('modbus') || String(d.id).toLowerCase().includes('modbus') || String(d.name || '').toLowerCase().includes('modbus');
            if (isChExplicitModbus !== isDExplicitModbus) return; // Strict guard: never mix Modbus and non-Modbus

            const isChExplicitBle = ch.isBle || chTransport.includes('ble');
            const isDExplicitUsb = dTransport.includes('usb') && !dTransport.includes('ble');
            if (isChExplicitBle && isDExplicitUsb) return;

            const isChExplicitUsb = chTransport.includes('usb');
            const isDExplicitBle = dTransport.includes('ble');
            if (isChExplicitUsb && isDExplicitBle) return;

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
 * Generate a unique virtual serial number for pure Modbus devices lacking a factory serial number.
 * Conforms to the standard 8-digit format starting with '99' ('99xxxxxx').
 * Derives the 6 suffix digits deterministically from host/port/slaveId when provided,
 * so repeated connections to the same Modbus endpoint preserve the same serial number,
 * or generates a random 6-digit suffix if no endpoint is specified.
 */
export function generateModbusSerialNumber(hostOrPort = '', slaveId = 1) {
  if (hostOrPort) {
    const seed = `${String(hostOrPort).trim()}_slave_${slaveId}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const positiveHash = Math.abs(hash);
    const suffix = String(100000 + (positiveHash % 900000));
    return `99${suffix}`;
  }
  const randSuffix = String(Math.floor(100000 + Math.random() * 900000));
  return `99${randSuffix}`;
}

/**
 * Generate a deterministic, consistent device ID based on hardware identifiers.
 * 1. Hardware Serial Number (SN) - Definitive hardware identifier from getSN / serial_number.
 * 2. Network IP + Port (for TCP/API/Ethernet) when SN is not yet available.
 * Prevents duplicate device entries when reconnecting or re-scanning while distinguishing separate simulator instances.
 */
export function generateDeterministicDeviceId(transportType, sysInfo = {}, devName = '') {
  const safeTransport = (transportType || 'usb').toLowerCase();

  // 1. Hardware Serial Number (SN) - Definitive hardware identifier!
  // Uses getSN / serial_number so physical hardware and simulator instances with unique serials
  // (e.g. SN 12344321, 12344322, 12344323) or pure Modbus virtual serials (99xxxxxx) are uniquely identified.
  const sn = sysInfo.serial_number || sysInfo.serial;
  const isGenericSn = (s) => !s || /^ID-\d+$/i.test(String(s)) || String(s).length < 3;
  if (sn && !isGenericSn(sn)) {
    return `dev_${safeTransport}_sn_${String(sn).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  // 2. Network IP & Port (for TCP, API, Ethernet) when SN is not yet available
  const isNet = safeTransport.includes('tcp') || safeTransport.includes('api') || safeTransport.includes('ethernet') || safeTransport.includes('lan');
  const host = sysInfo.host || sysInfo.ip || sysInfo.address;
  if (isNet && host) {
    let cleanHost = host;
    let port = sysInfo.port;
    if (typeof cleanHost === 'string' && cleanHost.includes(':')) {
      const parts = cleanHost.split(':');
      cleanHost = parts[0];
      if (!port && parts[1]) port = parseInt(parts[1], 10);
    }
    const finalPort = port || (safeTransport.includes('api') ? 8080 : 502);
    const safeHostStr = String(cleanHost).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `dev_${safeTransport}_${safeHostStr}_${finalPort}`;
  }

  // 3. Web Bluetooth persistent ID (device.id) — ONLY for BLE!
  if (safeTransport.includes('ble')) {
    const bleId = sysInfo.deviceId || sysInfo.id;
    if (bleId) {
      return `dev_${safeTransport}_ble_${String(bleId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    }
  }

  // 4. USB Port Path
  if (sysInfo.path) {
    return `dev_${safeTransport}_${String(sysInfo.path).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  // 5. Network IP & Port fallback (if host was present even without explicit transport)
  if (host) {
    let cleanHost = host;
    let port = sysInfo.port;
    if (typeof cleanHost === 'string' && cleanHost.includes(':')) {
      const parts = cleanHost.split(':');
      cleanHost = parts[0];
      if (!port && parts[1]) port = parseInt(parts[1], 10);
    }
    const finalPort = port || 502;
    const safeHostStr = String(cleanHost).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `dev_${safeTransport}_${safeHostStr}_${finalPort}`;
  }

  // 6. Hardware Device / Model ID (non-network, non-ble fallback)
  if (sysInfo.device_id) {
    return `dev_${safeTransport}_devid_${sysInfo.device_id}`;
  }

  // Fallback to normalized device name
  const safeName = (devName || 'sensor').toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `dev_${safeTransport}_${safeName}`;
}

/**
 * Determine if two device records represent the exact same physical hardware.
 * 1. Hardware Serial Number (SN) match: definitive physical identifier.
 * 2. If SN is unavailable, compares network IP + Port for Ethernet/TCP, or path/bleId.
 */
export function isSameDevice(d1, d2) {
  if (!d1 || !d2) return false;

  const t1 = (d1.transportType || d1.connectionConfig?.transport || d1.transport || '').toLowerCase();
  const t2 = (d2.transportType || d2.connectionConfig?.transport || d2.transport || '').toLowerCase();
  const isBle1 = t1.includes('ble');
  const isBle2 = t2.includes('ble');
  // Different hardware transports (e.g. BLE vs Modbus/Ethernet/USB) are NEVER the same device!
  if (isBle1 !== isBle2) return false;

  const isModbus1 = t1.includes('modbus');
  const isModbus2 = t2.includes('modbus');
  if (isModbus1 !== isModbus2) return false;

  const isUsb1 = t1.includes('usb');
  const isUsb2 = t2.includes('usb');
  if (isUsb1 !== isUsb2) return false;

  const isApi1 = t1.includes('api');
  const isApi2 = t2.includes('api');
  if (isApi1 !== isApi2) return false;

  // 1. Hardware Serial Number (SN) match:
  // If both devices have a valid hardware serial number (SN), this is the definitive physical identifier.
  // Distinct serial numbers (e.g. SN 12344321 vs SN 12344322) ALWAYS represent different devices!
  const extractSn = (d) => {
    const raw = String(d.serial || d.serial_number || d.connectionConfig?.serial || d.connectionConfig?.serial_number || '').trim();
    if (raw && !/^ID-\d+$/i.test(raw) && raw.length >= 3) return raw;
    return '';
  };

  const sn1 = extractSn(d1);
  const sn2 = extractSn(d2);
  if (sn1 && sn2) {
    return sn1 === sn2;
  }

  // 2. Exact ID match (if serial numbers are not present or generic)
  if (d1.id && d2.id && d1.id === d2.id) return true;

  const isNet1 = t1.includes('tcp') || t1.includes('api') || t1.includes('ethernet') || t1.includes('lan');
  const isNet2 = t2.includes('tcp') || t2.includes('api') || t2.includes('ethernet') || t2.includes('lan');

  // Helper to extract host & port reliably from connectionConfig, root properties, transport string, or id
  const extractNetEndpoint = (d, t) => {
    let host = d.connectionConfig?.host || d.connectionConfig?.ip || d.host || d.ip;
    let port = d.connectionConfig?.port || d.port;

    // Fallback: extract from transport string (e.g. "Ethernet (127.0.0.1:502)" or "Ethernet (127.0.0.1)")
    if ((!host || !port) && typeof d.transport === 'string') {
      const match = d.transport.match(/(\d+\.\d+\.\d+\.\d+)(?::(\d+))?/);
      if (match) {
        if (!host) host = match[1];
        if (!port && match[2]) port = parseInt(match[2], 10);
      }
    }

    // Fallback: extract from device ID if formatted like dev_tcp_127_0_0_1_502
    if ((!host || !port) && typeof d.id === 'string') {
      const idMatch = d.id.match(/dev_(?:tcp|api|ethernet)_((?:\d+_){3}\d+)_(\d+)/);
      if (idMatch) {
        if (!host) host = idMatch[1].replace(/_/g, '.');
        if (!port) port = parseInt(idMatch[2], 10);
      }
    }

    const defaultPort = t.includes('api') ? 8080 : 502;
    const finalPort = port ? String(port) : String(defaultPort);
    const finalHost = host ? (host === 'localhost' ? '127.0.0.1' : host).toLowerCase() : null;
    return { host: finalHost, port: finalPort };
  };

  // 3. Network devices (TCP / API): distinguish by IP + Port if serial numbers were absent
  // Multiple simulator or hardware devices can run on the same IP across different ports (e.g. 502, 503, 504).
  if (isNet1 || isNet2) {
    // If one is network and the other is not network, they are NEVER the same device
    if (!isNet1 || !isNet2) return false;

    const net1 = extractNetEndpoint(d1, t1);
    const net2 = extractNetEndpoint(d2, t2);

    // If both have host: match ONLY if both host and port match!
    if (net1.host && net2.host) {
      return net1.host === net2.host && net1.port === net2.port;
    }

    // Fallback to exact ID match ONLY if both IDs are non-empty and equal
    if (d1.id && d2.id && d1.id === d2.id) return true;

    return false;
  }

  // 4. Web Bluetooth persistent device ID match
  const bleId1 = d1.connectionConfig?.deviceId || d1.deviceId;
  const bleId2 = d2.connectionConfig?.deviceId || d2.deviceId;
  if (bleId1 && bleId2 && bleId1 === bleId2) {
    return true;
  }

  // 5. USB serial port path match
  const path1 = d1.connectionConfig?.path || d1.path;
  const path2 = d2.connectionConfig?.path || d2.path;
  if (path1 && path2 && path1 === path2 && t1.includes('usb') && t2.includes('usb')) {
    return true;
  }

  // 6. Match by specific device name & transport (ONLY for non-network devices)
  if (!isNet1 && !isNet2) {
    const n1 = (d1.name || d1.connectionConfig?.name || '').trim().toLowerCase();
    const n2 = (d2.name || d2.connectionConfig?.name || '').trim().toLowerCase();
    const sameTransport = t1 === t2 || (t1.includes('ble') && t2.includes('ble')) || (t1.includes('usb') && t2.includes('usb'));
    if (n1 && n2 && n1 === n2 && !['suto sensor', 'connected suto device', 'suto ble device', 'sensor', 'connected device', 'ble device'].includes(n1) && sameTransport) {
      return true;
    }
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
            device: existing.name || newDev.name,
            deviceSerial: existing.serial || newDev.serial,
            deviceId: existing.id || newDev.id
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
  const rawDevName = sysInfo?.device_name || devName || 'Sensor';
  const modelMatch = rawDevName.match(/([A-Z]\s?\d{3}[A-Z]?)/i);
  const primaryModel = modelMatch ? modelMatch[1].replace(/\s+/g, '').toUpperCase() : (sysInfo?.device_name || devName || 'Sensor');

  const model = sysInfo?.device_name || sysInfo?.model || devName;
  let serial = sysInfo?.serial_number || sysInfo?.serial;
  if (!serial || /^ID-\d+$/i.test(String(serial)) || String(serial).length < 3) {
    if (safeTransport.includes('modbus')) {
      const hostOrPort = sysInfo?.host || sysInfo?.ip || sysInfo?.path || '';
      const slaveId = sysInfo?.slaveId || sysInfo?.slave_id || 1;
      serial = generateModbusSerialNumber(hostOrPort, slaveId);
    } else if (sysInfo?.device_id && !['4196', '4197', '4198', '4199', '4200'].includes(String(sysInfo.device_id))) {
      serial = `SN-${sysInfo.device_id}`;
    } else if (sysInfo?.deviceId || sysInfo?.id) {
      const rawId = String(sysInfo.deviceId || sysInfo.id);
      let hash = 0;
      for (let i = 0; i < rawId.length; i++) {
        hash = ((hash << 5) - hash) + rawId.charCodeAt(i);
        hash |= 0;
      }
      const suffix = String(100000 + (Math.abs(hash) % 900000));
      serial = `98${suffix}`;
    } else {
      serial = `98${Math.floor(100000 + Math.random() * 900000)}`;
    }
  }

  const cleanSerial = String(serial).replace(/[^a-zA-Z0-9_-]/g, '_');
  const devId = generateDeterministicDeviceId(safeTransport, { ...sysInfo, serial }, devName);
  const sensorsMap = new Map();
  const unverifiedList = Array.isArray(list) ? list : (list?.channels || list?.logging_chs || []);

  // Strict isolation guard: Non-Modbus devices (USB, BLE, TCP, API) must NEVER absorb Modbus channels.
  // Modbus devices must NEVER absorb BLE/USB channels.
  const rawList = unverifiedList.filter(ch => {
    const devDesc = String(ch.device_description || ch.device || ch.device_desc || '').toLowerCase();
    const chName = String(ch.name || ch.channel_name || '').toLowerCase();
    const sDesc = String(ch.sensor_description || ch.sensor_desc || ch.sensorDescription || ch.sensor_name || '').toLowerCase();
    const isChModbus = devDesc.includes('modbus') || chName.startsWith('modbus') || sDesc.includes('modbus');

    if (!safeTransport.includes('modbus') && isChModbus) {
      return false;
    }
    if (safeTransport.includes('modbus')) {
      const isChBle = devDesc.includes('ble') || chName.startsWith('ble') || sDesc.includes('ble');
      if (isChBle) return false;
    }
    return true;
  });

  // Detect whether this is a data logger / acquisition hub (e.g. S330, S331, S551, DS350, S320)
  // or a standalone instrument (e.g. S403, S401, S421, S450, S530 with multiple parameters).
  const distinctSlaverAddrs = new Set(
    rawList.map(ch => ch.slaver_addr ?? ch.slaverAddr).filter(a => a !== undefined && a !== null && a !== 0)
  );
  const isMultiSlaveHub = distinctSlaverAddrs.size > 1;

  // A device is a known data logger / acquisition hub if:
  // 1. Its device model or name matches S330, S331, S551, DS350, S320, etc.
  // 2. Its device ID matches known hub identification codes (4196, 4197, 4198, 4199, 4200, 4178, 4179, 4181)
  const isKnownHubModel = /^(S\s?33[0-9]|S\s?32[0-9]|S\s?55[0-9]|DS\s?350|LOGGER|HUB)/i.test(primaryModel) ||
    /^(S\s?33[0-9]|S\s?32[0-9]|S\s?55[0-9]|DS\s?350|LOGGER|HUB)/i.test(rawDevName) ||
    [4196, 4197, 4198, 4199, 4200, 4178, 4179, 4181].includes(Number(sysInfo?.device_id) || Number(sysInfo?.device_identification));

  // Standalone multi-parameter instruments (e.g. S403 flow meter) have internal transducer board codes
  // (like "451" for flow core and "Pressure Sensor" for pressure), which should be unified under the instrument model.
  const isStandaloneSensorInstrument = /^(S\s?40[1-9]|S\s?421|S\s?45[0-9]|S\s?530)/i.test(primaryModel);

  const isHubDevice = isKnownHubModel || isMultiSlaveHub || (!isStandaloneSensorInstrument && rawList.some(ch => {
    const sDesc = (ch.sensor_description || ch.sensorDescription || ch.sensor_name || '').trim();
    return sDesc && sDesc.toUpperCase() !== primaryModel.toUpperCase();
  }));

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
      let sensName;
      const explicitSensor = (ch.sensor_description || ch.sensor_name || ch.sensorDescription || '').trim();

      if (isKnownHubModel) {
        // Any sensor connected to an S330/S331/S551/DS350 data logger is an external sensor.
        // e.g. An S331 with both 'S212' and 'S451' will list both as distinct sensor containers!
        if (explicitSensor) {
          sensName = (/^451$/i.test(explicitSensor)) ? 'S451' : explicitSensor;
        } else {
          const slaverAddr = ch.slaver_addr ?? ch.slaverAddr;
          sensName = (slaverAddr !== undefined && slaverAddr !== null && slaverAddr !== 0)
            ? `Slave ${slaverAddr} Sensor`
            : `Port ${idx + 1} Sensor`;
        }
      } else if (isStandaloneSensorInstrument) {
        // Standalone instrument (e.g. S403 flow meter with internal 451 flow board & pressure sensor)
        sensName = primaryModel;
      } else if (isMultiSlaveHub) {
        const slaverAddr = ch.slaver_addr ?? ch.slaverAddr ?? 1;
        sensName = explicitSensor || `Slave ${slaverAddr} Sensor`;
      } else if (isHubDevice && explicitSensor) {
        sensName = explicitSensor;
      } else {
        sensName = primaryModel;
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
      let chName = ch.channel_name || ch.name || ch.description || ch.logic_channel_description || `Channel ${idx + 1}`;
      if (/^ressure/i.test(chName)) chName = 'P' + chName;

      const cleanSensKey = String(sensName || `sens_${sensorsMap.size}`).toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
      const cid = ch.channel_id ?? ch.id ?? (idx + 1);

      sens.channels.push({
        id: ch.id || `ch_sn_${cleanSerial}_${cid}_${idx}`,
        channel_id: cid,
        channelId: cid,
        name: chName,
        unit,
        device: devName,
        deviceId: devId,
        deviceSerial: serial,
        transport: transportLabel || safeTransport.toUpperCase(),
        transportType: safeTransport,
        sensorName: sensName,
        sensorId: sens.id,
        sensorIndex: sensorsMap.size,
        slaver_addr: ch.slaver_addr ?? ch.slaverAddr,
        mBValueAddr: ch.mBValueAddr ?? ch.regAddr,
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
 * Build a structured Modbus device object for Sensor Manager
 */
export function buildModbusDevice({
  name = 'Modbus TCP Device',
  model = null,
  serial = null,
  softwareVersion = null,
  host = '192.168.1.100',
  port = 502,
  serialPort = 'COM1',
  baudRate = 19200,
  parity = 'none',
  slaveId = 1,
  transportType = 'modbus_tcp',
  channels = []
}) {
  const isRtu = transportType === 'modbus_rtu';
  const p = parseInt(port, 10) || 502;
  const sId = parseInt(slaveId, 10) || (isRtu ? 1 : 0);
  const cleanHost = isRtu
    ? String(serialPort || 'COM1').replace(/[^a-zA-Z0-9_-]/g, '_')
    : String(host).replace(/[^a-zA-Z0-9_-]/g, '_');

  // If a valid hardware serial was detected (e.g. from SUTO S331 Modbus query) use it;
  // otherwise, assign a virtual serial number starting with '99xxxxxx'
  const isGenericSerial = (s) => !s || /^ID-\d+$/i.test(String(s)) || /^SN-(USB|TCP|BLE|API)-/i.test(String(s)) || String(s).length < 3;
  const finalSerial = (serial && !isGenericSerial(serial))
    ? String(serial).trim()
    : generateModbusSerialNumber(isRtu ? `${cleanHost}_${baudRate}` : `${cleanHost}_${p}`, sId);

  const cleanSerial = String(finalSerial).replace(/[^a-zA-Z0-9_-]/g, '_');
  const deviceId = `dev_${transportType}_sn_${cleanSerial}`;
  const pFormatted = p === 502 ? '' : `:${p}`;
  const transportLabel = isRtu
    ? `Modbus RTU (${serialPort || 'COM'})`
    : `Modbus TCP (${host}${pFormatted})`;

  const formattedChannels = (channels || []).map((ch, idx) => {
    const chId = ch.channel_id ?? ch.id ?? (idx + 1);
    const chName = ch.name || ch.channel_name || `Channel ${chId}`;
    const explicitSensor = (ch.sensor_description || ch.sensorDescription || ch.sensor_name || '').trim();
    let sensName = explicitSensor;
    if (/^451$/i.test(sensName)) sensName = 'S451';
    if (/^212$/i.test(sensName)) sensName = 'S212';
    if (!sensName) sensName = `${name} Channels`;
    const cleanSensKey = String(sensName).toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');

    return {
      id: ch.id || `ch_sn_${cleanSerial}_${chId}`,
      channel_id: chId,
      channelId: chId,
      name: chName,
      unit: ch.unit || '',
      resolution: ch.resolution ?? 2,
      device: name,
      deviceId,
      deviceSerial: finalSerial,
      devicePort: isRtu ? null : p,
      sensorName: sensName,
      sensor_description: explicitSensor,
      sensorDescription: explicitSensor,
      slaver_addr: ch.slaver_addr ?? ch.slaverAddr ?? sId,
      mBAccessFuncCode: ch.mBAccessFuncCode ?? ch.funcCode ?? 3,
      mBValueAddr: ch.mBValueAddr ?? ch.regAddr ?? 0,
      mBInputValueType: ch.mBInputValueType ?? ch.dataType ?? 7,
      mBA1: ch.mBA1 ?? ch.a1 ?? 1.0,
      mBA0: ch.mBA0 ?? ch.a0 ?? 0.0,
      errorValue: ch.errorValue ?? -9999.0,
      chOptionalConfig: ch.chOptionalConfig ?? 0,
      desc: ch.desc || `Reg 0x${((ch.mBValueAddr ?? ch.regAddr ?? 0)).toString(16).toUpperCase().padStart(4, '0')}`
    };
  });

  const sensorsMap = new Map();
  formattedChannels.forEach((ch, idx) => {
    const explicitSensor = (ch.sensor_description || ch.sensorDescription || '').trim();
    let sensName = explicitSensor;
    if (/^451$/i.test(sensName)) sensName = 'S451';
    if (/^212$/i.test(sensName)) sensName = 'S212';
    if (!sensName) sensName = `${name} Channels`;

    if (!sensorsMap.has(sensName)) {
      sensorsMap.set(sensName, {
        id: `sens_${deviceId}_${sensorsMap.size + 1}`,
        name: sensName,
        desc: explicitSensor ? `Model: ${explicitSensor}` : `Modbus Slave ID: ${sId}`,
        channels: []
      });
    }
    sensorsMap.get(sensName).channels.push(ch);
  });

  const finalSensors = Array.from(sensorsMap.values());

  return {
    id: deviceId,
    name,
    model: model || (isRtu ? 'Modbus RTU Device' : 'Modbus TCP Device'),
    serial: finalSerial,
    softwareVersion: softwareVersion || '1.0',
    transport: transportLabel,
    transportType: isRtu ? 'modbus_rtu' : 'modbus_tcp',
    host: isRtu ? null : host,
    port: isRtu ? null : p,
    serialPort: isRtu ? serialPort : null,
    baudRate: isRtu ? baudRate : null,
    parity: isRtu ? parity : null,
    slaveId: sId,
    isOnline: true,
    connectionConfig: {
      transport: isRtu ? 'modbus_rtu' : 'modbus_tcp',
      host: isRtu ? null : host,
      port: isRtu ? null : p,
      serialPort: isRtu ? serialPort : null,
      baudRate: isRtu ? baudRate : null,
      parity: isRtu ? parity : null,
      slaveId: sId,
      name,
      model: model || null,
      serial: finalSerial
    },
    sensors: finalSensors.length > 0 ? finalSensors : [
      {
        id: `sens_${deviceId}_1`,
        name: `${name} Channels`,
        desc: `Modbus Slave ID: ${sId}`,
        channels: formattedChannels
      }
    ]
  };
}

/**
 * Detect devices and sensors from real connected hardware link (no fake mock data).
 * Supports querying currently active communication link.
 */
export async function detectSensorsByTransport(transportType = 'active', options = {}) {
  const results = [];

  const activeTransport = TauriSutoAPI?.getActiveTransport?.();
  const targetTransport = (transportType && transportType !== 'active' && transportType !== 'all')
    ? transportType
    : activeTransport;

  if (targetTransport) {
    try {
      if (typeof TauriSutoAPI.getChannels === 'function') {
        const rawChs = await TauriSutoAPI.getChannels({ transport: targetTransport });
        const list = Array.isArray(rawChs) ? rawChs : (rawChs?.logging_chs || []);
        if (list && list.length > 0) {
          const sysInfo = await TauriSutoAPI.getSystemInfo?.({ transport: targetTransport }).catch(() => null);
          const devName = sysInfo?.device_name || `Connected Device (${targetTransport.toUpperCase()})`;
          results.push(buildDeviceFromRawChannels(list, devName, `Live ${targetTransport.toUpperCase()}`, targetTransport, sysInfo));
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
 * Calculate non-overlapping grid coordinates for newly added sensor cards.
 * Provides comfortable padding gaps between cards and wraps to a new line when a row fills up.
 */
export function calculateSensorCardGridPosition(scapeId, elements = [], cardIndex = 0) {
  const CARD_COL_WIDTH = 270; // 220px card width + 50px visible gap
  const CARD_ROW_HEIGHT = 160; // 110px card height + 50px visible gap
  const CARDS_PER_ROW = 3;

  const savedView = getSavedScapeView(scapeId);
  let baseLeft = 60;
  let baseTop = 60;

  if (savedView && typeof savedView.x === 'number' && typeof savedView.y === 'number') {
    const zoom = savedView.zoom > 0 ? savedView.zoom : 1.0;
    baseLeft = Math.round((-savedView.x) / zoom + 40);
    baseTop = Math.round((-savedView.y) / zoom + 40);
  } else {
    const nonSensors = elements.filter(e => e.type !== 'sensor_card');
    if (nonSensors.length > 0) {
      const xs = nonSensors.map(e => e.x).filter(x => typeof x === 'number');
      const ys = nonSensors.map(e => e.y).filter(y => typeof y === 'number');
      if (xs.length > 0 && ys.length > 0) {
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        baseLeft = Math.max(40, minX);
        baseTop = Math.max(40, minY - 180);
      }
    }
  }

  const col = cardIndex % CARDS_PER_ROW;
  const row = Math.floor(cardIndex / CARDS_PER_ROW);

  return {
    x: baseLeft + 135 + (col * CARD_COL_WIDTH),
    y: baseTop + 75 + (row * CARD_ROW_HEIGHT)
  };
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

  // Build channel -> device mapping from saved devices
  const savedDevs = getSavedDevices();
  const chToDevMap = new Map();
  (savedDevs || []).forEach(d => {
    (d.sensors || []).forEach(s => {
      (s.channels || []).forEach(c => {
        if (c.id) chToDevMap.set(String(c.id), d);
      });
    });
  });

  const formattedChannels = (mp.channels || []).map(ch => {
    const sDev = ch.id ? chToDevMap.get(String(ch.id)) : null;
    let devId = ch.deviceId || sDev?.id;
    let devSerial = ch.deviceSerial || sDev?.serial;
    let devPort = ch.devicePort || sDev?.connectionConfig?.port;
    let devName = ch.device || sDev?.name;

    if (!devId && typeof ch.id === 'string') {
      const m = ch.id.match(/^ch_(dev_[a-zA-Z0-9_-]+?)_\d+(?:_\d+)?$/);
      if (m) {
        devId = m[1];
        const pm = devId.match(/_(\d{2,5})$/);
        if (pm && !devPort) devPort = parseInt(pm[1], 10);
        const snm = devId.match(/_sn_([a-zA-Z0-9_-]+)/);
        if (snm && !devSerial) devSerial = snm[1];
      }
    }

    return {
      id: ch.id || `ch_${ch.channel_id}`,
      name: ch.name || ch.channelName || 'Channel',
      unit: ch.unit || '',
      val: (ch.val !== undefined && ch.val !== null) ? ch.val : '--.-',
      status: ch.status || 'normal',
      channel_id: ch.channel_id ?? ch.id,
      deviceId: devId,
      deviceSerial: devSerial,
      devicePort: devPort,
      device: devName,
      alarmConfig: ch.alarmConfig ? { ...ch.alarmConfig } : undefined
    };
  });

  const cardDevId = formattedChannels.find(c => c.deviceId)?.deviceId;
  const cardDevPort = formattedChannels.find(c => c.devicePort)?.devicePort;
  const cardDevSerial = formattedChannels.find(c => c.deviceSerial)?.deviceSerial;
  const cardDevName = formattedChannels.find(c => c.device)?.device;

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
      locationId: loc.id,
      deviceId: cardDevId || updatedElements[existingCardIdx].deviceId,
      devicePort: cardDevPort || updatedElements[existingCardIdx].devicePort,
      deviceSerial: cardDevSerial || updatedElements[existingCardIdx].deviceSerial,
      device: cardDevName || updatedElements[existingCardIdx].device
    };
  } else {
    const cardCount = existingElements.filter(e => e.type === 'sensor_card').length;
    const gridPos = calculateSensorCardGridPosition(loc.scapeId, existingElements, cardCount);
    const newCard = {
      id: `elem_${mp.id}`,
      mpId: mp.id,
      locationId: loc.id,
      type: 'sensor_card',
      tag: mp.name,
      x: gridPos.x,
      y: gridPos.y,
      zIndex: 40,
      titlePosition: 'top',
      channels: formattedChannels,
      userPositioned: false,
      deviceId: cardDevId,
      devicePort: cardDevPort,
      deviceSerial: cardDevSerial,
      device: cardDevName
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
  let allScapes = getAllScapes();
  const rawLocations = customLocations || getLocations();

  // If locations exist or are being synced, but there are 0 scapes in the system,
  // automatically create a clean default empty scape so the sensor cards have a canvas to display on!
  const hasChannels = rawLocations.some(l =>
    (l.measurementPoints || []).some(mp => Array.isArray(mp.channels) && mp.channels.length > 0)
  );
  if (allScapes.length === 0 && (rawLocations.length > 0 || hasChannels)) {
    const fresh = createNewScape('Default Plant');
    allScapes = [fresh];
  }

  const currentActiveId = getActiveScapeId();
  const fallbackScapeId = currentActiveId || allScapes[0]?.id;

  const locations = rawLocations.map(loc => {
    // If location already has a valid scapeId that exists in allScapes, strictly preserve it!
    // Never overwrite an assigned scape when multiple locations and scapes exist.
    if (loc.scapeId && allScapes.some(s => s.id === loc.scapeId)) {
      return loc;
    }
    // If there is only ONE location in the system and scapeId was not set, allow single-location fallback:
    if (rawLocations.length === 1 && !loc.scapeId && allScapes.length > 0 && fallbackScapeId) {
      return { ...loc, scapeId: fallbackScapeId };
    }
    // When multiple locations exist, a location without an assigned scape MUST remain empty!
    // Never force an unassigned location to share another location's scape.
    return { ...loc, scapeId: '' };
  });

  const hadPatchedLocs = locations.some((l, i) => l.scapeId !== rawLocations[i]?.scapeId);
  if (hadPatchedLocs) {
    saveLocations(locations);
  }

  let syncCount = 0;
  const affectedScapeIds = new Set();
  const scapesWithSyncedCards = new Set();
  const scapeMap = new Map(allScapes.map(s => [s.id, { ...s, elements: [...(s.elements || [])] }]));

  // Build channel -> device mapping from saved devices
  const savedDevs = getSavedDevices();
  const chToDevMap = new Map();
  (savedDevs || []).forEach(d => {
    (d.sensors || []).forEach(s => {
      (s.channels || []).forEach(c => {
        if (c.id) chToDevMap.set(String(c.id), d);
      });
    });
  });

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

    // Build a map of valid measurement points that have at least 1 channel for this scape
    const validMpMap = new Map();
    matchedLocs.forEach(loc => {
      (loc.measurementPoints || []).forEach(mp => {
        if (Array.isArray(mp.channels) && mp.channels.length > 0) {
          validMpMap.set(mp.id, { mp, locationId: loc.id });
        }
      });
    });

    const hadCardsBefore = (targetScape.elements || []).some(el => el.type === 'sensor_card');
    if (validMpMap.size > 0 || hadCardsBefore) {
      affectedScapeIds.add(scapeId);
    }
    if (validMpMap.size > 0) {
      scapesWithSyncedCards.add(scapeId);
    }

    // Prune sensor cards: keep all non-sensor elements (machines, vessels, pipes, text notes)
    // and prune any sensor cards that do not correspond to an active measurement point with channels
    const remainingElements = (targetScape.elements || []).filter(el => {
      if (el.type !== 'sensor_card') return true;

      // Only keep if the measurement point is active, matched to this scape, and has assigned channels
      if ((el.mpId && validMpMap.has(el.mpId)) || (el.id && validMpMap.has(el.id.replace('elem_', '')))) {
        return true;
      }

      // Otherwise prune it
      return false;
    });

    const finalElements = [...remainingElements];

    let cardGridIdx = 0;

    // Upsert cards for valid measurement points that have channels
    validMpMap.forEach(({ mp, locationId }) => {
      const existingIdx = finalElements.findIndex(e => e.mpId === mp.id || e.id === `elem_${mp.id}`);

      const formattedChannels = mp.channels.map(ch => {
        const sDev = ch.id ? chToDevMap.get(String(ch.id)) : null;
        let devId = ch.deviceId || sDev?.id;
        let devSerial = ch.deviceSerial || sDev?.serial;
        let devPort = ch.devicePort || sDev?.connectionConfig?.port;
        let devName = ch.device || sDev?.name;

        if (!devId && typeof ch.id === 'string') {
          const m = ch.id.match(/^ch_(dev_[a-zA-Z0-9_-]+?)_\d+(?:_\d+)?$/);
          if (m) {
            devId = m[1];
            const pm = devId.match(/_(\d{2,5})$/);
            if (pm && !devPort) devPort = parseInt(pm[1], 10);
            const snm = devId.match(/_sn_([a-zA-Z0-9_-]+)/);
            if (snm && !devSerial) devSerial = snm[1];
          }
        }

        return {
          id: ch.id || `ch_${ch.channel_id}`,
          name: ch.displayName || ch.name || ch.channelName || 'Channel',
          rawName: ch.name || ch.channelName,
          displayName: ch.displayName,
          unit: ch.unit || '',
          val: (ch.val !== undefined && ch.val !== null) ? ch.val : '--.-',
          status: ch.status || 'normal',
          channel_id: ch.channel_id ?? ch.id,
          deviceId: devId,
          deviceSerial: devSerial,
          devicePort: devPort,
          device: devName,
          alarmConfig: ch.alarmConfig ? { ...ch.alarmConfig } : undefined
        };
      });

      const cardDevId = formattedChannels.find(c => c.deviceId)?.deviceId;
      const cardDevPort = formattedChannels.find(c => c.devicePort)?.devicePort;
      const cardDevSerial = formattedChannels.find(c => c.deviceSerial)?.deviceSerial;
      const cardDevName = formattedChannels.find(c => c.device)?.device;

      if (existingIdx >= 0) {
        let currX = finalElements[existingIdx].x;
        let currY = finalElements[existingIdx].y;
        const isUserMoved = finalElements[existingIdx].userPositioned || finalElements[existingIdx].attachedAssetId;
        const savedView = getSavedScapeView(scapeId);

        // If card was not manually moved by the user and is stuck at default/legacy overlapping position (e.g. currY <= 80 or offscreen),
        // cleanly align it using the non-overlapping grid layout with padding gap
        if (!isUserMoved && (currY <= 80 || (savedView && (-savedView.y) > 200 && currY < (-savedView.y) / (savedView.zoom || 1)))) {
          const gridPos = calculateSensorCardGridPosition(scapeId, finalElements, cardGridIdx);
          currX = gridPos.x;
          currY = gridPos.y;
        }

        finalElements[existingIdx] = {
          ...finalElements[existingIdx],
          type: 'sensor_card',
          tag: mp.name,
          x: currX,
          y: currY,
          titlePosition: finalElements[existingIdx].titlePosition || 'top',
          channels: formattedChannels,
          locationId,
          deviceId: cardDevId || finalElements[existingIdx].deviceId,
          devicePort: cardDevPort || finalElements[existingIdx].devicePort,
          deviceSerial: cardDevSerial || finalElements[existingIdx].deviceSerial,
          device: cardDevName || finalElements[existingIdx].device
        };
        cardGridIdx++;
      } else {
        const gridPos = calculateSensorCardGridPosition(scapeId, finalElements, cardGridIdx);

        finalElements.push({
          id: `elem_${mp.id}`,
          mpId: mp.id,
          locationId,
          type: 'sensor_card',
          tag: mp.name,
          x: gridPos.x,
          y: gridPos.y,
          zIndex: 40,
          titlePosition: 'top',
          channels: formattedChannels,
          userPositioned: false,
          deviceId: cardDevId,
          devicePort: cardDevPort,
          deviceSerial: cardDevSerial,
          device: cardDevName
        });
        cardGridIdx++;
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

  const sortedAffectedScapeIds = [
    ...scapesWithSyncedCards,
    ...Array.from(affectedScapeIds).filter(id => !scapesWithSyncedCards.has(id))
  ];

  return {
    success: true,
    syncCount,
    affectedScapeIds: sortedAffectedScapeIds
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
  const devSerial = String(device.serial || device.connectionConfig?.serial || '').trim();
  const devId = String(device.id || '').trim();
  const devName = String(device.name || '').trim();

  (device.sensors || []).forEach(s => {
    (s.channels || []).forEach(c => {
      if (c.id) devChannelIds.add(String(c.id));
    });
  });

  const assignments = [];
  locations.forEach(loc => {
    (loc.measurementPoints || []).forEach(mp => {
      (mp.channels || []).forEach(ch => {
        if (!ch) return;
        // Strict matching to prevent cross-device collision:
        // 1. Exact full channel ID match
        const matchesExactId = ch.id && devChannelIds.has(String(ch.id));
        // 2. Hardware / virtual serial number match (highest priority physical hardware identifier)
        const matchesSerial = Boolean(devSerial && ch.deviceSerial && String(ch.deviceSerial) === devSerial);
        // 3. Exact device ID match
        const matchesDevId = Boolean(devId && ((ch.deviceId && String(ch.deviceId) === devId) || (typeof ch.id === 'string' && ch.id.includes(devId))));
        // 4. Device Name match ONLY if neither device has a serial or deviceId
        const matchesDeviceName = Boolean(!devSerial && !devId && !ch.deviceSerial && !ch.deviceId && ch.device && devName && ch.device === devName);

        if (matchesExactId || matchesSerial || matchesDevId || matchesDeviceName) {
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

  // 1. Gather all unique full channel IDs belonging strictly to this device
  const devChannelIds = new Set();
  (targetDev.sensors || []).forEach(s => {
    (s.channels || []).forEach(c => {
      if (c.id) devChannelIds.add(String(c.id));
    });
  });

  const targetDevId = String(targetDev.id);
  const targetPort = targetDev.connectionConfig?.port || targetDev.port;
  const targetSerial = String(targetDev.serial || targetDev.connectionConfig?.serial || '');

  // 2. Remove device from devices storage
  const updatedDevices = currentDevices.filter(d => d.id !== deviceId);
  saveDevices(updatedDevices);

  // 3. Unassign only this device's channels from all measurement points in all locations
  const currentLocations = getLocations();
  let unassignedCount = 0;

  const updatedLocations = currentLocations.map(loc => {
    const updatedMps = (loc.measurementPoints || []).map(mp => {
      const remainingChannels = (mp.channels || []).filter(ch => {
        // Strict match: does this channel belong to the device being deleted?
        const matchesExactId = ch.id && devChannelIds.has(String(ch.id));
        const matchesDevId = (ch.deviceId && String(ch.deviceId) === targetDevId) ||
                             (typeof ch.id === 'string' && ch.id.includes(targetDevId));
        const matchesSerial = Boolean(targetSerial && ch.deviceSerial && String(ch.deviceSerial) === targetSerial);
        const matchesPort = Boolean(targetPort && ch.devicePort && Number(ch.devicePort) === Number(targetPort));

        const belongsToTarget = matchesExactId || matchesDevId || matchesSerial || matchesPort;

        if (belongsToTarget) {
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
const pendingCallbacks = [];

/**
 * Automatically reconnect to saved devices on startup, page refresh, or ProcessScape entry.
 * Restores hardware transport link (Ethernet TCP/API, USB, BLE) and enables live polling data immediately.
 * Reconnects ALL saved devices concurrently without stopping after the first device.
 * @param {Function|null} onConnectedCallback - Optional callback invoked with connected session
 */
export function autoReconnectSavedDevices(onConnectedCallback = null) {
  if (typeof onConnectedCallback === 'function') {
    pendingCallbacks.push(onConnectedCallback);
  }

  if (autoReconnectPromise) {
    return autoReconnectPromise;
  }

  const devices = getSavedDevices();
  if (!devices || devices.length === 0) {
    return Promise.resolve({ reconnected: false, reason: 'no_saved_devices' });
  }

  const runReconnect = async () => {
    try {
      await TauriSutoAPI?.logClientEvent?.('INFO', 'AUTO_RECONNECT', `Starting auto-reconnect check for ${devices.length} saved device(s)...`);

      let connectedCount = 0;
      let lastConn = null;
      let lastTransport = null;
      let lastDevName = null;

      for (let i = 0; i < devices.length; i++) {
        const dev = devices[i];
        const config = dev.connectionConfig || {};
        const rawTransport = (config.transport || dev.transportType || dev.transport || '').toLowerCase();
        const host = config.host || dev.host || dev.ip || (typeof dev.transport === 'string' && dev.transport.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1]) || (typeof dev.name === 'string' && dev.name.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1]);
        const port = config.port || dev.port || (typeof dev.transport === 'string' && dev.transport.match(/:(\d+)/)?.[1]) || null;

        const isModbus = rawTransport.includes('modbus');
        const isApi = !isModbus && (rawTransport.includes('api') || rawTransport.includes('s332') || port === 8080);
        const isTcp = !isModbus && (rawTransport.includes('tcp') || rawTransport.includes('ethernet') || rawTransport.includes('lan') || (Boolean(host) && !rawTransport.includes('usb') && !rawTransport.includes('ble')));
        const isUsb = rawTransport.includes('usb');
        const isBle = rawTransport.includes('ble');

        // Check whether THIS specific device is already active in memory
        let isDeviceActive = false;
        if (isModbus) {
          isDeviceActive = typeof TauriSutoAPI?.isModbusDeviceActive === 'function' &&
            TauriSutoAPI.isModbusDeviceActive({
              id: dev.id,
              deviceId: dev.deviceId || dev.id,
              serial: dev.serial || config.serial,
              host,
              port: port || 502,
              slaveId: config.slaveId || dev.slaveId || 1,
              isRtu: rawTransport.includes('rtu') || Boolean(config.isRtu),
              serialPort: config.serialPort || dev.serialPort
            });
        } else if (isTcp) {
          isDeviceActive = TauriSutoAPI?.getActiveTransport?.() === 'TCP';
        } else if (isUsb) {
          isDeviceActive = TauriSutoAPI?.getActiveTransport?.() === 'USB';
        } else if (isApi) {
          isDeviceActive = TauriSutoAPI?.getActiveTransport?.() === 'API';
        } else if (isBle) {
          const act = TauriSutoAPI?.getActiveTransport?.();
          isDeviceActive = (act === 'BLE' || act === 'BLE_WEB') && (typeof TauriSutoAPI?.isConnected === 'function' && TauriSutoAPI.isConnected());
        }

        // If this device is already active in this session, do not disrupt the live socket
        if (isDeviceActive) {
          dev.isOnline = true;
          connectedCount++;
          lastConn = {
            transport: isTcp ? 'TCP' : isApi ? 'API' : isUsb ? 'USB' : isModbus ? (rawTransport.includes('rtu') ? 'Modbus RTU' : 'Modbus TCP') : 'BLE',
            host,
            port,
            device: dev.name,
            name: dev.name,
          };
          lastTransport = lastConn.transport;
          lastDevName = dev.name;
          continue;
        }

        try {
          let conn = null;
          if (isModbus && (host || config.isRtu || rawTransport.includes('rtu'))) {
            await TauriSutoAPI?.logClientEvent?.('INFO', 'AUTO_RECONNECT', `Auto-reconnecting Modbus device "${dev.name}" at ${host || config.serialPort}:${port || 502}...`);
            const allDevChannels = [];
            (dev.sensors || []).forEach(s => {
              if (Array.isArray(s.channels)) allDevChannels.push(...s.channels);
            });
            if (allDevChannels.length === 0 && Array.isArray(dev.channels)) {
              allDevChannels.push(...dev.channels);
            }
            if (allDevChannels.length === 0 && typeof TauriSutoAPI?.discoverS331ChannelsOverModbus === 'function') {
              try {
                const discChs = await TauriSutoAPI.discoverS331ChannelsOverModbus({
                  host,
                  port: port || 502,
                  slaveId: config.slaveId || dev.slaveId || 1,
                  isRtu: rawTransport.includes('rtu') || Boolean(config.isRtu),
                  serialPort: config.serialPort || dev.serialPort
                });
                if (Array.isArray(discChs) && discChs.length > 0) {
                  allDevChannels.push(...discChs);
                }
              } catch (_) {}
            }
            conn = await TauriSutoAPI.connectModbusTcp({
              host: (rawTransport.includes('rtu') || Boolean(config.isRtu)) ? null : (host || '127.0.0.1'),
              port: port || 502,
              slaveId: config.slaveId || dev.slaveId || 1,
              name: dev.name,
              serial: dev.serial || config.serial,
              channels: allDevChannels,
              isRtu: rawTransport.includes('rtu') || Boolean(config.isRtu),
              serialPort: config.serialPort || dev.serialPort,
              baudRate: config.baudRate || dev.baudRate || 19200,
              parity: config.parity || dev.parity || 'none'
            });
          } else if (isApi && host) {
            await TauriSutoAPI?.logClientEvent?.('INFO', 'AUTO_RECONNECT', `Auto-reconnecting API device "${dev.name}" at ${host}:${port || 8080}...`);
            conn = await TauriSutoAPI.connectApi(host, port || 8080);
          } else if (isTcp && host) {
            await TauriSutoAPI?.logClientEvent?.('INFO', 'AUTO_RECONNECT', `Auto-reconnecting Ethernet device "${dev.name}" at ${host}:${port || 502}...`);
            conn = await TauriSutoAPI.connectTcp(host, port || 502);
          } else if (isUsb && typeof TauriSutoAPI.isAvailable === 'function' && TauriSutoAPI.isAvailable()) {
            await TauriSutoAPI?.logClientEvent?.('INFO', 'AUTO_RECONNECT', `Auto-reconnecting USB device "${dev.name}"...`);
            conn = await TauriSutoAPI.connectUsb();
          } else if (isBle) {
            try {
              await TauriSutoAPI?.logClientEvent?.('INFO', 'AUTO_RECONNECT', `Auto-resuming BLE device "${dev.name}"...`);
              conn = await TauriSutoAPI.resumeBleConnection({
                deviceId: config.deviceId || dev.id,
                name: config.name || dev.name
              });
            } catch (bleErr) {
              dev.isOnline = false;
              console.info(`[AutoReconnect] BLE device "${dev.name}" not in range currently (${bleErr?.message || bleErr}). Connect via "Detect" or ↻ when in range.`);
            }
          }

          if (conn) {
            dev.isOnline = true;
            connectedCount++;
            lastConn = conn;
            lastTransport = conn?.transport || (isTcp ? 'TCP' : isApi ? 'API' : isUsb ? 'USB' : 'BLE');
            lastDevName = dev.name;
            saveDevices(devices);
            await TauriSutoAPI?.logClientEvent?.('INFO', 'AUTO_RECONNECT', `✓ Successfully auto-reconnected to "${dev.name}" (${lastTransport})`);
          }
        } catch (err) {
          dev.isOnline = false;
          await TauriSutoAPI?.logClientEvent?.('WARN', 'AUTO_RECONNECT', `Failed to reconnect "${dev.name}": ${err?.message || err}`);
          console.warn(`[AutoReconnect] Could not reconnect to "${dev.name}":`, err?.message || err);
        }
      }

      if (connectedCount > 0) {
        if (typeof TauriSutoAPI?.getChannels === 'function') {
          try {
            await TauriSutoAPI.getChannels();
          } catch (_) {}
        }

        while (pendingCallbacks.length > 0) {
          const cb = pendingCallbacks.shift();
          try { cb(lastConn); } catch (_) {}
        }

        try {
          syncAllLocationsToScapes();
        } catch (_) {}

        try {
          pollOnce();
        } catch (_) {}

        return {
          reconnected: true,
          connectedCount,
          transport: lastTransport,
          device: lastDevName,
          conn: lastConn,
          lastConn
        };
      }

      return { reconnected: false, reason: 'failed_all_devices' };
    } finally {
      autoReconnectPromise = null;
      pendingCallbacks.length = 0;
    }
  };

  autoReconnectPromise = runReconnect().finally(() => {
    autoReconnectPromise = null;
    pendingCallbacks.length = 0;
  });

  return autoReconnectPromise;
}
