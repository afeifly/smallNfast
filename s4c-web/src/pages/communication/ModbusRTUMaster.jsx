import React, { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import './ModbusRTU.css';

const ModbusRTUMaster = () => {
  const { configData, setConfigData } = useConfig();
  const { t } = useLanguage();
  const [baudRate, setBaudRate] = useState(19200);
  const [parity, setParity] = useState(3);
  const [timeout, setTimeoutVal] = useState(10);

  // Dynamically find the config path
  const configPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgcommunicatport.json'));
  const currentConfig = configData?.configs?.[configPath];
  const masterConfig = currentConfig?.rs485m0;

  useEffect(() => {
    if (masterConfig) {
      setBaudRate(masterConfig.baudrate ?? 19200);
      setParity(masterConfig.parityFrameIndex ?? 3);
      setTimeoutVal(masterConfig.responseTimeout ?? 10);
    }
  }, [masterConfig]);

  const updateConfig = (field, value) => {
    if (!configPath || !currentConfig) return;

    const newConfigData = {
      ...configData,
      configs: {
        ...configData.configs,
        [configPath]: {
          ...currentConfig,
          rs485m0: {
            ...masterConfig,
            [field]: value
          }
        }
      }
    };

    setConfigData(newConfigData);
  };

  return (
    <div className="content-card modbus-rtu-page">
      <header className="modbus-header">
        <h2 className="modbus-title">{t('Modbus RTU master information')}</h2>
      </header>

      <div className="modbus-body">
        <div className="modbus-row">
          <div className="modbus-field">
            <label className="modbus-label">{t('Protocol')} <span className="required">*</span></label>
            <div className="modbus-input-readonly">
              <span>RTU</span>
            </div>
          </div>

          <div className="modbus-field">
            <label className="modbus-label">{t('Baud rate')} <span className="required">*</span></label>
            <div className="modbus-select-wrapper">
              <select 
                className="modbus-select"
                value={baudRate}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setBaudRate(val);
                  updateConfig('baudrate', val);
                }}
              >
                <option value={9600}>9600</option>
                <option value={19200}>19200</option>
                <option value={38400}>38400</option>
                <option value={115200}>115200</option>
              </select>
            </div>
          </div>
        </div>

        <div className="modbus-row">
          <div className="modbus-field">
            <label className="modbus-label">{t('Frame parity')} <span className="required">*</span></label>
            <div className="modbus-select-wrapper">
              <select 
                className="modbus-select"
                value={parity}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setParity(val);
                  updateConfig('parityFrameIndex', val);
                }}
              >
                <option value={3}>8,N,1</option>
                <option value={0}>8,E,1</option>
                <option value={1}>8,O,1</option>
                <option value={2}>8,N,2</option>
              </select>
            </div>
          </div>

          <div className="modbus-field">
            <label className="modbus-label">{t('Response timeout(s)')} <span className="required">*</span></label>
            <div className="modbus-input-container">
              <input 
                type="number"
                className="modbus-input"
                value={timeout}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTimeoutVal(val);
                  updateConfig('responseTimeout', val);
                }}
                min="1"
                max="25"
              />
              <span className="modbus-range-hint">(1~25)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModbusRTUMaster;
