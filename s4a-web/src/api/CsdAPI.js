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

// IndexedDB database name / store for file handles
const IDB_NAME = 'CsdFilesDB';
const IDB_STORE = 'fileHandles';

// ── Module state ──────────────────────────────────────────────────────────────

let _file = null;   // File | FileSystemFileHandle — kept open for lazy reads
let _fileLoaded = false;
let _channels = [];
let _startTimeMs = 0;
let _stopTimeMs = 0;
let _sampleRate = 1;      // Hz (computed)
let _numSamples = 0;
let _numChannels = 0;
let _dataStart = 0;      // byte offset where records begin
let _recordLen = 0;      // bytes per record
let _deviceName = 'CSD Device';
let _sampleIntervalSec = 1;

let _onFileLoadedCallbacks = [];

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
async function _readSlice(file, offset, length) {
  const blob = file.slice(offset, offset + length);
  const buffer = await blob.arrayBuffer();
  return new DataView(buffer);
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
 * Parse file / protocol / channel headers from `file` (File object or
 * anything with a `.slice(start,end)` → Blob interface).
 * Populates module-level state; does NOT read sample data.
 */
async function _parseHeaders(file) {
  // ── File info header (34 bytes starting at byte 0) ──
  try {
    const fh = await _readSlice(file, 0, FILE_HEADER_LEN);
    const version = fh.getInt32(0, false);
    const identifier = _decodeStr(fh, 4, 10);
    console.log(`[CsdAPI] File Info Header parsed - Version: ${version}, Identifier: "${identifier}"`);
    
    if (version < 1 || version > 100 || !identifier.includes('SUTO CSD')) {
      console.warn(`[CsdAPI] Warning: Possibly invalid CSD file signature (Version: ${version}, Identifier: "${identifier}")`);
    }
  } catch (err) {
    console.warn('[CsdAPI] Failed to parse File Info Header:', err);
  }

  // ── Protocol header (3552 bytes starting at byte 34) ──
  const ph = await _readSlice(file, PROTOCOL_HEADER_START, PROTOCOL_HEADER_LEN);

  _deviceName = _decodeStr(ph, 506, 32) || 'CSD Device';

  let rawChannels = ph.getInt32(3016, false);
  let rawSamples = ph.getInt32(3020, false);
  const sampleRateRaw = ph.getInt32(3024, false);

  const fileSize = file.size || 0;
  if (fileSize > 0) {
    const maxPossibleChannels = Math.floor(fileSize / CHANNEL_HEADER_LEN);
    if (rawChannels <= 0 || rawChannels > maxPossibleChannels) {
      console.warn(`[CsdAPI] Parsed invalid channel count (${rawChannels}). Defaulting to 9.`);
      rawChannels = 9;
    }
  } else {
    if (rawChannels <= 0) {
      rawChannels = 9;
    }
  }
  _numChannels = rawChannels;

  if (fileSize > 0) {
    const recordLen = RECORD_ID_LEN + _numChannels * CHANNEL_VALUE_LEN;
    const maxPossibleSamples = Math.floor(fileSize / recordLen);
    if (rawSamples < 0 || rawSamples > maxPossibleSamples) {
      console.warn(`[CsdAPI] Parsed invalid sample count (${rawSamples}). Defaulting to 0.`);
      rawSamples = 0;
    }
  } else {
    if (rawSamples < 0) {
      rawSamples = 0;
    }
  }
  _numSamples = rawSamples;

  let rawStart = Number(ph.getBigInt64(3032, false));
  let rawStop = Number(ph.getBigInt64(3040, false));

  const MAX_TS = 8640000000000000;
  if (Math.abs(rawStart) > MAX_TS) rawStart = 0;
  if (Math.abs(rawStop) > MAX_TS) rawStop = 0;

  _startTimeMs = rawStart;
  _sampleIntervalSec = sampleRateRaw > 0 ? sampleRateRaw : 1;
  _sampleRate = 1 / _sampleIntervalSec;

  if (_startTimeMs <= 0) _startTimeMs = Date.now() - 3600000;
  
  // Calculate stop time based on start time, sample count, and exact interval
  _stopTimeMs = _startTimeMs + _numSamples * _sampleIntervalSec * 1000;

  // ── Channel headers (918 bytes each) ──
  _channels = [];
  for (let i = 0; i < _numChannels; i++) {
    const chStart = CHANNEL_HEADERS_START + i * CHANNEL_HEADER_LEN;
    const ch = await _readSlice(file, chStart, CHANNEL_HEADER_LEN);

    // pref = int64 at byte 0
    const pref = Number(ch.getBigInt64(0, false));
    const sensorId = ch.getInt32(CHANNEL_HEADER_LEN - 918 + 752 + 28, false); // fieldPos 752+28

    // Channel description: int16 length + up to 128 bytes at offset 8
    const descLen = ch.getInt16(8, false);
    const desc = _decodeStr(ch, 10, Math.min(descLen, 126)) || `Channel ${i}`;

    // Sub-device desc: length at 8+2+128 = 138
    const subLen = ch.getInt16(138, false);
    const subDesc = _decodeStr(ch, 140, Math.min(subLen, 126));

    // Device desc: at 138+2+128 = 268 
    const devLen = ch.getInt16(268, false);
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

    const sensorIdVal = ch.getInt32(statsBase + 28, false);
    const resolution = ch.getInt32(statsBase, false);

    _channels.push({
      channel_id: i,
      location_id: 1,
      sensor_id: sensorIdVal || i,
      pref,
      logic_channel_description: desc,
      physical_channel_description: desc,
      sensor_description: senDesc,
      unit_in_ascii: unitText,
      _min: isFinite(minVal) ? minVal : 0,
      _max: isFinite(maxVal) ? maxVal : 0,
      resolution: isFinite(resolution) ? resolution : 0,
    });
  }

  // ── Data record geometry ──
  _dataStart = CHANNEL_HEADERS_START + _numChannels * CHANNEL_HEADER_LEN;
  _recordLen = RECORD_ID_LEN + _numChannels * CHANNEL_VALUE_LEN;

  console.log(`[CsdAPI] Parsed ${_numChannels} channels, ${_numSamples} samples @ ${_sampleRate.toFixed(3)} Hz`);
  console.log(`[CsdAPI] Time range: ${new Date(_startTimeMs).toISOString()} → ${new Date(_stopTimeMs).toISOString()}`);
  console.log('[CsdAPI] Channels:', _channels.map(c => `[${c.channel_id}] "${c.logic_channel_description}" (${c.unit_in_ascii})`));
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

  // Optimization 1: If the byte span is small (< 5MB), read the entire block at once
  if (spanBytes < 5 * 1024 * 1024) {
    const recordStart = _dataStart + startSample * _recordLen;
    const dv = await _readSlice(file, recordStart, spanBytes);
    for (let s = 0; s < totalRecords; s += step) {
      const recordOffset = s * _recordLen;
      const v = dv.getFloat64(recordOffset + chByteOffset, false);
      values.push((v <= DATA_OVERRANGE) ? null : v);
    }
    return values;
  }

  // Optimization 2: For massive ranges, read sampled points in parallel
  const promises = [];
  for (let s = startSample; s <= endSample; s += step) {
    const recordStart = _dataStart + s * _recordLen;
    promises.push(_readSlice(file, recordStart + chByteOffset, CHANNEL_VALUE_LEN));
  }
  const slices = await Promise.all(promises);
  for (const dv of slices) {
    const v = dv.getFloat64(0, false);
    values.push((v <= DATA_OVERRANGE) ? null : v);
  }
  return values;
}

// ── File-load entry point ─────────────────────────────────────────────────────

async function _loadFromFile(file) {
  if (typeof localStorage !== 'undefined' && localStorage) {
    try {
      localStorage.removeItem('selectedChannels');
    } catch (e) {
      console.warn('[CsdAPI] Failed to access localStorage:', e);
    }
  }
  _fileLoaded = false;

  let fileToLoad = file;
  const LIMIT = 800 * 1024 * 1024; // 800 MB
  if (file.size && file.size < LIMIT && typeof file.arrayBuffer === 'function') {
    try {
      console.log(`[CsdAPI] File size (${(file.size / 1024 / 1024).toFixed(2)} MB) is under 800MB. Loading completely into memory...`);
      const fullBuffer = await file.arrayBuffer();
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
      fileToLoad = file;
    }
  }

  try {
    await _parseHeaders(fileToLoad);
  } catch (err) {
    console.error('[CsdAPI] Header parse failed:', err);
    return false;
  }

  _file = fileToLoad;
  _fileLoaded = true;
  _onFileLoadedCallbacks.forEach(fn => fn());
  return true;
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
async function _openWithFSA() {
  let handles;
  try {
    handles = await window.showOpenFilePicker({
      types: [{ description: 'CSD Files', accept: { 'application/octet-stream': ['.csd'] } }],
      multiple: false,
    });
  } catch (e) {
    if (e.name !== 'AbortError') console.error('[CsdAPI] showOpenFilePicker error:', e);
    return;
  }

  const handle = handles[0];
  const file = await handle.getFile();

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
  _fileInput.accept = '.csd';
  _fileInput.style.display = 'none';
  document.body.appendChild(_fileInput);

  _fileInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csd')) {
      alert('Only .csd files are supported!');
      _fileInput.value = '';
      return;
    }
    _saveRecentMeta(file.name, file.size);
    await _loadFromFile(file);
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
      _openWithFSA();
    } else {
      _ensureFileInput();
      _fileInput.click();
    }
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

  getFileTimeRange() { return { start: _startTimeMs, stop: _stopTimeMs }; },

  getTablePage(pageIndex, pageSize, selectedChannelIds, callback) {
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


  // ── Standard MockAPI-compatible methods ─────────────────────────────────────

  getUserSettings(username, callback) {
    if (!_fileLoaded) {
      setTimeout(() => callback([]), 50);
      return;
    }

    // Pick up to 2 default channels (prefer flow-related units)
    const flowPriority = _channels.filter(ch => {
      const u = (ch.unit_in_ascii || '').toLowerCase();
      const d = (ch.logic_channel_description || '').toLowerCase();
      return u.includes('m') || u.includes('flow') || d.includes('m³') || d.includes('m3') || d.includes('flow');
    });
    const sorted = [...flowPriority, ..._channels.filter(ch => !flowPriority.includes(ch))];
    const defaults = sorted.slice(0, 2);

    const COLORS = ['#00B8D9', '#FF5630', '#36B37E', '#6554C0', '#FF8B00',
      '#0052CC', '#00875A', '#FF4081', '#FFC107', '#7B1FA2'];

    const displayChannelOption = defaults.map((ch, idx) => ({
      channel_id: {
        channel_id: ch.channel_id,
        logic_channel_description: ch.logic_channel_description,
        physical_channel_description: ch.physical_channel_description,
        sensor_id: ch.sensor_id,
      },
      color: COLORS[idx % COLORS.length],
      display_channel_option_id: 1000 + ch.channel_id,
    }));

    setTimeout(() => callback([{
      alias_name: username || 'CSD',
      createddate: _startTimeMs,
      display_channel_option: displayChannelOption,
      username: username || 'csd',
    }]), 50);
  },

  getChannels(callback) {
    if (!_fileLoaded) {
      setTimeout(() => callback({ logging_chs: [] }), 50);
      return;
    }
    setTimeout(() => callback({
      logging_chs: _channels.map(ch => ({
        channel_id: ch.channel_id,
        location_id: ch.location_id,
        sensor_id: ch.sensor_id,
        logic_channel_description: ch.logic_channel_description,
        physical_channel_description: ch.physical_channel_description,
        sensor_description: ch.sensor_description,
        unit_in_ascii: ch.unit_in_ascii,
        resolution: ch.resolution,
      }))
    }), 50);
  },

  getMeasurementData(channelId, startTime, stopTime, tableInterval, getDataWay, callback) {
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

  getMutilMeasurementData(channelIds, startTime, tableInterval, getDataWay, callback) {
    if (!channelIds || channelIds.length === 0) { callback([]); return; }
    const stopTime = _stopTimeMs > _startTimeMs
      ? (_stopTimeMs + 3600000 * 8)
      : startTime + 3600000 * 24;
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

  async exportAllChannelsToCsv(onProgress) {
    if (!_fileLoaded || !_file) {
      throw new Error("No CSD file loaded");
    }

    // Helper to format date for header (e.g., "14.May 2026 10:14")
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

    // Helper to format date for data row (e.g., "14-05-2026 10:14:35")
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

    // Helper to format resolution
    const getResolutionString = (res) => {
      const r = Math.max(0, Math.min(20, res || 0));
      if (r === 0) return '1';
      return (1 / Math.pow(10, r)).toFixed(r);
    };

    const csvContentRows = [];

    // 1. Device title (e.g. "S332 Raw Data")
    csvContentRows.push(`${_deviceName} Raw Data`);
    csvContentRows.push(''); // Empty line

    // 2. Start / End Date Time
    csvContentRows.push(`Start Date Time,${formatDateTimeHeader(_startTimeMs)}`);
    csvContentRows.push(`End Date Time,${formatDateTimeHeader(_stopTimeMs)}`);

    // 3. Sample Rate (sec)
    csvContentRows.push(`Sample Rate(sec),${_sampleIntervalSec}`);

    // 4. No. of Channels
    csvContentRows.push(`NO.Of Channels,${_numChannels}`);
    csvContentRows.push(`NO.Of Records,${_numSamples}`);
    csvContentRows.push(''); // Empty line

    // 5. Channel Metadata Table
    csvContentRows.push('No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point');
    _channels.forEach((ch, idx) => {
      const chName = ch.logic_channel_description || `CH${idx + 1}`;
      const sensor = ch.sensor_description || `Sensor ${idx + 1}`;
      const unit = ch.unit_in_ascii || '';
      const resVal = getResolutionString(ch.resolution);
      const locPoint = `Location ${ch.location_id || 1}/${ch.logic_channel_description || 'MP001'}`;
      
      const row = [
        idx + 1,
        `"${chName.replace(/"/g, '""')}"`,
        `"${sensor.replace(/"/g, '""')}"`,
        `"${unit.replace(/"/g, '""')}"`,
        resVal,
        `"${locPoint.replace(/"/g, '""')}"`
      ];
      csvContentRows.push(row.join(','));
    });

    csvContentRows.push(''); // Empty line

    // 6. Data Header Row
    const dataHeaders = ['No.', 'Date Time'];
    _channels.forEach((ch, idx) => {
      const chName = ch.logic_channel_description || `CH${idx + 1}`;
      const unit = ch.unit_in_ascii ? ` - ${ch.unit_in_ascii}` : '';
      dataHeaders.push(`"${(chName + unit).replace(/"/g, '""')}"`);
    });
    csvContentRows.push(dataHeaders.join(','));

    // 7. Data Rows
    const chunkSize = 5000;
    for (let start = 0; start < _numSamples; start += chunkSize) {
      const end = Math.min(start + chunkSize, _numSamples);
      const count = end - start;
      const offset = _dataStart + start * _recordLen;
      const byteLength = count * _recordLen;

      const dv = await _readSlice(_file, offset, byteLength);

      for (let i = 0; i < count; i++) {
        const recordIndex = start + i;
        const recordOffset = i * _recordLen;

        const timestampMs = _startTimeMs + (recordIndex / _sampleRate) * 1000;
        const dateStr = formatDateTimeDataRow(timestampMs);

        const rowValues = [recordIndex + 1, dateStr];

        for (let c = 0; c < _numChannels; c++) {
          const valOffset = recordOffset + RECORD_ID_LEN + c * CHANNEL_VALUE_LEN;
          const v = dv.getFloat64(valOffset, false);
          if (v <= DATA_OVERRANGE) {
            rowValues.push('');
          } else {
            rowValues.push(v);
          }
        }
        csvContentRows.push(rowValues.join(','));
      }

      if (onProgress) {
        onProgress(end / _numSamples);
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const csvString = csvContentRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const baseName = _file.name ? _file.name.replace(/\.[^/.]+$/, "") : "export";
    link.setAttribute('download', `${baseName}_all_channels.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  async exportAllChannelsToExcel(onProgress) {
    if (!_fileLoaded || !_file) {
      throw new Error("No CSD file loaded");
    }

    const xmlHeader = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="CSD Export">
  <Table>`;

    const xmlFooter = `  </Table>
 </Worksheet>
</Workbook>`;

    // Prepare XML header row
    let headerRow = '   <Row>\n';
    headerRow += '    <Cell><Data ss:Type="String">Timestamp</Data></Cell>\n';
    headerRow += '    <Cell><Data ss:Type="String">Record ID</Data></Cell>\n';
    _channels.forEach(ch => {
      const desc = ch.logic_channel_description || `Channel ${ch.channel_id}`;
      const unit = ch.unit_in_ascii ? ` (${ch.unit_in_ascii})` : '';
      const escaped = `${desc}${unit}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      headerRow += `    <Cell><Data ss:Type="String">${escaped}</Data></Cell>\n`;
    });
    headerRow += '   </Row>\n';

    const xmlChunks = [xmlHeader, headerRow];

    const chunkSize = 5000;
    for (let start = 0; start < _numSamples; start += chunkSize) {
      const end = Math.min(start + chunkSize, _numSamples);
      const count = end - start;
      const offset = _dataStart + start * _recordLen;
      const byteLength = count * _recordLen;

      const dv = await _readSlice(_file, offset, byteLength);

      let chunkXml = '';
      for (let i = 0; i < count; i++) {
        const recordIndex = start + i;
        const recordOffset = i * _recordLen;
        const recordId = dv.getInt32(recordOffset, false);

        const timestampMs = _startTimeMs + (recordIndex / _sampleRate) * 1000;
        const dateStr = new Date(timestampMs).toISOString();

        chunkXml += '   <Row>\n';
        chunkXml += `    <Cell><Data ss:Type="String">${dateStr}</Data></Cell>\n`;
        chunkXml += `    <Cell><Data ss:Type="Number">${recordId}</Data></Cell>\n`;

        for (let c = 0; c < _numChannels; c++) {
          const valOffset = recordOffset + RECORD_ID_LEN + c * CHANNEL_VALUE_LEN;
          const v = dv.getFloat64(valOffset, false);
          if (v <= DATA_OVERRANGE) {
            chunkXml += '    <Cell><Data ss:Type="String"></Data></Cell>\n';
          } else {
            chunkXml += `    <Cell><Data ss:Type="Number">${v}</Data></Cell>\n`;
          }
        }
        chunkXml += '   </Row>\n';
      }
      xmlChunks.push(chunkXml);

      if (onProgress) {
        onProgress(end / _numSamples);
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    xmlChunks.push(xmlFooter);

    const blob = new Blob(xmlChunks, { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const baseName = _file.name ? _file.name.replace(/\.[^/.]+$/, "") : "export";
    link.setAttribute('download', `${baseName}_all_channels.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

export default CsdAPI;
