import React, { useState } from 'react';
import './ModbusRTU.css';

const ModbusRTUSlave = () => {
  const [address, setAddress] = useState('3');
  const [baudRate, setBaudRate] = useState('19200');
  const [parity, setParity] = useState('8,N,1');

  const handleSave = () => {
    console.log('Saving Modbus RTU Slave data:', { address, baudRate, parity });
    // TODO: Persist to config
  };

  const handleCancel = () => {
    setAddress('3');
    setBaudRate('19200');
    setParity('8,N,1');
  };

  return (
    <div className="content-card modbus-rtu-page">
      <header className="modbus-header">
        <h2 className="modbus-title">Modbus RTU slave information</h2>
      </header>

      <div className="modbus-body">
        <div className="modbus-row">
          <div className="modbus-field">
            <label className="modbus-label">Protocol <span className="required">*</span></label>
            <div className="modbus-input-readonly">
              <span>RTU</span>
            </div>
          </div>

          <div className="modbus-field">
            <label className="modbus-label">Slave address <span className="required">*</span></label>
            <div className="modbus-input-container">
              <input 
                type="number"
                className="modbus-input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                min="1"
                max="247"
              />
              <span className="modbus-range-hint">(1~247)</span>
            </div>
          </div>
        </div>

        <div className="modbus-row">
          <div className="modbus-field">
            <label className="modbus-label">Baud rate <span className="required">*</span></label>
            <div className="modbus-select-wrapper">
              <select 
                className="modbus-select"
                value={baudRate}
                onChange={(e) => setBaudRate(e.target.value)}
              >
                <option value="9600">9600</option>
                <option value="19200">19200</option>
                <option value="38400">38400</option>
                <option value="57600">57600</option>
                <option value="115200">115200</option>
              </select>
            </div>
          </div>

          <div className="modbus-field">
            <label className="modbus-label">Frame parity <span className="required">*</span></label>
            <div className="modbus-select-wrapper">
              <select 
                className="modbus-select"
                value={parity}
                onChange={(e) => setParity(e.target.value)}
              >
                <option value="8,N,1">8,N,1</option>
                <option value="8,E,1">8,E,1</option>
                <option value="8,O,1">8,O,1</option>
                <option value="8,N,2">8,N,2</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <footer className="modbus-footer">
        <button className="btn-modbus-cancel" onClick={handleCancel}>Cancel</button>
        <button className="btn-modbus-save" onClick={handleSave}>Save</button>
      </footer>
    </div>
  );
};

export default ModbusRTUSlave;
