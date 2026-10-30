/**
 * Detect whether the application is running inside a desktop runtime
 * (Tauri or Electron) or as a pure web browser application.
 */

export const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
export const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

export const checkIsTauri = () =>
  typeof window !== 'undefined' &&
  Boolean(
    window.__TAURI_INTERNALS__ ||
    window.__TAURI__ ||
    window.location?.hostname === 'tauri.localhost' ||
    window.location?.protocol === 'tauri:'
  );

export const checkIsElectron = () =>
  typeof window !== 'undefined' &&
  Boolean(window.desktopApi?.isDesktop || window.electron || window.process?.type === 'renderer');

export const checkIsNative = () => checkIsTauri() || checkIsElectron();
export const isNative = typeof window !== 'undefined' && checkIsNative();

export const checkIsDesktop = () => !isMobile && checkIsNative();

export const isTauri = typeof window !== 'undefined' && Boolean(
  window.__TAURI_INTERNALS__ ||
  window.__TAURI__ ||
  window.location?.hostname === 'tauri.localhost' ||
  window.location?.protocol === 'tauri:'
);
export const isElectron =
  typeof window !== 'undefined' &&
  Boolean(window.desktopApi?.isDesktop || window.electron || window.process?.type === 'renderer');

export const isDesktop = typeof window !== 'undefined' && !isMobile && checkIsNative();
export const isWeb = typeof window !== 'undefined' && !checkIsNative();
export const checkIsWeb = () => !checkIsNative();
export const isDesktopApp = checkIsDesktop;

/**
 * Get human-readable runtime target name
 * @returns {'android' | 'mobile' | 'desktop-tauri' | 'desktop-electron' | 'web'}
 */
export const getRuntimePlatform = () => {
  if (isAndroid) return 'android';
  if (isMobile) return 'mobile';
  if (checkIsTauri()) return 'desktop-tauri';
  if (checkIsElectron()) return 'desktop-electron';
  return 'web';
};

export const SUTO_MODEL_TYPES = {
  0x1049: 'S132',
  0x104b: 'S120',
  0x1052: 'DS320',
  0x1053: 'DS330',
  0x1055: 'DS350',
  0x1060: 'DS350-P2',
  0x1061: 'DS350-P4',
  0x1062: 'DS350-P6',
  0x1064: 'S330',
  0x1065: 'S331',
  0x1066: 'S551-P4',
  0x1067: 'S551-P6',
  0x1068: 'S600',
  0x1069: 'S600-1',
  0x106f: 'S600-AC',
  0x1080: 'DP500',
  0x1082: 'DP520',
  0x1088: 'S332+A3001',
  0x1089: 'S332+A3002',
  0x108a: 'S332-OPT-Relay2ch',
  0x108b: 'S332-OPT-Current',
  0x108c: 'S332-OPT-Voltage',
  0x108d: 'S332-OPT-Digital input',
  0x108e: 'S332-OPT-Relay4ch',
  0x108f: 'DL G2',
  '0x1088': 'S332+A3001',
  '0x1089': 'S332+A3002',
  '0x108a': 'S332-OPT-Relay2ch',
  '0x108A': 'S332-OPT-Relay2ch',
  '0x108b': 'S332-OPT-Current',
  '0x108B': 'S332-OPT-Current',
  '0x108c': 'S332-OPT-Voltage',
  '0x108C': 'S332-OPT-Voltage',
  '0x108d': 'S332-OPT-Digital input',
  '0x108D': 'S332-OPT-Digital input',
  '0x108e': 'S332-OPT-Relay4ch',
  '0x108E': 'S332-OPT-Relay4ch',
  '0x108f': 'DL G2',
  '0x108F': 'DL G2',
  0x120e: 'S418-DN8',
  0x120f: 'S418-DN15',
  0x1210: 'S418-DN20',
  0x1211: 'S418-DN25',
  0x1217: 'S415-DN32',
  0x1218: 'S418-DN32',
  0x1219: 'S419-DN32',
  0x122b: 'S418-DN40',
  0x122c: 'S418-DN50',
  0x122d: 'S418V-DN40',
  0x122e: 'S418V-DN50',
  0x121e: 'S605I',
  0x121f: 'S605C',
  0x1220: 'S606I',
  0x1221: 'S606C',
  0x1300: 'S461',
  0x1302: 'S463',
  0x0001: 'TG',
  0x0002: 'FA 300',
  0x0003: 'VA 300',
  0x0004: 'DS 300',
  0x0005: 'DS 300',
  0x0006: 'DS 300',
};

export const S332_MODEL_IDS = {
  0x1088: 'S332+A3001',
  0x1089: 'S332+A3002',
  0x108a: 'S332-OPT-Relay2ch',
  0x108b: 'S332-OPT-Current',
  0x108c: 'S332-OPT-Voltage',
  0x108d: 'S332-OPT-Digital input',
  0x108e: 'S332-OPT-Relay4ch',
  0x108f: 'DL G2',
};

export function isS332DeviceId(deviceId) {
  if (deviceId === undefined || deviceId === null) return false;
  const num = typeof deviceId === 'string'
    ? (parseInt(String(deviceId).trim().replace(/^ox/i, '0x'), 16) || Number(deviceId))
    : Number(deviceId);
  return num >= 0x1088 && num <= 0x108f;
}

export function resolveDeviceTypeName(sysInfo, deviceInfo) {
  const rawId = sysInfo?.device_id ?? deviceInfo?.deviceId ?? deviceInfo?.device_id;
  if (rawId !== undefined && rawId !== null) {
    if (SUTO_MODEL_TYPES[rawId]) return SUTO_MODEL_TYPES[rawId];
    const num = typeof rawId === 'string'
      ? (parseInt(String(rawId).trim().replace(/^ox/i, '0x'), 16) || Number(rawId))
      : Number(rawId);
    if (SUTO_MODEL_TYPES[num]) return SUTO_MODEL_TYPES[num];
  }
  const candidateNames = [
    sysInfo?.device_name,
    sysInfo?.model,
    deviceInfo?.device,
    deviceInfo?.name,
  ].filter(Boolean);

  for (const str of candidateNames) {
    const match = str.match(/\b(S\d{3}[A-Z\d-]*|DS\s?\d{3}[A-Z\d-]*|DP\s?\d{3}[A-Z\d-]*|VA\s?\d{3}|FA\s?\d{3})\b/i);
    if (match) {
      return match[1].replace(/\s+/g, '');
    }
  }

  if (sysInfo?.device_name && sysInfo.device_name.trim()) {
    return sysInfo.device_name.trim();
  }
  if (deviceInfo?.device && deviceInfo.device.trim()) {
    return deviceInfo.device.trim();
  }
  return 'SUTO Connected Hardware';
}
