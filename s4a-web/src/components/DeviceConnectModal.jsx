import React, { useState, useEffect, useRef, useCallback } from 'react';
import intl from 'react-intl-universal';
import TauriSutoAPI from '../api/TauriSutoAPI';
import BleSutoAPI from '../api/BleSutoAPI';
import { checkIsNative, checkIsLanBridge, isMobile } from '../util/platform';
import {
  getDefaultSubnet,
  scanLanRange,
  discoverDevicesViaBroadcast,
  convertDiscoveredToSensorManagerDevice
} from '../api/lanScanner';
import { buildModbusDevice } from '../modules/processscape/engine/sensorManagerStorage';
import {
  MODBUS_DATA_TYPES,
  normalizeModbusDataType,
  calculate2PointScaling,
  buildCsGetOnlineMeasurementValuesCommand,
  parseCsOnlineMeasurementValues,
  CS_MEASUREMENT_VALUE_SIZE,
  applyModbusChannelScaling
} from '../api/modbusProtocol';
import { pausePolling, resumePolling } from '../util/liveDataSource';
import './DeviceConnectModal.css';

const MODBUS_PRESETS = {
  custom: {
    label: 'Custom Channel Configuration',
    name: 'Modbus Device',
    channels: [
      { id: 1, name: 'Channel 1', unit: 'm³/h', resolution: 1, funcCode: 3, regAddr: 0, dataType: 8, x0: 0, x1: 1, y0: 0, y1: 1, a1: 1.0, a0: 0.0, mBA1: 1.0, mBA0: 0.0 }
    ]
  },
  s401_flow: {
    label: 'Flow, Velocity & Consumption (m³/h, m/s, m³)',
    name: 'Flow Meter',
    channels: [
      { id: 1, name: 'Flow', unit: 'm³/h', resolution: 1, funcCode: 3, regAddr: 0, dataType: 8, x0: 0, x1: 1, y0: 0, y1: 1, a1: 1.0, a0: 0.0, mBA1: 1.0, mBA0: 0.0 },
      { id: 2, name: 'Velocity', unit: 'm/s', resolution: 2, funcCode: 3, regAddr: 2, dataType: 8, x0: 0, x1: 1, y0: 0, y1: 1, a1: 1.0, a0: 0.0, mBA1: 1.0, mBA0: 0.0 },
      { id: 3, name: 'Consumption', unit: 'm³', resolution: 0, funcCode: 3, regAddr: 4, dataType: 8, x0: 0, x1: 1, y0: 0, y1: 1, a1: 1.0, a0: 0.0, mBA1: 1.0, mBA0: 0.0 }
    ]
  },
  s520_dew: {
    label: 'Dew Point & Pressure (°C, bar)',
    name: 'Dew Point Sensor',
    channels: [
      { id: 1, name: 'Dew Point', unit: '°C', resolution: 1, funcCode: 3, regAddr: 0, dataType: 7, x0: 0, x1: 1, y0: 0, y1: 1, a1: 1.0, a0: 0.0, mBA1: 1.0, mBA0: 0.0 },
      { id: 2, name: 'Pressure', unit: 'bar', resolution: 2, funcCode: 3, regAddr: 2, dataType: 7, x0: 0, x1: 1, y0: 0, y1: 1, a1: 1.0, a0: 0.0, mBA1: 1.0, mBA0: 0.0 }
    ]
  },
  power_meter: {
    label: 'Generic 3-Phase Power Meter (V, A, kW, kWh)',
    name: 'Power Meter',
    channels: [
      { id: 1, name: 'Voltage', unit: 'V', resolution: 1, funcCode: 3, regAddr: 0, dataType: 7, x0: 0, x1: 1, y0: 0, y1: 1, a1: 1.0, a0: 0.0, mBA1: 1.0, mBA0: 0.0 },
      { id: 2, name: 'Current', unit: 'A', resolution: 2, funcCode: 3, regAddr: 2, dataType: 7, x0: 0, x1: 1, y0: 0, y1: 1, a1: 1.0, a0: 0.0, mBA1: 1.0, mBA0: 0.0 },
      { id: 3, name: 'Active Power', unit: 'kW', resolution: 2, funcCode: 3, regAddr: 4, dataType: 7, x0: 0, x1: 1, y0: 0, y1: 1, a1: 1.0, a0: 0.0, mBA1: 1.0, mBA0: 0.0 },
      { id: 4, name: 'Total Energy', unit: 'kWh', resolution: 1, funcCode: 3, regAddr: 6, dataType: 7, x0: 0, x1: 1, y0: 0, y1: 1, a1: 1.0, a0: 0.0, mBA1: 1.0, mBA0: 0.0 }
    ]
  }
};

export default function DeviceConnectModal({
  isOpen,
  onClose,
  onConnected,
  onAddMultipleDevices,
  initialTab,
  initialMode = 'manual',
  singleDeviceMode = true
}) {
  const isNative = checkIsNative();
  const isMobileNative = isMobile && !checkIsLanBridge();
  const [tab, setTab] = useState(initialTab || (isMobileNative ? 'ble' : (isNative ? 'usb' : 'ble'))); // 'usb' | 'tcp' | 'ble' | 'api'
  const [tcpHost, setTcpHost] = useState('192.168.1.100');
  const [tcpPort, setTcpPort] = useState('502');
  const [apiHost, setApiHost] = useState('192.168.1.100');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // LAN Auto-Detection State
  const [lanDetectMode, setLanDetectMode] = useState(initialMode); // 'auto' | 'manual'
  const [lanSubnet] = useState(() => getDefaultSubnet());
  const [lanScanning, setLanScanning] = useState(false);
  const [lanProgress, setLanProgress] = useState({ scanned: 0, total: 1, percent: 0, currentIp: '' });
  const [lanDiscovered, setLanDiscovered] = useState([]);
  const [lanSelectedIds, setLanSelectedIds] = useState(new Set());
  const scanAbortRef = useRef(null);

  const [showAllBle, setShowAllBle] = useState(false);
  const [bleDevices, setBleDevices] = useState([]);
  const [scanningBle, setScanningBle] = useState(false);
  const [hasScannedBle, setHasScannedBle] = useState(false);

  // Modbus State
  const [detectedSutoInfo, setDetectedSutoInfo] = useState(null); // { model, serial, softwareVersion, busVersion }
  const [modbusProtocolType, setModbusProtocolType] = useState('tcp'); // 'tcp' | 'rtu'
  const [modbusName, setModbusName] = useState('Modbus Device');
  const [modbusHost, setModbusHost] = useState('192.168.1.100');
  const [modbusPort, setModbusPort] = useState('502');
  const [modbusSlaveId, setModbusSlaveId] = useState('1');
  const [modbusSerialPort, setModbusSerialPort] = useState('COM1');
  const [modbusBaudRate, setModbusBaudRate] = useState('19200');
  const [modbusRtuSlaveId, setModbusRtuSlaveId] = useState('1');
  const [modbusParity, setModbusParity] = useState('none');
  const [selectedScalingIdx, setSelectedScalingIdx] = useState(null);
  const [scalingTestInput, setScalingTestInput] = useState('1000');
  const [modbusPreset, setModbusPreset] = useState('s401_flow');
  const [modbusChannels, setModbusChannels] = useState(() => MODBUS_PRESETS.s401_flow.channels.map(c => ({ ...c })));
  const [modbusTestResults, setModbusTestResults] = useState(null);
  const [modbusTesting, setModbusTesting] = useState(false);
  const [modbusDiscovering, setModbusDiscovering] = useState(false);
  const [modbusDiscoverStatus, setModbusDiscoverStatus] = useState('');
  const [showAutoDetectConfirm, setShowAutoDetectConfirm] = useState(false);

  const selectedModbusChannel = selectedScalingIdx !== null ? modbusChannels[selectedScalingIdx] : null;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedScalingIdx !== null) {
          setSelectedScalingIdx(null);
        } else if (showAutoDetectConfirm) {
          setShowAutoDetectConfirm(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedScalingIdx, showAutoDetectConfirm]);

  const formatCoeff = (num, fallback = 0) => {
    const val = typeof num === 'number' && !isNaN(num) ? num : fallback;
    if (Number.isInteger(val)) return String(val);
    const s = val.toFixed(6);
    return s.replace(/\.?0+$/, '');
  };

  const isPresetActive = (presetType) => {
    if (!selectedModbusChannel) return false;
    const x0 = Number(selectedModbusChannel.x0) || 0;
    const x1 = Number(selectedModbusChannel.x1) || 0;
    const y0 = Number(selectedModbusChannel.y0) || 0;
    const y1 = Number(selectedModbusChannel.y1) || 0;
    const a1 = Number(selectedModbusChannel.a1) || 1;
    const a0 = Number(selectedModbusChannel.a0) || 0;

    switch (presetType) {
      case 'direct':
        return Math.abs(x0) < 1e-6 && Math.abs(x1 - 1) < 1e-6 && Math.abs(y0) < 1e-6 && Math.abs(y1 - 1) < 1e-6 && Math.abs(a1 - 1) < 1e-6 && Math.abs(a0) < 1e-6;
      case '4_20ma':
        return Math.abs(x0 - 4) < 1e-6 && Math.abs(x1 - 20) < 1e-6 && Math.abs(y0) < 1e-6;
      case '0_20ma':
        return Math.abs(x0) < 1e-6 && Math.abs(x1 - 20) < 1e-6 && Math.abs(y0) < 1e-6;
      case '0_10v':
        return Math.abs(x0) < 1e-6 && Math.abs(x1 - 10) < 1e-6 && Math.abs(y0) < 1e-6;
      case '0_10000':
        return Math.abs(x0) < 1e-6 && Math.abs(x1 - 10000) < 1e-6 && Math.abs(y0) < 1e-6;
      case '0_65535':
        return Math.abs(x0) < 1e-6 && Math.abs(x1 - 65535) < 1e-6 && Math.abs(y0) < 1e-6;
      case 'div_10':
        return Math.abs(x0) < 1e-6 && Math.abs(x1 - 10) < 1e-6 && Math.abs(y0) < 1e-6 && Math.abs(y1 - 1) < 1e-6;
      case 'div_100':
        return Math.abs(x0) < 1e-6 && Math.abs(x1 - 100) < 1e-6 && Math.abs(y0) < 1e-6 && Math.abs(y1 - 1) < 1e-6;
      case 'div_1000':
        return Math.abs(x0) < 1e-6 && Math.abs(x1 - 1000) < 1e-6 && Math.abs(y0) < 1e-6 && Math.abs(y1 - 1) < 1e-6;
      default:
        return false;
    }
  };

  const handleDeleteDetectedSuto = () => {
    setDetectedSutoInfo(null);
    setModbusChannels(MODBUS_PRESETS.s401_flow.channels.map(c => ({ ...c })));
    setModbusName('Modbus Device');
    setModbusTestResults(null);
    setSelectedScalingIdx(null);
    setError(null);
  };

  const handleSwitchTab = (newTab) => {
    if (newTab === tab) return;
    setTab(newTab);
    setError(null);
    setDetectedSutoInfo(null);
    setModbusTestResults(null);
    if (lanScanning && scanAbortRef.current) {
      scanAbortRef.current.abort();
      setLanScanning(false);
    }
  };

  const handleDetectSutoDevice = () => {
    if (modbusChannels && modbusChannels.length > 0) {
      setShowAutoDetectConfirm(true);
      return;
    }
    return executeAutoDetect();
  };

  const executeAutoDetect = async () => {
    setShowAutoDetectConfirm(false);
    setModbusDiscovering(true);
    setModbusDiscoverStatus(intl.get('DEV_DETECTING_DEVICE') || 'Detecting device...');
    setError(null);
    setSelectedScalingIdx(null);
    // Auto-detect will clear all current channels and try to fetch channels
    setModbusChannels([]);
    setDetectedSutoInfo(null);
    setModbusTestResults(null);
    try {
      const isRtu = modbusProtocolType === 'rtu';
      const port = parseInt(modbusPort, 10) || 502;
      const slaveId = isRtu
        ? (parseInt(modbusRtuSlaveId, 10) || 1)
        : ((modbusSlaveId !== '' && !isNaN(parseInt(modbusSlaveId, 10))) ? parseInt(modbusSlaveId, 10) : 1);

      const targetHost = isRtu ? modbusSerialPort.trim() : modbusHost.trim();
      const res = await TauriSutoAPI.detectSutoDeviceOverModbus({
        host: targetHost,
        port,
        slaveId,
        isRtu,
        onProgress: (status) => setModbusDiscoverStatus(status)
      });

      if (res && res.channels && res.channels.length > 0) {
        setModbusChannels(res.channels);
        setDetectedSutoInfo(res.deviceInfo);
        const model = res.deviceInfo?.model || (intl.get('DEV_DEVICE_DEFAULT') || 'Device');
        const serial = res.deviceInfo?.serial ? ` (${res.deviceInfo.serial})` : '';
        setModbusName(`${model}${serial}`);
        return res;
      } else {
        const targetLabel = isRtu ? modbusSerialPort : `${modbusHost}:${port}`;
        setError(intl.get('DEV_NO_ACTIVE_CHANNELS_FOUND', { target: targetLabel, slaveId }) || `No device or active channels found on ${targetLabel} (Slave ID: ${slaveId}). Check connection or add channels manually.`);
        return null;
      }
    } catch (err) {
      console.error('[DeviceConnectModal] Discovery error:', err);
      setError((intl.get('DEV_DETECTION_FAILED_PREFIX') || 'Detection Failed: ') + (err?.message || err));
      return null;
    } finally {
      setModbusDiscovering(false);
      setModbusDiscoverStatus('');
    }
  };

  const handleAutoDiscoverS331 = () => {
    return handleDetectSutoDevice();
  };

  const handlePresetChange = (presetKey) => {
    setModbusPreset(presetKey);
    const p = MODBUS_PRESETS[presetKey];
    if (p) {
      setModbusName(p.name);
      setModbusChannels(p.channels.map(c => ({ ...c })));
      setModbusTestResults(null);
      setSelectedScalingIdx(null);
    }
  };

  const handleAddModbusChannel = () => {
    const nextId = modbusChannels.length + 1;
    const lastCh = modbusChannels[modbusChannels.length - 1];
    const nextReg = lastCh ? (lastCh.regAddr + (normalizeModbusDataType(lastCh.dataType) <= 2 ? 1 : 2)) : 0;
    setModbusChannels(prev => [
      ...prev,
      {
        id: nextId,
        name: `Channel ${nextId}`,
        unit: '',
        resolution: 2,
        funcCode: 3,
        regAddr: nextReg,
        dataType: 8,
        x0: 0,
        x1: 1,
        y0: 0,
        y1: 1,
        a1: 1.0,
        a0: 0.0,
        mBA1: 1.0,
        mBA0: 0.0
      }
    ]);
  };

  const handleUpdateModbusChannel = (idx, field, value) => {
    setModbusChannels(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleUpdateChannel2Point = (idx, patch) => {
    setModbusChannels(prev => {
      const copy = [...prev];
      const cur = copy[idx];
      if (!cur) return prev;
      const merged = { ...cur, ...patch };
      const numX0 = merged.x0 === '' ? 0 : (Number(merged.x0) || 0);
      const numX1 = merged.x1 === '' ? 1 : (Number(merged.x1) || 0);
      const numY0 = merged.y0 === '' ? 0 : (Number(merged.y0) || 0);
      const numY1 = merged.y1 === '' ? 1 : (Number(merged.y1) || 0);
      const { a1, a0 } = calculate2PointScaling(numX0, numX1, numY0, numY1);
      copy[idx] = {
        ...merged,
        a1,
        a0,
        mBA1: a1,
        mBA0: a0,
        mBRangeLo: numX0,
        mBRangeHi: numX1,
        mBScalingLo: numY0,
        mBScalingHi: numY1,
        rangeLo: numX0,
        rangeHi: numX1,
        scalingLo: numY0,
        scalingHi: numY1
      };
      return copy;
    });
  };

  const handleApplyScalingPreset = (idx, presetType) => {
    const ch = modbusChannels[idx];
    if (!ch) return;
    const curY1 = (ch.y1 !== undefined && ch.y1 !== 1 && ch.y1 !== 0) ? ch.y1 : 100;
    let x0 = 0, x1 = 1, y0 = 0, y1 = 1;

    switch (presetType) {
      case 'direct':
        x0 = 0; x1 = 1; y0 = 0; y1 = 1;
        break;
      case '4_20ma':
        x0 = 4; x1 = 20; y0 = 0; y1 = curY1;
        break;
      case '0_20ma':
        x0 = 0; x1 = 20; y0 = 0; y1 = curY1;
        break;
      case '0_10v':
        x0 = 0; x1 = 10; y0 = 0; y1 = curY1;
        break;
      case '0_10000':
        x0 = 0; x1 = 10000; y0 = 0; y1 = curY1;
        break;
      case '0_65535':
        x0 = 0; x1 = 65535; y0 = 0; y1 = curY1;
        break;
      case 'div_10':
        x0 = 0; x1 = 10; y0 = 0; y1 = 1;
        break;
      case 'div_100':
        x0 = 0; x1 = 100; y0 = 0; y1 = 1;
        break;
      case 'div_1000':
        x0 = 0; x1 = 1000; y0 = 0; y1 = 1;
        break;
      default:
        return;
    }

    handleUpdateChannel2Point(idx, { x0, x1, y0, y1 });
  };

  const handleResetChannelScaling = (idx) => {
    handleUpdateChannel2Point(idx, { x0: 0, x1: 1, y0: 0, y1: 1 });
  };

  const handleDeleteModbusChannel = (idx) => {
    setModbusChannels(prev => prev.filter((_, i) => i !== idx));
    if (selectedScalingIdx === idx) {
      setSelectedScalingIdx(null);
    } else if (selectedScalingIdx !== null && selectedScalingIdx > idx) {
      setSelectedScalingIdx(selectedScalingIdx - 1);
    }
  };

  const handleTestModbusChannels = async () => {
    setModbusTesting(true);
    setError(null);
    setModbusTestResults(null);
    const results = [];
    try {
      const isRtu = modbusProtocolType === 'rtu';
      const port = parseInt(modbusPort, 10) || 502;
      const slaveId = isRtu
        ? (parseInt(modbusRtuSlaveId, 10) || 1)
        : ((modbusSlaveId !== '' && !isNaN(parseInt(modbusSlaveId, 10))) ? parseInt(modbusSlaveId, 10) : 1);
      const isSuto = Boolean(detectedSutoInfo);

      // If an auto-detected SUTO device is present, read live measurements via SUTO CS-Bus online command
      if (isSuto && modbusChannels.length > 0) {
        try {
          const batchCmd = buildCsGetOnlineMeasurementValuesCommand(1, modbusChannels.length);
          const respBytes = await TauriSutoAPI.exchangeCsModbus({
            host: isRtu ? null : modbusHost.trim(),
            port: isRtu ? null : port,
            slaveId,
            isRtu,
            csPacket: batchCmd,
            timeoutMs: 3000
          });

          if (respBytes && respBytes.length >= CS_MEASUREMENT_VALUE_SIZE) {
            const decodedList = parseCsOnlineMeasurementValues(respBytes, modbusChannels.length);
            if (decodedList.length > 0) {
              modbusChannels.forEach((ch, idx) => {
                const mVal = decodedList[idx];
                const rawVal = mVal ? mVal.value : null;
                const hasCustomScaling = Boolean(ch && (
                  (typeof ch.mBA1 === 'number' && Math.abs(ch.mBA1 - 1.0) > 1e-9) ||
                  (typeof ch.a1 === 'number' && Math.abs(ch.a1 - 1.0) > 1e-9) ||
                  (typeof ch.mBA0 === 'number' && Math.abs(ch.mBA0) > 1e-9) ||
                  (typeof ch.a0 === 'number' && Math.abs(ch.a0) > 1e-9) ||
                  (ch.x0 !== undefined && ch.y1 !== undefined && (Math.abs(ch.x0 - (ch.y0 ?? 0)) > 1e-9 || Math.abs(ch.x1 - (ch.y1 ?? 1)) > 1e-9))
                ));
                const scaledVal = (rawVal !== null && rawVal !== undefined)
                  ? (hasCustomScaling ? applyModbusChannelScaling(rawVal, ch) : rawVal)
                  : null;
                results.push({
                  channelName: ch.name,
                  unit: ch.unit,
                  regAddr: ch.regAddr,
                  success: Boolean(mVal && mVal.isValid),
                  value: scaledVal,
                  rawValue: rawVal,
                  error: (mVal && mVal.isValid) ? null : (intl.get('DEV_INVALID_SENSOR_READING') || 'Invalid sensor reading')
                });
              });
              setModbusTestResults(results);
              return;
            }
          }
        } catch (sutoErr) {
          console.warn('[DeviceConnectModal] SUTO CS-Bus test read note, falling back to registers:', sutoErr);
        }
      }

      // Standard Modbus register read
      for (const ch of modbusChannels) {
        const res = await TauriSutoAPI.readModbusChannel(ch, {
          host: isRtu ? null : modbusHost.trim(),
          port: isRtu ? null : port,
          serialPort: isRtu ? modbusSerialPort.trim() : null,
          baudRate: isRtu ? (parseInt(modbusBaudRate, 10) || 19200) : null,
          parity: isRtu ? modbusParity : null,
          slaveId,
          isRtu,
          isSutoDevice: isSuto
        });
        results.push({
          channelName: ch.name,
          unit: ch.unit,
          regAddr: ch.regAddr,
          success: res.success,
          value: res.value,
          rawValue: res.rawValue,
          error: res.error
        });
      }
      setModbusTestResults(results);
    } catch (err) {
      setError((intl.get('DEV_MODBUS_TEST_FAILED_PREFIX') || 'Modbus Test Failed: ') + (err?.message || err));
    } finally {
      setModbusTesting(false);
    }
  };

  const handleConnectModbus = async () => {
    setLoading(true);
    setError(null);
    try {
      const isRtu = modbusProtocolType === 'rtu';
      const port = parseInt(modbusPort, 10) || 502;
      const slaveId = isRtu
        ? (parseInt(modbusRtuSlaveId, 10) || 1)
        : ((modbusSlaveId !== '' && !isNaN(parseInt(modbusSlaveId, 10))) ? parseInt(modbusSlaveId, 10) : 1);

      let channelsToUse = modbusChannels;
      let devModel = detectedSutoInfo?.model || null;
      let devSerial = detectedSutoInfo?.serial || null;

      if (!channelsToUse || channelsToUse.length === 0) {
        setError(intl.get('DEV_NO_CHANNELS_CONFIGURED') || 'No channels configured to connect. Add channels or click Auto-Detect.');
        setLoading(false);
        return;
      }

      const defaultName = devModel
        ? devModel
        : (isRtu ? `Modbus RTU (${modbusSerialPort})` : `Modbus TCP (${modbusHost}${port === 502 ? '' : `:${port}`})`);
      const name = modbusName.trim() || defaultName;

      const isSuto = Boolean(detectedSutoInfo);
      const devItem = buildModbusDevice({
        name,
        model: devModel,
        serial: devSerial,
        softwareVersion: detectedSutoInfo?.softwareVersion || null,
        isSutoDevice: isSuto,
        host: isRtu ? null : modbusHost.trim(),
        port: isRtu ? null : port,
        serialPort: isRtu ? modbusSerialPort.trim() : null,
        baudRate: isRtu ? (parseInt(modbusBaudRate, 10) || 19200) : null,
        parity: isRtu ? modbusParity : null,
        slaveId,
        transportType: isRtu ? 'modbus_rtu' : 'modbus_tcp',
        channels: channelsToUse
      });

      if (singleDeviceMode) {
        await TauriSutoAPI.disconnect();
      }

      const conn = await TauriSutoAPI.connectModbusTcp({
        host: isRtu ? null : modbusHost.trim(),
        port: isRtu ? null : port,
        serialPort: isRtu ? modbusSerialPort.trim() : null,
        baudRate: isRtu ? (parseInt(modbusBaudRate, 10) || 19200) : null,
        parity: isRtu ? modbusParity : null,
        slaveId,
        isRtu,
        isSutoDevice: isSuto,
        name,
        serial: devItem.serial,
        clearOthers: singleDeviceMode,
        channels: (devItem.sensors || []).flatMap(s => s.channels || [])
      });

      if (typeof onConnected === 'function') {
        onConnected({
          ...conn,
          activeTab: 'modbus',
          transport: isRtu ? 'MODBUS_RTU' : 'MODBUS_TCP',
          deviceItem: devItem
        });
      }
      onClose();
    } catch (err) {
      console.error('[DeviceConnectModal] Modbus connect error:', err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      pausePolling();
      if (initialTab) {
        setTab(initialTab);
      } else {
        setTab(isMobileNative ? 'ble' : (isNative ? 'usb' : 'ble'));
      }
      if (initialMode) {
        setLanDetectMode(initialMode);
      }
      setError(null);
      return () => {
        resumePolling();
      };
    }
  }, [isOpen, initialTab, initialMode, isNative]);

  useEffect(() => {
    if (!isNative && tab !== 'ble' && tab !== 'api' && tab !== 'modbus') {
      setTab('ble');
    }
  }, [isNative, tab]);

  // Cleanup active scan on close or unmount
  useEffect(() => {
    return () => {
      if (scanAbortRef.current) {
        scanAbortRef.current.abort();
        scanAbortRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleConnectUsb = async () => {
    TauriSutoAPI.logClientEvent('INFO', 'DEVICE', 'Connect requested: Direct USB');
    setLoading(true);
    setError(null);
    try {
      if (singleDeviceMode) {
        await TauriSutoAPI.disconnect();
      }
      const conn = await TauriSutoAPI.connectUsb();
      onConnected({ ...conn, activeTab: 'usb', transport: 'USB' });
      onClose();
    } catch (err) {
      console.error('[DeviceConnectModal] USB connect error:', err);
      const msg = typeof err === 'string' ? err : (err?.message || (intl.get('DEV_USB_CONNECT_FAILED') || 'Failed to connect via USB. Please verify cable.'));
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectTcp = async () => {
    TauriSutoAPI.logClientEvent('INFO', 'DEVICE', `Connect requested: Ethernet TCP ${tcpHost}:${tcpPort}`);
    setLoading(true);
    setError(null);
    try {
      if (singleDeviceMode) {
        await TauriSutoAPI.disconnect();
      }
      const port = parseInt(tcpPort, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new Error(intl.get('DEV_INVALID_TCP_PORT') || 'Please enter a valid TCP port number (1-65535)');
      }
      const conn = await TauriSutoAPI.connectTcp(tcpHost.trim(), port);
      onConnected({ ...conn, activeTab: 'tcp', transport: 'TCP' });
      onClose();
    } catch (err) {
      console.error('[DeviceConnectModal] TCP connect error:', err);
      setError(err?.message || (intl.get('DEV_TCP_CONNECT_FAILED') || 'Failed to connect to Ethernet device. Check IP address and port.'));
    } finally {
      setLoading(false);
    }
  };

  const handleConnectApi = async () => {
    TauriSutoAPI.logClientEvent('INFO', 'DEVICE', `Connect requested: WebAPI ${apiHost}:8080`);
    setLoading(true);
    setError(null);
    try {
      if (singleDeviceMode) {
        await TauriSutoAPI.disconnect();
      }
      const conn = await TauriSutoAPI.connectApi(apiHost.trim(), 8080);
      onConnected({ ...conn, activeTab: 'api', transport: 'API' });
      onClose();
    } catch (err) {
      console.error('[DeviceConnectModal] WebAPI connect error:', err);
      setError(err?.message || (intl.get('DEV_API_CONNECT_FAILED') || 'Failed to connect to WebAPI device. Check IP address and network connection.'));
    } finally {
      setLoading(false);
    }
  };

  const handleStartLanScan = async () => {
    if (lanScanning) {
      if (scanAbortRef.current) {
        scanAbortRef.current.abort();
      }
      setLanScanning(false);
      return;
    }

    setLanScanning(true);
    setLanDiscovered([]);
    setLanSelectedIds(new Set());
    setLanProgress({ scanned: 0, total: 1, percent: 30, currentIp: intl.get('DEV_BROADCASTING_UDP_8800') || 'Broadcasting on UDP port 8800...' });

    const abortController = new AbortController();
    scanAbortRef.current = abortController;

    try {
      const devs = await discoverDevicesViaBroadcast({
        timeoutMs: 1800,
        subnet: lanSubnet,
        signal: abortController.signal,
        onDeviceFound: (dev) => {
          setLanDiscovered(prev => {
            const devKey = `${dev.ip}:${dev.port || 502}`;
            if (prev.some(d => `${d.ip}:${d.port || 502}` === devKey)) return prev;
            return [...prev, dev];
          });
          setLanSelectedIds(prev => new Set([...prev, dev.id]));
        }
      });

      // Browser fallback if UDP broadcast returned 0
      if (devs.length === 0 && !isNative) {
        await scanLanRange({
          subnet: lanSubnet,
          start: 1,
          end: 254,
          signal: abortController.signal,
          onProgress: (p) => setLanProgress(p),
          onDeviceFound: (dev) => {
            setLanDiscovered(prev => {
              const devKey = `${dev.ip}:${dev.port || 502}`;
              if (prev.some(d => `${d.ip}:${d.port || 502}` === devKey)) return prev;
              return [...prev, dev];
            });
            setLanSelectedIds(prev => new Set([...prev, dev.id]));
          }
        });
      }

      setLanProgress({
        scanned: 1,
        total: 1,
        percent: 100,
        currentIp: intl.get('DEV_COMPLETE') || 'Complete'
      });
    } catch (_) {
    } finally {
      setLanScanning(false);
      scanAbortRef.current = null;
    }
  };

  const handleToggleLanDevice = (id) => {
    setLanSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (lanSelectedIds.size === lanDiscovered.length) {
      setLanSelectedIds(new Set());
    } else {
      setLanSelectedIds(new Set(lanDiscovered.map(d => d.id)));
    }
  };

  const handleGetSensors = async () => {
    const selected = lanDiscovered.filter(d => lanSelectedIds.has(d.id));
    if (selected.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      if (singleDeviceMode) {
        await TauriSutoAPI.disconnect();
      }
      const convertedDevices = selected.map(dev => convertDiscoveredToSensorManagerDevice(dev)).filter(Boolean);

      if (typeof onAddMultipleDevices === 'function') {
        onAddMultipleDevices(convertedDevices);
      } else if (typeof onConnected === 'function' && selected.length > 0) {
        onConnected({
          address: selected[0].ip,
          host: selected[0].ip,
          port: selected[0].port || 8080,
          transport: selected[0].transport || 'API',
          name: selected[0].name,
          device: selected[0].name,
          serial: selected[0].serial,
          deviceId: selected[0].deviceId
        });
      }

      onClose();
    } catch (err) {
      setError(err?.message || (intl.get('DEV_GET_SENSORS_FAILED') || 'Failed to get sensors from selected devices.'));
    } finally {
      setLoading(false);
    }
  };

  const handleScanBle = async () => {
    setScanningBle(true);
    setError(null);
    try {
      const devs = await TauriSutoAPI.listBleDevices({ acceptAll: showAllBle, timeoutMs: 3000 });
      setBleDevices(devs || []);
      setHasScannedBle(true);
    } catch (err) {
      console.error('[DeviceConnectModal] BLE scan error:', err);
      const msg = typeof err === 'string' ? err : (err?.message || (intl.get('DEV_BLE_SCAN_FAILED') || 'Failed to scan Bluetooth devices. Ensure Bluetooth is enabled.'));
      setError(msg);
    } finally {
      setScanningBle(false);
    }
  };

  const handleConnectBleDevice = async (dev) => {
    TauriSutoAPI.logClientEvent('INFO', 'DEVICE', `Connect requested: BLE ${dev ? (dev.name || dev.id) : 'unknown'}`);
    setLoading(true);
    setError(null);
    try {
      if (singleDeviceMode) {
        await TauriSutoAPI.disconnect();
      }
      const conn = await TauriSutoAPI.connectBle({ deviceId: dev.id, name: dev.name });
      onConnected({ ...conn, activeTab: 'ble', transport: 'BLE' });
      onClose();
    } catch (err) {
      console.error('[DeviceConnectModal] BLE connect error:', err);
      const msg = typeof err === 'string' ? err : (err?.message || (intl.get('DEV_BLE_CONNECT_DEVICE_FAILED', { name: dev.name }) || `Failed to connect to ${dev.name}.`));
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectBle = async () => {
    TauriSutoAPI.logClientEvent('INFO', 'DEVICE', 'BLE scan requested');
    setLoading(true);
    setError(null);
    try {
      if (singleDeviceMode) {
        await TauriSutoAPI.disconnect();
      }
      const conn = await TauriSutoAPI.connectBle({ acceptAll: showAllBle });
      onConnected({ ...conn, activeTab: 'ble', transport: 'BLE' });
      onClose();
    } catch (err) {
      console.error('[DeviceConnectModal] BLE connect error:', err);
      const msg = typeof err === 'string' ? err : (err?.message || (intl.get('DEV_BLE_CONNECT_CANCELLED') || 'Bluetooth connection cancelled or failed.'));
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const renderEthernetSection = (isTcp) => (
    <>
      <div className="lan-detect-mode-bar">
        <button
          type="button"
          className={`lan-detect-mode-btn ${lanDetectMode === 'auto' ? 'active' : ''}`}
          onClick={() => setLanDetectMode('auto')}
        >
          {intl.get('DEV_AUTO_DETECT_BTN') || '🔍 Auto Detect'}
        </button>
        <button
          type="button"
          className={`lan-detect-mode-btn ${lanDetectMode === 'manual' ? 'active' : ''}`}
          onClick={() => setLanDetectMode('manual')}
        >
          {intl.get('DEV_MANUAL_IP_BTN') || '✏️ Manual IP Input'}
        </button>
      </div>

      {lanDetectMode === 'auto' ? (
        <div className="lan-auto-detect-section">
          <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 12px' }}>
            <button
              type="button"
              className={`lan-scan-btn ${lanScanning ? 'scanning' : ''}`}
              style={{ width: '100%', height: '38px', fontSize: '13px' }}
              onClick={handleStartLanScan}
              disabled={loading}
            >
              {lanScanning ? (
                <>
                  <span className="lan-scan-spinner" />
                  <span>{intl.get('DEV_BROADCASTING_LISTENING_8800') || 'Broadcasting & Listening (Port 8800)...'}</span>
                </>
              ) : (
                <>
                  <span>{intl.get('DEV_AUTO_DETECT_BROADCAST_BTN') || '📡 Auto Detect (Broadcast)'}</span>
                </>
              )}
            </button>
          </div>

          {lanScanning && (
            <div className="lan-progress-container">
              <div className="lan-progress-bar-bg">
                <div
                  className="lan-progress-bar-fill"
                  style={{ width: `${lanProgress.percent}%` }}
                />
              </div>
              <div className="lan-progress-status">
                <span>{lanProgress.currentIp || (intl.get('DEV_BROADCASTING_ON_LAN') || 'Broadcasting on LAN...')}</span>
                <span>{intl.get('DEV_FOUND_COUNT', { count: lanDiscovered.length }) || `${lanDiscovered.length} found`}</span>
              </div>
            </div>
          )}

          {/* Discovered IP Devices List */}
          <div className="lan-discovered-section">
            <div className="lan-discovered-header">
              <label className="lan-select-all-label">
                <input
                  type="checkbox"
                  checked={lanDiscovered.length > 0 && lanSelectedIds.size === lanDiscovered.length}
                  onChange={handleToggleSelectAll}
                  disabled={lanDiscovered.length === 0}
                />
                <span>{intl.get('DEV_SELECT_ALL_COUNT', { count: lanDiscovered.length }) || `Select All (${lanDiscovered.length})`}</span>
              </label>
              <span className="lan-discovered-count">
                {intl.get('DEV_SELECTED_OF_TOTAL', { selected: lanSelectedIds.size, total: lanDiscovered.length }) || `${lanSelectedIds.size} of ${lanDiscovered.length} selected`}
              </span>
            </div>

            <div className="lan-devices-list">
              {lanDiscovered.length === 0 ? (
                <div className="lan-empty-box">
                  <div style={{ fontSize: 24, marginBottom: 4 }}>📡</div>
                  <div style={{ fontWeight: 600, color: '#334155', marginBottom: 2 }}>
                    {lanScanning
                      ? (intl.get('DEV_BROADCASTING_WAITING') || 'Broadcasting & waiting for devices...')
                      : (intl.get('DEV_NO_DEVICES_DISCOVERED') || 'No Devices Discovered')}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {lanScanning
                      ? (intl.get('DEV_LISTENING_UDP_8800_HINT') || 'Listening on UDP port 8800. Responding devices will appear automatically.')
                      : (intl.get('DEV_CLICK_AUTO_DETECT_HINT') || 'Click "Auto Detect (Broadcast)" above to discover devices on the network.')}
                  </div>
                </div>
              ) : (
                lanDiscovered.map((dev) => {
                  const isSelected = lanSelectedIds.has(dev.id);
                  return (
                    <div
                      key={dev.id}
                      className={`lan-device-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleToggleLanDevice(dev.id)}
                    >
                      <input
                        type="checkbox"
                        className="lan-device-checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleLanDevice(dev.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="lan-device-info">
                        <div className="lan-device-title-row">
                          <span className="lan-device-ip">{dev.ip}</span>
                          <span className="lan-device-name">{dev.name}</span>
                          <span className="lan-device-badge transport">{dev.transport}</span>
                        </div>
                        <div className="lan-device-meta">
                          {dev.mac && <span className="lan-mac-tag">MAC: {dev.mac}</span>}
                          {dev.serial && <span>SN: {dev.serial}</span>}
                          {dev.firmware && <span> · FW: {dev.firmware}</span>}
                          {dev.channelsCount > 0 && (
                            <span className="lan-device-ch-badge">
                              {intl.get('DEV_N_CHANNELS', { count: dev.channelsCount }) || `${dev.channelsCount} Channels`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="lan-device-status">
                        <span className="lan-status-dot" />
                        <span>{intl.get('DEV_ONLINE') || 'Online'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {lanDiscovered.length > 0 && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                {intl.get('DEV_DEVICES_SELECTED_OF_TOTAL', { selected: lanSelectedIds.size, total: lanDiscovered.length }) || `${lanSelectedIds.size} of ${lanDiscovered.length} device(s) selected`}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="lan-manual-section">
          {isTcp ? (
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
              <div className="form-group" style={{ flex: 3 }}>
                <label className="form-label">{intl.get('DEV_DEVICE_IP_HOST') || 'Device IP Address / Host'}</label>
                <input
                  type="text"
                  className="form-input"
                  value={tcpHost}
                  onChange={(e) => setTcpHost(e.target.value)}
                  placeholder="192.168.1.100"
                  disabled={loading}
                />
              </div>
              <div className="form-group" style={{ flex: 1.5 }}>
                <label className="form-label">{intl.get('DEV_PORT') || 'Port'}</label>
                <input
                  type="number"
                  className="form-input"
                  value={tcpPort}
                  onChange={(e) => setTcpPort(e.target.value)}
                  placeholder="502"
                  disabled={loading}
                />
              </div>
            </div>
          ) : (
            <div className="form-group" style={{ marginTop: '6px' }}>
              <label className="form-label">{intl.get('DEV_WEBAPI_IP_HOST') || 'WebAPI IP Address / Host'}</label>
              <input
                type="text"
                className="form-input"
                value={apiHost}
                onChange={(e) => setApiHost(e.target.value)}
                placeholder="192.168.1.100"
                disabled={loading}
              />
            </div>
          )}
        </div>
      )}
    </>
  );

  const renderModbusSection = () => {
    const isRtu = modbusProtocolType === 'rtu';
    const isFixedSuto = Boolean(detectedSutoInfo);
    const selectedChannel = selectedScalingIdx !== null ? modbusChannels[selectedScalingIdx] : null;

    return (
      <div className="modbus-section">
        {/* Connection Info */}
        {!isRtu ? (
          <div className="modbus-grid-row modbus-tcp-row">
            <div className="form-group" style={{ flex: 1.5 }}>
              <label className="form-label">{intl.get('DEV_DEVICE_NAME') || 'Device Name'}</label>
              <input
                type="text"
                className="form-input"
                value={modbusName}
                onChange={(e) => setModbusName(e.target.value)}
                placeholder={intl.get('DEV_MODBUS_TCP_DEVICE_PLACEHOLDER') || 'Modbus TCP Device'}
                disabled={loading}
              />
            </div>
            <div className="form-group" style={{ flex: 1.6 }}>
              <label className="form-label">{intl.get('DEV_HOST_IP_ADDRESS') || 'Host IP / Address'}</label>
              <input
                type="text"
                className="form-input"
                value={modbusHost}
                onChange={(e) => setModbusHost(e.target.value)}
                placeholder="192.168.1.100"
                disabled={loading}
              />
            </div>
            <div className="form-group modbus-port-group">
              <label className="form-label">{intl.get('DEV_PORT') || 'Port'}</label>
              <input
                type="number"
                className="form-input"
                value={modbusPort}
                onChange={(e) => setModbusPort(e.target.value)}
                placeholder="502"
                disabled={loading}
              />
            </div>
            <div className="form-group modbus-scan-group">
              <button
                type="button"
                className="modbus-scan-channels-link"
                onClick={handleDetectSutoDevice}
                disabled={loading || modbusDiscovering || !modbusHost}
                title={!modbusHost
                  ? (intl.get('DEV_ENTER_HOST_IP_FIRST_TITLE') || "Enter Host IP first to scan SUTO channels")
                  : (intl.get('DEV_QUERY_SUTO_CHANNELS_TITLE') || "Query device at this IP and read SUTO channels")}
              >
                {modbusDiscovering && <span className="spinner-sm" style={{ marginRight: '6px' }} />}
                <span>{intl.get('DEV_SCAN_CHANNELS_SUTO_ONLY') || 'Scan Channels (SUTO only)'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="modbus-grid-row">
            <div className="form-group" style={{ flex: 1.4 }}>
              <label className="form-label">{intl.get('DEV_DEVICE_NAME') || 'Device Name'}</label>
              <input
                type="text"
                className="form-input"
                value={modbusName}
                onChange={(e) => setModbusName(e.target.value)}
                placeholder={intl.get('DEV_MODBUS_RTU_DEVICE_PLACEHOLDER') || 'Modbus RTU Device'}
                disabled={loading}
              />
            </div>
            <div className="form-group" style={{ flex: 1.2 }}>
              <label className="form-label">{intl.get('DEV_SERIAL_COM_PORT') || 'Serial / COM Port'}</label>
              <input
                type="text"
                className="form-input"
                value={modbusSerialPort}
                onChange={(e) => setModbusSerialPort(e.target.value)}
                placeholder={intl.get('DEV_SERIAL_PORT_PLACEHOLDER') || 'COM1 or /dev/ttyUSB0'}
                disabled={loading}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">{intl.get('DEV_BAUD_RATE') || 'Baud Rate'}</label>
              <select
                className="form-input"
                value={modbusBaudRate}
                onChange={(e) => setModbusBaudRate(e.target.value)}
                disabled={loading}
              >
                <option value="9600">9600</option>
                <option value="19200">19200</option>
                <option value="38400">38400</option>
                <option value="57600">57600</option>
                <option value="115200">115200</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 0.8 }}>
              <label className="form-label">{intl.get('DEV_SLAVE_ADDRESS') || 'Slave Address'}</label>
              <input
                type="number"
                className="form-input"
                value={modbusRtuSlaveId}
                onChange={(e) => setModbusRtuSlaveId(e.target.value)}
                min="1"
                max="247"
                placeholder="1"
                disabled={loading}
              />
            </div>
            <div className="form-group" style={{ flex: 0.9 }}>
              <label className="form-label">{intl.get('DEV_PARITY') || 'Parity'}</label>
              <select
                className="form-input"
                value={modbusParity}
                onChange={(e) => setModbusParity(e.target.value)}
                disabled={loading}
              >
                <option value="none">{intl.get('DEV_PARITY_NONE') || 'None (8N1)'}</option>
                <option value="even">{intl.get('DEV_PARITY_EVEN') || 'Even (8E1)'}</option>
                <option value="odd">{intl.get('DEV_PARITY_ODD') || 'Odd (8O1)'}</option>
              </select>
            </div>
          </div>
        )}

        {/* Auto-Detected Device Banner */}
        {detectedSutoInfo && (
          <div className="suto-detected-card" style={{ marginBottom: 12 }}>
            <div className="suto-detected-header">
              <div className="suto-detected-title-group">
                <span className="suto-detected-badge">
                  <span className="dot"></span> {intl.get('DEV_DETECTED_DEVICE') || 'Detected Device'}
                </span>
                <span className="suto-detected-title">{detectedSutoInfo.model}</span>
              </div>
              <button
                type="button"
                className="suto-delete-btn"
                onClick={handleDeleteDetectedSuto}
                disabled={loading || modbusDiscovering}
                title={intl.get('DEV_DELETE_DETECTED_TITLE') || "Delete detected device and configure custom/3rd-party channels"}
              >
                {intl.get('DEV_DELETE_BTN') || '🗑️ Delete'}
              </button>
            </div>

            <div className="suto-meta-chips">
              <div className="suto-chip">
                <span>{intl.get('DEV_SERIAL_NO_LABEL') || 'Serial No:'}</span>
                <strong>{detectedSutoInfo.serial}</strong>
              </div>
              <div className="suto-chip">
                <span>{intl.get('DEV_FIRMWARE_LABEL') || 'Firmware:'}</span>
                <strong>v{detectedSutoInfo.softwareVersion}</strong>
              </div>
              <div className="suto-chip">
                <span>{intl.get('DEV_BUS_VERSION_LABEL') || 'Bus Version:'}</span>
                <strong>v{detectedSutoInfo.busVersion}</strong>
              </div>
              <div className="suto-chip">
                <span>{intl.get('DEV_SLAVE_ADDRESS_LABEL') || 'Slave Address:'}</span>
                <strong>{isRtu ? modbusRtuSlaveId : (modbusSlaveId || 1)}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Auto-Discovery Status */}
        {modbusDiscovering && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', color: '#047857', fontSize: '13px', margin: '8px 0' }}>
            <span className="spinner-sm" />
            <span>{modbusDiscoverStatus || (intl.get('DEV_DETECTING_DEVICE') || 'Detecting device...')}</span>
          </div>
        )}

        {/* Channel List Header & Items */}
        <div className={`modbus-channels-header ${isFixedSuto ? 'fixed-suto-header' : ''}`}>
          <span>{intl.get('DEV_CHANNEL_NAME') || 'Channel Name'}</span>
          <span>{intl.get('DEV_UNIT') || 'Unit'}</span>
          {!isFixedSuto && <span>{intl.get('DEV_RESOLUTION') || 'Resolution'}</span>}
          <span>{intl.get('DEV_FUNC') || 'Func'}</span>
          <span>{intl.get('DEV_REG_ADDR') || 'Reg Addr'}</span>
          <span>{intl.get('DEV_DATA_TYPE') || 'Data Type'}</span>
          {!isFixedSuto && <span style={{ textAlign: 'center' }}>{intl.get('DEV_SCALING_RANGE') || 'Scaling Range'}</span>}
          {!isFixedSuto && <span></span>}
        </div>

        <div className="modbus-channels-container">
          {modbusChannels.map((ch, idx) => {
            const x0 = ch.x0 ?? 0;
            const x1 = ch.x1 ?? 1;
            const y0 = ch.y0 ?? 0;
            const y1 = ch.y1 ?? 1;
            const a1 = ch.a1 ?? 1.0;
            const a0 = ch.a0 ?? 0.0;
            const isDirect = Math.abs(x0) < 1e-6 && Math.abs(x1 - 1) < 1e-6 && Math.abs(y0) < 1e-6 && Math.abs(y1 - 1) < 1e-6 && Math.abs(a1 - 1) < 1e-6 && Math.abs(a0) < 1e-6;
            const hasCustomScaling = !isDirect;
            const isRowSelected = selectedScalingIdx === idx;
            const scalingBadgeLabel = isDirect
              ? (intl.get('DEV_SCALING_1_1_DIRECT') || '1:1 (Direct)')
              : `${x0}..${x1} → ${y0}..${y1}`;
            const scalingBadgeTitle = isDirect
              ? (intl.get('DEV_SCALING_DIRECT_TITLE') || 'Display Scaling: 1:1 direct passthrough (Click to configure 2-point calibration)')
              : (intl.get('DEV_SCALING_CUSTOM_TITLE', {
                  x0,
                  x1,
                  y0,
                  y1,
                  unit: ch.unit || '',
                  a1: Number(a1.toFixed(5)),
                  a0: Number(a0.toFixed(5))
                }) || `Display Scaling: [${x0}..${x1}] → [${y0}..${y1} ${ch.unit || ''}] (Formula: y = ${Number(a1.toFixed(5))}·x + ${Number(a0.toFixed(5))})`);

            return (
              <div key={ch.id || idx} className={`modbus-channel-row ${isRowSelected ? 'selected-scaling-row' : ''} ${isFixedSuto ? 'fixed-suto-row' : ''}`}>
                <input
                  type="text"
                  className="modbus-input-sm"
                  value={ch.name}
                  onChange={(e) => handleUpdateModbusChannel(idx, 'name', e.target.value)}
                  placeholder={intl.get('DEV_NAME_PLACEHOLDER') || "Name"}
                  disabled={loading}
                />
                <input
                  type="text"
                  className="modbus-input-sm"
                  value={ch.unit}
                  onChange={(e) => handleUpdateModbusChannel(idx, 'unit', e.target.value)}
                  placeholder={intl.get('DEV_UNIT') || "Unit"}
                  disabled={loading || isFixedSuto}
                  readOnly={isFixedSuto}
                />
                {!isFixedSuto && (
                  <select
                    className="modbus-input-sm"
                    value={ch.resolution !== undefined ? ch.resolution : 2}
                    onChange={(e) => handleUpdateModbusChannel(idx, 'resolution', parseInt(e.target.value, 10))}
                    disabled={loading}
                    title={intl.get('DEV_RESOLUTION_TITLE') || "Channel display decimal resolution"}
                  >
                    <option value={0}>0 (1)</option>
                    <option value={1}>0.1</option>
                    <option value={2}>0.01</option>
                    <option value={3}>0.001</option>
                    <option value={4}>0.0001</option>
                  </select>
                )}
                <select
                  className="modbus-input-sm"
                  value={ch.funcCode}
                  onChange={(e) => handleUpdateModbusChannel(idx, 'funcCode', parseInt(e.target.value, 10))}
                  disabled={loading || isFixedSuto}
                >
                  <option value={3}>03</option>
                  <option value={4}>04</option>
                </select>
                <input
                  type="number"
                  className="modbus-input-sm"
                  value={ch.regAddr}
                  onChange={(e) => handleUpdateModbusChannel(idx, 'regAddr', parseInt(e.target.value, 10) || 0)}
                  min="0"
                  placeholder="0"
                  disabled={loading || isFixedSuto}
                  readOnly={isFixedSuto}
                />
                <select
                  className="modbus-input-sm"
                  value={normalizeModbusDataType(ch.dataType)}
                  onChange={(e) => handleUpdateModbusChannel(idx, 'dataType', parseInt(e.target.value, 10))}
                  disabled={loading || isFixedSuto}
                >
                  <option value={1}>INT16</option>
                  <option value={2}>UINT16</option>
                  <option value={3}>INT32_B</option>
                  <option value={4}>INT32_L</option>
                  <option value={5}>UINT32_B</option>
                  <option value={6}>UINT32_L</option>
                  <option value={7}>FLOAT_B</option>
                  <option value={8}>FLOAT_L</option>
                </select>

                {/* Scaling Range Column (Clickable to open scaling range editor, hidden for auto-detected sensor) */}
                {!isFixedSuto && (
                  <button
                    type="button"
                    className={`modbus-scaling-badge-btn ${hasCustomScaling ? 'modified' : ''} ${isRowSelected ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedScalingIdx(idx);
                      if (ch.x1 !== undefined && ch.x1 !== 0) {
                        setScalingTestInput(String(ch.x1));
                      } else {
                        setScalingTestInput('1000');
                      }
                    }}
                    title={scalingBadgeTitle}
                  >
                    <span className="modbus-scaling-badge-text">{scalingBadgeLabel}</span>
                    <span className="modbus-scaling-gear">⚙️</span>
                  </button>
                )}

                {!isFixedSuto && (
                  <button
                    type="button"
                    className="modbus-del-btn"
                    onClick={() => handleDeleteModbusChannel(idx)}
                    title={intl.get('DEV_DELETE_CHANNEL_TITLE') || "Delete channel"}
                    disabled={loading || modbusChannels.length <= 1}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'flex-start' }}>
          {!isFixedSuto && (
            <button
              type="button"
              className="modbus-add-ch-btn"
              onClick={handleAddModbusChannel}
              disabled={loading}
            >
              <span>+</span> {intl.get('DEV_ADD_CHANNEL') || 'Add Channel'}
            </button>
          )}
          <button
            type="button"
            className="modbus-add-ch-btn"
            onClick={handleTestModbusChannels}
            disabled={loading || modbusTesting || modbusChannels.length === 0}
            title={intl.get('DEV_TEST_READ_TITLE') || "Read current values from configured registers"}
          >
            {modbusTesting ? (intl.get('DEV_TESTING_READ') || '⏳ Testing Read...') : (intl.get('DEV_TEST_READ') || '🔍 Test Read')}
          </button>
        </div>

        {/* Test Results Display */}
        {modbusTestResults && (
          <div className="modbus-test-box">
            <div className="modbus-test-header">
              <span>{intl.get('DEV_LIVE_REGISTER_RESULTS') || 'Live Register Read Results:'}</span>
              <span>{intl.get('DEV_N_OF_TOTAL_OK', { ok: modbusTestResults.filter(r => r.success).length, total: modbusTestResults.length }) || `${modbusTestResults.filter(r => r.success).length} of ${modbusTestResults.length} OK`}</span>
            </div>
            <div className="modbus-test-results-list">
              {modbusTestResults.map((tr, i) => (
                <div key={i} className={`modbus-test-item ${tr.success ? 'success' : 'error'}`}>
                  <span>{tr.channelName} (Reg: 0x{((tr.regAddr ?? 0)).toString(16).toUpperCase().padStart(4, '0')}):</span>
                  <span>
                    {tr.success
                      ? `${typeof tr.value === 'number' ? tr.value.toFixed(2) : tr.value} ${tr.unit || ''}`
                      : `⚠️ ${tr.error}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="device-connect-overlay">
      <div className={`device-connect-modal ${tab === 'modbus' ? 'modbus-wide' : ''}`}>
        {/* Header */}
        <div className="device-connect-header">
          <div>
            <h3>{intl.get('DEV_CONNECT_HARDWARE') || 'Connect Hardware'}</h3>
            <p>{intl.get('DEV_SELECT_COMM_MEDIUM') || 'Select your communication medium to initiate live monitoring'}</p>
          </div>
          <button className="device-connect-close" onClick={onClose}>✕</button>
        </div>

        {/* Medium Selection Tabs */}
        <div className="device-connect-tabs">
          {isNative ? (
            <>
              <button
                className={`modal-tab-btn ${tab === 'usb' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('usb')}
              >
                <span>🔌</span>
                <span>{isMobileNative ? (intl.get('DEV_USB_OTG') || 'USB OTG') : (intl.get('DIRECT_USB') || 'Direct USB')}</span>
              </button>
              <button
                className={`modal-tab-btn ${tab === 'ble' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('ble')}
              >
                <span>📶</span>
                <span>{intl.get('BLUETOOTH_BLE') || 'Bluetooth (BLE)'}</span>
              </button>
              <button
                className={`modal-tab-btn ${tab === 'tcp' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('tcp')}
              >
                <span>🌐</span>
                <span>{intl.get('ETHERNET_TCP') || 'Ethernet TCP'}</span>
              </button>
              <button
                className={`modal-tab-btn ${tab === 'api' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('api')}
              >
                <span>⚡</span>
                <span>{intl.get('DEV_WEBAPI') || 'WebAPI'}</span>
              </button>
              <button
                className={`modal-tab-btn ${tab === 'modbus' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('modbus')}
              >
                <span>📟</span>
                <span>{intl.get('DEV_MODBUS_TCP_RTU') || 'Modbus (TCP/RTU)'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                className={`modal-tab-btn ${tab === 'ble' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('ble')}
              >
                <span>📶</span>
                <span>{intl.get('BLUETOOTH_BLE') || 'Bluetooth (BLE)'}</span>
              </button>
            </>
          )}
        </div>

        {/* Tab Body */}
        <div className="device-connect-body">
          {tab === 'usb' && (
            <p className="tab-desc">
              {isMobileNative
                ? (intl.get('DEV_USB_OTG_DESC') || 'Connect via USB-C OTG cable to industrial sensor. When prompted, tap "OK" to grant USB permission.')
                : (intl.get('DEV_USB_DIRECT_DESC') || 'Direct driver connection. Automatically scans for connected sensor.')}
            </p>
          )}

          {tab === 'tcp' && renderEthernetSection(true)}

          {tab === 'ble' && (
            <>
              <p className="tab-desc">
                {isNative
                  ? (intl.get('DEV_BLE_NATIVE_DESC') || 'Connect wirelessly to industrial Bluetooth Low Energy (BLE) sensors via native Bluetooth.')
                  : (
                    <>{intl.get('DEV_BLE_WEB_DESC_PREFIX') || 'Connect wirelessly to industrial Bluetooth Low Energy (BLE) sensors via browser'} <strong>{intl.get('DEV_WEB_BLUETOOTH') || 'Web Bluetooth'}</strong>.</>
                  )}
              </p>

              <div className="ble-badge-hint">
                <span>ℹ️</span>
                <span>
                  {isNative
                    ? (intl.get('DEV_BLE_NATIVE_READY') || 'Native Bluetooth Low Energy (BLE) engine is active and ready.')
                    : BleSutoAPI.isSupported()
                      ? (intl.get('DEV_BLE_WEB_SUPPORTED') || 'Web Bluetooth is supported in your current browser.')
                      : (BleSutoAPI.getSupportIssue() || (intl.get('DEV_BLE_WEB_REQUIRES_CHROME') || 'Web Bluetooth requires Chrome or a Chromium-based browser.'))}
                </span>
              </div>

              <div style={{ marginTop: '4px', marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={showAllBle}
                    onChange={(e) => setShowAllBle(e.target.checked)}
                    disabled={loading || scanningBle}
                  />
                  <span>{intl.get('DEV_BLE_SHOW_ALL') || 'Show all nearby Bluetooth devices (unfiltered)'}</span>
                </label>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', marginLeft: '24px' }}>
                  {showAllBle
                    ? (intl.get('DEV_BLE_SCANNING_ALL_HINT') || 'Scanning all nearby Bluetooth devices.')
                    : (intl.get('DEV_BLE_FILTERED_HINT') || 'Default: Filtered by compatible sensor hardware services for quick selection.')}
                </div>
              </div>

              {isNative && bleDevices.length > 0 && (
                <div className="ble-device-list">
                  <div className="ble-device-list-header">
                    {intl.get('DEV_DISCOVERED_BLE_DEVICES', { count: bleDevices.length }) || `Discovered BLE Devices (${bleDevices.length}):`}
                  </div>
                  <div className="ble-device-items">
                    {bleDevices.map((dev) => (
                      <div key={dev.id} className="ble-device-card">
                        <div className="ble-card-left">
                          <div className="ble-card-title">
                            {dev.name || (intl.get('DEV_UNNAMED_SENSOR') || 'Unnamed Sensor')}
                            {dev.is_suto && <span className="suto-pill">{intl.get('DEV_SENSOR_BADGE') || 'Sensor'}</span>}
                          </div>
                          <div className="ble-card-id">{dev.id}</div>
                        </div>
                        <div className="ble-card-right">
                          {dev.rssi !== null && dev.rssi !== undefined && (
                            <span className="ble-rssi-tag">{dev.rssi} dBm</span>
                          )}
                          <button
                            className="ble-card-connect-btn"
                            onClick={() => handleConnectBleDevice(dev)}
                            disabled={loading || scanningBle}
                          >
                            {intl.get('DEV_CONNECT') || 'Connect'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isNative && hasScannedBle && bleDevices.length === 0 && !scanningBle && (
                <div className="ble-empty-notice">
                  {intl.get('DEV_NO_BLE_SENSORS_FOUND') || 'No nearby BLE sensors found. Make sure the sensor is powered on, Bluetooth is broadcasting, and try scanning again.'}
                </div>
              )}
            </>
          )}

          {tab === 'api' && (
            <>
              <p className="tab-desc">
                {intl.get('DEV_WEBAPI_DESC') || 'Connect to S332 serial Web API'}
              </p>
              {renderEthernetSection(false)}
            </>
          )}
          {tab === 'modbus' && renderModbusSection()}

          {error && (
            <div className="connect-error-box" style={{ marginTop: '14px' }}>
              <span>⚠️ {error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer: Unified bottom action bar for ALL tabs */}
        <div className="device-connect-footer">
          <button
            type="button"
            className="footer-close-btn"
            onClick={onClose}
            disabled={loading}
          >
            {intl.get('CLOSE') || 'Close'}
          </button>

          {tab === 'usb' && (
            <button
              className="connect-action-btn"
              onClick={handleConnectUsb}
              disabled={loading}
            >
              {loading
                ? (intl.get('DEV_CONNECTING_USB') || 'Connecting via USB...')
                : (isMobileNative
                  ? (intl.get('DEV_DETECT_CONNECT_USB_OTG') || '🔌 Detect & Connect USB OTG')
                  : (intl.get('DEV_DETECT_CONNECT_USB') || '🔌 Detect & Connect USB'))}
            </button>
          )}

          {tab === 'tcp' && (
            lanDetectMode === 'auto' ? (
              <button
                type="button"
                className="connect-action-btn"
                onClick={handleGetSensors}
                disabled={loading || lanSelectedIds.size === 0}
              >
                {loading
                  ? (intl.get('DEV_RETRIEVING_SENSORS') || 'Retrieving Sensors...')
                  : (intl.get('DEV_GET_SENSORS_BTN', { count: lanSelectedIds.size, plural: lanSelectedIds.size === 1 ? '' : 's' }) || `📥 Get Sensors (${lanSelectedIds.size} Device${lanSelectedIds.size === 1 ? '' : 's'})`)}
              </button>
            ) : (
              <button
                type="button"
                className="connect-action-btn"
                onClick={handleConnectTcp}
                disabled={loading || !tcpHost.trim()}
              >
                {loading
                  ? (intl.get('DEV_CONNECTING') || 'Connecting...')
                  : (intl.get('DEV_CONNECT_ETHERNET_TCP') || '🌐 Connect via Ethernet TCP')}
              </button>
            )
          )}

          {tab === 'api' && (
            lanDetectMode === 'auto' ? (
              <button
                type="button"
                className="connect-action-btn"
                onClick={handleGetSensors}
                disabled={loading || lanSelectedIds.size === 0}
              >
                {loading
                  ? (intl.get('DEV_RETRIEVING_SENSORS') || 'Retrieving Sensors...')
                  : (intl.get('DEV_GET_SENSORS_BTN', { count: lanSelectedIds.size, plural: lanSelectedIds.size === 1 ? '' : 's' }) || `📥 Get Sensors (${lanSelectedIds.size} Device${lanSelectedIds.size === 1 ? '' : 's'})`)}
              </button>
            ) : (
              <button
                type="button"
                className="connect-action-btn"
                onClick={handleConnectApi}
                disabled={loading || !apiHost.trim()}
              >
                {loading
                  ? (intl.get('DEV_CONNECTING') || 'Connecting...')
                  : (intl.get('DEV_CONNECT_WEBAPI') || '⚡ Connect to WebAPI')}
              </button>
            )
          )}

          {tab === 'ble' && (
            isNative ? (
              <button
                type="button"
                className="connect-action-btn"
                onClick={handleScanBle}
                disabled={loading || scanningBle}
              >
                {scanningBle
                  ? (intl.get('DEV_SCANNING_NEARBY_BLE') || '📡 Scanning nearby devices (3s)...')
                  : (showAllBle
                    ? (intl.get('DEV_SCAN_ALL_BLE') || '📶 Scan All BLE Devices')
                    : (intl.get('DEV_SCAN_BLE_SENSORS') || '📶 Scan BLE Sensors'))}
              </button>
            ) : (
              <button
                type="button"
                className="connect-action-btn"
                onClick={handleConnectBle}
                disabled={loading || !BleSutoAPI.isSupported()}
              >
                {loading
                  ? (intl.get('DEV_PAIRING_BLUETOOTH') || 'Pairing Bluetooth...')
                  : (showAllBle
                    ? (intl.get('DEV_SCAN_ALL_BLE') || '📶 Scan All BLE Devices')
                    : (intl.get('DEV_SCAN_BLE_SENSORS') || '📶 Scan BLE Sensors'))}
              </button>
            )
          )}

          {tab === 'modbus' && (
            <button
              type="button"
              className="connect-action-btn"
              onClick={handleConnectModbus}
              disabled={loading || modbusTesting || modbusDiscovering || modbusChannels.length === 0}
            >
              {loading
                ? (intl.get('DEV_CONNECTING') || 'Connecting...')
                : (intl.get('DEV_CONNECT_TO_DEVICE') || 'Connect to device')}
            </button>
          )}
        </div>

        {/* Modbus Display Scaling Dialog (2-Point Calibration Modal) */}
        {tab === 'modbus' && !detectedSutoInfo && selectedModbusChannel && (
          <div className="modbus-scaling-dialog-overlay" onClick={() => setSelectedScalingIdx(null)}>
            <div className="modbus-scaling-dialog-card" onClick={(e) => e.stopPropagation()}>
              <div className="modbus-scaling-dialog-header">
                <div className="modbus-scaling-dialog-title-box">
                  <span className="modbus-scaling-dialog-icon">📐</span>
                  <div>
                    <div className="modbus-scaling-dialog-title">{intl.get('DEV_DISPLAY_SCALING') || 'Display Scaling'}</div>
                    <div className="modbus-scaling-dialog-subtitle">
                      {intl.get('DEV_CHANNEL_LABEL') || 'Channel:'} <strong>{selectedModbusChannel.name || `Channel ${selectedScalingIdx + 1}`}</strong>
                      {selectedModbusChannel.unit ? ` (${selectedModbusChannel.unit})` : ''} • {intl.get('DEV_REG_ADDR_LABEL') || 'Reg Addr:'} <code>0x{(selectedModbusChannel.regAddr ?? 0).toString(16).toUpperCase().padStart(4, '0')}</code>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="modbus-scaling-dialog-close"
                  onClick={() => setSelectedScalingIdx(null)}
                  title={intl.get('DEV_CLOSE_DIALOG') || "Close dialog"}
                >
                  ✕
                </button>
              </div>

              <div className="modbus-scaling-dialog-body">
                {/* Mathematical concept explanation */}
                <div className="modbus-scaling-concept-card">
                  <div className="concept-math">
                    <span>{intl.get('DEV_FORMULA_LABEL') || 'Formula:'}</span>
                    <code>y = a₁ · x + a₀</code>
                  </div>
                  <div className="concept-desc">
                    {intl.get('DEV_SCALING_CONCEPT_PART1') || 'Two-point linear calibration mapping raw '}<strong>{intl.get('DEV_INPUT_RANGE_X') || 'Input Range (X)'}</strong>{intl.get('DEV_SCALING_CONCEPT_PART2') || ' to scaled '}<strong>{intl.get('DEV_DISPLAY_OUTPUT_Y') || 'Display Output (Y)'}</strong>.
                  </div>
                </div>

                {/* 2-Point Table Grid */}
                <div className="modbus-scaling-grid-table">
                  <div className="modbus-grid-col-header">
                    <span>{intl.get('DEV_CALIBRATION_POINT') || 'Calibration Point'}</span>
                    <span>{intl.get('DEV_INPUT_RANGE_X') || 'Input Range (X)'} <small>{intl.get('DEV_SENSOR_RAW_SIGNAL') || 'Sensor / Raw Signal'}</small></span>
                    <span></span>
                    <span>{intl.get('DEV_DISPLAY_SCALING_Y') || 'Display Scaling (Y)'} <small>{intl.get('DEV_ENGINEERING_VALUE') || 'Engineering Value'}</small></span>
                  </div>

                  {/* Low Point (X0 -> Y0) */}
                  <div className="modbus-grid-row">
                    <div className="grid-point-tag low">{intl.get('DEV_LOW_0') || 'Low (0)'}</div>
                    <div className="grid-input-wrapper">
                      <input
                        type="number"
                        step="any"
                        className="grid-input"
                        value={selectedModbusChannel.x0 !== undefined ? selectedModbusChannel.x0 : 0}
                        onChange={(e) => handleUpdateChannel2Point(selectedScalingIdx, { x0: e.target.value })}
                        placeholder="0"
                        disabled={loading}
                      />
                    </div>
                    <div className="grid-arrow">➔</div>
                    <div className="grid-input-wrapper with-unit">
                      <input
                        type="number"
                        step="any"
                        className="grid-input"
                        value={selectedModbusChannel.y0 !== undefined ? selectedModbusChannel.y0 : 0}
                        onChange={(e) => handleUpdateChannel2Point(selectedScalingIdx, { y0: e.target.value })}
                        placeholder="0"
                        disabled={loading}
                      />
                      <span className="grid-unit-badge">{selectedModbusChannel.unit || '--'}</span>
                    </div>
                  </div>

                  {/* High Point (X1 -> Y1) */}
                  <div className="modbus-grid-row">
                    <div className="grid-point-tag high">{intl.get('DEV_HIGH_1') || 'High (1)'}</div>
                    <div className="grid-input-wrapper">
                      <input
                        type="number"
                        step="any"
                        className="grid-input"
                        value={selectedModbusChannel.x1 !== undefined ? selectedModbusChannel.x1 : 1}
                        onChange={(e) => handleUpdateChannel2Point(selectedScalingIdx, { x1: e.target.value })}
                        placeholder="1"
                        disabled={loading}
                      />
                    </div>
                    <div className="grid-arrow">➔</div>
                    <div className="grid-input-wrapper with-unit">
                      <input
                        type="number"
                        step="any"
                        className="grid-input"
                        value={selectedModbusChannel.y1 !== undefined ? selectedModbusChannel.y1 : 1}
                        onChange={(e) => handleUpdateChannel2Point(selectedScalingIdx, { y1: e.target.value })}
                        placeholder="1"
                        disabled={loading}
                      />
                      <span className="grid-unit-badge">{selectedModbusChannel.unit || '--'}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="modbus-scaling-presets-section">
                  <div className="modbus-preset-header">{intl.get('DEV_QUICK_PRESETS') || 'Quick Presets:'}</div>
                  <div className="modbus-scaling-presets-pills">
                    <button
                      type="button"
                      className={`scaling-pill-btn ${isPresetActive('direct') ? 'active' : ''}`}
                      onClick={() => handleApplyScalingPreset(selectedScalingIdx, 'direct')}
                      title={intl.get('DEV_PRESET_DIRECT_TITLE') || "Direct 1:1 passthrough (no scaling)"}
                    >
                      {intl.get('DEV_PRESET_1_1_DIRECT') || '1:1 Direct'}
                    </button>
                    <button
                      type="button"
                      className={`scaling-pill-btn ${isPresetActive('4_20ma') ? 'active' : ''}`}
                      onClick={() => handleApplyScalingPreset(selectedScalingIdx, '4_20ma')}
                      title={intl.get('DEV_PRESET_4_20MA_TITLE') || "Current loop: 4-20 mA input"}
                    >
                      4 - 20 mA
                    </button>
                    <button
                      type="button"
                      className={`scaling-pill-btn ${isPresetActive('0_20ma') ? 'active' : ''}`}
                      onClick={() => handleApplyScalingPreset(selectedScalingIdx, '0_20ma')}
                      title={intl.get('DEV_PRESET_0_20MA_TITLE') || "Current loop: 0-20 mA input"}
                    >
                      0 - 20 mA
                    </button>
                    <button
                      type="button"
                      className={`scaling-pill-btn ${isPresetActive('0_10v') ? 'active' : ''}`}
                      onClick={() => handleApplyScalingPreset(selectedScalingIdx, '0_10v')}
                      title={intl.get('DEV_PRESET_0_10V_TITLE') || "Voltage signal: 0-10 V input"}
                    >
                      0 - 10 V
                    </button>
                    <button
                      type="button"
                      className={`scaling-pill-btn ${isPresetActive('0_10000') ? 'active' : ''}`}
                      onClick={() => handleApplyScalingPreset(selectedScalingIdx, '0_10000')}
                      title={intl.get('DEV_PRESET_0_10000_TITLE') || "Raw integer register counts: 0 to 10,000"}
                    >
                      0 - 10,000
                    </button>
                    <button
                      type="button"
                      className={`scaling-pill-btn ${isPresetActive('0_65535') ? 'active' : ''}`}
                      onClick={() => handleApplyScalingPreset(selectedScalingIdx, '0_65535')}
                      title={intl.get('DEV_PRESET_0_65535_TITLE') || "16-bit UINT register counts: 0 to 65,535"}
                    >
                      0 - 65,535
                    </button>
                    <button
                      type="button"
                      className={`scaling-pill-btn ${isPresetActive('div_10') ? 'active' : ''}`}
                      onClick={() => handleApplyScalingPreset(selectedScalingIdx, 'div_10')}
                      title={intl.get('DEV_PRESET_DIV_10_TITLE') || "Divide raw register by 10 (0.1×)"}
                    >
                      0.1 (÷10)
                    </button>
                    <button
                      type="button"
                      className={`scaling-pill-btn ${isPresetActive('div_100') ? 'active' : ''}`}
                      onClick={() => handleApplyScalingPreset(selectedScalingIdx, 'div_100')}
                      title={intl.get('DEV_PRESET_DIV_100_TITLE') || "Divide raw register by 100 (0.01×)"}
                    >
                      0.01 (÷100)
                    </button>
                    <button
                      type="button"
                      className={`scaling-pill-btn ${isPresetActive('div_1000') ? 'active' : ''}`}
                      onClick={() => handleApplyScalingPreset(selectedScalingIdx, 'div_1000')}
                      title={intl.get('DEV_PRESET_DIV_1000_TITLE') || "Divide raw register by 1,000 (0.001×)"}
                    >
                      0.001 (÷1000)
                    </button>
                  </div>
                </div>

                {/* Derived Parameters & Live Verification */}
                <div className="modbus-scaling-calc-box">
                  <div className="calc-details-col">
                    <span className="calc-label">{intl.get('DEV_CALCULATED_PARAMETERS') || 'Calculated Parameters:'}</span>
                    <div className="calc-pills">
                      <span>{intl.get('DEV_SLOPE_A1') || 'a₁ (Slope):'} <strong>{formatCoeff(selectedModbusChannel.a1, 1)}</strong></span>
                      <span>{intl.get('DEV_OFFSET_A0') || 'a₀ (Offset):'} <strong>{formatCoeff(selectedModbusChannel.a0, 0)}</strong></span>
                    </div>
                  </div>
                  <div className="calc-test-col">
                    <span className="calc-label">{intl.get('DEV_INTERACTIVE_TEST_CONVERSION') || 'Interactive Test Conversion:'}</span>
                    <div className="calc-test-row">
                      <span className="calc-test-prefix">{intl.get('DEV_RAW_X_LABEL') || 'Raw X:'}</span>
                      <input
                        type="number"
                        step="any"
                        className="calc-test-input"
                        value={scalingTestInput}
                        onChange={(e) => setScalingTestInput(e.target.value)}
                        placeholder="1000"
                      />
                      <span className="calc-test-arrow">➔</span>
                      <span className="calc-test-result">
                        {((parseFloat(scalingTestInput) || 0) * (selectedModbusChannel.a1 ?? 1.0) + (selectedModbusChannel.a0 ?? 0.0)).toFixed(selectedModbusChannel.resolution ?? 2)} {selectedModbusChannel.unit || ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modbus-scaling-dialog-footer">
                <button
                  type="button"
                  className="scaling-dialog-btn-secondary"
                  onClick={() => handleResetChannelScaling(selectedScalingIdx)}
                  title={intl.get('DEV_RESET_SCALING_TITLE') || "Reset back to 1:1 direct passthrough"}
                >
                  {intl.get('DEV_RESET_TO_1_1') || 'Reset to 1:1'}
                </button>
                <button
                  type="button"
                  className="scaling-dialog-btn-primary"
                  onClick={() => setSelectedScalingIdx(null)}
                >
                  {intl.get('DEV_DONE') || 'Done'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Channel scan warning confirmation dialog */}
        {showAutoDetectConfirm && (
          <div className="modbus-confirm-overlay" onClick={() => setShowAutoDetectConfirm(false)}>
            <div className="modbus-confirm-card" onClick={(e) => e.stopPropagation()}>
              <div className="modbus-confirm-icon">⚠️</div>
              <div className="modbus-confirm-title">{intl.get('DEV_REPLACE_CHANNELS_TITLE') || 'Replace Current Channels?'}</div>
              <div className="modbus-confirm-msg">
                <p style={{ margin: '0 0 10px 0' }}>
                  {intl.get('DEV_REPLACE_CHANNELS_MSG_PART1', { count: modbusChannels.length, plural: modbusChannels.length === 1 ? '' : 's' }) || `Scanning will clear the current channel list (${modbusChannels.length} channel${modbusChannels.length === 1 ? '' : 's'}) and query `}
                  <strong>{modbusHost || (intl.get('DEV_THE_DEVICE') || 'the device')}</strong>
                  {intl.get('DEV_REPLACE_CHANNELS_MSG_PART2') || ' to discover channels.'}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px', lineHeight: 1.45, textAlign: 'left' }}>
                  ℹ️ <strong>{intl.get('DEV_NOTE_LABEL') || 'Note:'}</strong> {intl.get('DEV_REPLACE_CHANNELS_NOTE') || 'Auto-fetching channel structures is only supported on certain SUTO devices and gateways with built-in metadata support. Standard 3rd-party Modbus devices should be configured manually using \u201cAdd Channel\u201d.'}
                </p>
              </div>
              <div className="modbus-confirm-actions">
                <button
                  type="button"
                  className="modbus-confirm-cancel-btn"
                  onClick={() => setShowAutoDetectConfirm(false)}
                >
                  {intl.get('CANCEL') || 'Cancel'}
                </button>
                <button
                  type="button"
                  className="modbus-confirm-proceed-btn"
                  onClick={executeAutoDetect}
                >
                  {intl.get('DEV_YES_SCAN_CHANNELS') || 'Yes, Scan Channels'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
