import { describe, it, expect } from 'vitest';
import { analyzeSystemFlowChannel } from './LeakEngine.js';

describe('LeakEngine System Analyze', () => {
  it('computes system flow statistics from a designated system flow channel', () => {
    const data = [];
    for (let i = 0; i < 10; i++) data.push({ timestampMs: i * 1000, value: 100 });
    const res = analyzeSystemFlowChannel(data, 1, {
      leakThreshold: 10,
      flowUnit: 'm\u00B3/h',
      airUnitCost: 0.05,
      workHourPerYear: 8760,
    });

    expect(res.averageFlow).toBe(100);
    expect(res.maxFlow).toBe(100);
    expect(res.minFlow).toBe(100);

    // total air delivery (m³) = Σ flow × (srateHour) × ratio-to-m³/h
    // sumFlow = 1000, srateHour = 1/3600, ratio(m³/h) = 1 → 1000/3600 ≈ 0.278
    expect(res.totalAirDelivery).toBeCloseTo(1000 / 3600, 8);
    expect(res.totalCost).toBeCloseTo((1000 / 3600) * 0.05, 8);
    expect(res.totalLeakage).toBeGreaterThan(0);
    expect(res.validHours).toBeCloseTo(10 / 3600, 8);
    expect(res.totalAirDeliveryOneYear).toBeGreaterThan(0);
  });

  it('uses minimum flow as the leak baseline when no threshold is given', () => {
    const data = [
      { timestampMs: 0, value: 50 },
      { timestampMs: 1000, value: 200 },
      { timestampMs: 2000, value: 150 },
    ];
    const res = analyzeSystemFlowChannel(data, 1, { flowUnit: 'm\u00B3/h', workHourPerYear: 8760 });
    expect(res.minFlow).toBe(50);
    expect(res.totalLeakage).toBeCloseTo(50 * (3 / 3600), 8);
  });
});