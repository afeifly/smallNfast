import React, { useState, useEffect } from 'react';
import TauriSutoAPI from '../api/TauriSutoAPI';
import BleSutoAPI from '../api/BleSutoAPI';
import { checkIsNative, isMobile } from '../util/platform';
import './DeviceConnectModal.css';

export default function DeviceConnectModal({ isOpen, onClose, onConnected }) {
  const isNative = checkIsNative();
  const [tab, setTab] = useState(isMobile ? 'ble' : (isNative ? 'usb' : 'ble')); // 'usb' | 'tcp' | 'ble'
  const [tcpHost, setTcpHost] = useState('192.168.1.100');
  const [tcpPort, setTcpPort] = useState('502');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showAllBle, setShowAllBle] = useState(false);
  const [bleDevices, setBleDevices] = useState([]);
  const [scanningBle, setScanningBle] = useState(false);
  const [hasScannedBle, setHasScannedBle] = useState(false);

  useEffect(() => {
    if (!isNative && tab !== 'ble') {
      setTab('ble');
    }
  }, [isNative, tab]);

  if (!isOpen) return null;

  const handleConnectUsb = async () => {
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
            </>
          ) : (
            <button
              className={`modal-tab-btn ${tab === 'ble' ? 'active' : ''}`}
              onClick={() => { setTab('ble'); setError(null); }}
            >
              <span>📶</span>
              <span>Bluetooth (BLE)</span>
            </button>
          )}
        </div>

        {/* Platform Distinction Note */}
        <div className="platform-diff-note">
          {isNative ? (
            <p>
              ⚡ <strong>Native Hardware Engine:</strong> Direct low-level {isMobile ? 'USB OTG' : 'Direct USB'}, Bluetooth Low Energy (BLE), and Ethernet TCP communicate directly with sensors.
            </p>
          ) : (
            <p>
              🌐 <strong>Web Browser Mode:</strong> Direct wireless sensor monitoring via <strong>Web Bluetooth</strong> (no native driver required). Low-level USB and raw TCP socket communication are available in the S4A Desktop App.
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

          {tab === 'tcp' && (
            <>
              <p className="tab-desc">
                Connect to sensors, or display devices over Ethernet / Wi-Fi via standard SUTO portocol (Cross-platform on macOS, Windows, Linux).
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
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
              <button
                className="connect-action-btn"
                onClick={handleConnectTcp}
                disabled={loading || !tcpHost.trim()}
              >
                {loading ? 'Connecting to Ethernet...' : '🌐 Connect via Ethernet TCP'}
              </button>
            </>
          )}

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

          {error && (
            <div className="connect-error-box">
              ⚠️ {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
