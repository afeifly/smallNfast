import React, { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import './ModbusTCP.css';

const ModbusTCP = () => {
  const [dhcp, setDhcp] = useState(false);
  const [ipAddress, setIpAddress] = useState('192.168.1.100');
  const [subnetMask, setSubnetMask] = useState('255.255.255.0');
  const [gateway, setGateway] = useState('192.168.1.1');
  const [port, setPort] = useState('502');

  const { configData, setConfigData } = useConfig();
  const { t } = useLanguage();
  const configPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgcommunicatport.json'));
  const currentConfig = configData?.configs?.[configPath];
  const tcpConfig = currentConfig?.retcp;

  const updateConfig = (field, value) => {
    if (!configPath || !currentConfig) return;

    const newConfigData = {
      ...configData,
      configs: {
        ...configData.configs,
        [configPath]: {
          ...currentConfig,
          retcp: {
            ...tcpConfig,
            [field]: value
          }
        }
      }
    };
    setConfigData(newConfigData);
  };

  return (
    <div className="content-card modbus-tcp-page">
      <header className="modbus-header">
        <h2 className="modbus-title">{t('Modbus TCP connection information')}</h2>
      </header>

      <div className="modbus-body">
        <div className="modbus-row">
          <div className="modbus-field">
            <label className="modbus-label">{t('Protocol')} <span className="required">*</span></label>
            <div className="modbus-input-readonly">
              <span>TCP</span>
            </div>
          </div>

          <div className="modbus-field">
            <label className="modbus-label">{t('DHCP Enable')}</label>
            <div 
              className={`modbus-switch ${dhcp ? 'on' : ''}`} 
              onClick={() => {
                const newVal = !dhcp;
                setDhcp(newVal);
                // Future: update network config here
              }}
            >
              <div className="switch-knob"></div>
            </div>
          </div>
        </div>

        {!dhcp && (
          <>
            <div className="modbus-row">
              <div className="modbus-field">
                <label className="modbus-label">{t('IP address')} <span className="required">*</span></label>
                <div className="modbus-input-container">
                  <input 
                    type="text"
                    className="modbus-input"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    placeholder="0.0.0.0"
                  />
                </div>
              </div>

              <div className="modbus-field">
                <label className="modbus-label">{t('Sub mask')} <span className="required">*</span></label>
                <div className="modbus-input-container">
                  <input 
                    type="text"
                    className="modbus-input"
                    value={subnetMask}
                    onChange={(e) => setSubnetMask(e.target.value)}
                    placeholder="255.255.255.0"
                  />
                </div>
              </div>
            </div>

            <div className="modbus-row">
              <div className="modbus-field">
                <label className="modbus-label">{t('Default gateway')} <span className="required">*</span></label>
                <div className="modbus-input-container">
                  <input 
                    type="text"
                    className="modbus-input"
                    value={gateway}
                    onChange={(e) => setGateway(e.target.value)}
                    placeholder="0.0.0.0"
                  />
                </div>
              </div>

              <div className="modbus-field">
                <label className="modbus-label">{t('Port')} <span className="required">*</span></label>
                <div className="modbus-input-container">
                  <input 
                    type="number"
                    className="modbus-input"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ModbusTCP;
