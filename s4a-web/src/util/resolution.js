/**
 * SUTO Channel Resolution Utility
 * 
 * Determines decimal resolution for SUTO / S4A measurement channels.
 * Matches CSLib, S4ABase.java, and SUTO sensor profile configurations:
 * 
 * - Flow (m³/h, l/min, cfm, Nm³/h, Nl/min, kg/h): 1 decimal place (e.g. 142.3 m³/h)
 * - Flow (m³/min, l/s, Nm³/min, Nl/s, kg/min): 2 decimal places (e.g. 2.35 m³/min)
 * - Flow (kg/s): 3 decimal places
 * - Pressure (bar, mbar): 2 decimal places (e.g. 6.85 bar)
 * - Pressure (psi, kPa): 1 decimal place (e.g. 99.4 psi)
 * - Pressure (MPa): 3 decimal places (e.g. 0.685 MPa)
 * - Pressure (Pa, hPa): 0 decimal places
 * - Temperature (°C, °F, °Ctd, °Ftd, K, Delta T): 1 decimal place (e.g. 23.6 °C)
 * - Velocity (m/s, sm/s, Nm/s): 2 decimal places (e.g. 12.45 m/s)
 * - Velocity (ft/min, sft/min): 0 decimal places (e.g. 2450 ft/min)
 * - Consumption / Totalizer (m³, l, cf, Nm³, kg, gal, etc.): 0 decimal places (e.g. 123456 m³)
 * - Humidity (%RH, %): 1 decimal place
 * - Electrical (V, mA): 1 decimal place; (A, kW, kV): 2 decimal places; (kWh, W): 0 decimal places
 */

export function getDefaultUnitResolution(unit = '', unitIndex = null) {
  const u = (unit || '').toLowerCase().trim();

  // Consumption / Counter units -> 0 decimals
  if (
    (typeof unitIndex === 'number' && [24, 25, 26, 27, 28, 29, 47].includes(unitIndex)) ||
    ['m³', 'm3', 'l', 'cf', 'nm³', 'nm3', 'nl', 'ncf', 'kg', 'gal', 'wh', 'vah', 'pcs', 'count'].includes(u) ||
    u.startsWith('m³ ') || u.startsWith('m3 ')
  ) {
    return 0;
  }

  // High precision pressure / small units -> 3 decimals
  if (
    unitIndex === 36 ||
    ['mpa', 'mpa(g)', 'mpa(abs)', 'kg/s', 'g/kg'].includes(u)
  ) {
    return 3;
  }

  // Pressure (bar, mbar), Velocity (m/s), and Flow rates per second/minute -> 2 decimals
  if (
    (typeof unitIndex === 'number' && [10, 12, 15, 17, 20, 22, 37, 38, 53].includes(unitIndex)) ||
    [
      'bar', 'bar(g)', 'bar(abs)', 'barg', 'barabs',
      'mbar', 'mbar(g)', 'mbar(abs)',
      'm/s', 'sm/s', 'nm/s',
      'm³/min', 'm3/min', 'nm³/min', 'nm3/min',
      'l/s', 'nl/s',
      'kg/min',
      'a', 'ppm(v)', 'ppm[v]', 'g/m³', 'g/m³ atm.'
    ].includes(u)
  ) {
    return 2;
  }

  // Temperature (°C, °F, °Ctd, °Ftd, K), Pressure (psi, kPa), Flow (m³/h, l/min, cfm, Nm³/h, Nl/min, kg/h) -> 1 decimal
  if (
    (typeof unitIndex === 'number' && [1, 2, 3, 4, 5, 14, 16, 18, 19, 21, 23, 31, 32, 35, 39, 41, 44, 52].includes(unitIndex)) ||
    u.includes('°c') || u.includes('°f') || u.includes('ctd') || u.includes('ftd') ||
    [
      'm³/h', 'm3/h', 'nm³/h', 'nm3/h',
      'l/min', 'nl/min',
      'cfm', 'cfh', 'ncfm', 'ncfh',
      'kg/h', 'lb/h',
      'psi', 'psi(g)', 'psi(abs)', 'psig', 'psiabs',
      'kpa', 'kpa(g)', 'kpa(abs)',
      'v', 'ma', '%', '%rh', '% rh'
    ].includes(u)
  ) {
    return 1;
  }

  // Pa, hPa, ft/min, rpm, w -> 0 decimals
  if (
    (typeof unitIndex === 'number' && [11, 13, 33, 34].includes(unitIndex)) ||
    ['pa', 'pa(g)', 'pa(abs)', 'hpa', 'hpa(g)', 'hpa(abs)', 'ft/min', 'nft/min', 'sft/min', 'rpm', 'w'].includes(u)
  ) {
    return 0;
  }

  return 2; // Standard fallback for analog signals
}

/**
 * Resolve the display resolution for a channel.
 * If channel has an explicit positive resolution (> 0), that is respected.
 * If channel has resolution === 0: if 0 is appropriate for the unit (consumption/counter), 0 is kept;
 * otherwise unit-based standard resolution is applied.
 */
export function resolveChannelResolution(ch) {
  if (!ch) return 2;

  const defaultRes = getDefaultUnitResolution(ch.unit, ch.unit_index);

  if (typeof ch.resolution === 'number' && ch.resolution > 0) {
    return ch.resolution;
  }

  if (ch.resolution === 0 && defaultRes === 0) {
    return 0;
  }

  return defaultRes;
}

/**
 * Format a numeric measurement value using the channel's appropriate resolution.
 */
export function formatChannelValue(val, resolution = 2) {
  if (val === null || val === undefined || isNaN(val)) return '---';
  const res = typeof resolution === 'number' ? Math.max(0, Math.min(6, resolution)) : 2;
  return Number(val).toFixed(res);
}

export default {
  getDefaultUnitResolution,
  resolveChannelResolution,
  formatChannelValue,
};
