import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

// Import PNG Icons
import iconHomeL from '../assets/images/icon_home_l.png';
import iconHomeD from '../assets/images/icon_home_d.png';
import iconChartL from '../assets/images/icon_chart_l.png';
import iconChartD from '../assets/images/icon_chart_d.png';
import iconEditL from '../assets/images/icon_edit_l.png';
import iconEditD from '../assets/images/icon_edit_d.png';
import iconAlarmL from '../assets/images/icon_alarm_l.png';
import iconAlarmD from '../assets/images/icon_alarm_d.png';
import iconOrgL from '../assets/images/icon_org_l.png';
import iconOrgD from '../assets/images/icon_org_d.png';
import iconSettingL from '../assets/images/icon_setting_l.png';
import iconSettingD from '../assets/images/icon_setting_d.png';
import iconSystemL from '../assets/images/icon_system_l.png';
import iconSystemD from '../assets/images/icon_system_d.png';
import iconDashbL from '../assets/images/icon_dashb_l.png';
import iconDashbD from '../assets/images/icon_dashb_d.png';

const Icons = {
  chevron: (open) => (
    <svg
      style={{ transition: 'transform 0.25s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
};

export const NAV = [
  {
    key: 'home',
    label: 'Home',
    to: '/',
    icons: { active: iconHomeL, inactive: iconHomeD },
  },
  {
    key: 'graphic',
    label: 'Graphic',
    to: '/graphic',
    icons: { active: iconChartL, inactive: iconChartD },
  },
  {
    key: 'logger',
    label: 'Logger',
    to: '/logger/settings',
    icons: { active: iconEditL, inactive: iconEditD },
    // children: [
    //   { label: 'Logger List', to: '/logger/list' },
    //   { label: 'Logger Settings', to: '/logger/settings' },
    // ],
  },
  {
    key: 'alarm',
    label: 'Alarm',
    icons: { active: iconAlarmL, inactive: iconAlarmD },
    children: [
      { label: 'Alarm List', to: '/alarm/list' },
      { label: 'Alarm Settings', to: '/alarm/settings' },
      { label: 'Email Notification', to: '/alarm/email' },
    ],
  },
  {
    key: 'communication',
    label: 'Communication',
    icons: { active: iconOrgL, inactive: iconOrgD },
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
    icons: { active: iconSettingL, inactive: iconSettingD },
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
    icons: { active: iconSystemL, inactive: iconSystemD },
    children: [
      { label: 'User Management', to: '/system/users' },
      { label: 'Network Settings', to: '/system/network' },
      { label: 'Time & Date', to: '/system/time' },
      { label: 'Firmware Update', to: '/system/firmware' },
      { label: 'Backup & Restore', to: '/system/backup' },
      { label: 'Config Manager', to: '/config-manager' },
      { label: 'License', to: '/system/license' },
    ],
  },
  {
    key: 'analysis',
    label: 'Data Analysis',
    icons: { active: iconDashbL, inactive: iconDashbD },
    children: [
      { label: 'Report', to: '/analysis/report' },
      { label: 'Export Data', to: '/analysis/export' },
      { label: 'Energy Analysis', to: '/analysis/energy' },
    ],
  },
];

const Sidebar = () => {
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

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-header">
        <img src="/images/main_logo.png" alt="S4C Logo" className="main-logo" />
        <div className="logo-text">S4C-Web</div>
      </div>

      {/* Nav */}
      <nav className="nav-list">
        {NAV.map((item) => {
          const isLeafActive = item.to === '/'
            ? currentPath === '/'
            : item.to && currentPath.startsWith(item.to);

          const hasChildren = !!item.children;
          const isGroupActive = hasChildren && item.children.some(c => currentPath.startsWith(c.to));
          const isActive = isLeafActive || isGroupActive;
          const isOpen = !!openMenus[item.key];

          const iconSrc = isActive ? item.icons.active : item.icons.inactive;

          return (
            <div key={item.key} className="nav-group">
              {/* Parent item */}
              {item.to ? (
                <Link
                  to={item.to}
                  className={`nav-item ${isLeafActive ? 'active' : ''}`}
                >
                  <div className="nav-icon">
                    <img src={iconSrc} alt={item.label} />
                  </div>
                  <span>{item.label}</span>
                </Link>
              ) : (
                <div
                  className={`nav-item ${isGroupActive ? 'active' : ''}`}
                  onClick={() => toggle(item.key)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="nav-icon">
                    <img src={iconSrc} alt={item.label} />
                  </div>
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
                        {/* <span className="submenu-dot" /> */}
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
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="10" r="3" />
            <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
          </svg>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
