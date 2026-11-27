import { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import './ModbusTCP.css';

const ModbusTCPMaster = () => {
  const { configData, setConfigData } = useConfig();
  const { t } = useLanguage();
  const [connectTimeout, setConnectTimeout] = useState('250');
  const [readWriteTimeout, setReadWriteTimeout] = useState('260');

  const configPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgcommunicatport.json'));
  const currentConfig = configData?.configs?.[configPath];
  const tcpConfig = currentConfig?.retcp;

  useEffect(() => {
    if (tcpConfig) {
      setConnectTimeout(String(tcpConfig.connectTimeout ?? 250));
      setReadWriteTimeout(String(tcpConfig.readWriteTimeout ?? 260));
    }
  }, [tcpConfig]);

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
            [field]: value,
          },
        },
      },
    };

    setConfigData(newConfigData);
  };

  const isOutOfRange = (val, min, max) => {
    const trimmed = String(val).trim();
    if (trimmed === '') return true;
    const num = Number(trimmed);
    return Number.isNaN(num) || num < min || num > max;
  };

  const isConnectTimeoutInvalid = isOutOfRange(connectTimeout, 100, 3000);
  const isReadWriteTimeoutInvalid = isOutOfRange(readWriteTimeout, 100, 3000);

  return (
    <div className="modbus-tcp-configuration">
      <div className="modbus-body">
        <div className="modbus-row">
          <div className="modbus-field">
            <label className="modbus-label">{t('Protocol')}</label>
            <div className="modbus-input-readonly">
              <span>TCP</span>
            </div>
          </div>

          <div className="modbus-field">
            <label className="modbus-label" htmlFor="modbus-tcp-connect-timeout">
              {t('Connect Timeout')}
            </label>
            <div className="modbus-tcp-input-container">
              <input
                id="modbus-tcp-connect-timeout"
                type="number"
                className={`modbus-input ${isConnectTimeoutInvalid ? 'invalid' : ''}`}
                aria-invalid={isConnectTimeoutInvalid}
                value={connectTimeout}
                onChange={(e) => {
                  const raw = e.target.value;
                  setConnectTimeout(raw);
                  const trimmed = raw.trim();
                  const num = Number(trimmed);
                  if (trimmed !== '' && !Number.isNaN(num) && num >= 100 && num <= 3000) {
                    updateConfig('connectTimeout', num);
                  }
                }}
                min="100"
                max="3000"
              />
              <span className={`modbus-tcp-suffix ${isConnectTimeoutInvalid ? 'invalid' : ''}`}>ms (100 - 3000)</span>
            </div>
          </div>
        </div>

        <div className="modbus-row">
          <div className="modbus-field">
            <label className="modbus-label" htmlFor="modbus-tcp-rw-timeout">
              {t('Read/Write Timeout')}
            </label>
            <div className="modbus-tcp-input-container">
              <input
                id="modbus-tcp-rw-timeout"
                type="number"
                className={`modbus-input ${isReadWriteTimeoutInvalid ? 'invalid' : ''}`}
                aria-invalid={isReadWriteTimeoutInvalid}
                value={readWriteTimeout}
                onChange={(e) => {
                  const raw = e.target.value;
                  setReadWriteTimeout(raw);
                  const trimmed = raw.trim();
                  const num = Number(trimmed);
                  if (trimmed !== '' && !Number.isNaN(num) && num >= 100 && num <= 3000) {
                    updateConfig('readWriteTimeout', num);
                  }
                }}
                min="100"
                max="3000"
              />
              <span className={`modbus-tcp-suffix ${isReadWriteTimeoutInvalid ? 'invalid' : ''}`}>ms (100 - 3000)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModbusTCPMaster;
