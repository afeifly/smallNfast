/**
 * BleSutoAPI.js
 *
 * Web Bluetooth (BLE) Communication Driver for SUTO iTEC sensors & devices.
 * Uses the Web Bluetooth API (navigator.bluetooth) available in Google Chrome,
 * Chromium browsers, and supported WebViews.
 *
 * Allows direct wireless sensor connection and monitoring on macOS, Windows,
 * Linux, and Android without requiring native drivers!
 */

import TauriSutoAPI from './TauriSutoAPI';

// SUTO Official Hardware Bluetooth Low Energy (BLE) UUID Configurations
// Reference: /Users/ex/project/suto_flutter_series/suto_lib/lib/communication/ble/ble_device.dart
export const SUTO_BLE_CONFIG = {
  // Primary service UUIDs requested in Web Bluetooth optionalServices
  OPTIONAL_SERVICES: [
    // 1. Microchip ISSC Transparent UART (e.g. S401 / S421 / S520 Bluetooth modules)
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    // 2. Nordic UART Service (NUS)
    '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    // 3. TI / HM-10 / CC2541 UART Services (Read service 0xffe0, Write service 0xffe5)
    0xffe0,
    0xffe5,
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000ffe5-0000-1000-8000-00805f9b34fb',
    '0000ffe4-0000-1000-8000-00805f9b34fb',
    '0000ffe9-0000-1000-8000-00805f9b34fb',
    // Generic GATT profiles
    'generic_access',
    'device_information',
  ],

  // Specific hardware communication services for Web Bluetooth requestDevice({ filters })
  // Note: 'generic_access' is restricted on Chrome's filter blocklist, so it remains only in OPTIONAL_SERVICES.
  FILTER_SERVICES: [
    '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip ISSC Transparent UART
    '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
    0xffe0,                                  // TI / HM-10 UART
    0xffe5,
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000ffe5-0000-1000-8000-00805f9b34fb',
    '0000ffe4-0000-1000-8000-00805f9b34fb',
    '0000ffe9-0000-1000-8000-00805f9b34fb',
  ],

  // Read / Notify characteristic UUID prefixes (Sensor -> Host)
  READ_NOTIFY_PREFIXES: [
    '49535343-1e4d-4bd9', // Microchip ISSC Transparent UART RX
    'ffe4',                // TI HM-10 Read / Notify
    '6e400003-b5a3-f393', // Nordic NUS TX (Notify)
  ],

  // Write characteristic UUID prefixes (Host -> Sensor)
  WRITE_PREFIXES: [
    '49535343-8841-43f4', // Microchip ISSC Transparent UART TX
    'ffe9',                // TI HM-10 Write
    '6e400002-b5a3-f393', // Nordic NUS RX (Write)
  ],
};

// SUTO Device Model Mapping based on NProtocolHeader.java
export const SUTO_DEVICE_MODELS = {
  0x1049: 'SUTO S132',
  0x104b: 'SUTO S120',
  0x1052: 'SUTO DS320',
  0x1053: 'SUTO DS330',
  0x1055: 'SUTO DS350',
  0x1060: 'SUTO DS350-P2',
  0x1061: 'SUTO DS350-P4',
  0x1062: 'SUTO DS350-P6',
  0x1064: 'SUTO S330',
  0x1065: 'SUTO S331',
  0x1066: 'SUTO S551-P4',
  0x1067: 'SUTO S551-P6',
  0x1068: 'SUTO S600',
  0x1069: 'SUTO S600-1',
  0x106f: 'SUTO S600-AC',
  0x1080: 'SUTO DP500',
  0x1082: 'SUTO DP520',
  0x120e: 'SUTO S418-DN8',
  0x120f: 'SUTO S418-DN15',
  0x1210: 'SUTO S418-DN20',
  0x1211: 'SUTO S418-DN25',
  0x1217: 'SUTO S415-DN32',
  0x1218: 'SUTO S418-DN32',
  0x1219: 'SUTO S419-DN32',
  0x122b: 'SUTO S418-DN40',
  0x122c: 'SUTO S418-DN50',
  0x122d: 'SUTO S418V-DN40',
  0x122e: 'SUTO S418V-DN50',
  0x121e: 'SUTO S605I',
  0x121f: 'SUTO S605C',
  0x1220: 'SUTO S606I',
  0x1221: 'SUTO S606C',
  0x1300: 'SUTO S461',
  0x1302: 'SUTO S463',
  0x0001: 'SUTO Display TG',
  0x0002: 'SUTO FA 300',
  0x0003: 'SUTO VA 300',
  0x0004: 'SUTO DS 300 Logger',
  0x0005: 'SUTO DS 300 Non-Logger',
  0x0006: 'SUTO DS 300 Portable',
};

// SUTO DS310 Units Map.
// Mirrors CSLib `CommConst.UNIT_STRING`: index 0 is the custom unit (use the
// ASCII supplied by the device); index 1 is °C, etc.
const SUTO_UNITS = [
  '', '°C', '°F', '%RH', '°Ctd', '°Ftd', 'mg/Kg', 'mg/m³', 'g/Kg', 'g/m³',
  'm/s', 'ft/min', 'Nm/s', 'Nft/min', 'm³/h', 'm³/min', 'l/min', 'l/s',
  'cfm', 'Nm³/h', 'Nm³/min', 'Nl/min', 'Nl/s', 'Ncfm', 'm³', 'l', 'cf',
  'Nm³', 'Nl', 'Ncf', 'ppm[v]', '°Ctd atm', '°Ftd atm', 'Pa', 'hPa',
  'KPa', 'MPa', 'mbar', 'bar', 'PSI', 'mV', 'V', 'uV', 'KV', 'mA', 'A',
  'kg/s', 'kg',
];

// Consumption / counter channels store their value as an integer, not a float
// (CSLib `CommConst.CSCOMM_CONSUMPTION_UNIT_INDEX`).
const CONSUMPTION_UNIT_INDEX = [24, 25, 26, 27, 28, 47];

function decodeValue(view, mbType, unitIndex) {
  if (CONSUMPTION_UNIT_INDEX.includes(unitIndex)) {
    return view.getUint32(0, true);
  }
  switch (mbType) {
    case 4:
      return view.getInt32(0, true);
    case 6:
      return view.getUint32(0, true);
    default:
      return view.getFloat32(0, true);
  }
}

export class BleSutoManager {
  constructor() {
    this.device = null;
    this.server = null;
    this.rxChar = null; // Outgoing write characteristic (Host -> Sensor)
    this.txChar = null; // Incoming notify characteristic (Sensor -> Host)
    this.devAddr = 1;
    this.systemInfo = null;
    this.cachedChannels = [];
    this.rxBuffer = [];
    this._bleLock = Promise.resolve();
    this._pendingRxCallback = null;
    this.historyBuffer = new Map();
  }

  isSupported() {
    return (typeof navigator !== 'undefined' && 'bluetooth' in navigator) || TauriSutoAPI.isAvailable();
  }

  getSupportIssue() {
    if (TauriSutoAPI.isAvailable()) {
      return null;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      return 'Web Bluetooth requires a Secure Context (HTTPS or localhost). Accessing via plain HTTP over LAN (e.g. http://192.168.x.x) disables Bluetooth in the browser. Use HTTPS or localhost.';
    }
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      return 'Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or a Chromium-based browser.';
    }
    return null;
  }

  isConnected() {
    return !!(this.server && this.server.connected && this.rxChar);
  }

  getDeviceName() {
    return this.device?.name || 'SUTO BLE Device';
  }

  /**
   * Build Web Bluetooth filters for SUTO hardware services.
   * Each service is placed in its own filter object to achieve logical OR matching.
   */
  buildDeviceFilters() {
    return SUTO_BLE_CONFIG.FILTER_SERVICES.map(service => ({ services: [service] }));
  }

  /**
   * Request Bluetooth device via Chrome native picker and establish connection.
   * By default, filters the device list by SUTO hardware services first.
   * If `options.acceptAll` is true, falls back to unfiltered scan (acceptAllDevices: true).
   *
   * @param {Object} [options]
   * @param {boolean} [options.acceptAll=false] - Whether to show all nearby Bluetooth devices without filter
   */
  async connectBle(options = {}) {
    if (!this.isSupported()) {
      const msg = 'Web Bluetooth is not supported in this browser environment. Please use Google Chrome or a Chromium-based browser.';
      TauriSutoAPI.logClientEvent('ERROR', 'BLE_CONN', msg);
      throw new Error(msg);
    }

    try {
      const useFilter = !options.acceptAll;
      TauriSutoAPI.logClientEvent(
        'INFO',
        'BLE_CONN',
        useFilter
          ? 'Opening Bluetooth device scanner dialog (filtered by SUTO hardware services)...'
          : 'Opening Bluetooth device scanner dialog (unfiltered: showing all nearby devices)...'
      );

      const requestOptions = useFilter
        ? {
            filters: this.buildDeviceFilters(),
            optionalServices: SUTO_BLE_CONFIG.OPTIONAL_SERVICES,
          }
        : {
            acceptAllDevices: true,
            optionalServices: SUTO_BLE_CONFIG.OPTIONAL_SERVICES,
          };

      const device = await navigator.bluetooth.requestDevice(requestOptions);

      this.device = device;
      TauriSutoAPI.logClientEvent(
        'INFO',
        'BLE_CONN',
        `User selected BLE device: "${device.name || 'Unnamed'}" (ID: ${device.id})`
      );

      device.addEventListener('gattserverdisconnected', () => {
        TauriSutoAPI.logClientEvent('WARN', 'BLE_CONN', `BLE Device "${device.name}" disconnected`);
        this.server = null;
        this.rxChar = null;
        this.txChar = null;
      });

      TauriSutoAPI.logClientEvent('INFO', 'BLE_CONN', 'Connecting to GATT server...');
      const server = await device.gatt.connect();
      this.server = server;

      // Locate serial communication service & characteristics matching SUTO hardware
      let writeChar = null;
      let notifyChar = null;
      const scannedChars = [];

      try {
        const services = await server.getPrimaryServices();
        for (const s of services) {
          try {
            const chars = await s.getCharacteristics();
            for (const c of chars) {
              const u = c.uuid.toLowerCase();
              scannedChars.push({ uuid: u, char: c, properties: c.properties });

              if (!writeChar && SUTO_BLE_CONFIG.WRITE_PREFIXES.some(prefix => u.includes(prefix.toLowerCase()))) {
                writeChar = c;
              }
              if (!notifyChar && SUTO_BLE_CONFIG.READ_NOTIFY_PREFIXES.some(prefix => u.includes(prefix.toLowerCase()))) {
                notifyChar = c;
              }
            }
          } catch (cErr) {
            TauriSutoAPI.logClientEvent('DEBUG', 'BLE_CONN', `Service ${s.uuid} char probe note: ${cErr.message}`);
          }
        }
      } catch (svcErr) {
        TauriSutoAPI.logClientEvent('DEBUG', 'BLE_CONN', `getPrimaryServices note: ${svcErr.message}`);
      }

      // Fallback: If characteristics were not found by prefix, check standard GATT characteristics
      if (!writeChar) {
        writeChar = scannedChars.find(item => item.properties.write || item.properties.writeWithoutResponse)?.char;
      }
      if (!notifyChar) {
        notifyChar = scannedChars.find(item => (item.properties.notify || item.properties.indicate) && item.char !== writeChar)?.char;
      }
      // Single characteristic fallback (for HM-10 0xffe1 dual write/notify)
      if (!notifyChar && writeChar && (writeChar.properties.notify || writeChar.properties.indicate)) {
        notifyChar = writeChar;
      }

      this.rxChar = writeChar;  // Outgoing write characteristic
      this.txChar = notifyChar; // Incoming notify characteristic

      if (!this.rxChar || !this.txChar) {
        throw new Error(
          `Could not identify SUTO RX/TX characteristics on BLE device "${device.name}". ` +
          `Found ${scannedChars.length} characteristic(s). Please verify sensor BLE UART service.`
        );
      }

      // Enable notifications on TX
      await this.txChar.startNotifications();
      this.txChar.addEventListener('characteristicvaluechanged', (e) => {
        const dv = e.target.value;
        const val = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
        const hex = Array.from(val).map(b => b.toString(16).padStart(2, '0')).join(' ');
        TauriSutoAPI.logClientEvent('DEBUG', 'BLE_RX', `BLE chunk received (${val.length} bytes): ${hex}`);
        for (let i = 0; i < val.length; i++) {
          this.rxBuffer.push(val[i]);
        }
        if (this._pendingRxCallback) {
          this._pendingRxCallback();
        }
      });

      TauriSutoAPI.logClientEvent(
        'INFO',
        'BLE_CONN',
        `🎉 BLE connected and notifications active on "${device.name}"`
      );

      // Perform Device Identification ('A')
      // SUTO BLE sensors operate point-to-point on Address 1 by default (suto_lib SUTOProtocol.DEVICE_ADDR = 1).
      TauriSutoAPI.logClientEvent('INFO', 'BLE_DISC', "Sending Device Information query ('A') over BLE...");
      let activeAddr = 1;
      let devInfo = null;

      try {
        const discPkt1 = this._packPacket(1, [0x41]); // 'A' on address 1
        const reply1 = await this.writeAndRead(discPkt1, 2000);
        devInfo = this._parseDeviceIdResponse(reply1);
        activeAddr = (reply1 && reply1.length && reply1[0] !== 0) ? reply1[0] : 1;
      } catch (errAddr1) {
        TauriSutoAPI.logClientEvent('DEBUG', 'BLE_DISC', `Address 1 query note: ${errAddr1.message}, trying address 0...`);
        try {
          const discPkt0 = this._packPacket(0, [0x41]); // 'A' on broadcast address 0
          const reply0 = await this.writeAndRead(discPkt0, 2000);
          devInfo = this._parseDeviceIdResponse(reply0);
          activeAddr = (reply0 && reply0.length && reply0[0] !== 0) ? reply0[0] : 1;
        } catch (errAddr0) {
          TauriSutoAPI.logClientEvent('WARN', 'BLE_DISC', `Address discovery fallback: ${errAddr0.message}`);
        }
      }

      this.devAddr = activeAddr;
      if (devInfo) {
        this.systemInfo = devInfo;
        TauriSutoAPI.logClientEvent(
          'INFO',
          'BLE_DISC',
          `🎉 SUTO BLE Identified! Device: ${devInfo.device_name}, SN: ${devInfo.serial_number}, FW: ${devInfo.firmware_version}`
        );
      } else {
        this.systemInfo = {
          serial_number: (device.id || 'BLE-SUTO').slice(-8).toUpperCase(),
          device_id: 0,
          device_name: device.name || 'SUTO BLE Device',
          firmware_version: 'v1.0',
          hardware_version: 'v1.0',
        };
      }

      return {
        address: activeAddr,
        device: this.systemInfo.device_name,
        serial_number: this.systemInfo.serial_number,
        type: 'BLE',
      };
    } catch (err) {
      TauriSutoAPI.logClientEvent('ERROR', 'BLE_CONN', `BLE connection failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Parse SUTO Address 0 / Unicast 'A' response into Device Identification and Serial Number.
   * Matches S4ABase.java, CSCOMM_DEVICE_ID.java, and CSCOMMExtend.java:
   *   BusVersion (1 byte)
   *   DeviceIdentification (2 bytes, little-endian)
   *   SoftwareVersion (1 byte)
   *   DeviceSerialNumber (4 bytes, little-endian uint32 formatted as 8-digit decimal string with leading zeros)
   */
  _parseDeviceIdResponse(rawBytes) {
    if (!rawBytes || rawBytes.length < 8) return null;

    let payload = rawBytes;
    // SUTO frame: [addr, frame_len, status/0x3E, busVer, devId_lo, devId_hi, swVer, sn0, sn1, sn2, sn3, checksum, 0x00]
    if (rawBytes.length >= 11 && (rawBytes[2] === 0x3e || rawBytes[2] === 0x00)) {
      payload = rawBytes.slice(3, 11);
    } else if (rawBytes.length >= 8) {
      payload = rawBytes.slice(0, 8);
    }

    const busVersion = payload[0];
    const devId = (payload[1] & 0xff) | ((payload[2] & 0xff) << 8);
    const swVersion = payload[3] & 0xff;
    const rawSn = ((payload[4] & 0xff) | ((payload[5] & 0xff) << 8) | ((payload[6] & 0xff) << 16) | ((payload[7] & 0xff) << 24)) >>> 0;

    // Format SN with 8 digits leading zeros, exactly matching S4ABase.java:
    // String uuid = String.valueOf(deviceID.DeviceSerialNumber);
    // for (int j = 0; j < 8 - uuid.length(); j++) { uuid = "0" + uuid; }
    const snStr = String(rawSn).padStart(8, '0');
    const deviceName = SUTO_DEVICE_MODELS[devId] || (this.device?.name || `SUTO Sensor (0x${devId.toString(16).toUpperCase()})`);

    return {
      serial_number: snStr,
      device_id: devId,
      device_name: deviceName,
      bus_version: busVersion,
      firmware_version: `v${(swVersion / 10).toFixed(1)}`,
      hardware_version: 'v1.0',
    };
  }

  async getSystemInfo() {
    if (this.systemInfo && this.systemInfo.serial_number) {
      return this.systemInfo;
    }
    return {
      serial_number: this.systemInfo?.serial_number || 'UNKNOWN',
      device_id: this.systemInfo?.device_id || 0,
      device_name: this.device?.name || 'SUTO BLE Device',
      firmware_version: this.systemInfo?.firmware_version || 'v1.0',
      hardware_version: 'v1.0',
    };
  }

  async disconnect() {
    TauriSutoAPI.logClientEvent('INFO', 'BLE_CONN', 'Disconnecting BLE session...');
    if (this._pendingRxCallback) {
      try { this._pendingRxCallback(); } catch (_) {}
      this._pendingRxCallback = null;
    }
    this._bleLock = Promise.resolve();

    if (this.server && this.server.connected) {
      try {
        this.server.disconnect();
      } catch (e) {
        console.warn('GATT disconnect error:', e);
      }
    }
    this.server = null;
    this.rxChar = null;
    this.txChar = null;
    this.device = null;
    this.systemInfo = null;
    this.rxBuffer = [];
    TauriSutoAPI.logClientEvent('INFO', 'BLE_CONN', 'BLE session closed');
  }

  /**
   * Send packet over BLE and await reassembled response.
   * Guarantees strict serialization via a Promise mutex lock, preventing
   * concurrent Web Bluetooth GATT collisions that deadlock Chrome's renderer process.
   */
  async writeAndRead(packet, timeoutMs = 3000) {
    if (!this.isConnected()) throw new Error('BLE device not connected');

    const prevLock = this._bleLock;
    let releaseLock;
    this._bleLock = new Promise(resolve => { releaseLock = resolve; });

    try {
      await prevLock.catch(() => {});
      return await this._executeWriteAndRead(packet, timeoutMs);
    } finally {
      releaseLock();
    }
  }

  async _executeWriteAndRead(packet, timeoutMs = 3000) {
    if (!this.isConnected()) throw new Error('BLE device not connected');

    const hex = Array.from(packet).map(b => b.toString(16).padStart(2, '0')).join(' ');
    TauriSutoAPI.logClientEvent('DEBUG', 'BLE_TX', `>> Writing ${packet.length} bytes over BLE: ${hex}`);

    this.rxBuffer = [];
    const uint8 = new Uint8Array(packet);

    // BLE MTU chunking (20-byte safe chunks)
    const CHUNK_SIZE = 20;
    for (let i = 0; i < uint8.length; i += CHUNK_SIZE) {
      if (!this.isConnected()) throw new Error('BLE disconnected during transmission');
      const slice = uint8.slice(i, i + CHUNK_SIZE);
      if (this.rxChar.properties.write) {
        await this.rxChar.writeValueWithResponse(slice);
      } else if (this.rxChar.properties.writeWithoutResponse) {
        await this.rxChar.writeValueWithoutResponse(slice);
      } else if (typeof this.rxChar.writeValue === 'function') {
        await this.rxChar.writeValue(slice);
      }

      if (i + CHUNK_SIZE < uint8.length) {
        await new Promise(r => setTimeout(r, 15));
      }
    }

    return new Promise((resolve, reject) => {
      let timeoutTimer = null;
      let checkTimer = null;
      let lastLen = 0;
      let lastChunkTime = 0;

      const cleanup = () => {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
        if (checkTimer) {
          clearInterval(checkTimer);
          checkTimer = null;
        }
        this._pendingRxCallback = null;
      };

      const checkCompletion = () => {
        if (!this.isConnected()) {
          cleanup();
          reject(new Error('BLE disconnected while awaiting response'));
          return;
        }

        if (this.rxBuffer.length > 0) {
          if (this.rxBuffer.length !== lastLen) {
            lastLen = this.rxBuffer.length;
            lastChunkTime = Date.now();
          }

          // Full multi-frame response complete verification:
          // Returns true only when all chained frames are fully received
          // and the final frame has frameLen < 192 (0xC0).
          if (this._isResponseComplete(this.rxBuffer)) {
            const buf = [...this.rxBuffer];
            cleanup();
            const resHex = this._formatHex(buf);
            TauriSutoAPI.logClientEvent('INFO', 'BLE_RX', `<< Complete response received (${buf.length} bytes): ${resHex}`);
            resolve(buf);
            return;
          }

          // Quiet period checks (only when packet stopped growing):
          if (lastChunkTime > 0 && this.rxBuffer.length >= 4) {
            const elapsed = Date.now() - lastChunkTime;
            const firstFrameLen = this.rxBuffer[1];
            const isSingleFrame = firstFrameLen < 192;

            // Single frame complete: rxBuffer matches frameLen and no new chunk for >150ms
            if (isSingleFrame && this.rxBuffer.length >= firstFrameLen && elapsed > 150) {
              const buf = [...this.rxBuffer];
              cleanup();
              const resHex = this._formatHex(buf);
              TauriSutoAPI.logClientEvent('INFO', 'BLE_RX', `<< Complete single frame received (${buf.length} bytes): ${resHex}`);
              resolve(buf);
              return;
            }

            // Multi-frame quiet fallback: if device finished sending all frames
            // but no more chunks arrived for >450ms
            if (!isSingleFrame && elapsed > 450) {
              const buf = [...this.rxBuffer];
              cleanup();
              const resHex = this._formatHex(buf);
              TauriSutoAPI.logClientEvent('INFO', 'BLE_RX', `<< Multi-frame transfer complete (${buf.length} bytes): ${resHex}`);
              resolve(buf);
              return;
            }
          }
        }
      };

      this._pendingRxCallback = checkCompletion;

      // Poll periodically in case notification arrived before callback registered
      checkTimer = setInterval(checkCompletion, 30);
      checkCompletion();

      timeoutTimer = setTimeout(() => {
        cleanup();
        if (this.rxBuffer.length > 0) {
          const buf = [...this.rxBuffer];
          resolve(buf);
        } else {
          const msg = `BLE Communication timeout: no response within ${timeoutMs}ms`;
          TauriSutoAPI.logClientEvent('WARN', 'BLE_RX', msg);
          reject(new Error(msg));
        }
      }, timeoutMs);
    });
  }

  _isResponseComplete(buf) {
    if (buf.length < 4) return false;
    let offset = 0;
    while (offset < buf.length) {
      if (offset + 2 > buf.length) return false;
      const frameLen = buf[offset + 1];
      if (frameLen < 4) return false;
      const nextOffset = offset + frameLen;
      if (buf.length < nextOffset) return false;
      if (frameLen < 192) return true; // Final frame
      offset = nextOffset;
    }
    return false;
  }

  _formatHex(bytes, maxBytes = 48) {
    if (!bytes || !bytes.length) return '';
    if (bytes.length <= maxBytes) {
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
    }
    const preview = Array.from(bytes.slice(0, maxBytes)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    return `${preview} ... (${bytes.length} bytes total)`;
  }

  _packPacket(addr, cmdBytes) {
    const totalLen = 2 + cmdBytes.length + 2;
    const pkt = [addr, totalLen, ...cmdBytes];
    let sum = 0;
    for (let i = 0; i < pkt.length; i++) {
      sum = (sum + pkt[i]) & 0xff;
    }
    const cksum = ((sum ^ 0xff) + 1) & 0xff;
    pkt.push(cksum);
    pkt.push(0x00);
    return pkt;
  }

  _deframeMultiFrame(rawBytes) {
    if (rawBytes.length < 5) throw new Error('Data too short for deframing');
    let offset = 0;
    const payload = [];

    while (offset < rawBytes.length) {
      if (offset + 2 > rawBytes.length) break;
      const frameLen = rawBytes[offset + 1];
      const frameEnd = offset + frameLen;
      if (frameEnd > rawBytes.length) break;

      // Frame 0 has status byte at index 2 (0x3E)
      const dataStart = offset === 0 ? offset + 3 : offset + 2;
      const dataEnd = frameEnd - 2;

      for (let i = dataStart; i < dataEnd; i++) {
        payload.push(rawBytes[i]);
      }
      offset = frameEnd;
    }
    return payload;
  }

  _parseChannelStructs(deframed) {
    const STRUCT_SIZE = 204;
    const channels = [];
    const numStructs = Math.floor(deframed.length / STRUCT_SIZE);

    for (let i = 0; i < numStructs; i++) {
      const off = i * STRUCT_SIZE;
      const logChNo = deframed[off];
      // Reject unconfigured/empty structs (logical channel 0 or 0xFF),
      // mirroring CSLib `CSCOMM_DS310_CHANNEL_SETTING.parseByteArray`.
      if (logChNo === 0 || logChNo === 0xff) continue;
      const chId = logChNo;

      // Channels with bit 3 of ChOptionalConfig set are hidden/disabled (cs_monitor: & 0x08)
      const chOptionalConfig = deframed[off + 196];
      if ((chOptionalConfig & 0x08) === 0x08) continue;

      const devDesc = this._readUtf8String(deframed, off + 1, 21);
      const sensorDesc = this._readUtf8String(deframed, off + 43, 21);
      const chDesc = this._readUtf8String(deframed, off + 64, 21);
      const resolution = deframed[off + 85];
      const unitIndex = deframed[off + 86];
      const unitAscii = this._readUtf8String(deframed, off + 87, 12);
      const mbType = deframed[off + 138];

      // Custom unit fallback: if unitIndex is 0 or unit not in standard table, use unitAscii
      let unit = SUTO_UNITS[unitIndex];
      if (!unit || unitIndex === 0) {
        unit = (unitAscii && unitAscii.trim()) ? unitAscii.trim() : `u${unitIndex}`;
      }

      const chName = chDesc || sensorDesc || (devDesc ? `${devDesc} CH${chId}` : `Channel ${chId}`);

      channels.push({
        channel_id: chId,
        channel_name: chName,
        unit,
        unit_index: unitIndex,
        resolution,
        mb_output_value_type: mbType,
        device_description: devDesc || this.getDeviceName(),
        sensor_description: sensorDesc,
        active: true,
        selected: true,
      });
    }
    return channels;
  }

  async getChannels() {
    TauriSutoAPI.logClientEvent('INFO', 'BLE_CH', `Querying channel configuration for address ${this.devAddr}...`);

    // Check device model & firmware version
    const devId = this.systemInfo?.device_id || 0;
    const swVer = parseFloat((this.systemInfo?.firmware_version || '1.0').replace(/[^\d.]/g, '') || '1.0');
    // Only S330/S331 with FW >= 1.54 use transformed channels (0x0B) as primary
    const isS330orS331 = (devId === 0x1064 || devId === 0x1065);
    const useTransfOnly = isS330orS331 && swVer >= 1.54;
    const primaryPrefix = useTransfOnly ? 0x0B : 0x02;

    // Scan channels in batches of 2 to avoid overwhelming BLE UART buffers
    const BATCH = 2;
    const MAX_SCAN = 16;
    const channels = [];
    let start = 1;
    let consecutiveEmpty = 0;

    while (start <= MAX_SCAN && consecutiveEmpty < 2) {
      const cnt = Math.min(BATCH, MAX_SCAN - start + 1);
      const pkt = this._packPacket(this.devAddr, [0x04, 0x02, primaryPrefix, start, cnt]);
      try {
        const rawSetting = await this.writeAndRead(pkt, 3000);
        const deframed = this._deframeMultiFrame(rawSetting);
        const parsed = this._parseChannelStructs(deframed);
        if (parsed.length > 0) {
          consecutiveEmpty = 0;
          for (const ch of parsed) {
            if (!channels.some(c => c.channel_id === ch.channel_id)) {
              channels.push(ch);
            }
          }
          // If device returned all configured channel structs in a single multi-frame response
          // (such as S461 responding with all 9-10 channels in one shot)
          if (parsed.length > cnt) {
            TauriSutoAPI.logClientEvent(
              'INFO',
              'BLE_CH',
              `Device returned all ${parsed.length} channel structs in one batch.`
            );
            break;
          }
        } else {
          consecutiveEmpty++;
        }
      } catch (err) {
        TauriSutoAPI.logClientEvent('WARN', 'BLE_CH', `Batch start=${start} query note: ${err.message}`);
        consecutiveEmpty++;
      }
      start += cnt;
    }

    // Sort by logical channel id
    channels.sort((a, b) => a.channel_id - b.channel_id);

    // Fallback: If sensor didn't return channel descriptors, synthesize standard channels
    if (channels.length === 0) {
      const devName = this.systemInfo?.device_name || this.getDeviceName();
      channels.push(
        { channel_id: 1, channel_name: 'Flow', unit: 'm³/h', unit_index: 14, resolution: 1, device_description: devName, sensor_description: 'Flow Sensor', active: true, selected: true },
        { channel_id: 2, channel_name: 'Velocity', unit: 'm/s', unit_index: 10, resolution: 2, device_description: devName, sensor_description: 'Velocity Sensor', active: true, selected: true },
        { channel_id: 3, channel_name: 'Temperature', unit: '°C', unit_index: 1, resolution: 1, device_description: devName, sensor_description: 'Temp Sensor', active: true, selected: true }
      );
    }

    this.cachedChannels = channels;
    TauriSutoAPI.logClientEvent(
      'INFO',
      'BLE_CH',
      `Active ${channels.length} BLE channels: ${channels.map(c => `#${c.channel_id} ${c.channel_name} (${c.unit})`).join(', ')}`
    );
    return channels;
  }

  async getMeasurementData() {
    if (!this.cachedChannels.length) return [];
    const chIds = this.cachedChannels.map(c => c.channel_id);
    const start = chIds[0];
    const end = chIds[chIds.length - 1];
    const count = end - start + 1;

    try {
      // CMD_GET_ONLINE_VAL: [0x04, 0x01, 0x01, start, count]
      const valPkt = this._packPacket(this.devAddr, [0x04, 0x01, 0x01, start, count]);
      const rawVal = await this.writeAndRead(valPkt, 2500);
      const deframed = this._deframeMultiFrame(rawVal);

      const result = [];
      const VALUE_SIZE = 7;
      const now = Date.now();

      for (let i = 0; i < count; i++) {
        const chId = start + i;
        const chConfig = this.cachedChannels.find(c => c.channel_id === chId);
        if (!chConfig) continue; // Skip unconfigured channels in gaps

        const off = i * VALUE_SIZE;
        if (off + VALUE_SIZE > deframed.length) break;

        const view = new DataView(new Uint8Array(deframed.slice(off, off + 4)).buffer);
        const unitIndex = deframed[off + 5];
        const mbType = chConfig.mb_output_value_type ?? 0;
        const numeric = decodeValue(view, mbType, unitIndex);
        const statusByte = deframed[off + 6];

        let status = 'normal';
        let val = numeric;
        if (statusByte & 0x04 || !isFinite(numeric)) {
          status = 'invalid';
          val = null;
        } else if (statusByte & 0x08) {
          status = 'overrange';
        }

        if (!this.historyBuffer.has(chId)) {
          this.historyBuffer.set(chId, []);
        }
        const hist = this.historyBuffer.get(chId);
        if (val !== null) {
          hist.push(val);
          if (hist.length > 3600) hist.shift();
        }

        result.push({
          channel_id: chId,
          current_value: val,
          status,
          unit: chConfig.unit || '',
          resolution: deframed[off + 4],
          realStartTime: [now - (hist.length * 1000)],
          pointInterval: [1000],
          measurementData: [hist.slice()],
          min: hist.length ? Math.min(...hist) : 0,
          max: hist.length ? Math.max(...hist) : 0,
        });
      }
      return result;
    } catch (pollErr) {
      TauriSutoAPI.logClientEvent('DEBUG', 'BLE_VAL', `Polling note: ${pollErr.message}`);
      return [];
    }
  }

  // Decode a NUL-terminated description field as UTF-8, matching CSLib
  // `CSCOMMExtend.byteArrayToUTFStringStopAt0` (`new String(tmp, "UTF-8")`).
  _readUtf8String(buf, start, len) {
    const end = Math.min(start + len, buf.length);
    let stop = start;
    while (stop < end && buf[stop] !== 0) stop++;
    const bytes = Uint8Array.from(buf.slice(start, stop));
    return new TextDecoder('utf-8').decode(bytes).trim();
  }
}

export const BleSutoAPI = new BleSutoManager();
export default BleSutoAPI;
