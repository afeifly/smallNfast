import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../api/TauriSutoAPI', () => ({
  default: {
    getMeasurementData: vi.fn(async () => [
      { channel_id: 1, current_value: 42.5, unit: 'm³/h', resolution: 1, status: 'normal' },
    ]),
  },
}));

import {
  subscribeLive,
  setViewDemand,
  setRecordingDemand,
  isPolling,
  pollOnce,
  POLL_INTERVAL_MS,
} from './liveDataSource';
import TauriSutoAPI from '../api/TauriSutoAPI';

describe('liveDataSource', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setViewDemand(false);
    setRecordingDemand(false);
  });

  afterEach(() => {
    setViewDemand(false);
    setRecordingDemand(false);
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('starts polling when the view demands data and dispatches results', async () => {
    const seen = [];
    const off = subscribeLive((res) => seen.push(res));
    setViewDemand(true);
    expect(isPolling()).toBe(true);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    // immediate first poll + at least one interval tick
    expect(TauriSutoAPI.getMeasurementData.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[0][0].channel_id).toBe(1);
    off();
  });

  it('keeps polling while only the recorder demands data', async () => {
    setViewDemand(true);
    setViewDemand(false);
    expect(isPolling()).toBe(false);

    setRecordingDemand(true);
    expect(isPolling()).toBe(true);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(TauriSutoAPI.getMeasurementData.mock.calls.length).toBeGreaterThanOrEqual(1);

    setRecordingDemand(false);
    expect(isPolling()).toBe(false);
  });

  it('unsubscribes cleanly', async () => {
    const seen = [];
    const off = subscribeLive((res) => seen.push(res));
    off();
    await pollOnce();
    expect(seen).toHaveLength(0);
  });
});
