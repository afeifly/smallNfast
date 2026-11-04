/**
 * Live Value Recorder — captures live measurement values to an S4A-format CSV.
 *
 * Pure consumer of the shared poller (util/liveDataSource): starting a
 * recording subscribes to poll results and declares recording demand, so
 * sampling continues at the shared poll rate regardless of what the Online
 * View is doing, and adds zero device traffic on top of an active view.
 *
 * The exported CSV mirrors the Readout CSV layout (S4A "Raw Data" header
 * block, channel table, then Date Time + one column per channel).
 */

import { subscribeLive, setRecordingDemand } from './liveDataSource';
import { formatChannelValue } from './resolution';

let state = {
  recording: false,
  deviceName: 'SUTO Device',
  getChannels: () => [],
  startedAt: 0,
  rows: [], // [{ t: ms, values: { [channelId]: number | null } }]
  channelIds: [], // order of first appearance
  channelMeta: {}, // id -> { unit, resolution }
};
let unsubscribe = null;
const listeners = new Set();

function snapshot() {
  return {
    recording: state.recording,
    startedAt: state.startedAt,
    samples: state.rows.length,
    channels: state.channelIds.length,
    // A session exists while recording, and after stop() until the next
    // start() or clearSession() — the frozen rows stay inspectable in the
    // live Graphic / Table views.
    hasSession: state.recording || state.rows.length > 0,
  };
}

function notify(event) {
  const snap = snapshot();
  for (const fn of listeners) {
    try {
      fn(snap, event);
    } catch (e) {
      console.warn('[LiveRecorder] listener error:', e);
    }
  }
}

/** Subscribe to recorder state changes. Returns an unsubscribe function. */
export function subscribe(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getRecorderState() {
  return snapshot();
}

/**
 * Start recording.
 * @param {object} [opts]
 * @param {string}  [opts.deviceName]   Device name for the CSV header / filename
 * @param {function} [opts.getChannels] () => channel list (online cache) for
 *        channel names / sensors / units in the CSV header
 * @param {Array}   [opts.selectedChannels] Optional explicit list of assigned channels
 *        for ProcessScape multi-device recording. Each item:
 *        { key, channel_id, name, unit, resolution, locationName, measurementPointName, deviceName }
 * @param {number}  [opts.intervalSec]  Sampling interval in seconds. A row is
 *        recorded by the first poll at/after each interval boundary (default
 *        10 → first row at 09:00:01, next at 09:00:11…). 0 records every poll.
 */
export function start(opts = {}) {
  if (state.recording) return;

  const selectedChannels = Array.isArray(opts.selectedChannels) ? opts.selectedChannels : null;
  const channelIds = [];
  const channelMeta = {};

  if (selectedChannels && selectedChannels.length > 0) {
    selectedChannels.forEach((ch, idx) => {
      const idKey = ch.key || ch.id || ch.channel_id || `ch_${idx + 1}`;
      channelIds.push(idKey);
      channelMeta[idKey] = {
        name: ch.name || ch.customName || ch.displayName || `Channel ${ch.channel_id ?? idx + 1}`,
        sensor: ch.deviceName || ch.device || ch.sensor || 'SUTO',
        unit: ch.unit || '',
        resolution: typeof ch.resolution === 'number' ? ch.resolution : 2,
        location: ch.locationName || ch.location || '',
        measurementPoint: ch.measurementPointName || ch.measurementPoint || '',
        channel_id: ch.channel_id ?? ch.channelId ?? ch.id,
      };
    });
  }

  state = {
    recording: true,
    deviceName: opts.deviceName || 'SUTO Device',
    getChannels: typeof opts.getChannels === 'function' ? opts.getChannels : () => [],
    selectedChannels,
    startedAt: Date.now(),
    intervalMs: Math.max(0, Math.round(Number(opts.intervalSec) || 0)) * 1000,
    lastRowT: 0,
    rows: [],
    channelIds,
    channelMeta,
  };
  unsubscribe = subscribeLive(feed);
  setRecordingDemand(true);
  notify('start');
}

/**
 * Append one sample. Wired to the live data source subscription in start();
 * exported separately so tests (and any future consumer) can feed directly.
 */
export function feed(resultArray) {
  if (!state.recording || !Array.isArray(resultArray) || resultArray.length === 0) return;
  const t = Date.now();
  let rowT = t;

  if (state.rows.length > 0 && state.channelIds.length > 0 && state.intervalMs > 0) {
    if (t - state.lastRowT >= state.intervalMs * 2 + 2000) {
      // Real gap (OS sleep / throttling): null marker at the first missed
      // tick, then re-anchor the grid at the actual arrival time — the
      // recovery row must keep its true timestamp.
      const marker = { t: state.lastRowT + state.intervalMs, values: {} };
      for (const id of state.channelIds) {
        marker.values[id] = null;
      }
      state.rows.push(marker);
      state.lastRowT = marker.t;
      rowT = t;
    } else if (t - state.lastRowT >= state.intervalMs) {
      // Normal slot crossed — snap to the interval grid so timestamps stay
      // perfectly uniform (poll arrival jitter of 0–1.5 s disappears).
      rowT = state.lastRowT + state.intervalMs;
    } else {
      return; // inside the current slot
    }
  } else if (state.rows.length > 0 && state.channelIds.length > 0 && state.intervalMs === 0 && t - state.lastRowT >= 5000) {
    // interval 0 (record every poll): a 5 s stall is a real gap
    const marker = { t: state.lastRowT + Math.round((t - state.lastRowT) / 2), values: {} };
    for (const id of state.channelIds) {
      marker.values[id] = null;
    }
    state.rows.push(marker);
    state.lastRowT = marker.t;
    rowT = t;
  }

  const values = {};
  if (state.selectedChannels && state.selectedChannels.length > 0) {
    // Map incoming telemetry array by device scoping, channel_id, id, and normalized name
    const byDevId = new Map();
    const byId = new Map();
    const byName = new Map();

    resultArray.forEach((v, idx) => {
      const id = v?.channel_id ?? v?.id;
      const devKeys = [
        v?.deviceId,
        v?.device_id,
        v?.serial,
        v?.serial_number,
        v?.port ? String(v.port) : null,
        v?.device
      ].filter(Boolean);

      devKeys.forEach(dk => {
        const k = String(dk).toLowerCase();
        if (id !== undefined && id !== null) {
          byDevId.set(`${k}_${id}`, v);
          byDevId.set(`${k}_idx_${idx + 1}`, v);
        }
      });

      if (id !== undefined && id !== null) {
        byId.set(String(id), v);
        byId.set(Number(id), v);
      }
      byId.set(`idx_${idx + 1}`, v);
      const name = v?.name || v?.channel_name || v?.description;
      if (name) {
        byName.set(name.trim().toLowerCase(), v);
        devKeys.forEach(dk => {
          byName.set(`${String(dk).toLowerCase()}_${name.trim().toLowerCase()}`, v);
        });
      }
    });

    state.selectedChannels.forEach(ch => {
      const idKey = ch.key || ch.id || ch.channel_id;
      const targetId = ch.channel_id ?? ch.channelId ?? ch.id;

      let parsedDevId = null;
      let parsedSn = null;
      let parsedPort = null;
      if (typeof ch.id === 'string') {
        const m = ch.id.match(/^ch_(dev_[a-zA-Z0-9_-]+?)_\d+(?:_\d+)?$/);
        if (m) {
          parsedDevId = m[1];
          const pm = parsedDevId.match(/_(\d{2,5})$/);
          if (pm) parsedPort = pm[1];
          const snm = parsedDevId.match(/_sn_([a-zA-Z0-9_-]+)/);
          if (snm) parsedSn = snm[1];
        }
      }

      const targetDevKeys = [
        ch.deviceId,
        ch.deviceSerial,
        ch.devicePort ? String(ch.devicePort) : null,
        ch.deviceName,
        ch.device,
        parsedDevId,
        parsedSn,
        parsedPort
      ].filter(Boolean);

      let matched = null;
      // 1. Device-scoped matching first (avoids cross-device collisions for same channel numbers or names)
      for (const dk of targetDevKeys) {
        const k = String(dk).toLowerCase();
        matched = byDevId.get(`${k}_${targetId}`) ||
                  byName.get(`${k}_${(ch.name || '').trim().toLowerCase()}`) ||
                  byName.get(`${k}_${(ch.originalName || '').trim().toLowerCase()}`);
        if (matched) break;
      }

      // 2. Fallback to un-scoped lookup ONLY if candidate does not conflict with a different device
      if (!matched) {
        let candidate = byId.get(String(targetId)) || byId.get(Number(targetId));
        if (!candidate && ch.name) {
          candidate = byName.get(ch.name.trim().toLowerCase());
        }
        if (!candidate && ch.originalName) {
          candidate = byName.get(ch.originalName.trim().toLowerCase());
        }
        if (candidate) {
          const candDev = (candidate.deviceId || candidate.serial || candidate.port ? String(candidate.port) : candidate.device || '').toLowerCase();
          const chDev = (ch.deviceId || ch.deviceSerial || ch.devicePort ? String(ch.devicePort) : ch.device || '').toLowerCase();
          if (!candDev || !chDev || candDev === chDev || candDev.includes(chDev) || chDev.includes(candDev)) {
            matched = candidate;
          }
        }
      }
      if (matched) {
        const raw = matched.current_value ?? matched.value;
        values[idKey] = raw === null || raw === undefined || Number.isNaN(raw) ? null : raw;
        if (matched.unit && state.channelMeta[idKey] && !state.channelMeta[idKey].unit) {
          state.channelMeta[idKey].unit = matched.unit;
        }
        if (typeof matched.resolution === 'number' && matched.resolution >= 0 && state.channelMeta[idKey]) {
          state.channelMeta[idKey].resolution = matched.resolution;
        }
      } else {
        values[idKey] = null;
      }
    });
  } else {
    for (const v of resultArray) {
      const id = v?.channel_id ?? v?.id;
      if (id === undefined || id === null) continue;
      const raw = v.current_value ?? v.value;
      values[id] = raw === null || raw === undefined || Number.isNaN(raw) ? null : raw;
      if (!state.channelIds.includes(id)) state.channelIds.push(id);
      const prev = state.channelMeta[id];
      state.channelMeta[id] = {
        unit: v.unit || (prev ? prev.unit : '') || '',
        resolution:
          typeof v.resolution === 'number' && v.resolution >= 0
            ? v.resolution
            : (prev ? prev.resolution : 2),
      };
    }
  }

  state.rows.push({ t: rowT, values });
  state.lastRowT = rowT;
  notify('sample');
}

/**
 * Stop recording and build the CSV.
 * The session buffer (rows / channelIds / channelMeta) is KEPT so the live
 * Graphic / Table views stay frozen-but-inspectable; it is cleared by the
 * next start() or by clearSession().
 * @returns {{ csvText: string, filename: string, rowCount: number } | null}
 *          null when no samples were captured.
 */
export function stop() {
  if (!state.recording) return null;
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  setRecordingDemand(false);
  state.recording = false;

  const result = state.rows.length > 0 ? buildResult(state) : null;
  notify(result ? 'saved' : 'empty');
  return result;
}

/**
 * Snapshot of the current recording session for the live views.
 * `rows` is ascending by time and shared by reference — do not mutate.
 */
export function getSessionSnapshot() {
  return {
    recording: state.recording,
    startedAt: state.startedAt,
    rows: state.rows,
    channelIds: [...state.channelIds].sort((a, b) => a - b),
    channelMeta: { ...state.channelMeta },
  };
}

/** Drop the session buffer (e.g. when the device is disconnected). */
export function clearSession() {
  if (state.recording) {
    stop();
  }
  state.rows = [];
  state.channelIds = [];
  state.channelMeta = {};
  notify('cleared');
}

// ---- CSV building (S4A layout, mirrors ReadoutView CSV export) ----

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtHeaderDate(d) {
  const p = (n) => (n < 10 ? `0${n}` : String(n));
  return `${d.getDate()}.${MONTHS[d.getMonth()]} ${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function fmtRowDate(d) {
  const p = (n) => (n < 10 ? `0${n}` : String(n));
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function resolutionString(res) {
  const r = Math.max(0, Math.min(20, res || 0));
  if (r === 0) return '1';
  return (1 / Math.pow(10, r)).toFixed(r);
}

function sanitizeName(name) {
  return String(name || 'SUTO_Device').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function buildResult(s) {
  let channels;
  if (s.selectedChannels && s.selectedChannels.length > 0) {
    channels = s.selectedChannels.map((ch, idx) => {
      const idKey = ch.key || ch.id || ch.channel_id || `ch_${idx + 1}`;
      const meta = s.channelMeta[idKey] || {};
      return {
        id: idKey,
        name: meta.name || ch.name || ch.customName || `Channel ${ch.channel_id ?? idx + 1}`,
        sensor: meta.sensor || ch.deviceName || ch.device || 'SUTO',
        unit: meta.unit || ch.unit || '',
        resolution: typeof meta.resolution === 'number' ? meta.resolution : (ch.resolution ?? 2),
        location: meta.location || ch.locationName || ch.location || '',
        measurementPoint: meta.measurementPoint || ch.measurementPointName || ch.measurementPoint || ''
      };
    });
  } else {
    const channelIds = [...s.channelIds].sort((a, b) => a - b);
    const cacheChannels = [];
    try {
      const cached = s.getChannels();
      if (Array.isArray(cached)) cacheChannels.push(...cached);
    } catch { /* cache unavailable — fall back to feed metadata */ }

    channels = channelIds.map((id) => {
      const cached = cacheChannels.find((c) => c && c.channel_id === id);
      const meta = s.channelMeta[id] || {};
      return {
        id,
        name: (cached && (cached.channel_name || cached.sensor_description)) || `Channel ${id}`,
        sensor: (cached && (cached.sensor_name || cached.sensor_description)) || 'SUTO',
        unit: (cached && cached.unit) || meta.unit || '',
        resolution:
          (cached && typeof cached.resolution === 'number' && cached.resolution >= 0 && cached.resolution) ??
          (meta.resolution ?? 2),
        location: '',
        measurementPoint: ''
      };
    });
  }

  const first = s.rows[0];
  const last = s.rows[s.rows.length - 1];
  const durationSec = Math.max(1, Math.round((last.t - first.t) / 1000));
  const sampleRate = s.rows.length > 1 ? Math.max(1, Math.round(durationSec / (s.rows.length - 1))) : 1;

  const lines = [];
  lines.push(`${s.deviceName} Raw Data`);
  lines.push('');
  lines.push(`Start Date Time,${fmtHeaderDate(new Date(first.t))}`);
  lines.push(`End Date Time,${fmtHeaderDate(new Date(last.t))}`);
  lines.push(`Sample Rate(sec),${sampleRate}`);
  lines.push(`NO.Of Channels,${channels.length}`);
  lines.push(`NO.Of Records,${s.rows.length}`);
  lines.push('');
  lines.push('No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point');
  channels.forEach((ch, idx) => {
    const locMp = (ch.location || ch.measurementPoint)
      ? `${ch.location || 'Location'}/${ch.measurementPoint || ch.name}`
      : `Location ${idx + 1}/${ch.name}`;
    lines.push(`${idx + 1},${ch.name},${ch.sensor},${ch.unit},${resolutionString(ch.resolution)},${locMp}`);
  });
  lines.push('');
  lines.push(['Date Time', ...channels.map((ch) => (ch.unit ? `${ch.name} - ${ch.unit}` : ch.name))].join(','));

  for (const row of s.rows) {
    const cols = [fmtRowDate(new Date(row.t))];
    for (const ch of channels) {
      const v = row.values[ch.id];
      // Invalid samples (gap markers, device nulls) export as the SUTO
      // sentinel -9999.0 — downstream systems require a numeric cell.
      cols.push(v === null || v === undefined ? '-9999.0' : formatChannelValue(v, ch.resolution));
    }
    lines.push(cols.join(','));
  }

  const d = new Date(s.startedAt);
  const p = (n) => (n < 10 ? `0${n}` : String(n));
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;

  return {
    csvText: lines.join('\r\n') + '\r\n',
    filename: `${sanitizeName(s.deviceName)}_LiveRecord_${stamp}.csv`,
    rowCount: s.rows.length,
  };
}
