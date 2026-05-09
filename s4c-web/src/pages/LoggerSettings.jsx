import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useConfig } from '../context/ConfigContext';
import iconBtnClose from '../assets/images/icon_btn_close.png';
import ChannelSelectModal from '../components/ChannelSelectModal';
import './LoggerSettings.css';

// ── Constants ────────────────────────────────────────────────────────────────

const MODE_OPTIONS = [
  { value: 0, label: 'Key start' },
  { value: 1, label: 'Time start' },
];

const RATE_OPTIONS = [1, 5, 10, 30, 60, 300];

const CFGLOGGER_PATHS = [
  'config/cfglogger.json',
  '/config/cfglogger.json',
  'cfglogger.json',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function msToLocalParts(ms) {
  if (!ms) return { year: '', month: '', day: '', hour: 0, minute: 0 };
  const d = new Date(ms);
  return {
    year:   d.getFullYear(),
    month:  d.getMonth() + 1,
    day:    d.getDate(),
    hour:   d.getHours(),
    minute: d.getMinutes(),
  };
}

function partsToMs({ year, month, day, hour, minute }) {
  if (!year || !month || !day) return 0;
  return new Date(year, month - 1, day, hour, minute, 0).getTime();
}

function pad2(n) { return String(n).padStart(2, '0'); }

function findLoggerPath(configs) {
  if (!configs) return null;
  for (const p of CFGLOGGER_PATHS) if (configs[p] !== undefined) return p;
  return null;
}

function extractLogger(configs) {
  if (!configs) return null;
  for (const p of CFGLOGGER_PATHS) if (configs[p]?.logger) return configs[p].logger;
  return null;
}

// ── Custom 24H DateTime Picker ────────────────────────────────────────────────
/**
 * A small popover picker with:
 *   - native <input type="date"> for the date part (OS date picker, locale-independent)
 *   - two scroll-wheel columns for hour (0–23) and minute (0–59)
 */
const DateTimePicker = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const { year, month, day, hour, minute } = msToLocalParts(value);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const dateStr = year ? `${year}-${pad2(month)}-${pad2(day)}` : '';

  const handleDateChange = (e) => {
    const [y, mo, d] = e.target.value.split('-').map(Number);
    onChange(partsToMs({ year: y, month: mo, day: d, hour, minute }));
  };

  const handleHour   = (h)  => onChange(partsToMs({ year, month, day, hour: h,      minute }));
  const handleMinute = (m)  => onChange(partsToMs({ year, month, day, hour,         minute: m }));

  const displayLabel = value
    ? `${dateStr}  ${pad2(hour)}:${pad2(minute)}`
    : '— Select date & time —';

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          textAlign: 'right',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid #E7E7E7',
          padding: '2px 4px',
          fontSize: 14,
          fontFamily: 'PingFang SC, sans-serif',
          color: value ? 'rgba(0,0,0,0.9)' : '#aaa',
          cursor: 'pointer',
          outline: 'none',
          letterSpacing: '0.3px',
        }}
      >
        {displayLabel}
      </button>

      {/* Popover */}
      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 6px)',
          zIndex: 9999,
          background: 'white',
          border: '1px solid #E7E7E7',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          minWidth: 240,
        }}>
          {/* Date row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#86909C', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Date</span>
            <input
              type="date"
              value={dateStr}
              onChange={handleDateChange}
              style={{
                width: '100%',
                border: '1px solid #E7E7E7',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 14,
                outline: 'none',
                cursor: 'pointer',
                color: '#191919',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Time row — scroll wheels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#86909C', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Time (24H)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ScrollWheel
                value={hour}
                min={0}
                max={23}
                onChange={handleHour}
                label="HH"
              />
              <span style={{ fontSize: 20, fontWeight: 700, color: '#191919', lineHeight: 1 }}>:</span>
              <ScrollWheel
                value={minute}
                min={0}
                max={59}
                onChange={handleMinute}
                label="MM"
              />
            </div>
          </div>

          {/* Confirm */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              background: '#00AB84',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '7px 0',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
};

/** A vertical scroll-wheel column for selecting a number in [min, max]. */
const ScrollWheel = ({ value, min, max, onChange, label }) => {
  const ITEM_H = 36;
  const VISIBLE = 3; // items shown at once
  const scrollRef = useRef(null);
  const items = Array.from({ length: max - min + 1 }, (_, i) => i + min);

  // Scroll to selected item on mount / value change
  useEffect(() => {
    if (!scrollRef.current) return;
    const idx = value - min;
    scrollRef.current.scrollTop = idx * ITEM_H;
  }, [value, min]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollTop / ITEM_H);
    const clamped = Math.min(Math.max(idx + min, min), max);
    if (clamped !== value) onChange(clamped);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {/* Up arrow */}
      <button type="button" onClick={() => onChange(Math.max(value - 1, min))}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#86909C', lineHeight: 1, padding: '2px 8px' }}>▲</button>

      {/* Scroll container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          height: ITEM_H * VISIBLE,
          width: 52,
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          border: '1px solid #E7E7E7',
          borderRadius: 8,
          position: 'relative',
        }}
      >
        {/* top padding so first item centres */}
        <div style={{ height: ITEM_H }} />
        {items.map(n => (
          <div
            key={n}
            onClick={() => onChange(n)}
            style={{
              height: ITEM_H,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              scrollSnapAlign: 'center',
              fontSize: 16,
              fontWeight: n === value ? 700 : 400,
              color: n === value ? '#00AB84' : 'rgba(0,0,0,0.6)',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'color 0.15s',
            }}
          >
            {pad2(n)}
          </div>
        ))}
        {/* bottom padding */}
        <div style={{ height: ITEM_H }} />
      </div>

      {/* Down arrow */}
      <button type="button" onClick={() => onChange(Math.min(value + 1, max))}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#86909C', lineHeight: 1, padding: '2px 8px' }}>▼</button>
    </div>
  );
};

// ── Create Logger Drawer ──────────────────────────────────────────────────────
const CreateLoggerDrawer = ({ isOpen, onClose, selectedIds, setSelectedIds, allChannels, onOpenModal }) => {
  const [form, setForm] = useState({ mode: 0, filename: '', starttime: 0, samplerate: 1 });
  const selectedChannels = allChannels.filter(ch => selectedIds.includes(ch.CreateTime));
  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <>
      {isOpen && <div className="logger-drawer-backdrop" onClick={onClose} />}
      <div className={`logger-drawer ${isOpen ? 'open' : 'closed'}`}>
        <div style={{ height: 56, borderBottom: '1px solid #E7E7E7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
          <span style={{ fontSize: 18, fontFamily: 'PingFang SC, sans-serif', fontWeight: 600, color: '#191919' }}>Logger configuration file detail</span>
          <button onClick={onClose} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <img src={iconBtnClose} alt="Close" style={{ width: 32, height: 32 }} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <div className="drawer-form-row">
            <label className="drawer-label"><span className="required">*</span>Startup mode</label>
            <select className="drawer-input" value={form.mode} onChange={e => handleChange('mode', Number(e.target.value))}>
              {MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="drawer-form-row">
            <label className="drawer-label"><span className="required">*</span>Recorded file name</label>
            <input className="drawer-input" type="text" placeholder="Max 30 characters" maxLength={30} value={form.filename} onChange={e => handleChange('filename', e.target.value)} />
          </div>
          <div className="drawer-form-row">
            <label className="drawer-label"><span className="required">*</span>Start time</label>
            <DateTimePicker value={form.starttime} onChange={v => handleChange('starttime', v)} />
          </div>
          <div className="drawer-form-row">
            <label className="drawer-label"><span className="required">*</span>Logger rate (s)</label>
            <select className="drawer-input" value={form.samplerate} onChange={e => handleChange('samplerate', Number(e.target.value))}>
              {RATE_OPTIONS.map(r => <option key={r} value={r}>{r}s</option>)}
            </select>
          </div>
          <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 18, fontFamily: 'PingFang SC, sans-serif', fontWeight: 600, color: '#191919' }}>Selected Channels ({selectedIds.length})</span>
            <button className="btn-select-channels" onClick={onOpenModal}>Select Channels</button>
          </div>
          <div style={{ border: '1px solid #E6E6E6', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: 162, padding: '12px 16px', background: '#F3F3F3', borderBottom: '1px solid #E7E7E7', textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#191919' }}>Channel name</th>
                  <th style={{ padding: '12px 16px', background: '#F3F3F3', borderBottom: '1px solid #E7E7E7', textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#191919' }}>Location information</th>
                </tr>
              </thead>
              <tbody>
                {selectedChannels.length > 0 ? selectedChannels.map(ch => (
                  <tr key={ch.CreateTime}>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #F0F0F0', fontSize: 14, color: '#191919' }}>{ch.channelName}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #F0F0F0', fontSize: 14, color: '#4E5969' }}>{ch.location} / {ch.point}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={2} style={{ padding: '40px 16px', textAlign: 'center', fontSize: 14, color: 'rgba(0,0,0,0.4)' }}>No channels selected</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ height: 72, borderTop: '1px solid #E7E7E7', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, flexShrink: 0 }}>
          <button style={{ padding: '5px 16px', background: '#00AB84', border: 'none', borderRadius: 3, color: 'rgba(255,255,255,0.9)', fontSize: 14, cursor: 'pointer' }}>Submit</button>
          <button onClick={onClose} style={{ padding: '5px 16px', background: '#E7E7E7', border: 'none', borderRadius: 3, color: 'rgba(0,0,0,0.9)', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </>
  );
};

// ── Logger Settings Page ──────────────────────────────────────────────────────
const LoggerSettings = () => {
  const { configData, setConfigData } = useConfig();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const rawLogger    = extractLogger(configData?.configs);
  const channelArray = rawLogger?.channelArray || [];

  // ── Persist a single field directly to the store ──────────────────────────
  const persistField = useCallback((field, rawValue) => {
    const loggerPath = findLoggerPath(configData?.configs);
    if (!loggerPath) return;
    const existingLogger = configData.configs[loggerPath]?.logger || {};
    setConfigData({
      ...configData,
      configs: {
        ...configData.configs,
        [loggerPath]: {
          ...configData.configs[loggerPath],
          logger: { ...existingLogger, [field]: rawValue },
        },
      },
    });
  }, [configData, setConfigData]);

  // ── Build sensor channel lookup: ChannelId (capital) → ChannelDescription ─
  const sensors =
    configData?.configs?.['/config/SUTO-SensorList.sutolist']?.cfgsensor ||
    configData?.configs?.['config/SUTO-SensorList.sutolist']?.cfgsensor ||
    [];
  const locationConfigPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgLocation.json'));
  const locationsArray = configData?.configs?.[locationConfigPath]?.Locations || [];

  // Key: ChannelId (the numeric ID in cfgchannel, note the capital letters)
  const channelIdToName = {};
  const channelIdToCreateTime = {};
  const allChannels = [];

  sensors.forEach(sensor => {
    (sensor.cfgchannel || []).forEach(ch => {
      // cfgchannel uses "ChannelId" (capital C, capital I) — match against cfglogger's "channelid"
      const cid = ch.ChannelId ?? ch.channelid ?? ch.ChannelID;
      const createTimeStr = String(ch.CreateTime);
      if (cid !== undefined) {
        channelIdToName[cid] = ch.ChannelDescription || `CH ${cid}`;
        channelIdToCreateTime[cid] = createTimeStr;
      }

      let locationValue = '---', pointValue = '---';
      if (Array.isArray(locationsArray)) {
        for (const locObj of locationsArray) {
          const matched = (locObj.meapoints || []).find(pt =>
            Array.isArray(pt.channels) && pt.channels.some(id => String(id) === createTimeStr)
          );
          if (matched) { locationValue = matched.location || '---'; pointValue = matched.meapoint || '---'; break; }
        }
      }
      allChannels.push({ 
        CreateTime: createTimeStr, 
        ChannelId: cid, // Add the actual ChannelId here
        sensorName: sensor.Name || sensor.Description || 'Unknown Sensor',
        channelName: ch.ChannelDescription || 'Unknown Channel', 
        unit: ch.UnitInASCII || '',
        location: locationValue, 
        point: pointValue 
      });
    });
  });

  // ── Channel selection: rebuilds channelArray in the store ─────────────────
  // Map logger's channelid (numeric) back to CreateTime string for the modal
  const selectedIds = channelArray
    .map(ch => channelIdToCreateTime[ch.channelid])
    .filter(Boolean); // Ensure we only include valid IDs found in current sensors

  const handleChannelsConfirm = (ids) => {
    const loggerPath = findLoggerPath(configData?.configs);
    if (!loggerPath) return;
    const newChannelArray = ids.map((id, idx) => {
      const ch = allChannels.find(c => c.CreateTime === id);
      return { 
        channelid: ch?.ChannelId ?? idx, // Use the real sensor ChannelId
        meapoint: ch?.point || '', 
        location: ch?.location || '' 
      };
    });
    const existingLogger = configData.configs[loggerPath]?.logger || {};
    setConfigData({
      ...configData,
      configs: {
        ...configData.configs,
        [loggerPath]: {
          ...configData.configs[loggerPath],
          logger: { ...existingLogger, channels: newChannelArray.length, channelArray: newChannelArray },
        },
      },
    });
    setIsModalOpen(false);
  };

  return (
    <div className="content-card logger-settings-page">

      {/* Header */}
      <header className="logger-header">
        <div className="logger-title-section">
          <h2 className="logger-title">Logger settings</h2>
          <p className="logger-subtitle">Configure the data logger for your device.</p>
        </div>
      </header>

      {/* Content */}
      <div className="logger-content">

        {/* Fields card */}
        <div className="logger-fields-card">

          {/* Column 1: Startup mode + Recorded file name */}
          <div className="logger-fields-column">
            <div className="logger-field-item">
              <label>Startup mode</label>
              <select value={rawLogger?.mode ?? 0} onChange={e => persistField('mode', Number(e.target.value))}>
                {MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="logger-field-item">
              <label>Recorded file name</label>
              <input
                type="text"
                placeholder="—"
                maxLength={30}
                value={rawLogger?.filename ?? ''}
                onChange={e => persistField('filename', e.target.value)}
              />
            </div>
          </div>

          {/* Column 2: Start time + Logger rate */}
          <div className="logger-fields-column">
            <div className="logger-field-item">
              <label>Start time</label>
              <DateTimePicker
                value={rawLogger?.starttime ?? 0}
                onChange={v => persistField('starttime', v)}
              />
            </div>
            <div className="logger-field-item">
              <label>Logger rate (s)</label>
              <select value={rawLogger?.samplerate ?? 1} onChange={e => persistField('samplerate', Number(e.target.value))}>
                {RATE_OPTIONS.map(r => <option key={r} value={r}>{r}s</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Channel table */}
        <div className="logger-table-header">
          <span className="logger-table-title">Channel list ({channelArray.length})</span>
          <button className="btn-select-channels" onClick={() => setIsModalOpen(true)}>Select Channels</button>
        </div>

        <div className="logger-table-container">
          <table className="logger-table">
            <thead>
              <tr>
                <th>Channel name</th>
                <th>Location information</th>
              </tr>
            </thead>
            <tbody>
              {channelArray.length > 0 ? (
                channelArray.map((ch, idx) => (
                  <tr key={idx}>
                    <td>{channelIdToName[ch.channelid] ?? `CH ${ch.channelid}`}</td>
                    <td className="td-location">{ch.location} / {ch.meapoint}</td>
                  </tr>
                ))
              ) : (
                <tr className="logger-empty-row">
                  <td colSpan={2}>No channels configured.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Channel Select Modal */}
      <ChannelSelectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        allChannels={allChannels}
        initialSelectedIds={selectedIds}
        onConfirm={handleChannelsConfirm}
        maxLimit={0}
        selectionMessage="Select channels to include in the logger."
        showOperate={false}
      />
    </div>
  );
};

export default LoggerSettings;
