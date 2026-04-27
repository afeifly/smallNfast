import React, { useState } from 'react';
import iconBtnClose from '../../assets/images/icon_btn_close.png';
import './ModbusRTUModal.css';

const ModbusRTUModal = ({ isOpen, onClose, onSave, initialData }) => {
  const [baudRate, setBaudRate] = useState(initialData?.baudRate || '19200');
  const [parity, setParity] = useState(initialData?.parity || '8,N,1');
  const [timeout, setTimeout] = useState(initialData?.timeout || '10');

  if (!isOpen) return null;

  return (
    <div className="modbus-modal-overlay">
      <div className="modbus-modal">
        {/* Header */}
        <header className="modbus-header">
          <div className="modbus-title">Modbus connection information</div>
          <div className="modbus-close" onClick={onClose}>
            <img src={iconBtnClose} alt="Close" style={{ width: 32, height: 32 }} />
          </div>
        </header>

        {/* Content Body */}
        <div className="modbus-body">
          <div className="modbus-row">
            {/* Protocol */}
            <div className="modbus-field">
              <label className="modbus-label">Protocol <span className="required">*</span></label>
              <div className="modbus-input-readonly">
                <span>RTU</span>
              </div>
            </div>

            {/* Baud rate */}
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
          </div>

          <div className="modbus-row">
            {/* Frame parity */}
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

            {/* Response timeout */}
            <div className="modbus-field">
              <label className="modbus-label">Response timeout(s) <span className="required">*</span></label>
              <div className="modbus-input-container">
                <input 
                  type="number"
                  className="modbus-input"
                  value={timeout}
                  onChange={(e) => setTimeout(e.target.value)}
                  min="1"
                  max="25"
                />
                <span className="modbus-range-hint">(1~25)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="modbus-footer">
          <button className="btn-modbus-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-modbus-save" onClick={() => onSave({ baudRate, parity, timeout })}>Save</button>
        </footer>
      </div>
    </div>
  );
};

export default ModbusRTUModal;
