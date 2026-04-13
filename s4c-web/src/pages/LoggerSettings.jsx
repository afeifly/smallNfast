import React, { useState } from 'react';

// ── Create Logger Drawer ────────────────────────────────────────────────────
const CreateLoggerDrawer = ({ isOpen, onClose }) => {
  const [form, setForm] = useState({
    startupMode: 'key start',
    fileName: '',
    startTime: '',
    stopTime: '',
    loggerRate: '5s',
  });

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 200,
          }}
        />
      )}

      {/* Drawer panel */}
      <div style={{
        position: 'fixed',
        top: 0, right: 0,
        width: 568,
        height: '100vh',
        background: 'white',
        zIndex: 201,
        display: 'flex',
        flexDirection: 'column',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
      }}>

        {/* ── Header ── */}
        <div style={{
          height: 56,
          borderBottom: '1px solid #E7E7E7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 18,
            fontFamily: 'PingFang SC, sans-serif',
            fontWeight: 600,
            color: '#191919',
            lineHeight: '24px',
          }}>
            Logger configuration file detail
          </span>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'transparent', cursor: 'pointer',
              borderRadius: 4,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <line x1="2" y1="2" x2="14" y2="14" stroke="#191919" strokeWidth="1.5"/>
              <line x1="14" y1="2" x2="2" y2="14" stroke="#191919" strokeWidth="1.5"/>
            </svg>
          </button>
        </div>

        {/* ── Form body (scrollable) ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 0 0' }}>

          {/* Form Fields */}
          <div style={{ padding: '16px' }}>

            {/* Startup mode */}
            <div className="drawer-form-row">
              <label className="drawer-label"><span className="required">*</span>Startup mode</label>
              <select
                className="drawer-input"
                value={form.startupMode}
                onChange={e => handleChange('startupMode', e.target.value)}
              >
                <option value="key start">key start</option>
                <option value="auto start">auto start</option>
                <option value="timer start">timer start</option>
              </select>
            </div>

            {/* Recorded file name */}
            <div className="drawer-form-row">
              <label className="drawer-label"><span className="required">*</span>Recorded file name</label>
              <input
                className="drawer-input"
                type="text"
                placeholder="The filename cannot exceed 30 characters"
                maxLength={30}
                value={form.fileName}
                onChange={e => handleChange('fileName', e.target.value)}
              />
            </div>

            {/* Start time */}
            <div className="drawer-form-row">
              <label className="drawer-label"><span className="required">*</span>Start time</label>
              <input
                className="drawer-input"
                type="datetime-local"
                value={form.startTime}
                onChange={e => handleChange('startTime', e.target.value)}
              />
            </div>

            {/* Stop time */}
            <div className="drawer-form-row">
              <label className="drawer-label"><span className="required">*</span>Stop time</label>
              <input
                className="drawer-input"
                type="datetime-local"
                value={form.stopTime}
                onChange={e => handleChange('stopTime', e.target.value)}
              />
            </div>

            {/* Logger rate */}
            <div className="drawer-form-row">
              <label className="drawer-label"><span className="required">*</span>Logger rate</label>
              <select
                className="drawer-input"
                value={form.loggerRate}
                onChange={e => handleChange('loggerRate', e.target.value)}
              >
                <option value="1s">1s</option>
                <option value="5s">5s</option>
                <option value="10s">10s</option>
                <option value="30s">30s</option>
                <option value="1min">1min</option>
                <option value="5min">5min</option>
              </select>
            </div>
          </div>

          {/* ── Selected Channels section ── */}
          <div style={{
            height: 56,
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
          }}>
            <span style={{
              fontSize: 18,
              fontFamily: 'PingFang SC, sans-serif',
              fontWeight: 600,
              color: '#191919',
              lineHeight: '24px',
            }}>
              Selected Channels (0)
            </span>
            <button style={{
              padding: '2px 8px',
              background: '#00AB84',
              border: 'none',
              borderRadius: 3,
              color: 'rgba(255,255,255,0.9)',
              fontSize: 12,
              fontFamily: 'PingFang SC, sans-serif',
              fontWeight: 400,
              lineHeight: '20px',
              cursor: 'pointer',
            }}>
              Select Channels
            </button>
          </div>

          {/* ── Channel Table ── */}
          <div style={{
            margin: '0 16px',
            border: '1px solid #E6E6E6',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{
                    width: 162,
                    padding: '12px 16px',
                    background: '#F3F3F3',
                    borderBottom: '1px solid #E7E7E7',
                    textAlign: 'left',
                    fontSize: 14,
                    fontFamily: 'PingFang SC, sans-serif',
                    fontWeight: 600,
                    color: '#191919',
                    lineHeight: '22px',
                  }}>
                    Channel name
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    background: '#F3F3F3',
                    borderBottom: '1px solid #E7E7E7',
                    textAlign: 'left',
                    fontSize: 14,
                    fontFamily: 'PingFang SC, sans-serif',
                    fontWeight: 600,
                    color: '#191919',
                    lineHeight: '22px',
                  }}>
                    Location information
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Empty — no channels selected yet */}
                <tr>
                  <td colSpan={2} style={{
                    padding: '40px 16px',
                    textAlign: 'center',
                    fontSize: 14,
                    color: 'rgba(0,0,0,0.4)',
                    fontFamily: 'PingFang SC, sans-serif',
                  }}>
                    No channels selected
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          height: 72,
          borderTop: '1px solid #E7E7E7',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 8,
          flexShrink: 0,
        }}>
          <button style={{
            padding: '5px 16px',
            background: '#00AB84',
            border: 'none',
            borderRadius: 3,
            color: 'rgba(255,255,255,0.9)',
            fontSize: 14,
            fontFamily: 'PingFang SC, sans-serif',
            fontWeight: 400,
            lineHeight: '22px',
            cursor: 'pointer',
          }}>
            Submit
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '5px 16px',
              background: '#E7E7E7',
              border: 'none',
              borderRadius: 3,
              color: 'rgba(0,0,0,0.9)',
              fontSize: 14,
              fontFamily: 'PingFang SC, sans-serif',
              fontWeight: 400,
              lineHeight: '22px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};

// ── Empty State Icon ────────────────────────────────────────────────────────
const EmptyIcon = () => (
  <svg width="68" height="68" viewBox="0 0 68 68" fill="none">
    <rect x="5.67" y="5.67" width="56.67" height="56.67" fill="#FFE000"/>
    <rect x="18" y="24" width="32" height="3" rx="1.5" fill="rgba(0,0,0,0.25)"/>
    <rect x="18" y="32" width="32" height="3" rx="1.5" fill="rgba(0,0,0,0.25)"/>
    <rect x="18" y="40" width="20" height="3" rx="1.5" fill="rgba(0,0,0,0.25)"/>
  </svg>
);

// ── Logger Settings Page ────────────────────────────────────────────────────
const LoggerSettings = () => {
  const [loggers] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="content-card logger-settings-page">
      {/* Header */}
      <header className="card-header">
        <h2 style={{
          margin: 0,
          fontSize: 18,
          fontFamily: 'Arial, sans-serif',
          fontWeight: 700,
          color: '#191919',
          textTransform: 'capitalize',
          lineHeight: '40px',
        }}>
          Active logger information
        </h2>
        <button className="create-logger-btn" onClick={() => setDrawerOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <line x1="8" y1="3" x2="8" y2="13" stroke="white" strokeWidth="1.5"/>
            <line x1="3" y1="8" x2="13" y2="8" stroke="white" strokeWidth="1.5"/>
          </svg>
          <span>Create Logger</span>
        </button>
      </header>

      {/* Body */}
      <div className="logger-body">
        {loggers.length === 0 ? (
          <div className="logger-empty-state">
            <EmptyIcon />
            <p style={{
              color: '#4E5969',
              fontSize: 16,
              fontFamily: 'Arial, sans-serif',
              fontWeight: 700,
              margin: 0,
              textAlign: 'center',
            }}>
              Please create logger first
            </p>
          </div>
        ) : (
          <table className="logger-table">
            <thead>
              <tr>
                <th>Logger Name</th>
                <th>Type</th>
                <th>Interval</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loggers.map((lg, i) => (
                <tr key={i}>
                  <td>{lg.name}</td>
                  <td>{lg.type}</td>
                  <td>{lg.interval}</td>
                  <td>{lg.status}</td>
                  <td>{lg.createdAt}</td>
                  <td>
                    <button className="btn-icon">Edit</button>
                    <button className="btn-icon btn-danger">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Logger Drawer */}
      <CreateLoggerDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
};

export default LoggerSettings;
