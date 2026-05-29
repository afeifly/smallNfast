/**
 * CompressorEngine.js
 *
 * Port of com.cs.canalyzer.structs.Compressor.java
 * Compressor data model and VF parameter calculation.
 * The statistics computation itself lives in LeakEngine.js.
 */

import { MOTOR_POWER_LIST, SYSTEM_PRESSURE_LIST, POWER_LIST, AIR_DELIVERY_LIST, INDEX, COSPHI } from './VFConst.js';

// ── Compressor type constants ────────────────────────────────────────────────

export const COMPRESSOR_TYPE_LOAD_UNLOAD = 0;
export const COMPRESSOR_TYPE_VARIABLE_FREQUENCY = 1;

export const COMPRESS_TYPE_TEXT = ['Load/Unload', 'Variable Frequency'];

// ── Status constants ─────────────────────────────────────────────────────────

export const STATUS_NOT_READY = 0;
export const STATUS_OK = 1;

export const STATUS_STRING = { 0: 'Not Ready', 1: 'OK' };

// ── Default values ───────────────────────────────────────────────────────────

export const DEFAULTS = {
  AIR_DELIVERY: 0,
  COSP_PARAMETER: 0,
  FULL_LOAD_COSP: 0.86,
  UN_LOAD_COSP: 0.5,
  SUPPLY_VOLTAGE: 400,
  ENERGY_COST_PER_KWH: 0.1,
  CO2_EMMISION_PER_KWH: 0.55,
  CURRENCY: '\u20AC',
};

// ── Compressor data model ────────────────────────────────────────────────────

export class Compressor {
  constructor() {
    this.Type = COMPRESSOR_TYPE_LOAD_UNLOAD;
    this.Status = STATUS_OK;
    this.Selected = true;
    this.Description = 'Standard compressor';
    this.Unit = 'A';

    // ── Measured / calculated statistics (populated by analysis) ──
    this.FullLoadHours = 0;
    this.FullLoadPercentageMeasurementInterval = 0;
    this.FullLoadEnergyConsumption = 0;
    this.FullLoadEnergyCost = 0;

    this.UnLoadHours = 0;
    this.UnLoadPercentageMeasurementInterval = 0;
    this.UnLoadEnergyConsumption = 0;
    this.UnLoadEnergyCost = 0;

    this.NoLoadHours = 0;
    this.NoLoadPercentageMeasurementInterval = 0;
    this.NoLoadEnergyConsumption = 0;
    this.NoLoadEnergyCost = 0;

    this.NumOfLoadChanges = 0;
    this.NumOfLoad_UnloadChanges = 0;
    this.NumOfLoad_UnloadChangesOneYear = 0;

    this.TotalHours = 0;
    this.TotalEnergyConsumption = 0;
    this.TotalCost = 0;

    this.TotalAirDeliveryAmount = 0;
    this.MaxFlow = 0;
    this.MinFlow = 0;
    this.AverageFlow = 0;
    this.AirUnitCost = 0;

    this.TotalLeakage = 0;
    this.LeakageRate = 0;
    this.LeakageCost = 0;
    this.AverageLeakage = 0;

    // One-year projections
    this.FullLoadHoursOneYear = 0;
    this.NoLoadHoursOneYear = 0;
    this.UnLoadHoursOneYear = 0;
    this.NumOfLoadChangesOneYear = 0;
    this.FullLoadEnergyConsumptionOneYear = 0;
    this.UnLoadEnergyConsumptionOneYear = 0;
    this.NoLoadEnergyConsumptionOneYear = 0;
    this.TotalEnergyConsumptionOneYear = 0;
    this.TotalCostOneYear = 0;
    this.FullLoadEnergyCostOneYear = 0;
    this.UnLoadEnergyCostOneYear = 0;
    this.NoLoadEnergyCostOneYear = 0;
    this.LeakageCostOneYear = 0;
    this.TotalLeakageOneYear = 0;
    this.TotalAirDeliveryAmountOneYear = 0;

    this.CO2Emmision = 0;
    this.CO2EmmisionOneYear = 0;

    this.NumStarts = 0;
    this.NumStartsOneYear = 0;
    this.SpecificPower = 0;
    this.SpecificPowerUnit = 'kWh/m\u00B3';

    // ── Configuration ──
    this.CosP = 0.85;
    this.FullLoadCurrent = 0;
    this.UnLoadCurrent = 0;
    this.NoLoadCurrent = 0;
    this.FullLoadCosP = 0;
    this.UnLoadCosP = 0;
    this.NoLoadCosP = 0;
    this.FullLoadCurrentThreshold = 0;
    this.UnLoadCurrentThreshold = 0;
    this.NoLoadCurrentThreshold = 0;
    this.FullLoadAirDelivery = 0;
    this.UnLoadAirDelivery = 0;
    this.NoLoadAirDelivery = 0;
    this.AirDeliveryUnit = 'm\u00B3/h';
    this.MaxAirDelivery = 0;
    this.MinAirDelivery = 0;
    this.CosPRatio = 1;
    this.CosPA0 = 0;
    this.SupplyVoltage = DEFAULTS.SUPPLY_VOLTAGE;
    this.CO2EmmisionPerKWh = DEFAULTS.CO2_EMMISION_PER_KWH;

    // ── Variable Frequency (VF) parameters ──
    this.VFMotorPower = 22;
    this.VFSystemPressure = 7.5;
    this.VFPowerMin = 0;
    this.VFPowerP2 = 0;
    this.VFPowerP3 = 0;
    this.VFPowerMax = 0;
    this.VFAirDeliveryMin = 0;
    this.VFAirDeliveryP2 = 0;
    this.VFAirDeliveryP3 = 0;
    this.VFAirDeliveryMax = 0;
    this.VFAmpMin = 0;
    this.VFAmpP2 = 0;
    this.VFAmpP3 = 0;
    this.VFAmpMax = 0;
    this.VFLinearCoefficientP2Min = 0;
    this.VFLinearCoefficientP3P2 = 0;
    this.VFLinearCoefficientMaxP3 = 0;
    this.VFLinearCoefficientP2MinA0 = 0;
    this.VFLinearCoefficientP3P2A0 = 0;
    this.VFLinearCoefficientMaxP3A0 = 0;
    this.VFAirDeliveryUnit = 'm\u00B3/min';
    this.VFCosPhi = COSPHI;
    this.VFParameterSet = false;

    // Power channel
    this.hasPowerChannel = false;
    this.yearRatio = 0;

    // Initialize VF defaults
    this._initVFVariables();
  }

  /** Reset all statistics fields to zero */
  resetStatisticsValues() {
    this.FullLoadHours = 0;
    this.FullLoadPercentageMeasurementInterval = 0;
    this.FullLoadEnergyConsumption = 0;
    this.FullLoadEnergyCost = 0;

    this.UnLoadHours = 0;
    this.UnLoadPercentageMeasurementInterval = 0;
    this.UnLoadEnergyConsumption = 0;
    this.UnLoadEnergyCost = 0;

    this.NoLoadHours = 0;
    this.NoLoadPercentageMeasurementInterval = 0;
    this.NoLoadEnergyConsumption = 0;
    this.NoLoadEnergyCost = 0;

    this.NumOfLoadChanges = 0;
    this.NumOfLoad_UnloadChanges = 0;
    this.NumOfLoad_UnloadChangesOneYear = 0;

    this.TotalHours = 0;
    this.TotalEnergyConsumption = 0;
    this.TotalCost = 0;

    this.TotalAirDeliveryAmount = 0;
    this.MaxFlow = 0;
    this.MinFlow = 0;
    this.AverageFlow = 0;
    this.AirUnitCost = 0;

    this.TotalLeakage = 0;
    this.LeakageRate = 0;
    this.LeakageCost = 0;
    this.AverageLeakage = 0;

    this.FullLoadHoursOneYear = 0;
    this.NoLoadHoursOneYear = 0;
    this.UnLoadHoursOneYear = 0;
    this.NumOfLoadChangesOneYear = 0;
    this.FullLoadEnergyConsumptionOneYear = 0;
    this.UnLoadEnergyConsumptionOneYear = 0;
    this.NoLoadEnergyConsumptionOneYear = 0;
    this.TotalEnergyConsumptionOneYear = 0;
    this.TotalCostOneYear = 0;
    this.FullLoadEnergyCostOneYear = 0;
    this.UnLoadEnergyCostOneYear = 0;
    this.NoLoadEnergyCostOneYear = 0;
    this.LeakageCostOneYear = 0;
    this.TotalLeakageOneYear = 0;
    this.TotalAirDeliveryAmountOneYear = 0;

    this.CO2Emmision = 0;
    this.CO2EmmisionOneYear = 0;

    this.NumStarts = 0;
    this.NumStartsOneYear = 0;
    this.SpecificPower = 0;
  }

  /** Get status string for current type + status */
  getStatusString() {
    return STATUS_STRING[this.Status] || 'OK';
  }

  // ── VF compressor parameter initialization ─────────────────────────────

  _initVFVariables() {
    const motorIdx = 0;  // 22 kW
    const pressIdx = 0;  // 7.5 bar

    this.VFMotorPower = MOTOR_POWER_LIST[motorIdx];
    this.VFSystemPressure = SYSTEM_PRESSURE_LIST[pressIdx];
    this.VFPowerMin = POWER_LIST[pressIdx][motorIdx][INDEX.MIN];
    this.VFPowerP2 = POWER_LIST[pressIdx][motorIdx][INDEX.P2];
    this.VFPowerP3 = POWER_LIST[pressIdx][motorIdx][INDEX.P3];
    this.VFPowerMax = POWER_LIST[pressIdx][motorIdx][INDEX.MAX];
    this.VFAirDeliveryMin = AIR_DELIVERY_LIST[pressIdx][motorIdx][INDEX.MIN];
    this.VFAirDeliveryP2 = AIR_DELIVERY_LIST[pressIdx][motorIdx][INDEX.P2];
    this.VFAirDeliveryP3 = AIR_DELIVERY_LIST[pressIdx][motorIdx][INDEX.P3];
    this.VFAirDeliveryMax = AIR_DELIVERY_LIST[pressIdx][motorIdx][INDEX.MAX];

    this._calculateVFAmpAndLinearCoefficiency();
  }

  /** Calculate VF amp values from power: I = P / (√3 × U × cos φ) */
  _calculateVFAmpAndLinearCoefficiency() {
    const sqrt3 = Math.sqrt(3);
    const U = this.SupplyVoltage;
    const cosPhi = this.VFCosPhi;

    this.VFAmpMin = (this.VFPowerMin * 1000) / (sqrt3 * U * cosPhi);
    this.VFAmpP2 = (this.VFPowerP2 * 1000) / (sqrt3 * U * cosPhi);
    this.VFAmpP3 = (this.VFPowerP3 * 1000) / (sqrt3 * U * cosPhi);
    this.VFAmpMax = (this.VFPowerMax * 1000) / (sqrt3 * U * cosPhi);

    this._calculateLinearCoefficiency(this.VFAmpMin, this.VFAmpP2, this.VFAmpP3, this.VFAmpMax);
  }

  /** Calculate linear coefficiency for power-based flow calculation */
  calculateVFLinearCoefficiency() {
    this._calculateLinearCoefficiency(this.VFPowerMin, this.VFPowerP2, this.VFPowerP3, this.VFPowerMax);
  }

  _calculateLinearCoefficiency(xMin, xP2, xP3, xMax) {
    this.VFLinearCoefficientP2Min = (this.VFAirDeliveryP2 - this.VFAirDeliveryMin) / (xP2 - xMin);
    this.VFLinearCoefficientP3P2 = (this.VFAirDeliveryP3 - this.VFAirDeliveryP2) / (xP3 - xP2);
    this.VFLinearCoefficientMaxP3 = (this.VFAirDeliveryMax - this.VFAirDeliveryP3) / (xMax - xP3);
    this.VFLinearCoefficientP2MinA0 = this.VFAirDeliveryP2 - xP2 * this.VFLinearCoefficientP2Min;
    this.VFLinearCoefficientP3P2A0 = this.VFAirDeliveryP3 - xP3 * this.VFLinearCoefficientP3P2;
    this.VFLinearCoefficientMaxP3A0 = this.VFAirDeliveryMax - xMax * this.VFLinearCoefficientMaxP3;
  }

  /** Set motor power and recompute VF params */
  setMotorPower(motorPower) {
    const idx = MOTOR_POWER_LIST.indexOf(motorPower);
    if (idx < 0) return false;

    const pressIdx = SYSTEM_PRESSURE_LIST.indexOf(this.VFSystemPressure);
    const pi = Math.max(0, pressIdx);

    this.VFMotorPower = motorPower;
    this.VFPowerMin = POWER_LIST[pi][idx][INDEX.MIN];
    this.VFPowerP2 = POWER_LIST[pi][idx][INDEX.P2];
    this.VFPowerP3 = POWER_LIST[pi][idx][INDEX.P3];
    this.VFPowerMax = POWER_LIST[pi][idx][INDEX.MAX];
    this.VFAirDeliveryMin = AIR_DELIVERY_LIST[pi][idx][INDEX.MIN];
    this.VFAirDeliveryP2 = AIR_DELIVERY_LIST[pi][idx][INDEX.P2];
    this.VFAirDeliveryP3 = AIR_DELIVERY_LIST[pi][idx][INDEX.P3];
    this.VFAirDeliveryMax = AIR_DELIVERY_LIST[pi][idx][INDEX.MAX];

    this._calculateVFAmpAndLinearCoefficiency();
    return true;
  }

  /** Set system pressure and recompute VF params */
  setSystemPressure(pressure) {
    const idx = SYSTEM_PRESSURE_LIST.indexOf(pressure);
    if (idx < 0) return false;

    const motorIdx = MOTOR_POWER_LIST.indexOf(this.VFMotorPower);
    const mi = Math.max(0, motorIdx);

    this.VFSystemPressure = pressure;
    this.VFPowerMin = POWER_LIST[idx][mi][INDEX.MIN];
    this.VFPowerP2 = POWER_LIST[idx][mi][INDEX.P2];
    this.VFPowerP3 = POWER_LIST[idx][mi][INDEX.P3];
    this.VFPowerMax = POWER_LIST[idx][mi][INDEX.MAX];
    this.VFAirDeliveryMin = AIR_DELIVERY_LIST[idx][mi][INDEX.MIN];
    this.VFAirDeliveryP2 = AIR_DELIVERY_LIST[idx][mi][INDEX.P2];
    this.VFAirDeliveryP3 = AIR_DELIVERY_LIST[idx][mi][INDEX.P3];
    this.VFAirDeliveryMax = AIR_DELIVERY_LIST[idx][mi][INDEX.MAX];

    this._calculateVFAmpAndLinearCoefficiency();
    return true;
  }

  /** Clone this compressor */
  clone() {
    const c = new Compressor();
    Object.assign(c, JSON.parse(JSON.stringify(this)));
    c.resetStatisticsValues();
    Object.assign(c, JSON.parse(JSON.stringify(this)));
    return c;
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────

/**
 * Create a default compressor configuration suitable for testing.
 */
export function createDefaultCompressor(type = COMPRESSOR_TYPE_LOAD_UNLOAD) {
  const comp = new Compressor();
  comp.Type = type;
  comp.Description = type === COMPRESSOR_TYPE_VARIABLE_FREQUENCY
    ? 'Variable Frequency compressor'
    : 'Load/Unload compressor';
  return comp;
}
