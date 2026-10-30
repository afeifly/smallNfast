import React from 'react';
import GraphicView from './modules/graphicview';
import TableView from './modules/tableview/TableView';
import ConsumptionReport from './modules/consumption/ConsumptionReport';
import FileInfoView from './modules/fileinfo/FileInfoView';
import CompressorAnalyze from './modules/analyze/CompressorAnalyze';
import OnlineView, { clearOnlineCache, getOnlineCache } from './modules/onlineview/OnlineView';
import LiveGraphicView from './modules/onlineview/LiveGraphicView';
import LiveTableView from './modules/onlineview/LiveTableView';
import TestAPI from './api/TestAPI';
import TauriSutoAPI from './api/TauriSutoAPI';
import Loading from './components/loading/Loading';
import DataModifierModal from './modules/modifier/DataModifierModal';
import DebugLogModal from './components/DebugLogModal';
import DeviceConnectModal from './components/DeviceConnectModal';
import DownloadAppModal from './components/DownloadAppModal';
import ReadoutView from './modules/readout/ReadoutView';
import { clearReadoutCache } from './modules/readout/readoutSession';
import './App.css';
import { isDesktop, isMobile, isWeb, checkIsWeb, getRuntimePlatform, resolveDeviceTypeName } from './util/platform';
import * as liveRecorder from './util/liveRecorder';
import { clearLiveSelection } from './util/liveSelection';

import intl from 'react-intl-universal';
import locales from './locales/en-US';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AddIcon from '@mui/icons-material/Add';
import ShareIcon from '@mui/icons-material/Share';
import DeleteIcon from '@mui/icons-material/Delete';

const featureReport = import.meta.env.VITE_ENABLE_CONSUMPTION_REPORT === 'true';
const featureCompressor = import.meta.env.VITE_ENABLE_COMPRESSOR_ANALYZE === 'true';
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0';

const renderNotiIcon = (type) => {
  switch (type) {
    case 'error':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ef4444" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'warning':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'success':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#10b981" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#00ac86" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
};

const getNotiColors = (type) => {
  switch (type) {
    case 'error':
      return {
        titleColor: '#ef4444',
        bgColor: '#fef2f2',
        borderColor: '#fca5a5',
        btnColor: 'error',
        textColor: '#991b1b'
      };
    case 'warning':
      return {
        titleColor: '#d97706',
        bgColor: '#fffbeb',
        borderColor: '#fde68a',
        btnColor: 'warning',
        textColor: '#92400e'
      };
    case 'success':
      return {
        titleColor: '#059669',
        bgColor: '#ecfdf5',
        borderColor: '#a7f3d0',
        btnColor: 'success',
        textColor: '#065f46'
      };
    case 'info':
    default:
      return {
        titleColor: '#0f766e',
        bgColor: '#f0fdf4',
        borderColor: '#bbf7d0',
        btnColor: 'primary',
        textColor: '#166534'
      };
  }
};

function App() {
  const [initDone, setInitDone] = React.useState(false);
  // appMode: null (welcome screen), 'analyze' (file analyze mode), or 'monitor' (device monitor mode)
  const [appMode, setAppMode] = React.useState(null);
  const [fileLoaded, setFileLoaded] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('graphic');
  const [recentFiles, setRecentFiles] = React.useState([]);
  const [recentDialogOpen, setRecentDialogOpen] = React.useState(false);
  const [shareMenuAnchorEl, setShareMenuAnchorEl] = React.useState(null);
  const [modifierOpen, setModifierOpen] = React.useState(false);

  // Device monitor states
  const [detectingDevice, setDetectingDevice] = React.useState(false);
  const [detectError, setDetectError] = React.useState(null);
  const [deviceInfo, setDeviceInfo] = React.useState(null);
  const [showDebugLogs, setShowDebugLogs] = React.useState(false);
  const [showConnectModal, setShowConnectModal] = React.useState(false);
  const [showDownloadModal, setShowDownloadModal] = React.useState(false);
  const [analyzingFromReadout, setAnalyzingFromReadout] = React.useState(false);

  // Live value recording (header REC button)
  const [recState, setRecState] = React.useState(() => liveRecorder.getRecorderState());
  const [recNow, setRecNow] = React.useState(0);
  const [recStartOpen, setRecStartOpen] = React.useState(false);
  const [recIntervalInput, setRecIntervalInput] = React.useState('10');
  // { action: 'home' | 'close' } while a recording blocks leaving the app
  const [exitConfirm, setExitConfirm] = React.useState(null);
  React.useEffect(
    () =>
      liveRecorder.subscribe((s) => {
        setRecState({ ...s });
        if (s.recording) setRecNow(Date.now());
      }),
    []
  );
  React.useEffect(() => {
    if (!recState.recording) return undefined;
    const t = setInterval(() => {
      if (document.visibilityState === 'hidden') return; // self-corrects on show
      setRecNow(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [recState.recording]);

  // Web fallback: browsers ask before leaving while a recording is running.
  React.useEffect(() => {
    if (!recState.recording) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [recState.recording]);

  // Header horizontal swipe/drag container ref and active tab auto-scroll
  const headerScrollRef = React.useRef(null);
  const dragInfoRef = React.useRef({ isDown: false, startX: 0, scrollLeft: 0 });

  const handleHeaderMouseDown = (e) => {
    if (e.button !== 0 || !headerScrollRef.current) return;
    dragInfoRef.current = {
      isDown: true,
      startX: e.pageX - headerScrollRef.current.offsetLeft,
      scrollLeft: headerScrollRef.current.scrollLeft,
    };
  };

  const handleHeaderMouseMove = (e) => {
    if (!dragInfoRef.current.isDown || !headerScrollRef.current) return;
    const x = e.pageX - headerScrollRef.current.offsetLeft;
    const walk = x - dragInfoRef.current.startX;
    if (Math.abs(walk) > 3) {
      headerScrollRef.current.scrollLeft = dragInfoRef.current.scrollLeft - walk;
    }
  };

  const handleHeaderMouseUp = () => {
    dragInfoRef.current.isDown = false;
  };

  React.useEffect(() => {
    if (headerScrollRef.current) {
      const activeEl = headerScrollRef.current.querySelector('.tab-btn.active');
      if (activeEl && typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeTab]);

  // Desktop app: intercept the window close while recording, ask first.
  React.useEffect(() => {
    if (!recState.recording || !TauriSutoAPI.isAvailable()) return undefined;
    let unlisten = null;
    let disposed = false;
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) =>
        getCurrentWindow().onCloseRequested((event) => {
          event.preventDefault();
          setExitConfirm({ action: 'close' });
        })
      )
      .then((fn) => {
        if (disposed && typeof fn === 'function') fn();
        else unlisten = fn;
      })
      .catch((e) => console.warn('[Recorder] window close interception unavailable:', e));
    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [recState.recording]);

  // Loading indicator refs
  const globalLoadingRef = React.useRef(null);

  // File loading progress states
  const [fileLoading, setFileLoading] = React.useState(false);
  const [fileLoadingProgress, setFileLoadingProgress] = React.useState(0);
  const [loadingFilename, setLoadingFilename] = React.useState('');
  const [loadedFilename, setLoadedFilename] = React.useState('');

  // Global premium notification states
  const [notiOpen, setNotiOpen] = React.useState(false);
  const [notiTitle, setNotiTitle] = React.useState('');
  const [notiMsg, setNotiMsg] = React.useState('');
  const [notiType, setNotiType] = React.useState('info'); // 'info', 'warning', 'error', 'success'

  // CSD Export gap-confirmation dialog
  const [csdGapDialogOpen, setCsdGapDialogOpen] = React.useState(false);
  const [csdGapSummary, setCsdGapSummary] = React.useState(null);

  // Large-CSV size-warning dialog
  const [largeCsvDialogOpen, setLargeCsvDialogOpen] = React.useState(false);
  const [largeCsvInfo, setLargeCsvInfo] = React.useState(null); // { filename, sizeMB, sizeGB }

  // Header-repair dialog (offered automatically after opening a broken CSD file)
  const [repairInfo, setRepairInfo] = React.useState(null);

  React.useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      if (!localStorage.getItem('username')) {
        localStorage.setItem('username', 'admin');
      }
    }

    intl.init({
      currentLocale: 'en-US',
      locales: {
        'en-US': locales
      }
    }).then(() => {
      setInitDone(true);
    });
  }, []);

  React.useEffect(() => {
    if (!initDone) return;

    if (TestAPI.isFileLoaded && TestAPI.isFileLoaded()) {
      setFileLoaded(true);
      setAppMode('analyze');
      if (TestAPI.getLoadedFileName) {
        setLoadedFilename(TestAPI.getLoadedFileName());
      }
    }

    if (TestAPI.onFileLoaded) {
      TestAPI.onFileLoaded(() => {
        setFileLoaded(true);
        setAppMode('analyze');
        if (TestAPI.getLoadedFileName) {
          setLoadedFilename(TestAPI.getLoadedFileName());
        }
        if (TestAPI.getRecentFiles) {
          setRecentFiles(TestAPI.getRecentFiles());
        }
        // Offer to write the header repair back to the file.
        if (TestAPI.needsRepair) {
          setRepairInfo(TestAPI.needsRepair());
        }
      });
    }

    if (TestAPI.getRecentFiles) {
      setRecentFiles(TestAPI.getRecentFiles());
    }
    if (TestAPI.syncDesktopRecentFiles) {
      TestAPI.syncDesktopRecentFiles().then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setRecentFiles(list);
        }
      }).catch(() => {});
    }
  }, [initDone]);

  const handleCsdExportConfirmed = async () => {
    setCsdGapDialogOpen(false);
    if (globalLoadingRef.current) globalLoadingRef.current.showWithMessage('Exporting to CSD... 0%');
    try {
      await TestAPI.exportToCsd((p) => {
        if (globalLoadingRef.current) globalLoadingRef.current.showWithMessage(`Exporting to CSD... ${Math.round(p * 100)}%`);
      });
      window.showAppNotification('Export Complete', 'CSD file exported successfully.', 'success');
    } catch (e) {
      console.error(e);
      window.showAppNotification('Export Failed', 'Failed to export data to CSD: ' + e.message, 'error');
    } finally {
      if (globalLoadingRef.current) globalLoadingRef.current.hide();
    }
  };

  React.useEffect(() => {
    const handleStart = (e) => {
      localStorage.removeItem('selectedChannels');
      setLoadingFilename(e.detail.filename);
      setFileLoading(true);
      setFileLoadingProgress(0);
      TestAPI.setMode('analyze');
      setAppMode('analyze');
      setActiveTab('graphic');
    };

    const handleProgress = (e) => {
      setFileLoadingProgress(e.detail.progress);
      if (e.detail.progress >= 1.0) {
        setTimeout(() => {
          setFileLoading(false);
        }, 600);
      }
      if (e.detail.error) {
        setFileLoading(false);
        const errMsg = e.detail.errorMessage ? e.detail.errorMessage : 'An unknown error occurred while loading the file.';
        if (window.showAppNotification) {
          window.showAppNotification(
            "File Load Failed",
            `There was a problem loading your file. The file header format verification failed:\n\n${errMsg}`,
            "error"
          );
        }
      }
    };

    const handleNotification = (e) => {
      const { title, message, type } = e.detail;
      setNotiTitle(title || 'Notification');
      setNotiMsg(message || '');
      setNotiType(type || 'info');
      setNotiOpen(true);
    };

    // Large CSV detected — pause loading and show size-warning dialog
    const handleLargeCsvDetected = (e) => {
      setLargeCsvInfo(e.detail);
      setLargeCsvDialogOpen(true);
    };

    // CSV finished loading and user had chosen "Convert to CSD"
    const handleCsvLoadedPendingConvert = () => {
      const summary = TestAPI.getGapSummary ? TestAPI.getGapSummary() : { gapCount: 0, gaps: [], segments: [] };
      // No gaps — export directly, no dialog needed
      if (!summary.gapCount) {
        handleCsdExportConfirmed();
        return;
      }
      setCsdGapSummary(summary);
      setCsdGapDialogOpen(true);
    };

    window.addEventListener('fileLoadStart', handleStart);
    window.addEventListener('fileLoadProgress', handleProgress);
    window.addEventListener('appNotification', handleNotification);
    window.addEventListener('largeCsvDetected', handleLargeCsvDetected);
    window.addEventListener('csvLoadedPendingConvert', handleCsvLoadedPendingConvert);

    return () => {
      window.removeEventListener('fileLoadStart', handleStart);
      window.removeEventListener('fileLoadProgress', handleProgress);
      window.removeEventListener('appNotification', handleNotification);
      window.removeEventListener('largeCsvDetected', handleLargeCsvDetected);
      window.removeEventListener('csvLoadedPendingConvert', handleCsvLoadedPendingConvert);
    };
  }, []);

  const handleDeviceConnected = (conn) => {
    clearReadoutCache();
    clearOnlineCache();
    setAnalyzingFromReadout(false);
    setDeviceInfo(conn);
    TestAPI.setMode('monitor');
    setAppMode('monitor');
    setActiveTab('online');
    TauriSutoAPI.logClientEvent('INFO', 'APP', `Device connected via ${conn.transport || 'SUTO'} (${conn.device || conn.host || 'active'})`);
  };

  const saveRecordingResult = async (result) => {
    if (!result) return;
    try {
      let saved = false;
      if (TauriSutoAPI.isAvailable()) {
        const bytes = new TextEncoder().encode(result.csvText);
        const savedPath = await TauriSutoAPI.saveBinaryFile(result.filename, bytes);
        if (savedPath) {
          saved = true;
          TauriSutoAPI.logClientEvent('INFO', 'RECORDER', `Live recording saved (${result.rowCount} rows): ${savedPath}`);
          if (window.showAppNotification) {
            window.showAppNotification(
              'Recording Saved',
              `Live recording successfully saved (${result.rowCount} rows):\n${savedPath}`,
              'success'
            );
          }
        }
      }
      if (!saved) {
        const blob = new Blob([result.csvText], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (window.showAppNotification) {
          window.showAppNotification(
            'Recording Saved',
            `Live recording (${result.rowCount} rows) downloaded: ${result.filename}`,
            'success'
          );
        }
      }
    } catch (err) {
      console.error('[Recorder] Save failed:', err);
      TauriSutoAPI.logClientEvent('ERROR', 'RECORDER', `Saving live recording failed: ${err?.message || err}`);
      if (window.showAppNotification) {
        window.showAppNotification('Save Failed', `Could not save live recording: ${err?.message || err}`, 'error');
      }
    }
  };

  const handleToggleRecording = async () => {
    if (liveRecorder.getRecorderState().recording) {
      const result = liveRecorder.stop();
      if (!result) {
        TauriSutoAPI.logClientEvent('WARN', 'RECORDER', 'Recording stopped but no samples had been captured');
        if (window.showAppNotification) {
          window.showAppNotification(
            'Recording Stopped',
            'Recording stopped, but no measurement samples were captured yet.',
            'warning'
          );
        }
        return;
      }
      await saveRecordingResult(result);
    } else {
      // Ask for the sampling interval first (default 10 s).
      setRecIntervalInput('10');
      setRecStartOpen(true);
    }
  };

  const handleStartRecordingFromDialog = async () => {
    const intervalSec = Math.max(1, Math.min(3600, Math.round(Number(recIntervalInput) || 10)));
    setRecStartOpen(false);
    const cache = getOnlineCache();
    const deviceName = resolveDeviceTypeName(cache?.sysInfo, deviceInfo)
      || deviceInfo?.device
      || 'SUTO Device';
    liveRecorder.start({
      deviceName,
      getChannels: () => getOnlineCache()?.channels || [],
      intervalSec,
    });
    TauriSutoAPI.logClientEvent('INFO', 'RECORDER', `Live recording started on ${deviceName} (interval ${intervalSec}s)`);
    // Jump straight to the live chart so the curves are visible immediately
    setActiveTab('livegraphic');
  };

  const handleDisconnectMonitor = async () => {
    // A running recording would silently lose its data source — stop & save it
    if (liveRecorder.getRecorderState().recording) {
      const result = liveRecorder.stop();
      if (result) await saveRecordingResult(result);
    }
    // Drop the frozen session buffer so the live Graphic/Table tabs disappear
    liveRecorder.clearSession();
    clearLiveSelection();
    TauriSutoAPI.logClientEvent('INFO', 'APP', 'Disconnecting monitor session');
    clearReadoutCache();
    clearOnlineCache();
    try {
      await TauriSutoAPI.disconnect();
    } catch (e) {
      console.warn(e);
    }
    setDeviceInfo(null);
    TestAPI.setMode('analyze');
    setAppMode(null);
    setActiveTab('graphic');
  };

  const handleAnalyzeLoggerCsv = async (csvFile) => {
    TauriSutoAPI.logClientEvent('INFO', 'APP', `Analyzing read logger CSV: ${csvFile.name}`);
    setAnalyzingFromReadout(true);
    TestAPI.setMode('analyze');
    setAppMode('analyze');
    setActiveTab('graphic');
    if (TestAPI.loadFile) {
      await TestAPI.loadFile(csvFile);
    }
  };

  const handleBackToReadout = () => {
    setAnalyzingFromReadout(false);
    if (!deviceInfo) {
      handleReturnHome();
      return;
    }
    TauriSutoAPI.logClientEvent('INFO', 'APP', 'Navigated back to Readout view from analysis');
    TestAPI.setMode('monitor');
    setAppMode('monitor');
    setActiveTab('readout');
  };

  const switchTab = (tab) => {
    TauriSutoAPI.logClientEvent('INFO', 'APP', `View switched: ${tab}`);
    setActiveTab(tab);
  };

  const performReturnHome = () => {
    TauriSutoAPI.logClientEvent('INFO', 'APP', 'Navigated back to Welcome Home');
    setAnalyzingFromReadout(false);
    if (appMode === 'monitor') {
      // Same session teardown as the Disconnect button — returning home ends
      // the monitor session, so the live Graphic/Table views reset fully.
      if (liveRecorder.getRecorderState().recording) {
        const result = liveRecorder.stop();
        if (result) saveRecordingResult(result);
      }
      liveRecorder.clearSession();
      clearLiveSelection();
      clearReadoutCache();
      clearOnlineCache();
      TauriSutoAPI.disconnect().catch(console.warn);
      TestAPI.setMode('analyze');
      setDeviceInfo(null);
    }
    setAppMode(null);
  };

  const handleReturnHome = () => {
    // Never silently drop a running recording.
    if (liveRecorder.getRecorderState().recording) {
      setExitConfirm({ action: 'home' });
      return;
    }
    performReturnHome();
  };

  /** Stop & save the running recording, then perform the blocked action. */
  const handleExitConfirmProceed = async () => {
    const action = exitConfirm ? exitConfirm.action : null;
    TauriSutoAPI.logClientEvent('INFO', 'APP', `Exit confirmed while recording — stop & save, then ${action === 'close' ? 'close app' : 'return home'}`);
    setExitConfirm(null);
    if (liveRecorder.getRecorderState().recording) {
      const result = liveRecorder.stop();
      if (result) await saveRecordingResult(result);
    }
    if (action === 'home') {
      performReturnHome();
    } else if (action === 'close') {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().destroy();
      } catch {
        window.close();
      }
    }
  };

  const handleRemoveRecentFile = async (file, e) => {
    if (e) e.stopPropagation();
    if (TestAPI.removeRecentFile) {
      const updated = await TestAPI.removeRecentFile(file.name);
      setRecentFiles(updated);
      TauriSutoAPI.logClientEvent('INFO', 'FILE', `Removed recent file: ${file.name}`);
    }
  };

  const handleOpenFile = () => {
    TauriSutoAPI.logClientEvent('INFO', 'FILE', 'Triggered Open File action');
    setAnalyzingFromReadout(false);
    if (TestAPI.openFile) {
      TestAPI.openFile();
    }
  };

  const handleSaveRepairedCopy = async () => {
    const res = await TestAPI.saveRepairedCopy();
    setRepairInfo(null);
    if (res && res.saved) {
      window.showAppNotification('Repaired Copy Saved', 'A repaired copy was saved. The original file was not modified.', 'success');
    } else {
      window.showAppNotification('Save Cancelled', 'No repaired copy was saved.', 'info');
    }
  };

  const handleDismissRepair = () => setRepairInfo(null);

  const handleHeaderOpenCsd = () => {
    TauriSutoAPI.logClientEvent('INFO', 'FILE', 'Open file requested (analyze mode)');
    const list = TestAPI.getRecentFiles ? TestAPI.getRecentFiles() : [];
    if (list.length > 0) {
      setRecentFiles(list);
      setRecentDialogOpen(true);
    } else {
      if (TestAPI.openFile) {
        TestAPI.openFile();
      }
    }
  };

  const handleAppendCsd = () => {
    TauriSutoAPI.logClientEvent('INFO', 'FILE', 'Append file requested');
    if (TestAPI.openAppend) {
      TestAPI.openAppend();
    }
  };

  const handleLoadRecentFile = async (file) => {
    if (!file) return;
    TauriSutoAPI.logClientEvent('INFO', 'FILE', `Recent file opened: ${file.name || 'unknown'}`);

    let filePath = file.path;
    if (!filePath && TauriSutoAPI.isAvailable()) {
      try {
        const desktopList = await TauriSutoAPI.getRecentFiles();
        const found = desktopList.find(d => d.name === file.name || d.path?.endsWith(file.name));
        if (found?.path) filePath = found.path;
      } catch (e) {
        console.warn('Error querying desktop recent files:', e);
      }
    }

    let loadSuccess = false;

    if (filePath && TestAPI.loadFileFromPath) {
      loadSuccess = await TestAPI.loadFileFromPath(filePath);
      if (!loadSuccess && window.showAppNotification) {
        window.showAppNotification("File Not Found", `Could not open file at: ${filePath}`, "error");
      }
    } else if (TestAPI.getHandleForFile && TestAPI.loadFileFromHandle) {
      const handle = await TestAPI.getHandleForFile(file.name);
      if (handle) {
        loadSuccess = await TestAPI.loadFileFromHandle(handle);
      } else if (TestAPI.openFile) {
        TestAPI.openFile();
        return;
      } else {
        if (window.showAppNotification) {
          window.showAppNotification("File Not Found", `The requested file "${file.name}" could not be found.`, "error");
        }
      }
    } else if (TestAPI.openFile) {
      TestAPI.openFile();
      return;
    }

    if (loadSuccess) {
      setAnalyzingFromReadout(false);
      localStorage.removeItem('selectedChannels');
      TestAPI.setMode('analyze');
      setAppMode('analyze');
    }
  };

  const handleShareClick = (event) => {
    setShareMenuAnchorEl(event.currentTarget);
  };

  const handleShareClose = () => {
    setShareMenuAnchorEl(null);
  };

  const handleExportCsvOption = async () => {
    TauriSutoAPI.logClientEvent('INFO', 'EXPORT', `Export started: all channels to CSV`);
    handleShareClose();
    if (!TestAPI.isFileLoaded || !TestAPI.isFileLoaded()) {
      window.showAppNotification("Export Aborted", "No file is currently loaded.", "warning");
      return;
    }
    if (globalLoadingRef.current) {
      globalLoadingRef.current.showWithMessage("Exporting to CSV... 0%");
    }
    try {
      await TestAPI.exportAllChannelsToCsv((progress) => {
        if (globalLoadingRef.current) {
          globalLoadingRef.current.showWithMessage(`Exporting to CSV... ${Math.round(progress * 100)}%`);
        }
      });
    } catch (e) {
      console.error(e);
      window.showAppNotification("Export Failed", "Failed to export data to CSV: " + e.message, "error");
    } finally {
      if (globalLoadingRef.current) {
        globalLoadingRef.current.hide();
      }
    }
  };

  const handleExportCsdOption = async () => {
    TauriSutoAPI.logClientEvent('INFO', 'EXPORT', `Export started: CSV to CSD`);
    handleShareClose();
    if (!TestAPI.isFileLoaded || !TestAPI.isFileLoaded()) {
      window.showAppNotification('Export Aborted', 'No file is currently loaded.', 'warning');
      return;
    }
    if (!TestAPI.isCsvMode || !TestAPI.isCsvMode()) {
      window.showAppNotification('Export Aborted', 'Export to CSD is only available when a CSV file is loaded.', 'warning');
      return;
    }
    const summary = TestAPI.getGapSummary ? TestAPI.getGapSummary() : { gapCount: 0, gaps: [] };
    // No gaps — skip dialog and export directly
    if (!summary.gapCount) {
      return handleCsdExportConfirmed();
    }
    setCsdGapSummary(summary);
    setCsdGapDialogOpen(true);
  };

  const handleCsdExportSplit = async () => {
    setCsdGapDialogOpen(false);
    const segCount = csdGapSummary?.segments?.length ?? 1;
    if (globalLoadingRef.current) globalLoadingRef.current.showWithMessage(`Exporting ${segCount} CSD files... 0%`);
    try {
      await TestAPI.exportToCsdSplit((p) => {
        if (globalLoadingRef.current) globalLoadingRef.current.showWithMessage(`Exporting ${segCount} CSD files... ${Math.round(p * 100)}%`);
      });
      window.showAppNotification('Export Complete', `${segCount} CSD file(s) exported successfully.`, 'success');
    } catch (e) {
      console.error(e);
      window.showAppNotification('Export Failed', 'Failed to split-export CSD files: ' + e.message, 'error');
    } finally {
      if (globalLoadingRef.current) globalLoadingRef.current.hide();
    }
  };

  const handleExportExcelOption = async () => {
    TauriSutoAPI.logClientEvent('INFO', 'EXPORT', `Export started: all channels to Excel`);
    handleShareClose();
    if (!TestAPI.isFileLoaded || !TestAPI.isFileLoaded()) {
      window.showAppNotification("Export Aborted", "No file is currently loaded.", "warning");
      return;
    }
    if (globalLoadingRef.current) {
      globalLoadingRef.current.showWithMessage("Exporting to Excel... 0%");
    }
    try {
      await TestAPI.exportAllChannelsToExcel((progress) => {
        if (globalLoadingRef.current) {
          globalLoadingRef.current.showWithMessage(`Exporting to Excel... ${Math.round(progress * 100)}%`);
        }
      });
    } catch (e) {
      console.error(e);
      window.showAppNotification("Export Failed", "Failed to export data to Excel: " + e.message, "error");
    } finally {
      if (globalLoadingRef.current) {
        globalLoadingRef.current.hide();
      }
    }
  };

  if (!initDone) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <div className="App flex-column-layout">
      {/* Header Bar */}
      <header className="app-header">
        <div className="header-left">
          {/* Logo */}
          <svg className="header-logo" viewBox="0 0 24 24" width="28" height="28">
            <path
              fill="none"
              stroke="url(#logo-grad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 17l6-6 4 4 8-8"
            />
            <defs>
              <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00ac86" />
                <stop offset="100%" stopColor="#007d61" />
              </linearGradient>
            </defs>
          </svg>
          <span className="app-title">S4A</span>
          {appMode && (
            <button
              className="header-home-btn"
              onClick={analyzingFromReadout ? handleBackToReadout : handleReturnHome}
              title={analyzingFromReadout ? "Back to Readout" : "Back to Home"}
              aria-label={analyzingFromReadout ? "Back to Readout" : "Back to Home"}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}
        </div>

        {/* Unified Scrollable Strip: Tabs + Action Items */}
        <div
          className="header-scroll-container"
          ref={headerScrollRef}
          onMouseDown={handleHeaderMouseDown}
          onMouseMove={handleHeaderMouseMove}
          onMouseUp={handleHeaderMouseUp}
          onMouseLeave={handleHeaderMouseUp}
        >
          {/* View Switcher Tabs */}
        {appMode === 'monitor' ? (
          <div className="header-tabs">
            <button
              className={`tab-btn ${activeTab === 'online' ? 'active' : ''}`}
              onClick={() => switchTab('online')}
            >
              Online View
            </button>
            {recState.hasSession && (
              <button
                className={`tab-btn ${activeTab === 'livegraphic' ? 'active' : ''}`}
                onClick={() => switchTab('livegraphic')}
              >
                Graphic View
              </button>
            )}
            {recState.hasSession && (
              <button
                className={`tab-btn ${activeTab === 'livetable' ? 'active' : ''}`}
                onClick={() => switchTab('livetable')}
              >
                Table View
              </button>
            )}
            {/* Readout hammers the device — never offered while recording */}
            {appMode === 'monitor' && !recState.recording && (
              <button
                className={`tab-btn ${activeTab === 'readout' ? 'active' : ''}`}
                onClick={() => {
                  clearReadoutCache();
                  setActiveTab('readout');
                }}
              >
                Readout
              </button>
            )}
          </div>
        ) : (appMode === 'analyze' && fileLoaded) ? (
          <div className="header-tabs">
            <button
              className={`tab-btn ${activeTab === 'fileinfo' ? 'active' : ''}`}
              onClick={() => switchTab('fileinfo')}
            >
              File Info
            </button>
            <button
              className={`tab-btn ${activeTab === 'graphic' ? 'active' : ''}`}
              onClick={() => switchTab('graphic')}
            >
              Graphic View
            </button>
            <button
              className={`tab-btn ${activeTab === 'table' ? 'active' : ''}`}
              onClick={() => switchTab('table')}
            >
              Table View
            </button>
            {featureReport && (
              <button
                className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
                onClick={() => switchTab('report')}
              >
                Consumption Report
              </button>
            )}
            {featureCompressor && (
              <button
                className={`tab-btn ${activeTab === 'analyze' ? 'active' : ''}`}
                onClick={() => switchTab('analyze')}
              >
                Compressor Analyze
              </button>
            )}
            <button
              className="tab-btn"
              onClick={() => { TauriSutoAPI.logClientEvent('INFO', 'FILE', 'Data modifier opened'); setModifierOpen(true); }}
            >
              Data Studio
            </button>
          </div>
        ) : null}

          <div className="header-right">

          {appMode === 'monitor' && (
            <Tooltip
              title={recState.recording
                ? `Stop recording & save CSV (${recState.samples} samples)`
                : 'Record live values to CSV'}
            >
              <button
                className={`header-rec-btn ${recState.recording ? 'is-recording' : ''}`}
                onClick={handleToggleRecording}
              >
                {recState.recording ? (
                  <>
                    <span className="rec-pulse-dot" />
                    <span className="rec-btn-time">
                      REC&nbsp;
                      {String(Math.floor(Math.max(0, recNow - recState.startedAt) / 60000)).padStart(2, '0')}
                      :
                      {String(Math.floor(Math.max(0, recNow - recState.startedAt) / 1000) % 60).padStart(2, '0')}
                    </span>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                      <rect x="5" y="5" width="14" height="14" rx="2" />
                    </svg>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Record
                  </>
                )}
              </button>
            </Tooltip>
          )}

          {appMode === 'analyze' && fileLoaded && (
            <>
              <Tooltip title="Open File">
                <IconButton className="header-icon-btn" onClick={handleHeaderOpenCsd} style={{ color: '#0f172a' }}>
                  <FolderOpenIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Append File">
                <IconButton className="header-icon-btn" onClick={handleAppendCsd} style={{ color: '#0f172a' }}>
                  <AddIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Export Data">
                <IconButton className="header-icon-btn" onClick={handleShareClick} style={{ color: '#0f172a' }}>
                  <ShareIcon />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={shareMenuAnchorEl}
                open={Boolean(shareMenuAnchorEl)}
                onClose={handleShareClose}
              >
                {TestAPI.isCsvMode && TestAPI.isCsvMode() && (
                  <MenuItem onClick={handleExportCsdOption}>
                    Export CSV to CSD
                  </MenuItem>
                )}
                <MenuItem
                  onClick={handleExportCsvOption}
                  disabled={Boolean(TestAPI.isCsvMode && TestAPI.isCsvMode())}
                >
                  Export all to CSV
                </MenuItem>
                <MenuItem onClick={handleExportExcelOption}>
                  Export all to Excel
                </MenuItem>
              </Menu>
            </>
          )}

          {!appMode ? (
            <>
              {checkIsWeb() && (
                <button
                  type="button"
                  className="try-desktop-link"
                  onClick={() => setShowDownloadModal(true)}
                  title="Download S4A for Windows, macOS, or Android"
                >
                  <svg className="try-desktop-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className="try-desktop-text">Try App</span>
                  <span className="try-desktop-badge">New</span>
                </button>
              )}
              <span className="homepage-version-badge" title={`S4A Version ${APP_VERSION}`}>
                v{APP_VERSION}
              </span>
            </>
          ) : (
            <Tooltip title="System Diagnostic Logs">
              <IconButton
                className="header-icon-btn"
                onClick={() => setShowDebugLogs(true)}
                style={{ color: '#334155', padding: '6px' }}
                aria-label="System Diagnostic Logs"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </IconButton>
            </Tooltip>
          )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main-content">
        {!appMode ? (
          /* Welcome Landing Page with dual modes */
          <div className="landing-container">
            <div className="landing-wrapper">
              <div className="landing-modes-grid">
                {/* Mode Card 1: File Analyze Mode */}
                <div className="landing-mode-card">
                  <span className="mode-card-badge badge-analyze">File Analysis</span>
                  <div className="mode-icon-box mode-icon-analyze">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h2 className="mode-card-title">File Analyze Mode</h2>
                  <p className="mode-card-desc">
                    Open and inspect recorded CSD and CSV log files. Perform deep graphic trends, table lookups, and compressor/consumption reporting.
                  </p>

                  <button className="landing-cta-btn" onClick={handleOpenFile}>
                    <FolderOpenIcon style={{ fontSize: 20 }} />
                    Open File
                  </button>

                  {recentFiles.length > 0 && (
                    <div className="recent-files-section">
                      <h3 className="recent-files-title">Recent Files</h3>
                      <div className="recent-files-list">
                        {recentFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="recent-file-item"
                            onClick={() => handleLoadRecentFile(file)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}
                          >
                            <div className="recent-file-info" style={{ flex: 1 }}>
                              <span className="recent-file-name">{file.name}</span>
                              <span className="recent-file-meta">
                                {file.path || (file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '')}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                              <IconButton
                                size="small"
                                onClick={(e) => handleRemoveRecentFile(file, e)}
                                style={{ color: '#94a3b8' }}
                                className="recent-file-delete-btn"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                              <svg className="recent-file-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Mode Card 2: Device Monitor Mode */}
                <div className="landing-mode-card">
                  <span className="mode-card-badge badge-monitor">Real-time SUTO Hardware</span>
                  <div className="mode-icon-box mode-icon-monitor">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h2 className="mode-card-title">Device Monitor Mode</h2>
                  <p className="mode-card-desc">
                    Connect to devices via direct USB driver or other communication for real-time monitoring and graphing.
                  </p>

                  <button
                    className="landing-cta-btn landing-cta-monitor"
                    onClick={() => { TauriSutoAPI.logClientEvent('INFO', 'DEVICE', 'Device connect dialog opened'); setShowConnectModal(true); }}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Detect & Connect Device
                  </button>

                  {detectError && (
                    <div style={{ marginTop: '14px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }}>
                      ⚠ {detectError}
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Supported Transports:</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', color: '#334155', fontWeight: 600 }}>Direct USB</span>
                      <span style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', color: '#0369a1', fontWeight: 600 }}>Ethernet TCP</span>
                      <span style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', color: '#15803d', fontWeight: 600 }}>Bluetooth (BLE)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : appMode === 'monitor' ? (
          /* Monitor Mode: Online View or dedicated Readout View */
          <div className="view-content-wrapper">
            <div style={{ display: activeTab === 'online' ? 'contents' : 'none' }}>
              <OnlineView
                onDisconnect={handleDisconnectMonitor}
                deviceInfo={deviceInfo}
                isPaused={activeTab !== 'online'}
              />
            </div>
            {activeTab === 'readout' && (
              <ReadoutView
                deviceInfo={deviceInfo}
                onAnalyzeCsv={handleAnalyzeLoggerCsv}
                onBackToOnline={() => setActiveTab('online')}
              />
            )}
            {recState.hasSession && activeTab === 'livegraphic' && <LiveGraphicView />}
            {recState.hasSession && activeTab === 'livetable' && <LiveTableView />}
          </div>
        ) : !fileLoaded ? (
          /* File Analyze Mode with no file loaded yet */
          <div className="landing-container">
            <div className="landing-wrapper">
              <div className="landing-card" style={{ maxWidth: 520, margin: '0 auto' }}>
                <h2 className="landing-title">File Analyze Mode</h2>
                <p className="landing-subtitle">
                  Select a CSD or CSV file to begin analysis, or pick from recent files below.
                </p>
                <button className="landing-cta-btn" onClick={handleOpenFile}>
                  <FolderOpenIcon style={{ fontSize: 20 }} />
                  Open File
                </button>
                {recentFiles.length > 0 && (
                  <div className="recent-files-section">
                    <h3 className="recent-files-title">Recent Files</h3>
                    <div className="recent-files-list">
                      {recentFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="recent-file-item"
                          onClick={() => handleLoadRecentFile(file)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <div className="recent-file-info" style={{ flex: 1 }}>
                            <span className="recent-file-name">{file.name}</span>
                            <span className="recent-file-meta">
                              {file.path || (file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '')}
                            </span>
                          </div>
                          <IconButton
                            size="small"
                            onClick={(e) => handleRemoveRecentFile(file, e)}
                            style={{ color: '#94a3b8' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* File Analyze Mode with loaded file */
          <div className="view-content-wrapper">
            {activeTab === 'fileinfo' ? (
              <FileInfoView />
            ) : activeTab === 'graphic' ? (
              <GraphicView />
            ) : activeTab === 'table' ? (
              <TableView />
            ) : activeTab === 'analyze' ? (
              <CompressorAnalyze />
            ) : (
              <ConsumptionReport />
            )}
          </div>
        )}
      </main>

      {/* Global Recent Files Dialog */}
      <Dialog 
        maxWidth='xs' 
        fullWidth
        onClose={() => setRecentDialogOpen(false)} 
        open={recentDialogOpen}
        PaperProps={{
          style: {
            borderRadius: '16px',
            margin: '16px',
            maxWidth: '420px',
            width: 'calc(100% - 32px)',
            boxSizing: 'border-box'
          }
        }}
      >
        <DialogTitle className="dialog-title" onClose={() => setRecentDialogOpen(false)}>
          Recent Files
        </DialogTitle>
        <DialogContent style={{ padding: '8px 16px' }}>
          <List style={{ width: '100%', maxHeight: '50vh', overflow: 'auto', boxSizing: 'border-box' }}>
            {recentFiles.map((file, idx) => (
              <ListItem 
                disablePadding 
                key={idx}
                secondaryAction={
                  <IconButton 
                    edge="end" 
                    aria-label="delete"
                    onClick={(e) => handleRemoveRecentFile(file, e)}
                    style={{ color: '#94a3b8' }}
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemButton onClick={() => {
                  setRecentDialogOpen(false);
                  handleLoadRecentFile(file);
                }}>
                  <ListItemText
                    primary={file.name}
                    secondary={file.path || (file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '')}
                    primaryTypographyProps={{ style: { fontWeight: 'bold', fontSize: '13px', wordBreak: 'break-all' } }}
                    secondaryTypographyProps={{ style: { fontSize: '11px', wordBreak: 'break-all' } }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions className="dialog-footer" style={{ flexWrap: 'wrap', gap: '8px', padding: '12px 16px' }}>
          <Button onClick={() => {
            setRecentDialogOpen(false);
            handleOpenFile();
          }} color="primary" variant="contained">
            Open New File...
          </Button>
          <Button onClick={() => setRecentDialogOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Global Notification Dialog */}
      <Dialog 
        maxWidth='sm' 
        onClose={() => setNotiOpen(false)} 
        open={notiOpen}
        PaperProps={{
          style: {
            borderRadius: '16px',
            padding: '12px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }
        }}
      >
        <DialogTitle className="dialog-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: notiOpen ? getNotiColors(notiType).titleColor : '#0f172a', fontWeight: '800' }}>
          {notiOpen && renderNotiIcon(notiType)}
          {notiTitle}
        </DialogTitle>
        <DialogContent style={{ paddingTop: '8px' }}>
          <div style={{
            padding: '16px 20px',
            backgroundColor: notiOpen ? getNotiColors(notiType).bgColor : '#f8fafc',
            borderLeft: `4px solid ${notiOpen ? getNotiColors(notiType).titleColor : '#cbd5e1'}`,
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            color: notiOpen ? getNotiColors(notiType).textColor : '#0f172a',
            wordBreak: 'break-word',
            whiteSpace: 'pre-line',
            lineHeight: '1.6'
          }}>
            {notiMsg}
          </div>
        </DialogContent>
        <DialogActions style={{ padding: '8px 24px 16px 24px' }}>
          <Button onClick={() => setNotiOpen(false)} color={notiOpen ? getNotiColors(notiType).btnColor : 'primary'} variant="contained" style={{ borderRadius: '8px', fontWeight: '700' }}>
            Dismiss
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══ Large CSV Size Warning Dialog ═══ */}
      <Dialog
        maxWidth="sm"
        fullWidth
        open={largeCsvDialogOpen}
        onClose={() => {
          setLargeCsvDialogOpen(false);
          TestAPI.resolveLargeCsvChoice && TestAPI.resolveLargeCsvChoice('cancel');
        }}
        PaperProps={{ style: { borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', margin: '16px', width: 'calc(100% - 32px)' } }}
      >
        {/* Header */}
        <DialogTitle style={{
          background: 'linear-gradient(135deg, #78350f 0%, #92400e 100%)',
          color: '#fef3c7',
          padding: '20px 24px',
          display: 'flex', alignItems: 'center', gap: '12px',
          fontWeight: '800', fontSize: '16px',
        }}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fcd34d" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Large CSV File Detected
        </DialogTitle>

        <DialogContent style={{ padding: '0', background: '#fff' }}>
          {largeCsvInfo && (
            <div>
              {/* File size badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '20px 24px 16px',
                borderBottom: '1px solid #fde68a',
                background: '#fffbeb',
              }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '26px', flexShrink: 0,
                }}>📄</div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a', wordBreak: 'break-all' }}>
                    {largeCsvInfo.filename}
                  </div>
                  <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      background: '#fef3c7', border: '1px solid #fcd34d',
                      borderRadius: '999px', padding: '2px 10px',
                      fontSize: '12px', fontWeight: '800', color: '#92400e',
                    }}>
                      {parseFloat(largeCsvInfo.sizeMB) >= 1024
                        ? `${largeCsvInfo.sizeGB} GB`
                        : `${largeCsvInfo.sizeMB} MB`}
                    </span>
                    <span style={{ fontSize: '12px', color: '#92400e', fontWeight: '600' }}>≥ 800 MB</span>
                  </div>
                </div>
              </div>

              {/* Message */}
              <div style={{ padding: '20px 24px', fontSize: '13.5px', color: '#334155', lineHeight: '1.7' }}>
                <p style={{ margin: '0 0 14px', fontWeight: '500' }}>
                  The csv file size is too huge, convert to CSD file will have more effective analyze data.
                </p>
                <div style={{
                  background: '#ecfdf5', border: '1px solid #a7f3d0',
                  borderRadius: '10px', padding: '14px 16px',
                  fontSize: '12.5px', color: '#065f46',
                }}>
                  <div style={{ fontWeight: '800', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>✨</span> Converting to CSD format offers:
                  </div>
                  <ul style={{ margin: '0', paddingLeft: '18px', lineHeight: '1.9' }}>
                    <li>Fast binary access — <strong>no re-parsing on every load</strong></li>
                    <li>Native slider, zoom, and channel rendering</li>
                    <li>Much smaller memory footprint</li>
                    <li>Support for min/max range per channel</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </DialogContent>

        <DialogActions style={{
          padding: '16px 20px', background: '#fafafa',
          borderTop: '1px solid #e2e8f0',
          display: 'flex', gap: '8px', justifyContent: 'flex-end',
          flexWrap: 'wrap'
        }}>
          {/* Cancel */}
          <Button
            onClick={() => {
              setLargeCsvDialogOpen(false);
              TestAPI.resolveLargeCsvChoice && TestAPI.resolveLargeCsvChoice('cancel');
            }}
            variant="outlined"
            style={{ borderRadius: '8px', fontWeight: '700', color: '#64748b', borderColor: '#cbd5e1', textTransform: 'none' }}
          >
            Cancel
          </Button>

          {/* Open as CSV anyway */}
          <Button
            onClick={() => {
              setLargeCsvDialogOpen(false);
              TestAPI.resolveLargeCsvChoice && TestAPI.resolveLargeCsvChoice('open');
            }}
            variant="outlined"
            style={{ borderRadius: '8px', fontWeight: '700', color: '#92400e', borderColor: '#f59e0b', textTransform: 'none' }}
          >
            Open as CSV Anyway
          </Button>

          {/* Convert to CSD — primary action */}
          <Button
            onClick={() => {
              setLargeCsvDialogOpen(false);
              TestAPI.resolveLargeCsvChoice && TestAPI.resolveLargeCsvChoice('convert');
            }}
            variant="contained"
            style={{
              borderRadius: '8px', fontWeight: '800', textTransform: 'none',
              background: 'linear-gradient(135deg, #00ac86, #007d61)',
              color: '#fff', padding: '8px 20px',
            }}
          >
            ✨ Convert to CSD
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══ CSD Export — Gap Analysis & Choice Dialog ═══ */}

      <Dialog
        maxWidth="md"
        fullWidth
        onClose={() => setCsdGapDialogOpen(false)}
        open={csdGapDialogOpen}
        PaperProps={{ style: { borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' } }}
      >
        <DialogTitle style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#f8fafc', padding: '20px 24px',
          display: 'flex', alignItems: 'center', gap: '12px',
          fontWeight: '800', fontSize: '17px',
        }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#f59e0b" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Export Data Analysis
        </DialogTitle>

        <DialogContent style={{ padding: '0', background: '#f8fafc' }}>
          {csdGapSummary && (() => {
            const fmt = (ms) => {
              const d = new Date(ms), p = n => String(n).padStart(2,'0');
              return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
            };
            const fmtDur = (ms) => {
              const s = Math.round(ms / 1000);
              if (s < 60) return `${s}s`;
              if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
              return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
            };
            const naPercent  = csdGapSummary.naPercent ?? 0;
            const gapCount   = csdGapSummary.gapCount ?? 0;
            const segCount   = (csdGapSummary.segments ?? []).length;

            return (
              <div>
                {/* ── Stats strip ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                  {[
                    { label: 'Gaps Found',     value: gapCount,                                              color: gapCount > 0 ? '#f59e0b' : '#10b981' },
                    { label: 'Real Samples',   value: (csdGapSummary.totalRealSamples ?? 0).toLocaleString(), color: '#00ac86' },
                    { label: 'N/A Slots',      value: (csdGapSummary.totalMissingSamples ?? 0).toLocaleString(), color: gapCount > 0 ? '#ef4444' : '#10b981' },
                    { label: 'N/A Ratio',      value: `${naPercent.toFixed(1)}%`,                            color: naPercent > 20 ? '#ef4444' : naPercent > 5 ? '#f59e0b' : '#10b981' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: '#fff', padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* ── Meta row ── */}
                <div style={{ padding: '9px 20px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '11.5px', color: '#475569', fontWeight: '600' }}>
                  <span>⏱ Interval: <strong style={{color:'#0f172a'}}>{csdGapSummary.detectedIntervalSec}s</strong></span>
                  <span>🕐 Start: <strong style={{color:'#0f172a'}}>{csdGapSummary.startTimeMs ? fmt(csdGapSummary.startTimeMs) : '—'}</strong></span>
                  <span>🔚 End: <strong style={{color:'#0f172a'}}>{csdGapSummary.stopTimeMs ? fmt(csdGapSummary.stopTimeMs) : '—'}</strong></span>
                  <span>📂 Continuous segments: <strong style={{color:'#0f172a'}}>{segCount}</strong></span>
                </div>

                {/* ── Two-choice cards ── */}
                {gapCount > 0 ? (
                  <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {/* Option A — Single file */}
                    <div style={{
                      border: '2px solid #f59e0b', borderRadius: '12px', background: '#fffbeb',
                      padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '24px' }}>📦</span>
                        <div>
                          <div style={{ fontWeight: '800', fontSize: '14px', color: '#92400e' }}>Single CSD File</div>
                          <div style={{ fontSize: '11px', color: '#b45309' }}>Full timeline preserved</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#78350f', lineHeight: '1.6', background: '#fef3c7', borderRadius: '6px', padding: '10px 12px' }}>
                        The CSV has <strong>{gapCount} timestamp gap{gapCount > 1 ? 's' : ''}</strong>. CSD requires a uniform grid, so <strong>{(csdGapSummary.totalMissingSamples ?? 0).toLocaleString()} missing slots</strong> will be filled with <code style={{background:'#fed7aa',padding:'1px 4px',borderRadius:'3px'}}>−9999 (N/A)</code>.
                        <br /><br />
                        The resulting file will contain <strong style={{color: naPercent > 20 ? '#dc2626' : '#b45309'}}>{naPercent.toFixed(1)}% N/A data</strong> out of {(csdGapSummary.totalCsdSamples ?? 0).toLocaleString()} total slots.
                      </div>
                      <Button
                        onClick={handleCsdExportConfirmed}
                        variant="contained"
                        fullWidth
                        style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color:'#fff', borderRadius:'8px', fontWeight:'800', fontSize:'13px', textTransform:'none', padding:'10px' }}
                      >
                        Save as 1 CSD File ({naPercent.toFixed(1)}% N/A)
                      </Button>
                    </div>

                    {/* Option B — Split files */}
                    <div style={{
                      border: '2px solid #00ac86', borderRadius: '12px', background: '#ecfdf5',
                      padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '24px' }}>🗂</span>
                        <div>
                          <div style={{ fontWeight: '800', fontSize: '14px', color: '#065f46' }}>Split into {segCount} CSD Files</div>
                          <div style={{ fontSize: '11px', color: '#047857' }}>Zero N/A — pure real data</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#064e3b', lineHeight: '1.6', background: '#d1fae5', borderRadius: '6px', padding: '10px 12px' }}>
                        Each continuous period becomes its own independent CSD file — <strong>no N/A padding</strong>. Files are named <code style={{background:'#a7f3d0',padding:'1px 4px',borderRadius:'3px'}}>name_part01.csd</code>, <code style={{background:'#a7f3d0',padding:'1px 4px',borderRadius:'3px'}}>name_part02.csd</code> …
                        <br /><br />
                        You will receive <strong style={{color:'#065f46'}}>{segCount} file{segCount > 1 ? 's' : ''}</strong>, each containing 100% real data.
                      </div>
                      <Button
                        onClick={handleCsdExportSplit}
                        variant="contained"
                        fullWidth
                        style={{ background: 'linear-gradient(135deg,#00ac86,#007d61)', color:'#fff', borderRadius:'8px', fontWeight:'800', fontSize:'13px', textTransform:'none', padding:'10px' }}
                      >
                        Split into {segCount} CSD File{segCount > 1 ? 's' : ''} (0% N/A)
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* No gaps — single clean export */
                  <div style={{ padding: '16px' }}>
                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '14px 16px', fontSize: '13px', color: '#065f46', marginBottom: '12px' }}>
                      ✅ No timestamp gaps detected. This CSV is fully continuous — the CSD output will be an exact 1-to-1 conversion with <strong>0% N/A data</strong>.
                    </div>
                    <Button onClick={handleCsdExportConfirmed} variant="contained" fullWidth
                      style={{ background: 'linear-gradient(135deg,#00ac86,#007d61)', color:'#fff', borderRadius:'8px', fontWeight:'800', fontSize:'14px', textTransform:'none', padding:'12px' }}>
                      Export to CSD
                    </Button>
                  </div>
                )}

                {/* ── Gap detail table ── */}
                {gapCount > 0 && (
                  <div style={{ padding: '0 16px 16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Gap details ({gapCount} gaps)
                    </div>
                    <div style={{ maxHeight: '170px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                            {['#', 'Gap Start', 'Resume At', 'Duration', 'Missing Samples'].map((h, i) => (
                              <th key={i} style={{ padding: '7px 10px', textAlign: i === 0 ? 'center' : i === 4 ? 'right' : 'left', fontWeight: '700', color: '#334155', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csdGapSummary.gaps.map((gap, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 ? '#fafafa' : '#fff' }}>
                              <td style={{ padding: '6px 10px', textAlign: 'center', color: '#94a3b8', fontWeight: '700' }}>{i + 1}</td>
                              <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#0f172a' }}>{fmt(gap.from)}</td>
                              <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#0f172a' }}>{fmt(gap.to)}</td>
                              <td style={{ padding: '6px 10px', color: '#f59e0b', fontWeight: '700' }}>{fmtDur(gap.deltaMs)}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', color: '#ef4444' }}>{gap.missingSamples.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>

        <DialogActions style={{ padding: '12px 20px', background: '#f1f5f9', borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setCsdGapDialogOpen(false)} variant="outlined"
            style={{ borderRadius: '8px', fontWeight: '700', color: '#475569', borderColor: '#cbd5e1', textTransform: 'none' }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Header-repair dialog (offered when the opened CSD needed a repair) */}
      <Dialog open={Boolean(repairInfo)} onClose={handleDismissRepair} maxWidth="sm">
        <DialogTitle className="dialog-title" style={{ background: 'linear-gradient(135deg,#0f766e,#00ac86)', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ffe000" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Repair Header And Save?</span>
          </div>
        </DialogTitle>
        <DialogContent style={{ padding: '20px 24px' }}>
          {(() => {
            const parts = [];
            if (repairInfo && repairInfo.stopTime) parts.push('stop time');
            if (repairInfo && repairInfo.sampleCount) parts.push('sample count');
            if (repairInfo && repairInfo.startTime) parts.push('start time');
            if (repairInfo && repairInfo.sampleRateFactor) parts.push('sample rate');
            if (repairInfo && repairInfo.dataPointer) parts.push('data pointer');
            if (repairInfo && repairInfo.channelNumbers) parts.push('channel numbers');
            const what = parts.length > 0 ? parts.join(', ') : 'header';
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: '1.6' }}>
                  This file has an invalid <strong>{what}</strong> in its header
                  {repairInfo && repairInfo.fileName ? ` (${repairInfo.fileName})` : ''}.
                  The data has been read using a repaired header, but your local file is still broken.
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.6', background: '#f1f5f9', borderRadius: '8px', padding: '10px 12px' }}>
                  A repaired copy will be saved as <code style={{background:'#e2e8f0',padding:'1px 4px',borderRadius:'3px'}}>name_repaired.csd</code>.
                  The original file is <strong>never modified</strong>.
                </div>
              </div>
            );
          })()}
        </DialogContent>
        <DialogActions style={{ padding: '12px 20px', background: '#f1f5f9', borderTop: '1px solid #e2e8f0', gap: '8px' }}>
          <Button onClick={handleDismissRepair} variant="outlined"
            style={{ borderRadius: '8px', fontWeight: '700', color: '#64748b', borderColor: '#cbd5e1', textTransform: 'none' }}>
            Dismiss
          </Button>
          <Button onClick={handleSaveRepairedCopy} variant="contained"
            style={{ background: 'linear-gradient(135deg,#00ac86,#007d61)', color: '#fff', borderRadius: '8px', fontWeight: '800', textTransform: 'none' }}>
            Save Repaired Copy
          </Button>
        </DialogActions>
      </Dialog>

      <Loading ref={globalLoadingRef} />

      {/* Recording start: sampling interval */}
      <Dialog open={recStartOpen} onClose={() => setRecStartOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Start Live Recording</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Sampling interval (seconds)"
            type="number"
            fullWidth
            value={recIntervalInput}
            onChange={(e) => setRecIntervalInput(e.target.value)}
            inputProps={{ min: 1, max: 3600 }}
            helperText="The first sample is taken immediately, the next after each interval — e.g. 10 s: 09:00:01, 09:00:11, 09:00:21…"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { TauriSutoAPI.logClientEvent('INFO', 'RECORDER', 'Recording start cancelled'); setRecStartOpen(false); }}>Cancel</Button>
          <Button variant="contained" onClick={handleStartRecordingFromDialog}>
            Start Recording
          </Button>
        </DialogActions>
      </Dialog>

      {/* A recording is still running — confirm before leaving */}
      <Dialog open={Boolean(exitConfirm)} onClose={() => setExitConfirm(null)} maxWidth="xs">
        <DialogTitle>Recording in progress</DialogTitle>
        <DialogContent>
          <div style={{ fontSize: 14, color: '#334155' }}>
            A live recording is still running. Stop it and save the CSV before{' '}
            {exitConfirm && exitConfirm.action === 'close' ? 'closing the app' : 'returning to home'}?
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { TauriSutoAPI.logClientEvent('INFO', 'APP', 'Exit cancelled — recording continues'); setExitConfirm(null); }}>Keep Recording</Button>
          <Button variant="contained" onClick={handleExitConfirmProceed}>
            Stop &amp; Save
          </Button>
        </DialogActions>
      </Dialog>


      {/* Status Bar */}
      <footer className="app-status-bar">
        <div className="status-bar-left">
          <div className="status-indicator">
            <span className={`status-dot ${appMode === 'monitor' || fileLoaded ? 'active' : ''}`}></span>
            <span className="status-text">
              {appMode === 'monitor'
                ? `Monitor: ${deviceInfo?.device || 'Live SUTO Sensor'}`
                : fileLoaded
                ? 'Data Loaded'
                : 'Ready'}
            </span>
          </div>
          {appMode === 'analyze' && fileLoaded && loadedFilename && (
            <>
              <span className="status-separator">|</span>
              <div className="current-file-display" title="Current Opened File">
                <svg className="file-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="filename-text">{loadedFilename}</span>
              </div>
            </>
          )}
        </div>
        <div className="status-bar-right">
          {appMode === 'monitor' && (
            <span className="status-badge" style={{ color: '#10b981', borderColor: '#059669' }}>
              ONLINE MONITOR
            </span>
          )}
          {appMode === 'analyze' && fileLoaded && TestAPI.isCsvMode && (
            <span className="status-badge">
              {TestAPI.isCsvMode() ? 'CSV File' : 'CSD File'}
            </span>
          )}
          <span className="status-timestamp">
            {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </footer>

      {/* Global File Loading Overlay */}
      {fileLoading && (
        <div className="file-loading-overlay">
          <div className="file-loading-card">
            <div className="file-loading-logo-box">
              <svg className="file-loading-spinner" viewBox="0 0 24 24" width="36" height="36">
                <path
                  fill="none"
                  stroke="#00ac86"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 17l6-6 4 4 8-8"
                />
              </svg>
            </div>
            <h2 className="file-loading-title">
              Loading File...
            </h2>
            <p className="file-loading-subtitle">
              Reading binary slices for <strong className="file-loading-filename">{loadingFilename}</strong>
            </p>
            
            <div className="file-loading-bar-track">
              <div 
                className="file-loading-bar-fill"
                style={{ width: `${Math.round(fileLoadingProgress * 100)}%` }}
              />
            </div>
            <div className="file-loading-pct">
              {Math.round(fileLoadingProgress * 100)}% Completed
            </div>
          </div>
        </div>
      )}

      {/* Data Modification & Synthesis Studio Modal */}
      <DataModifierModal
        open={modifierOpen}
        onClose={() => setModifierOpen(false)}
        onFileReloaded={(name) => {
          if (name) setLoadedFilename(name);
        }}
      />

      {/* SUTO Hardware & USB Diagnostic Log Modal */}
      <DebugLogModal
        isOpen={showDebugLogs}
        onClose={() => setShowDebugLogs(false)}
      />

      {/* SUTO Multi-Transport Device Connect Modal (USB, TCP, BLE) */}
      <DeviceConnectModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConnected={handleDeviceConnected}
      />

      {/* Platform App Download Dialog (Windows, macOS, Android) */}
      <DownloadAppModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        version={APP_VERSION}
      />
    </div>
  );
}

export default App;
