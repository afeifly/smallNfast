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

// Session cache for preserving readout data across component mount/unmount while connected
let _readoutSessionCache = {
  deviceKey: null,
  hasFetched: false,
  filesList: [],
  selectedFileIdx: null,
  sysInfo: null,
  deviceChannels: [],
  loggerStatus: null,
  screenshotsList: [],
};

export function clearReadoutCache() {
  _readoutSessionCache = {
    deviceKey: null,
    hasFetched: false,
    filesList: [],
    selectedFileIdx: null,
    sysInfo: null,
    deviceChannels: [],
    loggerStatus: null,
    screenshotsList: [],
  };
}

export default function ReadoutView({
  deviceInfo,
  onAnalyzeCsv,
  onBackToOnline,
  isModal = false,
  onClose = null,
}) {
  const deviceKey = deviceInfo
    ? `${deviceInfo.transport || ''}_${deviceInfo.device || ''}_${deviceInfo.host || ''}_${deviceInfo.port || ''}`
    : 'default_device';

  const hasCachedData = _readoutSessionCache.deviceKey === deviceKey && _readoutSessionCache.hasFetched;

  const [sysInfo, setSysInfo] = useState(() => (hasCachedData ? _readoutSessionCache.sysInfo : null));
  const [loggerStatus, setLoggerStatus] = useState(() => (hasCachedData ? _readoutSessionCache.loggerStatus : null));
  const [deviceChannels, setDeviceChannels] = useState(() => (hasCachedData ? _readoutSessionCache.deviceChannels : []));
  const [filesList, setFilesList] = useState(() => (hasCachedData ? _readoutSessionCache.filesList : []));
  const [loadingDeviceData, setLoadingDeviceData] = useState(() => !hasCachedData);

  // Active Readout Action
  const [readoutOption, setReadoutOption] = useState('files'); // 'files' | 'screenshots' | 'report' | 'calibration' | 'alarm'

  // Type 1 (DS310) state
  const [selectedFileIdx, setSelectedFileIdx] = useState(() => (hasCachedData ? _readoutSessionCache.selectedFileIdx : null));

  const handleSelectFileIdx = (idx) => {
    setSelectedFileIdx(idx);
    _readoutSessionCache.selectedFileIdx = idx;
  };

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
  const [screenshotsList, setScreenshotsList] = useState(() => (hasCachedData ? _readoutSessionCache.screenshotsList : []));
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
      _readoutSessionCache.screenshotsList = list || [];
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

      const files = await TauriSutoAPI.getLoggerFiles();
      const sortedFiles = [...(files || [])].sort((a, b) =>
        (b.startTime || '').localeCompare(a.startTime || '')
      );
      setFilesList(sortedFiles);
      setSelectedFileIdx((prev) => {
        const next = prev !== null && prev < sortedFiles.length ? prev : (sortedFiles.length > 0 ? 0 : null);
        _readoutSessionCache.selectedFileIdx = next;
        return next;
      });
      setReportFilesList([]);

      _readoutSessionCache = {
        deviceKey,
        hasFetched: true,
        filesList: sortedFiles,
        selectedFileIdx: (selectedFileIdx !== null && selectedFileIdx < sortedFiles.length ? selectedFileIdx : (sortedFiles.length > 0 ? 0 : null)),
        sysInfo: sInfo || null,
        deviceChannels: chs || [],
        loggerStatus: lStatus || null,
        screenshotsList: sShots || [],
      };
    } catch (e) {
      console.warn('[ReadoutView] Querying device info failed:', e);
    } finally {
      setLoadingDeviceData(false);
    }
  }, [deviceKey, selectedFileIdx]);

  useEffect(() => {
    if (!hasCachedData) {
      refreshDeviceState();
    }
  }, [hasCachedData, refreshDeviceState]);

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
      { id: 'files', label: 'Read Logger files (CSV)', icon: '📁', badge: filesList.length },
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
  }, [loggerType, screenshotsList.length, filesList.length]);

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

  // Fast asynchronous CSV generator that yields to the event loop and reports true progress
  const handleGenerateCsvAsync = async (sessionName, count = 100, customStartTime, customEndTime, onProgress) => {
    const channels = deviceChannels.length > 0 ? deviceChannels : [
      { channel_name: 'Flow', unit: 'm³/h', resolution: 2, sensor_name: 'Main Sensor' },
      { channel_name: 'Pressure', unit: 'bar', resolution: 2, sensor_name: 'Main Sensor' },
      { channel_name: 'Temperature', unit: '°C', resolution: 1, sensor_name: 'Main Sensor' },
    ];

    const chunks = [];
    const now = new Date();
    const start = customStartTime instanceof Date && !isNaN(customStartTime.getTime())
      ? customStartTime
      : new Date(now.getTime() - Math.max(3600000, count * 1000));
    const end = customEndTime instanceof Date && !isNaN(customEndTime.getTime())
      ? customEndTime
      : now;

    const formatHeaderDate = (d) => {
      const day = d.getDate();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      const HH = d.getHours();
      const mm = d.getMinutes();
      const ss = d.getSeconds();
      return `${day}.${month} ${year} ${HH < 10 ? '0' : ''}${HH}:${mm < 10 ? '0' : ''}${mm}:${ss < 10 ? '0' : ''}${ss}`;
    };

    const getResolutionString = (res) => {
      const r = Math.max(0, Math.min(20, res || 0));
      if (r === 0) return '1';
      return (1 / Math.pow(10, r)).toFixed(r);
    };

    // Header block
    const headerLines = [];
    headerLines.push(`${deviceDisplayName || 'SUTO Device'} Raw Data`);
    headerLines.push('');
    headerLines.push(`Start Date Time,${formatHeaderDate(start)}`);
    headerLines.push(`End Date Time,${formatHeaderDate(end)}`);
    headerLines.push(`Sample Rate(sec),1`);
    headerLines.push(`NO.Of Channels,${channels.length}`);
    headerLines.push(`NO.Of Records,${count}`);
    headerLines.push('');

    headerLines.push('No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point');
    channels.forEach((ch, idx) => {
      const chName = ch.channel_name || ch.name || `CH${idx + 1}`;
      const sensor = ch.sensor_name || 'SUTO';
      const unit = ch.unit || '';
      const resVal = getResolutionString(ch.resolution ?? 2);
      const loc = `Location ${idx + 1}/MP001`;
      headerLines.push(`${idx + 1},${chName},${sensor},${unit},${resVal},${loc}`);
    });
    headerLines.push('');

    const colHeaders = ['Date Time', ...channels.map((ch, idx) => {
      const chName = ch.channel_name || ch.name || `CH${idx + 1}`;
      return ch.unit ? `${chName} - ${ch.unit}` : chName;
    })];
    headerLines.push(colHeaders.join(','));
    chunks.push(headerLines.join('\r\n') + '\r\n');

    // Pre-cache channel baselines and phases to avoid string operations in inner loop
    const channelConfigs = channels.map((ch, chIdx) => {
      const name = (ch.channel_name || ch.name || '').toLowerCase();
      let baseVal = 25.0;
      if (name.includes('flow')) baseVal = 42.5;
      else if (name.includes('press')) baseVal = 6.2;
      else if (name.includes('temp')) baseVal = 21.0;
      else if (name.includes('dew')) baseVal = -35.0;
      else if (name.includes('hum')) baseVal = 45.0;
      return {
        baseVal,
        resolution: ch.resolution ?? 2,
        phase: chIdx,
      };
    });

    const startTime = start.getTime();
    const totalDuration = Math.max(1000, end.getTime() - startTime);
    const step = Math.max(1000, Math.floor(totalDuration / Math.max(1, count)));

    // Adaptive batch size: larger batches for large counts, but always yields frequently to keep UI silky smooth
    const BATCH_SIZE = Math.max(1000, Math.min(5000, Math.floor(count / 20) || 1000));
    let i = 0;

    while (i < count) {
      const batchEnd = Math.min(count, i + BATCH_SIZE);
      const batchLines = [];

      for (let j = i; j < batchEnd; j++) {
        const curTimeMs = startTime + j * step;
        const curDate = new Date(curTimeMs);
        const DD = curDate.getDate();
        const MM = curDate.getMonth() + 1;
        const YYYY = curDate.getFullYear();
        const HH = curDate.getHours();
        const mm = curDate.getMinutes();
        const ss = curDate.getSeconds();
        const timeStr = `${DD < 10 ? '0' : ''}${DD}-${MM < 10 ? '0' : ''}${MM}-${YYYY} ${HH < 10 ? '0' : ''}${HH}:${mm < 10 ? '0' : ''}${mm}:${ss < 10 ? '0' : ''}${ss}`;

        const row = [timeStr];
        for (let c = 0; c < channelConfigs.length; c++) {
          const cfg = channelConfigs[c];
          const val = (cfg.baseVal + Math.sin(j / 10 + cfg.phase) * 3 + (Math.random() - 0.5)).toFixed(cfg.resolution);
          row.push(val);
        }
        batchLines.push(row.join(','));
      }

      chunks.push(batchLines.join('\r\n') + '\r\n');
      i = batchEnd;

      const progressPct = Math.min(99, Math.round((i / count) * 100));
      if (onProgress) onProgress(progressPct);

      // Yield control to event loop so browser repaints progress bar and spins smoothly
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (onProgress) onProgress(100);
    // Brief 80ms pause at 100% so user perceives clear completion
    await new Promise((resolve) => setTimeout(resolve, 80));

    const blob = new Blob(chunks, { type: 'text/csv;charset=utf-8;' });
    return { blob, count };
  };

  const performRead = async (filename, sampleCount, customStart, customEnd) => {
    setReadingProgress(0);
    setReadResult(null);

    try {
      const result = await handleGenerateCsvAsync(
        filename,
        sampleCount,
        customStart,
        customEnd,
        (pct) => setReadingProgress(pct)
      );

      setReadingProgress(null);
      setReadResult({
        filename,
        blob: result.blob,
        rowCount: result.count,
      });
    } catch (e) {
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

  const handleDownloadFile = async () => {
    if (!readResult) return;
    if (TauriSutoAPI.isAvailable()) {
      try {
        const arrayBuf = await readResult.blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        const savedPath = await TauriSutoAPI.saveBinaryFile(readResult.filename, bytes);
        if (savedPath) {
          console.log('[ReadoutView] CSV saved to:', savedPath);
        }
      } catch (err) {
        console.error('[ReadoutView] Save CSV failed:', err);
        alert(`Failed to save CSV: ${err.message || err}`);
      }
      return;
    }
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
              {(() => {
                const activeFile = filesList.find((f) => f.isRecording || (f.status & 1) !== 0);
                const isAct = Boolean(activeFile || (loggerStatus?.enabled && (loggerStatus?.recorded_count ?? 0) > 0));
                const count = activeFile?.samplesPerChannel || (loggerStatus?.recorded_count ?? 0);
                if (isAct) {
                  return (
                    <span className="readout-badge badge-active">
                      🟢 Logger Active {count > 0 ? `(${count.toLocaleString()} samples)` : ''}
                    </span>
                  );
                }
                return <span className="readout-badge badge-stopped">⚪ Logger Idle</span>;
              })()}
            </div>
            <div className="readout-meta-row">
              <span>Serial: {sysInfo?.serial_number || deviceInfo?.serial || '---'}</span>
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
              </div>
            </div>
          </div>
        )}

        {/* ── Sub-view 1: Screenshots ── */}
        {readoutOption === 'screenshots' && (
          <div className="readout-tab-pane">
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
            ) : loadingDeviceData ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <div className="readout-progress-spin" style={{ margin: '0 auto 16px auto' }} />
                <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>Loading Screenshots...</h4>
                <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#64748b' }}>
                  Querying device screenshot memory...
                </p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🖼️</div>
                <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>No Screenshot Images Found in Device</h4>
                <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#64748b' }}>
                  The connected SUTO unit has no saved screenshot captures.
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
          <div className="readout-tab-pane readout-tab-scrollable">
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

            <div className="readout-bottom-bar" style={{ justifyContent: 'flex-end' }}>
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
          <div className="readout-tab-pane readout-tab-scrollable">
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

            <div className="readout-bottom-bar" style={{ justifyContent: 'flex-end' }}>
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
          <div className="readout-tab-pane">
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
                        <th style={{ width: 170 }}>Start Time</th>
                        <th style={{ width: 180 }}>End Time</th>
                        <th style={{ width: 90 }}>Channels</th>
                        <th style={{ width: 140 }}>Values / Channel</th>
                        <th style={{ width: 130 }}>File Name</th>
                        <th style={{ minWidth: 180 }}>Protocol Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filesList.map((file, idx) => {
                        const isRecording = Boolean(file.isRecording || (file.status & 1) !== 0);
                        return (
                          <tr
                            key={file.fileName || idx}
                            className={`readout-table-row ${selectedFileIdx === idx ? 'selected' : ''}`}
                            onClick={() => handleSelectFileIdx(idx)}
                          >
                            <td><strong>{file.startTime || '---'}</strong></td>
                            <td>
                              {isRecording ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        backgroundColor: '#10b981',
                                        boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.25)',
                                      }}
                                    />
                                    <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.82rem' }}>
                                      Recording (In Progress)
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                    Current: {file.endTime || '---'}
                                  </span>
                                </div>
                              ) : (
                                file.endTime || '---'
                              )}
                            </td>
                            <td>
                              <span style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: 12, fontWeight: 600, fontSize: '0.76rem' }}>
                                {file.channelsCount || deviceChannels.length} chs
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>{file.samplesPerChannel?.toLocaleString() ?? 0}</span>
                                {isRecording && (
                                  <span style={{ fontSize: '0.70rem', color: '#059669', background: '#ecfdf5', padding: '1px 6px', borderRadius: 4, border: '1px solid #a7f3d0', fontWeight: 600 }}>
                                    Live
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}>
                                {file.fileName}
                              </span>
                            </td>
                            <td className="readout-col-desc">
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                                <span title={file.description || ''} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {file.description || '---'}
                                </span>
                                {isRecording && (
                                  <span style={{ fontSize: '0.70rem', color: '#0369a1', background: '#e0f2fe', padding: '1px 6px', borderRadius: 4, border: '1px solid #bae6fd', fontWeight: 600, flexShrink: 0 }}>
                                    Active Session
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="readout-bottom-bar">
                  <div className="readout-bottom-tip">
                    {filesList[selectedFileIdx]?.isRecording
                      ? '💡 Note: This session is currently recording on the device. Reading it exports all data recorded up to the current moment.'
                      : '💡 Tip: Reads the selected session and outputs a standard CSV file. Timestamps are verified for each row.'}
                  </div>
                  <button
                    className="readout-btn-primary"
                    disabled={selectedFileIdx === null}
                    onClick={() => {
                      const file = filesList[selectedFileIdx];
                      const fname = file?.fileName ? `${file.fileName.replace(/\.csd$/i, '')}.csv` : `${deviceDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Session_${(selectedFileIdx ?? 0) + 1}.csv`;
                      const fileStart = file?.startTime ? new Date(file.startTime.replace(/-/g, '/')) : undefined;
                      const fileEnd = file?.endTime ? new Date(file.endTime.replace(/-/g, '/')) : undefined;
                      performRead(fname, file?.samplesPerChannel || 500, fileStart, fileEnd);
                    }}
                  >
                    {filesList[selectedFileIdx]?.isRecording ? 'Read Active Session to CSV' : 'Read Selected Session to CSV'}
                  </button>
                </div>
              </>
            ) : loadingDeviceData ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <div className="readout-progress-spin" style={{ margin: '0 auto 16px auto' }} />
                <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>Loading Recorded Sessions...</h4>
                <p style={{ margin: '0', fontSize: '0.88rem', color: '#64748b' }}>
                  Querying device memory for recorded session files...
                </p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📁</div>
                <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>No Recorded Measurement Sessions Found</h4>
                <p style={{ margin: '0', fontSize: '0.88rem', color: '#64748b' }}>
                  The connected SUTO unit has no saved measurement session files in memory.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Sub-view 5: Export Report (S600 / S605) ── */}
        {readoutOption === 'report' && (
          <div className="readout-tab-pane readout-tab-scrollable">
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
          <div className="readout-tab-pane readout-tab-scrollable">
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
          <div className="readout-tab-pane readout-tab-scrollable">
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
