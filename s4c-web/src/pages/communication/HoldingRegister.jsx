import React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import exportPdfIcon from '../../assets/images/export_pdf_icon.png';
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
    return types[type] || t('Unknown');
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
          <h2 className="holding-title">{t('Holding register table')}</h2>
          <p className="holding-subtitle">
            {t('Use this holding register table to read data via Modbus/RTU or Modbus/TCP.')}
          </p>
        </div>
        <button className="btn-export-pdf">
          <img src={exportPdfIcon} alt={t('Export PDF')} style={{ width: 16, height: 16 }} />
          <span>{t('Export PDF')}</span>
        </button>
      </header>

      <div className="holding-content">
        {/* Summary Box - RESTORED STYLE */}
        <div className="holding-summary-box">
          <div className="summary-column">
            <div className="summary-item">
              <label>{t('Communication')}</label>
              <span>RS485</span>
            </div>
            <div className="summary-item">
              <label>{t('Baud rate')}</label>
              <span>19200</span>
            </div>
            <div className="summary-item">
              <label>{t('Response delay')}</label>
              <span>3</span>
            </div>
          </div>

          <div className="summary-column">
            <div className="summary-item">
              <label>{t('Protocol')}</label>
              <span>Modbus</span>
            </div>
            <div className="summary-item">
              <label>{t('Interframe spacing char')}</label>
              <span>7</span>
            </div>
            <div className="summary-item">
              <label>{t('Response timeout(s)')}</label>
              <span>10</span>
            </div>
          </div>

          <div className="summary-column">
            <div className="summary-item">
              <label>{t('Slave address')}</label>
              <span>3</span>
            </div>
            <div className="summary-item">
              <label>{t('Interframe spacing us')}</label>
              <span>2005</span>
            </div>
            <div className="summary-item">
              <label>{t('Return error value')}</label>
              <span>-9999.0</span>
            </div>
          </div>
        </div>

        {/* Register Table - RESTORED ORIGINAL COLUMN STRUCTURE */}
        <div className="holding-table-container">
          <table className="holding-table">
            <thead>
              <tr>
                <th>{t('Location')}</th>
                <th>{t('Sensor Description')}</th>
                <th>{t('Channel Description')}</th>
                <th>{t('Holding register')}</th>
                <th>{t('Data type')}</th>
                <th>{t('No. of byte')}</th>
                <th>{t('Unit')}</th>
                <th>{t('Resolution')}</th>
                <th>{t('Read/Write')}</th>
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
