import React, { useState, useEffect, useMemo, useCallback } from 'react';
import TauriSutoAPI from '../../api/TauriSutoAPI';
import { resolveDeviceTypeName } from '../../util/platform';
import { getOnlineCache } from '../onlineview/OnlineView';
import { resolveLoggerType, isS332Family, _readoutSessionCache, updateReadoutCache } from './readoutSession';
import './ReadoutView.css';

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

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function formatDuration(sec) {
  if (!sec || sec <= 0) return '0s';
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
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

function getRelativeTimeString(date) {
  if (!date || isNaN(date.getTime())) return '';
  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);
  if (diffSec < 0) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffDay / 365)}y ago`;
}

function parseScreenshotTime(item) {
  if (!item) return { timestamp: 0, formatted: '---', relative: '' };

  if (item.date && typeof item.date === 'number') {
    const d = new Date(item.date > 1e11 ? item.date : item.date * 1000);
    return {
      timestamp: d.getTime(),
      formatted: formatUnixTimestamp(d.getTime() / 1000),
      relative: getRelativeTimeString(d),
    };
  }

  const name = item.name || '';

  // Pattern 1: YYYY-MM-DD[_ ]HH-MM-SS or YYYY-MM-DD[_ ]HH:MM:SS
  const match1 = name.match(/(\d{4})[-_.](\d{2})[-_.](\d{2})[-_ T](\d{2})[-_:.](\d{2})(?:[-_:.](\d{2}))?/);
  if (match1) {
    const year = parseInt(match1[1], 10);
    const month = parseInt(match1[2], 10) - 1;
    const day = parseInt(match1[3], 10);
    const hour = parseInt(match1[4], 10);
    const min = parseInt(match1[5], 10);
    const sec = match1[6] ? parseInt(match1[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) {
      return {
        timestamp: d.getTime(),
        formatted: formatUnixTimestamp(d.getTime() / 1000),
        relative: getRelativeTimeString(d),
      };
    }
  }

  // Pattern 2: YYYYMMDD[_ ]HHMMSS
  const match2 = name.match(/(\d{4})(\d{2})(\d{2})[-_ T](\d{2})(\d{2})(\d{2})/);
  if (match2) {
    const year = parseInt(match2[1], 10);
    const month = parseInt(match2[2], 10) - 1;
    const day = parseInt(match2[3], 10);
    const hour = parseInt(match2[4], 10);
    const min = parseInt(match2[5], 10);
    const sec = parseInt(match2[6], 10);
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) {
      return {
        timestamp: d.getTime(),
        formatted: formatUnixTimestamp(d.getTime() / 1000),
        relative: getRelativeTimeString(d),
      };
    }
  }

  // Pattern 3: YYYY-MM-DD or YYYYMMDD
  const match3 = name.match(/(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})/);
  if (match3 && parseInt(match3[1], 10) >= 2000 && parseInt(match3[1], 10) <= 2099) {
    const year = parseInt(match3[1], 10);
    const month = parseInt(match3[2], 10) - 1;
    const day = parseInt(match3[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return {
        timestamp: d.getTime(),
        formatted: `${match3[1]}-${match3[2]}-${match3[3]}`,
        relative: getRelativeTimeString(d),
      };
    }
  }

  // Fallback: If sequential index exists
  const numMatch = name.match(/(\d+)/);
  const seq = typeof item.index === 'number' ? item.index : (numMatch ? parseInt(numMatch[1], 10) : 0);
  return {
    timestamp: seq,
    formatted: `Index #${seq + 1}`,
    relative: '',
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
    ? `${deviceInfo.transport || ''}_${deviceInfo.device || ''}_${deviceInfo.host || ''}_${deviceInfo.port || ''}_${deviceInfo.address ?? ''}`
    : 'default_device';

  const hasCachedData = _readoutSessionCache.deviceKey === deviceKey && _readoutSessionCache.hasFetched;

  const [sysInfo, setSysInfo] = useState(() => (hasCachedData ? _readoutSessionCache.sysInfo : null));
  const [loggerStatus, setLoggerStatus] = useState(() => (hasCachedData ? _readoutSessionCache.loggerStatus : null));
  const [deviceChannels, setDeviceChannels] = useState(() => (hasCachedData ? _readoutSessionCache.deviceChannels : []));
  const [filesList, setFilesList] = useState(() => (hasCachedData ? _readoutSessionCache.filesList : []));
  const [diskCapacity, setDiskCapacity] = useState(() => (hasCachedData ? _readoutSessionCache.diskCapacity : null));
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
  const [s461Period, setS461Period] = useState('last_hour');
  const [s461StartDate, setS461StartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [s461StartHour, setS461StartHour] = useState('0');
  const [s461EndDate, setS461EndDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [s461EndHour, setS461EndHour] = useState(() => {
    return String(new Date().getHours());
  });

  // Read progress and results
  const [readingProgress, setReadingProgress] = useState(null);
  const [readResult, setReadResult] = useState(null);

  // Screenshots state
  const [screenshotsList, setScreenshotsList] = useState(() => (
    hasCachedData && Array.isArray(_readoutSessionCache?.screenshotsList)
      ? _readoutSessionCache.screenshotsList
      : []
  ));
  const [selectedScreenshots, setSelectedScreenshots] = useState(new Set());
  const [downloadingScreenshot, setDownloadingScreenshot] = useState(null);
  const [previewImage, setPreviewImage] = useState(null); // { name, url }

  // Report state
  const [reportFilesList, setReportFilesList] = useState([]);
  const [selectedReportIdx, setSelectedReportIdx] = useState(0);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportStatusMsg, setReportStatusMsg] = useState('');
  const [reportSortKey, setReportSortKey] = useState('time');
  const [reportSortDir, setReportSortDir] = useState('desc');

  // Fetch screenshots from device memory
  const fetchScreenshots = useCallback(async () => {
    if (TauriSutoAPI.getActiveTransport() === 'API') return;
    setLoadingDeviceData(true);
    try {
      const list = await TauriSutoAPI.getScreenshots();
      const safeList = Array.isArray(list) ? list : [];
      setScreenshotsList(safeList);
      setSelectedScreenshots(new Set());
      _readoutSessionCache.screenshotsList = safeList;
    } catch (e) {
      console.warn('[ReadoutView] Querying screenshots failed:', e);
      setScreenshotsList([]);
    } finally {
      setLoadingDeviceData(false);
    }
  }, []);

  // Fetch S600 CSD sessions for report generation
  const fetchReportFiles = useCallback(async () => {
    if (TauriSutoAPI.getActiveTransport() === 'API') return;
    setLoadingDeviceData(true);
    setReportStatusMsg('');
    try {
      const csdList = await TauriSutoAPI.get600CsdFiles();
      let list = [];
      if (Array.isArray(csdList) && csdList.length > 0) {
        list = [...csdList];
      } else if (Array.isArray(filesList) && filesList.length > 0) {
        list = filesList.map((f, idx) => ({
          id: idx,
          name: f.fileName,
          size: (f.samplesPerChannel || 0) * (f.channelsCount || 1) * 4,
          date: f.startTime ? Math.floor(new Date(f.startTime.replace(/-/g, '/')).getTime() / 1000) : 0,
          date_str: f.startTime || '',
        }));
      }

      // Order by start time desc (newest first)
      list.sort((a, b) => {
        const timeA = a.date || (a.date_str ? new Date(a.date_str.replace(/-/g, '/')).getTime() : 0);
        const timeB = b.date || (b.date_str ? new Date(b.date_str.replace(/-/g, '/')).getTime() : 0);
        if (timeB !== timeA) return timeB - timeA;
        return (b.id ?? 0) - (a.id ?? 0);
      });

      setReportFilesList(list);
      setSelectedReportIdx(0);
    } catch (e) {
      console.warn('[ReadoutView] Querying S600 CSD report files failed:', e);
      setReportFilesList([]);
    } finally {
      setLoadingDeviceData(false);
    }
  }, [filesList]);

  // Memoized screenshots ordered by time desc (newest first) as default and only order
  const sortedScreenshots = useMemo(() => {
    if (!Array.isArray(screenshotsList)) return [];
    const list = [...screenshotsList];
    list.sort((a, b) => {
      const timeA = parseScreenshotTime(a).timestamp;
      const timeB = parseScreenshotTime(b).timestamp;
      return timeB - timeA;
    });
    return list;
  }, [screenshotsList]);

  // Keyboard navigation for screenshot preview modal (Escape, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (!previewImage) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPreviewImage(null);
      } else if (e.key === 'ArrowLeft') {
        const idx = sortedScreenshots.findIndex(
          (s) => s.name === previewImage.originalName || s.name === previewImage.name
        );
        if (idx > 0 && downloadingScreenshot === null) {
          handlePreviewScreenshot(sortedScreenshots[idx - 1]);
        }
      } else if (e.key === 'ArrowRight') {
        const idx = sortedScreenshots.findIndex(
          (s) => s.name === previewImage.originalName || s.name === previewImage.name
        );
        if (idx >= 0 && idx < sortedScreenshots.length - 1 && downloadingScreenshot === null) {
          handlePreviewScreenshot(sortedScreenshots[idx + 1]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage, sortedScreenshots, downloadingScreenshot]);

  // Memoized sorted report files
  const sortedReportFiles = useMemo(() => {
    if (!Array.isArray(reportFilesList)) return [];
    const list = [...reportFilesList];
    list.sort((a, b) => {
      const timeA = a.date || (a.date_str ? new Date(a.date_str.replace(/-/g, '/')).getTime() : 0);
      const timeB = b.date || (b.date_str ? new Date(b.date_str.replace(/-/g, '/')).getTime() : 0);
      if (reportSortKey === 'time') {
        return reportSortDir === 'desc' ? timeB - timeA : timeA - timeB;
      }
      if (reportSortKey === 'name') {
        return reportSortDir === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
      }
      if (reportSortKey === 'size') {
        return reportSortDir === 'desc' ? (b.size || 0) - (a.size || 0) : (a.size || 0) - (b.size || 0);
      }
      return timeB - timeA;
    });
    return list;
  }, [reportFilesList, reportSortKey, reportSortDir]);

  // Handle on-device PDF report generation
  const handleGenerateReport = async () => {
    const target = sortedReportFiles[selectedReportIdx] || reportFilesList[selectedReportIdx];
    if (!target) return;
    setGeneratingReport(true);
    setReportStatusMsg('Commanding S600 to compile PDF report...');
    try {
      const res = await TauriSutoAPI.generate600Report(
        target.id ?? selectedReportIdx,
        target.name || `LOG${String(selectedReportIdx + 1).padStart(5, '0')}.CSD`,
        target.size || 1024,
        target.date || Math.floor(Date.now() / 1000)
      );

      const byteArr = new Uint8Array(res.pdf_bytes);
      const filename = res.file_name || `${deviceDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Audit_Report.pdf`;

      if (TauriSutoAPI.isAvailable()) {
        const savedPath = await TauriSutoAPI.saveBinaryFile(filename, byteArr);
        if (savedPath) {
          setReportStatusMsg(`Report successfully saved to: ${savedPath} (${(byteArr.length / 1024).toFixed(1)} KB)`);
        } else {
          setReportStatusMsg('Save cancelled by user.');
        }
      } else {
        const blob = new Blob([byteArr], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        setReportStatusMsg(`Report '${filename}' generated and downloaded successfully! (${(byteArr.length / 1024).toFixed(1)} KB)`);
      }
    } catch (e) {
      console.error('[ReadoutView] Generate report error:', e);
      setReportStatusMsg(`Failed to generate report: ${e?.message || e}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  // Fetch real device data
  const refreshDeviceState = useCallback(async () => {
    setLoadingDeviceData(true);
    setReadResult(null);
    try {
      const onlineCache = getOnlineCache();
      const isOnlineCached = onlineCache.hasFetched && (!deviceInfo || onlineCache.deviceKey === deviceKey);

      const sInfo = isOnlineCached && onlineCache.sysInfo
        ? onlineCache.sysInfo
        : await TauriSutoAPI.getSystemInfo();
      setSysInfo(sInfo || null);

      const dType = resolveLoggerType(deviceInfo, sInfo);
      let lStatus = null;
      if (dType === 's418' || dType === 's461') {
        lStatus = await TauriSutoAPI.getLoggerStatus();
        if (lStatus?.start_time && lStatus?.end_time) {
          const sDate = new Date(lStatus.start_time * 1000);
          const eDate = new Date(lStatus.end_time * 1000);
          setS461StartDate(sDate.toISOString().slice(0, 10));
          setS461StartHour(String(sDate.getHours()));
          setS461EndDate(eDate.toISOString().slice(0, 10));
          setS461EndHour(String(eDate.getHours()));
        }
      }
      setLoggerStatus(lStatus);

      const chs = isOnlineCached && onlineCache.channels
        ? onlineCache.channels
        : await TauriSutoAPI.getChannels();
      setDeviceChannels(chs || []);

      // Only query screenshots for devices that actually support it (DS310, S600, S605, S606)
      // Never query screenshots for S332 or WebAPI devices
      const activeTrans = TauriSutoAPI.getActiveTransport() || deviceInfo?.transport;
      const isApiDevice = activeTrans === 'API' || dType === 's332';
      let sShots = [];
      if (!isApiDevice && dType !== 's418' && dType !== 's461') {
        try {
          sShots = await TauriSutoAPI.getScreenshots();
        } catch (e) {
          console.warn('[ReadoutView] Querying screenshots failed:', e);
        }
      }
      setScreenshotsList(sShots || []);
      setSelectedScreenshots(new Set());

      let files = [];
      try {
        files = await TauriSutoAPI.getLoggerFiles();
      } catch (e) {
        console.warn('[ReadoutView] Querying logger files failed:', e);
      }
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

      let disk = null;
      if (typeof TauriSutoAPI.getDiskCapacity === 'function') {
        try {
          disk = await TauriSutoAPI.getDiskCapacity();
          setDiskCapacity(disk);
        } catch (e) {
          // ignore
        }
      }

      updateReadoutCache({
        deviceKey,
        hasFetched: true,
        filesList: sortedFiles,
        selectedFileIdx: (selectedFileIdx !== null && selectedFileIdx < sortedFiles.length ? selectedFileIdx : (sortedFiles.length > 0 ? 0 : null)),
        sysInfo: sInfo || null,
        deviceChannels: chs || [],
        loggerStatus: lStatus || null,
        screenshotsList: sShots || [],
        diskCapacity: disk || null,
      });
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
    } else if (readoutOption === 'report') {
      fetchReportFiles();
    }
  }, [readoutOption, fetchScreenshots, fetchReportFiles]);

  // Determine the device family strictly from current connected hardware
  const loggerType = useMemo(() => {
    return resolveLoggerType(deviceInfo, sysInfo);
  }, [deviceInfo, sysInfo]);

  const activeTransport = TauriSutoAPI.getActiveTransport() || deviceInfo?.transport;
  const isBle = activeTransport === 'BLE' || Boolean(deviceInfo?.isBle);
  const isS332 = loggerType === 's332' || activeTransport === 'API' || deviceInfo?.transport === 'API' || isS332Family(deviceInfo, sysInfo);
  const isApi = isS332;
  const isEthernet = !isBle && (deviceInfo?.transport === 'TCP' || activeTransport === 'TCP' || Boolean(deviceInfo?.host) || isS332);
  const isUsb = !isBle && !isEthernet && !isS332;

  // Available readout options based on device type matching S4ABase.java
  const availableReadoutOptions = useMemo(() => {
    if (isS332) {
      return [{ id: 'files', label: 'Recorded Log Files', icon: '📁', badge: filesList.length }];
    }
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
  }, [isS332, loggerType, screenshotsList.length, filesList.length]);

  const deviceDisplayName =
    resolveDeviceTypeName(sysInfo, deviceInfo) ||
    sysInfo?.device_name ||
    deviceInfo?.device ||
    deviceInfo?.name ||
    'SUTO Device';

  const rawIp = deviceInfo?.host || deviceInfo?.ip || sysInfo?.ip || null;
  const cleanIp = isEthernet && rawIp
    ? String(rawIp).replace(/^https?:\/\//i, '').replace(/:\d+$/, '').trim()
    : null;
  const ethernetIp = cleanIp;

  const rawSerial = sysInfo?.serial_number || deviceInfo?.serial;
  const serialNumber = typeof rawSerial === 'string' ? rawSerial.trim() : (rawSerial ? String(rawSerial).trim() : '');
  const hasSerialNumber = Boolean(serialNumber && serialNumber !== '---');

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

  const performRead = async (filename, sampleCount, customStart, customEnd, originalFile) => {
    setReadingProgress(0);
    setReadResult(null);

    try {
      const caps = TauriSutoAPI.getCapabilities ? TauriSutoAPI.getCapabilities() : {};
      if (caps.loggerPageRead && originalFile?.fileName) {
        setReadingProgress(10);
        TauriSutoAPI.logClientEvent('INFO', 'READOUT', `WebAPI logger read started: ${originalFile.fileName}`);
        const res = await TauriSutoAPI.readLoggerData(originalFile.fileName, (prog) => {
          setReadingProgress(prog.percent);
        }, originalFile);
        TauriSutoAPI.logClientEvent('INFO', 'READOUT', `WebAPI logger read finished: ${res.rowCount} rows`);
        const blob = new Blob([res.csv_text], { type: 'text/csv;charset=utf-8;' });
        setReadingProgress(null);
        setReadResult({
          filename: res.filename || filename,
          blob,
          rowCount: res.rowCount,
        });
        return;
      }

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

  const handleReadS461Log = async () => {
    if (!TauriSutoAPI.isAvailable()) {
      alert('Real S461 logger readout is available in desktop application mode with an active device connection.');
      return;
    }

    setReadingProgress(5);
    setReadResult(null);

    try {
      const stopTimeMs = loggerStatus?.end_time ? loggerStatus.end_time * 1000 : Date.now();
      let tryStartTimeMs = stopTimeMs - 3600 * 1000;
      let stopTimeL = stopTimeMs;

      if (s461Period === 'last_hour') {
        tryStartTimeMs = stopTimeMs - 3600 * 1000;
        stopTimeL = stopTimeMs;
      } else if (s461Period === 'last_day') {
        tryStartTimeMs = stopTimeMs - 24 * 3600 * 1000;
        stopTimeL = stopTimeMs;
      } else if (s461Period === 'last_week') {
        const d = new Date(stopTimeMs);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        monday.setMilliseconds(0);
        tryStartTimeMs = monday.getTime();
        stopTimeL = stopTimeMs;
      } else if (s461Period === 'last_month') {
        const d = new Date(stopTimeMs);
        const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
        tryStartTimeMs = firstOfMonth.getTime();
        stopTimeL = stopTimeMs;
      } else if (s461Period === 'period') {
        if (!s461StartDate || !s461EndDate) {
          alert('Please select both start and end dates.');
          setReadingProgress(null);
          return;
        }
        const [sy, sm, sd] = s461StartDate.split('-').map(Number);
        const [ey, em, ed] = s461EndDate.split('-').map(Number);
        const startCal = new Date(sy, sm - 1, sd, parseInt(s461StartHour || '0', 10), 0, 0, 0);
        const endCal = new Date(ey, em - 1, ed, parseInt(s461EndHour || '0', 10), 0, 0, 0);

        if (startCal.getTime() >= endCal.getTime()) {
          alert('Please select a reasonable time period! Start date/hour must be earlier than End date/hour.');
          setReadingProgress(null);
          return;
        }
        tryStartTimeMs = startCal.getTime();
        stopTimeL = endCal.getTime();
      }

      if (loggerStatus?.start_time && tryStartTimeMs < loggerStatus.start_time * 1000) {
        tryStartTimeMs = loggerStatus.start_time * 1000;
      }

      const startSec = Math.floor(tryStartTimeMs / 1000);
      const stopSec = Math.floor(stopTimeL / 1000);

      setReadingProgress(20);
      TauriSutoAPI.logClientEvent('INFO', 'READOUT', `S461 logger read started (${new Date(startSec * 1000).toLocaleString()} → ${new Date(stopSec * 1000).toLocaleString()})`);
      const res = await TauriSutoAPI.readS461Log(startSec, stopSec);
      TauriSutoAPI.logClientEvent('INFO', 'READOUT', `S461 logger read finished: ${res.rowCount} rows`);

      setReadingProgress(90);
      const blob = new Blob([res.csv_text], { type: 'text/csv;charset=utf-8;' });
      const filename = res.filename || `${deviceDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Logger_Data.csv`;

      setReadingProgress(100);
      await new Promise((r) => setTimeout(r, 60));
      setReadingProgress(null);

      setReadResult({
        filename,
        blob,
        rowCount: res.row_count,
      });
    } catch (err) {
      setReadingProgress(null);
      alert(`Readout error: ${err.message || err}`);
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
    TauriSutoAPI.logClientEvent('INFO', 'READOUT', `Screenshot download: ${item.name}`);
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
    TauriSutoAPI.logClientEvent('INFO', 'READOUT', `Screenshot preview: ${item.name}`);
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
                <span className="readout-badge badge-tcp">Ethernet {cleanIp ? `(${cleanIp})` : ''}</span>
              ) : isBle ? (
                <span className="readout-badge badge-ble">Bluetooth (BLE)</span>
              ) : isUsb ? (
                <span className="readout-badge badge-usb">Direct USB / Win32</span>
              ) : null}
            </div>
            <div className="readout-meta-row">
              {hasSerialNumber && (
                <>
                  <span>SN: <strong style={{ fontFamily: 'monospace' }}>{serialNumber}</strong></span>
                  <span>•</span>
                </>
              )}
              {sysInfo?.firmware_version && (
                <>
                  <span>FW: <strong style={{ fontFamily: 'monospace' }}>{sysInfo.firmware_version}</strong></span>
                  <span>•</span>
                </>
              )}
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

            {sortedScreenshots.length > 0 ? (
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
                            checked={sortedScreenshots.length > 0 && selectedScreenshots.size === sortedScreenshots.length}
                            onChange={toggleSelectAllScreenshots}
                          />
                        </label>
                      </th>
                      <th style={{ minWidth: 240 }}>Screenshot File Name</th>
                      <th style={{ width: 190 }}>Captured Time</th>
                      <th style={{ width: 120 }}>Size</th>
                      <th style={{ width: 170, textAlign: 'right', paddingRight: '28px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedScreenshots.map((s, idx) => {
                      const isSelected = selectedScreenshots.has(s.name);
                      const timeInfo = parseScreenshotTime(s);
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: '#1e293b', fontSize: '0.82rem', fontWeight: 500 }}>
                                {timeInfo.formatted}
                              </span>
                              {timeInfo.relative && timeInfo.relative.includes('ago') && (
                                <span
                                  style={{
                                    fontSize: '0.70rem',
                                    color: '#2563eb',
                                    background: '#eff6ff',
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    border: '1px solid #bfdbfe',
                                    fontWeight: 500,
                                  }}
                                >
                                  {timeInfo.relative}
                                </span>
                              )}
                            </div>
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
                  onClick={() => { TauriSutoAPI.logClientEvent('INFO', 'READOUT', 'Status refresh requested'); refreshDeviceState(); }}
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
                  TauriSutoAPI.logClientEvent('INFO', 'READOUT', `Quick read started: ${count} samples`);
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
                <h3>Logger data</h3>
                <p>Read volumetric flow, energy rate, and thermal sensor history from internal logger storage.</p>
              </div>
              <div className="readout-section-actions">
                <button
                  className="readout-btn-secondary"
                  onClick={() => { TauriSutoAPI.logClientEvent('INFO', 'READOUT', 'Status refresh requested'); refreshDeviceState(); }}
                  disabled={loadingDeviceData}
                  title="Refresh logger status from device"
                >
                  {loadingDeviceData ? 'Refreshing...' : '🔄 Refresh Status'}
                </button>
              </div>
            </div>

            <div className="readout-range-card">
              <div className="readout-range-title">Choose Extraction Interval:</div>
              <div className="readout-preset-buttons">
                {[
                  { id: 'last_hour', label: 'Last hour' },
                  { id: 'last_day', label: 'Last day' },
                  { id: 'last_week', label: 'Last week' },
                  { id: 'last_month', label: 'Last month' },
                  { id: 'period', label: 'Time period' },
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

              {s461Period === 'period' && (
                <div className="readout-custom-inputs" style={{ marginTop: '16px' }}>
                  <div className="readout-input-group">
                    <label>From Date:</label>
                    <input
                      type="date"
                      value={s461StartDate}
                      onChange={(e) => setS461StartDate(e.target.value)}
                    />
                  </div>
                  <div className="readout-input-group">
                    <label>Start Hour:</label>
                    <select
                      value={s461StartHour}
                      onChange={(e) => setS461StartHour(e.target.value)}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i < 10 ? `0${i}` : i}:00
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="readout-input-group">
                    <label>To Date:</label>
                    <input
                      type="date"
                      value={s461EndDate}
                      onChange={(e) => setS461EndDate(e.target.value)}
                    />
                  </div>
                  <div className="readout-input-group">
                    <label>End Hour:</label>
                    <select
                      value={s461EndHour}
                      onChange={(e) => setS461EndHour(e.target.value)}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i < 10 ? `0${i}` : i}:00
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {loggerStatus?.start_time && loggerStatus?.end_time && (
                <div style={{ marginTop: '12px', fontSize: '0.8rem', color: '#64748b' }}>
                  Logger memory range: {new Date(loggerStatus.start_time * 1000).toLocaleString()} — {new Date(loggerStatus.end_time * 1000).toLocaleString()}
                </div>
              )}
            </div>

            <div className="readout-bottom-bar" style={{ justifyContent: 'flex-end' }}>
              <button
                className="readout-btn-primary"
                onClick={handleReadS461Log}
                disabled={Boolean(readingProgress)}
              >
                {readingProgress ? 'Reading from device...' : 'Read to CSV'}
              </button>
            </div>
          </div>
        )}

        {/* ── Sub-view S332: Network API Logger Files (S332) ── */}
        {readoutOption === 'files' && (isApi || loggerType === 's332') && (
          <div className="readout-tab-pane">
            <div className="readout-section-header">
              <div className="readout-section-title-group">
                <h3>S332 Recorded Log Files</h3>
                <p>Browse recorded sessions stored in S332 memory. Select a file to read and export directly to CSV.</p>
              </div>
              <div className="readout-section-actions">
                <button
                  className="readout-btn-secondary"
                  onClick={() => { TauriSutoAPI.logClientEvent('INFO', 'READOUT', 'S332 files refresh requested'); refreshDeviceState(); }}
                  disabled={loadingDeviceData}
                  title="Refresh recorded session files from S332"
                >
                  {loadingDeviceData ? 'Refreshing...' : '🔄 Refresh Files'}
                </button>
              </div>
            </div>

            {/* Storage capacity indicator */}
            {diskCapacity && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 18px',
                  marginBottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>
                    💾 S332 Internal Logger Storage
                  </span>
                  <span style={{ color: '#64748b', fontFamily: 'monospace' }}>
                    {formatBytes(diskCapacity.used)} used / {formatBytes(diskCapacity.total)} total ({diskCapacity.percentUsed}% used)
                  </span>
                </div>
                <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.max(1, Number(diskCapacity.percentUsed) || 1))}%`,
                      backgroundColor: '#00ac86',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {filesList.length > 0 ? (
              <>
                <div className="readout-table-wrapper">
                  <table className="readout-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 180 }}>File Name</th>
                        <th style={{ width: 170 }}>Start Time</th>
                        <th style={{ width: 170 }}>End Time</th>
                        <th style={{ width: 120 }}>Duration</th>
                        <th style={{ width: 90 }}>Interval</th>
                        <th style={{ width: 100 }}>Channels</th>
                        <th style={{ width: 140, textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filesList.map((file, idx) => {
                        const durationSec = Math.max(0, Math.round(((file.endTimeStamp - file.startTimeStamp) / 1000)));
                        const isSelected = selectedFileIdx === idx;

                        return (
                          <tr
                            key={file.fileName || idx}
                            className={`readout-table-row ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleSelectFileIdx(idx)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                                {file.fileName}
                              </span>
                            </td>
                            <td>{file.startTime || '---'}</td>
                            <td>{file.endTime || '---'}</td>
                            <td>{formatDuration(durationSec)}</td>
                            <td>
                              <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 600 }}>
                                {file.sampleRate ? `${file.sampleRate}s` : '1s'}
                              </span>
                            </td>
                            <td>
                              <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 12, fontWeight: 600, fontSize: '0.78rem' }}>
                                {file.channelsCount || (file.channels ? file.channels.length : 0)} chs
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                              <button
                                className="readout-btn-mini primary"
                                disabled={Boolean(readingProgress)}
                                onClick={() => {
                                  handleSelectFileIdx(idx);
                                  const fname = `${file.fileName.replace(/\.csv$/i, '')}.csv`;
                                  performRead(fname, file.samplesPerChannel || 300, undefined, undefined, file);
                                }}
                                title="Read recorded data from S332 into CSV"
                              >
                                Read to CSV
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : loadingDeviceData ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <div className="readout-progress-spin" style={{ margin: '0 auto 16px auto' }} />
                <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>Loading Recorded Sessions...</h4>
                <p style={{ margin: '0', fontSize: '0.88rem', color: '#64748b' }}>
                  Querying S332 memory for recorded log files...
                </p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📁</div>
                <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>No Recorded Log Files Found</h4>
                <p style={{ margin: '0', fontSize: '0.88rem', color: '#64748b' }}>
                  The connected S332 logger currently has no recorded session files in memory.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Sub-view 4: Type 1 (DS310 / S331 / S600 Standard Logger Files) ── */}
        {readoutOption === 'files' && !isApi && loggerType !== 's332' && (loggerType === 'ds310' || loggerType === 's600' || loggerType === 's605' || loggerType === 's606') && (
          <div className="readout-tab-pane">
            <div className="readout-section-header">
              <div className="readout-section-title-group">
                <h3>Recorded Measurement Sessions</h3>
                <p>Select a recorded session to read and export directly into a standard S4A CSV file.</p>
              </div>
              <div className="readout-section-actions">
                <button
                  className="readout-btn-secondary"
                  onClick={() => { TauriSutoAPI.logClientEvent('INFO', 'READOUT', 'Status refresh requested'); refreshDeviceState(); }}
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
                  {filesList[selectedFileIdx]?.isRecording ? (
                    <div className="readout-bottom-tip">
                      💡 Note: This session is currently recording on the device. Reading it exports all data recorded up to the current moment.
                    </div>
                  ) : (
                    <div className="readout-bottom-tip" style={{ visibility: 'hidden' }} aria-hidden="true">&nbsp;</div>
                  )}
                  <button
                    className="readout-btn-primary"
                    disabled={selectedFileIdx === null}
                    onClick={() => {
                      const file = filesList[selectedFileIdx];
                      const fname = file?.fileName ? `${file.fileName.replace(/\.csd$/i, '')}.csv` : `${deviceDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Session_${(selectedFileIdx ?? 0) + 1}.csv`;
                      const fileStart = file?.startTime ? new Date(file.startTime.replace(/-/g, '/')) : undefined;
                      const fileEnd = file?.endTime ? new Date(file.endTime.replace(/-/g, '/')) : undefined;
                      TauriSutoAPI.logClientEvent('INFO', 'READOUT', `Logger read started: ${fname} (${file?.samplesPerChannel || 500} samples)`);
                      performRead(fname, file?.samplesPerChannel || 500, fileStart, fileEnd, file);
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
                <h3>Export Device Audit Report (PDF)</h3>
              </div>
              <div className="readout-section-actions">
                <button
                  className="readout-btn-secondary"
                  onClick={fetchReportFiles}
                  disabled={loadingDeviceData || generatingReport}
                  title="Refresh report session files"
                >
                  {loadingDeviceData ? 'Refreshing...' : '🔄 Refresh Sessions'}
                </button>
              </div>
            </div>

            {sortedReportFiles.length > 0 ? (
              <>
                <div className="readout-table-wrapper">
                  <table className="readout-data-table">
                    <thead>
                      <tr>
                        <th
                          style={{ width: 180, cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => {
                            if (reportSortKey === 'time') {
                              setReportSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
                            } else {
                              setReportSortKey('time');
                              setReportSortDir('desc');
                            }
                          }}
                          title="Click to sort by start time"
                        >
                          Start Time {reportSortKey === 'time' ? (reportSortDir === 'desc' ? '▼' : '▲') : ''}
                        </th>
                        <th style={{ width: 180 }}>End Time</th>
                        <th
                          style={{ width: 160, cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => {
                            if (reportSortKey === 'name') {
                              setReportSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                            } else {
                              setReportSortKey('name');
                              setReportSortDir('asc');
                            }
                          }}
                          title="Click to sort by file name"
                        >
                          Session File {reportSortKey === 'name' ? (reportSortDir === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th
                          style={{ width: 130, cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => {
                            if (reportSortKey === 'size') {
                              setReportSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
                            } else {
                              setReportSortKey('size');
                              setReportSortDir('desc');
                            }
                          }}
                          title="Click to sort by file size"
                        >
                          File Size {reportSortKey === 'size' ? (reportSortDir === 'desc' ? '▼' : '▲') : ''}
                        </th>
                        <th style={{ minWidth: 200 }}>Protocol / Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedReportFiles.map((item, idx) => {
                        const isSelected = selectedReportIdx === idx;
                        const matchedFile = filesList.find(
                          (f) =>
                            f.fileName &&
                            (f.fileName === item.name ||
                              f.fileName.replace(/\.csd$/i, '') === item.name.replace(/\.csd$/i, ''))
                        );
                        const startTime = item.date_str || matchedFile?.startTime || formatUnixTimestamp(item.date);
                        const endTime = matchedFile?.endTime || '---';
                        const desc = matchedFile?.description || 'Compressed Air Purity Audit Session';

                        return (
                          <tr
                            key={item.id ?? idx}
                            className={`readout-table-row ${isSelected ? 'selected' : ''}`}
                            onClick={() => setSelectedReportIdx(idx)}
                          >
                            <td><strong>{startTime || '---'}</strong></td>
                            <td>{endTime}</td>
                            <td>
                              <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.80rem', fontWeight: 600 }}>
                                {item.name}
                              </span>
                            </td>
                            <td>
                              <span style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: 12, fontWeight: 600, fontSize: '0.76rem', color: '#334155' }}>
                                {item.size ? `${(item.size / 1024).toFixed(1)} KB` : '---'}
                              </span>
                            </td>
                            <td className="readout-col-desc">
                              <span title={desc} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {desc}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {reportStatusMsg && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: '0.86rem',
                      background: reportStatusMsg.includes('Failed')
                        ? '#fef2f2'
                        : reportStatusMsg.includes('cancelled')
                        ? '#f8fafc'
                        : '#f0fdf4',
                      color: reportStatusMsg.includes('Failed')
                        ? '#b91c1c'
                        : reportStatusMsg.includes('cancelled')
                        ? '#64748b'
                        : '#15803d',
                      border: `1px solid ${
                        reportStatusMsg.includes('Failed')
                          ? '#fecaca'
                          : reportStatusMsg.includes('cancelled')
                          ? '#e2e8f0'
                          : '#bbf7d0'
                      }`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {generatingReport ? (
                      <span className="readout-spinner" style={{ width: 14, height: 14 }} />
                    ) : (
                      <span>{reportStatusMsg.includes('Failed') ? '❌' : reportStatusMsg.includes('cancelled') ? 'ℹ️' : '✅'}</span>
                    )}
                    <span>{reportStatusMsg}</span>
                  </div>
                )}

                <div className="readout-bottom-bar">
                  <div className="readout-bottom-tip">
                    💡 Compliance report directly into a standard PDF document.
                  </div>
                  <button
                    className="readout-btn-primary"
                    disabled={generatingReport || sortedReportFiles.length === 0 || selectedReportIdx === null}
                    onClick={handleGenerateReport}
                  >
                    {generatingReport ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span
                          className="readout-spinner"
                          style={{
                            width: 14,
                            height: 14,
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderTopColor: '#ffffff',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                          }}
                        />
                        Compiling on Device...
                      </span>
                    ) : (
                      'Generate & Download PDF Report'
                    )}
                  </button>
                </div>
              </>
            ) : loadingDeviceData ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <div className="readout-progress-spin" style={{ margin: '0 auto 16px auto' }} />
                <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>Loading Report Sessions...</h4>
                <p style={{ margin: '0', fontSize: '0.88rem', color: '#64748b' }}>
                  Querying device memory for ISO 8573 audit sessions...
                </p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📑</div>
                <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>No Recorded Sessions Found on Device</h4>
                <p style={{ margin: '0', fontSize: '0.88rem', color: '#64748b' }}>
                  The connected S600 has no recorded measurement sessions in memory to compile an audit report from.
                </p>
              </div>
            )}
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
                  onClick={() => { TauriSutoAPI.logClientEvent('INFO', 'READOUT', 'Status refresh requested'); refreshDeviceState(); }}
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
                onClick={() => { TauriSutoAPI.logClientEvent('INFO', 'READOUT', 'Calibration records read started'); performRead(`${deviceDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Cal_Records.csv`, 12); }}
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
                  onClick={() => { TauriSutoAPI.logClientEvent('INFO', 'READOUT', 'Status refresh requested'); refreshDeviceState(); }}
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
      {previewImage && (() => {
        const previewIndex = sortedScreenshots.findIndex(
          (s) => s.name === previewImage.originalName || s.name === previewImage.name
        );
        const hasPrev = previewIndex > 0;
        const hasNext = previewIndex >= 0 && previewIndex < sortedScreenshots.length - 1;

        return (
          <div className="readout-lightbox-overlay" onClick={() => setPreviewImage(null)}>
            <div className="readout-lightbox-card" onClick={(e) => e.stopPropagation()}>
              <div className="readout-lightbox-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h4>{previewImage.name}</h4>
                  {previewIndex !== -1 && (
                    <span
                      style={{
                        fontSize: '0.78rem',
                        color: '#64748b',
                        background: '#f1f5f9',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontWeight: 600,
                      }}
                    >
                      {previewIndex + 1} of {sortedScreenshots.length}
                    </span>
                  )}
                </div>
                <button
                  style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
                  onClick={() => setPreviewImage(null)}
                  title="Close preview (Esc)"
                >
                  ✕
                </button>
              </div>
              <div className="readout-lightbox-body">
                <img src={previewImage.url} alt={previewImage.name} />
              </div>
              <div
                className="readout-lightbox-footer"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="readout-btn-secondary"
                    disabled={!hasPrev || downloadingScreenshot !== null}
                    onClick={() => handlePreviewScreenshot(sortedScreenshots[previewIndex - 1])}
                    title="Previous screenshot (Left Arrow)"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    ◀ Previous
                  </button>
                  <button
                    className="readout-btn-secondary"
                    disabled={!hasNext || downloadingScreenshot !== null}
                    onClick={() => handlePreviewScreenshot(sortedScreenshots[previewIndex + 1])}
                    title="Next screenshot (Right Arrow)"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    Next ▶
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
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
          </div>
        );
      })()}
    </div>
  );
}
