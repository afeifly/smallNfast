import { describe, it, expect } from 'vitest';
import {
  getDefaultUnitResolution,
  resolveChannelResolution,
  formatChannelValue,
} from './resolution';

describe('resolution utility', () => {
  it('assigns correct default resolutions based on unit', () => {
    // Flow: 1 decimal for m³/h, l/min, cfm
    expect(getDefaultUnitResolution('m³/h', 14)).toBe(1);
    expect(getDefaultUnitResolution('l/min', 16)).toBe(1);
    expect(getDefaultUnitResolution('cfm', 18)).toBe(1);

    // Flow per second/minute: 2 decimals
    expect(getDefaultUnitResolution('m³/min', 15)).toBe(2);
    expect(getDefaultUnitResolution('l/s', 17)).toBe(2);

    // Temperature: 1 decimal
    expect(getDefaultUnitResolution('°C', 1)).toBe(1);
    expect(getDefaultUnitResolution('°Ctd', 4)).toBe(1);

    // Pressure: 2 decimals for bar
    expect(getDefaultUnitResolution('bar', 38)).toBe(2);
    expect(getDefaultUnitResolution('mbar', 37)).toBe(2);
    // Pressure: 1 decimal for psi
    expect(getDefaultUnitResolution('psi', 39)).toBe(1);
    // Pressure: 3 decimals for MPa
    expect(getDefaultUnitResolution('MPa', 36)).toBe(3);

    // Velocity: 2 decimals for m/s
    expect(getDefaultUnitResolution('m/s', 10)).toBe(2);
    // Velocity: 0 decimals for ft/min
    expect(getDefaultUnitResolution('ft/min', 11)).toBe(0);

    // Consumption: 0 decimals
    expect(getDefaultUnitResolution('m³', 24)).toBe(0);
    expect(getDefaultUnitResolution('l', 25)).toBe(0);
    expect(getDefaultUnitResolution('cf', 26)).toBe(0);
  });

  it('respects existing positive resolution on channel', () => {
    const ch = { channel_name: 'Flow', unit: 'm³/h', unit_index: 14, resolution: 3 };
    expect(resolveChannelResolution(ch)).toBe(3);
  });

  it('correctly resolves fallback resolution if channel resolution is 0 for float channels', () => {
    // Flow channel with 0 reported by device should resolve to 1
    const flowCh = { channel_name: 'Flow', unit: 'm³/h', unit_index: 14, resolution: 0 };
    expect(resolveChannelResolution(flowCh)).toBe(1);

    // Pressure channel with 0 reported by device should resolve to 2
    const pressCh = { channel_name: 'Pressure', unit: 'bar', unit_index: 38, resolution: 0 };
    expect(resolveChannelResolution(pressCh)).toBe(2);

    // Temp channel with 0 reported by device should resolve to 1
    const tempCh = { channel_name: 'Temperature', unit: '°C', unit_index: 1, resolution: 0 };
    expect(resolveChannelResolution(tempCh)).toBe(1);

    // Consumption channel with 0 should STAY 0
    const consCh = { channel_name: 'Consumption', unit: 'm³', unit_index: 24, resolution: 0 };
    expect(resolveChannelResolution(consCh)).toBe(0);
  });

  it('formats numeric values according to channel resolution', () => {
    expect(formatChannelValue(142.345, 1)).toBe('142.3');
    expect(formatChannelValue(6.852, 2)).toBe('6.85');
    expect(formatChannelValue(12345.67, 0)).toBe('12346');
    expect(formatChannelValue(null, 2)).toBe('---');
    expect(formatChannelValue(undefined, 2)).toBe('---');
  });
});
