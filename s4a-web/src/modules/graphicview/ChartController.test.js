import { describe, it, expect } from 'vitest';
import ChartController, { nextRecordingWindow } from './ChartController';

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
