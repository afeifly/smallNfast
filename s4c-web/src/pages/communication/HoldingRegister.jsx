import React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import './HoldingRegister.css';

const HoldingRegister = () => {
  const { configData } = useConfig();
  const { t } = useLanguage();

  // Extract configuration
  const configPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('SUTO-SensorList.sutolist'));
  const currentConfig = configData?.configs?.[configPath];
  const locationConfigPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgLocation.json'));
  const locationsArray = configData?.configs?.[locationConfigPath]?.Locations || [];

  // Extract option board (analog sensor) configuration
  const optionBoardConfigPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgOptionBoard.json'));
  const optionBoardItems = configData?.configs?.[optionBoardConfigPath]?.cfgOptionBoard || [];

  // Intermediate lists to collect channels by category
  const sutoChannels = [];
  const thirdPartyChannels = [];
  const analogChannels = [];
  const virtualChannels = [];

  const getChannelLocation = (createTimeStr) => {
    let locationText = '---';
    if (Array.isArray(locationsArray)) {
      for (const locObj of locationsArray) {
        const matchedPoint = (locObj.meapoints || []).find(pt => 
          Array.isArray(pt.channels) && pt.channels.some(id => String(id) === createTimeStr)
        );
        if (matchedPoint) {
          locationText = `${matchedPoint.location}/${matchedPoint.meapoint}`;
          break;
        }
      }
    }
    return locationText;
  };

  // Group sensors in SUTO-SensorList
  (currentConfig?.cfgsensor || []).forEach(sensor => {
    (sensor.cfgchannel || []).forEach((ch) => {
      const locationText = getChannelLocation(String(ch.CreateTime));
      const channelData = {
        location: locationText,
        sensorDescription: sensor.Description || sensor.Name || '---',
        channelDescription: ch.ChannelDescription || '---',
        type: ch.ValueType || 8,
        unit: ch.UnitInASCII,
        resolution: ch.Resolution,
        rw: ch.rw || 0
      };

      if (sensor.isVirtualSensor === true) {
        virtualChannels.push(channelData);
      } else if (sensor.isSuto === true) {
        sutoChannels.push(channelData);
      } else {
        thirdPartyChannels.push(channelData);
      }
    });
  });

  // Extract Option Board channels (analog sensor)
  optionBoardItems.forEach(item => {
    const locationText = getChannelLocation(String(item.CreateTime));
    analogChannels.push({
      location: locationText,
      sensorDescription: item.SensorDescription || '---',
      channelDescription: item.ChannelDescription || '---',
      type: item.ValueType || 8,
      unit: item.PreDefineUnit || item.UnitInASCII || '---',
      resolution: item.Resolution,
      rw: item.rw || 0
    });
  });

  // Combine channels in requested order: suto sensor, 3-Party senser, analog sensor, virtual channel
  const orderedChannels = [
    ...sutoChannels,
    ...thirdPartyChannels,
    ...analogChannels,
    ...virtualChannels
  ];

  // Assign holding register value: every channel from 0 add + 2 n (0, 2, 4, 6, ...)
  const allChannels = orderedChannels.map((ch, idx) => ({
    ...ch,
    address: idx * 2
  }));

  const getResolutionText = (res) => {
    const resolutions = {
      0: '1',
      1: '0.1',
      2: '0.01',
      3: '0.001',
      4: '0.0001',
      5: '0.00001',
      6: '0.000001'
    };
    return resolutions[res] || res || '---';
  };

  const getDataTypeName = (type) => {
    const types = {
      1: 'INT16', 2: 'UINT16', 3: 'INT32_B', 4: 'INT32_L',
      5: 'UINT32_B', 6: 'UINT32_L', 7: 'FLOAT_B', 8: 'FLOAT_L',
      9: 'UINT64_B', 10: 'UINT64_L'
    };
    return types[type] || t({ en: 'Unknown', de: 'Unbekannt', cn: '未知' });
  };

  const getRWText = (rw) => {
    const rws = { 0: 'R', 1: 'W', 2: 'R/W' };
    return rws[rw] || 'R';
  };

  const getByteCount = (type) => {
    if ([1, 2].includes(type)) return 2;
    if ([3, 4, 5, 6, 7, 8].includes(type)) return 4;
    if ([9, 10].includes(type)) return 8;
    return 4;
  };

  return (
    <div className="content-card holding-register-page">
      {/* Header - RESTORED STYLE */}
      <header className="holding-header">
        <div className="holding-title-section">
          <h2 className="holding-title">{t({ en: 'Holding register table', de: 'Holding-Register-Tabelle', cn: '保持寄存器表' })}</h2>
          <p className="holding-subtitle">
            {t({
              en: 'Use this holding register table to read data via Modbus/RTU or Modbus/TCP.',
              de: 'Verwenden Sie diese Holding-Register-Tabelle, um Daten über Modbus/RTU oder Modbus/TCP zu lesen.',
              cn: '使用此保持寄存器表通过 Modbus/RTU 或 Modbus/TCP 读取数据。'
            })}
          </p>
        </div>
        <button className="btn-export-pdf">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 10V12H4V10H2V12C2 13.1 2.9 14 4 14H12C13.1 14 14 13.1 14 12V10H12ZM9 7H11L8 11L5 7H7V2H9V7Z" fill="white" />
          </svg>
          <span>{t({ en: 'Export PDF', de: 'PDF exportieren', cn: '导出 PDF' })}</span>
        </button>
      </header>

      <div className="holding-content">
        {/* Summary Box - RESTORED STYLE */}
        <div className="holding-summary-box">
          <div className="summary-column">
            <div className="summary-item">
              <label>{t({ en: 'Communication', de: 'Kommunikation', cn: '通讯方式' })}</label>
              <span>RS485</span>
            </div>
            <div className="summary-item">
              <label>{t({ en: 'Baud rate', de: 'Baudrate', cn: '波特率' })}</label>
              <span>19200</span>
            </div>
            <div className="summary-item">
              <label>{t({ en: 'Response delay', de: 'Antwortverzögerung', cn: '响应延迟' })}</label>
              <span>3</span>
            </div>
          </div>

          <div className="summary-column">
            <div className="summary-item">
              <label>{t({ en: 'Protocol', de: 'Protokoll', cn: '协议' })}</label>
              <span>Modbus</span>
            </div>
            <div className="summary-item">
              <label>{t({ en: 'Interframe spacing char', de: 'Frame-Abstand (Zeichen)', cn: '字符间距' })}</label>
              <span>7</span>
            </div>
            <div className="summary-item">
              <label>{t({ en: 'Response timeout(s)', de: 'Antwort-Timeout (s)', cn: '响应超时 (秒)' })}</label>
              <span>10</span>
            </div>
          </div>

          <div className="summary-column">
            <div className="summary-item">
              <label>{t({ en: 'Slave address', de: 'Slave-Adresse', cn: '从站地址' })}</label>
              <span>3</span>
            </div>
            <div className="summary-item">
              <label>{t({ en: 'Interframe spacing us', de: 'Frame-Abstand (µs)', cn: '帧间距 (微秒)' })}</label>
              <span>2005</span>
            </div>
            <div className="summary-item">
              <label>{t({ en: 'Return error value', de: 'Fehlerwert zurückgeben', cn: '返回错误值' })}</label>
              <span>-9999.0</span>
            </div>
          </div>
        </div>

        {/* Register Table - RESTORED ORIGINAL COLUMN STRUCTURE */}
        <div className="holding-table-container">
          <table className="holding-table">
            <thead>
              <tr>
                <th>{t({ en: 'Location', de: 'Ort', cn: '位置' })}</th>
                <th>{t({ en: 'Sensor Description', de: 'Sensorbeschreibung', cn: '传感器描述' })}</th>
                <th>{t({ en: 'Channel Description', de: 'Kanalbeschreibung', cn: '通道描述' })}</th>
                <th>{t({ en: 'Holding register', de: 'Holding-Register', cn: '保持寄存器' })}</th>
                <th>{t({ en: 'Data type', de: 'Datentyp', cn: '数据类型' })}</th>
                <th>{t({ en: 'No. of byte', de: 'Byte-Anzahl', cn: '字节数' })}</th>
                <th>{t({ en: 'Unit', de: 'Einheit', cn: '单位' })}</th>
                <th>{t({ en: 'Resolution', de: 'Auflösung', cn: '分辨率' })}</th>
                <th>{t({ en: 'Read/Write', de: 'Lesen/Schreiben', cn: '读/写' })}</th>
              </tr>
            </thead>
            <tbody>
              {allChannels.map((ch, idx) => (
                <tr key={idx}>
                  <td>{ch.location}</td>
                  <td>{ch.sensorDescription}</td>
                  <td>{ch.channelDescription}</td>
                  <td className="addr-font">{ch.address}</td>
                  <td>{getDataTypeName(ch.type)}</td>
                  <td>{getByteCount(ch.type)}</td>
                  <td>{ch.unit}</td>
                  <td>{getResolutionText(ch.resolution)}</td>
                  <td>{getRWText(ch.rw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HoldingRegister;
