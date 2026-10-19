import React, { useState, useEffect } from 'react';
import TauriSutoAPI from '../api/TauriSutoAPI';
import BleSutoAPI from '../api/BleSutoAPI';
import { checkIsDesktop } from '../util/platform';
import './DeviceConnectModal.css';

export default function DeviceConnectModal({ isOpen, onClose, onConnected }) {
  const isDesk = checkIsDesktop();
  const [tab, setTab] = useState(isDesk ? 'usb' : 'ble'); // 'usb' | 'tcp' | 'ble'
  const [tcpHost, setTcpHost] = useState('192.168.1.100');
  const [tcpPort, setTcpPort] = useState('502');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showAllBle, setShowAllBle] = useState(false);

  useEffect(() => {
    if (isDesk && tab === 'ble') {
      setTab('usb');
    } else if (!isDesk && tab !== 'ble') {
      setTab('ble');
    }
  }, [isDesk, tab]);

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
      setError(err?.message || 'Failed to connect via USB. Please verify cable and driver.');
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

  const handleConnectBle = async () => {
    setLoading(true);
    setError(null);
    try {
      const conn = await TauriSutoAPI.connectBle({ acceptAll: showAllBle });
      onConnected(conn);
      onClose();
    } catch (err) {
      console.error('[DeviceConnectModal] BLE connect error:', err);
      setError(err?.message || 'Bluetooth connection cancelled or failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="device-connect-overlay" onClick={onClose}>
      <div className="device-connect-modal" onClick={(e) => e.stopPropagation()}>
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
          {isDesk ? (
            <>
              <button
                className={`modal-tab-btn ${tab === 'usb' ? 'active' : ''}`}
                onClick={() => { setTab('usb'); setError(null); }}
              >
                <span>🔌</span>
                <span>Direct USB</span>
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
          {isDesk ? (
            <p>
              🖥️ <strong>Desktop App Mode:</strong> Direct Win32 USB (<code>cscdc.sys</code>) and low-level Ethernet TCP sockets communicate natively with SUTO hardware. Web Bluetooth is hidden in desktop mode.
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
                Direct Win32 driver connection via <strong>cscdc.sys</strong>. Automatically scans for connected SUTO DS310 / S331 / S401 USB interfaces.
              </p>
              <button
                className="connect-action-btn"
                onClick={handleConnectUsb}
                disabled={loading}
              >
                {loading ? 'Connecting via USB...' : '🔌 Detect & Connect USB'}
              </button>
            </>
          )}

          {tab === 'tcp' && (
            <>
              <p className="tab-desc">
                Connect to SUTO displays, sensors, or loggers over Ethernet / Wi-Fi via standard <strong>CS-Bus over TCP</strong> (Cross-platform on macOS, Windows, Linux).
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
                Connect wirelessly to SUTO Bluetooth Low Energy sensors (e.g. S401 / S421 / S520) via browser <strong>Web Bluetooth</strong>.
              </p>
              <div className="ble-badge-hint">
                <span>ℹ️</span>
                <span>
                  {BleSutoAPI.isSupported()
                    ? 'Web Bluetooth is supported in your current browser.'
                    : (BleSutoAPI.getSupportIssue() || 'Web Bluetooth requires Chrome or a Chromium-based browser.')}
                </span>
              </div>
              <div style={{ marginTop: '12px', marginBottom: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={showAllBle}
                    onChange={(e) => setShowAllBle(e.target.checked)}
                    disabled={loading}
                  />
                  <span>Show all nearby Bluetooth devices (unfiltered)</span>
                </label>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', marginLeft: '24px' }}>
                  {showAllBle
                    ? 'Scanning all nearby Bluetooth devices.'
                    : 'Default: Filtered by SUTO hardware services for quick selection.'}
                </div>
              </div>
              <button
                className="connect-action-btn"
                onClick={handleConnectBle}
                disabled={loading || !BleSutoAPI.isSupported()}
              >
                {loading ? 'Pairing Bluetooth...' : (showAllBle ? '📶 Scan All BLE Devices' : '📶 Scan SUTO BLE Sensors')}
              </button>
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
