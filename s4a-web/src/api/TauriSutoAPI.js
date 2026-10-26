/**
 * TauriSutoAPI.js
 *
 * Frontend client for the SUTO Unified Communication Engine (Tauri plugin).
 * Supports:
 *  - USB direct communication (cscdc.sys on Windows, mock/sim on macOS/Linux)
 *  - SUTO DS310 new protocol (discovery, 204-byte channel info, 7-byte values)
 *  - SUTO System info (serial number, device id, firmware, hardware, calibration)
 *  - SUTO Logger status (enabled, record counts, timestamps, interval)
 *  - Arbitrary SUTO commands (CTY, SCTY, ACT)
 */

import { isTauri, checkIsTauri } from '../util/platform';
import { invoke } from '@tauri-apps/api/core';
import BleSutoAPI from './BleSutoAPI';
import { resolveChannelResolution } from '../util/resolution';

const hasTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__?.invoke);

// Rolling measurement buffer for chart display (keeps last 3600 points)
const historyBuffer = new Map();
const MAX_HISTORY = 3600;
let activeTransport = 'USB'; // 'USB' | 'TCP' | 'BLE'
let activeMeasurementPromise = null;
let lastMeasurementResult = null;
let lastMeasurementTime = 0;

export const TauriSutoAPI = {
  isAvailable() {
    return hasTauri();
  },

  getActiveTransport() {
    if (activeTransport === 'BLE_WEB' || activeTransport === 'BLE_NATIVE') {
      return 'BLE';
    }
    return activeTransport;
  },

  /** List available USB devices */
  async listUsbDevices() {
    if (!hasTauri()) {
      return [];
    }
    return await invoke('suto_list_usb_devices');
  },

  /** Connect to SUTO USB device and auto-discover address */
  async connectUsb(devicePath = null) {
    activeTransport = 'USB';
    await this.logClientEvent('INFO', 'SUTO_IPC', `Connecting via Direct USB (path: ${devicePath || 'auto'})...`);
    if (!hasTauri()) {
      throw new Error('Direct USB connection requires running in the S4A Desktop App with SUTO hardware connected via USB.');
    }
    const res = await invoke('suto_connect_usb', { path: devicePath });
    let sInfo = null;
    try {
      sInfo = await invoke('suto_get_system_info');
    } catch (_) {}
    return {
      address: res,
      transport: 'USB',
      deviceId: sInfo?.device_id,
      device_id: sInfo?.device_id,
      name: sInfo?.device_name,
      device: sInfo?.device_name,
      serial: sInfo?.serial_number,
    };
  },

  /** Connect to SUTO device via Ethernet TCP Socket */
  async connectTcp(host = '192.168.1.100', port = 502) {
    activeTransport = 'TCP';
    await this.logClientEvent('INFO', 'TCP_OPEN', `Initiating Ethernet TCP connection to ${host}:${port}...`);
    if (!hasTauri()) {
      throw new Error('Ethernet TCP connection requires running in the S4A Desktop App.');
    }
    const res = await invoke('suto_connect_tcp', { host, port: parseInt(port, 10) });
    let sInfo = null;
    try {
      sInfo = await invoke('suto_get_system_info');
    } catch (_) {}
    return {
      address: res,
      host,
      port,
      transport: 'TCP',
      deviceId: sInfo?.device_id,
      device_id: sInfo?.device_id,
      name: sInfo?.device_name,
      device: sInfo?.device_name,
      serial: sInfo?.serial_number,
    };
  },

  /** List available BLE devices in Desktop mode */
  async listBleDevices(options = {}) {
    if (!hasTauri()) {
      return [];
    }
    const timeoutMs = options.timeoutMs || 3000;
    const sutoOnly = !options.acceptAll;
    return await invoke('suto_list_ble_devices', { timeoutMs, sutoOnly });
  },

  /** Connect to SUTO device via BLE (Native in desktop, Web Bluetooth in browser) */
  async connectBle(options = {}) {
    if (hasTauri()) {
      activeTransport = 'BLE_NATIVE';
      await this.logClientEvent('INFO', 'BLE_CONN', `Initiating native desktop BLE connection (ID: ${options.deviceId || 'auto'})...`);

      let targetDeviceId = options.deviceId;
      let targetName = options.name;

      if (!targetDeviceId) {
        const devs = await this.listBleDevices({ acceptAll: options.acceptAll, timeoutMs: 3000 });
        if (!devs || devs.length === 0) {
          throw new Error('No Bluetooth Low Energy devices detected. Make sure the SUTO device Bluetooth is active and in range.');
        }
        targetDeviceId = devs[0].id;
        targetName = devs[0].name;
      }

      const res = await invoke('suto_connect_ble', { deviceId: targetDeviceId });
      let sInfo = null;
      try {
        sInfo = await invoke('suto_get_system_info');
      } catch (_) {}

      return {
        address: res,
        transport: 'BLE',
        deviceId: sInfo?.device_id,
        device_id: sInfo?.device_id,
        name: targetName || sInfo?.device_name || 'SUTO BLE Device',
        device: targetName || sInfo?.device_name || 'SUTO BLE Device',
        serial: sInfo?.serial_number,
      };
    }

    activeTransport = 'BLE_WEB';
    await this.logClientEvent('INFO', 'BLE_CONN', 'Initiating Web Bluetooth (BLE) connection...');
    const conn = await BleSutoAPI.connectBle(options);
    return { ...conn, transport: 'BLE' };
  },

  /** Disconnect from active device */
  async disconnect() {
    await this.logClientEvent('INFO', 'SUTO_IPC', `Disconnecting active transport (${activeTransport})...`);
    activeMeasurementPromise = null;
    lastMeasurementResult = null;
    lastMeasurementTime = 0;
    if (activeTransport === 'BLE_WEB') {
      await BleSutoAPI.disconnect();
    } else if (hasTauri()) {
      await invoke('suto_disconnect');
    }
    activeTransport = null;
    return true;
  },

  /**
   * Get channels formatted for S4A-Web Views
   * @param {Function} [callback]
   */
  async getChannels(callback) {
    if (activeTransport === 'BLE_WEB') {
      try {
        const rawChs = await BleSutoAPI.getChannels();
        const formatted = (Array.isArray(rawChs) ? rawChs : []).map((ch, idx) => {
          const chId = ch.channel_id ?? ch.id ?? (idx + 1);
          const chName = ch.channel_name || ch.description || ch.logic_channel_description || `Channel ${chId}`;
          const unit = ch.unit || ch.unit_in_ascii || '';
          const sDesc = ch.sensor_description || ch.sensor_desc || ch.sensorDescription || chName;
          return {
            channel_id: chId,
            id: chId,
            location_id: 1,
            locationId: 1,
            channel_name: chName,
            name: ch.name || chName,
            fullName: ch.fullName || ch.full_channel_name || chName,
            full_channel_name: ch.full_channel_name || ch.fullName || chName,
            logic_channel_description: ch.logic_channel_description || chName,
            unit_in_ascii: ch.unit_in_ascii || unit,
            unit: unit,
            unit_index: ch.unit_index,
            resolution: (typeof ch.resolution === 'number' && ch.resolution >= 0)
              ? ch.resolution
              : resolveChannelResolution({ unit, unit_index: ch.unit_index, resolution: ch.resolution }),
            device_description: ch.device_description || ch.device_desc || 'SUTO BLE Device',
            sensor_description: sDesc,
            sensorDescription: sDesc,
            sensor_name: ch.sensor_name || sDesc,
            sensor_id: ch.sensor_id ?? ch.sensorId ?? 1,
            sensorId: ch.sensor_id ?? ch.sensorId ?? 1,
            sensor_channel_id: ch.sensor_channel_id ?? chId,
            sensor_key: ch.sensor_key || `0&0&0&${ch.sensor_id ?? 1}`,
            device_id: ch.device_id ?? 1,
            sub_device_id: ch.sub_device_id ?? 0,
            slaver_type: ch.slaver_type ?? 0,
            slaver_addr: ch.slaver_addr ?? 0,
            mb_output_value_type: ch.mb_output_value_type ?? 0,
            active: true,
            selected: idx === 0,
          };
        });
        if (callback) callback(formatted);
        return formatted;
      } catch (err) {
        console.warn('[TauriSutoAPI] BLE getChannels failed:', err);
        if (callback) callback([]);
        return [];
      }
    }

    if (!hasTauri()) {
      if (callback) callback([]);
      return [];
    }

    try {
      const rawChannels = await invoke('suto_get_channels');
      // Format channels to match S4A view schema. `channel_id` stays the
      // logical channel number (used for value lookup); `sensor_id` groups
      // channels that belong to the same physical sensor.
      const formatted = (Array.isArray(rawChannels) ? rawChannels : []).map((ch, idx) => ({
        channel_id: ch.id,
        // Live devices have no server location tree — all channels live in the
        // single synthetic location exposed by TestAPI's monitor proxy.
        location_id: 1,
        channel_name: ch.description,
        // Aliases consumed by the stock Graphic View components
        // (ChannelList builds channels from these legacy field names).
        unit_in_ascii: ch.unit,
        logic_channel_description: ch.description,
        full_channel_name: ch.description,
        unit: ch.unit,
        unit_index: ch.unit_index,
        resolution: (typeof ch.resolution === 'number' && ch.resolution >= 0)
          ? ch.resolution
          : resolveChannelResolution({ unit: ch.unit, unit_index: ch.unit_index, resolution: ch.resolution }),
        device_description: ch.device_desc,
        sensor_description: ch.sensor_desc,
        sensor_id: ch.sensor_id,
        sensor_channel_id: ch.channel_id,
        sensor_key: ch.sensor_key,
        device_id: ch.device_id,
        sub_device_id: ch.sub_device_id,
        slaver_type: ch.slaver_type,
        slaver_addr: ch.slaver_addr,
        active: true,
        selected: idx === 0,
      }));

      if (callback) callback(formatted);
      return formatted;
    } catch (err) {
      console.error('[TauriSutoAPI] getChannels failed:', err);
      if (callback) callback([]);
      return [];
    }
  },

  /**
   * Get live measurement data formatted for S4A GraphicView
   * @param {Function} [callback]
   */
  async getMeasurementData(callback) {
    if (activeTransport === 'BLE_WEB') {
      const now = Date.now();
      // Reuse recent fresh measurement within 750ms
      if (lastMeasurementResult && (now - lastMeasurementTime < 750)) {
        if (callback) callback(lastMeasurementResult);
        return lastMeasurementResult;
      }

      // If a measurement query is already in flight, coalesce onto the same promise
      if (activeMeasurementPromise) {
        const res = await activeMeasurementPromise;
        if (callback) callback(res);
        return res;
      }

      activeMeasurementPromise = BleSutoAPI.getMeasurementData()
        .then((res) => {
          lastMeasurementResult = res;
          lastMeasurementTime = Date.now();
          return res;
        })
        .finally(() => {
          activeMeasurementPromise = null;
        });

      const res = await activeMeasurementPromise;
      if (callback) callback(res);
      return res;
    }

    try {
      let values;
      if (!hasTauri()) {
        values = [];
      } else {
        values = await invoke('suto_get_values');
      }
      const valArray = Array.isArray(values) ? values : [];
      const now = Date.now();
      const result = valArray.map((val) => {
        let history = historyBuffer.get(val.id);
        if (!history) {
          history = [];
          historyBuffer.set(val.id, history);
        }

        if (val.value !== null && val.value !== undefined) {
          history.push([now, val.value]);
          if (history.length > MAX_HISTORY) {
            history.shift();
          }
        }

        const pts = history.map((item) => item[1]);
        const min = pts.length ? Math.min(...pts) : 0;
        const max = pts.length ? Math.max(...pts) : 100;

        return {
          channel_id: val.id,
          unit: val.unit,
          resolution: val.resolution,
          status: val.status,
          current_value: val.value,
          measurementData: [history.map((h) => h[1])],
          realStartTime: history.length ? [history[0][0]] : [now],
          pointInterval: [1000],
          min,
          max,
        };
      });

      if (callback) callback(result);
      return result;
    } catch (err) {
      console.error('[TauriSutoAPI] getMeasurementData failed:', err);
      if (callback) callback([]);
      return [];
    }
  },

  /**
   * Get table rows for TableView in monitor mode
   */
  getTablePage(pageIndex, pageSize, selectedChannelIds, callback) {
    const timestampsSet = new Set();
    for (const [chId, pts] of historyBuffer.entries()) {
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
      for (const [chId, pts] of historyBuffer.entries()) {
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
  },

  /**
   * Get device system information (serial number, firmware version, device name, etc.)
   */
  async getSystemInfo() {
    if (activeTransport === 'BLE_WEB') {
      return await BleSutoAPI.getSystemInfo();
    }
    if (!hasTauri()) {
      return null;
    }
    return await invoke('suto_get_system_info');
  },

  /**
   * Get logger status (enabled, recorded count, start/end time, interval)
   */
  async getLoggerStatus() {
    if (!hasTauri()) {
      return null;
    }
    return await invoke('suto_get_logger_status');
  },

  /**
   * Read logged data from S461 device memory for a given time period
   * @param {number} startTime Unix timestamp in seconds
   * @param {number} stopTime Unix timestamp in seconds
   * @returns {Promise<{csv_text: string, row_count: number, filename: string}>}
   */
  async readS461Log(startTime, stopTime) {
    if (!hasTauri()) {
      throw new Error('Device communication is only available in desktop application mode.');
    }
    return await invoke('suto_read_s461_log', {
      startTime: Math.floor(startTime),
      stopTime: Math.floor(stopTime),
    });
  },

  /**
   * Query device for list of recorded measurement session files stored in device memory
   * @returns {Promise<Array<{fileName: string, startTime: string, endTime: string, channelsCount: number, samplesPerChannel: number, sampleRate: number, description: string, status: number}>>}
   */
  async getLoggerFiles() {
    if (!hasTauri()) {
      return [];
    }
    try {
      const res = await invoke('suto_get_logger_files');
      if (!Array.isArray(res)) return [];
      const map = new Map();
      res.forEach((f) => {
        const item = {
          fileName: f.file_name,
          startTime: f.start_time,
          endTime: f.end_time,
          channelsCount: f.channels_count,
          samplesPerChannel: f.samples_per_channel,
          sampleRate: f.sample_rate,
          description: f.description,
          status: f.status,
          isRecording: Boolean((f.status & 1) !== 0 || f.is_recording),
        };
        const existing = map.get(item.fileName);
        if (!existing || (item.samplesPerChannel || 0) >= (existing.samplesPerChannel || 0)) {
          map.set(item.fileName, item);
        }
      });
      return Array.from(map.values());
    } catch (e) {
      console.warn('[TauriSutoAPI] getLoggerFiles failed:', e);
      return [];
    }
  },

  /**
   * Query device for list of screenshot images stored in device memory
   * @returns {Promise<Array<{name: string, size: number, index: number}>>}
   */
  async getScreenshots() {
    if (!hasTauri()) {
      return [];
    }
    return await invoke('suto_get_screenshots');
  },

  /**
   * Read screenshot binary image bytes (BMP) from device
   * @param {string} name
   * @param {number} size
   * @returns {Promise<Uint8Array>}
   */
  async readScreenshot(name, size) {
    if (!hasTauri()) {
      throw new Error('readScreenshot requires Tauri desktop runtime with connected hardware.');
    }
    const bytes = await invoke('suto_read_screenshot', { name, size });
    return new Uint8Array(bytes);
  },

  /**
   * Query S600 CSD sessions for report generation
   * @returns {Promise<Array<{id: number, name: string, size: number, date: number, date_str: string}>>}
   */
  async get600CsdFiles() {
    if (!hasTauri()) {
      return [];
    }
    return await invoke('suto_get_600_csd_files');
  },

  /**
   * Generate and download ISO 8573 PDF report from an S600 CSD session
   * @param {number} id
   * @param {string} name
   * @param {number} size
   * @param {number} date
   * @returns {Promise<{file_name: string, file_size: number, file_date: number, pdf_bytes: Array<number>}>}
   */
  async generate600Report(id, name, size, date) {
    if (!hasTauri()) {
      throw new Error('generate600Report requires Tauri desktop runtime with connected hardware.');
    }
    return await invoke('suto_generate_600_report', { id, name, size, date });
  },

  /**
   * Send custom SUTO command by Category, Subcategory, Action
   * @param {number} cty
   * @param {number} scty
   * @param {number} act
   * @param {Array<number>} [data]
   * @param {number} [addr]
   */
  async sendCommand(cty, scty, act, data = null, addr = null) {
    if (!hasTauri()) throw new Error('Tauri runtime not detected');
    return await invoke('suto_send_command', {
      addr,
      cty,
      scty,
      act,
      data,
    });
  },

  /**
   * Send raw byte buffer with frame wrapping and checksum
   * @param {number} addr
   * @param {Array<number>} data
   */
  async sendRaw(addr, data) {
    if (!hasTauri()) throw new Error('Tauri runtime not detected');
    return await invoke('suto_send_raw', { addr, data });
  },

  /** Clear in-memory chart history */
  clearHistory() {
    historyBuffer.clear();
  },

  /** Get diagnostic log entries from Rust engine or mock buffer */
  async getLogs(sinceId = 0) {
    if (!hasTauri()) {
      return (window._mockSutoLogs || []).filter(l => l.id > sinceId);
    }
    return await invoke('suto_get_logs', { sinceId });
  },

  /** Clear all diagnostic logs */
  async clearLogs() {
    if (!hasTauri()) {
      window._mockSutoLogs = [];
      return;
    }
    return await invoke('suto_clear_logs');
  },

  /** Get disk path to the app_log.log file */
  async getLogFilePath() {
    if (!hasTauri()) {
      return './app_log.log (Browser Mock)';
    }
    return await invoke('suto_get_log_file_path');
  },

  /** Write a client-side event to the unified SUTO log */
  async logClientEvent(level, tag, message) {
    if (!hasTauri()) {
      window._mockSutoLogs = window._mockSutoLogs || [];
      window._mockSutoLogs.push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        level,
        tag,
        message,
        hex_data: null,
      });
      return;
    }
    return await invoke('suto_log_client_event', { level, tag, message });
  },
  /** Open native OS file picker to select a CSD or CSV file */
  async pickFile() {
    if (!hasTauri()) {
      return null;
    }
    return await invoke('suto_pick_file');
  },

  /** Read an entire file as Uint8Array via Tauri */
  async readFile(path) {
    if (!hasTauri()) {
      throw new Error('readFile is only available in Tauri desktop environment');
    }
    const bytes = await invoke('suto_read_file', { path });
    return new Uint8Array(bytes);
  },

  /** Read a slice of a file via Tauri */
  async readFileSlice(path, offset, length) {
    if (!hasTauri()) {
      throw new Error('readFileSlice is only available in Tauri desktop environment');
    }
    const bytes = await invoke('suto_read_file_slice', { path, offset, length });
    return new Uint8Array(bytes);
  },

  /** Get metadata and file size for a path */
  async getFileStats(path) {
    if (!hasTauri()) {
      return { name: path.split(/[/\\]/).pop(), path, size: 0, last_opened: Date.now() };
    }
    return await invoke('suto_get_file_stats', { path });
  },

  /** Get recent files list from persistent config beside app */
  async getRecentFiles() {
    if (!hasTauri()) {
      return [];
    }
    return await invoke('suto_get_recent_files');
  },

  /** Add or touch a recent file in the config file */
  async addRecentFile(path) {
    if (!hasTauri()) {
      return [];
    }
    return await invoke('suto_add_recent_file', { path });
  },

  /** Remove a recent file from the config file */
  async removeRecentFile(path) {
    if (!hasTauri()) {
      return [];
    }
    return await invoke('suto_remove_recent_file', { path });
  },

  /** Save binary data using native OS Save File dialog */
  async saveBinaryFile(filename, data) {
    if (!hasTauri()) {
      return null;
    }
    const byteArr = data instanceof Uint8Array ? Array.from(data) : Array.from(new Uint8Array(data));
    return await invoke('suto_save_binary_file', { filename, data: byteArr });
  },

  /** Open native OS folder selection dialog */
  async pickFolder() {
    if (!hasTauri()) {
      return null;
    }
    return await invoke('suto_pick_folder');
  },

  /** Save binary data to a specific folder on disk */
  async saveFileToPath(folder, filename, data) {
    if (!hasTauri()) {
      return null;
    }
    const byteArr = data instanceof Uint8Array ? Array.from(data) : Array.from(new Uint8Array(data));
    return await invoke('suto_save_file_to_path', { folder, filename, data: byteArr });
  },
};

export default TauriSutoAPI;
