import React from 'react';
import { useConfig } from '../../context/ConfigContext';
import './HoldingRegister.css';

const HoldingRegister = () => {
  const { configData } = useConfig();

  // Extract configuration
  const configPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('SUTO-SensorList.sutolist'));
  const currentConfig = configData?.configs?.[configPath];
  const locationConfigPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgLocation.json'));
  const locationsArray = configData?.configs?.[locationConfigPath]?.Locations || [];

  // Extract all channels from all sensors
  const allChannels = [];
  (currentConfig?.cfgsensor || []).forEach(sensor => {
    (sensor.cfgchannel || []).forEach((ch) => {
      // Find location and meapoint for this channel
      let locationText = '---';
      const createTimeStr = String(ch.CreateTime);
      
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

      allChannels.push({
        location: locationText,
        sensorDescription: sensor.Description || sensor.Name || '---',
        channelDescription: ch.ChannelDescription || '---',
        address: ch.channelid,
        type: ch.ValueType || 8,
        unit: ch.UnitInASCII,
        resolution: ch.Resolution,
        rw: ch.rw || 0
      });
    });
  });

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
    return types[type] || 'Unknown';
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
          <h2 className="holding-title">Holding register table</h2>
          <p className="holding-subtitle">
            Use this holding register table to read data via Modbus/RTU or Modbus/TCP.
          </p>
        </div>
        <button className="btn-export-pdf">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 10V12H4V10H2V12C2 13.1 2.9 14 4 14H12C13.1 14 14 13.1 14 12V10H12ZM9 7H11L8 11L5 7H7V2H9V7Z" fill="white" />
          </svg>
          <span>Export PDF</span>
        </button>
      </header>

      <div className="holding-content">
        {/* Summary Box - RESTORED STYLE */}
        <div className="holding-summary-box">
          <div className="summary-column">
            <div className="summary-item">
              <label>Communication</label>
              <span>RS485</span>
            </div>
            <div className="summary-item">
              <label>Baud rate</label>
              <span>19200</span>
            </div>
            <div className="summary-item">
              <label>Response delay</label>
              <span>3</span>
            </div>
          </div>

          <div className="summary-column">
            <div className="summary-item">
              <label>Protocol</label>
              <span>Modbus</span>
            </div>
            <div className="summary-item">
              <label>Interframe spacing char</label>
              <span>7</span>
            </div>
            <div className="summary-item">
              <label>Response timeout(s)</label>
              <span>10</span>
            </div>
          </div>

          <div className="summary-column">
            <div className="summary-item">
              <label>Slave address</label>
              <span>3</span>
            </div>
            <div className="summary-item">
              <label>Interframe spacing us</label>
              <span>2005</span>
            </div>
            <div className="summary-item">
              <label>Return error value</label>
              <span>-9999.0</span>
            </div>
          </div>
        </div>

        {/* Register Table - RESTORED ORIGINAL COLUMN STRUCTURE */}
        <div className="holding-table-container">
          <table className="holding-table">
            <thead>
              <tr>
                <th>Location</th>
                <th>Sensor Description</th>
                <th>Channel Description</th>
                <th>Holding register</th>
                <th>Data type</th>
                <th>No. of byte</th>
                <th>Unit</th>
                <th>Resolution</th>
                <th>Read/Write</th>
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
