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
 * @param {string}  [opts.deviceName]  Device name for the CSV header / filename
 * @param {function} [opts.getChannels] () => channel list (online cache) for
 *        channel names / sensors / units in the CSV header
 */
export function start(opts = {}) {
  if (state.recording) return;
  state = {
    recording: true,
    deviceName: opts.deviceName || 'SUTO Device',
    getChannels: typeof opts.getChannels === 'function' ? opts.getChannels : () => [],
    startedAt: Date.now(),
    rows: [],
    channelIds: [],
    channelMeta: {},
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
  const values = {};
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
        typeof v.resolution === 'number' && v.resolution > 0
          ? v.resolution
          : (prev ? prev.resolution : 2),
    };
  }
  state.rows.push({ t, values });
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
  const channelIds = [...s.channelIds].sort((a, b) => a - b);
  const cacheChannels = [];
  try {
    const cached = s.getChannels();
    if (Array.isArray(cached)) cacheChannels.push(...cached);
  } catch { /* cache unavailable — fall back to feed metadata */ }

  const channels = channelIds.map((id) => {
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
    };
  });

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
    lines.push(`${idx + 1},${ch.name},${ch.sensor},${ch.unit},${resolutionString(ch.resolution)},Location ${idx + 1}/${ch.name}`);
  });
  lines.push('');
  lines.push(['Date Time', ...channels.map((ch) => (ch.unit ? `${ch.name} - ${ch.unit}` : ch.name))].join(','));

  for (const row of s.rows) {
    const cols = [fmtRowDate(new Date(row.t))];
    for (const ch of channels) {
      const v = row.values[ch.id];
      cols.push(v === null || v === undefined ? '' : formatChannelValue(v, ch.resolution));
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
