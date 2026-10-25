import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import TestAPI from './TestAPI';
import TauriSutoAPI from './TauriSutoAPI';

describe('TestAPI monitor proxy', () => {
  let spy;

  beforeEach(() => {
    TestAPI.setMode('monitor');
    spy = vi.spyOn(TauriSutoAPI, 'getMeasurementData').mockImplementation(async (cb) => {
      const result = [{ channel_id: 1, current_value: 1, unit: 'A', resolution: 1, status: 'normal' }];
      if (cb) cb(result);
      return result;
    });
  });

  afterEach(() => {
    TestAPI.setMode('analyze');
    spy.mockRestore();
  });

  it('forwards the 6-arg stock call (…, getDataWay, callback) and fires the callback', async () => {
    const received = [];
    // ChannelList calls: (channelId, start, stop, interval, getDataWay=2, callback)
    await TestAPI.getMeasurementData(1, 0, 100, 1, 2, (res) => received.push(res));
    expect(received).toHaveLength(1);
    expect(Array.isArray(received[0])).toBe(true);
    expect(received[0][0].channel_id).toBe(1);
    // The device layer must never receive the numeric getDataWay as a "callback"
    const cbArg = spy.mock.calls[0][0];
    expect(typeof cbArg).toBe('function');
  });

  it('also supports the callback-as-first-arg convention', async () => {
    const received = [];
    await TestAPI.getMeasurementData((res) => received.push(res));
    expect(received).toHaveLength(1);
  });
});
