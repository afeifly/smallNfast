/**
 * MeasurementUnit.js
 *
 * Port of com.cs.canalyzer.structs.MeasurementUnit.java
 * Unit conversion for flow rate, pressure, dewpoint, energy, power.
 * Pure computation — no dependencies.
 */

const CUBIC = '\u00B3';   // superscript 3 (Java char 179)
const DEGREE = '\u00B0';  // degree symbol (Java char 176)

export const CURRENT_UNIT = 'A';

export const FLOW_RATE_UNITS = [
  `m${CUBIC}/h`,
  `m${CUBIC}/min`,
  'l/min',
  'l/s',
  'cfm',
];

export const FLOW_RATE_UNIT_RESOLUTIONS = [1, 2, 1, 1, 1];

export const FLOW_UNIT_RATIO_TO_M3_PER_HOUR = [
  1,           // m3/h
  60,          // m3/min
  60 / 1000,   // l/min
  3600 / 1000, // l/s
  60 * 0.0283, // cfm
];

export const FLOW_UNIT_RATIO_TO_1_HOUR = [
  1,    // m3/h
  60,   // m3/min
  60,   // l/min
  3600, // l/s
  60,   // cfm
];

export const CONSUMPTION_UNITS = [
  `m${CUBIC}`,
  `m${CUBIC}`,
  'l',
  'l',
  'cf',
];

export const CONSUMPTION_UNITS_RATIO_TO_M3 = [
  1,
  1,
  1 / 1000,
  1 / 1000,
  1 / 0.0283,
];

export const DEWPOINT_UNITS = [
  `${DEGREE}Ctd`,
  `${DEGREE}Ftd`,
  `g/m${CUBIC}`,
  `mg/m${CUBIC}`,
  'g/Kg',
  'ppm[v]',
  `${DEGREE}Ctd atm`,
  `${DEGREE}Ftd atm`,
];

export const PRESSURE_UNITS = ['bar'];

export const UNIT_STRING = [
  '',                          // 0  custom
  `${DEGREE}C`,                // 1
  `${DEGREE}F`,                // 2
  '%',                         // 3
  `${DEGREE}Ctd`,              // 4
  `${DEGREE}Ftd`,              // 5
  'mg/Kg',                     // 6
  `mg/m${CUBIC}`,              // 7
  'g/Kg',                      // 8
  `g/m${CUBIC}`,               // 9
  'm/s',                       // 10
  'ft/min',                    // 11
  'm/s',                       // 12
  'ft/min',                    // 13
  `m${CUBIC}/h`,               // 14
  `m${CUBIC}/min`,             // 15
  'l/min',                     // 16
  'l/s',                       // 17
  'cfm',                       // 18
  `m${CUBIC}/h`,               // 19
  `m${CUBIC}/min`,             // 20
  'l/min',                     // 21
  'l/s',                       // 22
  'cfm',                       // 23
  `m${CUBIC}`,                 // 24
  'l',                         // 25
  'cf',                        // 26
  `m${CUBIC}`,                 // 27
  'l',                         // 28
  'cf',                        // 29
  'ppm[v]',                    // 30
  `${DEGREE}Ctd atm`,          // 31
  `${DEGREE}Ftd atm`,          // 32
  'Pa',                        // 33
  'hPa',                       // 34
  'KPa',                       // 35
  'MPa',                       // 36
  'mbar',                      // 37
  'bar',                       // 38
  ' ',                         // 39
  'mV',                        // 40
  'V',                         // 41
  'uV',                        // 42
  'KV',                        // 43
  'mA',                        // 44
  'A',                         // 45
  'kg/s',                      // 46
  'kg',                        // 47
  `m${CUBIC}/h av`,            // 48
  'l/h av',                    // 49
  'kg/h av',                   // 50
  'cf/h av',                   // 51
  'kg/h',                      // 52
  'kg/min',                    // 53
];

export const UNIT_RESOLUTION = [
  1, // 0
  1, 1, 1, 1, 1, 0, 0, 1, 1,  // 1-9
  1, 0, 1, 0, 0, 1, 1, 1, 0,  // 10-18
  1, 1, 1, 1, 0, 0, 0, 0, 0,  // 19-27
  0, 0, 1, 1, 1, 1, 1, 1, 2, 1, // 28-38
  1, 1, 1, 1, 1, 1, 3, 0,     // 39-46
  1, 1, 1, 1, 1, 2,           // 47-53
];

export const ENERGY_UNITS = ['kWh', 'kvarh'];
export const POWER_UNITS = ['kW'];

// ── Lookup helpers ───────────────────────────────────────────────────────────

function indexOf(arr, val) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === val) return i;
  }
  return -1;
}

/** Check if unit is current (A) */
export function isCurrentUnit(unit) {
  return unit === CURRENT_UNIT;
}

/** Check if unit is a flow rate */
export function isFlowRateUnit(unit) {
  return FLOW_RATE_UNITS.includes(unit);
}

/** Conversion ratio from given flow unit to m³/h */
export function ratioToM3PerHour(unit) {
  const i = indexOf(FLOW_RATE_UNITS, unit);
  return i >= 0 ? FLOW_UNIT_RATIO_TO_M3_PER_HOUR[i] : 1;
}

/** Conversion ratio from given FLOW unit to m³ (consumption) */
export function ratioToM3BasedOnFlowUnit(flowUnit) {
  const i = indexOf(FLOW_RATE_UNITS, flowUnit);
  return i >= 0 ? CONSUMPTION_UNITS_RATIO_TO_M3[i] : 1;
}

/** Conversion ratio from given consumption unit to m³ */
export function ratioToM3BasedOnConsumptionUnit(unit) {
  const i = indexOf(CONSUMPTION_UNITS, unit);
  return i >= 0 ? CONSUMPTION_UNITS_RATIO_TO_M3[i] : 1;
}

/** How many of this flow unit fit in 1 hour (e.g. l/min → 60) */
export function flowUnitRatioToOneHour(unit) {
  const i = indexOf(FLOW_RATE_UNITS, unit);
  return i >= 0 ? FLOW_UNIT_RATIO_TO_1_HOUR[i] : 1;
}

/** Resolution (decimal places) for a flow unit */
export function flowUnitResolution(unit) {
  const i = indexOf(FLOW_RATE_UNITS, unit);
  return i >= 0 ? FLOW_RATE_UNIT_RESOLUTIONS[i] : 0;
}

/** Get the corresponding consumption unit for a given flow unit */
export function getConsumptionUnit(flowUnit) {
  const i = indexOf(FLOW_RATE_UNITS, flowUnit);
  return i >= 0 ? CONSUMPTION_UNITS[i] : '';
}

/** Check if unit is a dewpoint unit */
export function isDewpointUnit(unit) {
  return DEWPOINT_UNITS.includes(unit);
}

/** Check if unit is a pressure unit */
export function isPressureUnit(unit) {
  return PRESSURE_UNITS.includes(unit);
}

/** Get index into UNIT_STRING array, returns 0 if not found */
export function getUnitIndex(unit) {
  return indexOf(UNIT_STRING, unit);
}

/** Get resolution (decimal places) for any unit */
export function getUnitResolution(unit) {
  const i = getUnitIndex(unit);
  return i >= 0 && i < UNIT_RESOLUTION.length ? UNIT_RESOLUTION[i] : 1;
}

/** Check if unit is an energy unit */
export function isEnergyUnit(unit) {
  if (!unit || !unit.trim()) return false;
  return ENERGY_UNITS.includes(unit);
}

/** Check if unit is a power unit */
export function isPowerUnit(unit) {
  if (!unit || !unit.trim()) return false;
  return POWER_UNITS.includes(unit);
}
