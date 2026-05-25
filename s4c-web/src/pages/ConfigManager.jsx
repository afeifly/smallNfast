import React, { useState, useRef, useEffect } from 'react';
import { unzipConfigFile, parseSummary, calculateConfigHash, exportConfigPackage, generateSummary } from '../util/configFileUtils';
import { useConfig } from '../context/ConfigContext';
import iconAlertBig from '../assets/images/icon_alert_big.png';
import iconSmallPlusCircle from '../assets/images/icon-small-plus-circle.png';
import iconBtnDelete from '../assets/images/icon_btn_delete.png';
import CustomDialog from '../components/CustomDialog';
import './sensorconfiguration/SUTOSensor.css'; // Reuse table styles

const ConfigManager = () => {
  const { 
    configData: activeConfig, 
    configList, 
    setActiveConfigId, 
    deleteConfig, 
    addConfig,
    activeConfigId
  } = useConfig();

  const [view, setView] = useState('list'); // 'list' | 'details'
  const [detailsId, setDetailsId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Long press logic
  const pressTimer = useRef(null);

  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    body: '',
    type: 'warn',
    onConfirm: null,
    showCancel: true,
    confirmText: 'Confirm'
  });

  const closeDialog = () => setDialogState(prev => ({ ...prev, isOpen: false }));

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const fileMap = await unzipConfigFile(file);
      const summary = parseSummary(fileMap);
      
      const extractedConfigs = {};
      const decoder = new TextDecoder();
      for (const [path, content] of fileMap.entries()) {
        if (path.endsWith('.json') || path.endsWith('.sutolist')) {
          try {
            extractedConfigs[path] = JSON.parse(decoder.decode(content));
          } catch (e) {
            extractedConfigs[path] = 'Error parsing JSON';
          }
        }
      }

      const newConfig = {
        summary,
        configs: extractedConfigs,
        fileMap: fileMap,
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + ' KB',
        importTime: new Date().toLocaleString()
      };

      addConfig(newConfig);
    } catch (err) {
      console.error(err);
      setError('Failed to process config file. Check password or file format.');
    } finally {
      setLoading(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleCreateEmpty = () => {
    const now = new Date().toISOString();
    const emptySummary = {
      'Config-Version': '1.0.0',
      'Config-Date': now,
      'Device-Type': 'S4C',
      'Description': 'Empty Configuration',
      'hash': ''
    };

    const emptyConfigs = {
      'config/cfgcommunicatport.json': {
        rs485m0: { baudrate: 19200, parityFrameIndex: 3, responseTimeout: 10 },
        rs485s0: { baudrate: 19200, parityFrameIndex: 3, responseTimeout: 10, address: 1 },
        retcp: { protocol: 3 }
      },
      'config/SUTO-SensorList.sutolist': { cfgsensor: [] }
    };

    const fileMap = new Map();
    const encoder = new TextEncoder();
    fileMap.set('summary.yml', encoder.encode('')); // Placeholder, will be hashed on export

    addConfig({
      summary: emptySummary,
      configs: emptyConfigs,
      fileMap: fileMap,
      fileName: `empty_config_${new Date().getTime()}.cfgf`,
      fileSize: '0.1 KB',
      importTime: new Date().toLocaleString()
    });
  };

  const handleExport = async (config) => {
    setLoading(true);
    try {
      const blob = await exportConfigPackage(
        config.configs, 
        config.summary, 
        config.fileMap
      );
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = config.fileName || 'config.cfgf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setDialogState({
        isOpen: true,
        title: 'Export Failed',
        body: 'Failed to export configuration.',
        type: 'err',
        showCancel: false,
        confirmText: 'OK',
        onConfirm: closeDialog
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id, fileName) => {
    setDialogState({
      isOpen: true,
      title: 'Delete Config',
      body: `Are you sure you want to delete "${fileName}"?`,
      type: 'warn',
      showCancel: true,
      confirmText: 'Delete',
      onConfirm: () => {
        deleteConfig(id);
        closeDialog();
      }
    });
  };

  const startPress = (id) => {
    pressTimer.current = setTimeout(() => {
      setDetailsId(id);
      setView('details');
    }, 7000); // 7 seconds
  };

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  if (view === 'details') {
    const config = configList.find(c => c.id === detailsId);
    if (!config) {
      setView('list');
      return null;
    }

    return (
      <div className="content-card suto-sensor-page">
        <header className="suto-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              className="page-btn" 
              onClick={() => setView('list')}
              style={{ padding: '4px', borderRadius: '4px' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="suto-title">Config Details: {config.fileName}</h2>
          </div>
        </header>
        <div className="suto-body" style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ background: '#F8F9FA', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Properties</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <PropertyRow label="File Name" value={config.fileName} />
                  <PropertyRow label="File Size" value={config.fileSize} />
                  <PropertyRow label="Imported" value={config.importTime} />
                </div>
              </div>
              <div style={{ background: '#F8F9FA', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Summary.yml</h3>
                <pre style={{ margin: 0, fontSize: '12px', background: 'white', padding: '12px', borderRadius: '4px', overflowX: 'auto' }}>
                  {JSON.stringify(config.summary, null, 2)}
                </pre>
              </div>
            </div>
            <div style={{ background: '#F8F9FA', padding: '20px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Embedded Documents</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {Object.entries(config.configs).map(([path, data]) => (
                  <div key={path} style={{ border: '1px solid #E5E6EB', borderRadius: '6px', background: 'white' }}>
                    <div style={{ background: '#F2F3F5', padding: '6px 12px', fontSize: '13px', fontWeight: '600' }}>{path}</div>
                    <pre style={{ margin: 0, padding: '12px', fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                      {JSON.stringify(data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-card suto-sensor-page">
      <header className="suto-header">
        <h2 className="suto-title">Config file</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="add-sensor-btn"
            onClick={handleCreateEmpty}
            style={{ background: '#F2F3F5', color: '#4E5969' }}
          >
            <span>Create Empty</span>
          </button>
          <input 
            type="file" 
            id="cfg-upload" 
            style={{ display: 'none' }} 
            onChange={handleFileUpload} 
            accept=".cfgf"
          />
          <label htmlFor="cfg-upload" className="add-sensor-btn" style={{ cursor: 'pointer' }}>
            <img src={iconSmallPlusCircle} width="16" height="16" style={{ filter: 'brightness(0) invert(1)' }} alt="plus" />
            <span>Import .cfgf</span>
          </label>
        </div>
      </header>

      <div className="suto-body">
        <div className="suto-table-container">
          <table className="suto-table">
            <thead>
              <tr>
                <th>File name</th>
                <th style={{ width: '120px' }}>Version</th>
                <th style={{ width: '180px' }}>Create time</th>
                <th style={{ width: '100px' }}>Status</th>
                <th style={{ width: '180px' }} className="col-operate">Action</th>
              </tr>
            </thead>
            <tbody>
              {configList.length > 0 ? (
                configList.map((cfg) => (
                  <tr key={cfg.id} className={cfg.id === activeConfigId ? 'active-row' : ''}>
                    <td 
                      onMouseDown={() => startPress(cfg.id)}
                      onMouseUp={cancelPress}
                      onMouseLeave={cancelPress}
                      onTouchStart={() => startPress(cfg.id)}
                      onTouchEnd={cancelPress}
                      style={{ cursor: 'pointer', fontWeight: cfg.id === activeConfigId ? 'bold' : 'normal' }}
                    >
                      {cfg.fileName}
                      {cfg.id === activeConfigId && <span style={{ marginLeft: '8px', color: '#00AB84', fontSize: '12px' }}>[Loaded]</span>}
                    </td>
                    <td>{cfg.summary?.['Config-Version'] || cfg.summary?.['version'] || '1.0.0'}</td>
                    <td>{cfg.summary?.['Config-Date'] || cfg.summary?.['date'] || cfg.importTime}</td>
                    <td>
                      <span style={{ 
                        color: cfg.id === activeConfigId ? '#00AB84' : '#86909C',
                        background: cfg.id === activeConfigId ? '#E6F6F2' : '#F2F3F5',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '12px'
                      }}>
                        {cfg.id === activeConfigId ? 'Active' : 'Idle'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        {cfg.id === activeConfigId ? (
                          <button 
                            className="btn-modbus-save" 
                            style={{ 
                              padding: '2px 12px', 
                              fontSize: '12px', 
                              height: '28px', 
                              background: '#FFF7E8', 
                              color: '#E6A23C', 
                              border: '1px solid #FFE4BA' 
                            }}
                            onClick={() => setActiveConfigId(null)}
                          >
                            Clear
                          </button>
                        ) : (
                          <button 
                            className="btn-modbus-save" 
                            style={{ padding: '2px 12px', fontSize: '12px', height: '28px' }}
                            onClick={() => setActiveConfigId(cfg.id)}
                          >
                            Load
                          </button>
                        )}
                        <button 
                          className="btn-icon-img" 
                          onClick={() => handleExport(cfg)}
                          title="Export"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4E5969" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                          </svg>
                        </button>
                        <button 
                          className="btn-icon-img" 
                          onClick={() => handleDeleteClick(cfg.id, cfg.fileName)}
                          title="Delete"
                        >
                          <img src={iconBtnDelete} alt="Delete" style={{ width: 18, height: 18 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">
                    <div className="suto-empty-container">
                      No configuration files loaded. Import a .cfgf file to begin.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CustomDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        onConfirm={dialogState.onConfirm}
        title={dialogState.title}
        body={dialogState.body}
        type={dialogState.type}
        showCancel={dialogState.showCancel}
        confirmText={dialogState.confirmText}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .active-row {
          background-color: #F0FBF9 !important;
        }
        .active-row td {
          border-bottom-color: #B2E5D9 !important;
        }
      `}} />
    </div>
  );
};

const PropertyRow = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
    <span style={{ color: '#86909C' }}>{label}</span>
    <span style={{ fontWeight: '600' }}>{value}</span>
  </div>
);

export default ConfigManager;
