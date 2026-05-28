import React from 'react';
import GraphicView from './modules/graphicview';
import TableView from './modules/tableview/TableView';
import ConsumptionReport from './modules/consumption/ConsumptionReport';
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
    }

    if (TestAPI.onFileLoaded) {
      TestAPI.onFileLoaded(() => {
        setFileLoaded(true);
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
        alert('Failed to load file!');
      }
    };

    window.addEventListener('fileLoadStart', handleStart);
    window.addEventListener('fileLoadProgress', handleProgress);

    return () => {
      window.removeEventListener('fileLoadStart', handleStart);
      window.removeEventListener('fileLoadProgress', handleProgress);
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
      alert("No CSD file is currently loaded.");
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
      alert("Failed to export CSD to CSV: " + e.message);
    } finally {
      if (globalLoadingRef.current) {
        globalLoadingRef.current.hide();
      }
    }
  };

  const handleExportExcelOption = async () => {
    handleShareClose();
    if (!TestAPI.isFileLoaded || !TestAPI.isFileLoaded()) {
      alert("No CSD file is currently loaded.");
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
      alert("Failed to export CSD to Excel: " + e.message);
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
              className={`tab-btn ${activeTab === 'consumption' ? 'active' : ''}`}
              onClick={() => setActiveTab('consumption')}
            >
              Consumption
            </button>
          </div>
        )}

        <div className="header-right" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isCsdMode && fileLoaded && (
            <Tooltip title="Open CSD File">
              <IconButton className="header-icon-btn" onClick={handleHeaderOpenCsd} style={{ color: '#0f172a' }}>
                <FolderOpenIcon />
              </IconButton>
            </Tooltip>
          )}

          {isCsdMode && fileLoaded && (
            <>
              <Tooltip title="Export CSD Data">
                <IconButton className="header-icon-btn" onClick={handleShareClick} style={{ color: '#0f172a' }}>
                  <ShareIcon />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={shareMenuAnchorEl}
                open={Boolean(shareMenuAnchorEl)}
                onClose={handleShareClose}
              >
                <MenuItem
                  onClick={handleExportCsvOption}
                  disabled={Boolean(TestAPI.isCsvMode && TestAPI.isCsvMode())}
                >
                  Export all CSD to CSV
                </MenuItem>
                <MenuItem onClick={handleExportExcelOption}>
                  Export all CSD to Excel
                </MenuItem>
              </Menu>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main-content">
        {isCsdMode && !fileLoaded ? (
          /* Landing page when no CSD file is loaded */
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
                Open a CSD file to show data and start analyzing sensor measurements.
              </p>

              <button className="landing-cta-btn" onClick={handleOpenFile}>
                <svg className="btn-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Open CSD File
              </button>

              {recentFiles.length > 0 && (
                <div className="recent-files-section">
                  <h3 className="recent-files-title">Recent CSD Files</h3>
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
            {activeTab === 'graphic' ? (
              <GraphicView />
            ) : activeTab === 'table' ? (
              <TableView />
            ) : (
              <ConsumptionReport />
            )}
          </div>
        )}
      </main>

      {/* Global Recent Files Dialog */}
      <Dialog maxWidth='md' onClose={() => setRecentDialogOpen(false)} open={recentDialogOpen}>
        <DialogTitle className="dialog-title" onClose={() => setRecentDialogOpen(false)}>
          Recent CSD Files
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
            Open New CSD File...
          </Button>
          <Button onClick={() => setRecentDialogOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
      <Loading ref={globalLoadingRef} />

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
              Loading CSD File...
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
