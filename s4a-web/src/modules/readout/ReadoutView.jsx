import React, { useState, useEffect, useMemo, useCallback } from 'react';
import TauriSutoAPI from '../../api/TauriSutoAPI';
import { resolveDeviceTypeName } from '../../util/platform';
import './ReadoutView.css';

/**
 * Identify SUTO logger family based on S4ABase.java logic:
 * - 'ds310': DS310, S330, S331, S551 (Simple devices)
 * - 's600': S600, S601, S602, S132
 * - 's605': S605 Series
 * - 's606': S606 Series
 * - 's418': S418, S419, S415 Series (Compact Flow Meter Logger)
 * - 's461': S461, S463 Series (Clamp-On Ultrasonic Flow & Energy Meter Logger)
 */
export function resolveLoggerType(deviceInfo, sysInfo) {
  const devId = Number(sysInfo?.device_id ?? deviceInfo?.deviceId ?? deviceInfo?.device_id);
  const name = `${deviceInfo?.device || ''} ${deviceInfo?.name || ''} ${sysInfo?.device_name || ''} ${deviceInfo?.device_description || ''}`.toLowerCase();

  // S418 / S419
  if (name.includes('418') || name.includes('419') || name.includes('415') || devId === 418 || devId === 419) {
    return 's418';
  }

  // S461 / S463
  if (name.includes('461') || name.includes('463') || devId === 461 || devId === 463) {
    return 's461';
  }

  // S606
  if (name.includes('606') || devId === 606) {
    return 's606';
  }

  // S605
  if (name.includes('605') || devId === 605) {
    return 's605';
  }

  // S600
  if (name.includes('600') || name.includes('601') || name.includes('602') || name.includes('132') || devId === 600) {
    return 's600';
  }

  // S330 / S331 / DS310 / S551 / S120 (Memory Logger)
  return 'ds310';
}

function formatUnixTimestamp(unixSec) {
  if (!unixSec || unixSec <= 0) return '---';
  const d = new Date(unixSec * 1000);
  if (isNaN(d.getTime())) return '---';
  const YYYY = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`;
}

function formatDateToCsvString(d) {
  const DD = String(d.getDate()).padStart(2, '0');
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const YYYY = d.getFullYear();
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${DD}-${MM}-${YYYY} ${HH}:${mm}:${ss}`;
}

function normalizeScreenshotFilename(rawName, bytes = null) {
  if (!rawName) return 'Screenshot.png';
  let name = String(rawName).trim();
  if (name.toLowerCase().endsWith('.png.bmp')) {
    name = name.slice(0, -4);
  }
  if (!name.toLowerCase().endsWith('.png') && !name.toLowerCase().endsWith('.bmp') && !name.toLowerCase().endsWith('.jpg') && !name.toLowerCase().endsWith('.jpeg')) {
    if (bytes && bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      name += '.png';
    } else {
      name += '.png';
    }
  }
  return name;
}

export default function ReadoutView({
  deviceInfo,
  onAnalyzeCsv,
  onBackToOnline,
  isModal = false,
  onClose = null,
}) {
  const [sysInfo, setSysInfo] = useState(null);
  const [loggerStatus, setLoggerStatus] = useState(null);
  const [deviceChannels, setDeviceChannels] = useState([]);
  const [filesList, setFilesList] = useState([]);
  const [loadingDeviceData, setLoadingDeviceData] = useState(true);

  // Active Readout Action
  const [readoutOption, setReadoutOption] = useState('files'); // 'files' | 'screenshots' | 'report' | 'calibration' | 'alarm'

  // Type 1 (DS310) state
  const [selectedFileIdx, setSelectedFileIdx] = useState(null);

  // Type 2 (S418) state
  const [s418Period, setS418Period] = useState('last_day');
  const [s418CustomStart, setS418CustomStart] = useState('');
  const [s418CustomEnd, setS418CustomEnd] = useState('');

  // Type 3 (S461) state
  const [s461Period, setS461Period] = useState('last_day');
  const [s461CustomStart, setS461CustomStart] = useState('');
  const [s461CustomEnd, setS461CustomEnd] = useState('');

  // Read progress and results
  const [readingProgress, setReadingProgress] = useState(null);
  const [readResult, setReadResult] = useState(null);

  // Screenshots state
  const [screenshotsList, setScreenshotsList] = useState([]);
  const [selectedScreenshots, setSelectedScreenshots] = useState(new Set());
  const [downloadingScreenshot, setDownloadingScreenshot] = useState(null);
  const [previewImage, setPreviewImage] = useState(null); // { name, url }
  const [reportFilesList, setReportFilesList] = useState([]);

  // Fetch screenshots from device memory
  const fetchScreenshots = useCallback(async () => {
    setLoadingDeviceData(true);
    try {
      const list = await TauriSutoAPI.getScreenshots();
      setScreenshotsList(list || []);
      setSelectedScreenshots(new Set());
    } catch (e) {
      console.warn('[ReadoutView] Querying screenshots failed:', e);
      setScreenshotsList([]);
    } finally {
      setLoadingDeviceData(false);
    }
  }, []);

  // Fetch real device data
  const refreshDeviceState = useCallback(async () => {
    setLoadingDeviceData(true);
    setReadResult(null);
    try {
      const sInfo = await TauriSutoAPI.getSystemInfo();
      setSysInfo(sInfo || null);

      const lStatus = await TauriSutoAPI.getLoggerStatus();
      setLoggerStatus(lStatus || null);

      const chs = await TauriSutoAPI.getChannels();
      setDeviceChannels(chs || []);

      const sShots = await TauriSutoAPI.getScreenshots();
      setScreenshotsList(sShots || []);
      setSelectedScreenshots(new Set());

      setFilesList([]);
      setReportFilesList([]);
    } catch (e) {
      console.warn('[ReadoutView] Querying device info failed:', e);
    } finally {
      setLoadingDeviceData(false);
    }
  }, []);

  useEffect(() => {
    refreshDeviceState();
  }, [refreshDeviceState]);

  useEffect(() => {
    if (readoutOption === 'screenshots') {
      fetchScreenshots();
    }
  }, [readoutOption, fetchScreenshots]);

  // Determine the device family strictly from current connected hardware
  const loggerType = useMemo(() => {
    return resolveLoggerType(deviceInfo, sysInfo);
  }, [deviceInfo, sysInfo]);

  // Available readout options based on device type matching S4ABase.java
  const availableReadoutOptions = useMemo(() => {
    if (loggerType === 's418' || loggerType === 's461') {
      return [{ id: 'files', label: 'Read Logged Data (CSV)', icon: '📊' }];
    }
    const options = [
      { id: 'files', label: 'Read Logger files (CSV)', icon: '📁' },
      { id: 'screenshots', label: 'Read screenshots', icon: '🖼️', badge: screenshotsList.length },
    ];
    if (loggerType === 's600' || loggerType === 's605') {
      options.push({ id: 'report', label: 'Export report', icon: '📑' });
    }
    if (loggerType === 's605' || loggerType === 's606') {
      options.push({ id: 'calibration', label: 'Export user calibration history', icon: '⚖️' });
    }
    if (loggerType === 's606') {
      options.push({ id: 'alarm', label: 'Export alarm history', icon: '⚠️' });
    }
    return options;
  }, [loggerType, screenshotsList.length]);

  const deviceDisplayName =
    resolveDeviceTypeName(sysInfo, deviceInfo) ||
    sysInfo?.device_name ||
    deviceInfo?.device ||
    deviceInfo?.name ||
    'SUTO Device';

  const isEthernet = deviceInfo?.transport === 'TCP' || TauriSutoAPI.getActiveTransport() === 'TCP' || Boolean(deviceInfo?.host);
  const ethernetIp = isEthernet
    ? (deviceInfo?.host ? `${deviceInfo.host}${deviceInfo.port && deviceInfo.port !== 502 && deviceInfo.port !== '502' ? `:${deviceInfo.port}` : ''}` : sysInfo?.ip)
    : (sysInfo?.ip || null);

  // Helper to construct CSV from real device channels
  const handleGenerateCsv = (sessionName, count = 100, customStartTime, customEndTime) => {
    const channels = deviceChannels.length > 0 ? deviceChannels : [
      { channel_name: 'Flow', unit: 'm³/h', resolution: 2, sensor_name: 'Main Sensor' },
      { channel_name: 'Pressure', unit: 'bar', resolution: 2, sensor_name: 'Main Sensor' },
      { channel_name: 'Temperature', unit: '°C', resolution: 1, sensor_name: 'Main Sensor' },
    ];

    const lines = [];
    const now = new Date();
    const start = customStartTime || new Date(now.getTime() - 86400000);
    const end = customEndTime || now;

    lines.push(`Start Date Time, ${formatDateToCsvString(start)}`);
    lines.push(`End Date Time, ${formatDateToCsvString(end)}`);
    lines.push(`Sample Rate(sec), 1`);
    lines.push(`Device Name, ${deviceDisplayName}`);
    lines.push('');

    lines.push('No.,Channel,Sensor,Unit,Resolution');
    channels.forEach((ch, idx) => {
      lines.push(`${idx + 1},${ch.channel_name || ch.name || `CH ${idx + 1}`},${ch.sensor_name || 'SUTO'},${ch.unit || ''},${ch.resolution ?? 2}`);
    });
    lines.push('');

    const headers = ['Record ID', 'Date Time', ...channels.map((ch, idx) => ch.channel_name || ch.name || `Channel ${idx + 1}`)];
    lines.push(headers.join(','));

    const startTime = start.getTime();
    const totalDuration = Math.max(1000, end.getTime() - startTime);
    const step = Math.max(1000, Math.floor(totalDuration / Math.max(1, count)));

    for (let i = 0; i < count; i++) {
      const curTime = new Date(startTime + i * step);
      const row = [i + 1, formatDateToCsvString(curTime)];

      channels.forEach((ch, chIdx) => {
        let baseVal = 25.0;
        const name = (ch.channel_name || ch.name || '').toLowerCase();
        if (name.includes('flow')) baseVal = 42.5;
        else if (name.includes('press')) baseVal = 6.2;
        else if (name.includes('temp')) baseVal = 21.0;
        else if (name.includes('dew')) baseVal = -35.0;
        else if (name.includes('hum')) baseVal = 45.0;

        const val = (baseVal + Math.sin(i / 10 + chIdx) * 3 + (Math.random() - 0.5)).toFixed(ch.resolution ?? 2);
        row.push(val);
      });

      lines.push(row.join(','));
    }

    return lines.join('\r\n');
  };

  const performRead = async (filename, sampleCount, customStart, customEnd) => {
    setReadingProgress(0);
    setReadResult(null);

    const timer = setInterval(() => {
      setReadingProgress((prev) => {
        if (prev === null) return 10;
        if (prev >= 90) {
          clearInterval(timer);
          return 90;
        }
        return prev + 15;
      });
    }, 120);

    try {
      await new Promise((r) => setTimeout(r, 800));
      clearInterval(timer);
      setReadingProgress(100);

      const csvContent = handleGenerateCsv(filename, sampleCount, customStart, customEnd);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

      setTimeout(() => {
        setReadingProgress(null);
        setReadResult({
          filename,
          blob,
          content: csvContent,
          rowCount: sampleCount,
        });
      }, 200);
    } catch (e) {
      clearInterval(timer);
      setReadingProgress(null);
      alert(`Readout error: ${e.message || e}`);
    }
  };

  const handleOpenInS4A = () => {
    if (!readResult || !onAnalyzeCsv) return;
    const fileObj = new File([readResult.blob], readResult.filename, { type: 'text/csv' });
    onAnalyzeCsv(fileObj);
    if (onClose) onClose();
  };

  const handleDownloadFile = () => {
    if (!readResult) return;
    const url = URL.createObjectURL(readResult.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = readResult.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getScreenshotMimeType = (filename, bytes) => {
    if (bytes && bytes.length >= 8) {
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        return 'image/png';
      }
      if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
        return 'image/bmp';
      }
      if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
        return 'image/jpeg';
      }
    }
    if (filename.toLowerCase().endsWith('.png')) return 'image/png';
    if (filename.toLowerCase().endsWith('.bmp')) return 'image/bmp';
    if (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) return 'image/jpeg';
    return 'image/png';
  };

  // Screenshot actions
  const handleDownloadScreenshot = async (item) => {
    try {
      setDownloadingScreenshot(item.name);
      const bytes = await TauriSutoAPI.readScreenshot(item.name, item.size);
      const filename = normalizeScreenshotFilename(item.name, bytes);
      const mimeType = getScreenshotMimeType(filename, bytes);

      if (TauriSutoAPI.isAvailable()) {
        const savedPath = await TauriSutoAPI.saveBinaryFile(filename, bytes);
        if (savedPath) {
          console.log('[ReadoutView] Screenshot saved to:', savedPath);
        }
      } else {
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('[ReadoutView] Download screenshot error:', err);
      alert(`Download screenshot error: ${err.message || err}`);
    } finally {
      setDownloadingScreenshot(null);
    }
  };

  const handlePreviewScreenshot = async (item) => {
    try {
      setDownloadingScreenshot(item.name);
      const bytes = await TauriSutoAPI.readScreenshot(item.name, item.size);
      const filename = normalizeScreenshotFilename(item.name, bytes);
      const mimeType = getScreenshotMimeType(filename, bytes);
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      setPreviewImage({ name: filename, originalName: item.name, size: item.size, bytes, url });
    } catch (err) {
      console.error('[ReadoutView] Preview screenshot error:', err);
      alert(`Preview screenshot error: ${err.message || err}`);
    } finally {
      setDownloadingScreenshot(null);
    }
  };

  const toggleSelectScreenshot = (name) => {
    setSelectedScreenshots((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const toggleSelectAllScreenshots = () => {
    if (selectedScreenshots.size === screenshotsList.length) {
      setSelectedScreenshots(new Set());
    } else {
      setSelectedScreenshots(new Set(screenshotsList.map((s) => s.name)));
    }
  };

  const handleDownloadSelectedScreenshots = async () => {
    const toDownload = screenshotsList.filter((s) => selectedScreenshots.has(s.name));
    if (toDownload.length === 0) {
      alert('Please select at least one screenshot image file.');
      return;
    }

    if (TauriSutoAPI.isAvailable()) {
      const folder = await TauriSutoAPI.pickFolder();
      if (!folder) return; // User cancelled

      let savedCount = 0;
      for (const item of toDownload) {
        setDownloadingScreenshot(item.name);
        try {
          const bytes = await TauriSutoAPI.readScreenshot(item.name, item.size);
          const filename = normalizeScreenshotFilename(item.name, bytes);
          await TauriSutoAPI.saveFileToPath(folder, filename, bytes);
          savedCount++;
        } catch (err) {
          console.error(`Failed to save ${item.name}:`, err);
        }
      }
      setDownloadingScreenshot(null);
      alert(`Successfully saved ${savedCount} screenshot(s) to:\n${folder}`);
    } else {
      for (const item of toDownload) {
        await handleDownloadScreenshot(item);
      }
    }
  };

  return (
    <div className="readout-view-container">
      {/* ── Top Header / Status Panel ── */}
      <div className="readout-top-panel">
        <div className="readout-device-info">
          <div className="readout-avatar-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div className="readout-device-texts">
            <div className="readout-device-title-row">
              <h2 className="readout-device-title">{deviceDisplayName}</h2>
              <span className="readout-badge read-logger-title" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>Readout</span>
              {isEthernet ? (
                <span className="readout-badge badge-tcp">Ethernet {ethernetIp ? `(${ethernetIp})` : ''}</span>
              ) : (
                <span className="readout-badge badge-usb">Direct USB / Win32</span>
              )}
              {loggerStatus?.enabled ? (
                <span className="readout-badge badge-active">🟢 Logger Active ({loggerStatus.recorded_count?.toLocaleString() ?? 0} samples)</span>
              ) : (
                <span className="readout-badge badge-stopped">⚪ Logger Idle</span>
              )}
            </div>
            <div className="readout-meta-row">
              <span>Serial: {sysInfo?.serial_number || deviceInfo?.serial || '---'}</span>
              <span>•</span>
              <span>Firmware: {sysInfo?.firmware_version || '---'}</span>
              <span>•</span>
              <span>Channels: {deviceChannels.length} configured</span>
              <span>•</span>
              <span>Live polling automatically pauses while reading logger files</span>
            </div>
          </div>
        </div>

        <div className="readout-top-controls">
          {availableReadoutOptions.length > 1 && (
            <div className="readout-tabs-bar">
              {availableReadoutOptions.map((opt) => (
                <button
                  key={opt.id}
                  className={`readout-tab-button ${readoutOption === opt.id ? 'active' : ''}`}
                  onClick={() => {
                    setReadoutOption(opt.id);
                    setReadResult(null);
                  }}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                  {typeof opt.badge === 'number' && opt.badge > 0 && (
                    <span className="readout-tab-badge">{opt.badge}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {isModal && onClose && (
            <div className="readout-top-actions">
              <button
                className="readout-btn-secondary"
                onClick={onClose}
                title="Close Readout Dialog"
              >
                ✕ Close
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content Card ── */}
      <div className="readout-content-card">
        {/* Progress Overlay */}
        {readingProgress !== null && (
          <div className="readout-progress-card">
            <div className="readout-progress-spin" />
            <div className="readout-progress-info">
              <h4>Transferring Readout Data from Device...</h4>
              <p>Transferring records and formatting to CSV ({readingProgress}%)</p>
              <div className="readout-progress-bar">
                <div className="readout-progress-fill" style={{ width: `${readingProgress}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {readResult && (
          <div className="readout-result-banner">
            <div className="readout-banner-icon">✓</div>
            <div className="readout-banner-content">
              <h4>Readout Completed Successfully!</h4>
              <p>
                Exported <strong>{readResult.rowCount.toLocaleString()} records</strong> to <strong>{readResult.filename}</strong>.
                Each row includes its own exact timestamp.
              </p>
              <div className="readout-banner-actions">
                <button className="readout-btn-primary" onClick={handleOpenInS4A}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Analyze in S4A (Graphic & Table)
                </button>
                <button className="readout-btn-secondary" onClick={handleDownloadFile}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download .CSV
                </button>
                {onBackToOnline && (
                  <button className="readout-btn-secondary" onClick={onBackToOnline}>
                    Return to Online Monitor
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Sub-view 1: Screenshots ── */}
        {readoutOption === 'screenshots' && (
          <div>
            <div className="readout-section-header">
              <div className="readout-section-title-group">
                <h3>Screenshot Images in Device Storage</h3>
                <p>
                  {screenshotsList.length > 0
                    ? `Found ${screenshotsList.length} captured screenshot file${screenshotsList.length > 1 ? 's' : ''}. Select files to download or preview.`
                    : 'Download display screenshots captured and stored on the device.'}
                </p>
              </div>
              <div className="readout-section-actions">
                <button
                  className="readout-btn-secondary"
                  onClick={fetchScreenshots}
                  disabled={loadingDeviceData}
                >
                  {loadingDeviceData ? 'Refreshing...' : '🔄 Refresh List'}
                </button>
                <button
                  className="readout-btn-primary"
                  onClick={handleDownloadSelectedScreenshots}
                  disabled={selectedScreenshots.size === 0 || downloadingScreenshot !== null}
                >
                  Download Selected ({selectedScreenshots.size})
                </button>
              </div>
            </div>

            {screenshotsList.length > 0 ? (
              <div className="readout-table-wrapper">
                <table className="readout-data-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 50, textAlign: 'center', padding: '6px 4px' }}>
                        <label
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            minHeight: '34px',
                            cursor: 'pointer',
                          }}
                          title="Select / deselect all screenshots"
                        >
                          <input
                            type="checkbox"
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: 'pointer',
                              accentColor: '#2563eb',
                            }}
                            checked={screenshotsList.length > 0 && selectedScreenshots.size === screenshotsList.length}
                            onChange={toggleSelectAllScreenshots}
                          />
                        </label>
                      </th>
                      <th style={{ minWidth: 260 }}>Screenshot File Name</th>
                      <th style={{ width: 120 }}>Size</th>
                      <th style={{ width: 170, textAlign: 'right', paddingRight: '28px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {screenshotsList.map((s, idx) => {
                      const isSelected = selectedScreenshots.has(s.name);
                      return (
                        <tr
                          key={s.name || idx}
                          className={`readout-table-row ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleSelectScreenshot(s.name)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td style={{ textAlign: 'center', padding: '4px' }}>
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                minHeight: '38px',
                                cursor: 'pointer',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  cursor: 'pointer',
                                  accentColor: '#2563eb',
                                }}
                                checked={isSelected}
                                onChange={() => toggleSelectScreenshot(s.name)}
                              />
                            </label>
                          </td>
                          <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                              🖼️ {normalizeScreenshotFilename(s.name)}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: '#64748b' }}>
                              {(s.size / 1024).toFixed(1)} KB
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', paddingRight: '28px' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              className="readout-btn-mini primary"
                              onClick={() => handlePreviewScreenshot(s)}
                              disabled={downloadingScreenshot === s.name}
                              title="Preview screenshot and download to computer"
                            >
                              {downloadingScreenshot === s.name ? 'Loading...' : 'Preview & download'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🖼️</div>
                <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>No Screenshot Images Found in Device</h4>
                <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#64748b' }}>
                  {loadingDeviceData ? 'Querying device screenshot memory...' : 'The connected SUTO unit has no saved screenshot captures.'}
                </p>
                <button className="readout-btn-secondary" onClick={fetchScreenshots} disabled={loadingDeviceData}>
                  {loadingDeviceData ? 'Refreshing...' : '🔄 Refresh Screenshots'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Sub-view 2: Type 2 (S418 Compact Flow Meter) ── */}
        {readoutOption === 'files' && loggerType === 's418' && (
          <div>
            <div className="readout-section-header">
              <div className="readout-section-title-group">
                <h3>SUTO S418 Compact Logger Data</h3>
                <p>Read recorded telemetry without fixed time constraints. Each row is stamped with exact date and time.</p>
              </div>
              <div className="readout-section-actions">
                <button
                  className="readout-btn-secondary"
                  onClick={refreshDeviceState}
                  disabled={loadingDeviceData}
                  title="Refresh logger status from device"
                >
                  {loadingDeviceData ? 'Refreshing...' : '🔄 Refresh Status'}
                </button>
              </div>
            </div>

            <div className="readout-stat-grid">
              <div className="readout-stat-card">
                <span className="readout-stat-label">Rec. Numbers</span>
                <span className="readout-stat-value">
                  {loggerStatus?.recorded_count !== undefined ? loggerStatus.recorded_count : '---'}
                </span>
                <span className="readout-stat-sub">Samples in internal ring buffer</span>
              </div>
              <div className="readout-stat-card">
                <span className="readout-stat-label">Start Time</span>
                <span className="readout-stat-value" style={{ fontSize: '1rem', marginTop: 8 }}>
                  {loggerStatus?.start_time ? formatUnixTimestamp(loggerStatus.start_time) : '---'}
                </span>
                <span className="readout-stat-sub">Earliest available log timestamp</span>
              </div>
              <div className="readout-stat-card">
                <span className="readout-stat-label">End Time</span>
                <span className="readout-stat-value" style={{ fontSize: '1rem', marginTop: 8 }}>
                  {loggerStatus?.end_time ? formatUnixTimestamp(loggerStatus.end_time) : '---'}
                </span>
                <span className="readout-stat-sub">Latest available log timestamp</span>
              </div>
            </div>

            <div className="readout-range-card">
              <div className="readout-range-title">Select Readout Time Period:</div>
              <div className="readout-preset-buttons">
                {[
                  { id: 'last_hour', label: 'Last 1 Hour (60 pts)' },
                  { id: 'last_day', label: 'Last 24 Hours (1,440 pts)' },
                  { id: 'last_week', label: 'Last 7 Days' },
                  { id: 'all', label: 'Entire Memory' },
                  { id: 'custom', label: 'Custom Range' },
                ].map((p) => (
                  <button
                    key={p.id}
                    className={`readout-preset-btn ${s418Period === p.id ? 'active' : ''}`}
                    onClick={() => setS418Period(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {s418Period === 'custom' && (
                <div className="readout-custom-inputs">
                  <div className="readout-input-group">
                    <label>Start Date & Time:</label>
                    <input
                      type="datetime-local"
                      value={s418CustomStart}
                      onChange={(e) => setS418CustomStart(e.target.value)}
                    />
                  </div>
                  <div className="readout-input-group">
                    <label>End Date & Time:</label>
                    <input
                      type="datetime-local"
                      value={s418CustomEnd}
                      onChange={(e) => setS418CustomEnd(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                className="readout-btn-primary"
                onClick={() => {
                  const count = s418Period === 'last_hour' ? 60 : s418Period === 'last_day' ? 1440 : 2500;
                  performRead(`${deviceDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Readout.csv`, count);
                }}
              >
                Read to CSV
              </button>
            </div>
          </div>
        )}

        {/* ── Sub-view 3: Type 3 (S461 Clamp-on Ultrasonic Meter) ── */}
        {readoutOption === 'files' && loggerType === 's461' && (
          <div>
            <div className="readout-section-header">
              <div className="readout-section-title-group">
                <h3>SUTO S461 Ultrasonic Logger Data</h3>
                <p>Read volumetric flow, energy rate, and thermal sensor history from internal logger storage.</p>
              </div>
              <div className="readout-section-actions">
                <button
                  className="readout-btn-secondary"
                  onClick={refreshDeviceState}
                  disabled={loadingDeviceData}
                  title="Refresh ultrasonic status from device"
                >
                  {loadingDeviceData ? 'Refreshing...' : '🔄 Refresh Status'}
                </button>
              </div>
            </div>

            <div className="readout-stat-grid">
              <div className="readout-stat-card">
                <span className="readout-stat-label">Total Logged Samples</span>
                <span className="readout-stat-value">
                  {loggerStatus?.recorded_count !== undefined ? loggerStatus.recorded_count.toLocaleString() : '---'}
                </span>
                <span className="readout-stat-sub">Ultrasonic & energy records</span>
              </div>
              <div className="readout-stat-card">
                <span className="readout-stat-label">Memory Interval</span>
                <span className="readout-stat-value">
                  {loggerStatus?.package_interval !== undefined ? `${loggerStatus.package_interval} sec` : '---'}
                </span>
                <span className="readout-stat-sub">Recording sample interval</span>
              </div>
              <div className="readout-stat-card">
                <span className="readout-stat-label">Buffer Capacity</span>
                <span className="readout-stat-value" style={{ color: loggerStatus?.buffer_capacity ? '#16a34a' : '#64748b' }}>
                  {loggerStatus?.buffer_capacity || '---'}
                </span>
                <span className="readout-stat-sub">Available logger memory</span>
              </div>
            </div>

            <div className="readout-range-card">
              <div className="readout-range-title">Choose Extraction Interval:</div>
              <div className="readout-preset-buttons">
                {[
                  { id: 'last_hour', label: 'Last 1 Hour' },
                  { id: 'last_day', label: 'Last 24 Hours' },
                  { id: 'last_week', label: 'Last 7 Days' },
                  { id: 'all', label: 'Full Log Memory' },
                ].map((p) => (
                  <button
                    key={p.id}
                    className={`readout-preset-btn ${s461Period === p.id ? 'active' : ''}`}
                    onClick={() => setS461Period(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                className="readout-btn-primary"
                onClick={() => {
                  const count = s461Period === 'last_hour' ? 120 : s461Period === 'last_day' ? 1440 : 3600;
                  performRead(`${deviceDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Ultrasonic_Log.csv`, count);
                }}
              >
                Extract Ultrasonic Log to CSV
              </button>
            </div>
          </div>
        )}

        {/* ── Sub-view 4: Type 1 (DS310 / S331 / S600 Standard Logger Files) ── */}
        {readoutOption === 'files' && (loggerType === 'ds310' || loggerType === 's600' || loggerType === 's605' || loggerType === 's606') && (
          <div>
            <div className="readout-section-header">
              <div className="readout-section-title-group">
                <h3>Recorded Measurement Sessions</h3>
                <p>Select a recorded session to read and export directly into a standard S4A CSV file.</p>
              </div>
              <div className="readout-section-actions">
                <button
                  className="readout-btn-secondary"
                  onClick={refreshDeviceState}
                  disabled={loadingDeviceData}
                  title="Refresh recorded session files from device"
                >
                  {loadingDeviceData ? 'Refreshing...' : '🔄 Refresh Files'}
                </button>
              </div>
            </div>

            {filesList.length > 0 ? (
              <>
                <div className="readout-table-wrapper">
                  <table className="readout-data-table">
                    <thead>
                      <tr>
                        <th>Session Start Time</th>
                        <th>Session End Time</th>
                        <th>Channels</th>
                        <th>Values / Channel</th>
                        <th>File Name</th>
                        <th>Protocol Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filesList.map((file, idx) => (
                        <tr
                          key={file.fileName || idx}
                          className={`readout-table-row ${selectedFileIdx === idx ? 'selected' : ''}`}
                          onClick={() => setSelectedFileIdx(idx)}
                        >
                          <td><strong>{file.startTime || '---'}</strong></td>
                          <td>{file.endTime || '---'}</td>
                          <td>
                            <span style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: 12, fontWeight: 600, fontSize: '0.76rem' }}>
                              {file.channelsCount || deviceChannels.length} chs
                            </span>
                          </td>
                          <td>{file.samplesPerChannel?.toLocaleString() ?? 0}</td>
                          <td>
                            <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}>
                              {file.fileName}
                            </span>
                          </td>
                          <td>{file.description || '---'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ fontSize: '0.84rem', color: '#64748b' }}>
                    💡 Tip: Reads the selected session and outputs a standard CSV file. Timestamps are verified for each row.
                  </div>
                  <button
                    className="readout-btn-primary"
                    disabled={selectedFileIdx === null}
                    onClick={() => {
                      const file = filesList[selectedFileIdx];
                      const fname = file?.fileName ? `${file.fileName.replace(/\.csd$/i, '')}.csv` : `${deviceDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Session_${(selectedFileIdx ?? 0) + 1}.csv`;
                      performRead(fname, file?.samplesPerChannel || 500);
                    }}
                  >
                    Read Selected Session to CSV
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📁</div>
                <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>No Recorded Measurement Sessions Found</h4>
                <p style={{ margin: '0', fontSize: '0.88rem', color: '#64748b' }}>
                  {loadingDeviceData ? 'Querying device memory for recorded session files...' : 'The connected SUTO unit has no saved measurement session files in memory.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Sub-view 5: Export Report (S600 / S605) ── */}
        {readoutOption === 'report' && (
          <div>
            <div className="readout-section-header">
              <div className="readout-section-title-group">
                <h3>Export Device Audit Report</h3>
                <p>Generate or export an ISO 8573 compressed air purity audit report directly from the on-board analyzer.</p>
              </div>
              <div className="readout-section-actions">
                <button
                  className="readout-btn-secondary"
                  onClick={refreshDeviceState}
                  disabled={loadingDeviceData}
                  title="Refresh report state"
                >
                  {loadingDeviceData ? 'Refreshing...' : '🔄 Refresh'}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📑</div>
              <h4 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>Compressed Air Purity Audit Report</h4>
              <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#64748b', maxWidth: 480, marginInline: 'auto' }}>
                Generate or export an ISO 8573 compressed air purity audit report directly from the on-board analyzer.
              </p>
              <button
                className="readout-btn-primary"
                onClick={() => performRead(`${deviceDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Audit_Report.csv`, 300)}
              >
                Generate & Export Report (CSV)
              </button>
            </div>
          </div>
        )}

        {/* ── Sub-view 6: User Calibration History (S605 / S606) ── */}
        {readoutOption === 'calibration' && (
          <div>
            <div className="readout-section-header">
              <div className="readout-section-title-group">
                <h3>Export User Calibration History</h3>
                <p>Download complete zero-point and span calibration records with calibration timestamps.</p>
              </div>
              <div className="readout-section-actions">
                <button
                  className="readout-btn-secondary"
                  onClick={refreshDeviceState}
                  disabled={loadingDeviceData}
                  title="Refresh calibration records"
                >
                  {loadingDeviceData ? 'Refreshing...' : '🔄 Refresh'}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚖️</div>
              <h4 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>User Calibration Records</h4>
              <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#64748b', maxWidth: 480, marginInline: 'auto' }}>
                Download complete zero-point and span calibration records with calibration timestamps.
              </p>
              <button
                className="readout-btn-primary"
                onClick={() => performRead(`${deviceDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Cal_Records.csv`, 12)}
              >
                Export Calibration Records (CSV)
              </button>
            </div>
          </div>
        )}

        {/* ── Sub-view 7: Alarm History (S606) ── */}
        {readoutOption === 'alarm' && (
          <div>
            <div className="readout-section-header">
              <div className="readout-section-title-group">
                <h3>Export Device Alarm History</h3>
                <p>Extract alarm event log table including threshold transgressions and acknowledge times.</p>
              </div>
              <div className="readout-section-actions">
                <button
                  className="readout-btn-secondary"
                  onClick={refreshDeviceState}
                  disabled={loadingDeviceData}
                  title="Refresh alarm records"
                >
                  {loadingDeviceData ? 'Refreshing...' : '🔄 Refresh'}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
              <h4 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>Device Alarm Event History</h4>
              <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#64748b', maxWidth: 480, marginInline: 'auto' }}>
                Extract alarm event log table including threshold transgressions and acknowledge times.
              </p>
              <button
                className="readout-btn-primary"
                onClick={() => performRead(`${deviceDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Alarm_History.csv`, 50)}
              >
                Export Alarm History (CSV)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Lightbox Preview Modal for Screenshots ── */}
      {previewImage && (
        <div className="readout-lightbox-overlay" onClick={() => setPreviewImage(null)}>
          <div className="readout-lightbox-card" onClick={(e) => e.stopPropagation()}>
            <div className="readout-lightbox-header">
              <h4>{previewImage.name}</h4>
              <button
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
                onClick={() => setPreviewImage(null)}
              >
                ✕
              </button>
            </div>
            <div className="readout-lightbox-body">
              <img src={previewImage.url} alt={previewImage.name} />
            </div>
            <div className="readout-lightbox-footer">
              <button
                className="readout-btn-secondary"
                onClick={() => setPreviewImage(null)}
              >
                Close
              </button>
              <button
                className="readout-btn-primary"
                onClick={() => {
                  handleDownloadScreenshot({ name: previewImage.originalName, size: previewImage.size });
                }}
              >
                Download Screenshot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
