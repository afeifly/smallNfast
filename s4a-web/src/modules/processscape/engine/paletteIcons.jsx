import React from 'react';

/**
 * Tailored Distinctive Vector Icons for Every Equipment Asset and Architecture Element
 * Faithfully matches the original gas-pipeline SVG designs.
 */
export function renderAssetPaletteIcon(type, def) {
  if (type === 'tank_buffer') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="9" y="16" width="2" height="3" fill="#64748b" />
        <rect x="17" y="16" width="2" height="3" fill="#64748b" />
        <rect x="8" y="2" width="12" height="14" rx="5" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
        <circle cx="21" cy="5" r="2.5" fill="#f8fafc" stroke="#475569" strokeWidth="0.8" />
        <line x1="21" y1="5" x2="22" y2="4" stroke="#e11d48" strokeWidth="0.8" />
      </svg>
    );
  }
  if (type === 'cylinder_bank') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="4" y="3" width="4" height="15" rx="2" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />
        <rect x="9" y="3" width="4" height="15" rx="2" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />
        <rect x="14" y="3" width="4" height="15" rx="2" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />
        <rect x="19" y="3" width="4" height="15" rx="2" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />
        <rect x="3" y="4" width="21" height="2" fill="#cbd5e1" stroke="#475569" strokeWidth="0.6" />
      </svg>
    );
  }
  if (type === 'tank_horizontal') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="6" y="14" width="3" height="4" fill="#475569" />
        <rect x="19" y="14" width="3" height="4" fill="#475569" />
        <rect x="2" y="4" width="24" height="11" rx="5.5" fill="#94a3b8" stroke="#334155" strokeWidth="1" />
        <rect x="12" y="2" width="4" height="2" fill="#475569" />
      </svg>
    );
  }
  if (type === 'tank_cryogenic') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="3" y="2" width="11" height="16" rx="4" fill="#e2e8f0" stroke="#64748b" strokeWidth="1" />
        <rect x="3" y="8" width="11" height="4" fill="#0284c7" />
        <line x1="17" y1="3" x2="17" y2="17" stroke="#0ea5e9" strokeWidth="1.2" />
        <line x1="20" y1="3" x2="20" y2="17" stroke="#0ea5e9" strokeWidth="1.2" />
        <line x1="23" y1="3" x2="23" y2="17" stroke="#0ea5e9" strokeWidth="1.2" />
        <line x1="16" y1="6" x2="24" y2="6" stroke="#0284c7" strokeWidth="0.8" />
        <line x1="16" y1="14" x2="24" y2="14" stroke="#0284c7" strokeWidth="0.8" />
      </svg>
    );
  }
  if (type === 'tank_spherical') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <line x1="7" y1="13" x2="4" y2="19" stroke="#475569" strokeWidth="1.2" />
        <line x1="21" y1="13" x2="24" y2="19" stroke="#475569" strokeWidth="1.2" />
        <line x1="14" y1="15" x2="14" y2="19" stroke="#475569" strokeWidth="1.2" />
        <circle cx="14" cy="9" r="7.5" fill="#cbd5e1" stroke="#334155" strokeWidth="1" />
        <line x1="6.8" y1="9" x2="21.2" y2="9" stroke="#94a3b8" strokeWidth="0.8" />
      </svg>
    );
  }
  if (type === 'tank_separator') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="8" y="2" width="12" height="8" rx="2" fill="#0284c7" stroke="#0369a1" strokeWidth="1" />
        <polygon points="8,10 20,10 16,16 12,16" fill="#0369a1" />
        <rect x="12" y="16" width="4" height="3" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8" />
        <rect x="4" y="4" width="4" height="2" fill="#64748b" />
      </svg>
    );
  }
  if (type === 'tank_twin_tower') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="2" y="16" width="24" height="2" fill="#334155" />
        <rect x="5" y="4" width="7" height="12" rx="3" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />
        <rect x="16" y="4" width="7" height="12" rx="3" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />
        <path d="M 8.5,4 L 8.5,2 L 19.5,2 L 19.5,4" fill="none" stroke="#475569" strokeWidth="1" />
      </svg>
    );
  }
  if (type === 'machine_compressor') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="2" y="3" width="24" height="15" rx="2" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
        <rect x="6" y="1" width="8" height="2" fill="#475569" />
        <rect x="4" y="5" width="12" height="11" rx="1" fill="#0284c7" />
        <line x1="19" y1="6" x2="23" y2="6" stroke="#94a3b8" strokeWidth="1" />
        <line x1="19" y1="9" x2="23" y2="9" stroke="#94a3b8" strokeWidth="1" />
        <line x1="19" y1="12" x2="23" y2="12" stroke="#94a3b8" strokeWidth="1" />
      </svg>
    );
  }
  if (type === 'machine_compressor_piston') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="4" y="12" width="20" height="6" rx="3" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />
        <rect x="6" y="18" width="2" height="2" fill="#334155" />
        <rect x="20" y="18" width="2" height="2" fill="#334155" />
        <rect x="15" y="7" width="7" height="5" rx="1" fill="#1e293b" />
        <rect x="6" y="8" width="6" height="4" rx="1" fill="#475569" />
        <line x1="12" y1="8" x2="15" y2="10" stroke="#facc15" strokeWidth="1" strokeDasharray="1 1" />
        <line x1="9" y1="8" x2="9" y2="5" stroke="#0f172a" strokeWidth="1.2" />
      </svg>
    );
  }
  if (type === 'machine_dryer') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="4" y="3" width="20" height="15" rx="2" fill="#334155" stroke="#1e293b" strokeWidth="1" />
        <rect x="6" y="5" width="10" height="11" fill="#0ea5e9" />
        <line x1="8" y1="5" x2="8" y2="16" stroke="#ffffff" strokeWidth="0.8" />
        <line x1="11" y1="5" x2="11" y2="16" stroke="#ffffff" strokeWidth="0.8" />
        <line x1="14" y1="5" x2="14" y2="16" stroke="#ffffff" strokeWidth="0.8" />
        <circle cx="19" cy="7" r="1.5" fill="#10b981" />
      </svg>
    );
  }
  if (type === 'machine_chiller') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="2" y="3" width="24" height="14" rx="1.5" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />
        <rect x="3" y="17" width="4" height="2" fill="#0f172a" />
        <rect x="21" y="17" width="4" height="2" fill="#0f172a" />
        <circle cx="8" cy="10" r="4.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.7" />
        <path d="M 8,6.5 L 8,13.5 M 4.5,10 L 11.5,10" stroke="#38bdf8" strokeWidth="0.8" />
        <rect x="15" y="5" width="9" height="5" rx="0.5" fill="#09090b" />
        <line x1="16.5" y1="7.5" x2="22.5" y2="7.5" stroke="#38bdf8" strokeWidth="1" />
        <line x1="15" y1="12" x2="23" y2="12" stroke="#e0f2fe" strokeWidth="0.7" />
        <line x1="15" y1="14" x2="23" y2="14" stroke="#e0f2fe" strokeWidth="0.7" />
      </svg>
    );
  }
  if (type === 'filter_line') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="4" y="5" width="20" height="3.5" rx="1" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />
        <rect x="9" y="8.5" width="10" height="10" rx="3" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.8" />
        <circle cx="14" cy="3" r="2.2" fill="#f8fafc" stroke="#16a34a" strokeWidth="0.8" />
        <line x1="14" y1="3" x2="15" y2="2" stroke="#e11d48" strokeWidth="0.6" />
      </svg>
    );
  }
  if (type === 'filter_stage3') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="2" y="4" width="24" height="3" rx="1" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />
        <rect x="4" y="7" width="5.5" height="11" rx="2" fill="#10b981" stroke="#059669" strokeWidth="0.7" />
        <rect x="11.2" y="7" width="5.5" height="11" rx="2" fill="#0284c7" stroke="#0369a1" strokeWidth="0.7" />
        <rect x="18.5" y="7" width="5.5" height="11" rx="2" fill="#1e293b" stroke="#0f172a" strokeWidth="0.7" />
      </svg>
    );
  }
  if (type === 'machine_pump') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="2" y="16" width="24" height="2.5" fill="#475569" />
        <rect x="4" y="6" width="10" height="9" rx="1.5" fill="#1e293b" stroke="#0f172a" strokeWidth="0.8" />
        <line x1="7" y1="6" x2="7" y2="15" stroke="#475569" strokeWidth="0.6" />
        <line x1="10" y1="6" x2="10" y2="15" stroke="#475569" strokeWidth="0.6" />
        <circle cx="19" cy="10" r="4.5" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />
        <rect x="18" y="3" width="2" height="3" fill="#64748b" />
      </svg>
    );
  }
  if (type === 'machine_cnc') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="2" y="3" width="24" height="15" rx="2" fill="#334155" stroke="#1e293b" strokeWidth="1" />
        <rect x="5" y="6" width="11" height="9" rx="1" fill="#0284c7" stroke="#38bdf8" strokeWidth="0.8" />
        <rect x="18" y="5" width="6" height="8" rx="0.5" fill="#0f172a" />
        <circle cx="21" cy="7" r="1" fill="#10b981" />
        <circle cx="21" cy="10" r="1" fill="#facc15" />
        <rect x="5" y="1" width="3" height="2" fill="#10b981" />
      </svg>
    );
  }
  if (type === 'machine_robot') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="6" y="15" width="8" height="3" fill="#1e293b" />
        <circle cx="10" cy="13" r="2.5" fill="#eab308" stroke="#ca8a04" strokeWidth="0.6" />
        <line x1="10" y1="13" x2="16" y2="7" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="16" cy="7" r="2" fill="#1e293b" />
        <line x1="16" y1="7" x2="23" y2="10" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
        <circle cx="23" cy="10" r="1.5" fill="#0284c7" />
      </svg>
    );
  }
  if (type === 'machine_laser') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="2" y="12" width="24" height="5" rx="1" fill="#334155" />
        <rect x="6" y="4" width="2" height="9" fill="#94a3b8" />
        <rect x="20" y="4" width="2" height="9" fill="#94a3b8" />
        <rect x="5" y="4" width="18" height="2.5" fill="#0284c7" />
        <rect x="13" y="6" width="2.5" height="4" fill="#0f172a" />
        <line x1="14.2" y1="10" x2="14.2" y2="12" stroke="#ef4444" strokeWidth="1" />
      </svg>
    );
  }
  if (type === 'machine_injection') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="2" y="13" width="24" height="4" rx="0.5" fill="#475569" />
        <rect x="3" y="5" width="4" height="8" rx="0.5" fill="#1e293b" />
        <rect x="10" y="5" width="3" height="8" rx="0.5" fill="#0284c7" />
        <line x1="7" y1="6" x2="10" y2="6" stroke="#94a3b8" strokeWidth="1" />
        <line x1="7" y1="12" x2="10" y2="12" stroke="#94a3b8" strokeWidth="1" />
        <rect x="13" y="8" width="10" height="4" rx="0.5" fill="#1e293b" />
        <polygon points="18,3 23,3 21,8 20,8" fill="#facc15" />
      </svg>
    );
  }
  if (type === 'logger_cabinet') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="4" y="2" width="20" height="14" rx="2" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
        <rect x="6" y="4" width="12" height="9" rx="1" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.8" />
        <path d="M 7,9 L 10,7 L 13,11 L 16,8" fill="none" stroke="#e11d48" strokeWidth="0.9" />
        <circle cx="20.5" cy="8.5" r="1.8" fill="#facc15" stroke="#ca8a04" strokeWidth="0.6" />
        <rect x="8" y="16" width="2" height="2" fill="#64748b" />
        <rect x="13" y="16" width="2" height="2" fill="#64748b" />
        <rect x="18" y="16" width="2" height="2" fill="#64748b" />
      </svg>
    );
  }
  if (type === 'logger_case') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="4" y="2" width="20" height="6" rx="1" fill="#18181b" stroke="#09090b" strokeWidth="0.8" />
        <rect x="4" y="9" width="20" height="8" rx="1" fill="#18181b" stroke="#09090b" strokeWidth="0.8" />
        <rect x="5.5" y="10" width="17" height="6" rx="0.5" fill="#e2e8f0" />
        <rect x="7" y="11" width="6" height="4" fill="#ffffff" stroke="#0284c7" strokeWidth="0.6" />
        <path d="M 11,17 L 11,19 L 17,19 L 17,17" fill="none" stroke="#09090b" strokeWidth="1.2" />
      </svg>
    );
  }
  if (type === 'dewpoint_meter') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="11" y="2" width="6" height="7" rx="1.5" fill="#fed72a" stroke="#ca8a04" strokeWidth="0.8" />
        <rect x="12" y="3.5" width="4" height="3" rx="0.5" fill="#09090b" />
        <rect x="11" y="9" width="6" height="6" fill="#334155" stroke="#1e293b" strokeWidth="0.8" />
        <rect x="11.5" y="10" width="5" height="3" fill="#ffffff" />
        <rect x="10.5" y="15" width="7" height="2" fill="#cbd5e1" />
        <rect x="12" y="17" width="4" height="2.5" rx="0.8" fill="#64748b" />
      </svg>
    );
  }
  if (type === 'leak_detection' || type === 'leak_detector') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="12" y="1" width="4" height="3" fill="#09090b" />
        <rect x="8" y="4" width="12" height="10" rx="2" fill="#18181b" stroke="#334155" strokeWidth="0.8" />
        <rect x="10" y="5.5" width="8" height="5.5" rx="0.5" fill="#ffffff" />
        <polygon points="14,6 16,10 12,10" fill="#ea580c" />
        <circle cx="11" cy="12.5" r="1.2" fill="#fed72a" />
        <circle cx="14" cy="12.5" r="1.2" fill="#fed72a" />
        <circle cx="17" cy="12.5" r="1.2" fill="#fed72a" />
        <rect x="12" y="14" width="4" height="5" fill="#18181b" />
      </svg>
    );
  }
  if (type === 'compact_flow_meter') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        {/* Connecting round pipe */}
        <rect x="0" y="13" width="28" height="3" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.5" />
        {/* Stainless steel square block */}
        <rect x="5" y="11" width="18" height="6" fill="#94a3b8" stroke="#64748b" strokeWidth="0.8" />
        <line x1="5" y1="12" x2="23" y2="12" stroke="#e2e8f0" strokeWidth="0.6" />
        {/* White housing body with chevrons */}
        <path d="M 7,11 L 7,6 L 18,6 L 21,9 L 21,11 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.7" />
        <path d="M 12,8.5 L 14,8.5 M 16,8.5 L 18,8.5" stroke="#cbd5e1" strokeWidth="0.6" />
        {/* Top slanted display: yellow badge + red digital display */}
        <rect x="8" y="3" width="3.5" height="3" fill="#fed72a" />
        <rect x="12" y="3" width="8" height="3" rx="0.5" fill="#09090b" />
        <line x1="13.5" y1="4.5" x2="18.5" y2="4.5" stroke="#ef4444" strokeWidth="0.9" />
      </svg>
    );
  }
  if (type === 'flow_meter') {
    return (
      <svg width="28" height="20" viewBox="0 0 28 20">
        <rect x="9" y="1" width="10" height="7" rx="1.5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.8" />
        <line x1="9" y1="3" x2="19" y2="3" stroke="#fed72a" strokeWidth="0.8" />
        <line x1="9" y1="7" x2="19" y2="7" stroke="#fed72a" strokeWidth="0.8" />
        <rect x="11" y="2" width="6" height="3.5" rx="0.5" fill="#09090b" />
        <rect x="12" y="8" width="4" height="1.5" fill="#cbd5e1" />
        <line x1="14" y1="9.5" x2="14" y2="16.5" stroke="#94a3b8" strokeWidth="1.4" />
        <rect x="12" y="16.5" width="4" height="2.5" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.6" />
      </svg>
    );
  }
  if (type === 'wall_perimeter_h') {
    return (
      <div style={{ width: 28, height: 18, background: '#b91c1c', borderRadius: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 1, height: 3.5 }}><div style={{ flex: 1, background: '#c2410c' }} /><div style={{ flex: 1, background: '#9a3412' }} /></div>
        <div style={{ display: 'flex', gap: 1, height: 3.5 }}><div style={{ width: 5, background: '#a1441a' }} /><div style={{ flex: 1, background: '#c2410c' }} /><div style={{ width: 5, background: '#b43a0e' }} /></div>
        <div style={{ display: 'flex', gap: 1, height: 3.5 }}><div style={{ flex: 1, background: '#b91c1c' }} /><div style={{ flex: 1, background: '#ea580c' }} /></div>
      </div>
    );
  }
  if (type === 'wall_perimeter_v') {
    return (
      <div style={{ width: 18, height: 24, background: '#b91c1c', borderRadius: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: 1, overflow: 'hidden', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 1, height: 3 }}><div style={{ flex: 1, background: '#c2410c' }} /><div style={{ flex: 1, background: '#9a3412' }} /></div>
        <div style={{ display: 'flex', gap: 1, height: 3 }}><div style={{ width: 4, background: '#a1441a' }} /><div style={{ flex: 1, background: '#c2410c' }} /><div style={{ width: 4, background: '#b43a0e' }} /></div>
        <div style={{ display: 'flex', gap: 1, height: 3 }}><div style={{ flex: 1, background: '#b91c1c' }} /><div style={{ flex: 1, background: '#ea580c' }} /></div>
        <div style={{ display: 'flex', gap: 1, height: 3 }}><div style={{ width: 4, background: '#9a3412' }} /><div style={{ flex: 1, background: '#b91c1c' }} /><div style={{ width: 4, background: '#a1441a' }} /></div>
      </div>
    );
  }

  // Fallback category emoji
  const cat = def ? def.category : 'others';
  let emoji = '📦';
  if (cat === 'vessels') emoji = '🛢️';
  else if (cat === 'machines') emoji = '⚙️';
  else if (cat === 'gateways') emoji = '📟';
  else if (cat === 'piping') emoji = '➰';
  else if (cat === 'sensors') emoji = '🏷️';
  else if (cat === 'others') emoji = '🧱';

  return <span style={{ fontSize: 18 }}>{emoji}</span>;
}
