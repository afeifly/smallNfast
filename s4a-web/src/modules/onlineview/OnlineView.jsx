import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import TauriSutoAPI from '../../api/TauriSutoAPI';
import DebugLogModal from '../../components/DebugLogModal';
import './OnlineView.css';

const POLL_INTERVAL_MS = 1500;

function formatValue(val, resolution = 2) {
  if (val === null || val === undefined || isNaN(val)) return '---';
  return Number(val).toFixed(resolution);
}


import { resolveDeviceTypeName } from '../../util/platform';

export default function OnlineView({ onDisconnect, deviceInfo, isPaused = false }) {
  const [channels, setChannels] = useState([]);
  const [sysInfo, setSysInfo] = useState(null);
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const pollTimerRef = useRef(null);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);

  const deviceDisplayName = resolveDeviceTypeName(sysInfo, deviceInfo);
  const isEthernet = deviceInfo?.transport === 'TCP' || TauriSutoAPI.getActiveTransport() === 'TCP' || Boolean(deviceInfo?.host);
  const ethernetIp = isEthernet
    ? (deviceInfo?.host ? `${deviceInfo.host}${deviceInfo.port && deviceInfo.port !== 502 && deviceInfo.port !== '502' ? `:${deviceInfo.port}` : ''}` : sysInfo?.ip)
    : (sysInfo?.ip || null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  const fetchLiveMeasurements = useCallback(async () => {
    if (isFetchingRef.current || !isMountedRef.current) return;
    isFetchingRef.current = true;
    try {
      const data = await TauriSutoAPI.getMeasurementData();
      if (!isMountedRef.current) return;
      if (data && data.length) {
        setChannels((prevChannels) => {
          const valMap = new Map(data.map((d) => [d.channel_id, d]));
          return prevChannels.map((ch) => {
            const v = valMap.get(ch.channel_id);
            if (v) {
              return {
                ...ch,
                current_value: v.current_value,
                status: v.status,
                unit: v.unit || ch.unit,
                resolution: v.resolution ?? ch.resolution,
              };
            }
            return ch;
          });
        });
        setLastUpdate(new Date());
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.warn('[OnlineView] Polling warning:', err);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      const chs = await TauriSutoAPI.getChannels();
      if (!isMountedRef.current) return;
      setChannels(chs || []);
      setLastUpdate(new Date());

      // Query system info as non-blocking enhancement
      try {
        const info = await TauriSutoAPI.getSystemInfo();
        if (isMountedRef.current) {
          setSysInfo(info || null);
        }
      } catch (e) {
        console.warn('[OnlineView] System info not available:', e);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err?.message || 'Failed to load device information');
      }
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const shouldPoll = isLive && !isPaused;

  useEffect(() => {
    if (!shouldPoll) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    fetchLiveMeasurements();
    pollTimerRef.current = setInterval(() => {
      fetchLiveMeasurements();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [shouldPoll, fetchLiveMeasurements]);

  const toggleLive = () => {
    setIsLive((prev) => !prev);
  };

  const handleRescan = async () => {
    await loadInitialData();
    await fetchLiveMeasurements();
  };

  // One card per SENSOR. Channels sharing a `sensor_key` (SensorID) belong to
  // the same sensor, mirroring cs_monitor `CommonValue.intVailableChannels` /
  // `setSingleSensor`.
  const sensorCards = useMemo(() => {
    if (!channels || channels.length === 0) return [];
    const cardMap = new Map();
    for (const ch of channels) {
      const devName = ch.device_description?.trim()
        || sysInfo?.device_name
        || 'SUTO DS310 Main Unit';
      const sensorKey = ch.sensor_key
        || `${ch.slaver_type ?? ''}&${ch.slaver_addr ?? ''}&${ch.sub_device_id ?? ''}&${ch.sensor_id ?? ''}`;
      const cardKey = `${devName}__${sensorKey}`;
      if (!cardMap.has(cardKey)) {
        cardMap.set(cardKey, {
          key: cardKey,
          deviceName: devName,
          sensorId: ch.sensor_id,
          sensorName: ch.sensor_name || ch.sensor_description?.trim() || '',
          channels: [],
        });
      }
      cardMap.get(cardKey).channels.push(ch);
    }
    const cards = Array.from(cardMap.values());
    let idx = 1;
    for (const c of cards) {
      if (!c.sensorName) c.sensorName = `Sensor ${idx}`;
      idx += 1;
    }
    return cards;
  }, [channels, sysInfo]);

  return (
    <div className="online-view-container">
      {/* Top Device Status Panel */}
      <div className="online-top-panel">
        <div className="online-device-info">
          <div className="device-avatar-icon">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="device-text-group">
            <h2 className="device-title">
              {deviceDisplayName}
              <span className={`online-status-badge ${isLive ? 'status-badge-live' : 'status-badge-paused'}`}>
                <span className="status-pulse-dot" />
                {isLive ? 'LIVE' : 'PAUSED'}
              </span>
            </h2>
            <div className="device-meta-row">
              {ethernetIp && (
                <span className="device-meta-item">
                  IP: <strong>{ethernetIp}</strong>
                </span>
              )}
              {sysInfo?.serial_number && (
                <span className="device-meta-item">
                  SN: <strong>{sysInfo.serial_number}</strong>
                </span>
              )}
              {sysInfo?.firmware_version && (
                <span className="device-meta-item">
                  FW: <strong>{sysInfo.firmware_version}</strong>
                </span>
              )}
              {lastUpdate && (
                <span className="device-meta-item">
                  Last Updated: <strong>{lastUpdate.toLocaleTimeString()}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="online-controls">
          <button className="online-btn" onClick={toggleLive}>
            {isLive ? 'Pause Polling' : 'Resume Polling'}
          </button>
          {onDisconnect && (
            <button className="online-btn" onClick={onDisconnect} style={{ color: '#ef4444' }}>
              Disconnect
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '8px', marginBottom: '20px' }}>
          ⚠ {error}
        </div>
      )}

      {/* Grid of Sensor Telemetry Cards */}
      <div className="suto-devices-grid">
        {sensorCards.map((sensor) => (
          <div key={sensor.key} className="suto-device-card">
            {/* Sensor Header Bar */}
            <div className="suto-device-header">
              <div className="suto-device-title-box">
                <span className="suto-sensor-icon" />
                <span className="suto-device-name" title={sensor.sensorName}>
                  {sensor.sensorName}
                </span>
                {sensor.sensorId !== undefined && sensor.sensorId !== null && (
                  <span className="suto-sensor-chip">sensor #{sensor.sensorId}</span>
                )}
              </div>
              <div className="suto-device-header-meta">
                <span className="suto-ch-count-badge">
                  {sensor.channels.length} {sensor.channels.length === 1 ? 'Channel' : 'Channels'}
                </span>
                <span className="suto-live-dot" />
              </div>
            </div>

            {/* Channels List */}
            <div className="suto-channel-list">
              {sensor.channels.map((ch) => {
                const isBlank = ch.current_value === null || ch.current_value === undefined;
                return (
                  <div key={ch.channel_id} className="suto-channel-row">
                    {/* Left: Channel Name */}
                    <div className="suto-channel-left">
                      <span className="suto-channel-name" title={ch.channel_name || `Channel ${ch.channel_id}`}>
                        {ch.channel_name || ch.sensor_description || `Channel ${ch.channel_id}`}
                      </span>
                    </div>

                    {/* Right: Value & Unit */}
                    <div className="suto-channel-right">
                      <span className={`suto-channel-value ${isBlank ? 'is-blank' : ''}`}>
                        {formatValue(ch.current_value, ch.resolution ?? 2)}
                      </span>
                      <span className="suto-channel-unit">
                        {ch.unit || ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Embedded Diagnostic Log Modal */}
      <DebugLogModal isOpen={showLogs} onClose={() => setShowLogs(false)} />
    </div>
  );
}
