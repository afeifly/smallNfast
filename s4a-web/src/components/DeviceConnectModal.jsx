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
import './DeviceConnectModal.css';

export default function DeviceConnectModal({
  isOpen,
  onClose,
  onConnected,
  onAddMultipleDevices,
  initialTab,
  initialMode = 'manual'
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
    if (!isNative && tab !== 'ble' && tab !== 'api') {
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
      const port = parseInt(tcpPort, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new Error('Please enter a valid TCP port number (1-65535)');
      }
      const conn = await TauriSutoAPI.connectTcp(tcpHost.trim(), port);
      onConnected(conn);
      onClose();
    } catch (err) {
      console.error('[DeviceConnectModal] TCP connect error:', err);
      setError(err?.message || 'Failed to connect to SUTO Ethernet device. Check IP address and port.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectApi = async () => {
    TauriSutoAPI.logClientEvent('INFO', 'DEVICE', `Connect requested: WebAPI (S332) ${apiHost}:8080`);
    setLoading(true);
    setError(null);
    try {
      const conn = await TauriSutoAPI.connectApi(apiHost.trim(), 8080);
      onConnected(conn);
      onClose();
    } catch (err) {
      console.error('[DeviceConnectModal] WebAPI connect error:', err);
      setError(err?.message || 'Failed to connect to S332 WebAPI device. Check IP address and network connection.');
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
            if (prev.some(d => d.ip === dev.ip)) return prev;
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
              if (prev.some(d => d.ip === dev.ip)) return prev;
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
                      : 'Click "Auto Detect (Broadcast)" above to discover SUTO devices on the network.'}
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
              <div className="lan-bottom-action-bar">
                <button
                  type="button"
                  className="connect-action-btn"
                  style={{ width: '100%', margin: 0 }}
                  onClick={handleGetSensors}
                  disabled={loading || lanSelectedIds.size === 0}
                >
                  {loading ? 'Retrieving Sensors...' : `📥 Get Sensors (${lanSelectedIds.size} Device${lanSelectedIds.size === 1 ? '' : 's'})`}
                </button>
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
              <label className="form-label">S332 IP Address / Host</label>
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
          <button
            className="connect-action-btn"
            style={{ marginTop: '20px' }}
            onClick={isTcp ? handleConnectTcp : handleConnectApi}
            disabled={loading || (isTcp ? !tcpHost.trim() : !apiHost.trim())}
          >
            {loading ? 'Connecting...' : (isTcp ? '🌐 Connect via Ethernet TCP' : '⚡ Connect to S332')}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="device-connect-overlay">
      <div className="device-connect-modal">
        {/* Header */}
        <div className="device-connect-header">
          <div>
            <h3>Connect SUTO Hardware</h3>
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
                <span>S332 API</span>
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

        {/* Platform Distinction Note */}
        <div className="platform-diff-note">
          {isNative ? (
            <p>
              ⚡ <strong>Native Hardware Engine:</strong> Direct low-level {isMobile ? 'USB OTG' : 'Direct USB'}, Bluetooth Low Energy (BLE), Ethernet TCP, and S332 API communicate directly with sensors.
            </p>
          ) : (
            <p>
              🌐 <strong>Web Browser Mode:</strong> Direct wireless sensor monitoring via <strong>Web Bluetooth</strong>. Low-level USB, Ethernet TCP, and local S332 API communication are available in the S4A Desktop App.
            </p>
          )}
        </div>

        {/* Tab Body */}
        <div className="device-connect-body">
          {tab === 'usb' && (
            <>
              <p className="tab-desc">
                {isMobile
                  ? 'Connect via USB-C OTG cable to SUTO sensor. When prompted, tap "OK" to grant USB permission.'
                  : 'Direct driver connection. Automatically scans for connected sensor.'}
              </p>
              <button
                className="connect-action-btn"
                onClick={handleConnectUsb}
                disabled={loading}
              >
                {loading ? 'Connecting via USB...' : (isMobile ? '🔌 Detect & Connect USB OTG' : '🔌 Detect & Connect USB')}
              </button>
            </>
          )}

          {tab === 'tcp' && renderEthernetSection(true)}

          {tab === 'ble' && (
            <>
              <p className="tab-desc">
                {isNative
                  ? 'Connect wirelessly to SUTO Bluetooth Low Energy sensors (e.g. S401 / S421 / S461 / S520) via native Bluetooth.'
                  : (
                    <>Connect wirelessly to SUTO Bluetooth Low Energy sensors (e.g. S401 / S421 / S520) via browser <strong>Web Bluetooth</strong>.</>
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
                    : 'Default: Filtered by SUTO hardware services for quick selection.'}
                </div>
              </div>

              {isNative ? (
                <>
                  <button
                    className="connect-action-btn"
                    onClick={handleScanBle}
                    disabled={loading || scanningBle}
                  >
                    {scanningBle
                      ? '📡 Scanning nearby devices (3s)...'
                      : (showAllBle ? '📶 Scan All BLE Devices' : '📶 Scan SUTO BLE Sensors')}
                  </button>

                  {bleDevices.length > 0 && (
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
                                {dev.is_suto && <span className="suto-pill">SUTO</span>}
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

                  {hasScannedBle && bleDevices.length === 0 && !scanningBle && (
                    <div className="ble-empty-notice">
                      No nearby BLE sensors found. Make sure the SUTO sensor is powered on, Bluetooth is broadcasting, and try scanning again.
                    </div>
                  )}
                </>
              ) : (
                <button
                  className="connect-action-btn"
                  onClick={handleConnectBle}
                  disabled={loading || !BleSutoAPI.isSupported()}
                >
                  {loading ? 'Pairing Bluetooth...' : (showAllBle ? '📶 Scan All BLE Devices' : '📶 Scan SUTO BLE Sensors')}
                </button>
              )}
            </>
          )}

          {tab === 'api' && renderEthernetSection(false)}
        </div>
      </div>
    </div>
  );
}
