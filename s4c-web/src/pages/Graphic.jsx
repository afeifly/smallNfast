import React, { useState } from 'react';
import iconPlusCircle from '../assets/images/icon-plus-circle.png';
import iconSmallPlusCircle from '../assets/images/icon-small-plus-circle.png';
import iconShowGrid from '../assets/images/icon_show_grid.png';
import { useConfig } from '../context/ConfigContext';

const ChannelSelectModal = ({ isOpen, onClose }) => {
  const { configData, setConfigData } = useConfig();
  const [searchTerm, setSearchTerm] = useState('');

  // Get current graphic config
  const graphicConfigPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgGraphic.json'));
  const graphicConfig = configData?.configs?.[graphicConfigPath] || {};

  // Track selected IDs (CreateTime)
  const [selectedIds, setSelectedIds] = useState([]);

  // Initialize selection from config
  React.useEffect(() => {
    if (isOpen && graphicConfig.channels) {
      // Assuming graphicConfig.channels is an array of objects with { id, status } or similar
      // Or just a list of active IDs. We'll assume it's a list of IDs for this implementation
      const activeIds = graphicConfig.channels
        .filter(c => c.status === true || c.status === 1)
        .map(c => String(c.id));
      setSelectedIds(activeIds);
    }
  }, [isOpen, graphicConfig]);

  if (!isOpen) return null;

  // Extract channels from configData
  const sensors = configData?.configs?.['/config/SUTO-SensorList.sutolist']?.cfgsensor ||
    configData?.configs?.['config/SUTO-SensorList.sutolist']?.cfgsensor || [];

  const allChannels = [];
  sensors.forEach(sensor => {
    if (sensor.cfgchannel) {
      sensor.cfgchannel.forEach(ch => {
        allChannels.push({
          id: String(ch.CreateTime),
          sensorName: sensor.Name || sensor.Description,
          channelName: ch.ChannelDescription,
          location: sensor.Location || sensor.Meapoint || '---',
          unit: ch.UnitInASCII
        });
      });
    }
  });

  const filteredChannels = allChannels.filter(ch =>
    ch.sensorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ch.channelName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        if (prev.length >= 5) {
          alert('You can only select up to 5 channels for this graphic.');
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  const handleConfirm = () => {
    if (!graphicConfigPath || graphicList.length === 0) {
      onClose();
      return;
    }

    // Update the FIRST graphic in the list (current view)
    const updatedGraphicList = [...graphicList];
    const targetGraphic = { ...updatedGraphicList[0] };

    // Maintain exactly 5 slots in graphicChannels
    // We update isShow based on selection
    const updatedGraphicChannels = allChannels.map((ch, index) => {
      // Find existing config for this channel to preserve other fields (like color)
      const existing = (targetGraphic.graphicChannels || []).find(gc => String(gc.channelCreateTime) === String(ch.id));

      return {
        isShow: selectedIds.includes(ch.id),
        channelIndex: index,
        channelId: index, // Placeholder
        channelSensorId: 0, // Placeholder
        sensorCreateTime: "", // Placeholder or find from sensor
        channelCreateTime: ch.id,
        channelSensorName: ch.sensorName,
        channelName: ch.channelName,
        channelUnitInASCII: ch.unit,
        isAutomaticScale: existing ? existing.isAutomaticScale : true,
        yMin: existing ? existing.yMin : 0,
        yMax: existing ? existing.yMax : 100,
        color: existing ? existing.color : (index === 0 ? '#019A68' : index === 1 ? '#04CD94' : index === 2 ? '#6FB996' : index === 3 ? '#008F85' : '#1E7FF7')
      };
    }).slice(0, 5); // Ensure max 5

    targetGraphic.graphicChannels = updatedGraphicChannels;
    updatedGraphicList[0] = targetGraphic;

    const updatedConfigData = {
      ...configData,
      configs: {
        ...configData.configs,
        [graphicConfigPath]: updatedGraphicList
      }
    };

    setConfigData(updatedConfigData);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        {/* Header - Fixed with YELLOW BACKGROUND for Close icon */}
        <header className="modal-header" style={{ height: '68px', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Channel configuration</h3>
            <div className="search-input-wrapper" style={{ width: '320px' }}>
              <input
                type="text"
                placeholder="please search sensor name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="search-icon" style={{ right: '10px', left: 'auto' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span>
            </div>
          </div>
          {/* Close Button with Yellow Background Container */}
          <div
            onClick={onClose}
            style={{
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              background: '#FFE000',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </header>

        <div className="modal-content-table" style={{ padding: '24px', maxHeight: '400px', overflowY: 'auto' }}>
          <table className="channel-table">
            <thead>
              <tr>
                <th style={{ width: '54px', textAlign: 'center' }}>
                  <div
                    className={`custom-checkbox ${selectedIds.length === filteredChannels.length && filteredChannels.length > 0 ? 'checked' : ''}`}
                    style={{ margin: '0 auto', cursor: 'pointer' }}
                    onClick={() => {
                      if (selectedIds.length === filteredChannels.length) {
                        setSelectedIds([]);
                      } else {
                        setSelectedIds(filteredChannels.map(ch => ch.id));
                      }
                    }}
                  ></div>
                </th>
                <th>Sensor</th>
                <th>Channel</th>
                <th>Unit</th>
                <th>Measurement Location</th>
              </tr>
            </thead>
            <tbody>
              {filteredChannels.length > 0 ? (
                filteredChannels.map(ch => (
                  <tr key={ch.id} onClick={() => toggleSelection(ch.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ textAlign: 'center' }}>
                      <div className={`custom-checkbox ${selectedIds.includes(ch.id) ? 'checked' : ''}`} style={{ margin: '0 auto' }}></div>
                    </td>
                    <td>{ch.sensorName}</td>
                    <td>{ch.channelName}</td>
                    <td>{ch.unit}</td>
                    <td>{ch.location}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                    {configData ? 'No channels found matching search' : 'Please import a configuration file first'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer - Confirm is SPECIAL GREEN and on the LEFT */}
        <footer className="modal-footer" style={{ borderTop: '1px solid #E7E7E7', height: '72px', background: 'white' }}>
          <button
            className="btn-primary"
            style={{
              background: '#00AB84',
              border: '1px solid #00AB84',
              color: 'white',
              order: 1,
              width: '120px'
            }}
            onClick={handleConfirm}
          >
            Confirm
          </button>
          <button
            className="btn-secondary"
            style={{
              order: 2,
              width: '120px'
            }}
            onClick={onClose}
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
};

const ChartNameModal = ({ isOpen, onClose, initialName, onSave }) => {
  const [name, setName] = useState(initialName || '');

  React.useEffect(() => {
    if (isOpen) setName(initialName || '');
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (name.trim()) {
      onSave(name.trim());
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div style={{
        width: 440, height: 282, position: 'relative', background: 'white',
        overflow: 'hidden', borderRadius: 8, display: 'flex', flexDirection: 'column'
      }} onClick={e => e.stopPropagation()}>
        {/* Title */}
        <div style={{
          left: 155, top: 24, position: 'absolute', textAlign: 'center',
          justifyContent: 'center', display: 'flex', flexDirection: 'column'
        }}>
          <span style={{ color: 'black', fontSize: 16, fontFamily: 'Arial', fontWeight: '700', textTransform: 'uppercase', wordWrap: 'break-word' }}>C</span>
          <span style={{ color: 'black', fontSize: 16, fontFamily: 'Arial', fontWeight: '700', textTransform: 'lowercase', wordWrap: 'break-word' }}>hart Name</span>
        </div>

        {/* Input */}
        <div style={{
          width: 296, paddingBottom: 4, left: 120, top: 72, position: 'absolute',
          flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'
        }}>
          <div style={{
            alignSelf: 'stretch', position: 'relative', justifyContent: 'flex-start',
            alignItems: 'flex-start', display: 'inline-flex'
          }}>
            <div style={{
              flex: '1 1 0', paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5,
              background: 'white', overflow: 'hidden', borderRadius: 3, outline: '1px #DCDCDC solid',
              outlineOffset: '-1px', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex'
            }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder="请输入内容"
                style={{
                  flex: '1 1 0', height: 22, border: 'none', outline: 'none',
                  fontSize: 14, fontFamily: 'PingFang SC', color: 'rgba(0, 0, 0, 0.90)'
                }}
              />
            </div>
            <div style={{
              width: 80, left: -96, top: 5, position: 'absolute', justifyContent: 'flex-end',
              alignItems: 'center', gap: 2, display: 'flex'
            }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: 'rgba(0, 0, 0, 0.90)', fontSize: 14, fontFamily: 'PingFang SC', fontWeight: '400', textTransform: 'uppercase', lineHeight: 22, wordWrap: 'break-word' }}>C</span>
                <span style={{ color: 'rgba(0, 0, 0, 0.90)', fontSize: 14, fontFamily: 'PingFang SC', fontWeight: '400', lineHeight: 22, wordWrap: 'break-word' }}>hart name</span>
              </div>
            </div>
          </div>
          <div data-statustype-状态="default 默认" style={{
            alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10, display: 'inline-flex'
          }}>
            <div style={{
              flex: '1 1 0', justifyContent: 'center', display: 'flex', flexDirection: 'column',
              color: 'rgba(0, 0, 0, 0.40)', fontSize: 12, fontFamily: 'PingFang SC', fontWeight: '400', lineHeight: 20, wordWrap: 'break-word'
            }}>The maximum length is 20 characters</div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{
          width: 440, height: 72, left: 0, top: 210, position: 'absolute',
          justifyContent: 'center', alignItems: 'center', gap: 16, display: 'inline-flex'
        }}>
          <button onClick={handleConfirm} style={{
            paddingLeft: 16, paddingRight: 16, paddingTop: 5, paddingBottom: 5,
            background: '#00AB84', borderRadius: 3, justifyContent: 'center',
            alignItems: 'center', gap: 10, display: 'flex', border: 'none', cursor: 'pointer'
          }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.90)', fontSize: 14, fontFamily: 'PingFang SC', fontWeight: '400' }}>Confirm</span>
          </button>
          <button onClick={onClose} style={{
            paddingLeft: 16, paddingRight: 16, paddingTop: 5, paddingBottom: 5,
            background: '#E7E7E7', borderRadius: 3, justifyContent: 'center',
            alignItems: 'center', gap: 8, display: 'flex', border: 'none', cursor: 'pointer'
          }}>
            <span style={{ color: 'rgba(0, 0, 0, 0.90)', fontSize: 14, fontFamily: 'PingFang SC', fontWeight: '400' }}>Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Icon Components ─────────────────────────────── */
const EditIcon = () => (
  <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M11.333 2.00004C11.51 1.82274 11.7206 1.68253 11.9527 1.58734C12.1847 1.49215 12.4335 1.44385 12.6847 1.44531C12.9359 1.44677 13.1841 1.49796 13.4149 1.59583C13.6458 1.6937 13.8547 1.83632 14.0303 2.01564C14.206 2.19497 14.3445 2.40736 14.4378 2.64057C14.5312 2.87379 14.5775 3.12302 14.5742 3.37419C14.571 3.62536 14.5181 3.87328 14.4188 4.10393C14.3195 4.33458 14.1755 4.5432 13.995 4.71671L5.333 13.3334L1.333 14.3334L2.333 10.3334L11.333 2.00004Z"
        stroke="#4E5969" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);



const ChevronLeft = ({ color = '#4E5969' }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M15 18L9 12L15 6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronRight = ({ color = '#191919' }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M9 18L15 12L9 6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlusCircleLarge = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
    <rect x="0.5" y="0.5" width="55" height="55" rx="27.5" fill="#FFE000" stroke="#FFE000" />
    <line x1="28" y1="16" x2="28" y2="40" stroke="#191919" strokeWidth="3" strokeLinecap="round" />
    <line x1="16" y1="28" x2="40" y2="28" stroke="#191919" strokeWidth="3" strokeLinecap="round" />
  </svg>
);



/* ── Y-axis label values ─────────────────────────── */
const yLabels = ['100', '40', '30', '20', '10', '0'];

/* ── X-axis time labels ──────────────────────────── */
const xLabels = [
  '10:30:28', '10:50:28', '11:10:28', '11:30:28',
  '11:50:28', '12:10:28', '12:30:28', '12:50:28',
  '13:10:28', '13:30:28', '13:50:28',
];

const GraphicView = ({ graphic, sensors, onAddChannel, isMini = false }) => {
  const activeChannelsInConfig = (graphic?.graphicChannels || []).filter(c => c.isShow === true);

  // Ensure exactly 5 slots
  const slots = [...Array(5)].map((_, i) => {
    const activeCh = activeChannelsInConfig[i];
    if (activeCh) {
      return {
        id: activeCh.channelCreateTime,
        isSet: true,
        label: activeCh.channelName,
        unit: activeCh.channelUnitInASCII,
        color: activeCh.color
      };
    }
    return { isSet: false };
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      height: '100%',
      overflow: 'hidden',
      background: 'white'
    }}>
      {/* ── Channel Tab Bar ──────────────────────────── */}
      <div className="channel-bar" style={{ height: isMini ? '40px' : '72px', padding: isMini ? '0 8px' : '0 24px' }}>
        {/* {!isMini && (
          <div style={{ width: 40, height: 72, background: '#F3F3F3', borderRadius: '0 0 4px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <ChevronLeft />
          </div>
        )} */}

        <div className="scroll-wrapper" style={{ display: 'flex', gap: 4, flex: 1, overflowX: 'hidden' }}>
          {slots.map((slot, i) => (
            <div
              key={i}
              className={`channel-item ${slot.isSet ? 'active' : ''}`}
              onClick={!isMini ? onAddChannel : undefined}
              style={{
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                flex: 1,
                minWidth: 0,
                padding: '0 4px',
                textAlign: 'center',
                cursor: !isMini ? 'pointer' : 'default',
                background: slot.isSet ? slot.color : 'transparent',
                border: slot.isSet ? '1px solid #E7E7E7' : '1px dashed #E7E7E7',
                borderRadius: '4px',
                display: 'flex',
                height: isMini ? '32px' : '72px'
              }}
            >
              {!slot.isSet ? (
                <>
                  {!isMini && <img src={iconPlusCircle} width={16} height={16} alt="add channel" style={{ marginBottom: '4px' }} />}
                  <span style={{ fontSize: isMini ? '9px' : '12px' }}>Add</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: isMini ? '10px' : '13px', fontWeight: 'bold', color: slot.color ? 'white' : '#191919', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textShadow: slot.color ? '0 1px 2px rgba(0,0,0,0.3)' : 'none' }}>
                    {slot.label}
                  </span>
                  <span style={{ fontSize: isMini ? '8px' : '11px', color: slot.color ? 'rgba(255,255,255,0.85)' : '#4E5969' }}>{slot.unit}</span>
                </>
              )}
            </div>
          ))}
        </div>

        {/* {!isMini && (
          <div style={{ width: 40, height: 72, background: '#FFE000', borderRadius: '0 0 4px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <ChevronRight />
          </div>
        )} */}
      </div>

      {/* ── Chart Section ────────────────────────────── */}
      <div className="chart-section" style={{ padding: isMini ? '16px 8px' : '40px 24px' }}>
        <div className="y-axis-labels" style={{ width: isMini ? '20px' : '46px' }}>
          {yLabels.map((label, i) => (
            <div key={i} className="y-axis-item">
              <span style={{ fontSize: isMini ? '8px' : '14px' }}>{label}</span>
              {!isMini && <div className="axis-tick" />}
            </div>
          ))}
        </div>

        <div className="chart-area">
          <div
            className="grid-workspace"
            style={{
              backgroundSize: isMini ? '10px 10px' : '20px 20px',
              borderLeft: '1.5px solid #86909C',
              borderBottom: '1.5px solid #86909C'
            }}
          >
            {/* Real lines would be rendered here from data. Mock lines removed. */}

            {!isMini && activeChannelsInConfig.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <PlusCircleLarge />
                <span style={{ textAlign: 'center', color: '#4E5969', fontSize: 16, fontFamily: 'Arial', fontWeight: 700, maxWidth: 349 }}>
                  Please long press add channel for channel configuration!
                </span>
              </div>
            )}
          </div>

          <div className="x-axis-labels" style={{ height: isMini ? '16px' : '40px' }}>
            {(isMini ? xLabels.slice(0, 4) : xLabels).map((t, i) => (
              <div key={i} className="x-axis-item">
                {!isMini && <div className="axis-tick" />}
                <span style={{ fontSize: isMini ? '8px' : '14px' }}>{t}</span>
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
  const { configData, setConfigData } = useConfig();

  // Extract sensors for info lookup
  const sensors = configData?.configs?.['/config/SUTO-SensorList.sutolist']?.cfgsensor ||
    configData?.configs?.['config/SUTO-SensorList.sutolist']?.cfgsensor || [];

  // Get current active channels from graphic config
  const graphicConfigPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgGraphic.json'));
  const graphicList = configData?.configs?.[graphicConfigPath] || [];

  const currentGraphic = graphicList[0] || {};

  // Grid View Rendering - REPLACES entire content-card
  if (isGridView) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, 560px)',
        gap: '24px',
        justifyContent: 'start',
        alignContent: 'start',
        overflowY: 'auto'
      }}>
        {[...Array(4)].map((_, i) => {
          const graphic = graphicList[i];
          return (
            <div
              key={i}
              style={{
                width: 560, height: 375,
                background: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              <div
                onClick={() => setIsGridView(false)}
                style={{
                  position: 'absolute',
                  top: 8, right: 8,
                  width: 24, height: 24,
                  background: '#FFE000',
                  borderRadius: '4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', zIndex: 10
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </div>

              {graphic ? (
                <>
                  <div style={{ height: '48px', borderBottom: '1px solid #E7E7E7', display: 'flex', alignItems: 'center', padding: '0 16px', flexShrink: 0 }}>
                    <span style={{ fontWeight: 'bold' }}>{graphic.tableName}</span>
                  </div>
                  <div
                    style={{ flex: 1, cursor: 'pointer', overflow: 'hidden' }}
                    onClick={() => setIsGridView(false)}
                  >
                    <GraphicView graphic={graphic} sensors={sensors} isMini={true} />
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <PlusCircleLarge />
                  <button className="create-logger-btn">Add Graphic</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="content-card graphic-view">
      {/* ── Header Row ───────────────────────────────── */}
      <header className="card-header">
        <div className="graphic-title" onClick={() => setIsNameModalOpen(true)} style={{ cursor: 'pointer' }}>
          <span style={{ fontSize: 18, fontFamily: 'Arial', fontWeight: 700, color: '#191919', textTransform: 'capitalize' }}>
            {currentGraphic.tableName || 'create chart name'}
          </span>
          <EditIcon />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12.8 }}>
          {/* Add Graphic button */}
          <button
            className="add-graphic-btn"
            style={{
              width: 128, height: 32,
              background: '#FFE000', borderRadius: 3.2, border: 'none',
              display: 'flex', alignItems: 'center', gap: 3,
              justifyContent: 'center',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <img src={iconSmallPlusCircle} width={16} height={16} alt="add graphic" style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: 14, fontFamily: 'Arial', fontWeight: 700,
              color: '#191919', textTransform: 'capitalize',
            }}>
              add graphic
            </span>
          </button>

          {/* Grid / Layout button */}
          <div
            onClick={() => setIsGridView(true)}
            style={{
              width: 32, height: 32,
              background: '#FFE000', borderRadius: 3.2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <img src={iconShowGrid} width={16} height={16} alt="show grid" />
          </div>
        </div>
      </header>

      <GraphicView
        graphic={currentGraphic}
        sensors={sensors}
        onAddChannel={() => setIsModalOpen(true)}
      />

      {/* ── Chart Name Modal ─────────────────────── */}
      <ChartNameModal
        isOpen={isNameModalOpen}
        onClose={() => setIsNameModalOpen(false)}
        initialName={currentGraphic.tableName}
        onSave={(newName) => {
          const updatedGraphic = { ...currentGraphic, tableName: newName };
          const updatedList = [...graphicList];
          updatedList[0] = updatedGraphic;
          setConfigData({
            ...configData,
            configs: {
              ...configData.configs,
              [graphicConfigPath]: updatedList
            }
          });
        }}
      />

      {/* ── Channel Select Modal ─────────────────────── */}
      <ChannelSelectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default Graphic;
