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
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import BleSutoAPI from './BleSutoAPI';
import ApiDevice from './device/ApiDevice';
import { resolveChannelResolution } from '../util/resolution';
import {
  modbusData2Double,
  MODBUS_DATA_TYPES,
  normalizeModbusDataType,
  applyModbusChannelScaling,
  parseCSCommChannelSetting,
  buildCSCommChannelSetting,
  buildCsGetDeviceInfoCommand,
  buildCsBroadcastGetDeviceInfoCommand,
  parseCsDeviceInfoResponse,
  getSutoModelFromDeviceId,
  buildCsGetChannelCountCommand,
  parseCsChannelCountResponse,
  buildCsGetChannelStructCommand,
  parseCsChannelStructBatchResponse,
  channelSettingToModbusChannel,
  createMockS331ChannelSettings,
  CS_MEASUREMENT_VALUE_SIZE,
  buildCsGetOnlineMeasurementValuesCommand,
  parseCsOnlineMeasurementValues,
  createMockS331MeasurementValues
} from './modbusProtocol';

const hasNativeTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__?.invoke);
const hasLanBridge = () => typeof window !== 'undefined' && Boolean(window.__S4A_LAN_BRIDGE__ || window.location?.port === '9080');
const hasTauri = () => hasNativeTauri() || hasLanBridge();

async function invoke(cmd, args = {}) {
  if (hasNativeTauri()) {
    return await tauriInvoke(cmd, args);
  }
  if (hasLanBridge()) {
    const resp = await fetch('/api/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd, args: args || {} }),
    });
    if (!resp.ok) {
      throw new Error(`LAN Server HTTP error (${resp.status}) for ${cmd}`);
    }
    const json = await resp.json();
    if (!json || json.ok === false) {
      throw new Error(json?.error || `LAN RPC failed for ${cmd}`);
    }
    return json.data;
  }
  throw new Error('Desktop runtime or LAN Server bridge not available');
}

// Rolling measurement buffer for chart display (keeps last 3600 points)
const historyBuffer = new Map();
const MAX_HISTORY = 3600;
let activeTransport = null; // 'USB' | 'TCP' | 'BLE' | 'API' | 'MODBUS_TCP' | null
const activeModbusDevices = new Map();
let activeMeasurementPromise = null;
let lastMeasurementResult = null;
let lastMeasurementTime = 0;

export const TauriSutoAPI = {
  isAvailable() {
    if (activeTransport === 'API' || activeTransport === 'BLE_WEB') {
      return true;
    }
    return hasTauri();
  },

  getActiveTransport() {
    if (activeTransport === 'BLE_WEB' || activeTransport === 'BLE_NATIVE') {
      return 'BLE';
    }
    if (activeModbusDevices.size > 0 && !activeTransport) {
      return 'Modbus TCP';
    }
    return activeTransport;
  },

  isConnected() {
    if (activeModbusDevices.size > 0) {
      return true;
    }
    if (!activeTransport) {
      return false;
    }
    if (activeTransport === 'MODBUS_TCP') {
      return true;
    }
    if (activeTransport === 'API') {
      return Boolean(ApiDevice && ApiDevice.connected);
    }
    if (activeTransport === 'BLE_WEB') {
      return Boolean(BleSutoAPI && BleSutoAPI.isConnected && BleSutoAPI.isConnected());
    }
    return Boolean(activeTransport && hasTauri());
  },

  getCapabilities() {
    if (activeTransport === 'API') {
      return ApiDevice.getCapabilities();
    }
    return {
      rawCommand: true,
      screenshots: true,
      report600: true,
      loggerFiles: true,
      loggerPageRead: false,
      s461Read: true,
      onlineSource: 'suto',
    };
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
    try {
      await this.getChannels();
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
    try {
      await this.getChannels();
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

  /**
   * Discover Ethernet devices via CSLib UDP broadcast command (A1 15 02 00 00 FF to port 8800).
   * Listens for 25-byte UDP response datagrams from SUTO Ethernet / iPort devices on the LAN.
   */
  async discoverEthernetBroadcast({ timeoutMs = 1500, subnetBroadcast } = {}) {
    await this.logClientEvent('INFO', 'UDP_DISC', `Initiating CSLib UDP broadcast discovery (port 8800)...`);
    if (!hasTauri()) {
      return [];
    }
    return await invoke('suto_discover_ethernet_broadcast', {
      timeoutMs,
      subnetBroadcast: subnetBroadcast || null
    });
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

  /**
   * Resume BLE connection to an authorized device without opening the device picker.
   * Dispatches to native Tauri BLE in desktop mode, or BleSutoAPI.resumeBleConnection in Web mode.
   */
  async resumeBleConnection(options = {}) {
    const isBleAlreadyConnected = hasTauri()
      ? (activeTransport === 'BLE' || activeTransport === 'BLE_NATIVE')
      : Boolean(BleSutoAPI && BleSutoAPI.isConnected && BleSutoAPI.isConnected());

    if (isBleAlreadyConnected) {
      return { reconnected: true, transport: 'BLE' };
    }

    if (hasTauri()) {
      let targetDeviceId = options.deviceId;
      if (!targetDeviceId && options.name) {
        const devs = await this.listBleDevices({ timeoutMs: 2000 }).catch(() => []);
        const found = devs.find(d => d.name === options.name || d.id === options.deviceId);
        if (found) targetDeviceId = found.id;
      }
      if (targetDeviceId) {
        const res = await invoke('suto_connect_ble', { deviceId: targetDeviceId });
        activeTransport = 'BLE';
        let sInfo = null;
        try {
          sInfo = await invoke('suto_get_system_info');
        } catch (_) {}
        try {
          await this.getChannels();
        } catch (_) {}
        return {
          address: res,
          transport: 'BLE',
          deviceId: sInfo?.device_id || targetDeviceId,
          device_id: sInfo?.device_id,
          name: options.name || sInfo?.device_name || 'SUTO BLE Device',
          device: options.name || sInfo?.device_name || 'SUTO BLE Device',
          serial: sInfo?.serial_number,
          reconnected: true,
        };
      }
      throw new Error('No matching BLE device found to resume');
    }

    // Web Bluetooth environment
    activeTransport = 'BLE_WEB';
    await this.logClientEvent('INFO', 'BLE_CONN', 'Resuming Web Bluetooth (BLE) connection...');
    const conn = await BleSutoAPI.resumeBleConnection(options);
    if (!conn) {
      activeTransport = null;
      throw new Error('No authorized BLE device was available to resume');
    }
    return { ...conn, transport: 'BLE', reconnected: true };
  },

  /** Connect to SUTO S332 WebAPI device over HTTP */
  async connectApi(host = '192.168.1.100', port = 8080) {
    activeTransport = 'API';
    await this.logClientEvent('INFO', 'API_CONN', `Initiating WebAPI connection to ${host}:${port}...`);
    return await ApiDevice.connect({ host, port });
  },

  /**
   * Connect to a Modbus TCP or RTU device (register-based polling)
   */
  async connectModbusTcp({
    host = '127.0.0.1',
    port = 502,
    serialPort = 'COM1',
    baudRate = 19200,
    parity = 'none',
    slaveId = 1,
    isRtu = false,
    name = '',
    serial = null,
    serialNumber = null,
    isSutoDevice = false,
    channels = [],
    clearOthers = false
  } = {}) {
    if (clearOthers) {
      this.disconnectModbus();
    }

    const sId = (slaveId !== undefined && slaveId !== '' && !isNaN(parseInt(slaveId, 10)))
      ? parseInt(slaveId, 10)
      : (isRtu ? 1 : 0);
    const p = parseInt(port, 10) || 502;
    if (!activeTransport || activeTransport === 'MODBUS_TCP' || activeTransport === 'MODBUS_RTU') {
      activeTransport = isRtu ? 'MODBUS_RTU' : 'MODBUS_TCP';
    }
    const devName = name || (isRtu ? `Modbus RTU (${serialPort} ID:${sId})` : `Modbus TCP (${host}:${p}${sId ? ` ID:${sId}` : ''})`);
    const devKey = isRtu ? `rtu_${serialPort}_${sId}` : `tcp_${host}_${p}_${sId}`;
    const cleanHost = isRtu
      ? String(serialPort || 'COM1').replace(/[^a-zA-Z0-9_-]/g, '_')
      : String(host).replace(/[^a-zA-Z0-9_-]/g, '_');
    const deviceId = isRtu
      ? `dev_modbus_rtu_${cleanHost}_baud_${baudRate}_slave_${sId}`
      : `dev_modbus_tcp_${cleanHost}_${p}_slave_${sId}`;

    await this.logClientEvent('INFO', 'MODBUS_OPEN', `Initiating ${isRtu ? 'Modbus RTU' : 'Modbus TCP'} connection to ${isRtu ? serialPort : `${host}:${p}`} (Slave: ${sId})...`);

    // Probe the connection if channels are provided
    if (channels.length > 0) {
      try {
        const testCh = channels[0];
        await this.readModbusChannel(testCh, { host, port: p, slaveId: sId, isRtu });
      } catch (probeErr) {
        console.warn('[TauriSutoAPI] Modbus initial probe note:', probeErr);
      }
    }

    const devSerial = serial || serialNumber || String(sId);
    const devInfo = {
      id: deviceId,
      deviceId,
      device_id: deviceId,
      address: sId,
      slaveId: sId,
      serial: devSerial,
      serial_number: devSerial,
      host: isRtu ? null : host,
      port: isRtu ? null : p,
      serialPort: isRtu ? serialPort : null,
      baudRate: isRtu ? baudRate : null,
      parity: isRtu ? parity : null,
      isRtu,
      isSutoDevice: Boolean(isSutoDevice || (channels && channels.some(c => c.isSuto || c.isSutoDevice))),
      name: devName,
      device: devName,
      transport: isRtu ? `Modbus RTU (${serialPort})` : `Modbus TCP (${host}:${p})`,
      transportType: isRtu ? 'modbus_rtu' : 'modbus_tcp',
      channels: channels || [],
      isOnline: true
    };

    activeModbusDevices.set(devKey, devInfo);
    return devInfo;
  },

  /** Alias for connectModbusTcp supporting both TCP and RTU */
  async connectModbus(params) {
    return this.connectModbusTcp(params);
  },

  /**
   * Disconnect a specific Modbus device or clear all Modbus devices
   */
  disconnectModbus(devKeyOrFilter = null) {
    if (!devKeyOrFilter) {
      activeModbusDevices.clear();
      historyBuffer.clear();
    } else if (typeof devKeyOrFilter === 'string' && activeModbusDevices.has(devKeyOrFilter)) {
      activeModbusDevices.delete(devKeyOrFilter);
    } else {
      const target = typeof devKeyOrFilter === 'object' ? devKeyOrFilter : { id: devKeyOrFilter };
      const config = target.connectionConfig || target;
      const tId = target.id || target.deviceId || config.id;
      const tSerial = target.serial || target.serial_number || config.serial;
      const tHost = config.host || target.host;
      const tPort = parseInt(config.port || target.port || 502, 10);
      const tSlave = (config.slaveId !== undefined && config.slaveId !== '')
        ? parseInt(config.slaveId, 10)
        : (target.slaveId !== undefined ? parseInt(target.slaveId, 10) : null);

      for (const [k, d] of activeModbusDevices.entries()) {
        const matchesId = Boolean(tId && (d.id === tId || d.deviceId === tId));
        const matchesSerial = Boolean(tSerial && (d.serial === tSerial || d.serial_number === tSerial));
        const matchesEndpoint = Boolean(tHost && d.host === tHost && d.port === tPort && (tSlave === null || d.slaveId === tSlave));
        if (matchesId || matchesSerial || matchesEndpoint) {
          activeModbusDevices.delete(k);
        }
      }
    }
    if (activeModbusDevices.size === 0 && (activeTransport === 'MODBUS_TCP' || activeTransport === 'MODBUS_RTU')) {
      activeTransport = null;
    }
  },

  /**
   * Check if a specific Modbus device is currently active in memory
   */
  isModbusDeviceActive(identifier) {
    if (!identifier) return false;
    if (activeModbusDevices.size === 0) return false;

    if (typeof identifier === 'string') {
      if (activeModbusDevices.has(identifier)) return true;
      for (const dev of activeModbusDevices.values()) {
        if (dev.id === identifier ||
            dev.deviceId === identifier ||
            dev.serial === identifier ||
            dev.serial_number === identifier ||
            dev.name === identifier) {
          return true;
        }
      }
      return false;
    }

    const {
      host,
      port = 502,
      slaveId,
      isRtu,
      serialPort,
      id,
      deviceId,
      serial,
      serialNumber,
      name
    } = identifier;

    const sId = (slaveId !== undefined && slaveId !== '' && !isNaN(parseInt(slaveId, 10)))
      ? parseInt(slaveId, 10)
      : (isRtu ? 1 : 0);
    const p = parseInt(port, 10) || 502;
    const devKey = isRtu ? `rtu_${serialPort}_${sId}` : `tcp_${host}_${p}_${sId}`;
    if (activeModbusDevices.has(devKey)) return true;

    for (const dev of activeModbusDevices.values()) {
      if (id && (dev.id === id || dev.deviceId === id)) return true;
      if (deviceId && (dev.id === deviceId || dev.deviceId === deviceId)) return true;
      if (serial && (dev.serial === serial || dev.serial_number === serial)) return true;
      if (serialNumber && (dev.serial === serialNumber || dev.serial_number === serialNumber)) return true;
      if (name && dev.name === name) return true;
      if (isRtu) {
        if (dev.isRtu && dev.serialPort === serialPort && dev.slaveId === sId) return true;
      } else if (host) {
        if (!dev.isRtu && dev.host === host && dev.port === p && dev.slaveId === sId) return true;
      }
    }
    return false;
  },

  /**
   * Disconnect a single device by its device object or config, without killing other concurrent transports
   */
  async disconnectDevice(deviceOrConfig) {
    if (!deviceOrConfig) return this.disconnect();
    const config = deviceOrConfig.connectionConfig || deviceOrConfig;
    const rawTransport = (config.transport || deviceOrConfig.transportType || deviceOrConfig.transport || '').toLowerCase();
    const isModbus = rawTransport.includes('modbus');

    if (isModbus) {
      this.disconnectModbus(deviceOrConfig);
      return true;
    }

    // For non-modbus devices: if no modbus devices are active, execute full disconnect()
    if (activeModbusDevices.size === 0) {
      return await this.disconnect();
    }

    if (activeTransport === 'API') {
      await ApiDevice.disconnect();
      activeTransport = null;
    } else if (activeTransport === 'BLE_WEB') {
      await BleSutoAPI.disconnect();
      activeTransport = null;
    } else if (hasTauri()) {
      try {
        await invoke('suto_disconnect');
      } catch (_) {}
      activeTransport = null;
    }
    return true;
  },

  /**
   * Read raw Modbus registers over TCP (or RTU)
   */
  async readModbusRegisters({ host = '127.0.0.1', port = 502, slaveId = 1, funcCode = 3, regAddr = 0, regCount = 2, isRtu = false, timeoutMs = 2500 } = {}) {
    if (hasTauri()) {
      const bytes = await invoke('suto_read_modbus_registers', {
        host,
        port: parseInt(port, 10),
        slaveId: parseInt(slaveId, 10),
        funcCode: parseInt(funcCode, 10),
        regAddr: parseInt(regAddr, 10),
        regCount: parseInt(regCount, 10),
        isRtu: Boolean(isRtu),
        timeoutMs: parseInt(timeoutMs, 10)
      });
      return new Uint8Array(bytes);
    }

    // In web / browser mock mode: simulate realistic sensor registers
    const simulated = new Uint8Array(regCount * 2);
    const dv = new DataView(simulated.buffer);
    const t = Date.now() / 4000;
    const baseVal = (regAddr % 2 === 0)
      ? 6.8 + Math.sin(t) * 0.35 // Pressure ~6.8 bar
      : 142.0 + Math.cos(t) * 12.0; // Flow ~142 m3/h

    if (regCount >= 2) {
      dv.setFloat32(0, baseVal, false); // Big Endian IEEE 754 float
    } else {
      dv.setInt16(0, Math.round(baseVal * 10), false);
    }
    return simulated;
  },

  /**
   * Read and decode a single Modbus channel (with scaling, word swapping, and error handling)
   */
  async readModbusChannel(channel, connectionConfig = {}) {
    const host = connectionConfig.host || channel.host || '127.0.0.1';
    const port = connectionConfig.port || channel.port || 502;
    const slaveId = channel.slaverAddr ?? channel.slaveId ?? connectionConfig.slaveId ?? 1;
    const funcCode = (channel.mBAccessFuncCode && channel.mBAccessFuncCode > 0)
      ? channel.mBAccessFuncCode
      : (channel.funcCode || 3);
    const regAddr = channel.mBValueAddr ?? channel.regAddr ?? 0;
    const inType = channel.mBInputValueType ?? channel.dataType ?? 7; // default FLOAT32_BE
    const normType = normalizeModbusDataType(inType);
    const regCount = (normType === 1 || normType === 2) ? 1 : 2;
    const isRtu = Boolean(connectionConfig.isRtu || channel.isRtu);
    const isSuto = Boolean(channel.isSuto || channel.isSutoDevice || connectionConfig.isSutoDevice || connectionConfig.isSuto);

    // If channel is identified as SUTO device channel, try querying via SUTO CS-Bus online command first
    if (isSuto) {
      try {
        const chIdx = channel.id ?? channel.channel_id ?? 1;
        const numId = parseInt(chIdx, 10) || 1;
        const batchCmd = buildCsGetOnlineMeasurementValuesCommand(numId, 1);
        const respBytes = await this.exchangeCsModbus({
          host,
          port,
          slaveId: slaveId || 1,
          isRtu,
          csPacket: batchCmd,
          timeoutMs: 2500
        });
        if (respBytes && respBytes.length >= CS_MEASUREMENT_VALUE_SIZE) {
          const decodedList = parseCsOnlineMeasurementValues(respBytes, 1);
          if (decodedList.length > 0 && decodedList[0].isValid) {
            const rawVal = decodedList[0].value;
            const hasCustomScaling = Boolean(channel && (
              (typeof channel.mBA1 === 'number' && Math.abs(channel.mBA1 - 1.0) > 1e-9) ||
              (typeof channel.a1 === 'number' && Math.abs(channel.a1 - 1.0) > 1e-9) ||
              (typeof channel.mBA0 === 'number' && Math.abs(channel.mBA0) > 1e-9) ||
              (typeof channel.a0 === 'number' && Math.abs(channel.a0) > 1e-9) ||
              (channel.x0 !== undefined && channel.y1 !== undefined && (Math.abs(channel.x0 - (channel.y0 ?? 0)) > 1e-9 || Math.abs(channel.x1 - (channel.y1 ?? 1)) > 1e-9))
            ));
            const scaledVal = (rawVal !== null && rawVal !== undefined)
              ? (hasCustomScaling ? applyModbusChannelScaling(rawVal, channel) : rawVal)
              : null;
            return {
              success: true,
              value: scaledVal,
              rawValue: rawVal,
              channelId: channel.channel_id ?? channel.id
            };
          }
        }
      } catch (sutoErr) {
        console.warn(`[TauriSutoAPI] SUTO online measurement read note:`, sutoErr);
      }
    }

    try {
      const bytes = await this.readModbusRegisters({
        host,
        port,
        slaveId,
        funcCode,
        regAddr,
        regCount,
        isRtu
      });

      const rawVal = modbusData2Double(normType, bytes);
      const scaledVal = applyModbusChannelScaling(rawVal, channel);

      return {
        success: true,
        value: scaledVal,
        rawValue: rawVal,
        channelId: channel.channel_id ?? channel.id
      };
    } catch (err) {
      console.warn(`[TauriSutoAPI] Modbus channel read note (${channel.name || regAddr}):`, err);
      return {
        success: false,
        error: err?.message || String(err),
        value: null,
        rawValue: null,
        channelId: channel.channel_id ?? channel.id
      };
    }
  },

  /**
   * Send a raw CS-Bus command packet over Modbus TCP (FC 71 gateway)
   * @param {object} params
   * @param {string} params.host
   * @param {number} [params.port=502]
   * @param {number} [params.slaveId=1]
   * @param {Uint8Array} params.csPacket
   * @param {number} [params.timeoutMs=3000]
   * @returns {Promise<Uint8Array>}
   */
  /**
   * Send a raw CS-Bus command packet over Modbus TCP (FC 71) or Modbus RTU (FC 70)
   * @param {object} params
   * @param {string} params.host
   * @param {number} [params.port=502]
   * @param {number} [params.slaveId=1]
   * @param {Uint8Array} params.csPacket
   * @param {boolean} [params.isRtu=false]
   * @param {number} [params.timeoutMs=3000]
   * @returns {Promise<Uint8Array>}
   */
  async exchangeCsModbus({ host = '127.0.0.1', port = 502, slaveId = 1, csPacket, isRtu = false, timeoutMs = 3000 } = {}) {
    if (hasTauri()) {
      const bytes = await invoke('suto_exchange_cs_modbus', {
        host,
        port: parseInt(port, 10),
        slaveId: parseInt(slaveId, 10),
        csPacket: Array.from(csPacket),
        isRtu: Boolean(isRtu),
        timeoutMs: parseInt(timeoutMs, 10)
      });
      return new Uint8Array(bytes);
    }

    // In web / browser mock mode:
    // If querying device info [1, 255, 28] or [0x41]:
    if ((csPacket[0] === 1 && csPacket[1] === 255 && csPacket[2] === 28) || csPacket[0] === 0x41) {
      const infoBytes = new Uint8Array(8);
      const dv = new DataView(infoBytes.buffer);
      dv.setUint8(0, 1); // busVersion
      dv.setUint16(1, 0x1065, true); // SUTO S331 (0x1065)
      dv.setUint8(3, 154); // softwareVersion 1.54
      dv.setUint32(4, 33100123, true); // serialNumber
      return infoBytes;
    }
    // If querying channel count [4, 2, 3]: return [6] (6 channels)
    if (csPacket[0] === 4 && csPacket[1] === 2 && csPacket[2] === 3) {
      return new Uint8Array([6]);
    }
    // If querying channel settings [4, 2, 2, start, count] or [4, 2, 11, start, count]:
    if (csPacket[0] === 4 && csPacket[1] === 2 && (csPacket[2] === 2 || csPacket[2] === 11)) {
      const allBytes = createMockS331ChannelSettings();
      const start = csPacket[3];
      const count = csPacket[4];
      const startIdx = Math.max(0, (start - 1) * 204);
      const endIdx = Math.min(allBytes.length, startIdx + count * 204);
      if (startIdx < allBytes.length) {
        return allBytes.slice(startIdx, endIdx);
      }
      return new Uint8Array(0);
    }
    // If querying online measurement values [4, 1, 1, start, count]:
    if (csPacket[0] === 4 && csPacket[1] === 1 && csPacket[2] === 1) {
      const start = csPacket[3] || 1;
      const count = csPacket[4] || 6;
      const t = Date.now() / 4000;
      const simulatedVals = [
        140.0 + Math.sin(t) * 10.0, // Flow
        125000 + (Math.floor(Date.now() / 1000) % 1000), // Consumption
        6.8 + Math.cos(t) * 0.4, // Pressure
        24.0 + Math.sin(t * 0.5) * 1.5, // Temp
        -40.0 + Math.cos(t * 0.3) * 2.0, // Dew point
        15.0 + Math.sin(t * 0.8) * 2.5 // Power
      ];
      const slice = simulatedVals.slice(start - 1, start - 1 + count);
      return createMockS331MeasurementValues(slice);
    }
    return new Uint8Array(0);
  },

  /**
   * Auto-detect a SUTO device and all its channels over Modbus TCP or RTU.
   * Conforms to legacy S4M Detection Engine (DetectDeviceTask & GetManualAddedDeviceTask):
   * 1. Query Device Info via CSBusCommands.GET_DEVICE_INFO ([1, 255, 28]) or broadcast ("A")
   * 2. Query Channel Count via CSBusCommands.GET_MEASUREMENT_CHANNEL_COUNT ([4, 2, 3])
   * 3. Query Channel Structures via CSBusGetAllChannelStructAction ([4, 2, 2] or [4, 2, 11])
   * 4. Parse 204-byte Little-Endian CSCommChannelSetting structs into clean channels
   * 5. Fallback: Standard Modbus Holding Registers (Float32 Word-swapped CDAB)
   *
   * @param {object} params
   * @param {string} params.host
   * @param {number} [params.port=502]
   * @param {number} [params.slaveId=1]
   * @param {boolean} [params.isRtu=false]
   * @param {function} [onProgress] Callback for UI status
   * @returns {Promise<{ success: boolean, deviceInfo: object, channels: Array<object> }>}
   */
  async detectSutoDeviceOverModbus({
    host = '127.0.0.1',
    port = 502,
    slaveId = 1,
    isRtu = false,
    onProgress = null
  } = {}) {
    await this.logClientEvent('INFO', 'MODBUS_DETECT', `Starting SUTO detection on ${host}:${port} (Slave: ${slaveId}, RTU: ${isRtu})...`);
    if (typeof onProgress === 'function') {
      onProgress('Connecting to device...');
    }

    let deviceInfo = null;

    // 1. Query Device Information struct (8 bytes: busVersion, deviceIdentification, softwareVersion, serialNumber)
    try {
      if (typeof onProgress === 'function') {
        onProgress('Identifying SUTO device model...');
      }
      const infoCmd = buildCsGetDeviceInfoCommand();
      const infoResp = await this.exchangeCsModbus({ host, port, slaveId, csPacket: infoCmd, isRtu, timeoutMs: 2000 });
      if (infoResp && infoResp.length >= 8) {
        deviceInfo = parseCsDeviceInfoResponse(infoResp);
      }
    } catch (e1) {
      console.warn('[TauriSutoAPI] GET_DEVICE_INFO failed, trying broadcast retrieval:', e1);
    }

    if (!deviceInfo) {
      try {
        const bcastCmd = buildCsBroadcastGetDeviceInfoCommand();
        const bcastResp = await this.exchangeCsModbus({ host, port, slaveId, csPacket: bcastCmd, isRtu, timeoutMs: 2000 });
        if (bcastResp && bcastResp.length >= 8) {
          deviceInfo = parseCsDeviceInfoResponse(bcastResp);
        }
      } catch (e2) {
        console.warn('[TauriSutoAPI] Broadcast RETRIEVE_DEVICE_INFORMATION failed:', e2);
      }
    }

    // 2. Query Channel Count ([4, 2, 3])
    if (typeof onProgress === 'function') {
      onProgress('Reading channel structure...');
    }

    let channelCount = 0;
    try {
      const countCmd = buildCsGetChannelCountCommand();
      const countResp = await this.exchangeCsModbus({ host, port, slaveId, csPacket: countCmd, isRtu, timeoutMs: 2500 });
      channelCount = parseCsChannelCountResponse(countResp);
    } catch (err) {
      console.warn('[TauriSutoAPI] Failed to get channel count over CSModbus:', err);
    }

    if (deviceInfo || channelCount > 0) {
      if (channelCount <= 0 || channelCount > 64) {
        channelCount = 6;
      }
    }

    const discoveredChannels = [];

    // 3. Query Channel Structures
    if (channelCount > 0) {
      const BATCH_SIZE = 1;
      for (let startCh = 1; startCh <= channelCount; startCh += BATCH_SIZE) {
        const count = Math.min(BATCH_SIZE, channelCount - startCh + 1);
        if (typeof onProgress === 'function') {
          onProgress(`Reading channel ${startCh} of ${channelCount}...`);
        }

        try {
          const batchCmd = buildCsGetChannelStructCommand(startCh, count, false);
          const batchResp = await this.exchangeCsModbus({ host, port, slaveId, csPacket: batchCmd, isRtu, timeoutMs: 2500 });
          let settings = parseCsChannelStructBatchResponse(batchResp);

          if (!settings || settings.length === 0) {
            // Firmware >= 1.54 uses transformed channel struct (0x0B)
            try {
              const tredCmd = buildCsGetChannelStructCommand(startCh, count, true);
              const tredResp = await this.exchangeCsModbus({ host, port, slaveId, csPacket: tredCmd, isRtu, timeoutMs: 2500 });
              settings = parseCsChannelStructBatchResponse(tredResp);
            } catch (_) {}
          }

          for (const setting of settings || []) {
            const modCh = channelSettingToModbusChannel(setting);
            modCh.slaveId = slaveId;
            modCh.slaverAddr = slaveId;
            modCh.isRtu = isRtu;
            modCh.host = host;
            modCh.port = port;
            modCh.dataType = normalizeModbusDataType(modCh.dataType);
            discoveredChannels.push(modCh);
          }
        } catch (batchErr) {
          console.warn(`[TauriSutoAPI] Batch fetch error for channel ${startCh}:`, batchErr);
        }
      }
    }

    // 4. Fallback: Standard Modbus Holding Registers
    if (discoveredChannels.length === 0) {
      if (typeof onProgress === 'function') {
        onProgress('Probing standard Modbus registers...');
      }
      const candidateUnits = Array.from(new Set([slaveId, 0, 1]));
      let workingUnit = null;

      for (const unit of candidateUnits) {
        try {
          const testBytes = await this.readModbusRegisters({
            host,
            port,
            slaveId: unit,
            funcCode: 3,
            regAddr: 0,
            regCount: 2,
            isRtu,
            timeoutMs: 1200
          });
          if (testBytes && testBytes.length === 4) {
            workingUnit = unit;
            break;
          }
        } catch (_) {}
      }

      if (workingUnit !== null) {
        await this.logClientEvent('INFO', 'MODBUS_DETECT', `Found responsive Modbus registers on Unit ID ${workingUnit}.`);
        for (let chIdx = 1; chIdx <= 16; chIdx++) {
          const regAddr = (chIdx - 1) * 2;
          try {
            const bytes = await this.readModbusRegisters({
              host,
              port,
              slaveId: workingUnit,
              funcCode: 3,
              regAddr,
              regCount: 2,
              isRtu,
              timeoutMs: 800
            });
            if (bytes && bytes.length === 4) {
              const val = modbusData2Double(8, bytes);
              if (Math.abs(val - (-9999.0)) < 1.0 || Math.abs(val - (-8888.0)) < 1.0 || isNaN(val)) {
                continue;
              }
              discoveredChannels.push({
                id: chIdx,
                name: `Channel ${chIdx}`,
                unit: chIdx === 1 ? '°C' : chIdx === 2 ? '%rH' : chIdx === 3 ? 'bar' : '',
                funcCode: 3,
                regAddr,
                dataType: 8,
                a1: 1.0,
                a0: 0.0,
                slaveId: workingUnit,
                slaverAddr: workingUnit,
                isRtu,
                host,
                port,
                current_value: Number(val.toFixed(2))
              });
            } else {
              break;
            }
          } catch (_) {
            break;
          }
        }

        if (!deviceInfo) {
          deviceInfo = {
            model: 'Modbus Device',
            serial: `MB-${workingUnit}`,
            softwareVersion: '1.00',
            busVersion: 1
          };
        }
      }
    }

    if (!deviceInfo && discoveredChannels.length > 0) {
      deviceInfo = {
        model: 'S331',
        serial: `331${String(slaveId).padStart(4, '0')}`,
        softwareVersion: '1.54',
        busVersion: 1
      };
    }

    await this.logClientEvent('INFO', 'MODBUS_DETECT', `Detection finished: model=${deviceInfo?.model || 'Unknown'}, channels=${discoveredChannels.length}`);

    return {
      success: discoveredChannels.length > 0,
      deviceInfo: {
        ...(deviceInfo || {
          model: 'Device',
          serial: String(slaveId),
          softwareVersion: '1.0',
          busVersion: 1
        }),
        isSutoDevice: true
      },
      channels: discoveredChannels
    };
  },

  /**
   * Auto-discover channels from an S330/S331 over Modbus TCP or RTU.
   * Delegates to detectSutoDeviceOverModbus for complete backwards compatibility.
   */
  async discoverS331ChannelsOverModbus({ host = '127.0.0.1', port = 502, slaveId = 1, isRtu = false, onProgress = null } = {}) {
    const res = await this.detectSutoDeviceOverModbus({ host, port, slaveId, isRtu, onProgress });
    return res.channels || [];
  },

  /** Disconnect from active device */
  async disconnect() {
    await this.logClientEvent('INFO', 'SUTO_IPC', `Disconnecting active transport (${activeTransport})...`);
    activeMeasurementPromise = null;
    lastMeasurementResult = null;
    lastMeasurementTime = 0;
    activeModbusDevices.clear();
    historyBuffer.clear();
    if (activeTransport === 'API') {
      await ApiDevice.disconnect();
    } else if (activeTransport === 'BLE_WEB') {
      await BleSutoAPI.disconnect();
    } else if (hasTauri()) {
      await invoke('suto_disconnect');
    }
    activeTransport = null;
    return true;
  },

  /**
   * Get device layout points if supported (e.g. S332 WebAPI)
   */
  async getLayoutInfo() {
    if (activeTransport === 'API') {
      return await ApiDevice.getLayoutInfo();
    }
    return [];
  },

  /**
   * Get channels formatted for S4A Views
   * Supports optional { transport } filter to query channels strictly from that transport.
   * @param {Object|Function} [optionsOrCallback]
   * @param {Function} [maybeCallback]
   */
  async getChannels(optionsOrCallback, maybeCallback) {
    const opts = (typeof optionsOrCallback === 'object' && optionsOrCallback !== null) ? optionsOrCallback : {};
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    const reqTransport = (opts.transport || activeTransport || '').toUpperCase();
    const isAll = reqTransport === 'ALL';

    if (!isAll && reqTransport === 'API') {
      return await ApiDevice.getChannels(callback);
    }
    if (!isAll && reqTransport === 'BLE_WEB') {
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

    const allChannels = [];

    // 1. Fetch native Tauri hardware channels if native socket is active (or specifically requested)
    const isNativeDemanded = reqTransport === 'TCP' || reqTransport === 'USB' || reqTransport === 'BLE' || reqTransport === 'BLE_NATIVE' || (!reqTransport && activeModbusDevices.size === 0) || isAll;
    if (hasTauri() && isNativeDemanded) {
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
        allChannels.push(...formatted);
      } catch (err) {
        console.warn('[TauriSutoAPI] Native suto_get_channels note:', err);
      }
    }

    // 2. Append active Modbus devices' channels (ONLY when Modbus transport is active or specifically requested!)
    const isModbusDemanded = reqTransport === 'MODBUS_TCP' || reqTransport === 'MODBUS_RTU' || reqTransport === 'MODBUS' || (!reqTransport && activeModbusDevices.size > 0) || isAll;
    if (isModbusDemanded && activeModbusDevices.size > 0) {
      for (const modbusDev of activeModbusDevices.values()) {
        (modbusDev.channels || []).forEach((ch, idx) => {
          const chId = ch.channel_id ?? ch.id ?? (idx + 1);
          allChannels.push({
            channel_id: chId,
            id: chId,
            location_id: 1,
            channel_name: ch.name || ch.channel_name || `Modbus Ch ${chId}`,
            unit_in_ascii: ch.unit || '',
            logic_channel_description: ch.name || ch.channel_name || `Modbus Ch ${chId}`,
            full_channel_name: ch.name || ch.channel_name || `Modbus Ch ${chId}`,
            unit: ch.unit || '',
            resolution: (typeof ch.resolution === 'number' && ch.resolution >= 0)
              ? ch.resolution
              : resolveChannelResolution({ unit: ch.unit, resolution: ch.resolution }),
            device_description: modbusDev.name,
            sensor_description: ch.sensor_description || modbusDev.name,
            device_id: modbusDev.deviceId || modbusDev.id,
            active: true,
            selected: allChannels.length === 0 && idx === 0
          });
        });
      }
    }

    if (allChannels.length > 0) {
      if (callback) callback(allChannels);
      return allChannels;
    }

    if (!hasTauri() || !isNativeDemanded) {
      if (callback) callback([]);
      return [];
    }

    try {
      const rawChannels = await invoke('suto_get_channels');
      const formatted = (Array.isArray(rawChannels) ? rawChannels : []).map((ch, idx) => ({
        channel_id: ch.id,
        location_id: 1,
        channel_name: ch.description,
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
      console.warn('[TauriSutoAPI] getChannels fallback failed:', err);
      if (callback) callback([]);
      return [];
    }
  },

  /**
   * Helper to determine whether BLE polling is required given the current demanded channels list.
   * @private
   */
  _isBleDemanded(demanded) {
    if (!demanded) return true;
    if (!Array.isArray(demanded) || demanded.length === 0) return false;

    const bleSerial = String(BleSutoAPI?.systemInfo?.serial_number || BleSutoAPI?.systemInfo?.serial || '').toLowerCase();
    const bleDevName = String(BleSutoAPI?.getDeviceName?.() || '').toLowerCase();
    const bleCachedChs = BleSutoAPI?.cachedChannels || [];
    const bleChIds = new Set(bleCachedChs.map(c => String(c.channel_id ?? c.id)));

    return demanded.some((item) => {
      if (!item) return false;
      if (typeof item === 'string' || typeof item === 'number') {
        const s = String(item).toLowerCase();
        if (s.startsWith('ble') || s.includes('ble_')) return true;
        if (bleSerial && s.includes(bleSerial)) return true;
        if (bleChIds.has(s)) return true;
        return false;
      }

      const itemTransport = String(item.transport || item.transportType || '').toLowerCase();
      const itemDev = String(item.device || '').toLowerCase();
      const itemDevId = String(item.deviceId || item.device_id || '').toLowerCase();
      const itemDevSerial = String(item.deviceSerial || item.serial || item.serial_number || '').toLowerCase();
      const itemId = String(item.id || '').toLowerCase();

      if (item.isBle || itemTransport.includes('ble') || itemDev.includes('ble') || itemDevId.includes('ble') || itemId.includes('ble')) {
        return true;
      }
      if (bleSerial && (itemDevSerial === bleSerial || itemId.includes(bleSerial))) {
        return true;
      }
      if (bleDevName && itemDev === bleDevName) {
        return true;
      }

      // If it's explicitly modbus or tcp/usb, it's not BLE
      if (itemTransport.includes('modbus') || itemTransport.includes('tcp') || item.mBValueAddr !== undefined) {
        return false;
      }

      const itemChId = String(item.channel_id ?? item.channelId ?? item.id ?? '');
      if (bleChIds.has(itemChId) && !itemDevSerial && !itemDevId) {
        return true;
      }
      return false;
    });
  },

  /**
   * Helper to determine whether native Tauri socket polling is required.
   * Note: On desktop Tauri, BLE connections are also managed via the native socket
   * (activeTransport === 'BLE' or 'BLE_NATIVE'), so BLE items MUST also demand native polling!
   * @private
   */
  _isNativeDemanded(demanded) {
    if (!demanded) return true;
    if (!Array.isArray(demanded) || demanded.length === 0) return false;

    // If native transport is currently running BLE, check if BLE is demanded
    if (activeTransport === 'BLE' || activeTransport === 'BLE_NATIVE') {
      return this._isBleDemanded(demanded);
    }

    const activeModbusList = Array.from(activeModbusDevices.values());

    return demanded.some((item) => {
      if (!item) return false;
      if (typeof item === 'string' || typeof item === 'number') {
        const s = String(item).toLowerCase();
        if (s.startsWith('usb') || s.startsWith('tcp') || s.startsWith('native')) return true;
        return false;
      }
      const itemTransport = String(item.transport || item.transportType || '').toLowerCase();
      const itemDevId = String(item.deviceId || item.device_id || '').toLowerCase();
      const itemDev = String(item.device || '').toLowerCase();
      const itemId = String(item.id || '').toLowerCase();

      // Explicit BLE items do NOT demand USB / native TCP polling
      if (
        item.isBle ||
        itemTransport.includes('ble') ||
        itemDevId.includes('ble') ||
        itemDev.includes('ble')
      ) {
        return false;
      }

      // Explicit Modbus items do NOT demand USB / native TCP polling
      if (
        itemTransport.includes('modbus') ||
        itemDevId.includes('modbus') ||
        itemDev.includes('modbus') ||
        item.mBValueAddr !== undefined
      ) {
        return false;
      }

      // Explicit USB or native TCP identifiers
      if (
        itemTransport.includes('usb') ||
        itemDevId.includes('usb') ||
        itemDev.includes('usb') ||
        itemId.includes('usb') ||
        ((itemTransport.includes('tcp') || itemDevId.includes('tcp')) && !itemTransport.includes('modbus'))
      ) {
        return true;
      }

      // If this item belongs to one of the active Modbus devices, do not trigger native USB polling
      if (activeModbusList.some((m) => this._isModbusDeviceDemanded(m, [item]))) {
        return false;
      }

      // Otherwise, a non-Modbus/non-BLE channel in the active location demands native USB/TCP polling
      return true;
    });
  },

  /**
   * Helper to determine whether a specific Modbus device is required given demanded channels.
   * @private
   */
  _isModbusDeviceDemanded(modbusDev, demanded) {
    if (!demanded) return true;
    if (!Array.isArray(demanded) || demanded.length === 0) return false;

    const devId = String(modbusDev.deviceId || modbusDev.id || '').toLowerCase();
    const devSerial = String(modbusDev.serial || modbusDev.serial_number || '').toLowerCase();
    const devHost = String(modbusDev.host || '').toLowerCase();
    const devName = String(modbusDev.name || modbusDev.device || '').toLowerCase();
    const devChIds = new Set((modbusDev.channels || []).map(c => String(c.channel_id ?? c.id)));

    return demanded.some((item) => {
      if (!item) return false;

      if (typeof item === 'string' || typeof item === 'number') {
        const s = String(item).toLowerCase();
        if (devSerial && s.includes(devSerial)) return true;
        if (devId && s.includes(devId)) return true;
        if (devHost && s.includes(devHost)) return true;
        if (devChIds.has(s)) return true;
        return false;
      }

      const itemTransport = String(item.transport || item.transportType || '').toLowerCase();
      const itemDevSerial = String(item.deviceSerial || item.serial || item.serial_number || '').toLowerCase();
      const itemDevId = String(item.deviceId || item.device_id || '').toLowerCase();
      const itemHost = String(item.host || item.ip || '').toLowerCase();
      const itemDevName = String(item.device || '').toLowerCase();
      const itemId = String(item.id || '').toLowerCase();

      // If item has explicit serial and both have serials
      if (devSerial && itemDevSerial) {
        return devSerial === itemDevSerial;
      }

      // If item has deviceId
      if (devId && itemDevId) {
        if (devId === itemDevId || devId.includes(itemDevId) || itemDevId.includes(devId)) {
          return true;
        }
      }

      // If item has host
      if (devHost && itemHost) {
        if (devHost === itemHost) return true;
      }

      // If item has register address and transport mentions modbus
      if (item.mBValueAddr !== undefined && (itemTransport.includes('modbus') || itemDevName.includes('modbus'))) {
        if (!itemDevSerial || itemDevSerial === devSerial) return true;
      }

      // If the channel ID string embeds the serial or device ID
      if (devSerial && itemId.includes(devSerial)) return true;
      if (devId && itemId.includes(devId)) return true;

      // If item is explicitly BLE or USB (not modbus), it does not belong to this modbus device
      if (itemTransport.includes('ble') || itemDevName.includes('ble') || item.isBle) {
        return false;
      }

      // If channel ID matches one of this modbusDev's channels and no conflicting device info
      const itemChId = String(item.channel_id ?? item.channelId ?? item.id ?? '');
      if (devChIds.has(itemChId)) {
        if (!itemDevSerial && !itemDevId) {
          if (!itemDevName || itemDevName === devName) return true;
        }
      }

      return false;
    });
  },

  /**
   * Get live measurement data formatted for S4A GraphicView
   * @param {Function} [callback]
   * @param {Object} [options]
   * @param {Array} [options.demandedChannels] - When provided, restrict polling to devices/channels demanded by active location and/or recording
   */
  async getMeasurementData(callback, options = {}) {
    if (typeof callback === 'object' && callback !== null && (options === undefined || Object.keys(options).length === 0)) {
      options = callback;
      callback = undefined;
    }

    if (activeTransport === 'API') {
      return await ApiDevice.getMeasurementData(callback);
    }

    const demanded = options?.demandedChannels;
    // If demandedChannels is explicitly an empty array, no channels are needed -> return immediately!
    if (Array.isArray(demanded) && demanded.length === 0) {
      if (callback) callback([]);
      return [];
    }

    try {
      const result = [];
      const now = Date.now();

      // 1. Poll BLE if active (Web Bluetooth) and demanded
      const isBleWeb = activeTransport === 'BLE_WEB' || Boolean(BleSutoAPI && BleSutoAPI.isConnected && BleSutoAPI.isConnected());
      const isBleNeeded = isBleWeb && (!demanded || this._isBleDemanded(demanded));
      if (isBleNeeded) {
        try {
          let bleRes = null;
          if (lastMeasurementResult && (now - lastMeasurementTime < 750)) {
            bleRes = lastMeasurementResult;
          } else {
            if (!activeMeasurementPromise) {
              activeMeasurementPromise = BleSutoAPI.getMeasurementData()
                .then((res) => {
                  lastMeasurementResult = res;
                  lastMeasurementTime = Date.now();
                  return res;
                })
                .finally(() => {
                  activeMeasurementPromise = null;
                });
            }
            bleRes = await activeMeasurementPromise;
          }

          if (Array.isArray(bleRes)) {
            result.push(...bleRes);
          } else if (bleRes && Array.isArray(bleRes.channels)) {
            result.push(...bleRes.channels);
          }
        } catch (bleErr) {
          console.warn('[TauriSutoAPI] BLE telemetry poll error:', bleErr);
        }
      }

      // 2. Poll native Tauri hardware values (if native socket is active)
      let values = [];
      const isNativeActive = hasTauri() && (activeTransport === 'TCP' || activeTransport === 'USB' || activeTransport === 'BLE' || activeTransport === 'BLE_NATIVE');
      const isNativeNeeded = isNativeActive && (!demanded || this._isNativeDemanded(demanded));
      if (isNativeNeeded) {
        try {
          const res = await invoke('suto_get_values');
          if (Array.isArray(res)) values = res;
        } catch (tauriErr) {
          // Normal when no direct USB socket is attached
          values = [];
        }
      }

      const valArray = Array.isArray(values) ? values : [];
      valArray.forEach((val) => {
        const histKey = val.device_id ? `${val.device_id}_${val.id}` : (val.port ? `${val.port}_${val.id}` : val.id);
        let history = historyBuffer.get(histKey);
        if (!history) {
          history = [];
          historyBuffer.set(histKey, history);
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

        result.push({
          channel_id: val.id,
          id: val.id,
          unit: val.unit,
          resolution: val.resolution,
          status: val.status,
          current_value: val.value,
          value: val.value,
          device: val.device,
          deviceId: val.device_id,
          serial: val.serial_number,
          serial_number: val.serial_number,
          port: val.port,
          measurementData: [history.map((h) => h[1])],
          realStartTime: history.length ? [history[0][0]] : [now],
          pointInterval: [1000],
          min,
          max,
        });
      });

      // Poll active Modbus devices
      if (activeModbusDevices.size > 0) {
        for (const modbusDev of activeModbusDevices.values()) {
          const chList = Array.isArray(modbusDev.channels) ? modbusDev.channels : [];
          if (chList.length === 0) continue;

          // If demand is specified, skip this Modbus device if not demanded
          if (demanded && !this._isModbusDeviceDemanded(modbusDev, demanded)) {
            continue;
          }

          // Check if this device is an auto-detected SUTO device
          const isSuto = Boolean(
            modbusDev.isSutoDevice ||
            modbusDev.detectedSutoInfo ||
            chList.some(c => c.isSuto || c.isSutoDevice)
          );

          // Attempt SUTO CS-Bus atomic batch polling (FC 71 TCP / FC 70 RTU: [4, 1, 1, 1, chCount])
          // ONLY for SUTO devices. Third-party devices will directly use configured register polling.
          let sutoBatchSuccess = false;
          if (isSuto) {
            try {
              const host = modbusDev.host || '127.0.0.1';
              const port = modbusDev.port || 502;
              const slaveId = modbusDev.slaveId ?? 1;
              const isRtu = Boolean(modbusDev.isRtu);

              const batchCmd = buildCsGetOnlineMeasurementValuesCommand(1, chList.length);
              const respBytes = await this.exchangeCsModbus({
                host,
                port,
                slaveId,
                isRtu,
                csPacket: batchCmd,
                timeoutMs: 2000
              });

              if (respBytes && respBytes.length >= CS_MEASUREMENT_VALUE_SIZE) {
                const decodedList = parseCsOnlineMeasurementValues(respBytes, chList.length);
                if (decodedList.length > 0) {
                  sutoBatchSuccess = true;
                  decodedList.forEach((mVal, idx) => {
                    const ch = chList[idx];
                    if (!ch) return;
                    const chId = ch.channel_id ?? ch.id ?? (idx + 1);

                    // If demand is active, only include demanded channels in result output
                    if (demanded) {
                      const devSerial = String(modbusDev.serial || modbusDev.serial_number || '').toLowerCase();
                      const devId = String(modbusDev.deviceId || modbusDev.id || '').toLowerCase();
                      const isChDemanded = demanded.some((d) => {
                        if (!d) return false;
                        if (typeof d === 'string' || typeof d === 'number') {
                          const s = String(d).toLowerCase();
                          return s === String(chId) || (devSerial && s.includes(devSerial) && s.includes(String(chId)));
                        }
                        const dChId = d.channel_id ?? d.channelId ?? d.id;
                        const dSerial = String(d.deviceSerial || d.serial || d.serial_number || '').toLowerCase();
                        const dDevId = String(d.deviceId || d.device_id || '').toLowerCase();
                        if (String(dChId) === String(chId)) {
                          if (dSerial && devSerial) return dSerial === devSerial;
                          if (dDevId && devId) return dDevId === devId;
                          return true;
                        }
                        return false;
                      });
                      if (!isChDemanded) return;
                    }

                    const hasCustomScaling = Boolean(ch && (
                      (typeof ch.mBA1 === 'number' && Math.abs(ch.mBA1 - 1.0) > 1e-9) ||
                      (typeof ch.a1 === 'number' && Math.abs(ch.a1 - 1.0) > 1e-9) ||
                      (typeof ch.mBA0 === 'number' && Math.abs(ch.mBA0) > 1e-9) ||
                      (typeof ch.a0 === 'number' && Math.abs(ch.a0) > 1e-9) ||
                      (ch.x0 !== undefined && ch.y1 !== undefined && (Math.abs(ch.x0 - (ch.y0 ?? 0)) > 1e-9 || Math.abs(ch.x1 - (ch.y1 ?? 1)) > 1e-9))
                    ));
                    const val = (mVal.value !== null && mVal.value !== undefined)
                      ? (hasCustomScaling ? applyModbusChannelScaling(mVal.value, ch) : mVal.value)
                      : null;
                  const histKey = `${modbusDev.deviceId || modbusDev.id}_${chId}`;
                  let history = historyBuffer.get(histKey);
                  if (!history) {
                    history = [];
                    historyBuffer.set(histKey, history);
                  }
                  if (val !== null && val !== undefined) {
                    history.push([now, val]);
                    if (history.length > MAX_HISTORY) {
                      history.shift();
                    }
                  }
                  const pts = history.map((item) => item[1]);
                  const min = pts.length ? Math.min(...pts) : 0;
                  const max = pts.length ? Math.max(...pts) : 100;

                  result.push({
                    channel_id: chId,
                    id: chId,
                    name: ch.name || ch.channel_name,
                    channel_name: ch.name || ch.channel_name,
                    unit: ch.unit || '',
                    resolution: (typeof mVal.resolution === 'number' && mVal.resolution >= 0)
                      ? mVal.resolution
                      : (ch.resolution ?? 2),
                    status: mVal.isValid ? 0 : 1,
                    current_value: val,
                    value: val,
                    rawValue: mVal.value,
                    device: modbusDev.name || ch.device,
                    deviceId: modbusDev.deviceId || modbusDev.id,
                    serial: modbusDev.serial || modbusDev.serial_number,
                    serial_number: modbusDev.serial || modbusDev.serial_number,
                    slaveId: modbusDev.slaveId,
                    port: modbusDev.port,
                    host: modbusDev.host,
                    measurementData: [history.map((h) => h[1])],
                    realStartTime: history.length ? [history[0][0]] : [now],
                    pointInterval: [1000],
                    min,
                    max
                  });
                });
              }
            }
          } catch (batchErr) {
            // SUTO batch FC 71/70 not supported or timed out; will fall back to channel-by-channel
          }
        }

          // If SUTO batch was not applicable or failed, poll channel-by-channel with Modbus registers
          if (!sutoBatchSuccess) {
            const devSerial = String(modbusDev.serial || modbusDev.serial_number || '').toLowerCase();
            const devId = String(modbusDev.deviceId || modbusDev.id || '').toLowerCase();
            for (const ch of chList) {
              const chId = ch.channel_id ?? ch.id;

              let matchedDemandCh = null;
              if (demanded) {
                matchedDemandCh = demanded.find((d) => {
                  if (!d) return false;
                  if (typeof d === 'string' || typeof d === 'number') {
                    const s = String(d).toLowerCase();
                    return s === String(chId) || (devSerial && s.includes(devSerial) && s.includes(String(chId)));
                  }
                  const dChId = d.channel_id ?? d.channelId ?? d.id;
                  const dSerial = String(d.deviceSerial || d.serial || d.serial_number || '').toLowerCase();
                  const dDevId = String(d.deviceId || d.device_id || '').toLowerCase();
                  if (String(dChId) === String(chId)) {
                    if (dSerial && devSerial) return dSerial === devSerial;
                    if (dDevId && devId) return dDevId === devId;
                    return true;
                  }
                  return false;
                });
                if (!matchedDemandCh) continue;
              }

              // Merge channel scaling from demanded/location configuration if available
              const effectiveCh = (matchedDemandCh && typeof matchedDemandCh === 'object')
                ? {
                    ...ch,
                    a1: matchedDemandCh.a1 ?? ch.a1,
                    a0: matchedDemandCh.a0 ?? ch.a0,
                    mBA1: matchedDemandCh.mBA1 ?? ch.mBA1,
                    mBA0: matchedDemandCh.mBA0 ?? ch.mBA0,
                    x0: matchedDemandCh.x0 ?? ch.x0,
                    x1: matchedDemandCh.x1 ?? ch.x1,
                    y0: matchedDemandCh.y0 ?? ch.y0,
                    y1: matchedDemandCh.y1 ?? ch.y1,
                    mBRangeLo: matchedDemandCh.mBRangeLo ?? ch.mBRangeLo,
                    mBRangeHi: matchedDemandCh.mBRangeHi ?? ch.mBRangeHi,
                    mBScalingLo: matchedDemandCh.mBScalingLo ?? ch.mBScalingLo,
                    mBScalingHi: matchedDemandCh.mBScalingHi ?? ch.mBScalingHi
                  }
                : ch;

              try {
                const res = await this.readModbusChannel(effectiveCh, modbusDev);
                const val = res.value;
                const histKey = `${modbusDev.deviceId || modbusDev.id}_${chId}`;
                let history = historyBuffer.get(histKey);
                if (!history) {
                  history = [];
                  historyBuffer.set(histKey, history);
                }
                if (val !== null && val !== undefined) {
                  history.push([now, val]);
                  if (history.length > MAX_HISTORY) {
                    history.shift();
                  }
                }
                const pts = history.map((item) => item[1]);
                const min = pts.length ? Math.min(...pts) : 0;
                const max = pts.length ? Math.max(...pts) : 100;

                result.push({
                  channel_id: chId,
                  id: chId,
                  name: ch.name || ch.channel_name,
                  channel_name: ch.name || ch.channel_name,
                  unit: ch.unit || '',
                  resolution: ch.resolution ?? 2,
                  status: res.success ? 0 : 1,
                  current_value: val,
                  value: val,
                  rawValue: res.rawValue,
                  value: val,
                  device: modbusDev.name || ch.device,
                  deviceId: modbusDev.deviceId || modbusDev.id,
                  serial: modbusDev.serial || modbusDev.serial_number,
                  serial_number: modbusDev.serial || modbusDev.serial_number,
                  slaveId: modbusDev.slaveId,
                  port: modbusDev.port,
                  host: modbusDev.host,
                  measurementData: [history.map((h) => h[1])],
                  realStartTime: history.length ? [history[0][0]] : [now],
                  pointInterval: [1000],
                  min,
                  max
                });
              } catch (err) {
                console.warn(`[TauriSutoAPI] Polling error for Modbus channel ${chId}:`, err);
              }
            }
          }
        }
      }

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
    if (activeTransport === 'API') {
      return ApiDevice.getTablePage(pageIndex, pageSize, selectedChannelIds, callback);
    }
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
   * @param {Object} [options] Optional configuration including { transport }
   */
  async getSystemInfo(options = {}) {
    const reqTransport = (options?.transport || activeTransport || '').toUpperCase();
    if (reqTransport === 'API') {
      return await ApiDevice.getSystemInfo();
    }
    if (reqTransport === 'BLE_WEB' || reqTransport === 'BLE' || reqTransport === 'BLE_NATIVE') {
      if (hasTauri()) {
        try {
          const sInfo = await invoke('suto_get_system_info');
          if (sInfo && (sInfo.device_id || sInfo.serial_number || sInfo.device_name)) {
            return sInfo;
          }
        } catch (_) {}
      }
      return await BleSutoAPI.getSystemInfo();
    }
    if (hasTauri() && (reqTransport === 'TCP' || reqTransport === 'USB')) {
      try {
        const sInfo = await invoke('suto_get_system_info');
        if (sInfo && (sInfo.device_id || sInfo.serial_number || sInfo.device_name)) {
          return sInfo;
        }
      } catch (_) {}
    }
    const isModbusActive = reqTransport === 'MODBUS_TCP' || reqTransport === 'MODBUS_RTU' || reqTransport === 'MODBUS' || (activeModbusDevices.size > 0 && !reqTransport);
    if (isModbusActive) {
      const dev = activeModbusDevices.values().next().value;
      if (dev) {
        return {
          device_name: dev.name,
          device_id: dev.deviceId || dev.id,
          serial_number: dev.serial || dev.serial_number || String(dev.slaveId),
          firmware_version: dev.softwareVersion || '1.0',
          ip: dev.host,
          port: dev.port
        };
      }
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
    if (activeTransport === 'API') {
      return await ApiDevice.getLoggerStatus();
    }
    if (!hasTauri()) {
      return null;
    }
    return await invoke('suto_get_logger_status');
  },

  /**
   * Invoke a Tauri logger readout command while streaming live `suto-readout-progress` events.
   * @private
   */
  async _invokeWithReadoutProgress(command, args, onProgress) {
    if (!hasTauri()) {
      throw new Error('Device communication is only available in desktop application mode.');
    }
    let unlisten = null;
    try {
      if (typeof onProgress === 'function' && typeof listen === 'function') {
        try {
          unlisten = await listen('suto-readout-progress', (event) => {
            const payload = event?.payload || {};
            if (typeof payload.percent === 'number') {
              onProgress(payload.percent, payload);
            }
          });
        } catch (_) {
          unlisten = null;
        }
      }
      return await invoke(command, args);
    } finally {
      if (typeof unlisten === 'function') {
        try { unlisten(); } catch (_) {}
      }
    }
  },

  /**
   * Read logged data from S461/S463 device memory for a given time period
   * @param {number} startTime Unix timestamp in seconds
   * @param {number} stopTime Unix timestamp in seconds
   * @param {Function} [onProgress] Optional callback `(percent, { current, total }) => void`
   * @returns {Promise<{csv_text: string, row_count: number, filename: string}>}
   */
  async readS461Log(startTime, stopTime, onProgress) {
    return await this._invokeWithReadoutProgress('suto_read_s461_log', {
      startTime: Math.floor(startTime),
      stopTime: Math.floor(stopTime),
    }, onProgress);
  },

  /**
   * Read logged data from S418/S419 device memory for a given time period
   * @param {number} startTime Unix timestamp in seconds
   * @param {number} stopTime Unix timestamp in seconds
   * @param {Function} [onProgress] Optional callback `(percent, { current, total }) => void`
   * @returns {Promise<{csv_text: string, row_count: number, filename: string}>}
   */
  async readS418Log(startTime, stopTime, onProgress) {
    return await this._invokeWithReadoutProgress('suto_read_s418_log', {
      startTime: Math.floor(startTime),
      stopTime: Math.floor(stopTime),
    }, onProgress);
  },

  /**
   * Read logger data from device (e.g. S332 WebAPI paged retrieval)
   * @param {string} fileName
   * @param {Function} [onProgress]
   */
  async readLoggerData(fileName, onProgress, fileMeta = null) {
    if (activeTransport === 'API') {
      return await ApiDevice.readLoggerData(fileName, onProgress, fileMeta);
    }
    throw new Error('readLoggerData is only supported on WebAPI devices');
  },

  /**
   * Get storage / disk capacity (e.g. S332 WebAPI)
   */
  async getDiskCapacity() {
    if (activeTransport === 'API') {
      return await ApiDevice.getDiskCapacity();
    }
    return null;
  },

  /**
   * Query device for list of recorded measurement session files stored in device memory
   * @returns {Promise<Array<{fileName: string, startTime: string, endTime: string, channelsCount: number, samplesPerChannel: number, sampleRate: number, description: string, status: number}>>}
   */
  async getLoggerFiles() {
    if (activeTransport === 'API') {
      return await ApiDevice.getLoggerFiles();
    }
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
    if (activeTransport === 'API') {
      return [];
    }
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
    if (activeTransport === 'API') {
      throw new Error('Screenshots are not supported on WebAPI devices.');
    }
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
    if (activeTransport === 'API') {
      return [];
    }
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
    if (activeTransport === 'API') {
      throw new Error('ISO 8573 report export is not supported on WebAPI devices.');
    }
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
    if (!hasNativeTauri()) {
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

  /** Save binary data using native OS Save File dialog (or browser download) */
  async saveBinaryFile(filename, data) {
    if (!hasNativeTauri()) {
      return await ApiDevice.saveBinaryFile(filename, data);
    }
    const byteArr = data instanceof Uint8Array ? Array.from(data) : Array.from(new Uint8Array(data));
    return await invoke('suto_save_binary_file', { filename, data: byteArr });
  },

  /** Open native OS folder selection dialog */
  async pickFolder() {
    if (!hasNativeTauri()) {
      return null;
    }
    return await invoke('suto_pick_folder');
  },

  /** Save binary data to a specific folder on disk */
  async saveFileToPath(folder, filename, data) {
    if (!hasNativeTauri()) {
      return null;
    }
    const byteArr = data instanceof Uint8Array ? Array.from(data) : Array.from(new Uint8Array(data));
    return await invoke('suto_save_file_to_path', { folder, filename, data: byteArr });
  },

  /** Query embedded LAN Web Server status (Port 9080) */
  async getWebServerStatus() {
    if (!hasTauri()) {
      const mockEnabled = typeof localStorage !== 'undefined' && localStorage.getItem('s4a_web_server_enabled') === 'true';
      return {
        enabled: mockEnabled,
        port: 9080,
        primary_url: 'http://localhost:9080',
        urls: ['http://localhost:9080'],
      };
    }
    return await invoke('suto_get_webserver_status');
  },

  /** Start or stop embedded LAN Web Server on port 9080 (macOS / Windows) */
  async setWebServerEnabled(enabled, port = 9080) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('s4a_web_server_enabled', enabled ? 'true' : 'false');
    }
    if (!hasNativeTauri()) {
      return {
        enabled: Boolean(enabled),
        port,
        primary_url: `http://localhost:${port}`,
        urls: [`http://localhost:${port}`],
      };
    }
    const status = await invoke('suto_set_webserver_enabled', {
      enabled: Boolean(enabled),
      port,
    });
    if (enabled) {
      this.pushLocalStateToLanBridge().catch(() => {});
    }
    return status;
  },

  /** Push host localStorage configurations (ProcessScape layouts, locations, devices) to LAN server */
  async pushLocalStateToLanBridge() {
    if (!hasTauri() || typeof localStorage === 'undefined') return;
    const keysToSync = [
      's4a_ps_devices',
      's4a_locations',
      's4a_scapes_list',
      's4a_active_scape_id',
      's4a_alarm_rules',
    ];
    const entries = {};
    for (const k of keysToSync) {
      const val = localStorage.getItem(k);
      if (val != null) entries[k] = val;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('s4a_scape_layout_') || k.startsWith('s4a_ps_'))) {
        const val = localStorage.getItem(k);
        if (val != null) entries[k] = val;
      }
    }
    await invoke('suto_sync_shared_state', { entries });
  },

  /** Pull shared state on LAN client startup so remote browsers immediately see Host configurations */
  async pullLanBridgeState() {
    if (!hasLanBridge() || typeof localStorage === 'undefined') return false;
    try {
      const entries = await invoke('suto_get_shared_state');
      if (entries && typeof entries === 'object') {
        for (const [k, v] of Object.entries(entries)) {
          if (typeof v === 'string') {
            localStorage.setItem(k, v);
          }
        }
        return true;
      }
    } catch (_) {}
    return false;
  },
};

export default TauriSutoAPI;
