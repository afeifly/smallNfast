import { describe, it, expect } from 'vitest';
import ChartController, { nextRecordingWindow, niceRange, laneAnchors, MAX_Y_AXIS_COUNT } from './ChartController';

const MIN = 60000;
const R = 30 * MIN;

describe('nextRecordingWindow', () => {
  it('does not shift while the newest sample is inside the window', () => {
    const w = nextRecordingWindow(10 * MIN, 0, R, R);
    expect(w).toEqual({ start: 0, end: R, shifted: false });
  });

  it('keeps the sample just before the edge un-shifted', () => {
    const w = nextRecordingWindow(R - 1, 0, R, R);
    expect(w.shifted).toBe(false);
  });

  it('shifts 3/4 of the range when the sample reaches the right edge', () => {
    const w = nextRecordingWindow(R, 0, R, R);
    expect(w.shifted).toBe(true);
    expect(w.end).toBe(R + 0.75 * R); // 52.5 min
    expect(w.start).toBe(w.end - R); // 22.5 min — a quarter of the old view stays
  });

  it('performs multiple jumps over a long gap while keeping the range', () => {
    const latest = R + 2 * (0.75 * R); // two shifts past the first edge
    const w = nextRecordingWindow(latest, 0, R, R);
    expect(w.shifted).toBe(true);
    expect(w.end).toBe(R + 3 * (0.75 * R));
    expect(w.end - w.start).toBe(R);
    expect(w.start).toBeLessThanOrEqual(latest);
    expect(w.end).toBeGreaterThan(latest);
  });

  it('returns the window unchanged for an invalid range', () => {
    const w = nextRecordingWindow(R, 0, R, 0);
    expect(w).toEqual({ start: 0, end: R, shifted: false });
  });
});

describe('ChartController recording window mode', () => {
  it('anchors, advances with 3/4 jumps and supports 30/60 range switching', () => {
    const c = new ChartController();
    c.initRecordingWindow(0, 30);

    expect(c.datasourceMode).toBe('Recording');
    expect(c.timePeriod.start.getTime()).toBe(0);
    expect(c.timePeriod.end.getTime()).toBe(R);

    expect(c.advanceRecordingWindow(10 * MIN)).toBe(false);
    expect(c.advanceRecordingWindow(R)).toBe(true); // reaches the right edge
    expect(c.timePeriod.start.getTime()).toBe(22.5 * MIN);
    expect(c.timePeriod.end.getTime()).toBe(52.5 * MIN);

    // Switch to a 60 min window: anchored at 0, latest 40 min → [0, 60 min]
    c.setRecordingRange(60, 0, 40 * MIN);
    expect(c.timePeriod.start.getTime()).toBe(0);
    expect(c.timePeriod.end.getTime()).toBe(60 * MIN);
    expect(c.recordingRangeMs).toBe(60 * MIN);
  });

  it('does nothing outside Recording mode', () => {
    const c = new ChartController();
    expect(c.advanceRecordingWindow(Date.now())).toBe(false);
  });
});

describe('niceRange', () => {
  it('produces wide human ranges, never hugging the data', () => {
    // the reported bugs: early-session narrow data produced 4.30–4.45 / 156–157
    expect(niceRange(4.3, 4.45)).toEqual([0, 5]);
    expect(niceRange(156.0, 157.0)).toEqual([0, 200]);
    expect(niceRange(3.1, 97)).toEqual([0, 120]);
    expect(niceRange(76, 160)).toEqual([0, 200]);
    expect(niceRange(-38, -30)).toEqual([-40, 0]);
  });

  it('pads a constant series and handles invalid input', () => {
    expect(niceRange(42, 42)).toEqual([0, 50]);
    expect(niceRange(NaN, 5)).toEqual([0, 10]);
  });
});

describe('laneAnchors', () => {
  it('anchors the main channel at 70% with a 10% ladder', () => {
    expect(laneAnchors(1)).toEqual([70]);
    expect(laneAnchors(3)).toEqual([70, 60, 50]);
    expect(laneAnchors(5)).toEqual([70, 60, 50, 40, 30]);
  });

  it('compresses the step when many channels share an axis', () => {
    const a = laneAnchors(12);
    expect(a).toHaveLength(12);
    expect(a[0]).toBe(70);
    // monotonic descending, never below the bottom limit
    for (let i = 1; i < a.length; i++) {
      expect(a[i]).toBeLessThan(a[i - 1]);
      expect(a[i]).toBeGreaterThanOrEqual(8 - 1e-6);
    }
  });
});

describe('y-axis unit cap', () => {
  it('rejects a 5th distinct unit but keeps accepting same-unit channels', () => {
    const c = new ChartController();
    const mk = (id, unit, lo = 0, hi = 10) => ({ id, unit, minValue: lo, maxValue: hi });

    expect(c.addSelectedChannel(mk(1, 'm³/h'))).toBe(true);
    expect(c.addSelectedChannel(mk(2, 'm/s'))).toBe(true);
    expect(c.addSelectedChannel(mk(3, '°C'))).toBe(true);
    expect(c.addSelectedChannel(mk(4, 'bar'))).toBe(true);
    expect(c.yAxisDataset).toHaveLength(MAX_Y_AXIS_COUNT);

    // 5th different unit → rejected, nothing added anywhere
    expect(c.addSelectedChannel(mk(5, 'A'))).toBe(false);
    expect(c.selectedChannels).toHaveLength(4);
    expect(c.yAxisDataset).toHaveLength(MAX_Y_AXIS_COUNT);

    // same unit as an existing axis → unlimited channels on that axis
    expect(c.addSelectedChannel(mk(6, 'bar', 1, 2))).toBe(true);
    expect(c.addSelectedChannel(mk(7, 'bar', 1, 3))).toBe(true);
    expect(c.selectedChannels).toHaveLength(6);
    expect(c.yAxisDataset).toHaveLength(MAX_Y_AXIS_COUNT); // axes unchanged

    // duplicate id → ignored
    expect(c.addSelectedChannel(mk(1, 'm³/h'))).toBe(false);
  });
});
