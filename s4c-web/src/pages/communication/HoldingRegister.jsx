import React from 'react';
import './HoldingRegister.css';

const HoldingRegister = () => {
  // Sample data for the table
  const registers = [
    { point: 'Pressure', sensor: 'S335', channel: 'CH1', address: '0x0000', unit: 'bar', bytes: 4 },
    { point: 'Temperature', sensor: 'S335', channel: 'CH2', address: '0x0002', unit: '°C', bytes: 4 },
    { point: 'Humidity', sensor: 'S335', channel: 'CH3', address: '0x0004', unit: '%RH', bytes: 4 },
  ];

  return (
    <div className="content-card holding-register-page">
      {/* Header */}
      <header className="holding-header">
        <div className="holding-title-section">
          <h2 className="holding-title">S335 holding register table</h2>
          <p className="holding-subtitle">
            Use this holding register table to read data from the S335 via Modbus/RTU or Modbus/TCP.
          </p>
        </div>
        <button className="btn-export-pdf">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
             <path d="M12 10V12H4V10H2V12C2 13.1 2.9 14 4 14H12C13.1 14 14 13.1 14 12V10H12ZM9 7H11L8 11L5 7H7V2H9V7Z" fill="white"/>
          </svg>
          <span>Export PDF</span>
        </button>
      </header>

      <div className="holding-content">
        {/* Summary Box */}
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

        {/* Register Table */}
        <div className="holding-table-container">
          <table className="holding-table">
            <thead>
              <tr>
                <th>Measurement point</th>
                <th>Sensor</th>
                <th>Channel</th>
                <th>Address</th>
                <th>Unit</th>
                <th>No. of byte</th>
              </tr>
            </thead>
            <tbody>
              {registers.map((reg, idx) => (
                <tr key={idx}>
                  <td>{reg.point}</td>
                  <td>{reg.sensor}</td>
                  <td>{reg.channel}</td>
                  <td className="addr-font">{reg.address}</td>
                  <td>{reg.unit}</td>
                  <td>{reg.bytes}</td>
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
