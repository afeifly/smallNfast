import React from 'react';
import GraphicView from './modules/graphicview';
import TableView from './modules/tableview/TableView';
import ConsumptionReport from './modules/consumption/ConsumptionReport';
import FileInfoView from './modules/fileinfo/FileInfoView';
import CompressorAnalyze from './modules/analyze/CompressorAnalyze';
import TestAPI from './api/TestAPI';
import Loading from './components/loading/Loading';
import './App.css';

import intl from 'react-intl-universal';
import locales from './locales/en-US';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ShareIcon from '@mui/icons-material/Share';
import DeleteIcon from '@mui/icons-material/Delete';

const isCsdMode = import.meta.env.VITE_USE_CSD === 'true';

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
  const [fileLoaded, setFileLoaded] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('graphic');
  const [recentFiles, setRecentFiles] = React.useState([]);
  const [recentDialogOpen, setRecentDialogOpen] = React.useState(false);
  const [shareMenuAnchorEl, setShareMenuAnchorEl] = React.useState(null);

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

  React.useEffect(() => {
    if (!localStorage.getItem('username')) {
      localStorage.setItem('username', 'admin');
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
      if (TestAPI.getLoadedFileName) {
        setLoadedFilename(TestAPI.getLoadedFileName());
      }
    }

    if (TestAPI.onFileLoaded) {
      TestAPI.onFileLoaded(() => {
        setFileLoaded(true);
        if (TestAPI.getLoadedFileName) {
          setLoadedFilename(TestAPI.getLoadedFileName());
        }
        if (TestAPI.getRecentFiles) {
          setRecentFiles(TestAPI.getRecentFiles());
        }
      });
    }

    if (TestAPI.getRecentFiles) {
      setRecentFiles(TestAPI.getRecentFiles());
    }
  }, [initDone]);

  React.useEffect(() => {
    const handleStart = (e) => {
      localStorage.removeItem('selectedChannels');
      setLoadingFilename(e.detail.filename);
      setFileLoading(true);
      setFileLoadingProgress(0);
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
        window.showAppNotification(
          "File Load Failed",
          `There was a problem loading your file. The file header format verification failed:\n\n${errMsg}`,
          "error"
        );
      }
    };

    const handleNotification = (e) => {
      const { title, message, type } = e.detail;
      setNotiTitle(title || 'Notification');
      setNotiMsg(message || '');
      setNotiType(type || 'info');
      setNotiOpen(true);
    };

    window.addEventListener('fileLoadStart', handleStart);
    window.addEventListener('fileLoadProgress', handleProgress);
    window.addEventListener('appNotification', handleNotification);

    return () => {
      window.removeEventListener('fileLoadStart', handleStart);
      window.removeEventListener('fileLoadProgress', handleProgress);
      window.removeEventListener('appNotification', handleNotification);
    };
  }, []);

  const handleRemoveRecentFile = async (file, e) => {
    if (e) e.stopPropagation();
    if (TestAPI.removeRecentFile) {
      const updated = await TestAPI.removeRecentFile(file.name);
      setRecentFiles(updated);
    }
  };

  const handleOpenFile = () => {
    if (TestAPI.openFile) {
      TestAPI.openFile();
    }
  };

  const handleHeaderOpenCsd = () => {
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

  const handleLoadRecentFile = async (file) => {
    localStorage.removeItem('selectedChannels');
    if (file.path && TestAPI.loadFileFromPath) {
      await TestAPI.loadFileFromPath(file.path);
    } else if (TestAPI.getHandleForFile && TestAPI.loadFileFromHandle) {
      const handle = await TestAPI.getHandleForFile(file.name);
      if (handle) {
        await TestAPI.loadFileFromHandle(handle);
      }
    }
  };

  const handleShareClick = (event) => {
    setShareMenuAnchorEl(event.currentTarget);
  };

  const handleShareClose = () => {
    setShareMenuAnchorEl(null);
  };

  const handleExportCsvOption = async () => {
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
    handleShareClose();
    if (!TestAPI.isFileLoaded || !TestAPI.isFileLoaded()) {
      window.showAppNotification("Export Aborted", "No file is currently loaded.", "warning");
      return;
    }
    if (!TestAPI.isCsvMode || !TestAPI.isCsvMode()) {
      window.showAppNotification("Export Aborted", "Export to CSD is only available when a CSV file is loaded.", "warning");
      return;
    }
    // Compute gap summary and show confirmation dialog
    const summary = TestAPI.getGapSummary ? TestAPI.getGapSummary() : { gapCount: 0, gaps: [] };
    setCsdGapSummary(summary);
    setCsdGapDialogOpen(true);
  };

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
          <span className="app-title">S4A-Web</span>
        </div>

        {/* View Switcher Tabs (only shown in CSD mode and when a file is loaded, or always in non-CSD mode) */}
        {(!isCsdMode || fileLoaded) && (
          <div className="header-tabs">
            <button
              className={`tab-btn ${activeTab === 'fileinfo' ? 'active' : ''}`}
              onClick={() => setActiveTab('fileinfo')}
            >
              File Info
            </button>
            <button
              className={`tab-btn ${activeTab === 'graphic' ? 'active' : ''}`}
              onClick={() => setActiveTab('graphic')}
            >
              Graphic View
            </button>
            <button
              className={`tab-btn ${activeTab === 'table' ? 'active' : ''}`}
              onClick={() => setActiveTab('table')}
            >
              Table View
            </button>
            <button
              className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
              onClick={() => setActiveTab('report')}
            >
              Consumption Report
            </button>
            <button
              className={`tab-btn ${activeTab === 'analyze' ? 'active' : ''}`}
              onClick={() => setActiveTab('analyze')}
            >
              Compressor Analyze <span className="beta-tag">Beta</span>
            </button>
          </div>
        )}

        <div className="header-right" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isCsdMode && fileLoaded && (
            <Tooltip title="Open File">
              <IconButton className="header-icon-btn" onClick={handleHeaderOpenCsd} style={{ color: '#0f172a' }}>
                <FolderOpenIcon />
              </IconButton>
            </Tooltip>
          )}

          {isCsdMode && fileLoaded && (
            <>
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
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main-content">
        {isCsdMode && !fileLoaded ? (
          /* Landing page when no file is loaded */
          <div className="landing-container">
            <div className="landing-card">
              <div className="landing-logo-container">
                <svg className="landing-card-logo" viewBox="0 0 24 24" width="64" height="64">
                  <path
                    fill="none"
                    stroke="url(#landing-logo-grad)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 17l6-6 4 4 8-8"
                  />
                  <defs>
                    <linearGradient id="landing-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00ac86" />
                      <stop offset="100%" stopColor="#007d61" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h1 className="landing-title">Welcome to S4A-web</h1>
              <p className="landing-subtitle">
                Open a file to show data and start analyzing sensor measurements.
              </p>

              <button className="landing-cta-btn" onClick={handleOpenFile}>
                <svg className="btn-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
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
          </div>
        ) : (
          /* Main content display */
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
      <Dialog maxWidth='md' onClose={() => setRecentDialogOpen(false)} open={recentDialogOpen}>
        <DialogTitle className="dialog-title" onClose={() => setRecentDialogOpen(false)}>
          Recent Files
        </DialogTitle>
        <DialogContent>
          <List style={{ width: '400px', maxHeight: '300px', overflow: 'auto' }}>
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
                    primaryTypographyProps={{ style: { fontWeight: 'bold' } }}
                    secondaryTypographyProps={{ style: { fontSize: '11px', wordBreak: 'break-all' } }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions className="dialog-footer">
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
          CSV → CSD Export: Gap Analysis
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

      <Loading ref={globalLoadingRef} />


      {/* Status Bar */}
      <footer className="app-status-bar">
        <div className="status-bar-left">
          <div className="status-indicator">
            <span className={`status-dot ${fileLoaded ? 'active' : ''}`}></span>
            <span className="status-text">{fileLoaded ? 'Data Loaded' : 'No File Open'}</span>
          </div>
          {fileLoaded && loadedFilename && (
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
          {fileLoaded && TestAPI.isCsvMode && (
            <span className="status-badge">
              {TestAPI.isCsvMode() ? 'CSV Mode' : 'CSD Mode'}
            </span>
          )}
          <span className="status-timestamp">
            {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </footer>

      {/* Global File Loading Overlay */}
      {fileLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div className="landing-card" style={{ padding: '40px', textAlign: 'center', minWidth: '360px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div className="landing-logo-container" style={{ animation: 'spin 2s linear infinite' }}>
              <svg className="landing-card-logo" viewBox="0 0 24 24" width="64" height="64">
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
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginTop: '20px', color: '#0f172a' }}>
              Loading File...
            </h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '6px 0 20px 0' }}>
              Reading binary slices for <strong>{loadingFilename}</strong>
            </p>
            
            <div style={{ width: '100%', height: '8px', background: '#cbd5e1', borderRadius: '4px', overflow: 'hidden', position: 'relative', marginBottom: '12px' }}>
              <div 
                style={{ 
                  width: `${Math.round(fileLoadingProgress * 100)}%`, 
                  height: '100%', 
                  background: 'linear-gradient(90deg, #00ac86, #10b981)', 
                  transition: 'width 0.15s ease-out',
                  borderRadius: '4px' 
                }}
              />
            </div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#00ac86' }}>
              {Math.round(fileLoadingProgress * 100)}% Completed
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
