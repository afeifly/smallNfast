import React, { useState } from 'react';
import iconPlusCircle from '../assets/images/icon-plus-circle.png';
import iconSmallPlusCircle from '../assets/images/icon-small-plus-circle.png';
import iconShowGrid from '../assets/images/icon_show_grid.png';
import { useConfig } from '../context/ConfigContext';
import ChannelSelectModal from '../components/ChannelSelectModal';
import { useLanguage } from '../context/LanguageContext';
import CustomDialog from '../components/CustomDialog';
import './Graphic.css';

const ChannelSettingsDrawer = ({ isOpen, onClose, channel, onSave }) => {
  const { t } = useLanguage();
  const [autoScale, setAutoScale] = useState(true);
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(100);
  const [selectedColor, setSelectedColor] = useState('#019A68');

  React.useEffect(() => {
    if (channel) {
      setAutoScale(channel.isAutomaticScale !== false);
      setMin(channel.yMin || 0);
      setMax(channel.yMax || 100);
      setSelectedColor(channel.color || '#019A68');
    }
  }, [channel, isOpen]);

  if (!isOpen) return null;

  const colorRows = [
    ['#019A68', '#04CD9A', '#6FB996', '#008F85', '#1E7FF7', '#802C43', '#163368', '#FB8215', '#31ACFB', '#205BFF', '#6C6BFF', '#490CED', '#BF0DE4', '#9781AD', '#F90883', '#BC8995'],
    ['#F5F429', '#91C007', '#91FF26', '#38E00F', '#6BFFB1', '#47E9D7', '#543005', '#8C5109', '#BF812C', '#81CDC1', '#03665E', '#003C31', '#490CED', '#6927B0', '#3A0079', '#9974EA']
  ];

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 3000 }}>
      <div className="settings-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-header-title">
          <span>{t('Y-axis')}</span>
        </div>
        <div className="drawer-close-btn" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </div>

        <div className="auto-scale-section" onClick={() => setAutoScale(!autoScale)}>
          <div className="checkbox-rect" style={{ background: autoScale ? 'var(--accent-color)' : '#E7E7E7' }}>
            {autoScale && (
              <div style={{ width: 14.85, height: 11.02, background: 'rgba(255, 255, 255, 0.90)', maskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 15 11\'%3E%3Cpath d=\'M1 5.5L5.5 10L14 1\' stroke=\'black\' stroke-width=\'2.5\'/%3E%3C/svg%3E")', WebkitMaskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 15 11\'%3E%3Cpath d=\'M1 5.5L5.5 10L14 1\' stroke=\'black\' stroke-width=\'2.5\'/%3E%3C/svg%3E")' }} />
            )}
          </div>
          <div className="auto-scaling-label" style={{ color: '#1D1D1B', fontSize: 20, fontFamily: 'Arial' }}>{t('Automatic scaling')}</div>
        </div>

        <div className="range-inputs-container">
          <div className="range-field">
            <span className="range-label">{t('min')}</span>
            <div className="range-input-box">
              <input type="number" value={min} onChange={e => setMin(e.target.value)} disabled={autoScale} style={{ color: autoScale ? '#999' : '#191919' }} />
            </div>
          </div>
          <div className="range-field">
            <span className="range-label">{t('max')}</span>
            <div className="range-input-box">
              <input type="number" value={max} onChange={e => setMax(e.target.value)} disabled={autoScale} style={{ color: autoScale ? '#999' : '#191919' }} />
            </div>
          </div>
        </div>

        <div className="color-section">
          <div className="color-section-label">{t('Color')}</div>
          <div className="color-blocks-grid">
            {colorRows.map((row, rowIndex) => (
              <div key={rowIndex} className="color-blocks-row">
                {row.map(color => (
                  <div
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className="color-swatch"
                    style={{ background: color, border: selectedColor === color ? '2px solid #191919' : 'none' }}
                  >
                    {selectedColor === color && (
                      <div className="selected-color-indicator">
                        <div style={{ width: 9.90, height: 7.35, background: color, maskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 15 11\'%3E%3Cpath d=\'M1 5.5L5.5 10L14 1\' stroke=\'black\' stroke-width=\'2.5\'/%3E%3C/svg%3E")', WebkitMaskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 15 11\'%3E%3Cpath d=\'M1 5.5L5.5 10L14 1\' stroke=\'black\' stroke-width=\'2.5\'/%3E%3C/svg%3E")', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="drawer-footer-bar">
          <button className="btn-drawer-cancel" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn-drawer-confirm" onClick={() => onSave({ isAutomaticScale: autoScale, yMin: Number(min), yMax: Number(max), color: selectedColor })}>{t('Confirm')}</button>
        </div>
      </div>
    </div>
  );
};

const ChartNameModal = ({ isOpen, onClose, initialName, onSave }) => {
  const { t } = useLanguage();
  const [name, setName] = useState(initialName || '');
  React.useEffect(() => { if (isOpen) setName(initialName || ''); }, [isOpen, initialName]);
  if (!isOpen) return null;

  const handleConfirm = () => { if (name.trim()) { onSave(name.trim()); onClose(); } };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="chart-name-dialog" onClick={e => e.stopPropagation()}>
        <div className="chart-name-modal-title">{t('Create Chart Name')}</div>
        <div className="chart-name-input-area">
          <div className="input-with-label">
            <label>{t('Chart name')}</label>
            <div className="input-wrapper-bordered">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder={t('Please enter content')} />
            </div>
          </div>
          <div className="input-hint">{t('The maximum length is 20 characters')}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 'auto' }}>
          <button className="btn-drawer-confirm" onClick={handleConfirm}>{t('Confirm')}</button>
          <button className="btn-drawer-cancel" onClick={onClose}>{t('Cancel')}</button>
        </div>
      </div>
    </div>
  );
};

const HeaderControls = ({ isMini, onAddGraphic, onToggleGrid, addDisabled, onRemoveGraphic, showRemove }) => {
  const { t } = useLanguage();
  return (
    <div className={`header-controls-container ${isMini ? 'mini' : ''}`}>
      {showRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemoveGraphic(); }}
          className={`btn-graphic-remove ${isMini ? 'mini' : ''}`}
          title={t('Remove chart')}
        >
          <svg width={isMini ? 12 : 16} height={isMini ? 12 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); if (!addDisabled) onAddGraphic(); }}
        className={`btn-graphic-control ${isMini ? 'mini' : ''} ${addDisabled ? 'disabled' : ''}`}
        style={addDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
        disabled={addDisabled}
      >
        <img src={iconSmallPlusCircle} width={isMini ? 11 : 16} height={isMini ? 11 : 16} alt="add" />
        <span className={`label-text ${isMini ? 'mini' : ''}`}>{t('Add graphic')}</span>
      </button>
      <div
        onClick={(e) => { e.stopPropagation(); onToggleGrid(); }}
        className={`btn-icon-square ${isMini ? 'mini' : ''}`}
      >
        <img src={iconShowGrid} width={isMini ? 11 : 16} height={isMini ? 11 : 16} alt="grid" />
      </div>
    </div>
  );
};

const PlusCircleLarge = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
    <rect x="0.5" y="0.5" width="55" height="55" rx="27.5" fill="var(--primary-color)" stroke="var(--primary-color)" />
    <line x1="28" y1="16" x2="28" y2="40" stroke="#191919" strokeWidth="3" strokeLinecap="round" />
    <line x1="16" y1="28" x2="40" y2="28" stroke="#191919" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const yLabels = ['100', '40', '30', '20', '10', '0'];
const xLabels = ['10:30:28', '10:50:28', '11:10:28', '11:30:28', '11:50:28', '12:10:28', '12:30:28', '12:50:28', '13:10:28', '13:30:28', '13:50:28'];

const GraphicView = ({ graphic, sensors, onAddChannel, isMini = false }) => {
  const { t } = useLanguage();
  const activeChannelsInConfig = (graphic?.graphicChannels || []).filter(c => c.isShow === true);
  const slots = [...Array(5)].map((_, i) => {
    const activeCh = activeChannelsInConfig[i];
    return activeCh ? { id: activeCh.channelCreateTime, isSet: true, label: activeCh.channelName, unit: activeCh.channelUnitInASCII, color: activeCh.color } : { isSet: false };
  });

  return (
    <div className={`graphic-view-box ${isMini ? 'mini' : ''}`}>
      <div className="channel-bar">
        <div className="channel-tabs-row">
          {slots.map((slot, i) => (
            <div
              key={i}
              className={`channel-tab-item ${isMini ? 'mini' : ''} ${!slot.isSet ? 'empty' : 'filled'}`}
              onClick={!isMini ? onAddChannel : undefined}
              style={{ background: slot.isSet ? slot.color : 'transparent' }}
            >
              {!slot.isSet ? (
                <>
                  {!isMini && <img src={iconPlusCircle} width={22} height={22} alt="add channel" />}
                  <span style={{ fontSize: isMini ? '9px' : '18px' }}>{t('Add channel')}</span>
                </>
              ) : (
                <>
                  <div className="channel-tab-name" style={{ fontSize: isMini ? '10px' : '18px', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{slot.label}</div>
                  <div style={{ fontSize: isMini ? '8px' : '12px', color: 'rgba(255,255,255,0.85)' }}>{slot.unit}</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={`chart-section ${isMini ? 'mini' : ''}`}>
        <div className="y-axis-container">
          <div className="y-axis-labels">
            {yLabels.map((label, i) => (
              <div key={i} className="y-axis-item">
                <span style={{ fontSize: isMini ? '11px' : '14px', color: '#4E5969' }}>{label}</span>
                <div className="axis-tick" />
              </div>
            ))}
          </div>
          <div className="y-axis-spacer" />
        </div>

        <div className="chart-area" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="grid-workspace" style={{ backgroundSize: isMini ? '10px 10px' : '20px 20px' }}>
            {!isMini && activeChannelsInConfig.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <PlusCircleLarge />
                <span style={{ textAlign: 'center', color: '#4E5969', fontSize: 16, fontWeight: 700, maxWidth: 349 }}>{t('Please click \'Add channel\' for channel configuration!')}</span>
              </div>
            )}
          </div>
          <div className="x-axis-labels">
            {xLabels.map((t, i) => (
              <div key={i} className="x-axis-item">
                <div className="axis-tick" />
                <span style={{ fontSize: isMini ? '11px' : '14px', color: '#4E5969' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Graphic = () => {
  const { t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGridView, setIsGridView] = useState(false);
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [selectedGraphicIndex, setSelectedGraphicIndex] = useState(0);
  const { configData, setConfigData } = useConfig();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingGraphicIndex, setDeletingGraphicIndex] = useState(null);

  const sensors = configData?.configs?.['/config/SUTO-SensorList.sutolist']?.cfgsensor || configData?.configs?.['config/SUTO-SensorList.sutolist']?.cfgsensor || [];
  const graphicConfigPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgGraphic.json'));
  const graphicList = configData?.configs?.[graphicConfigPath] || [];
  const currentGraphic = graphicList[selectedGraphicIndex] || graphicList[0] || {};

  // Auto-initialize with a default graphic chart if empty
  React.useEffect(() => {
    if (configData && configData.configs) {
      const path = graphicConfigPath || 'config/cfgGraphic.json';
      const list = configData.configs[path];
      if (!list || list.length === 0) {
        const defaultGraphic = {
          tableName: 'Graphic chart name',
          graphicChannels: []
        };
        setConfigData(prev => {
          if (!prev || !prev.configs) return prev;
          return {
            ...prev,
            configs: {
              ...prev.configs,
              [path]: [defaultGraphic]
            }
          };
        });
      }
    }
  }, [configData, graphicConfigPath, setConfigData]);

  // Scroll the selected chart into view when returning from grid view
  React.useEffect(() => {
    if (!isGridView) {
      const element = document.getElementById(`graphic-card-${selectedGraphicIndex}`);
      if (element) {
        const timer = setTimeout(() => {
          element.scrollIntoView({ behavior: 'auto', block: 'start' });
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [isGridView, selectedGraphicIndex]);

  const allChannels = [];
  const locationConfigPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgLocation.json'));
  const locationsArray = configData?.configs?.[locationConfigPath]?.Locations || [];

  const obConfigPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgOptionBoard.json'));
  const obItems = configData?.configs?.[obConfigPath]?.cfgOptionBoard || [];

  sensors.forEach(sensor => {
    if (sensor.cfgchannel) {
      sensor.cfgchannel.forEach(ch => {
        if (ch.Show === false) return;
        const createTimeStr = String(ch.CreateTime);
        let locationValue = '---';
        let pointValue = '---';
        if (Array.isArray(locationsArray)) {
          locationsArray.forEach(loc => {
            (loc.meapoints || []).forEach(mp => {
              if ((mp.channels || []).some(id => String(id) === createTimeStr)) {
                locationValue = loc.location;
                pointValue = mp.meapoint;
              }
            });
          });
        }
        allChannels.push({ CreateTime: createTimeStr, sensorCreateTime: String(sensor.CreateTime || ''), sensorName: sensor.Name || sensor.Description, channelName: ch.ChannelDescription, location: locationValue, point: pointValue, unit: ch.UnitInASCII });
      });
    }
  });

  obItems.forEach(item => {
    const createTimeStr = String(item.CreateTime);
    let locationValue = '---';
    let pointValue = '---';
    if (Array.isArray(locationsArray)) {
      locationsArray.forEach(loc => {
        (loc.meapoints || []).forEach(mp => {
          if ((mp.channels || []).some(id => String(id) === createTimeStr)) {
            locationValue = loc.location;
            pointValue = mp.meapoint;
          }
        });
      });
    }
    allChannels.push({ 
      CreateTime: createTimeStr, 
      sensorCreateTime: "option-board-sensor-id", 
      sensorName: item.SensorDescription || 'Option Board', 
      channelName: item.ChannelDescription, 
      location: locationValue, 
      point: pointValue, 
      unit: item.PreDefineUnit || item.UnitInASCII || '' 
    });
  });

  const handleAddGraphic = () => {
    const path = graphicConfigPath || 'config/cfgGraphic.json';
    if (!path) return;
    if (graphicList.length >= 5) return;
    const newIndex = graphicList.length;
    const newGraphic = {
      tableName: t('Graphic chart name'),
      graphicChannels: []
    };
    const updatedList = [...graphicList, newGraphic];
    setConfigData({
      ...configData,
      configs: {
        ...configData.configs,
        [path]: updatedList
      }
    });
    setSelectedGraphicIndex(newIndex);
    setIsGridView(false);
  };

  const handleRemoveGraphic = (indexToRemove) => {
    const path = graphicConfigPath || 'config/cfgGraphic.json';
    if (!path || graphicList.length <= 1) return;
    const updatedList = graphicList.filter((_, idx) => idx !== indexToRemove);
    setConfigData({
      ...configData,
      configs: {
        ...configData.configs,
        [path]: updatedList
      }
    });
    if (selectedGraphicIndex >= updatedList.length) {
      setSelectedGraphicIndex(Math.max(0, updatedList.length - 1));
    }
  };

  const handleConfirmDelete = () => {
    if (deletingGraphicIndex !== null) {
      handleRemoveGraphic(deletingGraphicIndex);
      setDeletingGraphicIndex(null);
    }
    setShowDeleteConfirm(false);
  };

  const handleChannelConfirm = (selectedIds) => {
    const path = graphicConfigPath || 'config/cfgGraphic.json';
    if (!path || graphicList.length === 0) { setIsModalOpen(false); return; }
    const updatedList = [...graphicList];
    const targetGraphic = { ...updatedList[selectedGraphicIndex] };

    // Only process channels that are actually selected
    const updatedGraphicChannels = allChannels
      .filter(ch => selectedIds.includes(ch.CreateTime))
      .map((ch, index) => {
        const existing = (targetGraphic.graphicChannels || []).find(gc => String(gc.channelCreateTime) === String(ch.CreateTime));
        return {
          isShow: true,
          channelIndex: index,
          channelId: index,
          channelSensorId: 0,
          sensorCreateTime: ch.sensorCreateTime,
          channelCreateTime: ch.CreateTime,
          channelSensorName: ch.sensorName,
          channelName: ch.channelName,
          channelUnitInASCII: ch.unit,
          isAutomaticScale: existing ? existing.isAutomaticScale : true,
          yMin: existing ? existing.yMin : 0,
          yMax: existing ? existing.yMax : 100,
          color: existing ? existing.color : ['#019A68', '#04CD94', '#6FB996', '#008F85', '#1E7FF7'][index % 5]
        };
      })
      .slice(0, 5); // Limit to 5 active channels as per requirements

    targetGraphic.graphicChannels = updatedGraphicChannels;
    updatedList[selectedGraphicIndex] = targetGraphic;
    setConfigData({ ...configData, configs: { ...configData.configs, [path]: updatedList } });
    setIsModalOpen(false);
  };



  if (isGridView) {
    return (
      <>
        <div className="graphic-grid-layout">
          {graphicList.map((graphic, i) => (
            <div key={i} className="graphic-mini-card">
              <div className="card-top-header">
                <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{graphic.tableName}</span>
                <HeaderControls
                  isMini={true}
                  onAddGraphic={handleAddGraphic}
                  onToggleGrid={() => setIsGridView(false)}
                  addDisabled={graphicList.length >= 5}
                  onRemoveGraphic={() => {
                    setDeletingGraphicIndex(i);
                    setShowDeleteConfirm(true);
                  }}
                  showRemove={graphicList.length > 1}
                />
              </div>
              <div className="mini-chart-wrapper" onClick={() => { setSelectedGraphicIndex(i); setIsGridView(false); }}>
                <GraphicView graphic={graphic} sensors={sensors} isMini={true} />
              </div>
              {/* Floating page indicator for grid view */}
              <div style={{
                position: 'absolute',
                bottom: '8px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '11px',
                fontWeight: '600',
                color: '#4E5969',
                fontFamily: 'PingFang SC, sans-serif',
                background: 'rgba(255, 255, 255, 0.8)',
                padding: '1px 6px',
                borderRadius: '8px',
                pointerEvents: 'none',
                zIndex: 10
              }}>
                {i + 1} / {graphicList.length}
              </div>
            </div>
          ))}
          {/* Empty slot for adding new graphic */}
          {graphicList.length < 5 && (
            <div className="graphic-mini-card" style={{ border: '1px dashed #DCDCDC', background: 'transparent', boxShadow: 'none' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <button onClick={handleAddGraphic} className="btn-graphic-control">
                  <img src={iconSmallPlusCircle} width={16} height={16} alt="add" />
                  <span className="label-text">{t('Add graphic')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
        <CustomDialog
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false);
            setDeletingGraphicIndex(null);
          }}
          onConfirm={handleConfirmDelete}
          title={t('Warning')}
          body={t('Are you sure to delete the chart?')}
          confirmText={t('Remove')}
          cancelText={t('No')}
          type="warn"
          showCancel={true}
        />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', height: '100%', overflowY: 'auto', scrollSnapType: 'y mandatory' }}>
      {graphicList.map((graphic, idx) => (
        <div id={`graphic-card-${idx}`} className="content-card graphic-view" key={idx} style={{ height: '100%', display: 'flex', flexDirection: 'column', flexShrink: 0, scrollSnapAlign: 'start', position: 'relative' }}>
          <header className="card-header">
            <div className="graphic-title" onClick={() => { setSelectedGraphicIndex(idx); setIsNameModalOpen(true); }} style={{ cursor: 'pointer' }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#191919', textTransform: 'capitalize' }}>{graphic.tableName || t('create chart name')}</span>
              <div className="edit-icon-wrapper">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M11.333 2.00004C11.51 1.82274 11.7206 1.68253 11.9527 1.58734C12.1847 1.49215 12.4335 1.44385 12.6847 1.44531C12.9359 1.44677 13.1841 1.49796 13.4149 1.59583C13.6458 1.6937 13.8547 1.83632 14.0303 2.01564C14.206 2.19497 14.3445 2.40736 14.4378 2.64057C14.5312 2.87379 14.5312 3.12302 14.5775 3.37419C14.571 3.62536 14.5181 3.87328 14.4188 4.10393C14.3195 4.33458 14.1755 4.5432 13.995 4.71671L5.333 13.3334L1.333 14.3334L2.333 10.3334L11.333 2.00004Z" stroke="#4E5969" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <HeaderControls
              isMini={false}
              onAddGraphic={handleAddGraphic}
              onToggleGrid={() => setIsGridView(true)}
              addDisabled={graphicList.length >= 5}
              onRemoveGraphic={() => {
                setDeletingGraphicIndex(idx);
                setShowDeleteConfirm(true);
              }}
              showRemove={graphicList.length > 1}
            />
          </header>
          <GraphicView graphic={graphic} sensors={sensors} onAddChannel={() => { setSelectedGraphicIndex(idx); setIsModalOpen(true); }} />
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '13px',
            fontWeight: '600',
            color: '#4E5969',
            fontFamily: 'PingFang SC, sans-serif',
            background: 'rgba(255, 255, 255, 0.8)',
            padding: '2px 8px',
            borderRadius: '10px',
            pointerEvents: 'none',
            zIndex: 10
          }}>
            {idx + 1} / {graphicList.length}
          </div>
        </div>
      ))}
      <ChartNameModal isOpen={isNameModalOpen} onClose={() => setIsNameModalOpen(false)} initialName={graphicList[selectedGraphicIndex]?.tableName} onSave={(newName) => { const updatedGraphic = { ...graphicList[selectedGraphicIndex], tableName: newName }; const updatedList = [...graphicList]; updatedList[selectedGraphicIndex] = updatedGraphic; const path = graphicConfigPath || 'config/cfgGraphic.json'; setConfigData({ ...configData, configs: { ...configData.configs, [path]: updatedList } }); }} />
      <ChannelSelectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} allChannels={allChannels} initialSelectedIds={(graphicList[selectedGraphicIndex]?.graphicChannels || []).filter(c => c.isShow === true).map(c => String(c.channelCreateTime))} onConfirm={handleChannelConfirm} onSettingClick={(ch) => { const existing = (graphicList[selectedGraphicIndex]?.graphicChannels || []).find(gc => String(gc.channelCreateTime) === String(ch.CreateTime)); setEditingChannel(existing ? { ...ch, ...existing } : ch); setIsSettingsOpen(true); }} />
      <ChannelSettingsDrawer isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} channel={editingChannel} onSave={(settings) => { const updatedGraphic = { ...graphicList[selectedGraphicIndex] }; const updatedChannels = (updatedGraphic.graphicChannels || []).map(gc => { if (String(gc.channelCreateTime) === String(editingChannel.CreateTime)) return { ...gc, ...settings }; return gc; }); updatedGraphic.graphicChannels = updatedChannels; const updatedList = [...graphicList]; updatedList[selectedGraphicIndex] = updatedGraphic; const path = graphicConfigPath || 'config/cfgGraphic.json'; setConfigData({ ...configData, configs: { ...configData.configs, [path]: updatedList } }); setIsSettingsOpen(false); }} />
      <CustomDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeletingGraphicIndex(null);
        }}
        onConfirm={handleConfirmDelete}
        title={t('Warning')}
        body={t('Are you sure to delete the chart?')}
        confirmText={t('Remove')}
        cancelText={t('No')}
        type="warn"
        showCancel={true}
      />
    </div>
  );
};

export default Graphic;
