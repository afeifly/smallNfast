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
        <h2 className="modbus-title">{t({ en: 'Modbus TCP connection information', de: 'Modbus TCP-Verbindungsinformationen', cn: 'Modbus TCP 连接信息' })}</h2>
      </header>

      <div className="modbus-body">
        <div className="modbus-row">
          <div className="modbus-field">
            <label className="modbus-label">{t({ en: 'Protocol', de: 'Protokoll', cn: '协议' })} <span className="required">*</span></label>
            <div className="modbus-input-readonly">
              <span>TCP</span>
            </div>
          </div>

          <div className="modbus-field">
            <label className="modbus-label">{t({ en: 'DHCP Enable', de: 'DHCP aktivieren', cn: '启用 DHCP' })}</label>
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
                <label className="modbus-label">{t({ en: 'IP address', de: 'IP-Adresse', cn: 'IP 地址' })} <span className="required">*</span></label>
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
                <label className="modbus-label">{t({ en: 'Sub mask', de: 'Subnetzmaske', cn: '子网掩码' })} <span className="required">*</span></label>
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
                <label className="modbus-label">{t({ en: 'Default gateway', de: 'Standard-Gateway', cn: '默认网关' })} <span className="required">*</span></label>
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
                <label className="modbus-label">{t({ en: 'Port', de: 'Port', cn: '端口' })} <span className="required">*</span></label>
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
