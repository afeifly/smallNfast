import React, { useState } from 'react';
import iconPlusCircle from '../assets/images/icon-plus-circle.png';
import iconSmallPlusCircle from '../assets/images/icon-small-plus-circle.png';
import iconShowGrid from '../assets/images/icon_show_grid.png';
import { useConfig } from '../context/ConfigContext';
import ChannelSelectModal from '../components/ChannelSelectModal';


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
      <div 
        className="settings-drawer" 
        onClick={e => e.stopPropagation()}
        style={{
          width: 1440, height: 458, 
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          background: 'white', overflow: 'hidden', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)'
        }}
      >
        {/* Header - Title */}
        <div style={{left: 24, top: 34, position: 'absolute', textAlign: 'center'}}>
          <span style={{color: '#1D1D1B', fontSize: 22, fontFamily: 'Arial', fontWeight: '700', lineHeight: '20px'}}>Y-axis</span>
        </div>
        
        {/* Close Button Cross */}
        <div onClick={onClose} style={{ width: 40, height: 40, right: 24, top: 24, position: 'absolute', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </div>

        {/* Automatic scaling toggle group */}
        <div 
          onClick={() => setAutoScale(!autoScale)}
          style={{height: 56, paddingLeft: 6, paddingRight: 6, paddingTop: 12, paddingBottom: 12, left: 24, top: 82, position: 'absolute', justifyContent: 'center', alignItems: 'center', gap: 6, display: 'inline-flex', cursor: 'pointer'}}
        >
          <div style={{width: 24, height: 24, position: 'relative'}}>
            <div style={{width: 24, height: 24, left: 0, top: 0, position: 'absolute', background: autoScale ? '#00AB84' : '#E7E7E7', borderRadius: 4.50}} />
            {autoScale && (
              <div style={{width: 14.85, height: 11.02, left: 4.50, top: 6.50, position: 'absolute', background: 'rgba(255, 255, 255, 0.90)', maskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 15 11\'%3E%3Cpath d=\'M1 5.5L5.5 10L14 1\' stroke=\'black\' stroke-width=\'2.5\'/%3E%3C/svg%3E")', WebkitMaskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 15 11\'%3E%3Cpath d=\'M1 5.5L5.5 10L14 1\' stroke=\'black\' stroke-width=\'2.5\'/%3E%3C/svg%3E")'}} />
            )}
          </div>
          <div style={{color: '#1D1D1B', fontSize: 20, fontFamily: 'Arial', fontWeight: '400', textTransform: 'capitalize', lineHeight: '20px'}}>Automatic scaling</div>
        </div>

        {/* Range Inputs */}
        <div style={{left: 251, top: 100, position: 'absolute', color: '#666666', fontSize: 18, fontFamily: 'Arial', fontWeight: '400', textTransform: 'capitalize', lineHeight: '20px'}}>min</div>
        <div style={{width: 159, height: 48, left: 287, top: 86, position: 'absolute', background: '#F3F3F3', borderRadius: 4, outline: '1px solid #D9D9D9', display: 'flex', alignItems: 'center'}}>
          <input 
            type="number" 
            value={min} 
            onChange={e => setMin(e.target.value)}
            disabled={autoScale}
            style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', padding: '0 12px', fontSize: 20, fontFamily: 'Arial', color: autoScale ? '#999' : '#191919', outline: 'none' }}
          />
        </div>

        <div style={{left: 473, top: 101, position: 'absolute', color: '#666666', fontSize: 18, fontFamily: 'Arial', fontWeight: '400', textTransform: 'capitalize', lineHeight: '20px'}}>max</div>
        <div style={{width: 159, height: 48, left: 515, top: 86, position: 'absolute', background: '#F3F3F3', borderRadius: 4, outline: '1px solid #D9D9D9', display: 'flex', alignItems: 'center'}}>
          <input 
            type="number" 
            value={max} 
            onChange={e => setMax(e.target.value)}
            disabled={autoScale}
            style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', padding: '0 12px', fontSize: 20, fontFamily: 'Arial', color: autoScale ? '#999' : '#191919', outline: 'none' }}
          />
        </div>

        {/* Color Label */}
        <div style={{left: 24, top: 166, position: 'absolute', textAlign: 'center', color: '#1D1D1B', fontSize: 22, fontFamily: 'Arial', fontWeight: '700', lineHeight: '22px', wordWrap: 'break-word'}}>Color</div>

        {/* Color Grid */}
        <div style={{left: 27, top: 206, position: 'absolute', display: 'flex', flexDirection: 'column', gap: 12}}>
          {colorRows.map((row, rowIndex) => (
            <div key={rowIndex} style={{display: 'flex', gap: 6}}>
              {row.map(color => (
                <div 
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  style={{width: 72, height: 48, position: 'relative', background: color, borderRadius: 12, cursor: 'pointer', border: selectedColor === color ? '2px solid #191919' : 'none'}}
                >
                  {selectedColor === color && (
                    <div style={{width: 16, height: 16, left: 4, top: 4, position: 'absolute', background: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <div style={{width: 9.90, height: 7.35, background: color, maskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 15 11\'%3E%3Cpath d=\'M1 5.5L5.5 10L14 1\' stroke=\'black\' stroke-width=\'2.5\'/%3E%3C/svg%3E")', WebkitMaskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 15 11\'%3E%3Cpath d=\'M1 5.5L5.5 10L14 1\' stroke=\'black\' stroke-width=\'2.5\'/%3E%3C/svg%3E")', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat'}} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{width: 1440, height: 72, left: 0, top: 386, position: 'absolute', background: 'white', borderTop: '1px #E7E7E7 solid'}}>
          <div style={{left: 1252, top: 20, position: 'absolute', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'inline-flex'}}>
            <div 
              onClick={onClose}
              style={{paddingLeft: 16, paddingRight: 16, paddingTop: 5, paddingBottom: 5, background: '#E7E7E7', borderRadius: 3, cursor: 'pointer', justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex'}}
            >
              <div style={{color: 'rgba(0, 0, 0, 0.90)', fontSize: 14, fontFamily: 'PingFang SC', fontWeight: '600', lineHeight: '22px'}}>Cancel</div>
            </div>
            <div 
              onClick={() => onSave({ isAutomaticScale: autoScale, yMin: Number(min), yMax: Number(max), color: selectedColor })}
              style={{paddingLeft: 16, paddingRight: 16, paddingTop: 5, paddingBottom: 5, background: '#00AB84', borderRadius: 3, cursor: 'pointer', justifyContent: 'center', alignItems: 'center', gap: 10, display: 'flex'}}
            >
              <div style={{color: 'rgba(255, 255, 255, 0.90)', fontSize: 14, fontFamily: 'PingFang SC', fontWeight: '600', lineHeight: '22px'}}>Confirm</div>
            </div>
          </div>
        </div>
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
        overflow: 'hidden', borderRadius: 8
      }} onClick={e => e.stopPropagation()}>
        {/* Title */}
        <div style={{
          left: 155, top: 24, position: 'absolute', textAlign: 'center',
          justifyContent: 'center', display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <span style={{ color: 'black', fontSize: 16, fontFamily: 'Arial', fontWeight: '700', wordWrap: 'break-word' }}>Create Chart Name</span>
          </div>
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
                  fontSize: 14, fontFamily: 'PingFang SC', color: 'rgba(0, 0, 0, 0.90)',
                  background: 'transparent'
                }}
              />
            </div>
            <div style={{
              width: 80, left: -96, top: 5, position: 'absolute', justifyContent: 'flex-end',
              alignItems: 'center', gap: 2, display: 'flex'
            }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: 'rgba(0, 0, 0, 0.90)', fontSize: 14, fontFamily: 'PingFang SC', fontWeight: '400', lineHeight: '22px', wordWrap: 'break-word' }}>Chart name</span>
              </div>
            </div>
          </div>
          <div style={{
            alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10, display: 'inline-flex'
          }}>
            <div style={{
              flex: '1 1 0', justifyContent: 'center', display: 'flex', flexDirection: 'column',
              color: 'rgba(0, 0, 0, 0.40)', fontSize: 12, fontFamily: 'PingFang SC', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'
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
            <div style={{ textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.90)', fontSize: 14, fontFamily: 'PingFang SC', fontWeight: '400', lineHeight: '22px', wordWrap: 'break-word' }}>Confirm</span>
            </div>
          </button>
          <button onClick={onClose} style={{
            paddingLeft: 16, paddingRight: 16, paddingTop: 5, paddingBottom: 5,
            background: '#E7E7E7', borderRadius: 3, justifyContent: 'center',
            alignItems: 'center', gap: 8, display: 'flex', border: 'none', cursor: 'pointer'
          }}>
            <div style={{ textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: 'rgba(0, 0, 0, 0.90)', fontSize: 14, fontFamily: 'PingFang SC', fontWeight: '400', lineHeight: '22px', wordWrap: 'break-word' }}>Cancel</span>
            </div>
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



const HeaderControls = ({ isMini, onAddGraphic, onToggleGrid }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: isMini ? '8px' : '12.8px' }}>
      {/* Add Graphic button */}
      <button
        onClick={onAddGraphic}
        style={{
          width: isMini ? 'auto' : 128,
          height: isMini ? 22 : 32,
          padding: isMini ? '0 6px' : '0 12px',
          background: '#FFE000', borderRadius: 3.2, border: 'none',
          display: 'flex', alignItems: 'center', gap: 3,
          justifyContent: 'center',
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}
      >
        <img src={iconSmallPlusCircle} width={isMini ? 11 : 16} height={isMini ? 11 : 16} alt="add" style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: isMini ? 10 : 14, fontFamily: 'Arial', fontWeight: 700,
          color: '#191919'
        }}>
          Add graphic
        </span>
      </button>

      {/* Grid / Layout button */}
      <div
        onClick={onToggleGrid}
        style={{
          width: isMini ? 22 : 32, height: isMini ? 22 : 32,
          background: '#FFE000', borderRadius: 3.2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <img src={iconShowGrid} width={isMini ? 11 : 16} height={isMini ? 11 : 16} alt="grid" />
      </div>
    </div>
  );
};

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
      <div className="channel-bar" style={{ height: isMini ? '40px' : '72px', padding: isMini ? '0 28px' : '0 68px' }}>
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
                // flexDirection: 'column',
                flexDirection: !slot.isSet ? 'row' : 'column',
                justifyContent: 'center',
                alignItems: 'center',
                width: isMini ? '83px' : '166px',
                minWidth: isMini ? '83px' : '166px',
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
                  {!isMini && <img src={iconPlusCircle} width={isMini ? 11 : 22} height={isMini ? 11 : 22} alt="add channel" style={{ marginBottom: '4px' }} />}
                  <span style={{ fontSize: isMini ? '9px' : '18px' }}>Add channel</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: isMini ? '10px' : '18px', fontWeight: 'bold', color: slot.color ? 'white' : '#191919', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textShadow: slot.color ? '0 1px 2px rgba(0,0,0,0.3)' : 'none' }}>
                    {slot.label}
                  </span>
                  <span style={{ fontSize: isMini ? '8px' : '12px', color: slot.color ? 'rgba(255,255,255,0.85)' : '#4E5969' }}>{slot.unit}</span>
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
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
              {graphic ? (
                <>
                  <div style={{ height: '48px', borderBottom: '1px solid #E7E7E7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
                    <span style={{ fontWeight: 'bold', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{graphic.tableName}</span>
                    <HeaderControls 
                      isMini={true} 
                      onAddGraphic={() => setIsModalOpen(true)}
                      onToggleGrid={() => setIsGridView(false)}
                    />
                  </div>
                  <div
                    style={{ flex: 1, cursor: 'pointer', overflow: 'hidden' }}
                    onClick={() => setIsGridView(false)}
                  >
                    <GraphicView graphic={graphic} sensors={sensors} isMini={true} />
                  </div>
                </>
              ) : (
                <div style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  background: 'white',
                  borderRadius: '6px'
                }}>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    style={{
                      width: 128, height: 32,
                      background: '#FFE000', borderRadius: 3.2, border: 'none',
                      display: 'flex', alignItems: 'center', gap: 3,
                      justifyContent: 'center',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <img src={iconSmallPlusCircle} width={16} height={16} alt="add" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontFamily: 'Arial', fontWeight: 700, color: '#191919' }}>
                      Add graphic
                    </span>
                  </button>
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

        <HeaderControls
          isMini={false}
          onAddGraphic={() => setIsModalOpen(true)}
          onToggleGrid={() => setIsGridView(true)}
        />
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
      <ChannelSelectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSettingClick={(ch) => {
          setEditingChannel(ch);
          setIsSettingsOpen(true);
        }}
      />

      {/* ── Channel Settings Drawer ─────────────────── */}
      <ChannelSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        channel={editingChannel}
        onSave={(settings) => {
          // Update the channel in currentGraphic.graphicChannels
          const updatedGraphic = { ...currentGraphic };
          const updatedChannels = (updatedGraphic.graphicChannels || []).map(gc => {
            if (String(gc.channelCreateTime) === String(editingChannel.CreateTime)) {
              return { ...gc, ...settings };
            }
            return gc;
          });
          updatedGraphic.graphicChannels = updatedChannels;

          const updatedList = [...graphicList];
          updatedList[0] = updatedGraphic;

          setConfigData({
            ...configData,
            configs: {
              ...configData.configs,
              [graphicConfigPath]: updatedList
            }
          });
          setIsSettingsOpen(false);
        }}
      />
    </div>
  );
};

export default Graphic;
