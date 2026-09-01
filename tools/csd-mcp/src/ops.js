/**
 * ops.js — high-level CSD operations used by the MCP tools.
 */

import {
  readCsd, writeCsdFile, channelIndex, sampleFromTime, parseTime,
  readValue, writeValue, readRecord, readRecordId, isMeasurement,
  localString, isoString, firstRows, lastRows, updateChannelMinMax,
  INVALID_THRESHOLD, formatValue,
} from './csd.js';

// deterministic PRNG (mulberry32) so runs are reproducible via `seed`
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randBetween(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

function resolveRange(header, args) {
  let startSample = 0;
  let stopSample = header.numSamples - 1;
  if (args.startTime != null || args.stopTime != null) {
    if (args.startTime != null) startSample = sampleFromTime(header, parseTime(args.startTime));
    if (args.stopTime != null) stopSample = sampleFromTime(header, parseTime(args.stopTime));
  }
  if (args.startSample != null) startSample = Math.max(0, Math.min(Number(args.startSample), header.numSamples - 1));
  if (args.stopSample != null) stopSample = Math.max(0, Math.min(Number(args.stopSample), header.numSamples - 1));
  if (startSample > stopSample) [startSample, stopSample] = [stopSample, startSample];
  return { startSample, stopSample };
}

function timeAt(header, sampleIdx) {
  return header.startTimeMs + sampleIdx * header.sampleIntervalSec * 1000;
}

/* ── inspect ─────────────────────────────────────────────────────────────── */

export async function inspect(args) {
  const { buf, header } = readCsd(args.path);
  const startTimeMs = header.startTimeMs;
  const stopTimeMs = startTimeMs + header.numSamples * header.sampleIntervalSec * 1000;
  return {
    path: args.path,
    fileSizeBytes: buf.length,
    version: header.version,
    deviceName: header.deviceName,
    numChannels: header.numChannels,
    numSamples: header.numSamples,
    sampleIntervalSec: header.sampleIntervalSec,
    sampleRateHz: header.sampleRateHz,
    startTimeMs,
    stopTimeMs,
    startTime: localString(startTimeMs),
    stopTime: localString(stopTimeMs),
    startTimeIso: isoString(startTimeMs),
    stopTimeIso: isoString(stopTimeMs),
    channels: header.channels.map(c => ({
      channel_id: c.channel_id,
      logic_channel_description: c.logic_channel_description,
      sensor_description: c.sensor_description,
      unit_in_ascii: c.unit_in_ascii,
      resolution: c.resolution,
      sensor_id: c.sensor_id,
      min: formatValue(c._min),
      max: formatValue(c._max),
    })),
    firstRows: firstRows(buf, header, 5),
    lastRows: lastRows(buf, header, 5),
  };
}

/* ── modify_channel_range ────────────────────────────────────────────────── */

/**
 * ops:
 *   multiply | add | subtract | set | random | copy
 *   (multiply/add/subtract only touch measurement values; set/random/copy
 *    replace everything in range, including invalid markers)
 */
export async function modifyChannelRange(args) {
  const { buf, header } = readCsd(args.path);
  const chIdx = channelIndex(header, args.channel);
  const op = args.op || 'multiply';
  const { startSample, stopSample } = resolveRange(header, args);
  const rng = mulberry32(args.seed ?? 20260901);

  let count = 0;
  let firstValid = null;
  let lastValid = null;
  let lo = Infinity;
  let hi = -Infinity;

  for (let s = startSample; s <= stopSample; s++) {
    const v = readValue(buf, header, chIdx, s);
    let nv;
    switch (op) {
      case 'multiply': {
        if (!isMeasurement(v)) continue;
        nv = v * Number(args.value);
        break;
      }
      case 'add': {
        if (!isMeasurement(v)) continue;
        nv = v + Number(args.value);
        break;
      }
      case 'subtract': {
        if (!isMeasurement(v)) continue;
        nv = v - Number(args.value);
        break;
      }
      case 'set': {
        nv = Number(args.value);
        break;
      }
      case 'random': {
        const lo_ = args.lo == null ? -1000 : Number(args.lo);
        const hi_ = args.hi == null ? 1000 : Number(args.hi);
        if (hi_ < lo_) throw new Error('hi must be >= lo for random op');
        nv = randBetween(rng, lo_, hi_);
        break;
      }
      case 'copy': {
        nv = v; // no-op unless a source is supplied below
        break;
      }
      default:
        throw new Error(`Unknown op "${op}" (multiply|add|subtract|set|random)`);
    }
    if (nv === undefined) continue;
    writeValue(buf, header, chIdx, s, nv);
    if (firstValid == null) firstValid = { sample: s, time: localString(timeAt(header, s)), value: nv };
    lastValid = { sample: s, time: localString(timeAt(header, s)), value: nv };
    if (nv < lo) lo = nv;
    if (nv > hi) hi = nv;
    count++;
  }

  const minmax = updateChannelMinMax(buf, header, chIdx);
  await writeCsdFile(args.outPath, buf);

  const ch = header.channels[chIdx];
  return {
    outPath: args.outPath,
    channel: ch.logic_channel_description,
    channel_id: chIdx,
    op,
    value: args.value,
    range: { startSample, stopSample, startTime: localString(timeAt(header, startSample)), stopTime: localString(timeAt(header, stopSample)) },
    samplesModified: count,
    firstModified: firstValid,
    lastModified: lastValid,
    newChannelMinMax: minmax,
  };
}

/* ── extend ──────────────────────────────────────────────────────────────── */

/**
 * Prepend/append seconds of new samples.
 *
 * channelModes: object keyed by channel index (string number) or channel name.
 * Each entry is one of:
 *   { mode:'constant', value:number }
 *   { mode:'random',   lo:number, hi:number, seed?:number }
 *   { mode:'copyFirst'|'copyLast' }   repeat the existing boundary value
 *   { mode:'consumption' }            accumulate flowChannel (Nm³/min → per-sec flow/60)
 *                                     anchored at the existing boundary value
 * Unspecified channels default to copyFirst (prepend) / copyLast (append).
 */
export async function extend(args) {
  const { buf, header } = readCsd(args.path);
  const prepend = Math.max(0, Number(args.prependSeconds || 0));
  const append = Math.max(0, Number(args.appendSeconds || 0));
  if (prepend === 0 && append === 0) throw new Error('Nothing to do: prependSeconds and appendSeconds are both 0');

  const N = header.numSamples;
  const total = N + prepend + append;
  const oldRecordLen = header.recordLen;
  const newRecordLen = oldRecordLen;
  const newDataStart = header.dataStart; // header sizes unchanged
  const newBuf = Buffer.alloc(newDataStart + newRecordLen * total);
  buf.copy(newBuf, 0, 0, newDataStart);

  // build a plain header copy for record geometry
  const newHeader = { ...header, numSamples: total };

  const modes = {};
  for (const [key, spec] of Object.entries(args.channelModes || {})) {
    const idx = channelIndex(header, /^\d+$/.test(key) ? Number(key) : key);
    modes[idx] = typeof spec === 'string' ? { mode: spec } : spec;
  }
  const modeFor = (idx, side) => {
    const m = modes[idx];
    if (m) return m.mode;
    return side === 'prepend' ? 'copyFirst' : 'copyLast';
  };

  const flowIdx = args.flowChannel != null ? channelIndex(header, args.flowChannel) : null;

  // helper: read existing value (index in OLD file)
  const oldVal = (ch, s) => readValue(buf, header, ch, s);
  const rng = mulberry32(args.seed ?? 20260901);

  // pre-generate random/constant arrays per channel per side so consumption can use flow
  const gen = {};
  for (let c = 0; c < header.numChannels; c++) {
    gen[c] = { prepend: null, append: null };
    for (const side of ['prepend', 'append']) {
      const count = side === 'prepend' ? prepend : append;
      if (count === 0) continue;
      const m = modeFor(c, side);
      if (m === 'random') {
        const spec = modes[c];
        const lo = spec.lo == null ? 0 : Number(spec.lo);
        const hi = spec.hi == null ? 1 : Number(spec.hi);
        if (hi < lo) throw new Error(`channel ${c}: hi must be >= lo`);
        const arr = [];
        for (let i = 0; i < count; i++) arr.push(randBetween(rng, lo, hi));
        gen[c][side] = arr;
      } else if (m === 'constant') {
        gen[c][side] = new Array(count).fill(Number(modes[c].value));
      }
    }
  }

  const getVal = (ch, side, i) => {
    // returns value at new-file global index g for generated side
    const m = modeFor(ch, side);
    if (m === 'copyFirst') return oldVal(ch, 0);
    if (m === 'copyLast') return oldVal(ch, N - 1);
    if (m === 'consumption') return null; // computed later
    return gen[ch][side][i];
  };

  // consumption derivation needs the *flow* sequence across the whole new file
  let flowSeq = null;
  if (flowIdx != null) {
    flowSeq = new Float64Array(total);
    for (let s = 0; s < N; s++) flowSeq[prepend + s] = oldVal(flowIdx, s);
    for (let i = 0; i < prepend; i++) {
      const v = getVal(flowIdx, 'prepend', i);
      flowSeq[i] = v == null ? 0 : v;
    }
    for (let i = 0; i < append; i++) {
      const v = getVal(flowIdx, 'append', i);
      flowSeq[prepend + N + i] = v == null ? 0 : v;
    }
  }

  // compute consumption values for both sides (anchored at existing boundary)
  const consumption = {};
  for (let c = 0; c < header.numChannels; c++) {
    if (modeFor(c, 'prepend') === 'consumption' && prepend > 0) {
      const anchor = oldVal(c, 0); // first existing value
      const arr = new Array(prepend);
      arr[prepend - 1] = Math.round(anchor - (flowSeq ? flowSeq[prepend] : 0) / 60);
      for (let i = prepend - 2; i >= 0; i--) {
        arr[i] = Math.round(arr[i + 1] - (flowSeq ? flowSeq[i + 1] : 0) / 60);
      }
      consumption['prepend:' + c] = arr;
    }
    if (modeFor(c, 'append') === 'consumption' && append > 0) {
      const anchor = oldVal(c, N - 1); // last existing value
      const arr = new Array(append);
      arr[0] = Math.round(anchor + (flowSeq ? flowSeq[prepend + N] : 0) / 60);
      for (let i = 1; i < append; i++) {
        arr[i] = Math.round(arr[i - 1] + (flowSeq ? flowSeq[prepend + N + i] : 0) / 60);
      }
      consumption['append:' + c] = arr;
    }
  }

  // write new records
  for (let c = 0; c < header.numChannels; c++) {
    // prepend block
    for (let i = 0; i < prepend; i++) {
      const arr = consumption['prepend:' + c];
      const v = arr ? arr[i] : getVal(c, 'prepend', i);
      writeValue(newBuf, newHeader, c, i, v);
    }
    // existing block
    for (let i = 0; i < N; i++) {
      const off = newDataStart + (prepend + i) * newRecordLen;
      buf.copy(newBuf, off, header.dataStart + i * oldRecordLen, header.dataStart + (i + 1) * oldRecordLen);
    }
    // append block
    for (let i = 0; i < append; i++) {
      const arr = consumption['append:' + c];
      const v = arr ? arr[i] : getVal(c, 'append', i);
      writeValue(newBuf, newHeader, c, prepend + N + i, v);
    }
  }

  // record IDs
  for (let s = 0; s < total; s++) {
    newBuf.writeInt32BE(s, newDataStart + s * newRecordLen);
  }

  // patch protocol header
  newBuf.writeInt32BE(total, 34 + 3020);
  const newStartMs = header.startTimeMs - prepend * header.sampleIntervalSec * 1000;
  const newStopMs = header.startTimeMs + (N - 1) * header.sampleIntervalSec * 1000 + append * header.sampleIntervalSec * 1000;
  newBuf.writeBigInt64BE(BigInt(newStartMs), 34 + 3032);
  newBuf.writeBigInt64BE(BigInt(newStopMs), 34 + 3040);

  // update min/max on every channel whose values we might have changed
  const headerCopy = { ...header, numSamples: total };
  const minMax = [];
  for (let c = 0; c < header.numChannels; c++) {
    minMax.push({ channel_id: c, ...updateChannelMinMax(newBuf, headerCopy, c) });
  }

  await writeCsdFile(args.outPath, newBuf);

  return {
    outPath: args.outPath,
    prependSeconds: prepend,
    appendSeconds: append,
    old: { numSamples: N, startTime: localString(header.startTimeMs), stopTime: localString(header.stopTimeMs) },
    new: { numSamples: total, startTime: localString(newStartMs), stopTime: localString(newStopMs) },
    channelModes: Object.fromEntries(Object.entries(modes).map(([k, v]) => [k, v.mode])),
    consumptionAnchoredAt: flowIdx != null ? `flow channel=${flowIdx}` : null,
    channelMinMax: minMax,
  };
}

export { formatValue, INVALID_THRESHOLD, readRecordId };