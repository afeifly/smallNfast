/**
 * VFConst.js
 *
 * Port of com.cs.canalyzer.structs.VFConst.java
 * Variable-frequency drive compressor constants and flow calculation.
 * Pure computation — no dependencies.
 */

const CUBIC = '\u00B3';

export const INDEX = { MIN: 0, P2: 1, P3: 2, MAX: 3 };

export const AIR_DELIVERY_UNIT = `m${CUBIC}/min`;

/** Power factor */
export const COSPHI = 0.96;

/** Motor power ratings in kW */
export const MOTOR_POWER_LIST = [22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250];

/** System pressure options in bar */
export const SYSTEM_PRESSURE_LIST = [7.5, 10, 13];

/**
 * Power consumption tables [systemPressure][motorPower][MIN|P2|P3|MAX]  in kW
 * 3 pressure levels × 12 motor powers × 4 operating points
 */
export const POWER_LIST = [
  // 7.5 bar
  [
    [7.50, 13.42, 19.56, 26.50],
    [11.80, 19.27, 27.45, 37.91],
    [14.20, 23.81, 34.35, 48.00],
    [15.20, 26.92, 39.54, 55.50],
    [20.50, 35.84, 52.00, 71.00],
    [23.50, 44.33, 66.81, 96.00],
    [37.50, 60.79, 85.20, 113.00],
    [44.00, 64.48, 88.04, 120.00],
    [45.00, 79.17, 115.58, 160.00],
    [70.00, 98.27, 131.44, 177.00],
    [67.50, 118.34, 171.21, 231.00],
    [72.50, 133.08, 198.38, 282.00],
  ],
  // 10 bar
  [
    [7.60, 13.76, 20.00, 26.50],
    [13.35, 20.26, 28.17, 39.00],
    [14.70, 23.93, 34.19, 47.80],
    [16.50, 27.72, 39.85, 55.00],
    [23.50, 38.71, 54.39, 71.50],
    [25.00, 47.61, 71.09, 98.00],
    [41.00, 64.85, 89.10, 114.50],
    [47.50, 67.52, 90.40, 120.50],
    [52.00, 82.09, 115.31, 158.00],
    [75.00, 108.78, 144.06, 183.00],
    [80.00, 127.24, 176.07, 229.50],
    [83.00, 142.50, 206.15, 284.00],
  ],
  // 13 bar
  [
    [7.80, 13.71, 19.85, 26.80],
    [15.00, 21.77, 29.36, 39.10],
    [16.00, 25.40, 35.59, 48.20],
    [18.50, 29.54, 41.31, 55.30],
    [26.00, 41.25, 56.76, 73.00],
    [28.00, 48.35, 68.97, 90.50],
    [47.50, 70.00, 92.50, 115.00],
    [50.00, 71.78, 95.06, 122.00],
    [60.50, 89.89, 121.09, 157.00],
    [80.00, 112.70, 147.00, 185.00],
    [95.00, 139.67, 184.33, 229.00],
    [98.00, 160.50, 223.00, 285.50],
  ],
];

/**
 * Air delivery tables [systemPressure][motorPower][MIN|P2|P3|MAX]  in m³/min
 */
export const AIR_DELIVERY_LIST = [
  // 7.5 bar
  [
    [0.90, 1.77, 2.63, 3.50],
    [1.50, 2.92, 4.33, 5.75],
    [1.90, 3.60, 5.30, 7.00],
    [2.00, 4.00, 6.00, 8.00],
    [3.00, 5.50, 8.00, 10.50],
    [3.30, 6.70, 10.10, 13.50],
    [5.30, 9.37, 13.43, 17.50],
    [5.50, 9.83, 14.17, 18.50],
    [6.00, 11.67, 17.33, 23.00],
    [9.00, 15.23, 21.47, 27.70],
    [9.50, 18.17, 26.83, 35.50],
    [10.30, 20.70, 31.10, 41.50],
  ],
  // 10 bar
  [
    [0.80, 1.53, 2.27, 3.00],
    [1.30, 2.57, 3.83, 5.10],
    [1.60, 3.13, 4.67, 6.20],
    [1.90, 3.60, 5.30, 7.00],
    [2.90, 5.10, 7.30, 9.50],
    [3.10, 6.23, 9.37, 12.50],
    [5.10, 8.57, 12.03, 15.50],
    [5.30, 9.03, 12.77, 16.50],
    [5.80, 10.53, 15.27, 20.00],
    [8.50, 13.83, 19.17, 24.50],
    [9.30, 16.53, 23.77, 31.00],
    [10.10, 19.07, 28.03, 37.00],
  ],
  // 13 bar
  [
    [0.70, 1.33, 1.97, 2.60],
    [1.20, 2.27, 3.33, 4.40],
    [1.50, 2.80, 4.10, 5.40],
    [1.80, 3.23, 4.67, 6.10],
    [2.80, 4.70, 6.60, 8.50],
    [3.00, 5.43, 7.87, 10.30],
    [5.00, 7.83, 10.67, 13.50],
    [5.10, 8.23, 11.37, 14.50],
    [5.70, 9.63, 13.57, 17.50],
    [8.10, 12.57, 17.03, 21.50],
    [9.10, 14.90, 20.70, 26.50],
    [9.70, 17.30, 24.90, 32.50],
  ],
];

// ── Lookup helpers ───────────────────────────────────────────────────────────

/**
 * Find index of motor power in MOTOR_POWER_LIST.
 * @param {number} motorPower — in kW
 * @returns {number} index (0-based)
 */
export function indexOfMotorPowerValue(motorPower) {
  for (let i = 0; i < MOTOR_POWER_LIST.length; i++) {
    if (motorPower === MOTOR_POWER_LIST[i]) return i;
  }
  return 0;
}

/**
 * Find index of system pressure in SYSTEM_PRESSURE_LIST.
 * @param {number} pressure — in bar
 * @returns {number} index (0-based)
 */
export function indexOfSystemPressure(pressure) {
  for (let i = 0; i < SYSTEM_PRESSURE_LIST.length; i++) {
    if (pressure === SYSTEM_PRESSURE_LIST[i]) return i;
  }
  return 0;
}

/**
 * Calculate flow value based on current (amperage) and compressor settings.
 * Handles both VF (variable frequency) and fixed-speed compressors.
 *
 * @param {number} amValue — measured current in A
 * @param {object} comp — compressor config object with VF fields or Fixed fields
 * @returns {number} flow value (m³/min)
 */
export function calculateFlowBasedOnCurrent(amValue, comp) {
  if (comp.Type === 'VF' || comp.Type === 1) {
    if (amValue < comp.VFAmpMin * 0.75) return 0;
    if (amValue <= comp.VFAmpMin) return comp.VFAirDeliveryMin;
    if (amValue <= comp.VFAmpP2)
      return amValue * comp.VFLinearCoefficientP2Min + comp.VFLinearCoefficientP2MinA0;
    if (amValue <= comp.VFAmpP3)
      return amValue * comp.VFLinearCoefficientP3P2 + comp.VFLinearCoefficientP3P2A0;
    if (amValue <= comp.VFAmpMax)
      return amValue * comp.VFLinearCoefficientMaxP3 + comp.VFLinearCoefficientMaxP3A0;
    return comp.VFAirDeliveryMax;
  } else {
    // Fixed speed
    return amValue >= comp.FullLoadCurrentThreshold ? comp.FullLoadAirDelivery : 0;
  }
}

/**
 * Calculate flow value based on power and compressor settings.
 *
 * @param {number} powerValue — measured power in kW
 * @param {object} comp — compressor config object
 * @returns {number} flow value (m³/min)
 */
export function calculateFlowBasedOnPower(powerValue, comp) {
  if (comp.Type === 'VF' || comp.Type === 1) {
    if (powerValue < comp.VFPowerMin * 0.75) return 0;
    if (powerValue <= comp.VFPowerMin) return comp.VFAirDeliveryMin;
    if (powerValue <= comp.VFPowerP2)
      return powerValue * comp.VFLinearCoefficientP2Min + comp.VFLinearCoefficientP2MinA0;
    if (powerValue <= comp.VFPowerP3)
      return powerValue * comp.VFLinearCoefficientP3P2 + comp.VFLinearCoefficientP3P2A0;
    if (powerValue <= comp.VFPowerMax)
      return powerValue * comp.VFLinearCoefficientMaxP3 + comp.VFLinearCoefficientMaxP3A0;
    return comp.VFAirDeliveryMax;
  } else {
    return powerValue >= comp.FullLoadCurrentThreshold ? comp.FullLoadAirDelivery : 0;
  }
}
