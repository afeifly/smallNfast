import React, { useState, useEffect, useRef } from 'react';
import TauriSutoAPI from '../api/TauriSutoAPI';
import BleSutoAPI from '../api/BleSutoAPI';
import { checkIsNative, isMobile } from '../util/platform';
import {
  getDefaultSubnet,
  scanLanRange,
  discoverDevicesViaBroadcast,
  convertDiscoveredToSensorManagerDevice
} from '../api/lanScanner';
import { buildModbusDevice } from '../modules/processscape/engine/sensorManagerStorage';
import { MODBUS_DATA_TYPES, normalizeModbusDataType } from '../api/modbusProtocol';
import './DeviceConnectModal.css';

const MODBUS_PRESETS = {
  custom: {
    label: 'Custom Channel Configuration',
    name: 'Modbus Device',
    channels: [
      { id: 1, name: 'Channel 1', unit: 'm³/h', funcCode: 3, regAddr: 0, dataType: 8, a1: 1.0, a0: 0.0 }
    ]
  },
  s401_flow: {
    label: 'Flow, Velocity & Consumption (m³/h, m/s, m³)',
    name: 'Flow Meter',
    channels: [
      { id: 1, name: 'Flow', unit: 'm³/h', funcCode: 3, regAddr: 0, dataType: 8, a1: 1.0, a0: 0.0 },
      { id: 2, name: 'Velocity', unit: 'm/s', funcCode: 3, regAddr: 2, dataType: 8, a1: 1.0, a0: 0.0 },
      { id: 3, name: 'Consumption', unit: 'm³', funcCode: 3, regAddr: 4, dataType: 8, a1: 1.0, a0: 0.0 }
    ]
  },
  s520_dew: {
    label: 'Dew Point & Pressure (°C, bar)',
    name: 'Dew Point Sensor',
    channels: [
      { id: 1, name: 'Dew Point', unit: '°C', funcCode: 3, regAddr: 0, dataType: 7, a1: 1.0, a0: 0.0 },
      { id: 2, name: 'Pressure', unit: 'bar', funcCode: 3, regAddr: 2, dataType: 7, a1: 1.0, a0: 0.0 }
    ]
  },
  power_meter: {
    label: 'Generic 3-Phase Power Meter (V, A, kW, kWh)',
    name: 'Power Meter',
    channels: [
      { id: 1, name: 'Voltage', unit: 'V', funcCode: 3, regAddr: 0, dataType: 7, a1: 1.0, a0: 0.0 },
      { id: 2, name: 'Current', unit: 'A', funcCode: 3, regAddr: 2, dataType: 7, a1: 1.0, a0: 0.0 },
      { id: 3, name: 'Active Power', unit: 'kW', funcCode: 3, regAddr: 4, dataType: 7, a1: 1.0, a0: 0.0 },
      { id: 4, name: 'Total Energy', unit: 'kWh', funcCode: 3, regAddr: 6, dataType: 7, a1: 1.0, a0: 0.0 }
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
  const [tab, setTab] = useState(initialTab || (isMobile ? 'ble' : (isNative ? 'usb' : 'ble'))); // 'usb' | 'tcp' | 'ble' | 'api'
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
  const [modbusPreset, setModbusPreset] = useState('s401_flow');
  const [modbusChannels, setModbusChannels] = useState(() => MODBUS_PRESETS.s401_flow.channels.map(c => ({ ...c })));
  const [modbusTestResults, setModbusTestResults] = useState(null);
  const [modbusTesting, setModbusTesting] = useState(false);
  const [modbusDiscovering, setModbusDiscovering] = useState(false);
  const [modbusDiscoverStatus, setModbusDiscoverStatus] = useState('');
  const [showAutoDetectConfirm, setShowAutoDetectConfirm] = useState(false);

  const handleDeleteDetectedSuto = () => {
    setDetectedSutoInfo(null);
    setModbusChannels(MODBUS_PRESETS.s401_flow.channels.map(c => ({ ...c })));
    setModbusName('Modbus Device');
    setModbusTestResults(null);
    setSelectedScalingIdx(null);
    setError(null);
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
    setModbusDiscoverStatus('Detecting device...');
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
        const model = res.deviceInfo?.model || 'Device';
        const serial = res.deviceInfo?.serial ? ` (${res.deviceInfo.serial})` : '';
        setModbusName(`${model}${serial}`);
        return res;
      } else {
        setError(`No device or active channels found on ${isRtu ? modbusSerialPort : `${modbusHost}:${port}`} (Slave ID: ${slaveId}). Check connection or add channels manually.`);
        return null;
      }
    } catch (err) {
      console.error('[DeviceConnectModal] Discovery error:', err);
      setError('Detection Failed: ' + (err?.message || err));
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
        funcCode: 3,
        regAddr: nextReg,
        dataType: 8,
        a1: 1.0,
        a0: 0.0
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
        : (modbusSlaveId ? (parseInt(modbusSlaveId, 10) || 0) : 0);

      for (const ch of modbusChannels) {
        const res = await TauriSutoAPI.readModbusChannel(ch, {
          host: isRtu ? null : modbusHost.trim(),
          port: isRtu ? null : port,
          serialPort: isRtu ? modbusSerialPort.trim() : null,
          baudRate: isRtu ? (parseInt(modbusBaudRate, 10) || 19200) : null,
          parity: isRtu ? modbusParity : null,
          slaveId,
          isRtu
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
      setError('Modbus Test Failed: ' + (err?.message || err));
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
        setError('No channels configured to connect. Add channels or click Auto-Detect.');
        setLoading(false);
        return;
      }

      const defaultName = devModel
        ? `${devModel}${devSerial ? ` (${devSerial})` : ''}`
        : (isRtu ? `Modbus RTU (${modbusSerialPort})` : `Modbus TCP (${modbusHost}:${port})`);
      const name = modbusName.trim() || defaultName;

      const devItem = buildModbusDevice({
        name,
        model: devModel,
        serial: devSerial,
        softwareVersion: detectedSutoInfo?.softwareVersion || null,
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
        name,
        serial: devSerial,
        clearOthers: singleDeviceMode,
        channels: devItem.sensors[0]?.channels || []
      });

      if (typeof onConnected === 'function') {
        onConnected({
          ...conn,
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
      if (initialTab) {
        setTab(initialTab);
      } else {
        setTab(isMobile ? 'ble' : (isNative ? 'usb' : 'ble'));
      }
      if (initialMode) {
        setLanDetectMode(initialMode);
      }
      setError(null);
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
      onConnected(conn);
      onClose();
    } catch (err) {
      console.error('[DeviceConnectModal] USB connect error:', err);
      const msg = typeof err === 'string' ? err : (err?.message || 'Failed to connect via USB. Please verify cable.');
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
        throw new Error('Please enter a valid TCP port number (1-65535)');
      }
      const conn = await TauriSutoAPI.connectTcp(tcpHost.trim(), port);
      onConnected(conn);
      onClose();
    } catch (err) {
      console.error('[DeviceConnectModal] TCP connect error:', err);
      setError(err?.message || 'Failed to connect to Ethernet device. Check IP address and port.');
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
      onConnected(conn);
      onClose();
    } catch (err) {
      console.error('[DeviceConnectModal] WebAPI connect error:', err);
      setError(err?.message || 'Failed to connect to WebAPI device. Check IP address and network connection.');
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
    setLanProgress({ scanned: 0, total: 1, percent: 30, currentIp: 'Broadcasting on UDP port 8800...' });

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
        currentIp: 'Complete'
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
      setError(err?.message || 'Failed to get sensors from selected devices.');
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
      const msg = typeof err === 'string' ? err : (err?.message || 'Failed to scan Bluetooth devices. Ensure Bluetooth is enabled.');
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
      onConnected(conn);
      onClose();
    } catch (err) {
      console.error('[DeviceConnectModal] BLE connect error:', err);
      const msg = typeof err === 'string' ? err : (err?.message || `Failed to connect to ${dev.name}.`);
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
      onConnected(conn);
      onClose();
    } catch (err) {
      console.error('[DeviceConnectModal] BLE connect error:', err);
      const msg = typeof err === 'string' ? err : (err?.message || 'Bluetooth connection cancelled or failed.');
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
          🔍 Auto Detect
        </button>
        <button
          type="button"
          className={`lan-detect-mode-btn ${lanDetectMode === 'manual' ? 'active' : ''}`}
          onClick={() => setLanDetectMode('manual')}
        >
          ✏️ Manual IP Input
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
                  <span>Broadcasting &amp; Listening (Port 8800)...</span>
                </>
              ) : (
                <>
                  <span>📡 Auto Detect (Broadcast)</span>
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
                <span>{lanProgress.currentIp || 'Broadcasting on LAN...'}</span>
                <span>{lanDiscovered.length} found</span>
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
                <span>Select All ({lanDiscovered.length})</span>
              </label>
              <span className="lan-discovered-count">
                {lanSelectedIds.size} of {lanDiscovered.length} selected
              </span>
            </div>

            <div className="lan-devices-list">
              {lanDiscovered.length === 0 ? (
                <div className="lan-empty-box">
                  <div style={{ fontSize: 24, marginBottom: 4 }}>📡</div>
                  <div style={{ fontWeight: 600, color: '#334155', marginBottom: 2 }}>
                    {lanScanning ? 'Broadcasting & waiting for devices...' : 'No Devices Discovered'}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {lanScanning
                      ? 'Listening on UDP port 8800. Responding devices will appear automatically.'
                      : 'Click "Auto Detect (Broadcast)" above to discover devices on the network.'}
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
                              {dev.channelsCount} Channels
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="lan-device-status">
                        <span className="lan-status-dot" />
                        <span>Online</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {lanDiscovered.length > 0 && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                {lanSelectedIds.size} of {lanDiscovered.length} device(s) selected
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="lan-manual-section">
          {isTcp ? (
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
              <div className="form-group" style={{ flex: 3 }}>
                <label className="form-label">Device IP Address / Host</label>
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
                <label className="form-label">Port</label>
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
              <label className="form-label">WebAPI IP Address / Host</label>
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
          <div className="modbus-grid-row">
            <div className="form-group" style={{ flex: 1.6 }}>
              <label className="form-label">Device Name</label>
              <input
                type="text"
                className="form-input"
                value={modbusName}
                onChange={(e) => setModbusName(e.target.value)}
                placeholder="Modbus TCP Device"
                disabled={loading}
              />
            </div>
            <div className="form-group" style={{ flex: 1.6 }}>
              <label className="form-label">Host IP / Address</label>
              <input
                type="text"
                className="form-input"
                value={modbusHost}
                onChange={(e) => setModbusHost(e.target.value)}
                placeholder="192.168.1.100"
                disabled={loading}
              />
            </div>
            <div className="form-group" style={{ flex: 0.9 }}>
              <label className="form-label">Port</label>
              <input
                type="number"
                className="form-input"
                value={modbusPort}
                onChange={(e) => setModbusPort(e.target.value)}
                placeholder="502"
                disabled={loading}
              />
            </div>
            <div className="form-group" style={{ flex: 0.9 }}>
              <label className="form-label" title="Unit ID / Slave ID (default: 1)">
                Unit ID <span style={{ fontSize: 10, color: '#94a3b8' }}>(Opt)</span>
              </label>
              <input
                type="number"
                className="form-input"
                value={modbusSlaveId}
                onChange={(e) => setModbusSlaveId(e.target.value)}
                placeholder="1"
                min="0"
                max="255"
                disabled={loading}
              />
            </div>
          </div>
        ) : (
          <div className="modbus-grid-row">
            <div className="form-group" style={{ flex: 1.4 }}>
              <label className="form-label">Device Name</label>
              <input
                type="text"
                className="form-input"
                value={modbusName}
                onChange={(e) => setModbusName(e.target.value)}
                placeholder="Modbus RTU Device"
                disabled={loading}
              />
            </div>
            <div className="form-group" style={{ flex: 1.2 }}>
              <label className="form-label">Serial / COM Port</label>
              <input
                type="text"
                className="form-input"
                value={modbusSerialPort}
                onChange={(e) => setModbusSerialPort(e.target.value)}
                placeholder="COM1 or /dev/ttyUSB0"
                disabled={loading}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Baud Rate</label>
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
              <label className="form-label">Slave Address</label>
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
              <label className="form-label">Parity</label>
              <select
                className="form-input"
                value={modbusParity}
                onChange={(e) => setModbusParity(e.target.value)}
                disabled={loading}
              >
                <option value="none">None (8N1)</option>
                <option value="even">Even (8E1)</option>
                <option value="odd">Odd (8O1)</option>
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
                  <span className="dot"></span> Detected Device
                </span>
                <span className="suto-detected-title">{detectedSutoInfo.model}</span>
              </div>
              <button
                type="button"
                className="suto-delete-btn"
                onClick={handleDeleteDetectedSuto}
                disabled={loading || modbusDiscovering}
                title="Delete detected device and configure custom/3rd-party channels"
              >
                🗑️ Delete
              </button>
            </div>

            <div className="suto-meta-chips">
              <div className="suto-chip">
                <span>Serial No:</span>
                <strong>{detectedSutoInfo.serial}</strong>
              </div>
              <div className="suto-chip">
                <span>Firmware:</span>
                <strong>v{detectedSutoInfo.softwareVersion}</strong>
              </div>
              <div className="suto-chip">
                <span>Bus Version:</span>
                <strong>v{detectedSutoInfo.busVersion}</strong>
              </div>
              <div className="suto-chip">
                <span>Slave Address:</span>
                <strong>{isRtu ? modbusRtuSlaveId : (modbusSlaveId || 1)}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Auto-Discovery Status */}
        {modbusDiscovering && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', color: '#047857', fontSize: '13px', margin: '8px 0' }}>
            <span className="spinner-sm" />
            <span>{modbusDiscoverStatus || 'Detecting device...'}</span>
          </div>
        )}

        {/* Channel List Header & Items */}
        <div className={`modbus-channels-header ${isFixedSuto ? 'fixed-suto-header' : ''}`}>
          <span>Channel Name</span>
          <span>Unit</span>
          <span>Func Code</span>
          <span>Reg Addr</span>
          <span>Data Type</span>
          {!isFixedSuto && <span style={{ textAlign: 'center' }}>Scaling Range</span>}
          {!isFixedSuto && <span></span>}
        </div>

        <div className="modbus-channels-container">
          {modbusChannels.map((ch, idx) => {
            const hasCustomScaling = (ch.a1 !== 1 && ch.a1 !== undefined) || (ch.a0 !== 0 && ch.a0 !== undefined);
            const isRowSelected = selectedScalingIdx === idx;

            return (
              <div key={ch.id || idx} className={`modbus-channel-row ${isRowSelected ? 'selected-scaling-row' : ''} ${isFixedSuto ? 'fixed-suto-row' : ''}`}>
                <input
                  type="text"
                  className="modbus-input-sm"
                  value={ch.name}
                  onChange={(e) => handleUpdateModbusChannel(idx, 'name', e.target.value)}
                  placeholder="Name"
                  disabled={loading}
                />
                <input
                  type="text"
                  className="modbus-input-sm"
                  value={ch.unit}
                  onChange={(e) => handleUpdateModbusChannel(idx, 'unit', e.target.value)}
                  placeholder="Unit"
                  disabled={loading || isFixedSuto}
                  readOnly={isFixedSuto}
                />
                <select
                  className="modbus-input-sm"
                  value={ch.funcCode}
                  onChange={(e) => handleUpdateModbusChannel(idx, 'funcCode', parseInt(e.target.value, 10))}
                  disabled={loading || isFixedSuto}
                >
                  <option value={3}>FC 03 (Holding)</option>
                  <option value={4}>FC 04 (Input)</option>
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
                    onClick={() => setSelectedScalingIdx(isRowSelected ? null : idx)}
                    title="Click to view/edit scaling range and calibration formula"
                  >
                    <span>{hasCustomScaling ? `${ch.a1}x ${ch.a0 >= 0 ? '+' : ''}${ch.a0}` : '1:1 (Direct)'}</span>
                    <span className="modbus-scaling-gear">⚙️</span>
                  </button>
                )}

                {!isFixedSuto && (
                  <button
                    type="button"
                    className="modbus-del-btn"
                    onClick={() => handleDeleteModbusChannel(idx)}
                    title="Delete channel"
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
              <span>+</span> Add Channel
            </button>
          )}
          <button
            type="button"
            className="modbus-add-ch-btn"
            onClick={handleTestModbusChannels}
            disabled={loading || modbusTesting || modbusChannels.length === 0}
            title="Read current values from configured registers"
          >
            {modbusTesting ? '⏳ Testing Read...' : '🔍 Test Read'}
          </button>
        </div>

        {/* Selected Channel Scaling Range Editor Panel (Only for custom/3rd-party channels) */}
        {!isFixedSuto && selectedChannel && (
          <div className="modbus-scaling-panel">
            <div className="modbus-scaling-header">
              <div className="modbus-scaling-title">
                <span className="modbus-scaling-icon">⚙️</span>
                <strong>Scaling Range &amp; Calibration:</strong>
                <span className="modbus-scaling-ch-tag">
                  {selectedChannel.name || `Channel ${selectedScalingIdx + 1}`} ({selectedChannel.unit || 'No unit'})
                </span>
              </div>
              <button
                type="button"
                className="modbus-scaling-close"
                onClick={() => setSelectedScalingIdx(null)}
                title="Close scaling editor"
              >
                ✕
              </button>
            </div>

            <div className="modbus-scaling-body">
              <div className="modbus-scaling-formula-row">
                <span className="modbus-formula-tag">y = a₁ · x + a₀</span>
                <span className="modbus-formula-desc">Multiplies the raw register reading by <strong>a₁</strong>, then adds offset <strong>a₀</strong>.</span>
              </div>

              <div className="modbus-scaling-inputs">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Scale Factor (a₁)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={selectedChannel.a1}
                    onChange={(e) => handleUpdateModbusChannel(selectedScalingIdx, 'a1', parseFloat(e.target.value) || 0)}
                    placeholder="1.0"
                    disabled={loading}
                  />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Offset (a₀)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={selectedChannel.a0}
                    onChange={(e) => handleUpdateModbusChannel(selectedScalingIdx, 'a0', parseFloat(e.target.value) || 0)}
                    placeholder="0.0"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="modbus-scaling-presets">
                <span className="modbus-preset-hint">Quick Presets:</span>
                <button
                  type="button"
                  className={`scaling-pill-btn ${selectedChannel.a1 === 1 && selectedChannel.a0 === 0 ? 'active' : ''}`}
                  onClick={() => {
                    handleUpdateModbusChannel(selectedScalingIdx, 'a1', 1.0);
                    handleUpdateModbusChannel(selectedScalingIdx, 'a0', 0.0);
                  }}
                >
                  1:1 Direct
                </button>
                <button
                  type="button"
                  className={`scaling-pill-btn ${selectedChannel.a1 === 0.1 && selectedChannel.a0 === 0 ? 'active' : ''}`}
                  onClick={() => {
                    handleUpdateModbusChannel(selectedScalingIdx, 'a1', 0.1);
                    handleUpdateModbusChannel(selectedScalingIdx, 'a0', 0.0);
                  }}
                >
                  0.1 (÷10)
                </button>
                <button
                  type="button"
                  className={`scaling-pill-btn ${selectedChannel.a1 === 0.01 && selectedChannel.a0 === 0 ? 'active' : ''}`}
                  onClick={() => {
                    handleUpdateModbusChannel(selectedScalingIdx, 'a1', 0.01);
                    handleUpdateModbusChannel(selectedScalingIdx, 'a0', 0.0);
                  }}
                >
                  0.01 (÷100)
                </button>
                <button
                  type="button"
                  className={`scaling-pill-btn ${selectedChannel.a1 === 0.001 && selectedChannel.a0 === 0 ? 'active' : ''}`}
                  onClick={() => {
                    handleUpdateModbusChannel(selectedScalingIdx, 'a1', 0.001);
                    handleUpdateModbusChannel(selectedScalingIdx, 'a0', 0.0);
                  }}
                >
                  0.001 (÷1000)
                </button>
                <button
                  type="button"
                  className={`scaling-pill-btn ${selectedChannel.a1 === 10 && selectedChannel.a0 === 0 ? 'active' : ''}`}
                  onClick={() => {
                    handleUpdateModbusChannel(selectedScalingIdx, 'a1', 10.0);
                    handleUpdateModbusChannel(selectedScalingIdx, 'a0', 0.0);
                  }}
                >
                  10 (×10)
                </button>
                <button
                  type="button"
                  className={`scaling-pill-btn ${selectedChannel.a1 === 100 && selectedChannel.a0 === 0 ? 'active' : ''}`}
                  onClick={() => {
                    handleUpdateModbusChannel(selectedScalingIdx, 'a1', 100.0);
                    handleUpdateModbusChannel(selectedScalingIdx, 'a0', 0.0);
                  }}
                >
                  100 (×100)
                </button>
              </div>

              {/* Live Preview */}
              <div className="modbus-scaling-preview">
                <span>Scaling Result Preview:</span>
                <code>
                  Raw 1000 → {((1000 * (selectedChannel.a1 ?? 1.0)) + (selectedChannel.a0 ?? 0.0)).toFixed(2)} {selectedChannel.unit || ''}
                </code>
              </div>
            </div>
          </div>
        )}

        {/* Test Results Display */}
        {modbusTestResults && (
          <div className="modbus-test-box">
            <div className="modbus-test-header">
              <span>Live Register Read Results:</span>
              <span>{modbusTestResults.filter(r => r.success).length} of {modbusTestResults.length} OK</span>
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
            <h3>Connect Hardware</h3>
            <p>Select your communication medium to initiate live monitoring</p>
          </div>
          <button className="device-connect-close" onClick={onClose}>✕</button>
        </div>

        {/* Medium Selection Tabs */}
        <div className="device-connect-tabs">
          {isNative ? (
            <>
              <button
                className={`modal-tab-btn ${tab === 'usb' ? 'active' : ''}`}
                onClick={() => { setTab('usb'); setError(null); }}
              >
                <span>🔌</span>
                <span>{isMobile ? 'USB OTG' : 'Direct USB'}</span>
              </button>
              <button
                className={`modal-tab-btn ${tab === 'ble' ? 'active' : ''}`}
                onClick={() => { setTab('ble'); setError(null); }}
              >
                <span>📶</span>
                <span>Bluetooth (BLE)</span>
              </button>
              <button
                className={`modal-tab-btn ${tab === 'tcp' ? 'active' : ''}`}
                onClick={() => { setTab('tcp'); setError(null); }}
              >
                <span>🌐</span>
                <span>Ethernet TCP</span>
              </button>
              <button
                className={`modal-tab-btn ${tab === 'api' ? 'active' : ''}`}
                onClick={() => { setTab('api'); setError(null); }}
              >
                <span>⚡</span>
                <span>WebAPI</span>
              </button>
              <button
                className={`modal-tab-btn ${tab === 'modbus' ? 'active' : ''}`}
                onClick={() => { setTab('modbus'); setError(null); }}
              >
                <span>📟</span>
                <span>Modbus (TCP/RTU)</span>
              </button>
            </>
          ) : (
            <>
              <button
                className={`modal-tab-btn ${tab === 'ble' ? 'active' : ''}`}
                onClick={() => { setTab('ble'); setError(null); }}
              >
                <span>📶</span>
                <span>Bluetooth (BLE)</span>
              </button>
            </>
          )}
        </div>

        {/* Tab Body */}
        <div className="device-connect-body">
          {tab === 'usb' && (
            <p className="tab-desc">
              {isMobile
                ? 'Connect via USB-C OTG cable to industrial sensor. When prompted, tap "OK" to grant USB permission.'
                : 'Direct driver connection. Automatically scans for connected sensor.'}
            </p>
          )}

          {tab === 'tcp' && renderEthernetSection(true)}

          {tab === 'ble' && (
            <>
              <p className="tab-desc">
                {isNative
                  ? 'Connect wirelessly to industrial Bluetooth Low Energy (BLE) sensors via native Bluetooth.'
                  : (
                    <>Connect wirelessly to industrial Bluetooth Low Energy (BLE) sensors via browser <strong>Web Bluetooth</strong>.</>
                  )}
              </p>

              <div className="ble-badge-hint">
                <span>ℹ️</span>
                <span>
                  {isNative
                    ? 'Native Bluetooth Low Energy (BLE) engine is active and ready.'
                    : BleSutoAPI.isSupported()
                    ? 'Web Bluetooth is supported in your current browser.'
                    : (BleSutoAPI.getSupportIssue() || 'Web Bluetooth requires Chrome or a Chromium-based browser.')}
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
                  <span>Show all nearby Bluetooth devices (unfiltered)</span>
                </label>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', marginLeft: '24px' }}>
                  {showAllBle
                    ? 'Scanning all nearby Bluetooth devices.'
                    : 'Default: Filtered by compatible sensor hardware services for quick selection.'}
                </div>
              </div>

              {isNative && bleDevices.length > 0 && (
                <div className="ble-device-list">
                  <div className="ble-device-list-header">
                    Discovered BLE Devices ({bleDevices.length}):
                  </div>
                  <div className="ble-device-items">
                    {bleDevices.map((dev) => (
                      <div key={dev.id} className="ble-device-card">
                        <div className="ble-card-left">
                          <div className="ble-card-title">
                            {dev.name || 'Unnamed Sensor'}
                            {dev.is_suto && <span className="suto-pill">Sensor</span>}
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
                            Connect
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isNative && hasScannedBle && bleDevices.length === 0 && !scanningBle && (
                <div className="ble-empty-notice">
                  No nearby BLE sensors found. Make sure the sensor is powered on, Bluetooth is broadcasting, and try scanning again.
                </div>
              )}
            </>
          )}

          {tab === 'api' && renderEthernetSection(false)}
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
            Close
          </button>

          {tab === 'usb' && (
            <button
              className="connect-action-btn"
              onClick={handleConnectUsb}
              disabled={loading}
            >
              {loading ? 'Connecting via USB...' : (isMobile ? '🔌 Detect & Connect USB OTG' : '🔌 Detect & Connect USB')}
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
                {loading ? 'Retrieving Sensors...' : `📥 Get Sensors (${lanSelectedIds.size} Device${lanSelectedIds.size === 1 ? '' : 's'})`}
              </button>
            ) : (
              <button
                type="button"
                className="connect-action-btn"
                onClick={handleConnectTcp}
                disabled={loading || !tcpHost.trim()}
              >
                {loading ? 'Connecting...' : '🌐 Connect via Ethernet TCP'}
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
                {loading ? 'Retrieving Sensors...' : `📥 Get Sensors (${lanSelectedIds.size} Device${lanSelectedIds.size === 1 ? '' : 's'})`}
              </button>
            ) : (
              <button
                type="button"
                className="connect-action-btn"
                onClick={handleConnectApi}
                disabled={loading || !apiHost.trim()}
              >
                {loading ? 'Connecting...' : '⚡ Connect to WebAPI'}
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
                  ? '📡 Scanning nearby devices (3s)...'
                  : (showAllBle ? '📶 Scan All BLE Devices' : '📶 Scan BLE Sensors')}
              </button>
            ) : (
              <button
                type="button"
                className="connect-action-btn"
                onClick={handleConnectBle}
                disabled={loading || !BleSutoAPI.isSupported()}
              >
                {loading ? 'Pairing Bluetooth...' : (showAllBle ? '📶 Scan All BLE Devices' : '📶 Scan BLE Sensors')}
              </button>
            )
          )}

          {tab === 'modbus' && (
            <div className="modbus-footer-btn-group">
              <button
                type="button"
                className="modbus-test-btn"
                onClick={handleDetectSutoDevice}
                disabled={loading || modbusDiscovering || (modbusProtocolType === 'tcp' && !modbusHost) || (modbusProtocolType === 'rtu' && !modbusSerialPort)}
                title="Clear current channels and automatically detect SUTO channels from device firmware"
              >
                {modbusDiscovering && <span className="spinner-sm" style={{ marginRight: '6px' }} />}
                Auto detect(SUTO only)
              </button>
              <button
                type="button"
                className="connect-action-btn"
                onClick={handleConnectModbus}
                disabled={loading || modbusTesting || modbusDiscovering || modbusChannels.length === 0}
              >
                {loading ? 'Connecting...' : 'Connect to device'}
              </button>
            </div>
          )}
        </div>

        {/* Auto-detect warning confirmation dialog */}
        {showAutoDetectConfirm && (
          <div className="modbus-confirm-overlay" onClick={() => setShowAutoDetectConfirm(false)}>
            <div className="modbus-confirm-card" onClick={(e) => e.stopPropagation()}>
              <div className="modbus-confirm-icon">⚠️</div>
              <div className="modbus-confirm-title">Clear Channels &amp; Auto-Detect?</div>
              <div className="modbus-confirm-msg">
                Auto-detect will clear the current channel list ({modbusChannels.length} channel{modbusChannels.length === 1 ? '' : 's'}) and scan the connected SUTO device for channels.
              </div>
              <div className="modbus-confirm-actions">
                <button
                  type="button"
                  className="modbus-confirm-cancel-btn"
                  onClick={() => setShowAutoDetectConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="modbus-confirm-proceed-btn"
                  onClick={executeAutoDetect}
                >
                  Yes, Auto-Detect
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
