/**
 * ApiDevice.js
 *
 * VirtualDevice driver for network-connected SUTO S332 devices exposing WebAPI
 * over HTTP / SSE / WebSocket.
 *
 * Capabilities:
 *  - Channel list discovery (GET /channel/list)
 *  - Real-time online readings via polling / SSE
 *  - System info query (GET /system/device-info)
 *  - Logger status & config (GET /logger/configuration, GET /logger/status-sub)
 *  - Logger files inventory (GET /logger/all-records)
 *  - Paged logger data retrieval & CSV compilation (GET /logger/data-get-by-page)
 */

import { resolveChannelResolution } from '../../util/resolution';
import { SUTO_MODEL_TYPES, S332_MODEL_IDS } from '../../util/platform';

export const ApiCapabilities = {
  rawCommand: false,
  screenshots: false,
  report600: false,
  loggerFiles: true,
  loggerPageRead: true,
  s461Read: false,
  diskCapacity: true,
  onlineSource: 'api_poll', // 'api_poll' | 'api_sse' | 'api_ws'
};

const MAX_HISTORY = 3600;

export class ApiDeviceDriver {
  constructor() {
    this.host = '192.168.1.100';
    this.port = 8080;
    this.connected = false;
    this.historyBuffer = new Map();
    this.cachedChannels = [];
    this.cachedSystemInfo = null;
    this.pollTimer = null;
    this.sseSource = null;
    this.lastMeasurementTime = 0;
    this.lastMeasurementResult = null;
  }

  getBaseUrl() {
    return `http://${this.host}:${this.port}`;
  }

  getCapabilities() {
    return { ...ApiCapabilities };
  }

  isAvailable() {
    return true; // WebAPI is accessible from both browser and desktop
  }

  getActiveTransport() {
    return 'API';
  }

  /**
   * Safe fetch with timeout and error handling
   */
  async fetchJson(endpoint, options = {}, timeoutMs = 5000) {
    const url = `${this.getBaseUrl()}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: 'application/json, text/plain, */*',
          ...options.headers,
        },
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText} from ${endpoint}`);
      }

      const text = await resp.text();
      try {
        return JSON.parse(text);
      } catch (_) {
        return text;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Connect to S332 WebAPI device
   * @param {Object} options - { host, port }
   */
  async connect(options = {}) {
    this.host = (options.host || '192.168.1.100').trim();
    this.port = 8080;
    this.clearHistory();

    await this.logClientEvent('INFO', 'API_DEVICE', `Connecting to S332 WebAPI at ${this.getBaseUrl()}...`);

    // Strictly probe device: /channel/list must be reachable and return valid S332 classchannel array
    let channelResp;
    try {
      channelResp = await this.fetchJson('/channel/list', {}, 3500);
    } catch (err) {
      this.connected = false;
      throw new Error(`Cannot reach S332 device at ${this.getBaseUrl()}: ${err.message || 'Connection timed out'}`);
    }

    const rawChannels = channelResp?.data?.classchannel;
    if (!Array.isArray(rawChannels)) {
      this.connected = false;
      throw new Error(`Device at ${this.getBaseUrl()} is responding, but is not a valid S332 unit (missing classchannel data).`);
    }

    this.cachedChannels = this.formatChannels(rawChannels);

    // Fetch system info non-blocking
    let sysInfo = null;
    try {
      sysInfo = await this.getSystemInfo();
    } catch (_) {}

    this.connected = true;
    this.startOnlinePolling();

    await this.logClientEvent(
      'INFO',
      'API_DEVICE',
      `Connected to S332 WebAPI: ${sysInfo?.device_name || 'S332'} (${sysInfo?.device_id || 'ID'}) with ${this.cachedChannels.length} channels`
    );

    return {
      address: this.host,
      host: this.host,
      port: this.port,
      transport: 'API',
      deviceId: sysInfo?.device_id || '0x108F',
      device_id: sysInfo?.device_id || '0x108F',
      name: sysInfo?.device_name || 'S332',
      device: sysInfo?.device_name || 'S332',
      serial: sysInfo?.serial_number || '12341234',
    };
  }

  /**
   * Disconnect from device
   */
  async disconnect() {
    this.stopOnlinePolling();
    this.connected = false;
    this.clearHistory();
    await this.logClientEvent('INFO', 'API_DEVICE', 'Disconnected from S332 WebAPI');
    return true;
  }

  /**
   * Start polling GET /channel/list for live values
   */
  startOnlinePolling(intervalMs = 1200) {
    this.stopOnlinePolling();
    // Immediate initial poll
    this.pollChannels().catch(() => {});
    this.pollTimer = setInterval(() => {
      this.pollChannels().catch(() => {});
    }, intervalMs);
  }

  stopOnlinePolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.sseSource) {
      try {
        this.sseSource.close();
      } catch (_) {}
      this.sseSource = null;
    }
  }

  /**
   * Poll channel list to extract and record live DValue
   */
  async pollChannels() {
    if (!this.connected) return;
    try {
      const json = await this.fetchJson('/channel/list', {}, 2500);
      const rawChannels = json?.data?.classchannel || [];
      const now = Date.now();

      rawChannels.forEach((ch, idx) => {
        const chId = ch.channelid !== undefined ? ch.channelid : idx;
        let history = this.historyBuffer.get(chId);
        if (!history) {
          history = [];
          this.historyBuffer.set(chId, history);
        }

        const rawVal = ch.DValue !== undefined ? ch.DValue : parseFloat(ch.SValue);
        // Treat -9999 as uninitialized/error reading if appropriate, but record valid numbers
        const val = typeof rawVal === 'number' && !isNaN(rawVal) ? rawVal : 0;
        history.push([now, val]);
        if (history.length > MAX_HISTORY) {
          history.shift();
        }
      });
    } catch (err) {
      // transient network poll failure
    }
  }

  /**
   * Get device system information
   */
  async getSystemInfo() {
    try {
      let sysInfo = null;
      try {
        const sysRes = await this.fetchJson('/system/information', {}, 2500);
        if (sysRes?.data) {
          sysInfo = sysRes.data;
        }
      } catch (e) {
        // Fallback if /system/information is unavailable
      }

      let devInfo = null;
      try {
        const devRes = await this.fetchJson('/system/device-info', {}, 2500);
        if (devRes?.data) {
          devInfo = devRes.data;
        }
      } catch (e) {
        // Fallback
      }

      const sn = sysInfo?.sn || devInfo?.device_id || '12341234';
      const fw = sysInfo?.fw || '1.0.3-Atlas11';
      const hw = sysInfo?.hw || 'v1.0.0-alpha.1';
      const devId = devInfo?.device_id || '0x108F';
      const devName = devInfo?.device_name || SUTO_MODEL_TYPES[devId] || sysInfo?.type || 'S332';
      const devType = sysInfo?.type || devInfo?.device_type || 'DL G2';

      const info = {
        device_id: devId,
        device_name: devName,
        serial_number: sn,
        device_type: devType,
        firmware_version: fw,
        hardware_version: hw,
        calibration_date: null,
      };
      this.cachedSystemInfo = info;
      return info;
    } catch (err) {
      if (this.cachedSystemInfo) return this.cachedSystemInfo;
      throw err;
    }
  }

  /**
   * Get device disk capacity and logger storage stats
   */
  async getDiskCapacity() {
    try {
      const res = await this.fetchJson('/system/disk-capacity', {}, 2500);
      if (res?.logger_space) {
        const total = res.logger_space.total || 0;
        const free = res.logger_space.free || 0;
        const used = Math.max(0, total - free);
        const percentUsed = total > 0 ? ((used / total) * 100).toFixed(1) : 0;
        return {
          total,
          free,
          used,
          percentUsed,
          userSpace: res.user_space || null,
        };
      }
      return null;
    } catch (err) {
      console.warn('[ApiDevice] getDiskCapacity failed:', err);
      return null;
    }
  }

  /**
   * Convert S332 classchannel array to S4A formatted channels
   */
  formatChannels(rawChannels = []) {
    return (rawChannels || []).map((ch, idx) => {
      const chId = ch.channelid !== undefined ? ch.channelid : (idx + 1);
      const chName = ch.channeldescription || `Channel ${chId}`;
      const sDesc = ch.sensordescription || chName;
      const unit = ch.Unitascii || '';

      return {
        channel_id: chId,
        id: chId,
        location_id: 1,
        locationId: 1,
        channel_name: chName,
        name: chName,
        fullName: chName,
        full_channel_name: chName,
        logic_channel_description: chName,
        unit_in_ascii: unit,
        unit: unit,
        unit_index: ch.Unitindex ?? 0,
        resolution: (typeof ch.Resolution === 'number' && ch.Resolution >= 0)
          ? ch.Resolution
          : resolveChannelResolution({ unit, unit_index: ch.Unitindex, resolution: ch.Resolution }),
        device_description: sDesc,
        sensor_description: sDesc,
        sensorDescription: sDesc,
        sensor_name: sDesc,
        sensor_id: ch.SensorID ?? 1,
        sensorId: ch.SensorID ?? 1,
        sensor_channel_id: chId,
        sensor_key: `0&0&0&${ch.SensorID ?? 1}`,
        device_id: ch.deviceid ?? 1,
        sub_device_id: 0,
        slaver_type: 0,
        slaver_addr: 0,
        channel_create_time: String(ch.ChannelCreateTime || ''),
        location: ch.location || '',
        meapoint: ch.meapoint || '',
        active: Boolean(ch.Show !== false),
        selected: idx === 0,
        raw: ch,
      };
    });
  }

  /**
   * Get formatted channels for S4A GraphicView / TableView
   */
  async getChannels(callback) {
    try {
      const json = await this.fetchJson('/channel/list');
      const rawChannels = json?.data?.classchannel || [];
      const formatted = this.formatChannels(rawChannels);

      this.cachedChannels = formatted;
      if (callback) callback(formatted);
      return formatted;
    } catch (err) {
      console.error('[ApiDevice] getChannels failed:', err);
      if (this.cachedChannels && this.cachedChannels.length > 0) {
        if (callback) callback(this.cachedChannels);
        return this.cachedChannels;
      }
      throw err;
    }
  }

  /**
   * Get layout points from cfgLayout.json (Measurement Points & bound channels)
   */
  async getLayoutInfo() {
    try {
      const json = await this.fetchJson('/file/get?file_name=cfgLayout.json&dir=/data/configs/sensorlist/');
      const list = json?.LayoutList || json?.data?.LayoutList || [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      console.warn('[ApiDevice] getLayoutInfo failed:', err);
      return [];
    }
  }

  /**
   * Get live measurement data formatted for S4A GraphicView
   */
  async getMeasurementData(callback) {
    const now = Date.now();
    // Cache coalescence within 600ms
    if (this.lastMeasurementResult && (now - this.lastMeasurementTime < 600)) {
      if (callback) callback(this.lastMeasurementResult);
      return this.lastMeasurementResult;
    }

    if (!this.cachedChannels || this.cachedChannels.length === 0) {
      await this.getChannels();
    }

    const channels = this.cachedChannels || [];
    const result = channels.map((ch) => {
      const history = this.historyBuffer.get(ch.channel_id) || [];
      const pts = history.map((h) => h[1]);
      const min = pts.length ? Math.min(...pts) : 0;
      const max = pts.length ? Math.max(...pts) : 100;
      const currentVal = pts.length ? pts[pts.length - 1] : 0;

      return {
        channel_id: ch.channel_id,
        unit: ch.unit,
        resolution: ch.resolution,
        status: ch.raw?.Status || 0,
        current_value: currentVal,
        measurementData: [pts],
        realStartTime: history.length ? [history[0][0]] : [now],
        pointInterval: [1000],
        min,
        max,
      };
    });

    this.lastMeasurementResult = result;
    this.lastMeasurementTime = Date.now();

    if (callback) callback(result);
    return result;
  }

  /**
   * Get table page for TableView in monitor mode
   */
  getTablePage(pageIndex, pageSize, selectedChannelIds, callback) {
    const timestampsSet = new Set();
    for (const [chId, pts] of this.historyBuffer.entries()) {
      if (!selectedChannelIds || selectedChannelIds.includes(chId)) {
        for (const [t] of pts) {
          timestampsSet.add(t);
        }
      }
    }

    const sortedTimes = Array.from(timestampsSet).sort((a, b) => b - a); // newest first
    const total = sortedTimes.length;
    const start = pageIndex * pageSize;
    const end = Math.min(start + pageSize, total);
    const pageTimes = sortedTimes.slice(start, end);

    const rows = pageTimes.map((t, i) => {
      const values = {};
      for (const [chId, pts] of this.historyBuffer.entries()) {
        const found = pts.find(([ptTime]) => ptTime === t);
        values[chId] = found ? found[1] : null;
      }
      return {
        index: start + i,
        timestampMs: t,
        values,
      };
    });

    const result = {
      total,
      rows,
      startTimeMs: sortedTimes[sortedTimes.length - 1] || Date.now(),
      stopTimeMs: sortedTimes[0] || Date.now(),
      sampleRate: 1,
    };

    if (callback) callback(result);
    return result;
  }

  /**
   * Get logger status & configuration
   */
  async getLoggerStatus() {
    try {
      const json = await this.fetchJson('/logger/configuration');
      const cfg = json?.logger_config_info || {};

      const statusMap = {
        0x00: { state: 'stopped', enabled: false, recording: false },
        0x01: { state: 'recording', enabled: true, recording: true },
        0x10: { state: 'timed_waiting', enabled: true, recording: false },
        0x11: { state: 'recording', enabled: true, recording: true },
      };

      const mapped = statusMap[cfg.status] || { state: 'stopped', enabled: false, recording: false };

      return {
        enabled: mapped.enabled,
        recording: mapped.recording,
        state: mapped.state,
        status: cfg.status,
        mode: cfg.type_distinguish || 0,
        recorded_count: 0,
        sampling_count: 0,
        start_time: cfg.start_time || 0,
        end_time: cfg.stop_time || 0,
        sample_rate: cfg.sample_rate || 1,
        file_name: cfg.file_name || '',
        channels_count: cfg.record_channels ? cfg.record_channels.length : 0,
      };
    } catch (err) {
      console.warn('[ApiDevice] getLoggerStatus failed:', err);
      return null;
    }
  }

  /**
   * Query device for list of recorded measurement session files
   */
  async getLoggerFiles() {
    try {
      const json = await this.fetchJson('/logger/all-records');
      const files = json?.files || [];

      const mapped = files.map((f) => {
        const durationSec = Math.max(0, Math.round(((f.end_time_stamp - f.start_time_stamp) / 1000)));
        const sampleRate = f.sample_rate || 1;
        const samplesPerChannel = Math.max(1, durationSec * sampleRate);

        return {
          fileName: f.name,
          file_name: f.name,
          startTime: f.start_time,
          start_time: f.start_time,
          endTime: f.end_time,
          end_time: f.end_time,
          startTimeStamp: f.start_time_stamp,
          endTimeStamp: f.end_time_stamp,
          channelsCount: f.channels ? f.channels.length : 0,
          channels_count: f.channels ? f.channels.length : 0,
          samplesPerChannel,
          samples_per_channel: samplesPerChannel,
          sampleRate,
          sample_rate: sampleRate,
          description: f.name,
          status: 0,
          isRecording: false,
          channels: f.channels || [],
        };
      });
      this.cachedLoggerFiles = mapped;
      return mapped;
    } catch (err) {
      console.warn('[ApiDevice] getLoggerFiles failed:', err);
      return [];
    }
  }

  /**
   * Paged logger data retrieval & CSV compilation in standard SUTO Raw Data format
   * @param {string} fileName
   * @param {Function} [onProgress] - callback({ current, total, percent })
   * @param {Object} [fileMeta] - optional file metadata from getLoggerFiles
   * @returns {Promise<{csv_text: string, row_count: number, filename: string, rows: Array}>}
   */
  async readLoggerData(fileName, onProgress, fileMeta = null) {
    if (!fileName) throw new Error('File name is required to read logger data');

    // Resolve file metadata (channels, times, sample rate)
    let metaFile = fileMeta;
    if (!metaFile && this.cachedLoggerFiles) {
      metaFile = this.cachedLoggerFiles.find((f) => f.fileName === fileName);
    }
    if (!metaFile) {
      try {
        const allFiles = await this.getLoggerFiles();
        metaFile = allFiles.find((f) => f.fileName === fileName);
      } catch (e) {
        // Fallback
      }
    }

    // Page 1 to inspect total pages and meta
    const firstPageJson = await this.fetchJson(`/logger/data-get-by-page?file_name=${encodeURIComponent(fileName)}&page_index=1`);
    if (!firstPageJson?.status) {
      throw new Error(`Failed to read first page of logger data: ${firstPageJson?.message || 'Unknown error'}`);
    }

    const meta = firstPageJson?.meta_data || {};
    const totalPages = meta.total_pages || 1;
    const pageChannelInfo = meta.channel_info || [];

    const allRecordData = [...(firstPageJson?.record_data || [])];
    if (onProgress) {
      onProgress({ current: 1, total: totalPages, percent: Math.round((1 / totalPages) * 100) });
    }

    // Fetch remaining pages sequentially (or in batches)
    for (let page = 2; page <= totalPages; page++) {
      try {
        const pageJson = await this.fetchJson(`/logger/data-get-by-page?file_name=${encodeURIComponent(fileName)}&page_index=${page}`);
        if (pageJson?.record_data && Array.isArray(pageJson.record_data)) {
          allRecordData.push(...pageJson.record_data);
        }
      } catch (err) {
        console.warn(`[ApiDevice] Failed to fetch page ${page} of ${fileName}:`, err);
      }
      if (onProgress) {
        onProgress({ current: page, total: totalPages, percent: Math.round((page / totalPages) * 100) });
      }
    }

    // Match channels combining pageChannelInfo and metaFile.channels
    const fileChannels = metaFile?.channels || [];
    const mergedChannels = pageChannelInfo.map((pCh, idx) => {
      const match = fileChannels.find((fCh) => fCh.channel_id === pCh.index || fCh.description === pCh.description) || fileChannels[idx] || {};
      const unit = match.unit || pCh.unit_ascii || '';
      const desc = pCh.description || match.description || `Channel ${idx + 1}`;
      const resolution = typeof match.resolution === 'number' && match.resolution >= 0
        ? match.resolution
        : (typeof pCh.resolution === 'number' ? pCh.resolution : 2);

      const loc = match.location || '';
      const mp = match.measurement_point || match.meapoint || '';
      const locMp = loc && mp ? `${loc}/${mp}` : (loc || mp || 'Location 1/220');

      let sensor = match.sensor_description || match.sensordescription || match.sensor_name || match.sensor || '';
      if (!sensor) {
        sensor = mp ? (mp.startsWith('S') ? mp : `S${mp}`) : 'SUTO';
      }

      return {
        index: pCh.index !== undefined ? pCh.index : idx,
        description: desc,
        sensor,
        unit,
        resolution,
        locationMp: locMp,
      };
    });

    // Time calculations
    const firstTs = allRecordData.length > 0 ? allRecordData[0].timestamp : (metaFile?.startTimeStamp || Date.now());
    const lastTs = allRecordData.length > 0 ? allRecordData[allRecordData.length - 1].timestamp : (metaFile?.endTimeStamp || firstTs);
    const startDate = new Date(firstTs);
    const endDate = new Date(lastTs);
    const sampleRate = metaFile?.sampleRate || 1;

    // Helper functions for formatting matching SUTO Raw Data export
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatHeaderDate = (d) => {
      const DD = String(d.getDate()).padStart(2, '0');
      const Mmm = months[d.getMonth()];
      const YYYY = d.getFullYear();
      const HH = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${DD}.${Mmm} ${YYYY} ${HH}:${mm}`;
    };

    const formatRowDate = (ts) => {
      const d = new Date(ts);
      const DD = String(d.getDate()).padStart(2, '0');
      const MM = String(d.getMonth() + 1).padStart(2, '0');
      const YYYY = d.getFullYear();
      const HH = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${DD}-${MM}-${YYYY} ${HH}:${mm}:${ss}`;
    };

    const formatResolutionStep = (res) => {
      const r = typeof res === 'number' && res >= 0 ? res : (parseInt(res, 10) || 0);
      if (r === 0) return '1';
      return (1 / Math.pow(10, r)).toFixed(r);
    };

    const formatVal = (val, res) => {
      if (val === undefined || val === null || val === '') return '';
      const num = typeof val === 'number' ? val : parseFloat(val);
      if (isNaN(num)) return '';
      const r = typeof res === 'number' && res >= 0 ? res : 2;
      return num.toFixed(r);
    };

    // Device Title
    const rawDevType = this.cachedSystemInfo?.device_type || this.cachedSystemInfo?.type || this.cachedSystemInfo?.device_name || 'DL_G2';
    const deviceTitle = rawDevType.replace(/\s+/g, '_');

    const csvLines = [];
    // 1. Title line
    csvLines.push(`${deviceTitle} Raw Data\r\n`);
    // 2. Empty line
    csvLines.push('\r\n');
    // 3. Metadata block
    csvLines.push(`Start Date Time,${formatHeaderDate(startDate)}\r\n`);
    csvLines.push(`End Date Time,${formatHeaderDate(endDate)}\r\n`);
    csvLines.push(`Sample Rate(sec),${sampleRate}\r\n`);
    csvLines.push(`NO.Of Channels,${mergedChannels.length}\r\n`);
    // 4. Empty line
    csvLines.push('\r\n');
    // 5. Channel metadata header
    csvLines.push('No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point\r\n');
    // Channel definitions
    mergedChannels.forEach((ch, idx) => {
      csvLines.push(`${idx + 1},${ch.description},${ch.sensor},${ch.unit},${formatResolutionStep(ch.resolution)},${ch.locationMp}\r\n`);
    });
    // 6. Empty line
    csvLines.push('\r\n');

    // 7. Data header
    const dataHeaderCols = ['Date Time', ...mergedChannels.map((ch) => (ch.unit ? `${ch.description} - ${ch.unit}` : ch.description))];
    csvLines.push(dataHeaderCols.join(',') + '\r\n');

    // 8. Data rows
    const rows = [];
    allRecordData.forEach((record) => {
      const ts = record.timestamp;
      const dateStr = formatRowDate(ts);
      const valMap = {};

      if (Array.isArray(record.datas)) {
        record.datas.forEach((d) => {
          valMap[d.channel_index] = d.value;
        });
      }

      const rowCols = [dateStr];
      mergedChannels.forEach((ch) => {
        const v = valMap[ch.index];
        rowCols.push(formatVal(v, ch.resolution));
      });

      csvLines.push(rowCols.join(',') + '\r\n');
      rows.push({
        timestamp: ts,
        values: valMap,
      });
    });

    const csv_text = csvLines.join('');
    const filename = `${fileName}.csv`;

    return {
      csv_text,
      row_count: rows.length,
      rowCount: rows.length,
      filename,
      rows,
      meta,
    };
  }

  clearHistory() {
    this.historyBuffer.clear();
    this.lastMeasurementResult = null;
    this.lastMeasurementTime = 0;
  }

  async logClientEvent(level, tag, message) {
    if (typeof window !== 'undefined') {
      window._mockSutoLogs = window._mockSutoLogs || [];
      window._mockSutoLogs.push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        level,
        tag,
        message,
        hex_data: null,
      });
    }
    console.log(`[${level}] [${tag}] ${message}`);
  }

  async saveBinaryFile(filename, data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    // If running in browser, trigger standard web blob download
    if (typeof window !== 'undefined' && window.document) {
      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return filename;
    }
    return null;
  }
}

export const ApiDevice = new ApiDeviceDriver();
export default ApiDevice;

