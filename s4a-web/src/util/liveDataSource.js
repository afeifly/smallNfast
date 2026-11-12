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
let activeLocationChannels = null; // null: unrestricted (all channels); Array: channels in active location
let recordingChannels = null; // null or Array of channels being recorded
let alarmChannels = null; // null or Array of channels demanded by alarms across all locations
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

/**
 * Returns the consolidated list of demanded channels based on:
 * 1. Active location in ProcessScape (when not recording, ONLY active location's channels)
 * 2. When recording is running: (active location channels) ∪ (recording channels)
 * 3. When alarm monitoring is running: all assigned channels across locations
 * 4. When outside ProcessScape (unrestricted): null (all connected channels)
 */
export function getDemandedChannels() {
  const isRec = recordingDemand && Array.isArray(recordingChannels);
  const isLoc = Array.isArray(activeLocationChannels);
  const isAlarm = Array.isArray(alarmChannels) && alarmChannels.length > 0;

  if (isRec || isLoc || isAlarm) {
    const combined = [];
    const seen = new Set();
    const addList = (list) => {
      if (!Array.isArray(list)) return;
      list.forEach(c => {
        if (!c) return;
        const k = c.key || c.id || c.channel_id;
        if (k && !seen.has(k)) {
          combined.push(c);
          seen.add(k);
        }
      });
    };
    if (isLoc) addList(activeLocationChannels);
    if (isRec) addList(recordingChannels);
    if (isAlarm) addList(alarmChannels);
    return combined;
  }

  // Unrestricted demand (e.g. standard S4A Online View / Monitor tab)
  return null;
}

/** Set channels demanded by the currently active ProcessScape location */
export function setActiveLocationChannels(channels) {
  activeLocationChannels = Array.isArray(channels) ? channels : null;
  // If poller is active, trigger an immediate poll to refresh new location channels immediately
  if (timer !== null) {
    poll();
  }
}

/** Set channels demanded by active live recording */
export function setRecordingChannels(channels) {
  recordingChannels = Array.isArray(channels) ? channels : null;
  if (timer !== null) {
    poll();
  }
}

/** Set channels demanded by background alarm monitoring across all locations */
export function setAlarmChannels(channels) {
  alarmChannels = Array.isArray(channels) ? channels : null;
  sync();
  if (timer !== null) {
    poll();
  }
}

let isPaused = false;

/** Temporarily pause the background live polling loop (e.g. during hardware connection/discovery) */
export function pausePolling() {
  isPaused = true;
}

/** Resume the background live polling loop */
export function resumePolling() {
  isPaused = false;
}

async function poll() {
  if (inFlight || isPaused) return;
  inFlight = true;
  try {
    const demanded = getDemandedChannels();
    const res = await TauriSutoAPI.getMeasurementData(null, { demandedChannels: demanded });
    dispatch(res);
  } catch (e) {
    console.warn('[LiveDataSource] poll failed:', e);
  } finally {
    inFlight = false;
  }
}

function sync() {
  const needed = viewDemand || recordingDemand || (Array.isArray(alarmChannels) && alarmChannels.length > 0);
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
