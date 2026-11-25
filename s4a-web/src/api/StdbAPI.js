/**
 * StdbAPI.js
 *
 * S332 Proprietary STDB SQLite database reader and query engine.
 * Supports files with "S332DBOF" 64-byte proprietary header followed by standard SQLite 3 DB.
 * Rejects non-stdb or standard SQLite files missing this header signature.
 */

import TauriSutoAPI from './TauriSutoAPI.js';
import StdbWorkerClient from './stdb/WorkerClient.js';

// ── Module State ─────────────────────────────────────────────────────────────
let _file = null;
let _fileLoaded = false;
let _worker = null;
let _sessions = [];
let _activeSession = null;
let _channels = [];
let _startTimeMs = 0;
let _stopTimeMs = 0;
let _sampleRate = 1;
let _numSamples = 0;
let _revision = 0;
let _candidateFileId = null;
let _candidateGeneration = 0;
let _sourceCount = 0;

function sessionList(sessions) {
  return sessions.map(s => ({
    id: s.ID,
    loggerFileName: s.LoggerFileName,
    startTime: s.StartTime,
    startTimeStamp: s.StartTimeStamp,
    endTime: s.EndTime,
    endTimeStamp: s.EndTimeStamp,
    sampleRate: s.SampleRate,
    channelCount: s.ChannelCount,
    descriptions: s.Descriptions,
    raw: s
  }));
}

function applySession(result) {
  _activeSession = result.session;
  _startTimeMs = result.start;
  _stopTimeMs = result.stop;
  _sampleRate = 1 / result.interval;
  _numSamples = result.numSamples;
  _channels = result.channels;
  _fileLoaded = true;
  _revision++;
}

async function closeCandidate(worker) {
  if (!worker || _candidateFileId === null) return;
  const fileId = _candidateFileId;
  _candidateFileId = null;
  try {
    await worker.request('cancelCandidate');
  } finally {
    worker.removeFile(fileId);
  }
}

function reportReadError(error) {
  console.error('[StdbAPI] Read failed:', error);
  if (window.showAppNotification) {
    window.showAppNotification('STDB read failed', error.message, 'error');
  }
}

async function exportSession(format, onProgress) {
  if (!_fileLoaded || !_worker || !_activeSession) throw new Error('No STDB session is loaded.');
  const worker = _worker;
  const revision = _revision;
  const file = _file;
  const numSamples = _numSamples;
  if (format === 'excel' && numSamples > 1048576 - 9) {
    throw new Error('This session exceeds the Excel worksheet row limit. Export it to CSV instead.');
  }
  const extension = format === 'csv' ? 'csv' : 'xls';
  const mime = format === 'csv' ? 'text/csv' : 'application/vnd.ms-excel';
  const baseName = (_activeSession.LoggerFileName || file.name.replace(/\.[^/.]+$/, '') || 'export')
    .replace(/[\\/:*?"<>|]/g, '_');
  const filename = `${baseName}_all_channels.${extension}`;
  let writable;
  if (typeof window.showSaveFilePicker === 'function') {
    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: format === 'csv' ? 'CSV Files' : 'Excel Files', accept: { [mime]: [`.${extension}`] } }]
      });
    } catch (error) {
      if (error.name === 'AbortError') return;
      throw error;
    }
    if (!handle.name.toLowerCase().endsWith(`.${extension}`) || handle.name === file.name) {
      throw new Error(`Choose a separate .${extension} file for the export.`);
    }
    writable = await handle.createWritable();
  }

  const chunks = [];
  let byteCount = 0;
  const checkSession = () => {
    if (_worker !== worker || _revision !== revision) throw new Error('STDB session changed during export.');
  };
  const write = async bytes => {
    checkSession();
    if (writable) {
      await writable.write(bytes);
      checkSession();
    } else {
      byteCount += bytes.byteLength;
      if (byteCount > 64 * 1024 * 1024) {
        throw new Error('This export is too large for an in-memory download. Use a browser with streaming file-save support.');
      }
      chunks.push(bytes);
    }
  };

  try {
    await write(await worker.request('exportHeader', { format }));
    let cursor = null;
    let count = 0;
    while (count < numSamples) {
      const page = await worker.request('exportPage', { format, cursor, limit: 1000 });
      if (!page.count || !page.cursor) throw new Error('STDB export ended before all records were read.');
      await write(page.bytes);
      count += page.count;
      cursor = page.cursor;
      onProgress?.(count / numSamples);
    }
    await write(await worker.request('exportFooter', { format }));
    checkSession();
    if (writable) {
      await writable.close();
    } else {
      const url = URL.createObjectURL(new Blob(chunks, { type: `${mime};charset=utf-8` }));
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        try {
          link.click();
        } finally {
          link.remove();
        }
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    if (!numSamples) onProgress?.(1);
  } catch (error) {
    if (writable) {
      try {
        await writable.abort();
      } catch (abortError) {
        console.error('[StdbAPI] Failed to abort export:', abortError);
      }
    }
    throw error;
  }
}

const StdbAPI = {
  isFileLoaded() {
    return _fileLoaded;
  },

  isStdbMode() {
    return _fileLoaded;
  },

  reset() {
    if (_worker) _worker.close();
    _file = null;
    _fileLoaded = false;
    _worker = null;
    _sessions = [];
    _activeSession = null;
    _channels = [];
    _startTimeMs = 0;
    _stopTimeMs = 0;
    _sampleRate = 1;
    _numSamples = 0;
    _revision++;
    _candidateFileId = null;
    _candidateGeneration++;
    _sourceCount = 0;
  },

  /**
   * Strictly validate the 64-byte proprietary STDB header and ensure it contains SQLite 3 signature at offset 64.
   */
  async detectAndValidate(file) {
    if (!file || file.size < 80) {
      throw new Error("Invalid data file: unsupported or corrupted STDB format.");
    }
    const headerBuf = await file.slice(0, 80).arrayBuffer();
    const header = new Uint8Array(headerBuf);
    const magic = new TextDecoder('ascii').decode(header.slice(0, 8));
    const view = new DataView(headerBuf);
    const dbOffset = view.getUint32(12, true);
    const sqliteMagic = new TextDecoder('ascii').decode(header.slice(64, 79));

    if (magic !== 'S332DBOF' || dbOffset !== 64 || sqliteMagic !== 'SQLite format 3') {
      throw new Error("Invalid data file: unsupported or corrupted STDB format.");
    }
    return true;
  },

  async loadFromFile(file) {
    this.reset();
    await this.detectAndValidate(file);
    const worker = new StdbWorkerClient(file);
    _file = file;
    _worker = worker;
    try {
      const sessions = await worker.request('open', { size: file.size });
      if (_worker !== worker) throw new Error('STDB file was closed.');
      _sessions = sessions;
      window.dispatchEvent(new CustomEvent('stdbSessionsAvailable', {
        detail: {
          file,
          sessions: sessionList(sessions)
        }
      }));
      return { ok: true };
    } catch (error) {
      if (_worker === worker) this.reset();
      throw error;
    }
  },

  async loadSession(sessionOrId) {
    if (!_worker) {
      throw new Error("No STDB database open.");
    }

    let session;
    if (typeof sessionOrId === 'object' && sessionOrId !== null) {
      session = sessionOrId.raw ? sessionOrId.raw : sessionOrId;
    } else {
      session = _sessions.find(s => s.ID === sessionOrId || s.LoggerFileName === sessionOrId);
    }

    if (!session) {
      throw new Error("Session not found in STDB file.");
    }

    const worker = _worker;
    const result = await worker.request('session', { id: session.ID });
    if (_worker !== worker) throw new Error('STDB file was closed.');
    applySession(result);
    _sourceCount = 1;

    TauriSutoAPI.logClientEvent(
      'INFO',
      'FILE',
      `Loaded STDB session "${session.LoggerFileName}": ${_channels.length} channels, ${_numSamples} samples`
    );

    return true;
  },

  async getSessionDetails(id) {
    if (!_worker) throw new Error('No STDB database open.');
    const worker = _worker;
    const details = await worker.request('details', { id });
    if (_worker !== worker) throw new Error('STDB file was closed.');
    return details;
  },

  async openAppendSelection(file = _file) {
    if (!_worker || !_fileLoaded) throw new Error('No STDB session is loaded.');
    const worker = _worker;
    const generation = ++_candidateGeneration;
    await this.detectAndValidate(file);
    if (_worker !== worker || generation !== _candidateGeneration) throw new Error('STDB append selection was cancelled.');
    await closeCandidate(worker);
    if (_worker !== worker || generation !== _candidateGeneration) throw new Error('STDB append selection was cancelled.');
    const fileId = file === _file ? 0 : worker.addFile(file);
    _candidateFileId = fileId;
    try {
      const sessions = await worker.request('openCandidate', { fileId, size: file.size });
      if (_worker !== worker || generation !== _candidateGeneration || _candidateFileId !== fileId) throw new Error('STDB append selection was cancelled.');
      window.dispatchEvent(new CustomEvent('stdbSessionsAvailable', {
        detail: { file, sessions: sessionList(sessions), mode: 'append' }
      }));
    } catch (error) {
      if (_worker === worker && _candidateFileId === fileId) {
        worker.removeFile(fileId);
        _candidateFileId = null;
        window.dispatchEvent(new CustomEvent('stdbSessionsAvailable', {
          detail: { file, sessions: [], mode: 'append' }
        }));
      }
      throw error;
    }
  },

  async cancelAppendSelection() {
    _candidateGeneration++;
    await closeCandidate(_worker);
  },

  async getAppendSessionDetails(id) {
    if (!_worker || _candidateFileId === null) throw new Error('No STDB append selection is pending.');
    return _worker.request('candidateDetails', { id });
  },

  async appendSession(session) {
    if (!_worker || _candidateFileId === null) throw new Error('No STDB append selection is pending.');
    const worker = _worker;
    const fileId = _candidateFileId;
    const result = await worker.request('appendSession', { id: session.id });
    if (_worker !== worker || _candidateFileId !== fileId) throw new Error('STDB append selection was cancelled.');
    _candidateFileId = null;
    applySession(result);
    _sourceCount++;
  },

  getNumLoadedFiles() {
    return _sourceCount;
  },

  getSessions() {
    return _sessions;
  },

  getActiveSession() {
    return _activeSession;
  },

  getFileTimeRange() {
    return { start: _startTimeMs, stop: _stopTimeMs };
  },

  getLoadedFileName() {
    if (_activeSession && _activeSession.LoggerFileName) {
      return _activeSession.LoggerFileName;
    }
    return _file ? _file.name : '';
  },

  getNumOfSamples() {
    return _numSamples;
  },

  getSampleRate() {
    return _sampleRate;
  },

  getLocations(callback) {
    setTimeout(() => callback({
      locations: [{
        location_id: 0,
        description: _activeSession?.LoggerFileName || '',
        location_index: 0,
        background_img: '',
        sensors: []
      }]
    }), 50);
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
        min: ch.min,
        max: ch.max,
      }))
    }), 50);
  },

  getTablePage(pageIndex, pageSize, selectedChannelIds, callback) {
    if (!_fileLoaded || !_worker || !_activeSession) {
      setTimeout(() => callback({ total: 0, rows: [] }), 50);
      return;
    }
    const worker = _worker;
    worker.request('page', { pageIndex, pageSize, selected: selectedChannelIds }).then(callback).catch(error => {
      if (_worker === worker) reportReadError(error);
      callback({ total: 0, rows: [], error: error.message });
    });
  },

  getMeasurementData(channelId, startTime, stopTime, tableInterval, getDataWay, callback) {
    if (!_fileLoaded || !_worker || !_activeSession) {
      callback([]);
      return;
    }
    const worker = _worker;
    worker.request('measurement', { channelId, start: startTime, stop: stopTime }).then(callback).catch(error => {
      if (_worker === worker) reportReadError(error);
      callback([]);
    });
  },

  getMutilMeasurementData(channelIds, startTime, tableInterval, getDataWay, callback) {
    if (!channelIds || channelIds.length === 0) {
      callback([]);
      return;
    }
    const stopTime = _stopTimeMs > _startTimeMs
      ? (_stopTimeMs + 3600000 * 8)
      : (startTime + 3600000 * 24);
    this.getMeasurementData(channelIds[0], startTime, stopTime, tableInterval, getDataWay, callback);
  },

  getUserSettings(username, callback) {
    if (!_fileLoaded) {
      setTimeout(() => callback([]), 50);
      return;
    }

    // Default select channels that have valid data, or first 2 channels
    const channelsWithData = _channels.filter(ch => (ch.max !== null && ch.max !== 0) || (ch.min !== null && ch.min !== 0));
    const sorted = channelsWithData.length > 0 ? channelsWithData : _channels;
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
      display_channel_option_id: 1000 + ch.channel_id,
    }));

    setTimeout(() => callback([{
      alias_name: username || 'STDB',
      createddate: _startTimeMs,
      display_channel_option: displayChannelOption,
      username: username || 'stdb',
    }]), 50);
  },

  async exportAllChannelsToCsv(onProgress) {
    return exportSession('csv', onProgress);
  },

  async exportAllChannelsToExcel(onProgress) {
    return exportSession('excel', onProgress);
  },
};

export default StdbAPI;
