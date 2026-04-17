import React, { useState } from 'react';
import iconPlusCircle from '../assets/images/icon-plus-circle.png';
import iconSmallPlusCircle from '../assets/images/icon-small-plus-circle.png';
import iconShowGrid from '../assets/images/icon_show_grid.png';
import { useConfig } from '../context/ConfigContext';
import ChannelSelectModal from '../components/ChannelSelectModal';
import './Graphic.css';

const ChannelSettingsDrawer = ({ isOpen, onClose, channel, onSave }) => {
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
          <span>Y-axis</span>
        </div>
        <div className="drawer-close-btn" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </div>

        <div className="auto-scale-section" onClick={() => setAutoScale(!autoScale)}>
          <div className="checkbox-rect" style={{ background: autoScale ? '#00AB84' : '#E7E7E7' }}>
            {autoScale && (
              <div style={{ width: 14.85, height: 11.02, background: 'rgba(255, 255, 255, 0.90)', maskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 15 11\'%3E%3Cpath d=\'M1 5.5L5.5 10L14 1\' stroke=\'black\' stroke-width=\'2.5\'/%3E%3C/svg%3E")', WebkitMaskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 15 11\'%3E%3Cpath d=\'M1 5.5L5.5 10L14 1\' stroke=\'black\' stroke-width=\'2.5\'/%3E%3C/svg%3E")' }} />
            )}
          </div>
          <div className="auto-scaling-label" style={{ color: '#1D1D1B', fontSize: 20, fontFamily: 'Arial' }}>Automatic scaling</div>
        </div>

        <div className="range-inputs-container">
          <div className="range-field">
            <span className="range-label">min</span>
            <div className="range-input-box">
              <input type="number" value={min} onChange={e => setMin(e.target.value)} disabled={autoScale} style={{ color: autoScale ? '#999' : '#191919' }} />
            </div>
          </div>
          <div className="range-field">
            <span className="range-label">max</span>
            <div className="range-input-box">
              <input type="number" value={max} onChange={e => setMax(e.target.value)} disabled={autoScale} style={{ color: autoScale ? '#999' : '#191919' }} />
            </div>
          </div>
        </div>

        <div className="color-section">
          <div className="color-section-label">Color</div>
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
          <button className="btn-drawer-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-drawer-confirm" onClick={() => onSave({ isAutomaticScale: autoScale, yMin: Number(min), yMax: Number(max), color: selectedColor })}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

const ChartNameModal = ({ isOpen, onClose, initialName, onSave }) => {
  const [name, setName] = useState(initialName || '');
  React.useEffect(() => { if (isOpen) setName(initialName || ''); }, [isOpen, initialName]);
  if (!isOpen) return null;

  const handleConfirm = () => { if (name.trim()) { onSave(name.trim()); onClose(); } };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="chart-name-dialog" onClick={e => e.stopPropagation()}>
        <div className="chart-name-modal-title">Create Chart Name</div>
        <div className="chart-name-input-area">
          <div className="input-with-label">
            <label>Chart name</label>
            <div className="input-wrapper-bordered">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="请输入内容" />
            </div>
          </div>
          <div className="input-hint">The maximum length is 20 characters</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 'auto' }}>
          <button className="btn-drawer-confirm" onClick={handleConfirm}>Confirm</button>
          <button className="btn-drawer-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

const HeaderControls = ({ isMini, onAddGraphic, onToggleGrid }) => {
  return (
    <div className={`header-controls-container ${isMini ? 'mini' : ''}`}>
      <button
        onClick={(e) => { e.stopPropagation(); onAddGraphic(); }}
        className={`btn-graphic-control ${isMini ? 'mini' : ''}`}
      >
        <img src={iconSmallPlusCircle} width={isMini ? 11 : 16} height={isMini ? 11 : 16} alt="add" />
        <span className={`label-text ${isMini ? 'mini' : ''}`}>Add graphic</span>
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
    <rect x="0.5" y="0.5" width="55" height="55" rx="27.5" fill="#FFE000" stroke="#FFE000" />
    <line x1="28" y1="16" x2="28" y2="40" stroke="#191919" strokeWidth="3" strokeLinecap="round" />
    <line x1="16" y1="28" x2="40" y2="28" stroke="#191919" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const yLabels = ['100', '40', '30', '20', '10', '0'];
const xLabels = ['10:30:28', '10:50:28', '11:10:28', '11:30:28', '11:50:28', '12:10:28', '12:30:28', '12:50:28', '13:10:28', '13:30:28', '13:50:28'];

const GraphicView = ({ graphic, sensors, onAddChannel, isMini = false }) => {
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
                  <span style={{ fontSize: isMini ? '9px' : '18px' }}>Add channel</span>
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
                <span style={{ textAlign: 'center', color: '#4E5969', fontSize: 16, fontWeight: 700, maxWidth: 349 }}>Please long press add channel for channel configuration!</span>
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGridView, setIsGridView] = useState(false);
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [selectedGraphicIndex, setSelectedGraphicIndex] = useState(0);
  const { configData, setConfigData } = useConfig();

  const sensors = configData?.configs?.['/config/SUTO-SensorList.sutolist']?.cfgsensor || configData?.configs?.['config/SUTO-SensorList.sutolist']?.cfgsensor || [];
  const graphicConfigPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgGraphic.json'));
  const graphicList = configData?.configs?.[graphicConfigPath] || [];
  const currentGraphic = graphicList[selectedGraphicIndex] || graphicList[0] || {};

  const allChannels = [];
  const locationConfigPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgLocation.json'));
  const locationsArray = configData?.configs?.[locationConfigPath]?.Locations || [];

  sensors.forEach(sensor => {
    if (sensor.cfgchannel) {
      sensor.cfgchannel.forEach(ch => {
        const createTimeStr = String(ch.CreateTime);
        let locationValue = '---';
        let pointValue = '---';
        if (Array.isArray(locationsArray)) {
          for (const locObj of locationsArray) {
            const meapoints = locObj.meapoints || [];
            if (Array.isArray(meapoints)) {
              const matchedPoint = meapoints.find(pointObj => Array.isArray(pointObj.channels) && pointObj.channels.some(cid => String(cid) === createTimeStr));
              if (matchedPoint) { locationValue = matchedPoint.location || '---'; pointValue = matchedPoint.meapoint || '---'; break; }
            }
          }
        }
        allChannels.push({ CreateTime: createTimeStr, sensorCreateTime: String(sensor.CreateTime || ''), sensorName: sensor.Name || sensor.Description, channelName: ch.ChannelDescription, location: locationValue, point: pointValue, unit: ch.UnitInASCII });
      });
    }
  });

  const handleAddGraphic = () => {
    if (!graphicConfigPath) return;
    const newIndex = graphicList.length;
    const newGraphic = {
      tableName: `New Chart ${newIndex + 1}`,
      graphicChannels: []
    };
    const updatedList = [...graphicList, newGraphic];
    setConfigData({
      ...configData,
      configs: {
        ...configData.configs,
        [graphicConfigPath]: updatedList
      }
    });
    setSelectedGraphicIndex(newIndex);
    setIsGridView(false);
  };

  const handleChannelConfirm = (selectedIds) => {
    if (!graphicConfigPath || graphicList.length === 0) { setIsModalOpen(false); return; }
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
    setConfigData({ ...configData, configs: { ...configData.configs, [graphicConfigPath]: updatedList } });
    setIsModalOpen(false);
  };

  if (isGridView) {
    return (
      <div className="graphic-grid-layout">
        {graphicList.map((graphic, i) => (
          <div key={i} className="graphic-mini-card">
            <div className="card-top-header">
              <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{graphic.tableName}</span>
              <HeaderControls isMini={true} onAddGraphic={handleAddGraphic} onToggleGrid={() => setIsGridView(false)} />
            </div>
            <div className="mini-chart-wrapper" onClick={() => { setSelectedGraphicIndex(i); setIsGridView(false); }}>
              <GraphicView graphic={graphic} sensors={sensors} isMini={true} />
            </div>
          </div>
        ))}
        {/* Empty slot for adding new graphic */}
        <div className="graphic-mini-card" style={{ border: '1px dashed #DCDCDC', background: 'transparent', boxShadow: 'none' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button onClick={handleAddGraphic} className="btn-graphic-control">
              <img src={iconSmallPlusCircle} width={16} height={16} alt="add" />
              <span className="label-text">Add graphic</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-card graphic-view">
      <header className="card-header">
        <div className="graphic-title" onClick={() => setIsNameModalOpen(true)} style={{ cursor: 'pointer' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#191919', textTransform: 'capitalize' }}>{currentGraphic.tableName || 'create chart name'}</span>
          <div className="edit-icon-wrapper">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M11.333 2.00004C11.51 1.82274 11.7206 1.68253 11.9527 1.58734C12.1847 1.49215 12.4335 1.44385 12.6847 1.44531C12.9359 1.44677 13.1841 1.49796 13.4149 1.59583C13.6458 1.6937 13.8547 1.83632 14.0303 2.01564C14.206 2.19497 14.3445 2.40736 14.4378 2.64057C14.5312 2.87379 14.5312 3.12302 14.5775 3.37419C14.571 3.62536 14.5181 3.87328 14.4188 4.10393C14.3195 4.33458 14.1755 4.5432 13.995 4.71671L5.333 13.3334L1.333 14.3334L2.333 10.3334L11.333 2.00004Z" stroke="#4E5969" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <HeaderControls isMini={false} onAddGraphic={handleAddGraphic} onToggleGrid={() => setIsGridView(true)} />
      </header>
      <GraphicView graphic={currentGraphic} sensors={sensors} onAddChannel={() => setIsModalOpen(true)} />
      <ChartNameModal isOpen={isNameModalOpen} onClose={() => setIsNameModalOpen(false)} initialName={currentGraphic.tableName} onSave={(newName) => { const updatedGraphic = { ...currentGraphic, tableName: newName }; const updatedList = [...graphicList]; updatedList[selectedGraphicIndex] = updatedGraphic; setConfigData({ ...configData, configs: { ...configData.configs, [graphicConfigPath]: updatedList } }); }} />
      <ChannelSelectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} allChannels={allChannels} initialSelectedIds={(currentGraphic.graphicChannels || []).filter(c => c.isShow === true).map(c => String(c.channelCreateTime))} onConfirm={handleChannelConfirm} onSettingClick={(ch) => { const existing = (currentGraphic.graphicChannels || []).find(gc => String(gc.channelCreateTime) === String(ch.CreateTime)); setEditingChannel(existing ? { ...ch, ...existing } : ch); setIsSettingsOpen(true); }} />
      <ChannelSettingsDrawer isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} channel={editingChannel} onSave={(settings) => { const updatedGraphic = { ...currentGraphic }; const updatedChannels = (updatedGraphic.graphicChannels || []).map(gc => { if (String(gc.channelCreateTime) === String(editingChannel.CreateTime)) return { ...gc, ...settings }; return gc; }); updatedGraphic.graphicChannels = updatedChannels; const updatedList = [...graphicList]; updatedList[selectedGraphicIndex] = updatedGraphic; setConfigData({ ...configData, configs: { ...configData.configs, [graphicConfigPath]: updatedList } }); setIsSettingsOpen(false); }} />
    </div>
  );
};

export default Graphic;
