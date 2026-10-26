import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as liveRecorder from './liveRecorder';

const CACHE_CHANNELS = [
  { channel_id: 1, channel_name: 'Flow', sensor_name: 'SUTO SFAB', unit: 'm³/h', resolution: 1 },
  { channel_id: 3, channel_name: 'Consumption', sensor_name: 'SUTO SFAB', unit: 'm³', resolution: 0 },
];

describe('liveRecorder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // ensure no recording leaks between tests
    if (liveRecorder.getRecorderState().recording) liveRecorder.stop();
    liveRecorder.clearSession();
  });

  afterEach(() => {
    if (liveRecorder.getRecorderState().recording) liveRecorder.stop();
    liveRecorder.clearSession();
    vi.useRealTimers();
  });

  it('ignores feeds while not recording', () => {
    liveRecorder.feed([{ channel_id: 1, current_value: 5 }]);
    expect(liveRecorder.getRecorderState().samples).toBe(0);
  });

  it('builds an S4A-format CSV from recorded samples', () => {
    const events = [];
    const off = liveRecorder.subscribe((s, ev) => events.push(ev));

    liveRecorder.start({
      deviceName: 'SUTO S331',
      getChannels: () => CACHE_CHANNELS,
    });
    expect(liveRecorder.getRecorderState().recording).toBe(true);

    liveRecorder.feed([
      { channel_id: 1, current_value: 12.5, unit: 'm³/h', resolution: 1, status: 'normal' },
      { channel_id: 3, current_value: 184600, unit: 'm³', resolution: 0, status: 'normal' },
    ]);
    vi.advanceTimersByTime(2000);
    liveRecorder.feed([
      { channel_id: 1, current_value: null, unit: 'm³/h', resolution: 1, status: 'invalid' },
      { channel_id: 3, current_value: 184601, unit: 'm³', resolution: 0, status: 'normal' },
    ]);
    expect(liveRecorder.getRecorderState().samples).toBe(2);

    const result = liveRecorder.stop();
    off();

    expect(result).not.toBeNull();
    expect(result.rowCount).toBe(2);
    expect(result.filename).toMatch(/^SUTO_S331_LiveRecord_\d{8}-\d{6}\.csv$/);

    const lines = result.csvText.split('\r\n');
    expect(lines[0]).toBe('SUTO S331 Raw Data');
    expect(lines).toContain('NO.Of Channels,2');
    expect(lines).toContain('NO.Of Records,2');
    expect(lines).toContain('Sample Rate(sec),2'); // 2000 ms gap → 2 s
    expect(lines).toContain('1,Flow,SUTO SFAB,m³/h,0.1,Location 1/Flow');
    expect(lines).toContain('2,Consumption,SUTO SFAB,m³,1,Location 2/Consumption');
    expect(lines).toContain('Date Time,Flow - m³/h,Consumption - m³');

    const dataRows = lines.filter((l) => /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2},/.test(l));
    expect(dataRows).toHaveLength(2);
    expect(dataRows[0]).toMatch(/,12\.5,184600$/);
    expect(dataRows[1]).toMatch(/,-9999\.0,184601$/); // invalid sample → sentinel

    expect(events).toEqual(['start', 'sample', 'sample', 'saved']);
    expect(liveRecorder.getRecorderState().recording).toBe(false);
  });

  it('returns null when stopping with no samples captured', () => {
    liveRecorder.start({ deviceName: 'SUTO S331', intervalSec: 0, getChannels: () => CACHE_CHANNELS });
    const result = liveRecorder.stop();
    expect(result).toBeNull();
    expect(liveRecorder.getRecorderState().recording).toBe(false);
  });

  it('falls back to feed metadata when no channel cache is provided', () => {
    liveRecorder.start({ deviceName: 'SUTO S331', intervalSec: 0, getChannels: () => [] });
    liveRecorder.feed([{ channel_id: 7, current_value: 3.14, unit: 'bar', resolution: 2, status: 'normal' }]);
    const result = liveRecorder.stop();
    const lines = result.csvText.split('\r\n');
    expect(lines).toContain('NO.Of Channels,1');
    expect(lines).toContain('1,Channel 7,SUTO,bar,0.01,Location 1/Channel 7');
    expect(lines).toContain('Date Time,Channel 7 - bar');
  });

  it('keeps the session buffer after stop for the live views', () => {
    liveRecorder.start({ deviceName: 'SUTO S331', intervalSec: 0, getChannels: () => CACHE_CHANNELS });
    liveRecorder.feed([{ channel_id: 1, current_value: 1, unit: 'm³/h', resolution: 1, status: 'normal' }]);
    liveRecorder.feed([{ channel_id: 1, current_value: 2, unit: 'm³/h', resolution: 1, status: 'normal' }]);
    const result = liveRecorder.stop();

    expect(result.rowCount).toBe(2);
    expect(liveRecorder.getRecorderState().hasSession).toBe(true);
    expect(liveRecorder.getRecorderState().recording).toBe(false);

    const snap = liveRecorder.getSessionSnapshot();
    expect(snap.rows).toHaveLength(2);
    expect(snap.recording).toBe(false);
    expect(snap.rows[0].values[1]).toBe(1);
    expect(snap.rows[1].values[1]).toBe(2);
  });

  it('clearSession drops the buffer and hides the tabs', () => {
    liveRecorder.start({ deviceName: 'SUTO S331', intervalSec: 0, getChannels: () => [] });
    liveRecorder.feed([{ channel_id: 1, current_value: 1, status: 'normal' }]);
    liveRecorder.stop();

    liveRecorder.clearSession();
    expect(liveRecorder.getRecorderState().hasSession).toBe(false);
    expect(liveRecorder.getSessionSnapshot().rows).toHaveLength(0);
  });

  it('a new recording clears the previous session', () => {
    liveRecorder.start({ deviceName: 'SUTO S331', intervalSec: 0, getChannels: () => [] });
    liveRecorder.feed([{ channel_id: 1, current_value: 1, status: 'normal' }]);
    liveRecorder.stop();

    liveRecorder.start({ deviceName: 'SUTO S331', intervalSec: 0, getChannels: () => [] });
    expect(liveRecorder.getSessionSnapshot().rows).toHaveLength(0);
    expect(liveRecorder.getRecorderState().hasSession).toBe(true); // recording
  });

  it('thins samples to the requested interval (first row at once, next after N s)', () => {
    liveRecorder.start({ deviceName: 'SUTO S331', intervalSec: 10, getChannels: () => [] });

    liveRecorder.feed([{ channel_id: 1, current_value: 1, status: 'normal' }]); // 09:00:01
    expect(liveRecorder.getRecorderState().samples).toBe(1);

    vi.advanceTimersByTime(4000); // 09:00:05 — inside the interval
    liveRecorder.feed([{ channel_id: 1, current_value: 2, status: 'normal' }]);
    expect(liveRecorder.getRecorderState().samples).toBe(1);

    vi.advanceTimersByTime(6000); // 09:00:11 — poll arrives 1 s past the boundary
    liveRecorder.feed([{ channel_id: 1, current_value: 3, status: 'normal' }]);
    expect(liveRecorder.getRecorderState().samples).toBe(2);

    vi.advanceTimersByTime(11000); // 09:00:22 — another slot, arrival jitter again
    liveRecorder.feed([{ channel_id: 1, current_value: 4, status: 'normal' }]);
    expect(liveRecorder.getRecorderState().samples).toBe(3);

    const snap = liveRecorder.getSessionSnapshot();
    // Timestamps snap to a uniform grid: exact 10 s apart despite arrival jitter
    expect(snap.rows[1].t - snap.rows[0].t).toBe(10000);
    expect(snap.rows[2].t - snap.rows[1].t).toBe(10000);
    expect(snap.rows[0].values[1]).toBe(1);
    expect(snap.rows[2].values[1]).toBe(4);

    const result = liveRecorder.stop();
    expect(result.csvText).toContain('Sample Rate(sec),10');
  });

  it('fills a null marker row for every channel when polls stall (OS sleep)', () => {
    liveRecorder.start({ deviceName: 'SUTO S331', intervalSec: 10, getChannels: () => [] });

    liveRecorder.feed([
      { channel_id: 1, current_value: 1, unit: 'm³/h', resolution: 1, status: 'normal' },
      { channel_id: 2, current_value: 11, unit: 'A', resolution: 1, status: 'normal' },
    ]);
    expect(liveRecorder.getRecorderState().samples).toBe(1);

    // OS sleeps for ~90 s — several intervals are missed, then a poll lands.
    vi.advanceTimersByTime(90000);
    liveRecorder.feed([
      { channel_id: 1, current_value: 2, unit: 'm³/h', resolution: 1, status: 'normal' },
      { channel_id: 2, current_value: 12, unit: 'A', resolution: 1, status: 'normal' },
    ]);

    const snap = liveRecorder.getSessionSnapshot();
    expect(snap.rows).toHaveLength(3); // real, gap marker, real
    expect(snap.rows[1].values[1]).toBeNull();
    expect(snap.rows[1].values[2]).toBeNull();
    expect(snap.rows[2].values[1]).toBe(2);

    // CSV renders the gap row with the -9999.0 sentinel (never empty cells)
    const result = liveRecorder.stop();
    const gapLine = result.csvText.split('\r\n').find((l) => l.endsWith(',-9999.0,-9999.0'));
    expect(gapLine).toBeTruthy();
  });

  it('does not fill gaps for normal inter-sample spacing', () => {
    liveRecorder.start({ deviceName: 'SUTO S331', intervalSec: 10, getChannels: () => [] });
    liveRecorder.feed([{ channel_id: 1, current_value: 1, status: 'normal' }]);
    vi.advanceTimersByTime(11000); // one interval + poll jitter — normal
    liveRecorder.feed([{ channel_id: 1, current_value: 2, status: 'normal' }]);
    const snap = liveRecorder.getSessionSnapshot();
    expect(snap.rows).toHaveLength(2); // no marker inserted
    expect(snap.rows.every((r) => r.values[1] !== null)).toBe(true);
  });
});
