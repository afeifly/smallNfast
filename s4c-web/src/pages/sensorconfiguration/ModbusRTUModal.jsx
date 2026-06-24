import React, { useState } from 'react';
import iconBtnClose from '../../assets/images/icon_btn_close.png';
import { useLanguage } from '../../context/LanguageContext';
import './ModbusRTUModal.css';

const ModbusRTUModal = ({ isOpen, onClose, onSave, initialData }) => {
  const [baudRate, setBaudRate] = useState(initialData?.baudRate || '19200');
  const [parity, setParity] = useState(initialData?.parity || '8,N,1');
  const [timeout, setTimeout] = useState(initialData?.timeout || '10');
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="modbus-modal-overlay">
      <div className="modbus-modal">
        {/* Header */}
        <header className="modbus-header">
          <div className="modbus-title">{t({ en: 'Modbus connection information', de: 'Modbus-Verbindungsinformationen', cn: 'Modbus 连接信息' })}</div>
          <div className="modbus-close" onClick={onClose}>
            <img src={iconBtnClose} alt={t({ en: 'Close', de: 'Schließen', cn: '关闭' })} style={{ width: 32, height: 32 }} />
          </div>
        </header>

        {/* Content Body */}
        <div className="modbus-body">
          <div className="modbus-row">
            {/* Protocol */}
            <div className="modbus-field">
              <label className="modbus-label">{t({ en: 'Protocol', de: 'Protokoll', cn: '协议' })} <span className="required">*</span></label>
              <div className="modbus-input-readonly">
                <span>RTU</span>
              </div>
            </div>

            {/* Baud rate */}
            <div className="modbus-field">
              <label className="modbus-label">{t({ en: 'Baud rate', de: 'Baudrate', cn: '波特率' })} <span className="required">*</span></label>
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
              <label className="modbus-label">{t({ en: 'Frame parity', de: 'Frame-Parität', cn: '帧校验' })} <span className="required">*</span></label>
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
              <label className="modbus-label">{t({ en: 'Response timeout(s)', de: 'Antwort-Timeout (s)', cn: '响应超时 (秒)' })} <span className="required">*</span></label>
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
          <button className="btn-modbus-cancel" onClick={onClose}>{t({ en: 'Cancel', de: 'Abbrechen', cn: '取消' })}</button>
          <button className="btn-modbus-save" onClick={() => onSave({ baudRate, parity, timeout })}>{t({ en: 'Save', de: 'Speichern', cn: '保存' })}</button>
        </footer>
      </div>
    </div>
  );
};

export default ModbusRTUModal;
