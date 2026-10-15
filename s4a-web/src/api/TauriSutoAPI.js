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

import { isTauri } from '../util/platform';
import { invoke } from '@tauri-apps/api/core';

// Rolling measurement buffer for chart display (keeps last 3600 points)
const historyBuffer = new Map();
const MAX_HISTORY = 3600;

export const TauriSutoAPI = {
  isAvailable() {
    return isTauri;
  },

  /** List available USB devices */
  async listUsbDevices() {
    if (!isTauri) {
      return [{ path: 'USB\\VID_04D8&PID_0001\\SIMULATED', description: 'SUTO S331 / DS310 (Simulated Demo)' }];
    }
    return await invoke('suto_list_usb_devices');
  },

  /** Connect to SUTO USB device and auto-discover address */
  async connectUsb(devicePath = null) {
    if (!isTauri) {
      return { address: 1, channels_count: 4, device: 'SUTO DS310 (Simulated Demo)' };
    }
    return await invoke('suto_connect_usb', { path: devicePath });
  },

  /** Disconnect from active device */
  async disconnect() {
    if (!isTauri) return;
    return await invoke('suto_disconnect');
  },

  /**
   * Get channels formatted for S4A-Web Views
   * @param {Function} [callback]
   */
  async getChannels(callback) {
    if (!isTauri) {
      const mockChannels = [
        // Device 1: SUTO DS310 Main Unit
        { channel_id: 1, channel_name: 'Flow', unit: 'm³/h', unit_index: 3, resolution: 1, device_description: 'SUTO DS310 Main', sensor_description: 'Flow Sensor', active: true, selected: true },
        { channel_id: 2, channel_name: 'Pressure', unit: 'bar', unit_index: 7, resolution: 2, device_description: 'SUTO DS310 Main', sensor_description: 'Pressure Sensor', active: true, selected: true },
        { channel_id: 3, channel_name: 'Dew Point', unit: '°C Td', unit_index: 1, resolution: 1, device_description: 'SUTO DS310 Main', sensor_description: 'Dew Point Sensor', active: true, selected: true },
        // Device 2: TCL Hao / S461 TCP
        { channel_id: 4, channel_name: 'Delta T', unit: '℃', unit_index: 0, resolution: 2, device_description: 'TCL Hao / S461 TCP', sensor_description: 'Differential Temp', active: true, selected: true },
        { channel_id: 5, channel_name: 'Temperature inlet', unit: '℃', unit_index: 0, resolution: 1, device_description: 'TCL Hao / S461 TCP', sensor_description: 'Inlet Temperature', active: true, selected: true },
        { channel_id: 6, channel_name: 'Temperature outlet', unit: '℃', unit_index: 0, resolution: 1, device_description: 'TCL Hao / S461 TCP', sensor_description: 'Outlet Temperature', active: true, selected: true },
      ];
      if (callback) callback(mockChannels);
      return mockChannels;
    }

    try {
      const rawChannels = await invoke('suto_get_channels');
      // Format channels to match S4A view schema
      const formatted = rawChannels.map((ch, idx) => ({
        channel_id: ch.id,
        channel_name: ch.description,
        unit: ch.unit,
        unit_index: ch.unit_index,
        resolution: ch.resolution,
        device_description: ch.device_desc,
        sensor_description: ch.sensor_desc,
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
    try {
      let values;
      if (!isTauri) {
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
    if (!isTauri) {
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
    if (!isTauri) {
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
    if (!isTauri) throw new Error('Tauri runtime not detected');
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
    if (!isTauri) throw new Error('Tauri runtime not detected');
    return await invoke('suto_send_raw', { addr, data });
  },

  /** Clear in-memory chart history */
  clearHistory() {
    historyBuffer.clear();
  },

  /** Get diagnostic log entries from Rust engine or mock buffer */
  async getLogs(sinceId = 0) {
    if (!isTauri) {
      return (window._mockSutoLogs || []).filter(l => l.id > sinceId);
    }
    return await invoke('suto_get_logs', { sinceId });
  },

  /** Clear all diagnostic logs */
  async clearLogs() {
    if (!isTauri) {
      window._mockSutoLogs = [];
      return;
    }
    return await invoke('suto_clear_logs');
  },

  /** Get disk path to the suto_usb.log file */
  async getLogFilePath() {
    if (!isTauri) {
      return './suto_usb.log (Browser Mock)';
    }
    return await invoke('suto_get_log_file_path');
  },

  /** Write a client-side event to the unified SUTO log */
  async logClientEvent(level, tag, message) {
    if (!isTauri) {
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
};

export default TauriSutoAPI;
