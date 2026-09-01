/**
 * csd.js — read / write / modify SUTO CSD binary measurement files.
 *
 * Layout (big-endian throughout, from CsdAPI.js):
 *   0    – 33    File header    (34 bytes)
 *   34   – 3585  Protocol header (3552 bytes)
 *   3586 – ...   Channel headers (918 bytes × numChannels)
 *   after – end  Data records    ( (4 + numChannels*8) bytes × numSamples )
 *
 * Record: int32 recordId + float64 value per channel.
 */

import { promises as fs, readFileSync } from 'node:fs';

export const FILE_HEADER_LEN = 34;
export const PROTOCOL_HEADER_LEN = 3552;
export const CHANNEL_HEADER_LEN = 918;
export const RECORD_ID_LEN = 4;
export const CHANNEL_VALUE_LEN = 8;

export const DATA_INVALID = -9999;
export const DATA_OVERRANGE = -8888;
export const DATA_SENSOR_CHANGE = -8887;
export const DATA_UNIT_CHANGE = -8886;
// any value <= DATA_OVERRANGE is treated as non-measurement
export const INVALID_THRESHOLD = DATA_OVERRANGE;

const PROTOCOL_HEADER_START = FILE_HEADER_LEN;
const CHANNEL_HEADERS_START = PROTOCOL_HEADER_START + PROTOCOL_HEADER_LEN;

function decodeStr(buf, offset, maxLen) {
  let end = offset;
  while (end < offset + maxLen && end < buf.length && buf[end] !== 0) end++;
  return buf.subarray(offset, end).toString('utf8').trim();
}

function encodeStr(str, maxLen) {
  const b = Buffer.alloc(maxLen);
  const raw = Buffer.from(String(str ?? ''), 'utf8');
  raw.copy(b, 0, 0, Math.min(raw.length, maxLen - 1));
  return b;
}

export function parseHeader(buf) {
  const ph = buf.subarray(PROTOCOL_HEADER_START, PROTOCOL_HEADER_START + PROTOCOL_HEADER_LEN);
  let numChannels = ph.readInt32BE(3016);
  let numSamples = ph.readInt32BE(3020);
  const sampleIntervalSec = ph.readInt32BE(3024) > 0 ? ph.readInt32BE(3024) : 1;
  const startTimeMs = Number(ph.readBigInt64BE(3032));
  const stopTimeMs = Number(ph.readBigInt64BE(3040));

  const maxChannels = Math.max(1, Math.floor(buf.length / CHANNEL_HEADER_LEN));
  if (numChannels <= 0 || numChannels > maxChannels) numChannels = 1;

  const recordLen = RECORD_ID_LEN + numChannels * CHANNEL_VALUE_LEN;
  const maxSamples = Math.floor(buf.length / recordLen);
  if (numSamples < 0 || numSamples > maxSamples) numSamples = 0;

  const channels = [];
  const deviceName = decodeStr(ph, 506, 32);
  for (let i = 0; i < numChannels; i++) {
    const ch = buf.subarray(CHANNEL_HEADERS_START + i * CHANNEL_HEADER_LEN, CHANNEL_HEADERS_START + (i + 1) * CHANNEL_HEADER_LEN);
    const pref = Number(ch.readBigInt64BE(0));
    const descLen = ch.readInt16BE(8);
    const desc = decodeStr(ch, 10, Math.min(Math.max(descLen, 0), 126)) || `Channel ${i}`;
    const subLen = ch.readInt16BE(138);
    const subDesc = decodeStr(ch, 140, Math.min(Math.max(subLen, 0), 126));
    const devLen = ch.readInt16BE(268);
    const senLen = ch.readInt16BE(289);
    const senDesc = decodeStr(ch, 291, Math.min(Math.max(senLen, 0), 17)) || desc;
    const FP = 788; // 780 + 4 + 4
    const unitLen = ch.readInt16BE(FP);
    const unitText = decodeStr(ch, FP + 2, Math.min(Math.max(unitLen, 0), 56));
    const statsBase = FP + 60;
    const resolution = ch.readInt32BE(statsBase);
    const minVal = ch.readDoubleBE(statsBase + 4);
    const maxVal = ch.readDoubleBE(statsBase + 12);
    const sensorId = ch.readInt32BE(statsBase + 28);

    channels.push({
      channel_id: i,
      pref,
      logic_channel_description: desc,
      physical_channel_description: desc,
      sensor_description: senDesc,
      sub_device_description: subDesc,
      device_desc_length: devLen,
      unit_in_ascii: unitText,
      resolution,
      _min: Number.isFinite(minVal) ? minVal : 0,
      _max: Number.isFinite(maxVal) ? maxVal : 0,
      sensor_id: sensorId || i,
    });
  }

  const dataStart = CHANNEL_HEADERS_START + numChannels * CHANNEL_HEADER_LEN;
  return {
    version: buf.readInt32BE(0),
    fileHeaderLen: FILE_HEADER_LEN,
    deviceName,
    numChannels,
    numSamples,
    sampleIntervalSec,
    sampleRateHz: 1 / sampleIntervalSec,
    startTimeMs,
    stopTimeMs,
    channels,
    dataStart,
    recordLen,
  };
}

export function readCsd(path) {
  const buf = readFileSync(path);
  const header = parseHeader(buf);
  return { buf, header };
}

function sampleOffset(header, sampleIdx) {
  return header.dataStart + sampleIdx * header.recordLen;
}

export function readValue(buf, header, chIdx, sampleIdx) {
  const off = sampleOffset(header, sampleIdx) + RECORD_ID_LEN + chIdx * CHANNEL_VALUE_LEN;
  return buf.readDoubleBE(off);
}

export function writeValue(buf, header, chIdx, sampleIdx, value) {
  const off = sampleOffset(header, sampleIdx) + RECORD_ID_LEN + chIdx * CHANNEL_VALUE_LEN;
  buf.writeDoubleBE(value, off);
}

export function readRecordId(buf, header, sampleIdx) {
  return buf.readInt32BE(sampleOffset(header, sampleIdx));
}

export function readRecord(buf, header, sampleIdx) {
  const off = sampleOffset(header, sampleIdx);
  const values = [];
  for (let c = 0; c < header.numChannels; c++) {
    values.push(buf.readDoubleBE(off + RECORD_ID_LEN + c * CHANNEL_VALUE_LEN));
  }
  return { recordId: buf.readInt32BE(off), values };
}

export function writeRecord(buf, header, sampleIdx, recordId, values) {
  const off = sampleOffset(header, sampleIdx);
  buf.writeInt32BE(recordId, off);
  for (let c = 0; c < header.numChannels; c++) {
    buf.writeDoubleBE(values[c], off + RECORD_ID_LEN + c * CHANNEL_VALUE_LEN);
  }
}

/** time (epoch ms) → sample index (clamped) */
export function sampleFromTime(header, timeMs) {
  if (!(timeMs > 0)) return 0;
  const idx = Math.round((timeMs - header.startTimeMs) / 1000 / header.sampleIntervalSec);
  return Math.max(0, Math.min(idx, header.numSamples - 1));
}

export function parseTime(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    if (Number.isNaN(t)) throw new Error(`Cannot parse time "${value}"`);
    return t;
  }
  throw new Error('time must be epoch ms (number) or an ISO/local date string');
}

export function channelIndex(header, channel) {
  if (typeof channel === 'number') {
    if (channel < 0 || channel >= header.numChannels) throw new Error(`Channel index ${channel} out of range (0..${header.numChannels - 1})`);
    return channel;
  }
  const name = String(channel).toLowerCase();
  const idx = header.channels.findIndex(c => c.logic_channel_description.toLowerCase() === name);
  if (idx === -1) {
    const match = header.channels.findIndex(c => c.logic_channel_description.toLowerCase().includes(name));
    if (match === -1) throw new Error(`Channel "${channel}" not found`);
    return match;
  }
  return idx;
}

export function isMeasurement(v) {
  return v > INVALID_THRESHOLD;
}

export function formatValue(v) {
  return isMeasurement(v) ? v : null;
}

export function isoString(ms) {
  return new Date(ms).toISOString();
}

export function localString(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function firstRows(buf, header, n = 5) {
  const out = [];
  const count = Math.min(n, header.numSamples);
  for (let i = 0; i < count; i++) {
    const { recordId, values } = readRecord(buf, header, i);
    out.push({
      sample: i,
      recordId,
      timeMs: header.startTimeMs + i * header.sampleIntervalSec * 1000,
      time: localString(header.startTimeMs + i * header.sampleIntervalSec * 1000),
      values: values.map(formatValue),
    });
  }
  return out;
}

export function lastRows(buf, header, n = 5) {
  const out = [];
  const count = Math.min(n, header.numSamples);
  for (let i = header.numSamples - count; i < header.numSamples; i++) {
    const { recordId, values } = readRecord(buf, header, i);
    out.push({
      sample: i,
      recordId,
      timeMs: header.startTimeMs + i * header.sampleIntervalSec * 1000,
      time: localString(header.startTimeMs + i * header.sampleIntervalSec * 1000),
      values: values.map(formatValue),
    });
  }
  return out;
}

/** Recompute and write a channel's real min/max into its header (whole file). */
export function updateChannelMinMax(buf, header, chIdx) {
  let mn = Infinity;
  let mx = -Infinity;
  for (let s = 0; s < header.numSamples; s++) {
    const v = readValue(buf, header, chIdx, s);
    if (!isMeasurement(v)) continue;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const chBase = CHANNEL_HEADERS_START + chIdx * CHANNEL_HEADER_LEN;
  const statsBase = 788 + 60;
  if (Number.isFinite(mn)) {
    buf.writeDoubleBE(mn, chBase + statsBase + 4);
    buf.writeDoubleBE(mx, chBase + statsBase + 12);
  }
  return { min: Number.isFinite(mn) ? mn : 0, max: Number.isFinite(mx) ? mx : 0 };
}

/** Serialize a parsed model + data records back to a full CSD buffer. */
export function buildBuffer(header, records) {
  const dataStart = CHANNEL_HEADERS_START + header.numChannels * CHANNEL_HEADER_LEN;
  const recordLen = RECORD_ID_LEN + header.numChannels * CHANNEL_VALUE_LEN;
  const buf = Buffer.alloc(dataStart + recordLen * records.length);
  buf.fill(0);
  buf.writeInt32BE(header.version, 0);
  const phStart = PROTOCOL_HEADER_START;
  buf.write(header.deviceName || '', phStart + 506, 32, 'utf8');
  buf.writeInt32BE(header.numChannels, phStart + 3016);
  buf.writeInt32BE(records.length, phStart + 3020);
  buf.writeInt32BE(header.sampleIntervalSec, phStart + 3024);
  buf.writeBigInt64BE(BigInt(header.startTimeMs), phStart + 3032);
  buf.writeBigInt64BE(BigInt(header.stopTimeMs), phStart + 3040);
  for (let i = 0; i < header.numChannels; i++) {
    writeChannelHeader(buf, header, i);
  }
  for (let s = 0; s < records.length; s++) {
    const off = dataStart + s * recordLen;
    buf.writeInt32BE(s, off);
    for (let c = 0; c < header.numChannels; c++) {
      buf.writeDoubleBE(records[s][c], off + RECORD_ID_LEN + c * CHANNEL_VALUE_LEN);
    }
  }
  return buf;
}

function writeChannelHeader(buf, header, chIdx) {
  const ch = header.channels[chIdx];
  const base = CHANNEL_HEADERS_START + chIdx * CHANNEL_HEADER_LEN;
  buf.writeBigInt64BE(BigInt(ch.pref || 0), base);
  writeField(base + 8, ch.logic_channel_description, 126);
  writeField(base + 138, ch.sub_device_description, 126);
  writeField(base + 268, '', 0);
  writeField(base + 289, ch.sensor_description, 17);
  const FP = 788;
  writeField(base + FP, ch.unit_in_ascii, 56);
  const statsBase = base + FP + 60;
  buf.writeInt32BE(ch.resolution || 0, statsBase);
  buf.writeDoubleBE(Number.isFinite(ch._min) ? ch._min : 0, statsBase + 4);
  buf.writeDoubleBE(Number.isFinite(ch._max) ? ch._max : 0, statsBase + 12);
  buf.writeInt32BE(ch.sensor_id || chIdx, statsBase + 28);

  function writeField(off, text, maxTextLen) {
    const b = encodeStr(text, maxTextLen);
    buf.writeInt16BE(b.length, off);
    b.copy(buf, off + 2);
  }
}

export async function writeCsdFile(path, buf) {
  await fs.writeFile(path, buf);
}

export async function readCsdFile(path) {
  const b = await fs.readFile(path);
  return { buf: b, header: parseHeader(b) };
}

// silence unused warnings for helpers kept for API parity
export { encodeStr, decodeStr };