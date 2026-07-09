import React, { useState, useRef, useEffect } from 'react';
import { unzipConfigFile, parseSummary, calculateConfigHash, exportConfigPackage, generateSummary } from '../util/configFileUtils';
import { useConfig } from '../context/ConfigContext';
import { useLanguage } from '../context/LanguageContext';
import { createEmptyAlarmDb } from '../util/alarmDbUtils';
import iconAlertBig from '../assets/images/icon_alert_big.png';
import iconSmallPlusCircle from '../assets/images/icon-small-plus-circle.png';
import iconBtnDelete from '../assets/images/icon_btn_delete.png';
import CustomDialog from '../components/CustomDialog';
import './sensorconfiguration/SUTOSensor.css'; // Reuse table styles

const formatDateTime = (val) => {
  if (!val) return '—';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
    return str;
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return str;
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
};

const ConfigManager = () => {
  const { t } = useLanguage();
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
    confirmText: t('Confirm'),
    style: {}
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
        importTime: new Date().toISOString()
      };

      addConfig(newConfig);
    } catch (err) {
      console.error(err);
      setError(t('Failed to process config file. Check password or file format.'));
    } finally {
      setLoading(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleCreateNew = async () => {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const newSummary = {
        'Config-Version': '1.0.0',
        'Config-Date': now,
        'Device-Type': 'S4C',
        'Description': 'New Configuration',
        'hash': '',
        'version': '1.0.0',
        'createtime': now.replace('T', ' ').substring(0, 19),
        'reflect': {
          '/config/Alarm.db': '/data/Alarm.db',
          '/config/SUTO-SensorList.sutolist': '/data/configs/sensorlist/SUTO-SensorList.sutolist',
          '/config/cfgGraphic.json': '/data/configs/sensorlist/cfgGraphic.json',
          '/config/cfgLayout.json': '/data/configs/sensorlist/cfgLayout.json',
          '/config/cfgLocation.json': '/data/configs/sensorlist/cfgLocation.json',
          '/config/cfgOptionBoard.json': '/data/configs/sensorlist/cfgOptionBoard.json',
          '/config/cfglogger.json': '/data/configs/logger/cfglogger.json',
          '/system/backlight.json': '/data/backlight.json',
          '/system/cfgcommunicatport.json': '/data/configs/system/cfgcommunicatport.json',
          '/system/system_info.json': 'parser.system_info'
        },
        'fileversions': {
          '/config/Alarm.db': '1.0.0',
          '/config/SUTO-SensorList.sutolist': '1.0.0',
          '/config/cfgGraphic.json': '1.0.0',
          '/config/cfgLayout.json': '1.0.0',
          '/config/cfgLocation.json': '1.0.0',
          '/config/cfgOptionBoard.json': '1.0.0',
          '/config/cfglogger.json': '1.0.0',
          '/system/backlight.json': '1.0.0',
          '/system/cfgcommunicatport.json': '1.0.0',
          '/system/system_info.json': '1.0.0'
        }
      };

      const newConfigs = {
        'config/SUTO-SensorList.sutolist': { cfgsensor: [], logger: null, alarm: null },
        'config/cfgLocation.json': { Locations: [] },
        'config/cfgOptionBoard.json': { cfgOptionBoard: [] },
        'config/cfgLayout.json': { LayoutList: [] },
        'config/cfgGraphic.json': [],
        'config/cfglogger.json': { logger: null },
        'system/backlight.json': { backlight_max: 10, timeout: 60, min_brightness: 0 },
        'system/cfgcommunicatport.json': {
          rs485m0: { baudrate: 19200, parityFrameIndex: 3, responseTimeout: 10 },
          rs485s0: { baudrate: 19200, parityFrameIndex: 3, responseTimeout: 10, address: 1 },
          retcp: { protocol: 3 }
        },
        'system/system_info.json': {
          language_config: { language: 'en', local_id: 9 },
          user_info_config: {
            service_company_name: '-',
            address: '-',
            telephone: '-',
            email: '-',
            website: '-'
          }
        }
      };

      const fileMap = new Map();
      const encoder = new TextEncoder();
      fileMap.set('summary.yml', encoder.encode('')); // Placeholder, will be hashed on export

      // Create empty SQLite Alarm.db binary database
      const alarmDbBytes = await createEmptyAlarmDb();
      fileMap.set('config/Alarm.db', alarmDbBytes);

      addConfig({
        summary: newSummary,
        configs: newConfigs,
        fileMap: fileMap,
        fileName: `new_config_${new Date().getTime()}.cfgf`,
        fileSize: '0.1 KB',
        importTime: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
      setError(t('Failed to create new configuration.'));
    } finally {
      setLoading(false);
    }
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
        title: t('Export Failed'),
        body: t('Failed to export configuration.'),
        type: 'err',
        showCancel: false,
        confirmText: t('OK'),
        onConfirm: closeDialog
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id, fileName) => {
    setDialogState({
      isOpen: true,
      title: t('Delete Config'),
      body: t('Are you sure you want to delete "{fileName}"?').replaceAll('{fileName}', fileName),
      type: 'warn',
      showCancel: true,
      confirmText: t('Delete'),
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

  useEffect(() => {
    return () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    };
  }, []);

  const handleShowJsonDialog = (cfg) => {
    setDialogState({
      isOpen: true,
      title: `${t('JSON Viewer')} - ${cfg.fileName}`,
      type: 'info',
      showCancel: false,
      confirmText: t('Close'),
      onConfirm: closeDialog,
      style: { maxWidth: '800px', width: '800px' },
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '50vh', overflowY: 'auto', textAlign: 'left' }}>
          {Object.entries(cfg.configs).map(([path, data]) => (
            <div key={path} style={{ border: '1px solid #E5E6EB', borderRadius: '6px', background: 'white' }}>
              <div style={{ 
                background: '#F2F3F5', 
                padding: '6px 12px', 
                fontSize: '13px', 
                fontWeight: '600', 
                color: '#1D2129',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{path}</span>
                <CopyButton text={JSON.stringify(data, null, 2)} />
              </div>
              <pre style={{ margin: 0, padding: '12px', fontSize: '12px', maxHeight: '200px', overflowY: 'auto', background: '#FAFAFA', color: '#4E5969' }}>
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )
    });
  };

  const handleDownloadClick = (e, cfg) => {
    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleShowJsonDialog(cfg);
      return;
    }
    handleExport(cfg);
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
            <h2 className="suto-title">{t('Config Details')}: {config.fileName}</h2>
          </div>
        </header>
        <div className="suto-body" style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ background: '#F8F9FA', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>{t('Properties')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <PropertyRow label={t('File Name')} value={config.fileName} />
                  <PropertyRow label={t('File Size')} value={config.fileSize} />
                  <PropertyRow label={t('Imported')} value={formatDateTime(config.importTime)} />
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
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>{t('Embedded Documents')}</h3>
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
        <h2 className="suto-title">{t('Config file')}</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="add-sensor-btn"
            onClick={handleCreateNew}
            style={{ background: '#F2F3F5', color: '#4E5969' }}
          >
            <span>{t('Create New')}</span>
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
            <span>{t('Import .cfgf')}</span>
          </label>
        </div>
      </header>

      <div className="suto-body">
        <div className="suto-table-container">
          <table className="suto-table">
            <thead>
              <tr>
                <th>{t('File name')}</th>
                <th style={{ width: '120px' }}>{t('Version')}</th>
                <th style={{ width: '180px' }}>{t('Create time')}</th>
                <th style={{ width: '120px' }}>{t('Status')}</th>
                <th style={{ width: '180px', textAlign: 'center' }} className="col-operate">{t('Action')}</th>
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
                      {cfg.id === activeConfigId && <span style={{ marginLeft: '8px', color: '#00AB84', fontSize: '12px' }}>{t('[Loaded]')}</span>}
                    </td>
                    <td>{cfg.summary?.['Config-Version'] || cfg.summary?.['version'] || '1.0.0'}</td>
                    <td>{formatDateTime(cfg.summary?.['Config-Date'] || cfg.summary?.['date'] || cfg.importTime)}</td>
                    <td>
                      <span style={{ 
                        color: cfg.id === activeConfigId ? '#00AB84' : '#86909C',
                        background: cfg.id === activeConfigId ? '#E6F6F2' : '#F2F3F5',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '12px'
                      }}>
                        {cfg.id === activeConfigId ? t('Active') : t('Idle')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        {cfg.id !== activeConfigId ? (
                          <button 
                            className="btn-modbus-save" 
                            style={{ padding: '2px 12px', fontSize: '12px', height: '28px' }}
                            onClick={() => setActiveConfigId(cfg.id)}
                          >
                            {t('Load')}
                          </button>
                        ) : (
                          <button 
                            className="btn-modbus-save" 
                            style={{ 
                              padding: '2px 12px', 
                              fontSize: '12px', 
                              height: '28px',
                              visibility: 'hidden',
                              pointerEvents: 'none'
                            }}
                            tabIndex="-1"
                          >
                            {t('Load')}
                          </button>
                        )}
                        <button 
                          className="btn-icon-img" 
                          onClick={(e) => handleDownloadClick(e, cfg)}
                          title={t('Export (Shift+Click to view JSON)')}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4E5969" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                          </svg>
                        </button>
                        <button 
                          className="btn-icon-img" 
                          onClick={() => handleDeleteClick(cfg.id, cfg.fileName)}
                          title={t('Delete')}
                        >
                          <img src={iconBtnDelete} alt={t('Delete')} style={{ width: 18, height: 18 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">
                    <div className="suto-empty-container">
                      {t('No configuration files loaded. Import a .cfgf file to begin.')}
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
        style={dialogState.style}
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

const CopyButton = ({ text }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        background: copied ? '#E6F6F2' : '#FFFFFF',
        color: copied ? '#00AB84' : '#4E5969',
        border: `1px solid ${copied ? '#B2E5D9' : '#DCDCDC'}`,
        borderRadius: '4px',
        padding: '2px 8px',
        fontSize: '11px',
        cursor: 'pointer',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{t('Copied!')}</span>
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>{t('Copy')}</span>
        </>
      )}
    </button>
  );
};

export default ConfigManager;
