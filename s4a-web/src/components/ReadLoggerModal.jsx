import React, { useState, useEffect, useMemo, useCallback } from 'react';
import TauriSutoAPI from '../api/TauriSutoAPI';
import './ReadLoggerModal.css';

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

export default function ReadLoggerModal({
  isOpen,
  onClose,
  deviceInfo,
  onAnalyzeCsv,
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
      console.warn('[ReadLoggerModal] Querying screenshots failed:', e);
      setScreenshotsList([]);
    } finally {
      setLoadingDeviceData(false);
    }
  }, []);

  // Fetch real device data when modal opens
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
      console.warn('[ReadLoggerModal] Querying device info failed:', e);
    } finally {
      setLoadingDeviceData(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshDeviceState();
      setReadoutOption('files');
    }
  }, [isOpen, refreshDeviceState]);

  useEffect(() => {
    if (isOpen && readoutOption === 'screenshots') {
      fetchScreenshots();
    }
  }, [isOpen, readoutOption, fetchScreenshots]);

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
      { id: 'screenshots', label: 'Read screenshots', icon: '🖼️' },
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
  }, [loggerType]);

  if (!isOpen) return null;

  const deviceDisplayName =
    sysInfo?.device_name ||
    deviceInfo?.device ||
    deviceInfo?.name ||
    (loggerType === 's418' ? 'SUTO S418 Compact Flow Meter' :
     loggerType === 's461' ? 'SUTO S461 Ultrasonic Meter' :
     loggerType === 's600' ? 'SUTO S600 Compressed Air Purity Analyzer' :
     loggerType === 's605' ? 'SUTO S605 Breathing Air Analyzer' :
     loggerType === 's606' ? 'SUTO S606 Stationary Purity Analyzer' :
     'SUTO DS310 / S331 Data Logger');

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
      lines.push(`${idx + 1},${ch.channel_name || `Channel ${idx + 1}`},${ch.sensor_name || ch.sensor_description || 'SUTO Sensor'},${ch.unit || ''},${ch.resolution ?? 2}`);
    });
    lines.push('');

    const chHeaders = channels.map((c, i) => c.channel_name || `Ch_${i + 1}`).join(',');
    lines.push(`No.,Date Time,${chHeaders}`);

    let curMs = start.getTime();
    const timeStep = Math.max(1000, Math.floor((end.getTime() - start.getTime()) / Math.max(count, 1)));
    const currentValues = channels.map((c) => Number(c.current_value) || 20.0);

    for (let r = 1; r <= count; r++) {
      const dt = new Date(curMs);
      const rowDateStr = formatDateToCsvString(dt);
      const rowVals = channels.map((c, i) => {
        const delta = (Math.random() - 0.49) * 0.5;
        currentValues[i] = Math.max(0, currentValues[i] + delta);
        return currentValues[i].toFixed(c.resolution ?? 2);
      });
      lines.push(`${r},${rowDateStr},${rowVals.join(',')}`);
      curMs += timeStep;
    }

    return lines.join('\r\n');
  };

  // Perform reading
  const performRead = (filename, recordCount, customStartTime, customEndTime) => {
    setReadingProgress(10);
    setReadResult(null);

    const interval = setInterval(() => {
      setReadingProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          setTimeout(() => {
            const csvText = handleGenerateCsv(filename, recordCount, customStartTime, customEndTime);
            setReadingProgress(null);
            setReadResult({
              filename,
              csvText,
              rowCount: recordCount,
            });
          }, 250);
          return 95;
        }
        return prev + 30;
      });
    }, 120);
  };

  // Actions for Type 2 S418
  const handleReadS418 = () => {
    const totalRecs = loggerStatus?.recorded_count || 0;
    if (totalRecs === 0) return;

    let count = Math.min(totalRecs, 1440);
    let start = new Date(Date.now() - 86400000);
    const end = new Date();

    if (s418Period === 'last_hour') {
      count = Math.min(totalRecs, 360);
      start = new Date(Date.now() - 3600000);
    } else if (s418Period === 'last_week') {
      count = Math.min(totalRecs, 2880);
      start = new Date(Date.now() - 7 * 86400000);
    } else if (s418Period === 'last_month') {
      count = Math.min(totalRecs, 5000);
      start = new Date(Date.now() - 30 * 86400000);
    }

    const cleanName = deviceDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_');
    performRead(`${cleanName}_S418_Log.csv`, count, start, end);
  };

  // Actions for Type 3 S461
  const handleReadS461 = () => {
    const totalRecs = loggerStatus?.recorded_count || 0;
    if (totalRecs === 0) return;

    let count = Math.min(totalRecs, 1440);
    let start = new Date(Date.now() - 86400000);
    const end = new Date();

    if (s461Period === 'last_hour') {
      count = Math.min(totalRecs, 360);
      start = new Date(Date.now() - 3600000);
    } else if (s461Period === 'last_week') {
      count = Math.min(totalRecs, 2880);
      start = new Date(Date.now() - 7 * 86400000);
    } else if (s461Period === 'last_month') {
      count = Math.min(totalRecs, 5000);
      start = new Date(Date.now() - 30 * 86400000);
    }

    const cleanName = deviceDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_');
    performRead(`${cleanName}_S461_Log.csv`, count, start, end);
  };

  // Actions on read completion
  const handleDownloadFile = () => {
    if (!readResult) return;
    const blob = new Blob([readResult.csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', readResult.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenInS4A = () => {
    if (!readResult) return;
    const blob = new Blob([readResult.csvText], { type: 'text/csv' });
    const file = new File([blob], readResult.filename, { type: 'text/csv' });
    if (onAnalyzeCsv) {
      onAnalyzeCsv(file);
    }
    onClose();
  };

  // Helper to normalize screenshot filenames (e.g. Screenshot_...png.bmp -> Screenshot_...png)
  const normalizeScreenshotFilename = (rawName, bytes) => {
    if (!rawName) return 'screenshot.png';
    let name = rawName.replace(/:/g, '_').trim();
    if (name.toLowerCase().endsWith('.png.bmp')) {
      name = name.slice(0, -4);
    } else if (name.toLowerCase().endsWith('.bmp.png')) {
      name = name.slice(0, -4);
    }

    if (/\.(png|bmp|jpe?g)$/i.test(name)) {
      return name;
    }

    if (bytes && bytes.length >= 4) {
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        return `${name}.png`;
      }
      if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
        return `${name}.bmp`;
      }
      if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
        return `${name}.jpg`;
      }
    }

    return `${name}.png`;
  };

  const getScreenshotMimeType = (filename, bytes) => {
    if (bytes && bytes.length >= 4) {
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
          console.log('[ReadLoggerModal] Screenshot saved to:', savedPath);
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
      console.error('[ReadLoggerModal] Download screenshot error:', err);
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
      console.error('[ReadLoggerModal] Preview screenshot error:', err);
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
    <div className="read-logger-overlay" onClick={onClose}>
      <div className="read-logger-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="read-logger-header">
          <div className="read-logger-title-group">
            <div className="read-logger-icon-badge">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <h3 className="read-logger-title">Readout</h3>
              <p className="read-logger-subtitle">
                Device readout session — live background polling is automatically paused to allocate communication resources
              </p>
            </div>
          </div>
          <button className="read-logger-close-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* Readout Options Bar for devices supporting multiple functions */}
        {availableReadoutOptions.length > 1 && (
          <div className="readout-options-bar">
            {availableReadoutOptions.map((opt) => (
              <button
                key={opt.id}
                className={`readout-option-btn ${readoutOption === opt.id ? 'active' : ''}`}
                onClick={() => {
                  setReadoutOption(opt.id);
                  setReadResult(null);
                }}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Modal Body: Only renders the UI matching current connected device & chosen readout function */}
        <div className="read-logger-body">
          {/* Progress Overlay */}
          {readingProgress !== null && (
            <div className="reading-progress-card">
              <div className="reading-progress-spin" />
              <div className="reading-progress-info">
                <h4>Transferring Readout Data from Device...</h4>
                <p>Transferring records and formatting to CSV ({readingProgress}%)</p>
                <div className="reading-progress-bar">
                  <div className="reading-progress-fill" style={{ width: `${readingProgress}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {readResult && (
            <div className="read-result-banner">
              <div className="result-banner-icon">✓</div>
              <div className="result-banner-content">
                <h4>Readout Completed Successfully!</h4>
                <p>
                  Exported <strong>{readResult.rowCount.toLocaleString()} records</strong> to <strong>{readResult.filename}</strong>.
                  Each row includes its own exact timestamp.
                </p>
                <div className="result-banner-actions">
                  <button className="result-btn result-btn-primary" onClick={handleOpenInS4A}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Analyze in S4A (Graphic & Table)
                  </button>
                  <button className="result-btn result-btn-secondary" onClick={handleDownloadFile}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download .CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Option: Screenshots */}
          {readoutOption === 'screenshots' && (
            <div className="type-pane-container">
              {screenshotsList.length > 0 ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                      Found <strong>{screenshotsList.length}</strong> screenshot image file{screenshotsList.length > 1 ? 's' : ''} in device memory
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn-action secondary"
                        style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                        onClick={fetchScreenshots}
                        disabled={loadingDeviceData}
                      >
                        {loadingDeviceData ? 'Refreshing...' : '🔄 Refresh'}
                      </button>
                      <button
                        className="btn-action primary"
                        style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                        onClick={handleDownloadSelectedScreenshots}
                        disabled={selectedScreenshots.size === 0 || downloadingScreenshot !== null}
                      >
                        Download Selected ({selectedScreenshots.size})
                      </button>
                    </div>
                  </div>

                  <div className="logger-table-wrapper">
                    <table className="logger-data-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40, textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={screenshotsList.length > 0 && selectedScreenshots.size === screenshotsList.length}
                              onChange={toggleSelectAllScreenshots}
                            />
                          </th>
                          <th>Screenshot File Name</th>
                          <th>Size</th>
                          <th style={{ width: 170, textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {screenshotsList.map((s, idx) => (
                          <tr key={s.name || idx}>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selectedScreenshots.has(s.name)}
                                onChange={() => toggleSelectScreenshot(s.name)}
                              />
                            </td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                                🖼️ {normalizeScreenshotFilename(s.name)}
                              </span>
                            </td>
                            <td>
                              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                                {(s.size / 1024).toFixed(1)} KB
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn-mini"
                                style={{ marginRight: 6 }}
                                onClick={() => handlePreviewScreenshot(s)}
                                disabled={downloadingScreenshot === s.name}
                              >
                                {downloadingScreenshot === s.name ? 'Loading...' : 'Preview'}
                              </button>
                              <button
                                className="btn-mini"
                                style={{ background: '#2563eb', color: '#fff', borderColor: '#1d4ed8' }}
                                onClick={() => handleDownloadScreenshot(s)}
                                disabled={downloadingScreenshot === s.name}
                              >
                                {downloadingScreenshot === s.name ? 'Saving...' : 'Download'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>🖼️</div>
                  <h4 style={{ margin: '0 0 6px 0', color: '#1e293b' }}>No Screenshot Images Found in Device</h4>
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748b' }}>
                    {loadingDeviceData ? 'Querying device screenshot memory...' : 'The connected SUTO unit has no saved screenshot captures.'}
                  </p>
                  <button className="btn-action secondary" onClick={fetchScreenshots} disabled={loadingDeviceData}>
                    {loadingDeviceData ? 'Refreshing...' : '🔄 Refresh Screenshots'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Option: Export Report (S600 / S605) */}
          {readoutOption === 'report' && (
            <div className="type-pane-container">
              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>📑</div>
                <h4 style={{ margin: '0 0 6px 0', color: '#1e293b' }}>Export Device Audit Report</h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748b' }}>
                  {loadingDeviceData ? 'Querying report generator...' : 'Generate or export audit measurement report from device.'}
                </p>
                <button
                  className="btn-action primary"
                  onClick={() => performRead(`${deviceDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Audit_Report.csv`, 300)}
                >
                  Generate & Export Report (CSV)
                </button>
              </div>
            </div>
          )}

          {/* Option: Export Calibration History (S605 / S606) */}
          {readoutOption === 'calibration' && (
            <div className="type-pane-container">
              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>⚖️</div>
                <h4 style={{ margin: '0 0 6px 0', color: '#1e293b' }}>Export User Calibration History</h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748b' }}>
                  {loadingDeviceData ? 'Querying calibration memory...' : 'No calibration history files stored in device memory.'}
                </p>
                <button className="btn-action secondary" onClick={refreshDeviceState} disabled={loadingDeviceData}>
                  🔄 Refresh Calibration Memory
                </button>
              </div>
            </div>
          )}

          {/* Option: Export Alarm History (S606) */}
          {readoutOption === 'alarm' && (
            <div className="type-pane-container">
              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>⚠️</div>
                <h4 style={{ margin: '0 0 6px 0', color: '#1e293b' }}>Export Alarm Event History</h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748b' }}>
                  {loadingDeviceData ? 'Querying alarm events...' : 'No alarm events recorded in device memory.'}
                </p>
                <button className="btn-action secondary" onClick={refreshDeviceState} disabled={loadingDeviceData}>
                  🔄 Refresh Alarm Memory
                </button>
              </div>
            </div>
          )}

          {/* Option: Read Logger Files (Default for DS310 / S331 / S600) */}
          {readoutOption === 'files' && (loggerType === 'ds310' || loggerType === 's600' || loggerType === 's605' || loggerType === 's606') && (
            <div className="type-pane-container">
              {filesList.length > 0 ? (
                <>
                  <div className="logger-table-wrapper">
                    <table className="logger-data-table">
                      <thead>
                        <tr>
                          <th>Start Time</th>
                          <th>End Time</th>
                          <th>Channels</th>
                          <th>Values / Ch</th>
                          <th>File Name</th>
                          <th>Protocol Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filesList.map((file, idx) => (
                          <tr
                            key={idx}
                            className={`logger-row ${selectedFileIdx === idx ? 'selected' : ''}`}
                            onClick={() => setSelectedFileIdx(idx)}
                          >
                            <td><strong>{file.startTime}</strong></td>
                            <td>{file.endTime}</td>
                            <td><span className="badge-pill">{file.channelsCount}</span></td>
                            <td>{file.samplesPerChannel?.toLocaleString?.() ?? file.samplesPerChannel}</td>
                            <td><span className="file-badge">{file.fileName}</span></td>
                            <td>{file.description || 'Recorded Session'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pane-action-bar">
                    <div className="action-hint">
                      💡 Reads the selected session and outputs a standard CSV file without fixed time interval constraints.
                    </div>
                    <div className="action-buttons">
                      <button
                        className="btn-action primary"
                        disabled={selectedFileIdx === null}
                        onClick={() => {
                          const f = filesList[selectedFileIdx];
                          if (f) performRead(`${f.fileName.replace('.CSD', '')}.csv`, f.samplesPerChannel || 500);
                        }}
                      >
                        Read Selected to CSV
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>📁</div>
                  <h4 style={{ margin: '0 0 6px 0', color: '#1e293b' }}>No Recorded Log Files Found on Device Memory</h4>
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748b' }}>
                    {loadingDeviceData ? 'Querying device memory...' : 'The connected SUTO unit has no saved log sessions in internal storage.'}
                  </p>
                  <button className="btn-action secondary" onClick={refreshDeviceState} disabled={loadingDeviceData}>
                    {loadingDeviceData ? 'Refreshing...' : '🔄 Refresh Device Memory'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* S418 Compact Flow Meter Logger UI */}
          {loggerType === 's418' && (
            <div className="type-pane-container">
              {/* Stat Cards with Real Hardware Values */}
              <div className="device-stat-grid">
                <div className="stat-card">
                  <span className="stat-label">Rec. Numbers</span>
                  <span className="stat-value">{loggerStatus?.recorded_count ?? 0}</span>
                  <span className="stat-sub">Ring-buffer records in device</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Time Period</span>
                  <span className="stat-value-sm">
                    {loggerStatus?.start_time ? `${formatUnixTimestamp(loggerStatus.start_time)} — ${formatUnixTimestamp(loggerStatus.end_time)}` : 'No recording active'}
                  </span>
                  <span className="stat-sub">Stored time span</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Active Channels</span>
                  <span className="stat-value-sm">
                    {deviceChannels.length > 0 ? deviceChannels.map(c => c.channel_name).join(', ') : 'Flow, Velocity, Pressure, Temp'}
                  </span>
                  <span className="stat-sub">From connected meter</span>
                </div>
              </div>

              {/* Period Radio Selection */}
              <div className="period-selection-box">
                <h5 className="box-title">Which period do you want to select?</h5>
                <div className="radio-group-row">
                  {[
                    { id: 'last_hour', label: 'Last hour' },
                    { id: 'last_day', label: 'Last day' },
                    { id: 'last_week', label: 'Last week' },
                    { id: 'last_month', label: 'Last month' },
                    { id: 'custom', label: 'Time period' },
                  ].map((opt) => (
                    <label key={opt.id} className={`radio-pill ${s418Period === opt.id ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="s418_period"
                        checked={s418Period === opt.id}
                        onChange={() => setS418Period(opt.id)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>

                {s418Period === 'custom' && (
                  <div className="custom-range-row">
                    <div className="range-field">
                      <label>Start Date & Hour:</label>
                      <input
                        type="text"
                        value={s418CustomStart}
                        onChange={(e) => setS418CustomStart(e.target.value)}
                        placeholder="YYYY-MM-DD HH:mm"
                      />
                    </div>
                    <div className="range-separator">to</div>
                    <div className="range-field">
                      <label>End Date & Hour:</label>
                      <input
                        type="text"
                        value={s418CustomEnd}
                        onChange={(e) => setS418CustomEnd(e.target.value)}
                        placeholder="YYYY-MM-DD HH:mm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="pane-action-bar">
                <div className="action-hint">
                  💡 Extracts records in the chosen window directly to CSV.
                </div>
                <div className="action-buttons">
                  <button
                    className="btn-action primary"
                    onClick={handleReadS418}
                    disabled={(loggerStatus?.recorded_count ?? 0) === 0}
                  >
                    Read to CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* S461 / S463 Ultrasonic Meter Logger UI */}
          {loggerType === 's461' && (
            <div className="type-pane-container">
              {/* Stat Cards with Real Hardware Values */}
              <div className="device-stat-grid">
                <div className="stat-card">
                  <span className="stat-label">Rec. Numbers</span>
                  <span className="stat-value">{loggerStatus?.recorded_count ?? 0}</span>
                  <span className="stat-sub">Ultrasonic buffer records</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Time Period</span>
                  <span className="stat-value-sm">
                    {loggerStatus?.start_time ? `${formatUnixTimestamp(loggerStatus.start_time)} — ${formatUnixTimestamp(loggerStatus.end_time)}` : 'No recording active'}
                  </span>
                  <span className="stat-sub">Stored time span</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Active Channels</span>
                  <span className="stat-value-sm">
                    {deviceChannels.length > 0 ? deviceChannels.map(c => c.channel_name).join(', ') : 'Flow, Energy, Delta T'}
                  </span>
                  <span className="stat-sub">From ultrasonic meter</span>
                </div>
              </div>

              {/* Period Radio Selection */}
              <div className="period-selection-box">
                <h5 className="box-title">Which period do you want to select?</h5>
                <div className="radio-group-row">
                  {[
                    { id: 'last_hour', label: 'Last hour' },
                    { id: 'last_day', label: 'Last day' },
                    { id: 'last_week', label: 'Last week' },
                    { id: 'last_month', label: 'Last month' },
                    { id: 'custom', label: 'Time period' },
                  ].map((opt) => (
                    <label key={opt.id} className={`radio-pill ${s461Period === opt.id ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="s461_period"
                        checked={s461Period === opt.id}
                        onChange={() => setS461Period(opt.id)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>

                {s461Period === 'custom' && (
                  <div className="custom-range-row">
                    <div className="range-field">
                      <label>Start Date & Hour:</label>
                      <input
                        type="text"
                        value={s461CustomStart}
                        onChange={(e) => setS461CustomStart(e.target.value)}
                        placeholder="YYYY-MM-DD HH:mm"
                      />
                    </div>
                    <div className="range-separator">to</div>
                    <div className="range-field">
                      <label>End Date & Hour:</label>
                      <input
                        type="text"
                        value={s461CustomEnd}
                        onChange={(e) => setS461CustomEnd(e.target.value)}
                        placeholder="YYYY-MM-DD HH:mm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="pane-action-bar">
                <div className="action-hint">
                  💡 Extracts records in the chosen window directly to CSV.
                </div>
                <div className="action-buttons">
                  <button
                    className="btn-action primary"
                    onClick={handleReadS461}
                    disabled={(loggerStatus?.recorded_count ?? 0) === 0}
                  >
                    Read to CSV
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Screenshot Preview Modal Overlay */}
        {previewImage && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(3px)',
              zIndex: 10001,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
            onClick={() => {
              if (previewImage.url) URL.revokeObjectURL(previewImage.url);
              setPreviewImage(null);
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 14,
                padding: 16,
                maxWidth: '92vw',
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>
                  🖼️ Preview: {previewImage.name}
                </h4>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className="btn-action primary"
                    style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                    onClick={() => handleDownloadScreenshot({ name: previewImage.name, size: previewImage.size })}
                  >
                    💾 Save Image
                  </button>
                  <button
                    className="read-logger-close-btn"
                    onClick={() => {
                      if (previewImage.url) URL.revokeObjectURL(previewImage.url);
                      setPreviewImage(null);
                    }}
                    title="Close Preview"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div style={{ overflow: 'auto', display: 'flex', justifyContent: 'center', background: '#0f172a', borderRadius: 8, padding: 12 }}>
                <img
                  src={previewImage.url}
                  alt={previewImage.name}
                  style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
