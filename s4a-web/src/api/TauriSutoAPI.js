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
    return activeTransport;
  },

  /** List available USB devices */
  async listUsbDevices() {
    if (!hasTauri()) {
      return [{ path: 'USB\\VID_04D8&PID_0001\\SIMULATED', description: 'SUTO S331 / DS310 (Simulated Demo)' }];
    }
    return await invoke('suto_list_usb_devices');
  },

  /** Connect to SUTO USB device and auto-discover address */
  async connectUsb(devicePath = null) {
    activeTransport = 'USB';
    await this.logClientEvent('INFO', 'SUTO_IPC', `Connecting via Direct USB (path: ${devicePath || 'auto'})...`);
    if (!hasTauri()) {
      await this.logClientEvent('INFO', 'SUTO_DISC', 'Web simulation mode: connected to SUTO DS310 demo');
      return { address: 1, channels_count: 4, device: 'SUTO DS310 (Simulated Demo)', transport: 'USB' };
    }
    const res = await invoke('suto_connect_usb', { path: devicePath });
    return { address: res, transport: 'USB' };
  },

  /** Connect to SUTO device via Ethernet TCP Socket */
  async connectTcp(host = '192.168.1.100', port = 502) {
    activeTransport = 'TCP';
    await this.logClientEvent('INFO', 'TCP_OPEN', `Initiating Ethernet TCP connection to ${host}:${port}...`);
    if (!hasTauri()) {
      await this.logClientEvent('INFO', 'TCP_OPEN', `Web mode: connected to SUTO Ethernet at ${host}:${port} (Demo)`);
      return { address: 1, host, port, transport: 'TCP', device: `SUTO S461 TCP (${host}:${port})` };
    }
    const res = await invoke('suto_connect_tcp', { host, port: parseInt(port, 10) });
    return { address: res, host, port, transport: 'TCP' };
  },

  /** Connect to SUTO device via Web Bluetooth (BLE) */
  async connectBle(options = {}) {
    activeTransport = 'BLE';
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
    if (activeTransport === 'BLE') {
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
    if (activeTransport === 'BLE') {
      try {
        const chs = await BleSutoAPI.getChannels();
        if (callback) callback(chs);
        return chs;
      } catch (err) {
        console.warn('[TauriSutoAPI] BLE getChannels failed:', err);
        if (callback) callback([]);
        return [];
      }
    }

    if (!hasTauri()) {
      const mockChannels = [
        // Sensor 1 (logical channels 1-3)
        { channel_id: 1, sensor_channel_id: 1, sensor_id: 1, sensor_key: '1&1&0&1', sensor_name: 'SUTO DS310 Main', channel_name: 'Flow', unit: 'm³/h', unit_index: 3, resolution: 1, device_description: 'SUTO DS310 Main', sensor_description: 'Flow Sensor', active: true, selected: true },
        { channel_id: 2, sensor_channel_id: 2, sensor_id: 1, sensor_key: '1&1&0&1', sensor_name: 'SUTO DS310 Main', channel_name: 'Pressure', unit: 'bar', unit_index: 7, resolution: 2, device_description: 'SUTO DS310 Main', sensor_description: 'Pressure Sensor', active: true, selected: true },
        { channel_id: 3, sensor_channel_id: 3, sensor_id: 1, sensor_key: '1&1&0&1', sensor_name: 'SUTO DS310 Main', channel_name: 'Dew Point', unit: '°C Td', unit_index: 1, resolution: 1, device_description: 'SUTO DS310 Main', sensor_description: 'Dew Point Sensor', active: true, selected: true },
        // Sensor 2 (logical channels 4-6)
        { channel_id: 4, sensor_channel_id: 1, sensor_id: 2, sensor_key: '1&2&0&2', sensor_name: 'TCL Hao / S461 TCP', channel_name: 'Delta T', unit: '℃', unit_index: 0, resolution: 2, device_description: 'TCL Hao / S461 TCP', sensor_description: 'Differential Temp', active: true, selected: true },
        { channel_id: 5, sensor_channel_id: 2, sensor_id: 2, sensor_key: '1&2&0&2', sensor_name: 'TCL Hao / S461 TCP', channel_name: 'Temperature inlet', unit: '℃', unit_index: 0, resolution: 1, device_description: 'TCL Hao / S461 TCP', sensor_description: 'Inlet Temperature', active: true, selected: true },
        { channel_id: 6, sensor_channel_id: 3, sensor_id: 2, sensor_key: '1&2&0&2', sensor_name: 'TCL Hao / S461 TCP', channel_name: 'Temperature outlet', unit: '℃', unit_index: 0, resolution: 1, device_description: 'TCL Hao / S461 TCP', sensor_description: 'Outlet Temperature', active: true, selected: true },
      ];
      if (callback) callback(mockChannels);
      return mockChannels;
    }

    try {
      const rawChannels = await invoke('suto_get_channels');
      // Format channels to match S4A view schema. `channel_id` stays the
      // logical channel number (used for value lookup); `sensor_id` groups
      // channels that belong to the same physical sensor.
      const formatted = (Array.isArray(rawChannels) ? rawChannels : []).map((ch, idx) => ({
        channel_id: ch.id,
        channel_name: ch.description,
        unit: ch.unit,
        unit_index: ch.unit_index,
        resolution: ch.resolution,
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
    if (activeTransport === 'BLE') {
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
        const now = Date.now();
        values = [
          { id: 1, unit: 'm³/h', resolution: 1, status: 'normal', value: +(145.2 + Math.sin(now / 5000) * 12.5).toFixed(1) },
          { id: 2, unit: 'bar', resolution: 2, status: 'normal', value: +(6.85 + Math.cos(now / 4000) * 0.4).toFixed(2) },
          { id: 3, unit: '°C Td', resolution: 1, status: 'normal', value: +(-38.4 + Math.sin(now / 8000) * 1.5).toFixed(1) },
          { id: 4, unit: '℃', resolution: 2, status: 'normal', value: +(3.84 + Math.sin(now / 6000) * 0.35).toFixed(2) },
          { id: 5, unit: '℃', resolution: 1, status: 'normal', value: +(28.6 + Math.cos(now / 7000) * 0.8).toFixed(1) },
          { id: 6, unit: '℃', resolution: 1, status: 'normal', value: +(24.76 + Math.sin(now / 7000) * 0.7).toFixed(1) },
        ];
      } else {
        values = await invoke('suto_get_values');
      }
      const now = Date.now();

      const result = values.map((val) => {
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
    if (activeTransport === 'BLE') {
      return await BleSutoAPI.getSystemInfo();
    }
    if (!hasTauri()) {
      return {
        serial_number: 'SIM-SUTO-2026-99',
        device_id: 310,
        firmware_version: 'v3.2.1-sim',
        hardware_version: 'v1.4',
        calibration_date: '2026-01-15',
        device_name: 'SUTO DS310 (Simulated Demo)',
      };
    }
    return await invoke('suto_get_system_info');
  },

  /**
   * Get logger status (enabled, recorded count, start/end time, interval)
   */
  async getLoggerStatus() {
    if (!hasTauri()) {
      return {
        logging_active: true,
        records_count: 14200,
        start_time: Math.floor(Date.now() / 1000) - 14200,
        end_time: Math.floor(Date.now() / 1000),
        interval_sec: 1,
      };
    }
    return await invoke('suto_get_logger_status');
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

  /** Get disk path to the suto_usb.log file */
  async getLogFilePath() {
    if (!hasTauri()) {
      return './suto_usb.log (Browser Mock)';
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
};

export default TauriSutoAPI;
