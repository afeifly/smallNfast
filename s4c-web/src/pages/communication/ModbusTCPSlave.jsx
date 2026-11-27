import { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import './ModbusTCP.css';

const ModbusTCPSlave = () => {
  const { configData, setConfigData } = useConfig();
  const { t } = useLanguage();
  const [port, setPort] = useState('502');
  const [errorValue, setErrorValue] = useState('9999');

  const configPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgcommunicatport.json'));
  const currentConfig = configData?.configs?.[configPath];
  const tcpConfig = currentConfig?.retcp;

  useEffect(() => {
    if (tcpConfig) {
      setPort(String(tcpConfig.port ?? 502));
      setErrorValue(tcpConfig.errorvalue !== undefined ? String(tcpConfig.errorvalue) : '9999');
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

  const isPortInvalid = (() => {
    const trimmed = String(port).trim();
    if (trimmed === '') return true;
    const num = Number(trimmed);
    return Number.isNaN(num) || num < 1 || num > 65535;
  })();

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
            <label className="modbus-label" htmlFor="modbus-tcp-port">
              {t('Port')}
            </label>
            <div className="modbus-tcp-input-container">
              <input
                id="modbus-tcp-port"
                type="number"
                className={`modbus-input ${isPortInvalid ? 'invalid' : ''}`}
                aria-invalid={isPortInvalid}
                value={port}
                onChange={(e) => {
                  const raw = e.target.value;
                  setPort(raw);
                  const trimmed = raw.trim();
                  const num = Number(trimmed);
                  if (trimmed !== '' && !Number.isNaN(num) && num >= 1 && num <= 65535) {
                    updateConfig('port', num);
                  }
                }}
                min="1"
                max="65535"
              />
              <span className={`modbus-tcp-suffix ${isPortInvalid ? 'invalid' : ''}`}>(1 - 65535)</span>
            </div>
          </div>
        </div>

        <div className="modbus-row">
          <div className="modbus-field">
            <label className="modbus-label" htmlFor="modbus-tcp-error-value">
              {t('Error Value')}
            </label>
            <div className="modbus-tcp-input-container">
              <input
                id="modbus-tcp-error-value"
                type="text"
                className="modbus-input"
                value={errorValue}
                onChange={(e) => {
                  const raw = e.target.value;
                  setErrorValue(raw);
                  const trimmed = raw.trim();
                  const parsed = trimmed !== '' && !Number.isNaN(Number(trimmed)) ? Number(trimmed) : raw;
                  updateConfig('errorvalue', parsed);
                }}
              />
            </div>
          </div>

          <div className="modbus-field">
            <label className="modbus-label">{t('Response Timeout')}</label>
            <div className="modbus-tcp-input-container">
              <div className="modbus-input-readonly">
                <span>1000</span>
              </div>
              <span className="modbus-tcp-suffix">ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModbusTCPSlave;
