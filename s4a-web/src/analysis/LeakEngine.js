/**
 * LeakEngine.js
 *
 * Port of com.cs.canalyzer.structs.LeakStatistics.java
 * Compressed air system analysis engine.
 *
 * Pure computation — takes arrays of time-series data + compressor configs,
 * returns structured analysis results. Data fetching is the caller's responsibility.
 */

import { Compressor, COMPRESSOR_TYPE_VARIABLE_FREQUENCY, COMPRESSOR_TYPE_LOAD_UNLOAD, DEFAULTS } from './CompressorEngine.js';
import { ratioToM3PerHour, ratioToM3BasedOnFlowUnit, flowUnitRatioToOneHour, getConsumptionUnit, isFlowRateUnit } from './MeasurementUnit.js';

// ── Analyze type constants ───────────────────────────────────────────────────

export const ANALYZE_TYPE_COMPRESSOR = 0;
export const ANALYZE_TYPE_FLOW = 1;
export const ANALYZE_TYPE_SYSTEM = 2;

// ── Working hours defaults ───────────────────────────────────────────────────

export const WORKING_HOUR_PER_YEAR = 8760;  // 365 × 24

const SQRT3 = Math.sqrt(3);

// ── Per-compressor analysis result ───────────────────────────────────────────

/**
 * Analyze a single compressor's current/power time-series data.
 *
 * @param {Compressor} compressor — compressor config (type, thresholds, VF params)
 * @param {Array<{timestampMs: number, value: number}>} channelData — raw current/power readings, sorted by time
 * @param {number} sampleIntervalSec — time between records in seconds
 * @param {object} options
 * @param {number} [options.energyCostPerKwh=0.1] — cost per kWh for cost calculation
 * @param {number} [options.voltage=400] — supply voltage in V
 * @returns {Compressor} — same compressor instance with statistics populated
 */
export function analyzeCompressorChannel(
  compressor,
  channelData,
  sampleIntervalSec,
  options = {}
) {
  const energyCostPerKwh = options.energyCostPerKwh ?? DEFAULTS.ENERGY_COST_PER_KWH;
  const voltage = options.voltage ?? DEFAULTS.SUPPLY_VOLTAGE;

  compressor.resetStatisticsValues();

  if (!channelData || channelData.length < 2) return compressor;

  const srateHour = sampleIntervalSec / 3600;

  // Voltage × √3 × hour / 1000 — constant factor for energy per record (kWh)
  const voltSqrt3HourDiv1000 = voltage * SQRT3 * srateHour / 1000;

  let fullLoadSeconds = 0;
  let unLoadSeconds = 0;
  let noLoadSeconds = 0;
  let validSeconds = 0;

  let sumFlowRate = 0;
  let numFlowRecords = 0;
  let maxFlowVal = -Infinity;
  let minFlowVal = Infinity;

  let fullLoadEnergyKwh = 0;
  let unLoadEnergyKwh = 0;
  let noLoadEnergyKwh = 0;

  let numLoadChanges = 0;
  let numLoadUnloadCycles = 0;
  let previousIsFullLoad = false;
  let previousIsUnLoad = false;
  let numStarts = 0;

  // Compute CosP ratio if full-load and unload cosP are specified
  let calCosP = false;
  let theCosP = 0.85;
  if (
    compressor.FullLoadCurrent > 0 &&
    compressor.UnLoadCurrent > 0 &&
    compressor.FullLoadCosP > 0 &&
    compressor.UnLoadCosP > 0 &&
    compressor.FullLoadCurrent > compressor.UnLoadCurrent &&
    compressor.FullLoadCosP < 1 &&
    compressor.UnLoadCosP < 1
  ) {
    calCosP = true;
    const ratio = (compressor.FullLoadCosP - compressor.UnLoadCosP) /
                  (compressor.FullLoadCurrent - compressor.UnLoadCurrent);
    const a0 = compressor.FullLoadCosP - compressor.FullLoadCurrent * ratio;
    compressor.CosPRatio = ratio;
    compressor.CosPA0 = a0;
  }

  let fullLoadThreshold, noLoadThreshold;

  if (compressor.Type === COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {
    fullLoadThreshold = compressor.VFAmpMin * 0.75;
    noLoadThreshold = compressor.VFAmpMin * 0.2;
    theCosP = compressor.VFCosPhi;
    calCosP = false;
  } else {
    fullLoadThreshold = compressor.FullLoadCurrentThreshold;
    noLoadThreshold = compressor.NoLoadCurrentThreshold;
  }

  for (let i = 0; i < channelData.length; i++) {
    const record = channelData[i];
    let value = record.value;

    // Skip invalid values
    if (value == null || !isFinite(value)) continue;
    // Clamp negative values (compensate sensor artifacts)
    if (value < 0) value = 0;

    // Calculate CosP for this record
    if (calCosP) {
      theCosP = value * compressor.CosPRatio + compressor.CosPA0;
    }

    // Classify load state
    let state; // 'full' | 'unload' | 'noload'

    if (compressor.Type === COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {
      if (value < noLoadThreshold) {
        state = 'noload';
      } else if (value < fullLoadThreshold) {
        state = 'unload';
      } else {
        state = 'full';
      }
    } else {
      if (value >= fullLoadThreshold) {
        state = 'full';
      } else if (value >= noLoadThreshold) {
        state = 'unload';
      } else {
        state = 'noload';
      }
    }

    // Energy: P = √3 × V × I × cosφ × hours / 1000
    let energyKwh;
    if (compressor.Type === COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {
      // For VF compressors, energy is based on power table
      energyKwh = value * voltSqrt3HourDiv1000;
    } else {
      // For fixed-speed: use full-load/unload power when in those states
      if (state === 'full') {
        energyKwh = value * voltSqrt3HourDiv1000;
      } else if (state === 'unload') {
        energyKwh = value * voltSqrt3HourDiv1000; // or use UnLoadCurrent-based power
      } else {
        energyKwh = 0;
      }
    }

    // Accumulate
    switch (state) {
      case 'full':
        fullLoadSeconds += sampleIntervalSec;
        fullLoadEnergyKwh += energyKwh;
        break;
      case 'unload':
        unLoadSeconds += sampleIntervalSec;
        unLoadEnergyKwh += energyKwh;
        break;
      case 'noload':
        noLoadSeconds += sampleIntervalSec;
        noLoadEnergyKwh += energyKwh;
        break;
    }
    validSeconds += sampleIntervalSec;

    // Flow calculation
    let flowRate = 0;
    if (compressor.Type === COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {
      if (value >= fullLoadThreshold) {
        flowRate = compressor.VFAirDeliveryMax;
      } else if (value >= noLoadThreshold) {
        // Linear interpolation between min and max delivery
        const ratio = (value - noLoadThreshold) / (fullLoadThreshold - noLoadThreshold);
        flowRate = compressor.VFAirDeliveryMin + ratio * (compressor.VFAirDeliveryMax - compressor.VFAirDeliveryMin);
      }
    } else {
      if (state === 'full') {
        flowRate = compressor.FullLoadAirDelivery;
      }
    }

    if (flowRate > 0) {
      sumFlowRate += flowRate;
      numFlowRecords++;
      if (flowRate > maxFlowVal) maxFlowVal = flowRate;
      if (flowRate < minFlowVal) minFlowVal = flowRate;
    }

    // Count load/unload transitions
    const isFullLoad = state === 'full';
    const isUnLoad = state === 'unload';

    if (i > 0) {
      if (isFullLoad && !previousIsFullLoad) {
        numLoadChanges++;
      }
      if (isFullLoad !== previousIsFullLoad && isUnLoad !== previousIsUnLoad) {
        numLoadUnloadCycles++;
      }
      // Count starts: transition from not-full to full
      if (isFullLoad && !previousIsFullLoad) {
        numStarts++;
      }
    }

    previousIsFullLoad = isFullLoad;
    previousIsUnLoad = isUnLoad;
  }

  // ── Populate compressor statistics ──
  const totalSeconds = fullLoadSeconds + unLoadSeconds + noLoadSeconds;
  const totalHours = totalSeconds / 3600;

  compressor.FullLoadHours = fullLoadSeconds / 3600;
  compressor.UnLoadHours = unLoadSeconds / 3600;
  compressor.NoLoadHours = noLoadSeconds / 3600;
  compressor.TotalHours = totalHours;

  compressor.FullLoadPercentageMeasurementInterval = validSeconds > 0 ? fullLoadSeconds / validSeconds : 0;
  compressor.UnLoadPercentageMeasurementInterval = validSeconds > 0 ? unLoadSeconds / validSeconds : 0;
  compressor.NoLoadPercentageMeasurementInterval = validSeconds > 0 ? noLoadSeconds / validSeconds : 0;

  compressor.FullLoadEnergyConsumption = fullLoadEnergyKwh;
  compressor.UnLoadEnergyConsumption = unLoadEnergyKwh;
  compressor.NoLoadEnergyConsumption = noLoadEnergyKwh;
  compressor.TotalEnergyConsumption = fullLoadEnergyKwh + unLoadEnergyKwh + noLoadEnergyKwh;

  compressor.FullLoadEnergyCost = fullLoadEnergyKwh * energyCostPerKwh;
  compressor.UnLoadEnergyCost = unLoadEnergyKwh * energyCostPerKwh;
  compressor.NoLoadEnergyCost = noLoadEnergyKwh * energyCostPerKwh;
  compressor.TotalCost = compressor.TotalEnergyConsumption * energyCostPerKwh;

  compressor.NumOfLoadChanges = numLoadChanges;
  compressor.NumOfLoad_UnloadChanges = numLoadUnloadCycles;
  compressor.NumStarts = numStarts;

  compressor.CO2Emmision = compressor.TotalEnergyConsumption * compressor.CO2EmmisionPerKWh;

  // Flow statistics
  if (numFlowRecords > 0) {
    compressor.AverageFlow = sumFlowRate / numFlowRecords;
    compressor.MaxFlow = maxFlowVal === -Infinity ? 0 : maxFlowVal;
    compressor.MinFlow = minFlowVal === Infinity ? 0 : minFlowVal;
    compressor.TotalAirDeliveryAmount = Math.round(sumFlowRate * srateHour); // m³
  }

  // 1-year projection
  const yearRatio = validSeconds > 0 ? (WORKING_HOUR_PER_YEAR * 3600) / validSeconds : 0;
  compressor.FullLoadHoursOneYear = compressor.FullLoadHours * yearRatio;
  compressor.UnLoadHoursOneYear = compressor.UnLoadHours * yearRatio;
  compressor.NoLoadHoursOneYear = compressor.NoLoadHours * yearRatio;
  compressor.FullLoadEnergyConsumptionOneYear = compressor.FullLoadEnergyConsumption * yearRatio;
  compressor.UnLoadEnergyConsumptionOneYear = compressor.UnLoadEnergyConsumption * yearRatio;
  compressor.NoLoadEnergyConsumptionOneYear = compressor.NoLoadEnergyConsumption * yearRatio;
  compressor.TotalEnergyConsumptionOneYear = compressor.TotalEnergyConsumption * yearRatio;
  compressor.TotalCostOneYear = compressor.TotalCost * yearRatio;
  compressor.FullLoadEnergyCostOneYear = compressor.FullLoadEnergyCost * yearRatio;
  compressor.UnLoadEnergyCostOneYear = compressor.UnLoadEnergyCost * yearRatio;
  compressor.NoLoadEnergyCostOneYear = compressor.NoLoadEnergyCost * yearRatio;
  compressor.NumOfLoadChangesOneYear = numLoadChanges * yearRatio;
  compressor.NumOfLoad_UnloadChangesOneYear = numLoadUnloadCycles * yearRatio;
  compressor.NumStartsOneYear = numStarts * yearRatio;
  compressor.CO2EmmisionOneYear = compressor.CO2Emmision * yearRatio;
  compressor.TotalAirDeliveryAmountOneYear = Math.round(compressor.TotalAirDeliveryAmount * yearRatio);

  compressor.SpecificPower = compressor.TotalAirDeliveryAmount > 0
    ? compressor.TotalEnergyConsumption / (compressor.TotalAirDeliveryAmount * ratioToM3BasedOnFlowUnit(compressor.AirDeliveryUnit))
    : 0;

  return compressor;
}

// ── System analysis ──────────────────────────────────────────────────────────

/**
 * Run system analysis: analyze all compressors + compute system-level totals.
 *
 * @param {Compressor[]} compressors — array of compressor configs
 * @param {Map<number, Array<{timestampMs, value}>>} channelDataMap — channelId → time-series data
 * @param {number} sampleIntervalSec — sample interval in seconds
 * @param {object} options
 * @param {number} [options.energyCostPerKwh=0.1]
 * @param {number} [options.voltage=400]
 * @param {number} [options.leakThreshold=0] — baseline flow for leak calculation (same unit as flow)
 * @param {string} [options.flowUnit='m\u00B3/h'] — display unit for flow
 * @returns {object} — { compressors: Compressor[], system: SystemResult }
 */
export function analyzeSystem(compressors, channelDataMap, sampleIntervalSec, options = {}) {
  const energyCostPerKwh = options.energyCostPerKwh ?? DEFAULTS.ENERGY_COST_PER_KWH;
  const voltage = options.voltage ?? DEFAULTS.SUPPLY_VOLTAGE;
  const leakThreshold = options.leakThreshold ?? 0;
  const flowUnit = options.flowUnit ?? 'm\u00B3/h';

  // Analyze each compressor
  const analyzed = [];
  for (const comp of compressors) {
    if (!comp.Selected) continue;
    const data = channelDataMap.get(comp.Unit) || [];
    const c = analyzeCompressorChannel(comp, data, sampleIntervalSec, { energyCostPerKwh, voltage });
    analyzed.push(c);
  }

  // System-level totals
  const system = computeSystemTotals(analyzed, leakThreshold, flowUnit, sampleIntervalSec);

  return { compressors: analyzed, system };
}

/**
 * Compute system-level totals from per-compressor results.
 */
function computeSystemTotals(compressors, leakThreshold, flowUnit, sampleIntervalSec) {
  let totalEnergyKwh = 0;
  let totalCost = 0;
  let totalAirDelivery = 0;
  let totalFullLoadHours = 0;
  let totalCO2 = 0;
  let sumAverageFlow = 0;
  let numWithFlow = 0;
  let maxSystemFlow = 0;
  let minSystemFlow = Infinity;
  let totalLeakage = 0;

  for (const comp of compressors) {
    totalEnergyKwh += comp.TotalEnergyConsumption;
    totalCost += comp.TotalCost;
    totalAirDelivery += comp.TotalAirDeliveryAmount;
    totalFullLoadHours += comp.FullLoadHours;
    totalCO2 += comp.CO2Emmision;

    if (comp.AverageFlow > 0) {
      sumAverageFlow += comp.AverageFlow;
      numWithFlow++;
    }
    if (comp.MaxFlow > maxSystemFlow) maxSystemFlow = comp.MaxFlow;
    if (comp.MinFlow < minSystemFlow) minSystemFlow = comp.MinFlow;
  }

  const avgFlow = numWithFlow > 0 ? sumAverageFlow / numWithFlow : 0;

  // Leakage estimate: total leak = leakThreshold × total sample hours
  // (This is a simplified estimation — the Java code computes it per-record)
  const totalSampleHours = compressors.reduce((sum, c) => sum + c.TotalHours, 0) / Math.max(1, compressors.length);
  if (leakThreshold > 0) {
    totalLeakage = leakThreshold * totalSampleHours * flowUnitRatioToOneHour(flowUnit);
  }

  const totalEnergyOneYear = compressors.reduce((sum, c) => sum + c.TotalEnergyConsumptionOneYear, 0);
  const totalCostOneYear = compressors.reduce((sum, c) => sum + c.TotalCostOneYear, 0);

  return {
    totalEnergyConsumption: totalEnergyKwh,
    totalEnergyConsumptionOneYear: totalEnergyOneYear,
    totalCost,
    totalCostOneYear,
    totalAirDelivery: totalAirDelivery > 0 ? totalAirDelivery : 0,
    totalAirDeliveryOneYear: compressors.reduce((sum, c) => sum + c.TotalAirDeliveryAmountOneYear, 0),
    totalFullLoadHours,
    totalCO2Emmision: totalCO2,
    totalCO2EmmisionOneYear: compressors.reduce((sum, c) => sum + c.CO2EmmisionOneYear, 0),
    averageFlow: avgFlow,
    maxFlow: maxSystemFlow === -Infinity ? 0 : maxSystemFlow,
    minFlow: minSystemFlow === Infinity ? 0 : minSystemFlow,
    flowUnit,
    totalLeakage,
    leakageRate: totalAirDelivery > 0 ? totalLeakage / totalAirDelivery : 0,
    leakageCost: totalLeakage > 0 ? (totalLeakage / Math.max(1, totalAirDelivery)) * totalCost : 0,
    numCompressors: compressors.length,
    numCompressorsSelected: compressors.filter(c => c.Selected).length,
  };
}

// ── Channel classification helpers ───────────────────────────────────────────

/**
 * Classify a channel by its unit string to determine what kind of data it carries.
 */
export function classifyChannel(unitText) {
  if (!unitText) return 'unknown';
  const u = unitText.trim();

  if (u === 'A') return 'current';
  if (isFlowRateUnit(u)) return 'flow';
  if (u === 'bar' || u === 'Pa' || u === 'hPa' || u === 'KPa' || u === 'MPa' || u === 'mbar') return 'pressure';
  if (u.includes('Ctd') || u.includes('Ftd') || u.includes('ppm') || u.includes('g/m')) return 'dewpoint';
  if (u === 'kW') return 'power';
  if (u === 'kWh' || u === 'kvarh') return 'energy';
  if (u === 'V' || u === 'mV' || u === 'uV' || u === 'KV') return 'voltage';

  return 'other';
}

/**
 * Extract time-series data for a specific channel from an API data structure.
 *
 * @param {Array<{timestampMs, values}>} rows — array of data rows from TestAPI
 * @param {number|string} channelId — channel ID to extract
 * @returns {Array<{timestampMs, value}>}
 */
export function extractChannelData(rows, channelId) {
  if (!rows || !rows.length) return [];
  const result = [];
  for (const row of rows) {
    const val = row.values ? row.values[channelId] : null;
    if (val != null && isFinite(val)) {
      result.push({ timestampMs: row.timestampMs, value: val });
    }
  }
  return result;
}
