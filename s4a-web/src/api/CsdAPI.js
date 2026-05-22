/**
 * CsdAPI.js
 *
 * A drop-in replacement for MockAPI that reads real .csd binary files
 * via a Dart-compiled WebAssembly module (csd_handler.wasm).
 *
 * API surface matches MockAPI.js so TestAPI.js can swap them transparently.
 *
 * How it works:
 * NOTE: csd_handler.mjs lives in /public and is loaded at runtime via @vite-ignore dynamic import.
 *       It MUST NOT be bundled by Vite — the Dart Wasm runtime requires its function
 *       references to remain intact.
 *       csd_handler.wasm also lives in /public and is fetched by URL.
 */

// ── State ─────────────────────────────────────────────────────────────────────

let _wasmReady = false;         // Dart Wasm module is initialised
let _wasmLoading = false;       // prevent concurrent loads
let _bridge = null;             // globalThis.csdBridge set by Dart main()
let _fileLoaded = false;        // a .csd file has been parsed
let _pendingCallbacks = [];     // callbacks queued before Wasm is ready

// Channel cache populated after file load
let _channels = [];             // [{channel_id, logic_channel_description, unit_in_ascii, ...}]
let _startTimeMs = 0;           // CSD file start timestamp (ms since epoch)
let _stopTimeMs = 0;            // CSD file stop timestamp
let _sampleRate = 1;            // Hz

// ── Wasm bootstrap ────────────────────────────────────────────────────────────

async function _initWasm() {
  if (_wasmReady || _wasmLoading) return;
  _wasmLoading = true;

  try {
    // Vite 8 hard-blocks any import() whose path resolves to /public, even with @vite-ignore.
    // Workaround: fetch the .mjs as raw text, wrap it in a Blob URL, then import that.
    // Vite sees `import(blobUrl)` where blobUrl is a runtime variable — it cannot
    // statically analyze the path, so it never triggers the /public block.
    // The .mjs content is also delivered byte-for-byte with no Vite transformation,
    // which is required — the Dart Wasm bootstrap's import object must be exact.
    const mjsText = await fetch('/csd_handler.mjs').then(r => r.text());
    const blobUrl = URL.createObjectURL(new Blob([mjsText], { type: 'application/javascript' }));
    const dartModule = await import(/* @vite-ignore */ blobUrl);
    URL.revokeObjectURL(blobUrl);

    // Fetch + compile the Wasm binary from /public
    const compiled = await dartModule.compileStreaming(fetch('/csd_handler.wasm'));

    // Instantiate — runs Dart main(), which sets globalThis.csdBridge
    const app = await compiled.instantiate({});
    app.invokeMain();

    _bridge = globalThis.csdBridge;
    _wasmReady = true;
    console.log('[CsdAPI] Dart Wasm module ready');

    // Flush any callbacks waiting for Wasm
    _pendingCallbacks.forEach(fn => fn());
    _pendingCallbacks = [];
  } catch (err) {
    console.error('[CsdAPI] Failed to load Wasm module:', err);
  } finally {
    _wasmLoading = false;
  }
}

// Start loading immediately when this module is imported
_initWasm();

// ── File picker ───────────────────────────────────────────────────────────────

let _fileInput = null;
let _onFileLoadedCallbacks = [];

function _ensureFileInput() {
  if (_fileInput) return;
  _fileInput = document.createElement('input');
  _fileInput.type = 'file';
  _fileInput.accept = '.csd';
  _fileInput.style.display = 'none';
  document.body.appendChild(_fileInput);

  _fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await _loadCsdFile(file);
    // Reset so the same file can be re-selected
    _fileInput.value = '';
  });
}

async function _loadCsdFile(file) {
  if (!_wasmReady) {
    console.warn('[CsdAPI] Wasm not ready yet, waiting...');
    await new Promise(resolve => _pendingCallbacks.push(resolve));
  }

  console.log('[CsdAPI] Reading file:', file.name, `(${(file.size / 1024).toFixed(1)} KB)`);

  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Hand bytes to the Dart bridge
  _bridge.loadFromBytes(uint8Array);

  if (!_bridge.isLoaded()) {
    console.error('[CsdAPI] Dart failed to parse the CSD file');
    return;
  }

  _fileLoaded = true;

  // Cache metadata
  const numChannels = _bridge.getNumOfChannels();
  const descriptions = _bridge.getChannelDescriptions();
  const unitTexts = _bridge.getUnitTexts();
  const mins = _bridge.getChannelMins();
  const maxs = _bridge.getChannelMaxs();

  _sampleRate = Math.max(1, _bridge.getSampleRate());
  _startTimeMs = _bridge.getTimeOfFirstSample();
  _stopTimeMs = _bridge.getStopTime();

  // Normalise timestamps — CSD stores ms since epoch
  if (_startTimeMs <= 0) _startTimeMs = Date.now() - 3600000;
  if (_stopTimeMs <= _startTimeMs) _stopTimeMs = _startTimeMs + (_bridge.getNumOfSamples() / _sampleRate) * 1000;

  // Build channel list in the same shape as MockAPI / RealAPI
  _channels = [];
  for (let i = 0; i < numChannels; i++) {
    _channels.push({
      channel_id: i,
      location_id: 1,
      sensor_id: i,
      logic_channel_description: descriptions[i] || `Channel ${i}`,
      physical_channel_description: descriptions[i] || `Channel ${i}`,
      sensor_description: descriptions[i] || `Channel ${i}`,
      unit_in_ascii: unitTexts[i] || '',
      _min: mins[i] ?? 0,
      _max: maxs[i] ?? 0,
    });
  }

  console.log(`[CsdAPI] Loaded ${numChannels} channels, ${_bridge.getNumOfSamples()} samples @ ${_sampleRate} Hz`);
  console.log(`[CsdAPI] Time range: ${new Date(_startTimeMs).toISOString()} → ${new Date(_stopTimeMs).toISOString()}`);

  // Notify all listeners
  _onFileLoadedCallbacks.forEach(fn => fn());
  _onFileLoadedCallbacks = [];
}

// ── Helper: pick default channels (first 2, prefer m³/h unit) ────────────────

function _pickDefaultChannels() {
  if (_channels.length === 0) return [];

  // Prefer channels whose unit or description contains m³/h (or similar flow units)
  const flowPriority = _channels.filter(ch => {
    const u = (ch.unit_in_ascii || '').toLowerCase();
    const d = (ch.logic_channel_description || '').toLowerCase();
    return u.includes('m') || u.includes('flow') || d.includes('m³') || d.includes('m3') || d.includes('flow');
  });

  const sorted = [...flowPriority, ..._channels.filter(ch => !flowPriority.includes(ch))];
  return sorted.slice(0, 2);
}

// ── Sampling helper ───────────────────────────────────────────────────────────

function _computeSamplingStep(startSample, endSample, maxPoints = 3000) {
  const range = endSample - startSample + 1;
  return Math.max(1, Math.floor(range / maxPoints));
}

function _timeToSampleIndex(timeMs) {
  if (_sampleRate <= 0) return 0;
  const offsetMs = timeMs - _startTimeMs;
  return Math.max(0, Math.floor((offsetMs / 1000) * _sampleRate));
}

// ── CsdAPI public interface (matches MockAPI shape) ───────────────────────────

const CsdAPI = {

  /**
   * Open a file picker so the user can select a .csd file.
   * Call this from the UI "Open CSD File" button.
   */
  openFile() {
    if (!_wasmReady) {
      console.warn('[CsdAPI] Wasm not ready yet, retrying in 500ms...');
      setTimeout(() => CsdAPI.openFile(), 500);
      return;
    }
    _ensureFileInput();
    _fileInput.click();
  },

  /**
   * Register a callback to be called once when a file finishes loading.
   */
  onFileLoaded(callback) {
    if (_fileLoaded) {
      // Already loaded — call immediately
      setTimeout(callback, 0);
    } else {
      _onFileLoadedCallbacks.push(callback);
    }
  },

  isFileLoaded() {
    return _fileLoaded;
  },

  // ── API methods (same signature as MockAPI / RealAPI) ─────────────────────

  getUserSettings(username, callback) {
    if (!_fileLoaded) {
      // No file yet — return an empty settings object
      // The UI will show a "no channels" state
      setTimeout(() => callback([]), 50);
      return;
    }

    const defaultChannels = _pickDefaultChannels();

    // Build display_channel_option in the shape GraphicView expects
    const COLORS = ['#00B8D9', '#FF5630', '#36B37E', '#6554C0', '#FF8B00',
                    '#0052CC', '#00875A', '#FF4081', '#FFC107', '#7B1FA2'];
    const displayChannelOption = defaultChannels.map((ch, idx) => ({
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
      }))
    }), 50);
  },

  getMeasurementData(channelId, startTime, stopTime, tableInterval, getDataWay, callback) {
    if (!_fileLoaded) {
      setTimeout(() => callback([]), 50);
      return;
    }

    const chIdx = parseInt(channelId, 10);
    if (chIdx < 0 || chIdx >= _channels.length) {
      setTimeout(() => callback([]), 50);
      return;
    }

    const ch = _channels[chIdx];
    const totalSamples = _bridge.getNumOfSamples();

    // Convert time range to sample indices
    let startSample = _timeToSampleIndex(startTime);
    let endSample   = _timeToSampleIndex(stopTime);

    // Clamp to valid range
    startSample = Math.max(0, Math.min(startSample, totalSamples - 1));
    endSample   = Math.max(startSample, Math.min(endSample, totalSamples - 1));

    const samplingStep = _computeSamplingStep(startSample, endSample);
    const actualStartMs = _startTimeMs + (startSample / _sampleRate) * 1000;
    const pointIntervalMs = (samplingStep / _sampleRate) * 1000;

    // Get raw float64 samples from Dart/Wasm
    const rawData = _bridge.getChannelData(chIdx, startSample, endSample, samplingStep);

    // Filter out special sentinel values (-9999, -8888 etc.)
    const values = [];
    for (let i = 0; i < rawData.length; i++) {
      const v = rawData[i];
      if (v <= -8880) {
        values.push(null); // will be treated as gap
      } else {
        values.push(v);
      }
    }

    setTimeout(() => callback([{
      channel_id: channelId,
      measurementData: [values],
      realStartTime: [actualStartMs],
      pointInterval: [pointIntervalMs],
      min: ch._min,
      max: ch._max,
    }]), 0);
  },

  getMutilMeasurementData(channelIds, startTime, tableInterval, getDataWay, callback) {
    if (!channelIds || channelIds.length === 0) {
      callback([]);
      return;
    }
    // Delegate to single-channel method for the first channel (consistent with MockAPI)
    const stopTime = _stopTimeMs > _startTimeMs ? _stopTimeMs : startTime + 3600000 * 24;
    this.getMeasurementData(channelIds[0], startTime, stopTime, tableInterval, getDataWay, callback);
  },

  getLocations(callback) {
    setTimeout(() => callback({
      locations: [{
        location_id: 1,
        description: 'CSD File',
        location_index: 0,
        background_img: '',
        sensors: [],
      }]
    }), 50);
  },

  // ── Stubs (unused in CSD mode but required to avoid crashes) ──────────────
  getDevices(callback) { if (callback) callback([]); },
  getBackupSettings(callback) { if (callback) callback({}); },
  updateBackupSettings(json, callback) { if (callback) callback({}); },
  getUsers(callback) { if (callback) callback([]); },
  checkUserExist(username, callback) { if (callback) callback([]); },
  addUser(json, callback) { if (callback) callback({}); },
  modifyPsw(username, newpsw, oldpsw, callback) { if (callback) callback({}); },
  deleteUser(username, callback) { if (callback) callback({}); },
  getFileList(callback) { if (callback) callback([]); },
  getFileChannelBean(fileType, fileId, groupId, callback) { if (callback) callback({}); },
  initUserUploadDownLoad(user, callback) { if (callback) callback({}); },
  getUserUploadDownloadProgress(user, callback) { if (callback) callback({}); },
  getSampleList(callback) { if (callback) callback([]); },
  getSampleInfo(sid, callback) { if (callback) callback({}); },
  getSampleInfoGroup(groupId, callback) { if (callback) callback([]); },
  login(username, password, callback) { if (callback) callback({}); },
  getManualAddDevice(deviceids, callback) { if (callback) callback({}); },
  refreshChannelValues(ids, callback) { if (callback) callback([]); },
  getRegisterInfo(callback) { if (callback) callback({}); },
  getRegistration(callback) { if (callback) callback({}); },
  updateRegistration(json, callback) { if (callback) callback({}); },
  getReportBasicSetting(callback) { if (callback) callback({}); },
  changeReportBasicSetting(json, callback) { if (callback) callback({}); },
  getReportCostCurrency(callback) { if (callback) callback({}); },
  getReportList(callback) { if (callback) callback([]); },
  changeReportCost(json, callback) { if (callback) callback({}); },
  newReport(json, callback) { if (callback) callback({}); },
  deleteReport(reportId, callback) { if (callback) callback({}); },
  getReportData(rid, startTime, timeType, callback) { if (callback) callback({}); },
  getLocationNDevice(callback) { if (callback) callback({}); },
  getDetectedResult(callback) { if (callback) callback({}); },
  postLocations(json, callback) { if (callback) callback({}); },
  getAlarms(callback) { if (callback) callback([]); },
  getAlarmHistorys(startTime, endTime, startIndex, type, callback) { if (callback) callback([]); },
  getAlarmTime(orderStr, callback) { if (callback) callback({}); },
  getLocations4Alarms(callback) { if (callback) callback({}); },
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
  getLoggingChannels(callback) { if (callback) callback({ logging_chs: [] }); },
  saveSensorPosition(id, x, y, callback) { if (callback) callback({}); },
};

export default CsdAPI;
