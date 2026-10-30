/**
 * VirtualDevice.js
 *
 * Core contract and registry for the S4A Virtual Device layer.
 * Decouples consumer views (liveDataSource, liveRecorder, ReadoutView, GraphicView)
 * from specific hardware transport drivers (Tauri command engine, Web Bluetooth,
 * S332 Web API, etc.).
 */

const registry = new Map();
let activeDevice = null;

export const DefaultCapabilities = {
  rawCommand: false,
  screenshots: false,
  report600: false,
  loggerFiles: false,
  loggerPageRead: false,
  s461Read: false,
  onlineSource: 'none', // 'suto' | 'api_poll' | 'api_ws' | 'none'
};

export const VirtualDevice = {
  /**
   * Register a driver implementation by kind (e.g., 'tauri', 'api')
   */
  registerDriver(kind, driver) {
    if (!kind || !driver) return;
    registry.set(kind.toLowerCase(), driver);
  },

  /**
   * Get a registered driver
   */
  getDriver(kind) {
    if (!kind) return null;
    return registry.get(kind.toLowerCase()) || null;
  },

  /**
   * Get the currently connected / active device instance
   */
  getActiveDevice() {
    return activeDevice;
  },

  /**
   * Set the currently active device instance
   */
  setActiveDevice(device) {
    activeDevice = device;
  },

  /**
   * Get capabilities of active device or default
   */
  getCapabilities() {
    if (activeDevice && typeof activeDevice.getCapabilities === 'function') {
      return activeDevice.getCapabilities();
    }
    return { ...DefaultCapabilities };
  },

  /**
   * Connect to a device by options:
   * @param {Object} options - { kind: 'usb'|'tcp'|'ble'|'api', ... }
   */
  async connect(options = {}) {
    const kind = (options.kind || 'tauri').toLowerCase();
    const driver = registry.get(kind);
    if (!driver) {
      throw new Error(`[VirtualDevice] No driver registered for kind: '${kind}'`);
    }

    const connectionInfo = await driver.connect(options);
    activeDevice = driver;
    return connectionInfo;
  },

  /**
   * Disconnect the active device
   */
  async disconnect() {
    if (activeDevice && typeof activeDevice.disconnect === 'function') {
      try {
        await activeDevice.disconnect();
      } finally {
        activeDevice = null;
      }
    }
    return true;
  },

  /**
   * Get active transport identifier ('USB' | 'TCP' | 'BLE' | 'API' | null)
   */
  getActiveTransport() {
    if (activeDevice && typeof activeDevice.getActiveTransport === 'function') {
      return activeDevice.getActiveTransport();
    }
    return null;
  },

  /**
   * Check if driver is available
   */
  isAvailable() {
    if (activeDevice && typeof activeDevice.isAvailable === 'function') {
      return activeDevice.isAvailable();
    }
    return false;
  },

  /**
   * Get system info (serial number, device name, model)
   */
  async getSystemInfo() {
    if (activeDevice && typeof activeDevice.getSystemInfo === 'function') {
      return await activeDevice.getSystemInfo();
    }
    return null;
  },

  /**
   * Get normalized channels
   */
  async getChannels(callback) {
    if (activeDevice && typeof activeDevice.getChannels === 'function') {
      return await activeDevice.getChannels(callback);
    }
    if (callback) callback([]);
    return [];
  },

  /**
   * Get layout points from device if available
   */
  async getLayoutInfo() {
    if (activeDevice && typeof activeDevice.getLayoutInfo === 'function') {
      return await activeDevice.getLayoutInfo();
    }
    return [];
  },

  /**
   * Get normalized measurement data
   */
  async getMeasurementData(callback) {
    if (activeDevice && typeof activeDevice.getMeasurementData === 'function') {
      return await activeDevice.getMeasurementData(callback);
    }
    if (callback) callback([]);
    return [];
  },

  /**
   * Get table page for table view
   */
  getTablePage(pageIndex, pageSize, selectedChannelIds, callback) {
    if (activeDevice && typeof activeDevice.getTablePage === 'function') {
      return activeDevice.getTablePage(pageIndex, pageSize, selectedChannelIds, callback);
    }
    const empty = { total: 0, rows: [], startTimeMs: Date.now(), stopTimeMs: Date.now(), sampleRate: 1 };
    if (callback) callback(empty);
    return empty;
  },

  /**
   * Get logger status
   */
  async getLoggerStatus() {
    if (activeDevice && typeof activeDevice.getLoggerStatus === 'function') {
      return await activeDevice.getLoggerStatus();
    }
    return null;
  },

  /**
   * Get device disk capacity and storage stats
   */
  async getDiskCapacity() {
    if (activeDevice && typeof activeDevice.getDiskCapacity === 'function') {
      return await activeDevice.getDiskCapacity();
    }
    return null;
  },

  /**
   * Get logger files list
   */
  async getLoggerFiles() {
    if (activeDevice && typeof activeDevice.getLoggerFiles === 'function') {
      return await activeDevice.getLoggerFiles();
    }
    return [];
  },

  /**
   * Read logger data by file name
   */
  async readLoggerData(fileName, onProgress, fileMeta = null) {
    if (activeDevice && typeof activeDevice.readLoggerData === 'function') {
      return await activeDevice.readLoggerData(fileName, onProgress, fileMeta);
    }
    throw new Error('readLoggerData is not supported by the active device');
  },

  /**
   * Clear in-memory history
   */
  clearHistory() {
    if (activeDevice && typeof activeDevice.clearHistory === 'function') {
      activeDevice.clearHistory();
    }
  },

  /**
   * Log client event
   */
  async logClientEvent(level, tag, message) {
    if (activeDevice && typeof activeDevice.logClientEvent === 'function') {
      return await activeDevice.logClientEvent(level, tag, message);
    }
  },

  /**
   * Save binary file
   */
  async saveBinaryFile(filename, data) {
    if (activeDevice && typeof activeDevice.saveBinaryFile === 'function') {
      return await activeDevice.saveBinaryFile(filename, data);
    }
    return null;
  },
};

export default VirtualDevice;

