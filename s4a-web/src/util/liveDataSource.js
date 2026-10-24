/**
 * Live Data Source — single owner of the live device polling loop.
 *
 * Consumers (Online View for display, Live Recorder for CSV capture) never
 * poll the device themselves; they subscribe here and declare demand:
 *
 *   subscribeLive(fn)          fn receives every successful poll result
 *   setViewDemand(bool)        Online View wants data (tab active + not paused)
 *   setRecordingDemand(bool)   Recorder wants data (while recording)
 *
 * The shared poller runs while ANY consumer demands data, so recording keeps
 * sampling even when the Online View is paused or the Readout tab is open,
 * and no traffic is duplicated when both are active.
 */

import TauriSutoAPI from '../api/TauriSutoAPI';

export const POLL_INTERVAL_MS = 1500;

let viewDemand = false;
let recordingDemand = false;
let timer = null;
let inFlight = false;
const subscribers = new Set();

function dispatch(result) {
  for (const fn of subscribers) {
    try {
      fn(result);
    } catch (e) {
      console.warn('[LiveDataSource] subscriber error:', e);
    }
  }
}

async function poll() {
  if (inFlight) return;
  inFlight = true;
  try {
    const res = await TauriSutoAPI.getMeasurementData();
    dispatch(res);
  } catch (e) {
    console.warn('[LiveDataSource] poll failed:', e);
  } finally {
    inFlight = false;
  }
}

function sync() {
  const needed = viewDemand || recordingDemand;
  if (needed && timer === null) {
    poll(); // immediate first sample whenever the link (re)starts
    timer = setInterval(poll, POLL_INTERVAL_MS);
  } else if (!needed && timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

/** Subscribe to poll results. Returns an unsubscribe function. */
export function subscribeLive(fn) {
  if (typeof fn !== 'function') return () => {};
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Declare whether the Online View currently wants live data. */
export function setViewDemand(active) {
  viewDemand = Boolean(active);
  sync();
}

/** Declare whether the recorder currently wants live data. */
export function setRecordingDemand(active) {
  recordingDemand = Boolean(active);
  sync();
}

/** One-shot poll outside the interval (manual refresh / rescan). */
export function pollOnce() {
  return poll();
}

/** Whether the shared poller is currently running. */
export function isPolling() {
  return timer !== null;
}
