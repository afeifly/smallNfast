import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { useLanguage } from '../context/LanguageContext';

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
import btnItems from '../assets/images/btn-items.png';
import mainLogo from '../assets/images/main_logo.png';

// SVG icons for File Verification
const iconVerifyL = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2300AB84" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
const iconVerifyD = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23333333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';

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
    to: '/alarm',
    icons: { active: iconAlarmL, inactive: iconAlarmD },
  },

  {
    key: 'sensor',
    label: 'Sensor Configuration',
    icons: { active: iconSettingL, inactive: iconSettingD },
    children: [
      { label: 'SUTO iTEC Sensor', to: '/sensor/add-suto' },
      { label: '3rd-Party Sensor', to: '/sensor/add-3rd' },
      { label: 'Analog & Digital Input', to: '/sensor/analog-digital' },
      { label: 'Virtual Channel', to: '/sensor/virtual-channel' },
      { label: 'Live-View Layout', to: '/sensor/layout-setting' },
    ],
  },
  {
    key: 'communication',
    label: 'Communication',
    icons: { active: iconOrgL, inactive: iconOrgD },
    children: [
      { label: 'Modbus RTU Master', to: '/communication/modbus-rtu-master' },
      { label: 'Modbus RTU Slave', to: '/communication/modbus-rtu-slave' },
      { label: 'Holding Register', to: '/communication/holding-register' },
    ],
  },
  {
    key: 'system',
    label: 'System',
    icons: { active: iconSystemL, inactive: iconSystemD },
    children: [
      { label: 'Config Management', to: '/config-manager' },
      { label: 'Support', to: '/system/support' },
    ],
  },
  {
    key: 'file-verification',
    label: 'File Verification',
    to: '/system/file-verification',
    icons: { active: iconVerifyL, inactive: iconVerifyD },
  },
  {
    key: 'analysis',
    label: 'Data Analysis',
    to: '/analysis',
    icons: { active: iconDashbL, inactive: iconDashbD },
  },
];

const Sidebar = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const { activeConfigId } = useConfig();
  const { t } = useLanguage();
  const hasConfig = !!activeConfigId;

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
        <img src={mainLogo} alt="S4C Logo" className="main-logo" />
        <div className="logo-text">S4C-Web</div>
      </div>

      {/* Nav */}
      <nav className="nav-list">
        {NAV.map((item) => {
          const isLeafActive = item.to === '/'
            ? currentPath === '/'
            : item.to && currentPath.startsWith(item.to);

          const hasChildren = !!item.children;
          const isParentDisabled = !hasConfig && item.key !== 'system' && item.key !== 'home' && item.key !== 'file-verification';
          const isActive = isLeafActive && !isParentDisabled;
          const isOpen = !isParentDisabled && !!openMenus[item.key];

          const iconSrc = isActive ? item.icons.active : item.icons.inactive;

          const normalIconStyle = {
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          };

          return (
            <div key={item.key} className="nav-group">
              {/* Parent item */}
              {item.to ? (
                isParentDisabled ? (
                  <div className="nav-item disabled">
                    <div className="nav-icon">
                      <img
                        src={item.icons.inactive}
                        alt={t(item.label)}
                        style={normalIconStyle}
                      />
                    </div>
                    <span>{t(item.label)}</span>
                  </div>
                ) : (
                  <Link
                    to={item.to}
                    className={`nav-item ${isLeafActive ? 'active' : ''}`}
                  >
                    <div className="nav-icon">
                      <img
                        src={iconSrc}
                        alt={t(item.label)}
                        style={normalIconStyle}
                      />
                    </div>
                    <span>{t(item.label)}</span>
                  </Link>
                )
              ) : (
                isParentDisabled ? (
                  <div className="nav-item disabled">
                    <div className="nav-icon">
                      <img
                        src={item.icons.inactive}
                        alt={t(item.label)}
                        style={normalIconStyle}
                      />
                    </div>
                    <span>{t(item.label)}</span>
                    <span className="chevron">
                      {Icons.chevron(false)}
                    </span>
                  </div>
                ) : (
                  <div
                    className="nav-item"
                    onClick={() => toggle(item.key)}
                  >
                    <div className="nav-icon">
                      <img
                        src={iconSrc}
                        alt={t(item.label)}
                        style={normalIconStyle}
                      />
                    </div>
                    <span>{t(item.label)}</span>
                    <span className="chevron">
                      {Icons.chevron(isOpen)}
                    </span>
                  </div>
                )
              )}

              {/* Sub-items */}
              {hasChildren && (
                <div className={`submenu ${isOpen ? 'submenu-open' : ''}`}>
                  {item.children.map((child) => {
                    const childActive = currentPath === child.to || currentPath.startsWith(child.to + '/');
                    const isChildDisabled = !hasConfig && child.to !== '/config-manager' && child.to !== '/system/file-verification';

                    if (isChildDisabled) {
                      return (
                        <div
                          key={child.to}
                          className="submenu-item disabled"
                        >
                          <span>{t(child.label)}</span>
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={child.to}
                        to={child.to}
                        className={`submenu-item ${childActive ? 'active' : ''}`}
                      >
                        <span>{t(child.label)}</span>
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
          <img src={btnItems} alt="Items" style={{ width: 32, height: 32 }} />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
