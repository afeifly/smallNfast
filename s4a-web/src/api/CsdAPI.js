/**
 * CsdAPI.js
 *
 * Pure-JavaScript drop-in replacement for the former Dart/Wasm CSD parser.
 * No build step required — works in every modern browser.
 *
 * Features:
 *   - Lazy slice-based reading: only the header bytes (+tiny data windows) are
 *     ever loaded into memory.  A 10 GB file uses ~10 KB of RAM at rest.
 *   - File System Access API (Chrome / Edge): persists a FileSystemFileHandle
 *     in IndexedDB so the user can reload previously-opened files with one
 *     permission click instead of opening the OS picker again.
 *   - Graceful fallback: on Safari / Firefox the classic <input type="file">
 *     is used; the rest of the app is unaffected.
 *
 * CSD binary layout (big-endian throughout):
 *   0        – 33    File header    (34 bytes)
 *   34       – 3585  Protocol header (3552 bytes)
 *   3586     – ...   Channel headers (918 bytes × numChannels)
 *   after CH – end   Data records   ( (4 + numChannels*8) bytes × numSamples )
 *
 * API surface is identical to MockAPI.js.
 */

import CsvAPI from './CsvAPI';

// ── Constants ─────────────────────────────────────────────────────────────────

const FILE_HEADER_LEN = 34;
const PROTOCOL_HEADER_LEN = 3552;
const CHANNEL_HEADER_LEN = 918;
const RECORD_ID_LEN = 4;
const CHANNEL_VALUE_LEN = 8;    // float64

const DATA_INVALID = -9999;
const DATA_OVERRANGE = -8888;
const DATA_SENSOR_CHANGE = -8887;
const DATA_UNIT_CHANGE = -8886;

const PROTOCOL_HEADER_START = FILE_HEADER_LEN;
const CHANNEL_HEADERS_START = PROTOCOL_HEADER_START + PROTOCOL_HEADER_LEN;  // 3586

const MAX_DISPLAY_SAMPLES = 3000;

// Device types (mirrors NProtocolHeader) used for channel-name assembly
const DEVICE_TYPE = {
  DS350_P2: 0x1060,
  DS350_P4: 0x1061,
  DS350_P6: 0x1062,
  S330: 0x1064,
  S331: 0x1065,
  S551_P4: 0x1066,
  S551_P6: 0x1067,
  S551_P4_IHI: 0x109A,
  S551_P6_IHI: 0x109B,
  MODBUS_POWERMETER: 0x3510,
  MODBUS_PULSE_ANALOGUE: 0x3530,
  MODBUS_ANALOG_INPUT: 0x3500,
  MODBUS_S331: 0x3331,
  MODBUS_S330: 0x3329,
};

// Protocol / channel header field offsets (see CSLib NProtocolHeader / NChannelHeader)
const PROTOCOL_DEVICE_ID = 8;
const PROTOCOL_DEVICE_TYPE = 3060;
const CH_NEW_DEVICE_ID = 868;
const CH_SUB_DEVICE_ID = 872;
const CH_SENSOR_ID = 876;
const CH_SLAVE_ADDRESS = 885;

// IndexedDB database name / store for file handles
const IDB_NAME = 'CsdFilesDB';
const IDB_STORE = 'fileHandles';

// ── Module state ──────────────────────────────────────────────────────────────

let _file = null;   // File | FileSystemFileHandle — kept open for lazy reads
let _fileLoaded = false;
let _isCsvMode = false;
let _channels = [];
let _startTimeMs = 0;
let _stopTimeMs = 0;
let _sampleRate = 1;      // Hz (computed)
let _numSamples = 0;
let _numChannels = 0;
let _dataStart = 0;      // byte offset where records begin
let _recordLen = 0;      // bytes per record
let _deviceName = 'CSD Device';
let _deviceId = 0;
let _deviceType = 0;
let _fileVersion = 0;
let _sampleIntervalSec = 1;
let _fileBuffer = null;   // Fully loaded file ArrayBuffer for zero-copy sync memory reads

// Multi-file session: parsed records for every file in the current session.
// When > 1 file is present, the public accessors expose a merged "virtual file".
let _files = [];
let _merged = null;   // { channels, channelMap, startMs, stopMs, gridSec, numSamples, intervalMs }
let _appendMode = false;  // classic <input> fallback: next selection appends instead of replaces

let _onFileLoadedCallbacks = [];

// Large-CSV pre-load prompt
let _largeCsvResolve = null;     // Promise resolver, set while dialog is open
let _pendingCsdConvert = false;  // true after user chose "Convert to CSD"

// Classic <input> fallback
let _fileInput = null;

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function _openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function _idbPut(key, value) {
  try {
    const db = await _openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = e => reject(e.target.error);
    });
  } catch (e) {
    console.warn('[CsdAPI] IDB put failed:', e);
  }
}

async function _idbGet(key) {
  try {
    const db = await _openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = e => reject(e.target.error);
    });
  } catch (e) {
    console.warn('[CsdAPI] IDB get failed:', e);
    return undefined;
  }
}

async function _idbDelete(key) {
  try {
    const db = await _openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = e => reject(e.target.error);
    });
  } catch (e) {
    console.warn('[CsdAPI] IDB delete failed:', e);
  }
}

async function _idbGetAll() {
  try {
    const db = await _openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAllKeys();
      req.onsuccess = async e => {
        const keys = e.target.result;
        const entries = [];
        for (const key of keys) {
          const handle = await _idbGet(key);
          if (handle) entries.push({ key, handle });
        }
        resolve(entries);
      };
      req.onerror = e => reject(e.target.error);
    });
  } catch (e) {
    return [];
  }
}

// ── Byte-reading helpers ──────────────────────────────────────────────────────

/** Read exactly `length` bytes starting at `offset` from a File object. */
async function _readSlice(file, offset, length, buffer) {
  const buf = buffer === undefined ? _fileBuffer : buffer;
  if (buf) {
    return new DataView(buf, offset, length);
  }
  const blob = file.slice(offset, offset + length);
  const bufferData = await blob.arrayBuffer();
  return new DataView(bufferData);
}

/** Slice-based read against a parsed file record (carries its own buffer/slice source). */
function _fileSlice(fileRec, offset, length) {
  if (fileRec.fileBuffer) {
    return Promise.resolve(new DataView(fileRec.fileBuffer, offset, length));
  }
  const blob = fileRec.file.slice(offset, offset + length);
  return blob.arrayBuffer().then(b => new DataView(b));
}

/** Greatest common divisor of two integers (>= 1). */
function _gcd(a, b) {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) { const t = a % b; a = b; b = t; }
  return a || 1;
}

/** Decode null-terminated UTF-8 from a subarray of a DataView's buffer. */
function _decodeStr(dv, byteOffset, maxLen) {
  const safeLen = Math.max(0, maxLen);
  if (safeLen <= 0) return '';
  const start = dv.byteOffset + byteOffset;
  const available = dv.buffer.byteLength - start;
  const len = Math.min(safeLen, available);
  if (len <= 0) return '';

  const bytes = new Uint8Array(dv.buffer, start, len);
  let end = 0;
  while (end < bytes.length && bytes[end] !== 0) end++;
  try {
    return new TextDecoder('utf-8').decode(bytes.subarray(0, end)).trim();
  } catch {
    return '';
  }
}

// ── Core parser ───────────────────────────────────────────────────────────────

/**
 * Terminal prefix for a sensor (IGEF branch). Mirrors CommonValue.getViewChannelFullName.
 */
function _terminalForSensor(sensorID, deviceType) {
  const isS330 = deviceType === DEVICE_TYPE.S330 || deviceType === DEVICE_TYPE.S331;
  if (sensorID > 100) {
    const s = sensorID - 100;
    if (s > 14) return 'V:';
    switch (s) {
      case 1: return '1:';
      case 2: return '2:';
      case 3: return '3:';
      case 4: return '4:';
      case 5: return '5:';
      case 6: return '6:';
      default: return '';
    }
  }
  if (sensorID > 14) return 'V:';
  switch (sensorID) {
    case 1: return isS330 ? 'A:' : 'I:';
    case 2: return isS330 ? 'B:' : 'G:';
    case 3: return 'E:';
    case 4: return 'F:';
    default: return '';
  }
}

/**
 * Full channel display name, e.g. "8609_3:1000 A Sensor/1000 A Sensor (A)".
 * Ported from CommonValue.getViewChannelFullName (reference CANalyzer build),
 * with the device-id prefix limited to its last 4 digits.
 */
function _buildFullChannelName(pheader, ch) {
  const desc = ch.description;
  if (desc == null) return '';
  const unit = ch.unit || '';

  if (ch.newDeviceID <= 0) {
    return `${desc.trim()} (${unit})`;
  }

  const idString = String(pheader.deviceId || '');
  const idTail = idString.length > 4 ? idString.slice(-4) : idString;
  const prefix = idTail ? `${idTail}_` : '';

  if (ch.subDeviceID === 0) {
    const tmp = _terminalForSensor(ch.sensorID, pheader.deviceType);
    return `${prefix}${tmp}${ch.sensorDescription}/${desc} (${unit})`;
  }

  let modbusTerminal;
  if (pheader.deviceType === DEVICE_TYPE.DS350_P2
    || pheader.deviceType === DEVICE_TYPE.DS350_P4
    || pheader.deviceType === DEVICE_TYPE.DS350_P6) {
    modbusTerminal = '7/8';
  } else if (pheader.deviceType === DEVICE_TYPE.S330
    || pheader.deviceType === DEVICE_TYPE.S331
    || pheader.deviceType === DEVICE_TYPE.S551_P4
    || pheader.deviceType === DEVICE_TYPE.S551_P6
    || pheader.deviceType === DEVICE_TYPE.S551_P4_IHI
    || pheader.deviceType === DEVICE_TYPE.S551_P6_IHI) {
    modbusTerminal = 'M';
  } else {
    modbusTerminal = 'D';
  }

  if (ch.subDeviceID > 32768) {
    let tmp = '';
    if (ch.sensorID > 100) {
      switch (ch.sensorID - 100) {
        case 1: tmp = '1:'; break;
        case 2: tmp = '2:'; break;
        case 3: tmp = '3:'; break;
        case 4: tmp = '4:'; break;
        case 5: tmp = '5:'; break;
        case 6: tmp = '6:'; break;
        default: break;
      }
    } else {
      let modbusDeviceID = ch.subDeviceID;
      if (modbusDeviceID > 32768) modbusDeviceID -= 32768;
      modbusDeviceID -= ch.slaveAddress;
      if (modbusDeviceID === DEVICE_TYPE.MODBUS_POWERMETER) {
        return `${prefix}${modbusTerminal}:.../${ch.sensorDescription}/${desc} (${unit})`;
      }
      if (modbusDeviceID === DEVICE_TYPE.MODBUS_ANALOG_INPUT
        || modbusDeviceID === DEVICE_TYPE.MODBUS_PULSE_ANALOGUE) {
        return `${prefix}${modbusTerminal}:${ch.subDeviceDescription}/${ch.sensorDescription}/${desc} (${unit})`;
      }
      const isModbusS33x = modbusDeviceID === DEVICE_TYPE.MODBUS_S330 || modbusDeviceID === DEVICE_TYPE.MODBUS_S331;
      switch (ch.sensorID) {
        case 1: tmp = isModbusS33x ? 'A' : 'I'; break;
        case 2: tmp = isModbusS33x ? 'B' : 'G'; break;
        case 3: tmp = 'E'; break;
        case 4: tmp = 'F'; break;
        default:
          return `${prefix}${modbusTerminal}:${ch.subDeviceDescription}(${tmp})/${ch.sensorDescription}/${desc} (${unit})`;
      }
    }
    return `${prefix}${modbusTerminal}:${ch.subDeviceDescription}(${tmp})/${ch.sensorDescription}/${desc} (${unit})`;
  }

  return `${prefix}${modbusTerminal}:.../${ch.sensorDescription}/${desc} (${unit})`;
}

/**
 * Parse file / protocol / channel headers from `file` (File object or
 * anything with a `.slice(start,end)` → Blob interface).
 * Fills `target` with the parsed header info; does NOT read sample data.
 */
async function _parseHeaders(file, target, buffer) {
  const slice = (off, len) => _readSlice(file, off, len, buffer);

  // ── File info header (34 bytes starting at byte 0) ──
  try {
    const fh = await slice(0, FILE_HEADER_LEN);
    const version = fh.getInt32(0, false);
    target.fileVersion = version;
    const identifier = _decodeStr(fh, 4, 10);
    console.log(`[CsdAPI] File Info Header parsed - Version: ${version}, Identifier: "${identifier}"`);
    
    if (version < 1 || version > 100 || !identifier.includes('SUTO CSD')) {
      console.warn(`[CsdAPI] Warning: Possibly invalid CSD file signature (Version: ${version}, Identifier: "${identifier}")`);
    }
  } catch (err) {
    console.warn('[CsdAPI] Failed to parse File Info Header:', err);
  }

  // ── Protocol header (3552 bytes starting at byte 34) ──
  const ph = await slice(PROTOCOL_HEADER_START, PROTOCOL_HEADER_LEN);

  target.deviceName = _decodeStr(ph, 506, 32) || 'CSD Device';
  target.deviceId = ph.getInt32(PROTOCOL_DEVICE_ID, false) || 0;
  target.deviceType = ph.getInt16(PROTOCOL_DEVICE_TYPE, false) || 0;

  let rawChannels = ph.getInt32(3016, false);
  let rawSamples = ph.getInt32(3020, false);
  const sampleRateRaw = ph.getInt32(3024, false);

  const fileSize = file.size || 0;

  // Channel count — bounded by how many 918-byte headers fit after the protocol header
  if (fileSize > 0) {
    const maxPossibleChannels = Math.max(1, Math.floor((fileSize - CHANNEL_HEADERS_START) / CHANNEL_HEADER_LEN));
    if (rawChannels <= 0 || rawChannels > maxPossibleChannels) {
      console.warn(`[CsdAPI] Invalid channel count (${rawChannels}). Defaulting to 9.`);
      rawChannels = 9;
    }
  } else if (rawChannels <= 0) {
    rawChannels = 9;
  }
  target.numChannels = rawChannels;

  // Data record geometry (needed to derive the real sample count)
  target.dataStart = CHANNEL_HEADERS_START + target.numChannels * CHANNEL_HEADER_LEN;
  target.recordLen = RECORD_ID_LEN + target.numChannels * CHANNEL_VALUE_LEN;

  // Sample count — repair it from the file size when the header is missing/inconsistent.
  // Some CSD files carry a wrong (0 or stale) sample count; derive the truth from the bytes.
  let computedSamples = 0;
  if (fileSize > target.dataStart && target.recordLen > 0) {
    computedSamples = Math.floor((fileSize - target.dataStart) / target.recordLen);
  }
  if (fileSize > 0 && target.recordLen > 0) {
    if (rawSamples <= 0 || Math.abs(rawSamples - computedSamples) > 1) {
      console.warn(`[CsdAPI] Header sample count (${rawSamples}) inconsistent with file size; using ${computedSamples}.`);
      rawSamples = computedSamples;
    }
  } else if (rawSamples < 0) {
    rawSamples = 0;
  }
  target.numSamples = rawSamples;

  let rawStart = Number(ph.getBigInt64(3032, false));
  let rawStop = Number(ph.getBigInt64(3040, false));

  const MAX_TS = 8640000000000000;
  if (Math.abs(rawStart) > MAX_TS) rawStart = 0;
  if (Math.abs(rawStop) > MAX_TS) rawStop = 0;

  target.sampleIntervalSec = sampleRateRaw > 0 ? sampleRateRaw : 1;
  target.sampleRate = 1 / target.sampleIntervalSec;

  target.startTimeMs = rawStart > 0 ? rawStart : Date.now() - 3600000;

  // Stop time — trust the header only when it is valid and consistent with the (repaired)
  // sample count; otherwise derive it from start + samples × interval.
  const computedStop = target.startTimeMs + target.numSamples * target.sampleIntervalSec * 1000;
  if (rawStop > 0 && rawStop >= target.startTimeMs
    && Math.abs(rawStop - computedStop) <= target.sampleIntervalSec * 1000 * 2) {
    target.stopTimeMs = rawStop;
  } else {
    target.stopTimeMs = computedStop;
  }

  // ── Channel headers (918 bytes each) ──
  target.channels = [];
  for (let i = 0; i < target.numChannels; i++) {
    const chStart = CHANNEL_HEADERS_START + i * CHANNEL_HEADER_LEN;
    const ch = await slice(chStart, CHANNEL_HEADER_LEN);

    // pref = int64 at byte 0
    const pref = Number(ch.getBigInt64(0, false));

    // Channel description: int16 length + up to 128 bytes at offset 8
    const descLen = ch.getInt16(8, false);
    const desc = _decodeStr(ch, 10, Math.min(descLen, 126)) || `Channel ${i}`;

    // Sub-device desc: length at 8+2+128 = 138
    const subLen = ch.getInt16(138, false);
    const subDesc = _decodeStr(ch, 140, Math.min(subLen, 126));

    // Device desc: at 138+2+128 = 268 
    const devLen = ch.getInt16(268, false);
    const devDesc = _decodeStr(ch, 270, Math.min(devLen, 19));
    // Sensor desc: at 268+2+19 = 289
    const senLen = ch.getInt16(289, false);
    const senDesc = _decodeStr(ch, 291, Math.min(senLen, 17)) || desc;

    // unit text: fixed-position area starting at fieldPos=752
    // fieldPos after skipping 470 reserved bytes starting at 289+2+19=310 → 310+470=780
    // then channelNumber(4)+unit(4) = 788, then unitTextLen(2)+text
    const FP = 780 + 4 + 4; // = 788
    const unitLen = ch.getInt16(FP, false);
    const unitText = _decodeStr(ch, FP + 2, Math.min(unitLen, 56)) || '';

    // min/max follow at FP+2+58 = FP+60
    const statsBase = FP + 60;
    // resolution(4) + min(8) + max(8)
    const minVal = ch.getFloat64(statsBase + 4, false);
    const maxVal = ch.getFloat64(statsBase + 12, false);

    const resolution = ch.getInt32(statsBase, false);

    const newDeviceID = ch.getInt32(CH_NEW_DEVICE_ID, false);
    const subDeviceID = ch.getInt32(CH_SUB_DEVICE_ID, false);
    const sensorID = ch.getInt32(CH_SENSOR_ID, false);
    const slaveAddress = target.fileVersion > 4 ? ch.getInt8(CH_SLAVE_ADDRESS) : 0;

    const fullName = _buildFullChannelName(
      { deviceId: target.deviceId, deviceType: target.deviceType },
      {
        description: desc,
        unit: unitText,
        newDeviceID,
        subDeviceID,
        sensorID,
        slaveAddress,
        sensorDescription: senDesc,
        subDeviceDescription: subDesc,
      }
    );

    target.channels.push({
      channel_id: i,
      location_id: 1,
      sensor_id: sensorID || i,
      pref,
      new_device_id: newDeviceID,
      sub_device_id: subDeviceID,
      slave_address: slaveAddress,
      device_description: devDesc,
      logic_channel_description: desc,
      physical_channel_description: desc,
      sensor_description: senDesc,
      unit_in_ascii: unitText,
      full_channel_name: fullName,
      _min: isFinite(minVal) ? minVal : 0,
      _max: isFinite(maxVal) ? maxVal : 0,
      resolution: isFinite(resolution) ? resolution : 0,
    });
  }

  console.log(`[CsdAPI] Parsed ${target.numChannels} channels, ${target.numSamples} samples @ ${target.sampleRate.toFixed(3)} Hz`);
  console.log(`[CsdAPI] Time range: ${new Date(target.startTimeMs).toISOString()} → ${new Date(target.stopTimeMs).toISOString()}`);
  console.log('[CsdAPI] Channels:', target.channels.map(c => `[${c.channel_id}] "${c.logic_channel_description}" (${c.unit_in_ascii})`));

  return target;
}

/**
 * Lazy read: fetch only the float64 values for `chIdx` in sample range
 * [startSample, endSample] with stride `step`.
 * Each record is `_recordLen` bytes; the channel value sits at:
 *   record_offset + RECORD_ID_LEN + chIdx * 8
 */
async function _readChannelData(file, chIdx, startSample, endSample, step) {
  const values = [];
  const chByteOffset = RECORD_ID_LEN + chIdx * CHANNEL_VALUE_LEN;

  const totalRecords = endSample - startSample + 1;
  const spanBytes = totalRecords * _recordLen;

  // In-memory synchronous fast path: zero copies, zero async overhead
  if (_fileBuffer) {
    const dv = new DataView(_fileBuffer);
    const stepBytes = step * _recordLen;
    let recordStart = _dataStart + startSample * _recordLen;
    for (let s = startSample; s <= endSample; s += step) {
      const v = dv.getFloat64(recordStart + chByteOffset, false);
      values.push((v <= DATA_OVERRANGE) ? null : v);
      recordStart += stepBytes;
    }
    return values;
  }

  // Fallback for native files (lazy loaded/not in memory)
  // Optimization 1: If the byte span is small (< 50MB), read the entire block at once
  if (spanBytes < 50 * 1024 * 1024) {
    const recordStart = _dataStart + startSample * _recordLen;
    const dv = await _readSlice(file, recordStart, spanBytes);
    for (let s = 0; s < totalRecords; s += step) {
      const recordOffset = s * _recordLen;
      const v = dv.getFloat64(recordOffset + chByteOffset, false);
      values.push((v <= DATA_OVERRANGE) ? null : v);
    }
    return values;
  }

  // Optimization 2: For massive ranges, read sampled points in batches of 100 to prevent locking up browser I/O
  const batchSize = 100;
  for (let s = startSample; s <= endSample; s += step * batchSize) {
    const promises = [];
    const batchEnd = Math.min(endSample, s + step * (batchSize - 1));
    for (let curr = s; curr <= batchEnd; curr += step) {
      const recordStart = _dataStart + curr * _recordLen;
      promises.push(_readSlice(file, recordStart + chByteOffset, CHANNEL_VALUE_LEN));
    }
    const slices = await Promise.all(promises);
    for (const dv of slices) {
      const v = dv.getFloat64(0, false);
      values.push((v <= DATA_OVERRANGE) ? null : v);
    }
  }
  return values;
}

/**
 * Lazy read of one channel's float64 values from a parsed file record
 * (used by the merged multi-file session). Mirrors `_readChannelData`.
 */
async function _readFileChannelData(fileRec, chIdx, startSample, endSample, step) {
  const values = [];
  const chByteOffset = RECORD_ID_LEN + chIdx * CHANNEL_VALUE_LEN;
  const totalRecords = endSample - startSample + 1;
  const spanBytes = totalRecords * fileRec.recordLen;

  if (fileRec.fileBuffer) {
    const dv = new DataView(fileRec.fileBuffer);
    let recordStart = fileRec.dataStart + startSample * fileRec.recordLen;
    for (let s = startSample; s <= endSample; s += step) {
      const v = dv.getFloat64(recordStart + chByteOffset, false);
      values.push((v <= DATA_OVERRANGE) ? null : v);
      recordStart += step * fileRec.recordLen;
    }
    return values;
  }

  if (spanBytes < 50 * 1024 * 1024) {
    const dv = await _fileSlice(fileRec, fileRec.dataStart + startSample * fileRec.recordLen, spanBytes);
    for (let s = 0; s < totalRecords; s += step) {
      const recordOffset = s * fileRec.recordLen;
      const v = dv.getFloat64(recordOffset + chByteOffset, false);
      values.push((v <= DATA_OVERRANGE) ? null : v);
    }
    return values;
  }

  const batchSize = 100;
  for (let s = startSample; s <= endSample; s += step * batchSize) {
    const promises = [];
    const batchEnd = Math.min(endSample, s + step * (batchSize - 1));
    for (let curr = s; curr <= batchEnd; curr += step) {
      const recordStart = fileRec.dataStart + curr * fileRec.recordLen;
      promises.push(_fileSlice(fileRec, recordStart + chByteOffset, CHANNEL_VALUE_LEN));
    }
    const slices = await Promise.all(promises);
    for (const dv of slices) {
      const v = dv.getFloat64(0, false);
      values.push((v <= DATA_OVERRANGE) ? null : v);
    }
  }
  return values;
}

/**
 * Read a contiguous page of channel values from one file record.
 * Returns { s0, values: { channelId: Float64Array } } where s0 is the sample
 * index of the first element (so callers can map grid time → array index).
 */
async function _readFileChannelsPage(fileRec, chans, s0, s1) {
  const count = Math.max(0, s1 - s0 + 1);
  const out = {};
  if (count <= 0) return { s0, values: out };
  const byteLength = count * fileRec.recordLen;
  const offset = fileRec.dataStart + s0 * fileRec.recordLen;
  const dv = await _fileSlice(fileRec, offset, byteLength);
  for (const c of chans) {
    const arr = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      const v = dv.getFloat64(i * fileRec.recordLen + RECORD_ID_LEN + c.localIdx * CHANNEL_VALUE_LEN, false);
      arr[i] = (v <= DATA_OVERRANGE) ? NaN : v;
    }
    out[c.id] = arr;
    if (c.key) out[c.key] = arr;
  }
  return { s0, values: out };
}

// Helper to load large files chunk-by-chunk and report real progress
async function _readArrayBufferWithProgress(file, onProgress) {
  const size = file.size;
  const chunkSize = 4 * 1024 * 1024; // 4MB chunks
  let offset = 0;
  const chunks = [];
  
  while (offset < size) {
    const end = Math.min(offset + chunkSize, size);
    const slice = file.slice(offset, end);
    const buffer = await slice.arrayBuffer();
    chunks.push(new Uint8Array(buffer));
    offset = end;
    if (onProgress) {
      onProgress(offset / size);
    }
  }
  
  const fullBuffer = new Uint8Array(size);
  let writeOffset = 0;
  for (const chunk of chunks) {
    fullBuffer.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }
  return fullBuffer.buffer;
}

// ── File-load entry point ─────────────────────────────────────────────────────

/** Buffer a file fully when it is small enough; returns { file, fileBuffer }. */
async function _bufferFileIfSmall(file) {
  const LIMIT = 800 * 1024 * 1024; // 800 MB
  if (file && file.size && file.size < LIMIT && typeof file.arrayBuffer === 'function') {
    try {
      const fullBuffer = await _readArrayBufferWithProgress(file);
      const wrapped = {
        name: file.name,
        size: file.size,
        slice(start, end) {
          const sliced = fullBuffer.slice(start, end);
          return { arrayBuffer: async () => sliced };
        }
      };
      return { file: wrapped, fileBuffer: fullBuffer };
    } catch (e) {
      console.warn('[CsdAPI] Failed to buffer file for append, falling back to lazy load:', e);
    }
  }
  return { file, fileBuffer: null };
}

/** Shows the large-CSV dialog and waits for the user's choice: 'open' | 'convert' | 'cancel' */
function _promptLargeCsvChoice(file) {
  return new Promise((resolve) => {
    _largeCsvResolve = resolve;
    window.dispatchEvent(new CustomEvent('largeCsvDetected', {
      detail: {
        filename: file.name,
        sizeMB: (file.size / 1024 / 1024).toFixed(1),
        sizeGB: (file.size / 1024 / 1024 / 1024).toFixed(2),
      }
    }));
  });
}

async function _loadFromFile(file) {
  if (typeof localStorage !== 'undefined' && localStorage) {
    try {
      localStorage.removeItem('selectedChannels');
    } catch (e) {
      console.warn('[CsdAPI] Failed to access localStorage:', e);
    }
  }
  _fileLoaded = false;
  _isCsvMode = false;
  _fileBuffer = null; // Clear previous buffer reference
  _files = [];
  _merged = null;     // Clear any previous multi-file session

  // ── Large CSV check (before showing loading overlay) ───────────────────────
  const LARGE_CSV_THRESHOLD = 800 * 1024 * 1024; // 800 MB
  if (file && file.name && file.name.toLowerCase().endsWith('.csv') && file.size >= LARGE_CSV_THRESHOLD) {
    const choice = await _promptLargeCsvChoice(file);
    if (choice === 'cancel') return false;
    if (choice === 'convert') _pendingCsdConvert = true;
    // 'open' or 'convert' → both proceed with normal CSV loading below
  }

  window.dispatchEvent(new CustomEvent('fileLoadStart', { detail: { filename: file.name } }));

  if (file && file.name && file.name.toLowerCase().endsWith('.csv')) {
    window.dispatchEvent(new CustomEvent('fileLoadProgress', { detail: { progress: 0.1, filename: file.name } }));
    try {
      const success = await CsvAPI.loadFromFile(file);
      window.dispatchEvent(new CustomEvent('fileLoadProgress', { detail: { progress: 0.8, filename: file.name } }));
      if (success) {
        _file = file;
        _fileLoaded = true;
        _isCsvMode = true;
        window.dispatchEvent(new CustomEvent('fileLoadProgress', { detail: { progress: 1.0, filename: file.name } }));
        _onFileLoadedCallbacks.forEach(fn => fn());
        // If user chose to convert, fire the pending-convert event after load callbacks
        if (_pendingCsdConvert) {
          _pendingCsdConvert = false;
          setTimeout(() => window.dispatchEvent(new CustomEvent('csvLoadedPendingConvert')), 200);
        }
        return true;
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('fileLoadProgress', { detail: { progress: 0, filename: file.name, error: true, errorMessage: e.message } }));
      return false;
    }
    window.dispatchEvent(new CustomEvent('fileLoadProgress', { detail: { progress: 0, filename: file.name, error: true } }));
    return false;
  }

  let fileToLoad = file;
  const LIMIT = 800 * 1024 * 1024; // 800 MB
  if (file.size && file.size < LIMIT && typeof file.arrayBuffer === 'function') {
    try {
      console.log(`[CsdAPI] File size (${(file.size / 1024 / 1024).toFixed(2)} MB) is under 800MB. Loading completely into memory...`);
      window.dispatchEvent(new CustomEvent('fileLoadProgress', { detail: { progress: 0.1, filename: file.name } }));
      const fullBuffer = await _readArrayBufferWithProgress(file, (p) => {
        const overallProgress = 0.1 + p * 0.75; // Map chunk reading to 10% - 85%
        window.dispatchEvent(new CustomEvent('fileLoadProgress', { detail: { progress: overallProgress, filename: file.name } }));
      });
      _fileBuffer = fullBuffer; // Save reference for zero-copy sync memory reads
      fileToLoad = {
        name: file.name,
        size: file.size,
        slice(start, end) {
          const sliced = fullBuffer.slice(start, end);
          return {
            arrayBuffer: async () => sliced
          };
        }
      };
    } catch (e) {
      console.warn('[CsdAPI] Failed to load entire file into memory, falling back to lazy load:', e);
      _fileBuffer = null;
      fileToLoad = file;
    }
  }

  try {
    window.dispatchEvent(new CustomEvent('fileLoadProgress', { detail: { progress: 0.9, filename: file.name } }));
    const target = {};
    await _parseHeaders(fileToLoad, target, _fileBuffer);
    _applyHeaderTarget(target);
    window.dispatchEvent(new CustomEvent('fileLoadProgress', { detail: { progress: 1.0, filename: file.name } }));
  } catch (err) {
    console.error('[CsdAPI] Header parse failed:', err);
    window.dispatchEvent(new CustomEvent('fileLoadProgress', { detail: { progress: 0, filename: file.name, error: true, errorMessage: err.message } }));
    return false;
  }

  _file = fileToLoad;
  _fileLoaded = true;
  _files = [_buildFileRecord(fileToLoad)];
  _merged = null;
  _onFileLoadedCallbacks.forEach(fn => fn());
  return true;
}

/** Copy a parsed header target into the module-level single-file state. */
function _applyHeaderTarget(target) {
  _deviceName = target.deviceName;
  _deviceId = target.deviceId;
  _deviceType = target.deviceType;
  _fileVersion = target.fileVersion;
  _numChannels = target.numChannels;
  _numSamples = target.numSamples;
  _dataStart = target.dataStart;
  _recordLen = target.recordLen;
  _startTimeMs = target.startTimeMs;
  _stopTimeMs = target.stopTimeMs;
  _sampleIntervalSec = target.sampleIntervalSec;
  _sampleRate = target.sampleRate;
  _channels = target.channels;
}

/** Build a session record from a parsed header target. */
function _recordFromTarget(file, target, fileBuffer) {
  return {
    file,
    name: file ? file.name : '',
    deviceName: target.deviceName,
    deviceId: target.deviceId,
    deviceType: target.deviceType,
    fileVersion: target.fileVersion,
    channels: target.channels,
    numChannels: target.numChannels,
    numSamples: target.numSamples,
    startTimeMs: target.startTimeMs,
    stopTimeMs: target.stopTimeMs,
    sampleIntervalSec: target.sampleIntervalSec,
    dataStart: target.dataStart,
    recordLen: target.recordLen,
    fileBuffer,
  };
}

/** Snapshot the current single-file state into a session record. */
function _buildFileRecord(file) {
  return _recordFromTarget(file, {
    deviceName: _deviceName,
    deviceId: _deviceId,
    deviceType: _deviceType,
    fileVersion: _fileVersion,
    channels: _channels,
    numChannels: _numChannels,
    numSamples: _numSamples,
    startTimeMs: _startTimeMs,
    stopTimeMs: _stopTimeMs,
    sampleIntervalSec: _sampleIntervalSec,
    dataStart: _dataStart,
    recordLen: _recordLen,
  }, _fileBuffer);
}

/** True when a CSD multi-file session is active. */
function _isMulti() {
  return _fileLoaded && !_isCsvMode && _files.length > 1 && !!_merged;
}

function _hasTimeOverlap(files) {
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const f1 = files[i];
      const f2 = files[j];
      if (Math.max(f1.startTimeMs, f2.startTimeMs) < Math.min(f1.stopTimeMs, f2.stopTimeMs)) {
        return true;
      }
    }
  }
  return false;
}

/** Rebuild the merged "virtual file" view from `_files`. */
function _rebuildMerged() {
  if (_files.length <= 1) {
    _merged = null;
    return;
  }
  const startMs = Math.min(..._files.map(f => f.startTimeMs));
  const stopMs = Math.max(..._files.map(f => f.stopTimeMs));
  const gridSec = _files.reduce((g, f) => _gcd(g, f.sampleIntervalSec), _files[0].sampleIntervalSec);
  const intervalMs = gridSec * 1000;
  const channels = [];
  const channelMap = {};

  const isOverlapping = _hasTimeOverlap(_files);

  if (isOverlapping) {
    // Option A: Overlapping files (parallel concurrent logging) -> separate channels
    _files.forEach((fr, fi) => {
      fr.channels.forEach((ch, li) => {
        const id = `${fi}:${li}`;
        const chEntry = {
          ...ch,
          id,
          channel_id: id,
          file_index: fi,
          local_channel_id: li,
          fileIndex: fi,
          localIdx: li,
          bindings: [{ fileIndex: fi, localIdx: li }],
        };
        channelMap[id] = chEntry;
        channels.push(chEntry);
      });
    });
  } else {
    // Option B: Sequential / non-overlapping files -> smart channel unification
    const norm = s => (s || '').trim().toLowerCase();
    _files.forEach((fr, fi) => {
      fr.channels.forEach((ch, li) => {
        const name = norm(ch.logic_channel_description || ch.full_channel_name);
        const sensor = norm(ch.sensor_description);
        const unit = norm(ch.unit_in_ascii);

        let match = null;
        if (name) {
          match = channels.find(u => norm(u.logic_channel_description || u.full_channel_name) === name);
        }
        if (!match && sensor && unit) {
          match = channels.find(u => norm(u.sensor_description) === sensor && norm(u.unit_in_ascii) === unit);
        }

        if (match) {
          match.bindings.push({ fileIndex: fi, localIdx: li });
          match._min = Math.min(match._min, ch._min);
          match._max = Math.max(match._max, ch._max);
          channelMap[`${fi}:${li}`] = match;
        } else {
          const id = `${channels.length}`;
          const compoundId = `${fi}:${li}`;
          const chEntry = {
            ...ch,
            id,
            channel_id: id,
            fileIndex: fi,
            localIdx: li,
            bindings: [{ fileIndex: fi, localIdx: li }],
          };
          channels.push(chEntry);
          channelMap[id] = chEntry;
          channelMap[compoundId] = chEntry;
        }
      });
    });
  }

  const numSamples = Math.max(0, Math.ceil((stopMs - startMs) / intervalMs));
  _merged = { channels, channelMap, startMs, stopMs, gridSec, intervalMs, numSamples };
}

/** Overlap validation: In Option B (concatenation / time gap allowed), any valid CSD file can be appended. */
function _validateOverlap(record) {
  if (!record || record.numChannels <= 0) {
    return 'Invalid file: no channels found.';
  }
  return null;
}

// ── Recent-files persistence (localStorage metadata + IDB handles) ────────────

function _saveRecentMeta(name, size, path = null) {
  try {
    let list = JSON.parse(localStorage.getItem('recentCsdFiles') || '[]');
    list = list.filter(f => f.name !== name && (!path || f.path !== path));
    list.unshift({ name, size, path, lastOpened: Date.now() });
    list = list.slice(0, 5);
    localStorage.setItem('recentCsdFiles', JSON.stringify(list));
  } catch { /* ignore */ }
}

// ── File System Access API helpers ────────────────────────────────────────────

const _fsaSupported = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

/** Show the OS file picker via File System Access API, persist the handle. */
async function _openWithFSA(append = false) {
  let handles;
  try {
    handles = await window.showOpenFilePicker({
      types: [{ description: 'CSD/CSV Files', accept: { 'application/octet-stream': ['.csd', '.csv'] } }],
      multiple: false,
    });
  } catch (e) {
    if (e.name !== 'AbortError') console.error('[CsdAPI] showOpenFilePicker error:', e);
    return;
  }

  const handle = handles[0];
  const file = await handle.getFile();

  if (append) {
    const res = await CsdAPI.appendFile(file);
    if (!res.ok && window.showAppNotification) {
      window.showAppNotification('Append Failed', res.reason, 'error');
    }
    return;
  }

  // Persist the handle in IndexedDB keyed by filename
  await _idbPut(file.name, handle);
  _saveRecentMeta(file.name, file.size);

  await _loadFromFile(file);
}

/** Classic <input type="file"> fallback. */
function _ensureFileInput() {
  if (_fileInput) return;
  _fileInput = document.createElement('input');
  _fileInput.type = 'file';
  _fileInput.accept = '.csd,.csv';
  _fileInput.style.display = 'none';
  document.body.appendChild(_fileInput);

  _fileInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csd') && !file.name.toLowerCase().endsWith('.csv')) {
      if (window.showAppNotification) {
        window.showAppNotification("Unsupported File Format", "Only .csd and .csv files are supported!", "error");
      } else {
        alert('Only .csd and .csv files are supported!');
      }
      _fileInput.value = '';
      return;
    }
    _saveRecentMeta(file.name, file.size);
    if (_appendMode) {
      _appendMode = false;
      const res = await CsdAPI.appendFile(file);
      if (!res.ok) {
        if (window.showAppNotification) {
          window.showAppNotification('Append Failed', res.reason, 'error');
        } else {
          alert(res.reason);
        }
      }
    } else {
      await _loadFromFile(file);
    }
    _fileInput.value = '';
  });
}

// ── Public CsdAPI object ──────────────────────────────────────────────────────

const CsdAPI = {

  /** Returns true if the File System Access API is available (Chrome/Edge). */
  get hasFSA() { return _fsaSupported; },

  /**
   * Open a .csd file.
   * - Chrome/Edge: uses showOpenFilePicker and persists the handle.
   * - Safari/Firefox: falls back to <input type="file">.
   */
  openFile() {
    if (_fsaSupported) {
      _openWithFSA(false);
    } else {
      _ensureFileInput();
      _fileInput.click();
    }
  },

  /**
   * Append one more .csd file to the current multi-file session.
   * The appended file must share an overlapping time window with the session.
   * Returns { ok, reason?, numFiles? }.
   */
  openAppend() {
    if (_fsaSupported) {
      _openWithFSA(true);
    } else {
      _appendMode = true;
      _ensureFileInput();
      _fileInput.click();
    }
  },

  async appendFile(file) {
    if (!_fileLoaded) {
      return { ok: false, reason: 'No file is loaded to append to.' };
    }
    if (_isCsvMode) {
      if (!file || !file.name || !file.name.toLowerCase().endsWith('.csv')) {
        return { ok: false, reason: 'Cannot append a CSD file to a CSV session. Please append a .csv file.' };
      }
      const res = await CsvAPI.appendFile(file);
      if (res && res.ok) {
        _onFileLoadedCallbacks.forEach(fn => fn());
      }
      return res;
    }
    if (!file || !file.name || !file.name.toLowerCase().endsWith('.csd')) {
      return { ok: false, reason: 'Cannot append a CSV file to a CSD session. Please append a .csd file.' };
    }
    try {
      const { file: fileToLoad, fileBuffer } = await _bufferFileIfSmall(file);
      const target = {};
      await _parseHeaders(fileToLoad, target, fileBuffer);
      const overlapErr = _validateOverlap(target);
      if (overlapErr) {
        return { ok: false, reason: overlapErr };
      }
      _files.push(_recordFromTarget(fileToLoad, target, fileBuffer));
      _rebuildMerged();
      _onFileLoadedCallbacks.forEach(fn => fn());
      return { ok: true, numFiles: _files.length };
    } catch (e) {
      console.error('[CsdAPI] appendFile error:', e);
      return { ok: false, reason: e.message || 'Failed to append file.' };
    }
  },

  /** Number of files currently in the session (1 for a normal single-file load). */
  getNumLoadedFiles() {
    if (_fileLoaded && _isCsvMode) {
      return CsvAPI.getNumLoadedFiles ? CsvAPI.getNumLoadedFiles() : 1;
    }
    return _files.length > 0 ? _files.length : (_fileLoaded ? 1 : 0);
  },

  /**
   * Load a file from a previously-persisted FileSystemFileHandle stored in IDB.
   * Will prompt the user for read permission if needed.
   * Returns true on success, false on failure.
   */
  async loadFileFromHandle(handle) {
    try {
      // Request (or verify) read permission
      const permission = await handle.queryPermission({ mode: 'read' });
      if (permission !== 'granted') {
        const request = await handle.requestPermission({ mode: 'read' });
        if (request !== 'granted') return false;
      }
      const file = await handle.getFile();
      _saveRecentMeta(file.name, file.size);
      return await _loadFromFile(file);
    } catch (err) {
      console.error('[CsdAPI] loadFileFromHandle error:', err);
      if (err.name === 'NotFoundError') {
        const fileName = handle.name || 'Unknown file';
        if (window.showAppNotification) {
          window.showAppNotification(
            "File Not Found",
            `The requested file "${fileName}" could not be found.\n\nIt may have been moved, renamed, or deleted from your computer.`,
            "error"
          );
        } else {
          alert(`File Not Found: The file "${fileName}" could not be found. It may have been moved, renamed, or deleted.`);
        }
      }
      return false;
    }
  },

  /**
   * Load a file from an absolute path (Node/Electron environment only).
   */
  async loadFileFromPath(filePath) {
    try {
      const fs = window.require('fs');
      const pathModule = window.require('path');
      const stats = fs.statSync(filePath);
      const name = pathModule.basename(filePath);

      const fileWrapper = {
        name: name,
        size: stats.size,
        slice(start, end) {
          const length = Math.max(0, end - start);
          const buf = Buffer.alloc(length);
          const fd = fs.openSync(filePath, 'r');
          fs.readSync(fd, buf, 0, length, start);
          fs.closeSync(fd);
          return {
            arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
          };
        },
        async arrayBuffer() {
          const buffer = fs.readFileSync(filePath);
          return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        }
      };

      _saveRecentMeta(name, stats.size, filePath);
      return await _loadFromFile(fileWrapper);
    } catch (err) {
      console.error('[CsdAPI] loadFileFromPath error:', err);
      return false;
    }
  },

  async loadFile(file) {
    if (!file) return false;
    return await _loadFromFile(file);
  },

  /**
   * Return list of recent file metadata (name, size, lastOpened)
   * stored in localStorage.
   */
  getRecentFiles() {
    try {
      return JSON.parse(localStorage.getItem('recentCsdFiles') || '[]');
    } catch {
      return [];
    }
  },

  async removeRecentFile(name) {
    try {
      let list = JSON.parse(localStorage.getItem('recentCsdFiles') || '[]');
      list = list.filter(f => f.name !== name);
      localStorage.setItem('recentCsdFiles', JSON.stringify(list));
      await _idbDelete(name);
      return list;
    } catch {
      return [];
    }
  },

  /**
   * Retrieve the persisted FileSystemFileHandle for a given filename from IDB.
   * Returns undefined if not found or IDB is unavailable.
   */
  async getHandleForFile(name) {
    return _idbGet(name);
  },

  /**
   * Register a callback invoked once when a file finishes loading.
   * If a file is already loaded, the callback fires immediately.
   */
  onFileLoaded(callback) {
    if (!_onFileLoadedCallbacks.includes(callback)) {
      _onFileLoadedCallbacks.push(callback);
    }
    if (_fileLoaded) setTimeout(callback, 0);
    return () => {
      _onFileLoadedCallbacks = _onFileLoadedCallbacks.filter(fn => fn !== callback);
    };
  },

  isFileLoaded() { return _fileLoaded; },

  isCsvMode() { return _fileLoaded && _isCsvMode; },

  getFileTimeRange() {
    if (_fileLoaded && _isCsvMode) {
      return CsvAPI.getFileTimeRange();
    }
    if (_isMulti()) {
      return { start: _merged.startMs, stop: _merged.stopMs };
    }
    return { start: _startTimeMs, stop: _stopTimeMs };
  },

  getLoadedFileName() {
    if (_fileLoaded && _isCsvMode) {
      return CsvAPI.getLoadedFileName();
    }
    if (_isMulti()) {
      return `${_files.length} files`;
    }
    return _file ? _file.name : '';
  },

  getNumOfSamples() {
    if (_fileLoaded && _isCsvMode) {
      return CsvAPI.getNumOfSamples();
    }
    if (_isMulti()) {
      return _merged.numSamples;
    }
    return _numSamples;
  },

  getSampleRate() {
    if (_fileLoaded && _isCsvMode) {
      return CsvAPI.getSampleRate();
    }
    if (_isMulti()) {
      return 1 / _merged.gridSec;
    }
    return _sampleRate;
  },

  getTablePage(pageIndex, pageSize, selectedChannelIds, callback) {
    if (_fileLoaded && _isCsvMode) {
      CsvAPI.getTablePage(pageIndex, pageSize, selectedChannelIds, callback);
      return;
    }
    if (_isMulti()) {
      this._getMergedTablePage(pageIndex, pageSize, selectedChannelIds, callback);
      return;
    }
    if (!_fileLoaded || !_file) {
      setTimeout(() => callback({ total: 0, rows: [] }), 50);
      return;
    }

    const startSample = pageIndex * pageSize;
    const endSample = Math.min(startSample + pageSize - 1, _numSamples - 1);
    const count = endSample - startSample + 1;

    if (count <= 0) {
      setTimeout(() => callback({ total: _numSamples, rows: [] }), 50);
      return;
    }

    const offset = _dataStart + startSample * _recordLen;
    const byteLength = count * _recordLen;

    _readSlice(_file, offset, byteLength).then(dv => {
      const rows = [];
      for (let i = 0; i < count; i++) {
        const recordIndex = startSample + i;
        const recordOffset = i * _recordLen;
        const recordId = dv.getInt32(recordOffset, false);
        const timestampMs = _startTimeMs + (recordIndex / _sampleRate) * 1000;

        const values = {};
        for (let c = 0; c < _numChannels; c++) {
          if (selectedChannelIds && !selectedChannelIds.includes(c)) {
            continue;
          }
          const valOffset = recordOffset + RECORD_ID_LEN + c * CHANNEL_VALUE_LEN;
          const v = dv.getFloat64(valOffset, false);
          values[c] = (v <= DATA_OVERRANGE) ? null : v;
        }

        rows.push({
          index: recordIndex,
          recordId,
          timestampMs,
          values
        });
      }
      callback({
        total: _numSamples,
        sampleRate: _sampleRate,
        startTimeMs: _startTimeMs,
        stopTimeMs: _stopTimeMs,
        rows
      });
    }).catch(err => {
      console.error('[CsdAPI] getTablePage error:', err);
      callback({ total: _numSamples, rows: [] });
    });
  },

  /** Table page over the merged multi-file session, aligned to the GCD grid. */
  _getMergedTablePage(pageIndex, pageSize, selectedChannelIds, callback) {
    const m = _merged;
    const total = m.numSamples;
    if (!m || total <= 0) {
      setTimeout(() => callback({ total: 0, rows: [] }), 50);
      return;
    }
    const startGrid = pageIndex * pageSize;
    const endGrid = Math.min(startGrid + pageSize - 1, total - 1);
    const count = Math.max(0, endGrid - startGrid + 1);
    if (count <= 0) {
      setTimeout(() => callback({ total, rows: [] }), 50);
      return;
    }

    const ids = (selectedChannelIds && selectedChannelIds.length)
      ? selectedChannelIds
      : m.channels.map(c => c.channel_id);
    const selected = [];
    for (const id of ids) {
      const cm = m.channelMap[id] || m.channelMap[String(id)];
      if (cm && !selected.includes(cm)) selected.push(cm);
    }

    const byFile = {};
    for (const c of selected) {
      const bindings = c.bindings || [c];
      for (const b of bindings) {
        (byFile[b.fileIndex] = byFile[b.fileIndex] || []).push({
          ...b,
          id: c.channel_id,
          key: `${b.fileIndex}:${b.localIdx}`
        });
      }
    }

    const startMs = m.startMs + startGrid * m.intervalMs;
    const endMs = m.startMs + endGrid * m.intervalMs;

    const fileData = {};
    const reads = [];
    for (const fiStr of Object.keys(byFile)) {
      const fi = Number(fiStr);
      const fr = _files[fi];
      if (fr.numSamples <= 0 || endMs < fr.startTimeMs || startMs > fr.stopTimeMs) {
        fileData[fi] = { s0: 0, values: {} };
        continue;
      }
      const s0 = Math.max(0, Math.min(fr.numSamples - 1, Math.round((startMs - fr.startTimeMs) / 1000 / fr.sampleIntervalSec)));
      const s1 = Math.max(s0, Math.min(fr.numSamples - 1, Math.round((endMs - fr.startTimeMs) / 1000 / fr.sampleIntervalSec)));
      reads.push(_readFileChannelsPage(fr, byFile[fi], s0, s1).then(d => { fileData[fi] = d; }));
    }

    Promise.all(reads).then(() => {
      const rows = [];
      for (let i = 0; i < count; i++) {
        const gridIndex = startGrid + i;
        const timeMs = startMs + i * m.intervalMs;
        const values = {};
        for (const c of selected) {
          let val = null;
          const bindings = c.bindings || [c];
          for (const b of bindings) {
            const fr = _files[b.fileIndex];
            if (timeMs >= fr.startTimeMs && timeMs <= fr.stopTimeMs) {
              const d = fileData[b.fileIndex];
              const arr = d && d.values && (d.values[`${b.fileIndex}:${b.localIdx}`] || d.values[c.channel_id]);
              if (arr) {
                const sIdx = Math.round((timeMs - fr.startTimeMs) / 1000 / fr.sampleIntervalSec);
                const rel = sIdx - d.s0;
                const v = (rel >= 0 && rel < arr.length) ? arr[rel] : NaN;
                val = Number.isNaN(v) ? null : v;
                break;
              }
            }
          }
          values[c.channel_id] = val;
        }
        rows.push({ index: gridIndex, recordId: gridIndex, timestampMs: timeMs, values });
      }
      callback({
        total,
        sampleRate: 1 / m.gridSec,
        startTimeMs: m.startMs,
        stopTimeMs: m.stopMs,
        rows
      });
    }).catch(err => {
      console.error('[CsdAPI] merged getTablePage error:', err);
      callback({ total, rows: [] });
    });
  },

  /**
   * Patches sample values in memory and persists to original file if FileSystemFileHandle is available.
   * @param {Object} overrides - { [recordIndex]: { [channelId]: newValue } }
   * @returns {Promise<{ success: boolean, persisted: boolean, count: number }>}
   */
  async patchSampleValues(overrides) {
    if (!_fileLoaded || !overrides) return { success: false, persisted: false, count: 0 };
    let count = 0;

    // 1. Update in-memory _fileBuffer if available
    if (_fileBuffer) {
      const dv = new DataView(_fileBuffer);
      for (const [recIdxStr, chMap] of Object.entries(overrides)) {
        const recordIndex = parseInt(recIdxStr, 10);
        if (recordIndex < 0 || recordIndex >= _numSamples) continue;
        const recOffset = _dataStart + recordIndex * _recordLen;
        for (const [chIdStr, newVal] of Object.entries(chMap)) {
          const chId = parseInt(chIdStr, 10);
          if (chId < 0 || chId >= _numChannels) continue;
          const valOffset = recOffset + RECORD_ID_LEN + chId * CHANNEL_VALUE_LEN;
          dv.setFloat64(valOffset, Number(newVal), false);
          count++;
        }
      }
    }

    // 2. Persist to file handle if available
    let persisted = false;
    try {
      const isHandle = typeof FileSystemFileHandle !== 'undefined' && _file instanceof FileSystemFileHandle;
      const handle = isHandle ? _file : await _idbGet(this.getLoadedFileName());
      if (handle && handle.createWritable) {
        const perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          const requested = await handle.requestPermission({ mode: 'readwrite' });
          if (requested !== 'granted') {
            return { success: true, persisted: false, count };
          }
        }
        const writable = await handle.createWritable({ keepExistingData: true });
        if (_fileBuffer) {
          await writable.write({ type: 'write', data: _fileBuffer, position: 0 });
        } else {
          for (const [recIdxStr, chMap] of Object.entries(overrides)) {
            const recordIndex = parseInt(recIdxStr, 10);
            if (recordIndex < 0 || recordIndex >= _numSamples) continue;
            const recOffset = _dataStart + recordIndex * _recordLen;
            for (const [chIdStr, newVal] of Object.entries(chMap)) {
              const chId = parseInt(chIdStr, 10);
              if (chId < 0 || chId >= _numChannels) continue;
              const valOffset = recOffset + RECORD_ID_LEN + chId * CHANNEL_VALUE_LEN;
              const buf = new ArrayBuffer(8);
              new DataView(buf).setFloat64(0, Number(newVal), false);
              await writable.write({ type: 'write', data: buf, position: valOffset });
            }
          }
        }
        await writable.close();
        persisted = true;
      }
    } catch (e) {
      console.warn('[CsdAPI] Failed to persist patch to file handle:', e);
    }

    return { success: true, persisted, count };
  },

  // ── Export helpers (single or merged multi-file session) ────────────────────

  _exportChannels() { return _isMulti() ? _merged.channels : _channels; },
  _exportNumSamples() { return _isMulti() ? _merged.numSamples : _numSamples; },
  _exportStartMs() { return _isMulti() ? _merged.startMs : _startTimeMs; },
  _exportStopMs() { return _isMulti() ? _merged.stopMs : _stopTimeMs; },
  _exportIntervalSec() { return _isMulti() ? _merged.gridSec : _sampleIntervalSec; },

  /**
   * Read `count` export rows starting at grid/sample index `start`.
   * Returns [{ timestampMs, values: { channelId: number|null } }].
   * channelId is the merged string id in multi-file mode, the channel index otherwise.
   */
  async _readExportPage(start, count) {
    if (count <= 0) return [];
    if (_isMulti()) {
      const m = _merged;
      const startMs = m.startMs + start * m.intervalMs;
      const endMs = m.startMs + (start + count - 1) * m.intervalMs;
      const byFile = {};
      for (const ch of m.channels) {
        const bindings = ch.bindings || [ch];
        for (const b of bindings) {
          (byFile[b.fileIndex] = byFile[b.fileIndex] || []).push({
            ...b,
            id: ch.channel_id,
            key: `${b.fileIndex}:${b.localIdx}`
          });
        }
      }
      const fileData = {};
      const reads = [];
      for (const fiStr of Object.keys(byFile)) {
        const fi = Number(fiStr);
        const fr = _files[fi];
        if (fr.numSamples <= 0 || endMs < fr.startTimeMs || startMs > fr.stopTimeMs) {
          fileData[fi] = { s0: 0, values: {} };
          continue;
        }
        const s0 = Math.max(0, Math.min(fr.numSamples - 1, Math.round((startMs - fr.startTimeMs) / 1000 / fr.sampleIntervalSec)));
        const s1 = Math.max(s0, Math.min(fr.numSamples - 1, Math.round((endMs - fr.startTimeMs) / 1000 / fr.sampleIntervalSec)));
        reads.push(_readFileChannelsPage(fr, byFile[fi], s0, s1).then(d => { fileData[fi] = d; }));
      }
      await Promise.all(reads);
      const rows = [];
      for (let i = 0; i < count; i++) {
        const timeMs = startMs + i * m.intervalMs;
        const values = {};
        for (const ch of m.channels) {
          let val = null;
          const bindings = ch.bindings || [ch];
          for (const b of bindings) {
            const fr = _files[b.fileIndex];
            if (timeMs >= fr.startTimeMs && timeMs <= fr.stopTimeMs) {
              const d = fileData[b.fileIndex];
              const arr = d && d.values && (d.values[`${b.fileIndex}:${b.localIdx}`] || d.values[ch.channel_id]);
              if (arr) {
                const sIdx = Math.round((timeMs - fr.startTimeMs) / 1000 / fr.sampleIntervalSec);
                const rel = sIdx - d.s0;
                const v = (rel >= 0 && rel < arr.length) ? arr[rel] : NaN;
                val = Number.isNaN(v) ? null : v;
                break;
              }
            }
          }
          values[ch.channel_id] = val;
        }
        rows.push({ timestampMs: timeMs, values });
      }
      return rows;
    }

    // single-file mode — contiguous slice (unchanged behaviour)
    const offset = _dataStart + start * _recordLen;
    const byteLength = count * _recordLen;
    const dv = await _readSlice(_file, offset, byteLength);
    const rows = [];
    for (let i = 0; i < count; i++) {
      const recordOffset = i * _recordLen;
      const timestampMs = _startTimeMs + ((start + i) / _sampleRate) * 1000;
      const values = {};
      for (let c = 0; c < _numChannels; c++) {
        const v = dv.getFloat64(recordOffset + RECORD_ID_LEN + c * CHANNEL_VALUE_LEN, false);
        values[c] = (v <= DATA_OVERRANGE) ? null : v;
      }
      rows.push({ index: start + i, timestampMs, values });
    }
    return rows;
  },


  // ── Standard MockAPI-compatible methods ─────────────────────────────────────

  getUserSettings(username, callback) {
    if (_fileLoaded && _isCsvMode) {
      CsvAPI.getUserSettings(username, callback);
      return;
    }
    if (!_fileLoaded) {
      setTimeout(() => callback([]), 50);
      return;
    }

    // Pick up to 2 default channels (prefer flow-related units)
    const srcChannels = _isMulti() ? _merged.channels : _channels;
    const flowPriority = srcChannels.filter(ch => {
      const u = (ch.unit_in_ascii || '').toLowerCase();
      const d = (ch.logic_channel_description || '').toLowerCase();
      return u.includes('m') || u.includes('flow') || d.includes('m³') || d.includes('m3') || d.includes('flow');
    });
    const sorted = [...flowPriority, ...srcChannels.filter(ch => !flowPriority.includes(ch))];
    const defaults = sorted.slice(0, 2);

    const COLORS = ['#00ac86', '#FF5630', '#36B37E', '#6554C0', '#FF8B00',
      '#0052CC', '#00875A', '#FF4081', '#FFC107', '#7B1FA2'];

    const displayChannelOption = defaults.map((ch, idx) => ({
      channel_id: {
        channel_id: ch.channel_id,
        logic_channel_description: ch.logic_channel_description,
        physical_channel_description: ch.physical_channel_description,
        sensor_id: ch.sensor_id,
      },
      color: COLORS[idx % COLORS.length],
      display_channel_option_id: 1000 + idx,
    }));

    setTimeout(() => callback([{
      alias_name: username || 'CSD',
      createddate: _isMulti() ? _merged.startMs : _startTimeMs,
      display_channel_option: displayChannelOption,
      username: username || 'csd',
    }]), 50);
  },

  getChannels(callback) {
    if (_fileLoaded && _isCsvMode) {
      CsvAPI.getChannels(callback);
      return;
    }
    if (!_fileLoaded) {
      setTimeout(() => callback({ logging_chs: [] }), 50);
      return;
    }
    const src = _isMulti() ? _merged.channels : _channels;
    setTimeout(() => callback({
      logging_chs: src.map(ch => ({
        channel_id: ch.channel_id,
        location_id: ch.location_id,
        sensor_id: ch.sensor_id,
        logic_channel_description: ch.logic_channel_description,
        physical_channel_description: ch.physical_channel_description,
        sensor_description: ch.sensor_description,
        unit_in_ascii: ch.unit_in_ascii,
        resolution: ch.resolution,
        full_channel_name: ch.full_channel_name,
        min: ch.min !== undefined ? ch.min : ch._min,
        max: ch.max !== undefined ? ch.max : ch._max,
        color: ch.color,
        file_index: ch.file_index,
        bindings: ch.bindings,
      }))
    }), 50);
  },

  getMeasurementData(channelId, startTime, stopTime, tableInterval, getDataWay, callback) {
    if (_fileLoaded && _isCsvMode) {
      CsvAPI.getMeasurementData(channelId, startTime, stopTime, tableInterval, getDataWay, callback);
      return;
    }
    if (_isMulti()) {
      this._getMergedMeasurementData(channelId, startTime, stopTime, tableInterval, getDataWay, callback);
      return;
    }
    if (!_fileLoaded || !_file) {
      setTimeout(() => callback([]), 50);
      return;
    }

    const chIdx = parseInt(channelId, 10);
    if (isNaN(chIdx) || chIdx < 0 || chIdx >= _channels.length) {
      setTimeout(() => callback([]), 50);
      return;
    }

    const ch = _channels[chIdx];

    // Adjust for the +8 h the UI adds before calling us
    const qStart = startTime - 3600000 * 8;
    const qStop = stopTime - 3600000 * 8;

    // Convert time → sample index
    const timeToSample = ms => {
      if (_sampleRate <= 0) return 0;
      return Math.max(0, Math.floor(((ms - _startTimeMs) / 1000) * _sampleRate));
    };

    let startSample = timeToSample(qStart);
    let endSample = timeToSample(qStop);
    startSample = Math.max(0, Math.min(startSample, _numSamples - 1));
    endSample = Math.max(startSample, Math.min(endSample, _numSamples - 1));

    // Compute downsampling step
    const range = endSample - startSample + 1;
    const step = Math.max(1, Math.floor(range / MAX_DISPLAY_SAMPLES));

    const actualStartMs = _startTimeMs + (startSample / _sampleRate) * 1000;
    const pointIntervalMs = (step / _sampleRate) * 1000;

    // Async read — lazy slice
    _readChannelData(_file, chIdx, startSample, endSample, step).then(values => {
      callback([{
        channel_id: channelId,
        measurementData: [values],
        realStartTime: [actualStartMs + 3600000 * 8],
        pointInterval: [pointIntervalMs],
        min: ch._min,
        max: ch._max,
      }]);
    }).catch(err => {
      console.error('[CsdAPI] getMeasurementData slice error:', err);
      callback([]);
    });
  },

  /** Measurement data for one channel over the merged multi-file session. */
  _getMergedMeasurementData(channelId, startTime, stopTime, tableInterval, getDataWay, callback) {
    const id = String(channelId);
    const cm = _merged ? (_merged.channelMap[id] || _merged.channelMap[parseInt(id, 10)]) : null;
    if (!cm) {
      setTimeout(() => callback([]), 50);
      return;
    }

    const qStart = startTime - 3600000 * 8;
    const qStop = stopTime - 3600000 * 8;

    const bindings = cm.bindings || [cm];
    const reads = [];

    for (const b of bindings) {
      const fr = _files[b.fileIndex];
      const ch = fr.channels[b.localIdx];
      if (qStop < fr.startTimeMs || qStart > fr.stopTimeMs) {
        continue;
      }
      const timeToSample = ms => {
        if (fr.sampleIntervalSec <= 0) return 0;
        return Math.max(0, Math.floor((ms - fr.startTimeMs) / 1000 / fr.sampleIntervalSec));
      };
      const clampedQStart = Math.max(qStart, fr.startTimeMs);
      const clampedQStop = Math.min(qStop, fr.stopTimeMs);
      let startSample = timeToSample(clampedQStart);
      let endSample = timeToSample(clampedQStop);
      startSample = Math.max(0, Math.min(startSample, fr.numSamples - 1));
      endSample = Math.max(startSample, Math.min(endSample, fr.numSamples - 1));

      const range = endSample - startSample + 1;
      const step = Math.max(1, Math.floor(range / MAX_DISPLAY_SAMPLES));
      const actualStartMs = fr.startTimeMs + startSample * fr.sampleIntervalSec * 1000;
      const pointIntervalMs = step * fr.sampleIntervalSec * 1000;

      reads.push(_readFileChannelData(fr, b.localIdx, startSample, endSample, step).then(values => ({
        values,
        actualStartMs,
        pointIntervalMs,
        ch,
      })));
    }

    if (reads.length === 0) {
      const fr0 = _files[bindings[0].fileIndex];
      const ch0 = fr0.channels[bindings[0].localIdx];
      setTimeout(() => callback([{
        channel_id: id,
        measurementData: [[]],
        realStartTime: [qStart + 3600000 * 8],
        pointInterval: [1000],
        min: ch0._min,
        max: ch0._max,
      }]), 50);
      return;
    }

    Promise.all(reads).then(results => {
      const measurementData = results.map(r => r.values);
      const realStartTime = results.map(r => r.actualStartMs + 3600000 * 8);
      const pointInterval = results.map(r => r.pointIntervalMs);
      const min = Math.min(...results.map(r => r.ch._min));
      const max = Math.max(...results.map(r => r.ch._max));

      callback([{
        channel_id: id,
        measurementData,
        realStartTime,
        pointInterval,
        min,
        max,
      }]);
    }).catch(err => {
      console.error('[CsdAPI] merged getMeasurementData error:', err);
      callback([]);
    });
  },

  getMutilMeasurementData(channelIds, startTime, tableInterval, getDataWay, callback) {
    if (_fileLoaded && _isCsvMode) {
      CsvAPI.getMutilMeasurementData(channelIds, startTime, tableInterval, getDataWay, callback);
      return;
    }
    if (!channelIds || channelIds.length === 0) { callback([]); return; }
    const stopTime = _isMulti()
      ? (_merged.stopMs + 3600000 * 8)
      : (_stopTimeMs > _startTimeMs ? (_stopTimeMs + 3600000 * 8) : startTime + 3600000 * 24);
    this.getMeasurementData(channelIds[0], startTime, stopTime, tableInterval, getDataWay, callback);
  },

  getLocations(callback) {
    setTimeout(() => callback({
      locations: [{
        location_id: 1,
        description: '',
        location_index: 0,
        background_img: '',
        sensors: [],
      }]
    }), 50);
  },

  // ── Stubs to satisfy the full MockAPI interface ─────────────────────────────
  getDevices(callback) { if (callback) callback([]); },
  getBackupSettings(callback) { if (callback) callback({}); },
  updateBackupSettings(json, callback) { if (callback) callback({}); },
  getUsers(callback) { if (callback) callback([]); },
  checkUserExist(username, callback) { if (callback) callback([]); },
  addUser(json, callback) { if (callback) callback({}); },
  modifyPsw(username, newpsw, oldpsw, callback) { if (callback) callback({}); },
  deleteUser(username, callback) { if (callback) callback({}); },
  getFileList(callback) { if (callback) callback([]); },
  getFileChannelBean(ft, fi, gi, callback) { if (callback) callback({}); },
  initUserUploadDownLoad(user, callback) { if (callback) callback({}); },
  getUserUploadDownloadProgress(user, callback) { if (callback) callback({}); },
  getSampleList(callback) { if (callback) callback([]); },
  getSampleInfo(sid, callback) { if (callback) callback({}); },
  getSampleInfoGroup(groupId, callback) { if (callback) callback({}); },
  login(username, password, callback) { if (callback) callback({}); },
  getManualAddDevice(ids, callback) { if (callback) callback([]); },
  refreshChannelValues(ids, callback) { if (callback) callback([]); },
  getRegisterInfo(callback) { if (callback) callback({}); },
  getRegistration(callback) { if (callback) callback({}); },
  updateRegistration(json, callback) { if (callback) callback({}); },
  getReportBasicSetting(callback) { if (callback) callback({}); },
  changeReportBasicSetting(json, callback) { if (callback) callback({}); },
  getReportCostCurrency(callback) { if (callback) callback([]); },
  getReportList(callback) { if (callback) callback([]); },
  changeReportCost(json, callback) { if (callback) callback({}); },
  newReport(json, callback) { if (callback) callback({}); },
  deleteReport(reportId, callback) { if (callback) callback({}); },
  getReportData(rid, st, tt, callback) { if (callback) callback({}); },
  getLocationNDevice(callback) { if (callback) callback({}); },
  getDetectedResult(callback) { if (callback) callback({}); },
  postLocations(json, callback) { if (callback) callback({}); },
  getAlarms(callback) { if (callback) callback([]); },
  getAlarmHistorys(st, et, si, type, callback) { if (callback) callback([]); },
  getAlarmTime(orderStr, callback) { if (callback) callback([]); },
  getLocations4Alarms(callback) { if (callback) callback([]); },
  postAlarms(json, callback) { if (callback) callback({}); },
  getEmailSetting(callback) { if (callback) callback({}); },
  changeEmailSetting(json, callback) { if (callback) callback({}); },
  verifyEmail(json, callback) { if (callback) callback({}); },
  checkTaskStatus(id, callback) { if (callback) callback({}); },
  getSystemStatus(callback) { if (callback) callback({}); },
  loginConfirm(user, psw, callback) { if (callback) callback({}); },
  createTask(json, callback) { if (callback) callback({}); },
  changeCommunication(json, callback) { if (callback) callback({}); },
  getCommunication(callback) { if (callback) callback({}); },
  getLoggingChannels(callback) { if (callback) callback([]); },
  saveSensorPosition(id, x, y, callback) { if (callback) callback({}); },

  /** Called by App.jsx to resolve the large-CSV dialog: choice is 'open' | 'convert' | 'cancel' */
  resolveLargeCsvChoice(choice) {
    if (_largeCsvResolve) {
      _largeCsvResolve(choice);
      _largeCsvResolve = null;
    }
  },

  getGapSummary() {

    if (_fileLoaded && _isCsvMode) {
      return CsvAPI.getGapSummary();
    }
    // CSD files have continuous samples — no gaps
    return { gapCount: 0, gaps: [], totalMissingSamples: 0, totalRealSamples: _numSamples, totalCsdSamples: _numSamples, detectedIntervalSec: _sampleIntervalSec, startTimeMs: _startTimeMs, stopTimeMs: _stopTimeMs };
  },

  async exportToCsd(onProgress) {
    if (_fileLoaded && _isCsvMode) {
      return CsvAPI.exportToCsd(onProgress);
    }
    throw new Error('Export to CSD is only available when a CSV file is loaded.');
  },

  async exportToCsdSplit(onProgress) {
    if (_fileLoaded && _isCsvMode) {
      return CsvAPI.exportToCsdSplit(onProgress);
    }
    throw new Error('Split export is only available when a CSV file is loaded.');
  },

  async exportAllChannelsToCsv(onProgress) {
    if (_fileLoaded && _isCsvMode) {
      return CsvAPI.exportAllChannelsToCsv(onProgress);
    }
    if (!_fileLoaded || !_file) {
      throw new Error("No CSD file loaded");
    }

    const LIMIT_800MB = 800 * 1024 * 1024; // 800 MB
    const supportsStreaming = 'showSaveFilePicker' in window;

    if (_file.size >= LIMIT_800MB && supportsStreaming) {
      return this._exportAllChannelsToCsvStreaming(onProgress);
    }

    if (_file.size >= LIMIT_800MB && !supportsStreaming) {
      const proceed = window.confirm(
        `Warning: The loaded CSD file is extremely large (approx. ${(_file.size / 1024 / 1024).toFixed(1)} MB).\n` +
        `Your browser does not support streaming direct-to-disk exports, which may cause your browser tab to run out of memory or crash.\n\n` +
        `Do you want to attempt exporting anyway?`
      );
      if (!proceed) {
        return;
      }
    }

    return this._exportAllChannelsToCsvInMemory(onProgress);
  },

  async _exportAllChannelsToCsvStreaming(onProgress) {
    const srcChannels = this._exportChannels();
    const srcNumSamples = this._exportNumSamples();
    const srcStartMs = this._exportStartMs();
    const srcStopMs = this._exportStopMs();
    const srcIntervalSec = this._exportIntervalSec();
    const baseName = (_file.name ? _file.name.replace(/\.[^/.]+$/, "") : "export") + (_isMulti() ? "_combined" : "");
    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: `${baseName}_all_channels.csv`,
        types: [{
          description: 'CSV Files',
          accept: { 'text/csv': ['.csv'] },
        }],
      });
    } catch (err) {
      console.log("[CsdAPI] Streaming export cancelled by user:", err);
      return;
    }

    const writable = await handle.createWritable();
    const writer = writable.getWriter();

    try {
      const encoder = new TextEncoder();

      const formatDateTimeHeader = (ms) => {
        const date = new Date(ms);
        const day = date.getDate();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const mins = String(date.getMinutes()).padStart(2, '0');
        const secs = String(date.getSeconds()).padStart(2, '0');
        return `${day}.${month} ${year} ${hours}:${mins}:${secs}`;
      };

      const formatDateTimeDataRow = (ms) => {
        const date = new Date(ms);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const mins = String(date.getMinutes()).padStart(2, '0');
        const secs = String(date.getSeconds()).padStart(2, '0');
        return `${day}-${month}-${year} ${hours}:${mins}:${secs}`;
      };

      const getResolutionString = (res) => {
        const r = Math.max(0, Math.min(20, res || 0));
        if (r === 0) return '1';
        return (1 / Math.pow(10, r)).toFixed(r);
      };

      let initialText = `${_deviceName} Raw Data\n\n`;
      initialText += `Start Date Time,${formatDateTimeHeader(srcStartMs)}\n`;
      initialText += `End Date Time,${formatDateTimeHeader(srcStopMs)}\n`;
      initialText += `Sample Rate(sec),${srcIntervalSec}\n`;
      initialText += `NO.Of Channels,${srcChannels.length}\n`;
      initialText += `NO.Of Records,${srcNumSamples}\n\n`;
      initialText += 'No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point\n';
      
      srcChannels.forEach((ch, idx) => {
        const chName = ch.logic_channel_description || `CH${idx + 1}`;
        const sensor = ch.sensor_description || `Sensor ${idx + 1}`;
        const unit = ch.unit_in_ascii || '';
        const resVal = getResolutionString(ch.resolution);
        const locPoint = `Location ${ch.location_id || 1}/${ch.logic_channel_description || 'MP001'}`;
        initialText += `${idx + 1},${chName},${sensor},${unit},${resVal},${locPoint}\n`;
      });
      initialText += '\n';

      const dataHeaders = ['Date Time'];
      srcChannels.forEach((ch, idx) => {
        const chName = ch.logic_channel_description || `CH${idx + 1}`;
        const unit = ch.unit_in_ascii ? ` - ${ch.unit_in_ascii}` : '';
        dataHeaders.push(`${chName}${unit}`);
      });
      initialText += dataHeaders.join(',') + '\n';

      await writer.write(encoder.encode(initialText));

      const chunkSize = 5000;
      let dataBuffer = [];

      for (let start = 0; start < srcNumSamples; start += chunkSize) {
        const count = Math.min(chunkSize, srcNumSamples - start);
        const rows = await this._readExportPage(start, count);

        for (const row of rows) {
          const dateStr = formatDateTimeDataRow(row.timestampMs);
          const rowValues = [dateStr];
          for (const ch of srcChannels) {
            const v = row.values[ch.channel_id];
            rowValues.push((v == null || Number.isNaN(v)) ? '' : v);
          }
          dataBuffer.push(rowValues.join(','));
        }

        const chunkText = dataBuffer.join('\n') + '\n';
        await writer.write(encoder.encode(chunkText));
        dataBuffer = [];

        if (onProgress) {
          onProgress((start + count) / srcNumSamples);
        }
        await new Promise(resolve => setTimeout(resolve, 0));
      }

    } finally {
      await writer.close();
    }
  },

  async _exportAllChannelsToCsvInMemory(onProgress) {
    const srcChannels = this._exportChannels();
    const srcNumSamples = this._exportNumSamples();
    const srcStartMs = this._exportStartMs();
    const srcStopMs = this._exportStopMs();
    const srcIntervalSec = this._exportIntervalSec();

    const formatDateTimeHeader = (ms) => {
      const date = new Date(ms);
      const day = date.getDate();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');
      const secs = String(date.getSeconds()).padStart(2, '0');
      return `${day}.${month} ${year} ${hours}:${mins}:${secs}`;
    };

    const formatDateTimeDataRow = (ms) => {
      const date = new Date(ms);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');
      const secs = String(date.getSeconds()).padStart(2, '0');
      return `${day}-${month}-${year} ${hours}:${mins}:${secs}`;
    };

    const getResolutionString = (res) => {
      const r = Math.max(0, Math.min(20, res || 0));
      if (r === 0) return '1';
      return (1 / Math.pow(10, r)).toFixed(r);
    };

    const csvChunks = [];

    csvChunks.push(`${_deviceName} Raw Data\n\n`);

    csvChunks.push(`Start Date Time,${formatDateTimeHeader(srcStartMs)}\n`);
    csvChunks.push(`End Date Time,${formatDateTimeHeader(srcStopMs)}\n`);

    csvChunks.push(`Sample Rate(sec),${srcIntervalSec}\n`);

    csvChunks.push(`NO.Of Channels,${srcChannels.length}\n`);
    csvChunks.push(`NO.Of Records,${srcNumSamples}\n\n`);

    csvChunks.push('No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point\n');
    srcChannels.forEach((ch, idx) => {
      const chName = ch.logic_channel_description || `CH${idx + 1}`;
      const sensor = ch.sensor_description || `Sensor ${idx + 1}`;
      const unit = ch.unit_in_ascii || '';
      const resVal = getResolutionString(ch.resolution);
      const locPoint = `Location ${ch.location_id || 1}/${ch.logic_channel_description || 'MP001'}`;
      
      const row = [
        idx + 1,
        chName,
        sensor,
        unit,
        resVal,
        locPoint
      ];
      csvChunks.push(row.join(',') + '\n');
    });

    csvChunks.push('\n');

    const dataHeaders = ['Date Time'];
    srcChannels.forEach((ch, idx) => {
      const chName = ch.logic_channel_description || `CH${idx + 1}`;
      const unit = ch.unit_in_ascii ? ` - ${ch.unit_in_ascii}` : '';
      dataHeaders.push(`${chName}${unit}`);
    });
    csvChunks.push(dataHeaders.join(',') + '\n');

    const chunkSize = 5000;
    let dataBuffer = [];

    for (let start = 0; start < srcNumSamples; start += chunkSize) {
      const count = Math.min(chunkSize, srcNumSamples - start);
      const rows = await this._readExportPage(start, count);

      for (const row of rows) {
        const dateStr = formatDateTimeDataRow(row.timestampMs);
        const rowValues = [dateStr];
        for (const ch of srcChannels) {
          const v = row.values[ch.channel_id];
          rowValues.push((v == null || Number.isNaN(v)) ? '' : v);
        }
        dataBuffer.push(rowValues.join(','));
      }

      if (dataBuffer.length >= 10000) {
        csvChunks.push(dataBuffer.join('\n') + '\n');
        dataBuffer = [];
      }

      if (onProgress) {
        onProgress((start + count) / srcNumSamples);
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (dataBuffer.length > 0) {
      csvChunks.push(dataBuffer.join('\n') + '\n');
    }

    const blob = new Blob(csvChunks, { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const baseName = (_file.name ? _file.name.replace(/\.[^/.]+$/, "") : "export") + (_isMulti() ? "_combined" : "");
    link.setAttribute('download', `${baseName}_all_channels.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  async exportAllChannelsToExcel(onProgress) {
    if (_fileLoaded && _isCsvMode) {
      return CsvAPI.exportAllChannelsToExcel(onProgress);
    }
    if (!_fileLoaded || !_file) {
      throw new Error("No CSD file loaded");
    }

    const srcChannels = this._exportChannels();
    const srcNumSamples = this._exportNumSamples();
    const srcStartMs = this._exportStartMs();
    const srcStopMs = this._exportStopMs();
    const srcIntervalSec = this._exportIntervalSec();

    const LIMIT_800MB = 800 * 1024 * 1024; // 800 MB
    if (srcNumSamples > 1048576 || (_file.size || 0) >= LIMIT_800MB) {
      const msg = `This dataset contains ${srcNumSamples.toLocaleString()} records, ` +
        `which exceeds Excel's maximum worksheet row limit (1,048,576 rows) or memory safe limits.\n\n` +
        `Please export this dataset to CSV format instead.`;
      if (window.showAppNotification) {
        window.showAppNotification("Export Aborted", msg, "warning");
      } else {
        alert("Export Aborted:\n\n" + msg);
      }
      return;
    }

    const escXml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const formatDateTime = (ms) => {
      const d = new Date(ms);
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    };

    const xmlHeader = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Font ss:Size="11"/></Style>
  <Style ss:ID="sTitle"><Font ss:Size="14" ss:Bold="1"/></Style>
  <Style ss:ID="sLabel"><Font ss:Size="11" ss:Bold="1"/></Style>
  <Style ss:ID="sHeader"><Font ss:Size="11" ss:Bold="1"/><Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="CSD Export">
  <Table>`;

    const xmlFooter = `  </Table>
 </Worksheet>
</Workbook>`;

    // ── Metadata header rows ──────────────────────────────────────────────────
    let metaXml = '';

    // Row 1: Title "S4A-Web V2"
    metaXml += '   <Row>\n';
    metaXml += '    <Cell ss:StyleID="sTitle"><Data ss:Type="String">S4A-Web</Data></Cell>\n';
    metaXml += '    <Cell ss:StyleID="sTitle"><Data ss:Type="String">V2</Data></Cell>\n';
    metaXml += '   </Row>\n';

    // Row 2: empty
    metaXml += '   <Row></Row>\n';

    // Row 3: Description / Record File
    metaXml += '   <Row>\n';
    metaXml += '    <Cell ss:StyleID="sLabel"><Data ss:Type="String">Description</Data></Cell>\n';
    metaXml += `    <Cell><Data ss:Type="String">Record File</Data></Cell>\n`;
    metaXml += '   </Row>\n';

    // Row 4: Start Time
    metaXml += '   <Row>\n';
    metaXml += '    <Cell ss:StyleID="sLabel"><Data ss:Type="String">Start Time</Data></Cell>\n';
    metaXml += `    <Cell><Data ss:Type="String">${formatDateTime(srcStartMs)}</Data></Cell>\n`;
    metaXml += '   </Row>\n';

    // Row 5: End Time
    metaXml += '   <Row>\n';
    metaXml += '    <Cell ss:StyleID="sLabel"><Data ss:Type="String">End Time</Data></Cell>\n';
    metaXml += `    <Cell><Data ss:Type="String">${formatDateTime(srcStopMs)}</Data></Cell>\n`;
    metaXml += '   </Row>\n';

    // Row 6: Sample Rate (sec)
    metaXml += '   <Row>\n';
    metaXml += '    <Cell ss:StyleID="sLabel"><Data ss:Type="String">Sample Rate (sec)</Data></Cell>\n';
    metaXml += `    <Cell><Data ss:Type="Number">${srcIntervalSec}</Data></Cell>\n`;
    metaXml += '   </Row>\n';

    // Row 7: empty
    metaXml += '   <Row></Row>\n';

    // Row 8: empty
    metaXml += '   <Row></Row>\n';

    // Row 9: Column headers — TIME + channel descriptions with unit
    metaXml += '   <Row>\n';
    metaXml += '    <Cell ss:StyleID="sHeader"><Data ss:Type="String">TIME</Data></Cell>\n';
    srcChannels.forEach(ch => {
      const desc = ch.logic_channel_description || `Channel ${ch.channel_id}`;
      const unit = ch.unit_in_ascii ? ` (${ch.unit_in_ascii})` : '';
      metaXml += `    <Cell ss:StyleID="sHeader"><Data ss:Type="String">${escXml(desc + unit)}</Data></Cell>\n`;
    });
    metaXml += '   </Row>\n';

    const xmlChunks = [xmlHeader, metaXml];

    const chunkSize = 5000;
    for (let start = 0; start < srcNumSamples; start += chunkSize) {
      const count = Math.min(chunkSize, srcNumSamples - start);
      const rows = await this._readExportPage(start, count);

      let chunkXml = '';
      for (const row of rows) {
        const dateStr = formatDateTime(row.timestampMs);

        chunkXml += '   <Row>\n';
        chunkXml += `    <Cell><Data ss:Type="String">${dateStr}</Data></Cell>\n`;

        for (const ch of srcChannels) {
          const v = row.values[ch.channel_id];
          chunkXml += `    <Cell><Data ss:Type="Number">${(v == null || Number.isNaN(v)) ? '' : v}</Data></Cell>\n`;
        }
        chunkXml += '   </Row>\n';
      }
      xmlChunks.push(chunkXml);

      if (onProgress) {
        onProgress((start + count) / srcNumSamples);
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    xmlChunks.push(xmlFooter);

    const blob = new Blob(xmlChunks, { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const baseName = (_file.name ? _file.name.replace(/\.[^/.]+$/, "") : "export") + (_isMulti() ? "_combined" : "");
    link.setAttribute('download', `${baseName}_all_channels.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  async getConsumptionData(onProgress) {
    if (_fileLoaded && _isCsvMode) {
      return CsvAPI.getConsumptionData(onProgress);
    }
    if (!_fileLoaded || !_file) {
      throw new Error("No CSD file loaded");
    }
    const allRows = [];
    const srcNumSamples = this._exportNumSamples();
    const chunkSize = 10000;
    for (let start = 0; start < srcNumSamples; start += chunkSize) {
      const count = Math.min(chunkSize, srcNumSamples - start);
      const rows = await this._readExportPage(start, count);
      for (const row of rows) {
        allRows.push({ timestampMs: row.timestampMs, values: row.values });
      }
      if (onProgress) {
        onProgress((start + count) / srcNumSamples);
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return allRows;
  }
};

export default CsdAPI;
