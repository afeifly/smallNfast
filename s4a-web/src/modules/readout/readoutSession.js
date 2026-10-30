import { resolveDeviceTypeName, isS332DeviceId } from '../../util/platform';
import TauriSutoAPI from '../../api/TauriSutoAPI';

/**
 * Check if the device belongs to the S332 family:
 * S332+A3001 (0x1088), S332+A3002 (0x1089), S332-OPT-Relay2ch (0x108A),
 * S332-OPT-Current (0x108B), S332-OPT-Voltage (0x108C), S332-OPT-Digital input (0x108D),
 * S332-OPT-Relay4ch (0x108E), DL G2 (0x108F).
 */
export function isS332Family(deviceInfo, sysInfo) {
  const rawId = sysInfo?.device_id ?? deviceInfo?.deviceId ?? deviceInfo?.device_id;
  if (isS332DeviceId(rawId)) return true;

  const activeTransport = typeof TauriSutoAPI?.getActiveTransport === 'function' ? TauriSutoAPI.getActiveTransport() : null;
  if (activeTransport === 'API' || deviceInfo?.transport === 'API') return true;

  const resolvedName = resolveDeviceTypeName(sysInfo, deviceInfo) || '';
  const name = `${deviceInfo?.device || ''} ${deviceInfo?.name || ''} ${sysInfo?.device_name || ''} ${deviceInfo?.device_description || ''} ${resolvedName}`.toLowerCase();

  return (
    name.includes('s332') ||
    name.includes('dl g2') ||
    name.includes('dlg2') ||
    name.includes('a3001') ||
    name.includes('a3002') ||
    name.includes('opt-relay') ||
    name.includes('opt-current') ||
    name.includes('opt-voltage') ||
    name.includes('opt-digital')
  );
}

/**
 * Identify SUTO logger family based on S4ABase.java logic:
 * - 's332': S332, DL G2, S332+A3001..A3002, S332-OPT-* (0x1088 - 0x108F)
 * - 'ds310': DS310, S330, S331, S551 (Simple devices)
 * - 's600': S600, S601, S602, S132
 * - 's605': S605 Series
 * - 's606': S606 Series
 * - 's418': S418, S419, S415 Series (Compact Flow Meter Logger)
 * - 's461': S461, S463 Series (Clamp-On Ultrasonic Flow & Energy Meter Logger)
 */
export function resolveLoggerType(deviceInfo, sysInfo) {
  const rawId = sysInfo?.device_id ?? deviceInfo?.deviceId ?? deviceInfo?.device_id;
  const devId = typeof rawId === 'string'
    ? (parseInt(String(rawId).trim().replace(/^ox/i, '0x'), 16) || Number(rawId))
    : Number(rawId);
  const resolvedName = resolveDeviceTypeName(sysInfo, deviceInfo) || '';
  const name = `${deviceInfo?.device || ''} ${deviceInfo?.name || ''} ${sysInfo?.device_name || ''} ${deviceInfo?.device_description || ''} ${resolvedName}`.toLowerCase();

  // S332 family (0x1088 - 0x108F)
  if (isS332Family(deviceInfo, sysInfo)) {
    return 's332';
  }

  // S418 / S419
  if (
    name.includes('418') ||
    name.includes('419') ||
    name.includes('415') ||
    devId === 418 ||
    devId === 419 ||
    (devId >= 0x120e && devId <= 0x1219) ||
    (devId >= 0x122b && devId <= 0x122e)
  ) {
    return 's418';
  }

  // S461 / S463
  if (
    name.includes('461') ||
    name.includes('463') ||
    devId === 461 ||
    devId === 463 ||
    devId === 0x1300 ||
    devId === 0x1302
  ) {
    return 's461';
  }

  // S606
  if (name.includes('606') || devId === 606 || devId === 0x1220 || devId === 0x1221) {
    return 's606';
  }

  // S605
  if (name.includes('605') || devId === 605 || devId === 0x121e || devId === 0x121f) {
    return 's605';
  }

  // S600
  if (
    name.includes('600') ||
    name.includes('601') ||
    name.includes('602') ||
    name.includes('132') ||
    devId === 600 ||
    devId === 0x1068 ||
    devId === 0x1069 ||
    devId === 0x106f ||
    devId === 0x1049
  ) {
    return 's600';
  }

  // S330 / S331 / DS310 / S551 / S120 (Memory Logger)
  return 'ds310';
}

// Session cache for preserving readout data across component mount/unmount while connected
export const _readoutSessionCache = {
  deviceKey: null,
  hasFetched: false,
  filesList: [],
  selectedFileIdx: null,
  sysInfo: null,
  deviceChannels: [],
  loggerStatus: null,
  screenshotsList: [],
  diskCapacity: null,
};

export function updateReadoutCache(data) {
  Object.assign(_readoutSessionCache, data);
}

export function clearReadoutCache() {
  Object.assign(_readoutSessionCache, {
    deviceKey: null,
    hasFetched: false,
    filesList: [],
    selectedFileIdx: null,
    sysInfo: null,
    deviceChannels: [],
    loggerStatus: null,
    screenshotsList: [],
    diskCapacity: null,
  });
}
