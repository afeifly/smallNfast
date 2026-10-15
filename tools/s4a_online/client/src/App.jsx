import React, { useState, useEffect, useRef, useCallback } from 'react';
import { detect, fetchValues } from './api';

const POLL_MS = 2000; // mirrors ChannelCommThread interval

function fmtVal(ch) {
  if (ch.value === null || ch.value === undefined) return '—';
  const res = ch.resolution ?? 2;
  return Number(ch.value).toFixed(res);
}

function statusColor(s) {
  if (s === 'normal') return '#16a34a';
  if (s === 'overrange') return '#d97706';
  if (s === 'invalid') return '#dc2626';
  return '#6b7280';
}

export default function App() {
  const [channels, setChannels] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const timer = useRef(null);

  const poll = useCallback(async () => {
    try {
      const values = await fetchValues();
      setChannels((prev) => {
        const map = new Map(values.map((v) => [v.id, v]));
        return prev.map((ch) => {
          const v = map.get(ch.id);
          return v ? { ...ch, value: v.value, status: v.status } : ch;
        });
      });
      setLastUpdate(new Date());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const startLive = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    setLive(true);
    poll();
    timer.current = setInterval(poll, POLL_MS);
  }, [poll]);

  const stopLive = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setLive(false);
  }, []);

  useEffect(() => () => stopLive(), [stopLive]);

  async function onDetect() {
    setDetecting(true);
    setError('');
    stopLive();
    try {
      const j = await detect();
      setChannels(j.channels || []);
      if ((j.channels || []).length) startLive();
    } catch (e) {
      setError(e.message);
    } finally {
      setDetecting(false);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>SUTO Sensor Monitor</h1>
        <div style={styles.controls}>
          <button style={styles.btn} onClick={onDetect} disabled={detecting}>
            {detecting ? 'Detecting…' : 'Detect Devices'}
          </button>
          {channels.length > 0 && (
            <button style={styles.btnSecondary} onClick={live ? stopLive : startLive}>
              {live ? 'Pause' : 'Resume'}
            </button>
          )}
          <span style={styles.meta}>
            {live ? `● live (${POLL_MS / 1000}s)` : '○ paused'}
            {lastUpdate && ` · ${lastUpdate.toLocaleTimeString()}`}
          </span>
        </div>
      </header>

      {error && <div style={styles.error}>⚠ {error}</div>}

      {channels.length === 0 && !detecting && (
        <div style={styles.empty}>
          <p>No channels yet. Click <b>Detect Devices</b> to scan the USB sensor.</p>
          <p style={styles.hint}>Runs: channel count (C) → device info (A) → per-channel value (D) + description (XC).</p>
        </div>
      )}

      <div style={styles.grid}>
        {channels.map((ch) => (
          <div key={ch.id} style={styles.card}>
            <div style={styles.cardHead}>
              <span style={styles.chId}>CH{ch.id}</span>
              <span style={{ ...styles.dot, background: statusColor(ch.status) }} />
            </div>
            <div style={styles.desc}>{ch.description}</div>
            <div style={styles.valueRow}>
              <span style={styles.value}>{fmtVal(ch)}</span>
              <span style={styles.unit}>{ch.unit}</span>
            </div>
            <div style={styles.status}>{ch.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: { fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 1100, margin: '0 auto', padding: 24, color: '#111827' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  title: { margin: 0, fontSize: 24 },
  controls: { display: 'flex', alignItems: 'center', gap: 10 },
  btn: { padding: '10px 18px', fontSize: 15, borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' },
  btnSecondary: { padding: '10px 14px', fontSize: 14, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' },
  meta: { fontSize: 13, color: '#6b7280' },
  error: { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 12, borderRadius: 8, marginBottom: 16 },
  empty: { textAlign: 'center', padding: 60, color: '#6b7280' },
  hint: { fontSize: 13 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 },
  card: { border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.04)' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  chId: { fontWeight: 700, fontSize: 14, color: '#374151' },
  dot: { width: 10, height: 10, borderRadius: '50%' },
  desc: { fontSize: 13, color: '#6b7280', marginBottom: 10, minHeight: 18 },
  valueRow: { display: 'flex', alignItems: 'baseline', gap: 6 },
  value: { fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  unit: { fontSize: 14, color: '#6b7280' },
  status: { fontSize: 12, color: '#9ca3af', marginTop: 6, textTransform: 'capitalize' },
};
