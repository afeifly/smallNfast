import React, { useState, useEffect, useRef } from 'react';
import TauriSutoAPI from '../api/TauriSutoAPI';
import './DebugLogModal.css';

export default function DebugLogModal({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [logFilePath, setLogFilePath] = useState('');
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef(null);

  // Load log file path on mount
  useEffect(() => {
    if (isOpen) {
      TauriSutoAPI.getLogFilePath()
        .then(path => setLogFilePath(path || ''))
        .catch(() => {});
    }
  }, [isOpen]);

  // Polling loop when open
  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    const fetchLogs = async () => {
      try {
        const fetched = await TauriSutoAPI.getLogs(0);
        if (active && Array.isArray(fetched)) {
          setLogs(fetched);
        }
      } catch (err) {
        console.error('Failed to fetch SUTO logs:', err);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 1500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isOpen]);

  // Auto scroll to bottom
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter(entry => {
    if (filterLevel === 'ERROR' && entry.level !== 'ERROR') return false;
    if (filterLevel === 'WARN' && entry.level !== 'WARN' && entry.level !== 'ERROR') return false;
    if (filterLevel === 'USB' && !entry.tag.startsWith('USB') && !entry.tag.startsWith('COMM')) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMsg = entry.message?.toLowerCase().includes(q);
      const matchTag = entry.tag?.toLowerCase().includes(q);
      const matchHex = entry.hex_data?.toLowerCase().includes(q);
      return matchMsg || matchTag || matchHex;
    }
    return true;
  });

  const handleCopyAll = () => {
    const text = filteredLogs
      .map(
        l =>
          `[${l.timestamp}] [${l.level.padEnd(5)}] [${l.tag.padEnd(8)}] ${l.message}${
            l.hex_data ? `\n  HEX: ${l.hex_data}` : ''
          }`
      )
      .join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClear = async () => {
    try {
      await TauriSutoAPI.clearLogs();
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  return (
    <div className="debug-log-overlay" onClick={onClose}>
      <div className="debug-log-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="debug-log-header">
          <div className="debug-log-header-left">
            <span className="debug-log-icon">🐞</span>
            <div>
              <h3 className="debug-log-title">SUTO USB Diagnostic & Hardware Logs</h3>
              <p className="debug-log-subtitle">
                Real-time Win32 IOCTL, pipe transfers, protocol frames & driver diagnostics
              </p>
            </div>
          </div>
          <div className="debug-log-header-right">
            <span className="debug-log-counter">{filteredLogs.length} entries</span>
            <button className="debug-log-close-btn" onClick={onClose} title="Close">
              ✕
            </button>
          </div>
        </div>

        {/* File Path Banner */}
        {logFilePath && (
          <div className="debug-log-path-banner">
            <span className="path-label">Log File:</span>
            <code className="path-value">{logFilePath}</code>
          </div>
        )}

        {/* Controls Toolbar */}
        <div className="debug-log-toolbar">
          <div className="debug-log-filters">
            {['ALL', 'USB', 'WARN', 'ERROR'].map(lvl => (
              <button
                key={lvl}
                className={`filter-btn ${filterLevel === lvl ? 'active' : ''}`}
                onClick={() => setFilterLevel(lvl)}
              >
                {lvl === 'ALL'
                  ? 'All Logs'
                  : lvl === 'USB'
                  ? 'USB Traffic'
                  : lvl === 'WARN'
                  ? 'Warnings & Errors'
                  : 'Errors Only'}
              </button>
            ))}
          </div>

          <div className="debug-log-search-box">
            <input
              type="text"
              placeholder="Search in logs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="debug-log-actions">
            <label className="autoscroll-toggle">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
              />
              Auto-scroll
            </label>
            <button className="action-btn copy-btn" onClick={handleCopyAll}>
              {copied ? '✓ Copied!' : 'Copy All'}
            </button>
            <button className="action-btn clear-btn" onClick={handleClear}>
              Clear
            </button>
          </div>
        </div>

        {/* Terminal Log Console */}
        <div className="debug-log-console" ref={logContainerRef}>
          {filteredLogs.length === 0 ? (
            <div className="debug-log-empty">
              No logs captured yet. Try clicking "Detect & Connect Device" to begin recording USB communication.
            </div>
          ) : (
            filteredLogs.map(entry => {
              const lvlClass = `lvl-${entry.level.toLowerCase()}`;
              return (
                <div key={entry.id} className={`log-line ${lvlClass}`}>
                  <span className="log-time">{entry.timestamp}</span>
                  <span className={`log-badge badge-${entry.level.toLowerCase()}`}>
                    {entry.level}
                  </span>
                  <span className="log-tag">[{entry.tag}]</span>
                  <span className="log-message">{entry.message}</span>
                  {entry.hex_data && (
                    <div className="log-hex">
                      <span className="hex-prefix">HEX:</span>
                      <span className="hex-bytes">{entry.hex_data}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
