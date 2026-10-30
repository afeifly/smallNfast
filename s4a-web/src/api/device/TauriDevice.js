/**
 * TauriDevice.js
 *
 * VirtualDevice adapter for the Tauri command engine (USB, Ethernet TCP, BLE).
 * Delegates directly to TauriSutoAPI.
 */

import TauriSutoAPI from '../TauriSutoAPI';

export const TauriCapabilities = {
  rawCommand: true,
  screenshots: true,
  report600: true,
  loggerFiles: true,
  loggerPageRead: false,
  s461Read: true,
  onlineSource: 'suto',
};

export const TauriDevice = {
  getCapabilities() {
    return { ...TauriCapabilities };
  },

  isAvailable() {
    return TauriSutoAPI.isAvailable();
  },

  getActiveTransport() {
    return TauriSutoAPI.getActiveTransport();
  },

  async connect(options = {}) {
    const kind = (options.kind || 'usb').toLowerCase();
    if (kind === 'usb') {
      return await TauriSutoAPI.connectUsb(options.path || null);
    }
    if (kind === 'tcp') {
      return await TauriSutoAPI.connectTcp(options.host, options.port);
    }
    if (kind === 'ble') {
      return await TauriSutoAPI.connectBle(options);
    }
    throw new Error(`[TauriDevice] Unsupported kind: ${options.kind}`);
  },

  async disconnect() {
    return await TauriSutoAPI.disconnect();
  },

  async getSystemInfo() {
    return await TauriSutoAPI.getSystemInfo();
  },

  async getChannels(callback) {
    return await TauriSutoAPI.getChannels(callback);
  },

  async getLayoutInfo() {
    return [];
  },

  async getMeasurementData(callback) {
    return await TauriSutoAPI.getMeasurementData(callback);
  },

  getTablePage(pageIndex, pageSize, selectedChannelIds, callback) {
    return TauriSutoAPI.getTablePage(pageIndex, pageSize, selectedChannelIds, callback);
  },

  async getLoggerStatus() {
    return await TauriSutoAPI.getLoggerStatus();
  },

  async getLoggerFiles() {
    return await TauriSutoAPI.getLoggerFiles();
  },

  async readS461Log(startTime, stopTime) {
    return await TauriSutoAPI.readS461Log(startTime, stopTime);
  },

  async getScreenshots() {
    return await TauriSutoAPI.getScreenshots();
  },

  async readScreenshot(name, size) {
    return await TauriSutoAPI.readScreenshot(name, size);
  },

  async get600CsdFiles() {
    return await TauriSutoAPI.get600CsdFiles();
  },

  async generate600Report(id, name, size, date) {
    return await TauriSutoAPI.generate600Report(id, name, size, date);
  },

  async sendCommand(cty, scty, act, data, addr) {
    return await TauriSutoAPI.sendCommand(cty, scty, act, data, addr);
  },

  async sendRaw(addr, data) {
    return await TauriSutoAPI.sendRaw(addr, data);
  },

  clearHistory() {
    TauriSutoAPI.clearHistory();
  },

  async logClientEvent(level, tag, message) {
    return await TauriSutoAPI.logClientEvent(level, tag, message);
  },

  async saveBinaryFile(filename, data) {
    return await TauriSutoAPI.saveBinaryFile(filename, data);
  },

  async pickFolder() {
    return await TauriSutoAPI.pickFolder();
  },

  async saveFileToPath(folder, filename, data) {
    return await TauriSutoAPI.saveFileToPath(folder, filename, data);
  },
};

export default TauriDevice;

