import React, { useState, useEffect, useCallback } from 'react';
import './Support.css';
import { useConfig } from '../../context/ConfigContext';

// Keys the system_info.json might be stored under inside the cfgf package
const SYSTEM_INFO_PATHS = [
  'system/system_info.json',
  '/system/system_info.json',
  'config/system_info.json',
  '/config/system_info.json',
  'system_info.json',
];

/** Extract user_info_config from the global configData.configs map. */
function extractUserInfo(configs) {
  if (!configs) return null;
  for (const p of SYSTEM_INFO_PATHS) {
    if (configs[p]?.user_info_config) return configs[p].user_info_config;
  }
  return null;
}

/** Find the exact key used for system_info.json in the configs map. */
function findSystemInfoPath(configs) {
  if (!configs) return null;
  for (const p of SYSTEM_INFO_PATHS) {
    if (configs[p] !== undefined) return p;
  }
  return null;
}

/** Map user_info_config fields → local state shape. */
function toLocalState(userInfo) {
  if (!userInfo) return { companyName: '', address: '', telephone: '', email: '', website: '' };
  return {
    companyName: userInfo.service_company_name ?? '',
    address:     userInfo.address                ?? '',
    telephone:   userInfo.telephone              ?? '',
    email:       userInfo.email                  ?? '',
    website:     userInfo.website                ?? '',
  };
}

const Support = () => {
  const { configData, setConfigData } = useConfig();

  const getInitialState = useCallback(() => {
    return toLocalState(extractUserInfo(configData?.configs));
  }, [configData]);

  const [supportInfo, setSupportInfo] = useState(getInitialState);

  // Re-sync when a new cfgf is imported
  useEffect(() => {
    setSupportInfo(getInitialState());
  }, [getInitialState]);

  const handleChange = (field, value) => {
    setSupportInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!configData) {
      console.warn('[Support] No config loaded — nothing to save into.');
      return;
    }

    const systemInfoPath = findSystemInfoPath(configData.configs);
    if (!systemInfoPath) {
      console.warn('[Support] system_info.json not found in loaded config.');
      return;
    }

    const updatedUserInfo = {
      service_company_name: supportInfo.companyName,
      address:              supportInfo.address,
      telephone:            supportInfo.telephone,
      email:                supportInfo.email,
      website:              supportInfo.website,
    };

    const updatedSystemInfo = {
      ...configData.configs[systemInfoPath],
      user_info_config: updatedUserInfo,
    };

    setConfigData({
      ...configData,
      configs: {
        ...configData.configs,
        [systemInfoPath]: updatedSystemInfo,
      },
    });

    console.log('[Support] Saved user_info_config:', updatedUserInfo);
  };

  const handleCancel = () => {
    setSupportInfo(getInitialState());
  };

  return (
    <div className="content-card support-page">
      {/* Header */}
      <header className="support-header">
        <h2 className="support-title">Support information</h2>
      </header>

      {/* Content Body */}
      <div className="support-body">
        <div className="support-row">
          {/* Service company name */}
          <div className="support-field">
            <label className="support-label">Service company name <span className="required">*</span></label>
            <div className="support-input-container">
              <input
                type="text"
                className="support-input"
                value={supportInfo.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
              />
            </div>
          </div>

          {/* Address */}
          <div className="support-field">
            <label className="support-label">Address <span className="required">*</span></label>
            <div className="support-input-container">
              <input
                type="text"
                className="support-input"
                value={supportInfo.address}
                onChange={(e) => handleChange('address', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="support-row">
          {/* Telephone */}
          <div className="support-field">
            <label className="support-label">Telephone <span className="required">*</span></label>
            <div className="support-input-container">
              <input
                type="text"
                className="support-input"
                value={supportInfo.telephone}
                onChange={(e) => handleChange('telephone', e.target.value)}
              />
            </div>
          </div>

          {/* Email */}
          <div className="support-field">
            <label className="support-label">Email <span className="required">*</span></label>
            <div className="support-input-container">
              <input
                type="email"
                className="support-input"
                value={supportInfo.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="support-row">
          {/* Website */}
          <div className="support-field">
            <label className="support-label">Website <span className="required">*</span></label>
            <div className="support-input-container">
              <input
                type="url"
                className="support-input"
                value={supportInfo.website}
                onChange={(e) => handleChange('website', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="support-footer">
        <button className="btn-support-cancel" onClick={handleCancel}>Cancel</button>
        <button className="btn-support-save" onClick={handleSave}>Save</button>
      </footer>
    </div>
  );
};

export default Support;
