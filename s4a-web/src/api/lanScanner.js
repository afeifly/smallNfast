/**
 * lanScanner.js
 *
 * LAN Auto-Detection Engine for SUTO Ethernet & S332 WebAPI devices.
 * Scans a configurable IP range/subnet concurrently and discovers online devices.
 */

import ApiDevice from './device/ApiDevice';
import TauriSutoAPI from './TauriSutoAPI';
import { buildDeviceFromRawChannels } from '../modules/processscape/engine/sensorManagerStorage';

/**
 * Detect the likely local subnet based on the current window location
 * (e.g. if accessed via http://192.168.5.x, defaults to "192.168.5.")
 */
export function getDefaultSubnet() {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    const match = host.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)/);
    if (match && !host.startsWith('127.')) {
      return match[1];
    }
  }
  return '192.168.5.';
}

/**
 * Probe a single IP address to see if a SUTO / S332 device responds
 */
export async function probeDeviceAtIp(ip, options = {}) {
  const timeoutMs = options.timeoutMs || 800;
  const signal = options.signal;

  if (signal?.aborted) return null;

  // 1. Probe S332 WebAPI on port 8080 (GET /channel/list)
  try {
    const ctrl = new AbortController();
    const abortHandler = () => ctrl.abort();
    if (signal) signal.addEventListener('abort', abortHandler, { once: true });
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const resp = await fetch(`http://${ip}:8080/channel/list`, {
        method: 'GET',
        signal: ctrl.signal,
        headers: { Accept: 'application/json, text/plain, */*' }
      });
      clearTimeout(timer);

      if (resp.ok) {
        let json = null;
        try {
          json = await resp.json();
        } catch (_) {}

        const rawChannels = json?.data?.classchannel || [];

        // Attempt to fetch device info non-blocking
        let sysInfo = null;
        try {
          const sysCtrl = new AbortController();
          const sysTimer = setTimeout(() => sysCtrl.abort(), 600);
          const sysResp = await fetch(`http://${ip}:8080/system/device-info`, {
            signal: sysCtrl.signal,
            headers: { Accept: 'application/json, text/plain, */*' }
          });
          clearTimeout(sysTimer);
          if (sysResp.ok) sysInfo = await sysResp.json();
        } catch (_) {}

        // Fallback to /system/information
        let sysInfo2 = null;
        try {
          const sysCtrl2 = new AbortController();
          const sysTimer2 = setTimeout(() => sysCtrl2.abort(), 600);
          const sysResp2 = await fetch(`http://${ip}:8080/system/information`, {
            signal: sysCtrl2.signal,
            headers: { Accept: 'application/json, text/plain, */*' }
          });
          clearTimeout(sysTimer2);
          if (sysResp2.ok) sysInfo2 = await sysResp2.json();
        } catch (_) {}

        const devData = sysInfo?.data || {};
        const devData2 = sysInfo2?.data || {};
        const sn = devData2.sn || devData.serialnumber || devData.device_id || '12341234';
        const fw = devData2.fw || devData.firmwareversion || '1.0.3-Atlas11';
        const devName = devData.devicename || devData2.type || 'S332';
        const devId = devData.device_id || '0x108F';

        return {
          id: `s332_${ip.replace(/\./g, '_')}`,
          ip,
          host: ip,
          port: 8080,
          protocol: 'API',
          transport: 'API',
          transportLabel: `S332 API (${ip})`,
          name: devName,
          model: devName,
          deviceId: devId,
          device_id: devId,
          serial: sn,
          serial_number: sn,
          firmware: fw,
          firmware_version: fw,
          channelsCount: Array.isArray(rawChannels) ? rawChannels.length : 0,
          rawChannels,
          rawSysInfo: {
            device_name: devName,
            serial_number: sn,
            firmware_version: fw,
            device_id: devId
          }
        };
      }
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', abortHandler);
    }
  } catch (_) {}

  // 2. Probe standard SUTO HTTP on port 80
  try {
    if (signal?.aborted) return null;
    const ctrl = new AbortController();
    const abortHandler = () => ctrl.abort();
    if (signal) signal.addEventListener('abort', abortHandler, { once: true });
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const resp = await fetch(`http://${ip}:80/`, {
        method: 'GET',
        signal: ctrl.signal,
        headers: { Accept: '*/*' }
      });
      clearTimeout(timer);

      if (resp.ok) {
        return {
          id: `eth_${ip.replace(/\./g, '_')}`,
          ip,
          host: ip,
          port: 80,
          protocol: 'HTTP',
          transport: 'TCP',
          transportLabel: `Ethernet (${ip})`,
          name: `SUTO Ethernet Device (${ip})`,
          model: 'SUTO Ethernet',
          serial: `SN-${ip.replace(/\./g, '')}`,
          firmware: 'Standard',
          channelsCount: 0,
          rawChannels: [],
          rawSysInfo: {}
        };
      }
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', abortHandler);
    }
  } catch (_) {}

  return null;
}

/**
 * Scan a range of IP addresses on a subnet concurrently in batches
 *
 * @param {Object} options
 * @param {string} options.subnet e.g. "192.168.5."
 * @param {number} options.start e.g. 1
 * @param {number} options.end e.g. 254
 * @param {number} options.batchSize e.g. 25
 * @param {number} options.timeoutMs e.g. 800
 * @param {Function} options.onProgress e.g. ({ scanned, total, percent, currentIp })
 * @param {Function} options.onDeviceFound e.g. (device)
 * @param {AbortSignal} options.signal
 * @returns {Promise<Array>} List of responding devices
 */
export async function scanLanRange(options = {}) {
  let subnet = (options.subnet || getDefaultSubnet()).trim();
  if (!subnet.endsWith('.')) {
    subnet += '.';
  }

  const start = Math.max(1, Math.min(254, parseInt(options.start, 10) || 1));
  const end = Math.max(start, Math.min(254, parseInt(options.end, 10) || 254));
  const batchSize = Math.max(5, Math.min(50, options.batchSize || 25));
  const timeoutMs = options.timeoutMs || 800;
  const signal = options.signal;

  const total = end - start + 1;
  let scanned = 0;
  const foundDevices = [];

  // Generate IP list
  const ipList = [];
  for (let i = start; i <= end; i++) {
    ipList.push(`${subnet}${i}`);
  }

  // Process in batches
  for (let i = 0; i < ipList.length; i += batchSize) {
    if (signal?.aborted) break;

    const chunk = ipList.slice(i, i + batchSize);
    const probePromises = chunk.map(async (ip) => {
      if (signal?.aborted) return null;
      try {
        const dev = await probeDeviceAtIp(ip, { timeoutMs, signal });
        if (dev) {
          foundDevices.push(dev);
          if (typeof options.onDeviceFound === 'function') {
            options.onDeviceFound(dev);
          }
        }
      } catch (_) {} finally {
        scanned++;
        if (typeof options.onProgress === 'function') {
          options.onProgress({
            scanned,
            total,
            percent: Math.round((scanned / total) * 100),
            currentIp: ip
          });
        }
      }
    });

    await Promise.all(probePromises);
  }

  return foundDevices;
}

/**
 * SUTO CSLib UDP Ethernet Broadcast Auto-Discovery.
 * Broadcasts command `A1 15 02 00 00 FF` on port 8800 to `255.255.255.255`,
 * waits for device response datagrams, then queries responding devices for system info & channels.
 */
export async function discoverDevicesViaBroadcast(options = {}) {
  const timeoutMs = options.timeoutMs || 1600;
  const subnetBroadcast = options.subnetBroadcast || (options.subnet ? `${options.subnet}255` : null);

  let rawDiscovered = [];
  try {
    rawDiscovered = await TauriSutoAPI.discoverEthernetBroadcast({
      timeoutMs,
      subnetBroadcast
    });
  } catch (err) {
    console.warn('[lanScanner] UDP broadcast discovery failed or unsupported:', err);
  }

  const foundDevices = [];
  if (Array.isArray(rawDiscovered) && rawDiscovered.length > 0) {
    for (const item of rawDiscovered) {
      if (!item?.ip) continue;
      let dev = await probeDeviceAtIp(item.ip, { timeoutMs: 1200, signal: options.signal });
      if (!dev) {
        // Fallback device object if HTTP 8080 is not available but Ethernet port responded
        dev = {
          id: `eth_${item.ip.replace(/\./g, '_')}`,
          ip: item.ip,
          host: item.ip,
          port: item.port || 502,
          protocol: 'TCP',
          transport: 'TCP',
          transportLabel: `Ethernet (${item.ip})`,
          name: `SUTO Ethernet Device (${item.mac || item.ip})`,
          model: 'SUTO Ethernet Device',
          deviceId: `0x${(item.device_number || 0).toString(16).toUpperCase()}`,
          device_id: `0x${(item.device_number || 0).toString(16).toUpperCase()}`,
          serial: item.mac ? item.mac.replace(/:/g, '') : item.ip,
          serial_number: item.mac ? item.mac.replace(/:/g, '') : item.ip,
          mac: item.mac || '',
          deviceNumber: item.device_number,
          firmware: 'CSLib-Ethernet',
          firmware_version: 'CSLib-Ethernet',
          channelsCount: 0,
          channels: [],
          rawChannels: []
        };
      } else {
        if (item.mac) dev.mac = item.mac;
        if (item.device_number) dev.deviceNumber = item.device_number;
      }

      foundDevices.push(dev);
      if (typeof options.onDeviceFound === 'function') {
        options.onDeviceFound(dev);
      }
    }
  }

  return foundDevices;
}

/**
 * Convert a discovered LAN device into a SensorManager compatible device object
 * with formatted channels.
 */
export function convertDiscoveredToSensorManagerDevice(discDev) {
  if (!discDev) return null;

  const channelsList = discDev.rawChannels || discDev.channels || [];
  let formattedChannels = [];
  if (Array.isArray(channelsList) && channelsList.length > 0) {
    if (channelsList[0]?.channelid !== undefined || channelsList[0]?.channeldescription !== undefined) {
      formattedChannels = ApiDevice.formatChannels(channelsList);
    } else {
      formattedChannels = channelsList;
    }
  }

  return buildDeviceFromRawChannels(
    formattedChannels,
    discDev.name || 'SUTO Device',
    discDev.transportLabel || `Ethernet (${discDev.ip})`,
    (discDev.transport || 'api').toLowerCase(),
    {
      ...(discDev.rawSysInfo || {}),
      ...(discDev || {}),
      host: discDev.ip,
      ip: discDev.ip,
      port: discDev.port || 8080,
      transport: discDev.transport || 'api'
    }
  );
}
