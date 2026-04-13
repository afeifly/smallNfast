import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

// ── SVG Icons ──────────────────────────────────────────────────────────────
const Icons = {
  home: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  graphic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="3 9 9 9 9 21"/><polyline points="9 14 15 14 15 21"/><polyline points="15 5 21 5 21 21"/></svg>,
  logger: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  alarm: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  communication: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  sensor: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M8.7 3.9C9.8 3.3 11 3 12 3c1 0 2.2.3 3.3.9"/><path d="M5.1 6.5C6.7 4.8 8.7 3.7 11 3.3"/><path d="M18.9 6.5C17.3 4.8 15.3 3.7 13 3.3"/><path d="M3 9.8C4 7.6 5.7 5.8 7.8 4.8"/><path d="M21 9.8c-1-2.2-2.7-4-4.8-5"/><path d="M8.7 20.1C9.8 20.7 11 21 12 21c1 0 2.2-.3 3.3-.9"/><path d="M5.1 17.5C6.7 19.2 8.7 20.3 11 20.7"/><path d="M18.9 17.5C17.3 19.2 15.3 20.3 13 20.7"/></svg>,
  system: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  analysis: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  chevron: (open) => <svg style={{ transition: 'transform 0.25s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>,
};

// ── Full nav tree ───────────────────────────────────────────────────────────
const NAV = [
  {
    key: 'home',
    label: 'Home',
    to: '/',
    icon: Icons.home,
  },
  {
    key: 'graphic',
    label: 'Graphic',
    to: '/graphic',
    icon: Icons.graphic,
  },
  {
    key: 'logger',
    label: 'Logger',
    icon: Icons.logger,
    children: [
      { label: 'Logger List', to: '/logger/list' },
      { label: 'Logger Settings', to: '/logger/settings' },
    ],
  },
  {
    key: 'alarm',
    label: 'Alarm',
    icon: Icons.alarm,
    children: [
      { label: 'Alarm List', to: '/alarm/list' },
      { label: 'Alarm Settings', to: '/alarm/settings' },
      { label: 'Email Notification', to: '/alarm/email' },
    ],
  },
  {
    key: 'communication',
    label: 'Communication',
    icon: Icons.communication,
    children: [
      { label: 'Modbus RTU', to: '/communication/modbus-rtu' },
      { label: 'Modbus TCP', to: '/communication/modbus-tcp' },
      { label: 'IO-Link', to: '/communication/io-link' },
      { label: 'Protocol Settings', to: '/communication/protocol' },
      { label: 'Connection Status', to: '/communication/status' },
    ],
  },
  {
    key: 'sensor',
    label: 'Sensor Configuration',
    icon: Icons.sensor,
    children: [
      { label: 'Add sUTO Sensor', to: '/sensor/add-suto' },
      { label: 'Add 3rd-Party Sensor', to: '/sensor/add-3rd' },
      { label: 'Add Virtual Channel', to: '/sensor/add-virtual' },
      { label: 'Sensor List', to: '/sensor/list' },
    ],
  },
  {
    key: 'system',
    label: 'System',
    icon: Icons.system,
    children: [
      { label: 'User Management', to: '/system/users' },
      { label: 'Network Settings', to: '/system/network' },
      { label: 'Time & Date', to: '/system/time' },
      { label: 'Firmware Update', to: '/system/firmware' },
      { label: 'Backup & Restore', to: '/system/backup' },
      { label: 'License', to: '/system/license' },
    ],
  },
  {
    key: 'analysis',
    label: 'Data Analysis',
    icon: Icons.analysis,
    children: [
      { label: 'Report', to: '/analysis/report' },
      { label: 'Export Data', to: '/analysis/export' },
      { label: 'Energy Analysis', to: '/analysis/energy' },
    ],
  },
];

// ── Layout ──────────────────────────────────────────────────────────────────
const Layout = ({ children }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  // Determine which group is initially open based on current path
  const initialOpen = NAV.reduce((acc, item) => {
    if (item.children) {
      const active = item.children.some(c => currentPath.startsWith(c.to));
      acc[item.key] = active;
    }
    return acc;
  }, {});

  const [openMenus, setOpenMenus] = useState(initialOpen);

  const toggle = (key) => setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));

  const breadcrumbParts = currentPath === '/'
    ? ['dashboard']
    : currentPath.split('/').filter(Boolean);

  return (
    <div className="app-container">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-header">
          <img src="/images/main_logo.png" alt="S4C Logo" className="main-logo" />
          <div className="logo-text">S4C-WEB</div>
        </div>

        {/* Nav */}
        <nav className="nav-list">
          {NAV.map((item) => {
            const isLeafActive = item.to === '/'
              ? currentPath === '/'
              : item.to && currentPath.startsWith(item.to);

            const hasChildren = !!item.children;
            const isGroupActive = hasChildren && item.children.some(c => currentPath.startsWith(c.to));
            const isOpen = !!openMenus[item.key];

            return (
              <div key={item.key} className="nav-group">
                {/* Parent item */}
                {item.to ? (
                  <Link
                    to={item.to}
                    className={`nav-item ${isLeafActive ? 'active' : ''}`}
                  >
                    <div className="nav-icon">{item.icon}</div>
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <div
                    className={`nav-item ${isGroupActive ? 'active' : ''}`}
                    onClick={() => toggle(item.key)}
                  >
                    <div className="nav-icon">{item.icon}</div>
                    <span>{item.label}</span>
                    <span style={{ marginLeft: 'auto' }}>{Icons.chevron(isOpen)}</span>
                  </div>
                )}

                {/* Sub-items */}
                {hasChildren && (
                  <div className={`submenu ${isOpen ? 'submenu-open' : ''}`}>
                    {item.children.map((child) => {
                      const childActive = currentPath === child.to || currentPath.startsWith(child.to + '/');
                      return (
                        <Link
                          key={child.to}
                          to={child.to}
                          className={`submenu-item ${childActive ? 'submenu-item-active' : ''}`}
                        >
                          <span className="submenu-dot" />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="10" r="3"/>
              <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>
            </svg>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-wrapper">
        <header className="top-bar">
          <div className="breadcrumb-nav">
            <span className="breadcrumb-item">home</span>
            {breadcrumbParts.map((part, i) => (
              <React.Fragment key={i}>
                <span className="breadcrumb-separator">/</span>
                <span className={`breadcrumb-item ${i === breadcrumbParts.length - 1 ? 'active' : ''}`}>
                  {part.replace(/-/g, ' ')}
                </span>
              </React.Fragment>
            ))}
          </div>
          <div className="top-bar-right">
            <div className="user-profile">
              <img src="/images/user_icon.png" alt="Admin" className="user-avatar" />
              <div className="user-info">
                <span className="user-name">suto Admin</span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.9)" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
            </div>
            <div className="topbar-icon-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.8)" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
          </div>
        </header>

        <section className="content-area">
          {children}
        </section>
      </main>
    </div>
  );
};

export default Layout;
