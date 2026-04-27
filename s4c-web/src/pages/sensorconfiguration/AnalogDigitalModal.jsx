import React, { useState, useEffect } from 'react';
import iconBtnClose from '../../assets/images/icon_btn_close.png';
import './AnalogDigitalModal.css';

const AnalogDigitalModal = ({ isOpen, onClose, initialData, onSave }) => {
  const [inputModule, setInputModule] = useState('');
  const [terminal, setTerminal] = useState('');
  const [sensorDescription, setSensorDescription] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [signal, setSignal] = useState('');
  const [unitType, setUnitType] = useState('');
  const [unit, setUnit] = useState('');
  const [resolution, setResolution] = useState('1');
  const [displayScale4mA, setDisplayScale4mA] = useState('');

  useEffect(() => {
    if (initialData) {
      setInputModule(initialData.Module || '');
      setTerminal(initialData.Terminal || '');
      setSensorDescription(initialData.Sensor || '');
      setChannelDescription(initialData.Channel || '');
      setSignal(initialData.Signal || '');
      setUnitType(initialData.UnitType || '');
      setUnit(initialData.Unit || '');
      setResolution(initialData.Resolution?.toString() || '1');
      setDisplayScale4mA(initialData.DisplayScale4mA || '');
    } else {
      // Reset for new item
      setInputModule('');
      setTerminal('');
      setSensorDescription('');
      setChannelDescription('');
      setSignal('');
      setUnitType('');
      setUnit('');
      setResolution('1');
      setDisplayScale4mA('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onSave({
      Module: inputModule,
      Terminal: terminal,
      Sensor: sensorDescription,
      Channel: channelDescription,
      Signal: signal,
      UnitType: unitType,
      Unit: unit,
      Resolution: Number(resolution),
      DisplayScale4mA: displayScale4mA
    });
  };

  return (
    <div className="edit-channel-modal-overlay">
      <div className="edit-channel-modal" style={{ width: '560px' }}>
        {/* Header */}
        <header className="edit-channel-header">
          <div className="edit-channel-title">Add analog & digital input</div>
          <div className="edit-channel-close" onClick={onClose}>
            <img src={iconBtnClose} alt="Close" style={{ width: 32, height: 32 }} />
          </div>
        </header>

        <div className="edit-channel-body">
          <div className="edit-form-item">
            <label className="edit-form-label">Input module</label>
            <div className="edit-form-input-wrapper">
              <select 
                className="edit-form-input"
                style={{ appearance: 'auto', paddingRight: '10px' }}
                value={inputModule}
                onChange={(e) => setInputModule(e.target.value)}
              >
                <option value="">Select Module</option>
                <option value="Module A">Module A</option>
                <option value="Module B">Module B</option>
              </select>
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">Terminal</label>
            <div className="edit-form-input-wrapper">
              <select 
                className="edit-form-input"
                style={{ appearance: 'auto', paddingRight: '10px' }}
                value={terminal}
                onChange={(e) => setTerminal(e.target.value)}
              >
                <option value="">Select Terminal</option>
                <option value="T1">T1</option>
                <option value="T2">T2</option>
              </select>
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">Sensor description</label>
            <div className="edit-form-input-wrapper">
              <input 
                className="edit-form-input" 
                value={sensorDescription}
                onChange={(e) => setSensorDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">Channel description</label>
            <div className="edit-form-input-wrapper">
              <input 
                className="edit-form-input" 
                value={channelDescription}
                onChange={(e) => setChannelDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">Signal</label>
            <div className="edit-form-input-wrapper">
              <select 
                className="edit-form-input"
                style={{ appearance: 'auto', paddingRight: '10px' }}
                value={signal}
                onChange={(e) => setSignal(e.target.value)}
              >
                <option value="">Select Signal</option>
                <option value="4-20mA">4-20mA</option>
                <option value="0-10V">0-10V</option>
                <option value="Pulse">Pulse</option>
              </select>
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">Unit type</label>
            <div className="edit-form-input-wrapper">
              <select 
                className="edit-form-input"
                style={{ appearance: 'auto', paddingRight: '10px' }}
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
              >
                <option value="">Select Type</option>
                <option value="Flow">Flow</option>
                <option value="Pressure">Pressure</option>
              </select>
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">Unit</label>
            <div className="edit-form-input-wrapper">
              <select 
                className="edit-form-input"
                style={{ appearance: 'auto', paddingRight: '10px' }}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                <option value="">Select Unit</option>
                <option value="m3/h">m3/h</option>
                <option value="bar">bar</option>
              </select>
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">Resolution</label>
            <div className="edit-form-input-wrapper">
              <select 
                className="edit-form-input"
                style={{ appearance: 'auto', paddingRight: '10px' }}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              >
                <option value="0">1</option>
                <option value="1">0.1</option>
                <option value="2">0.01</option>
                <option value="3">0.001</option>
                <option value="4">0.0001</option>
                <option value="5">0.00001</option>
                <option value="6">0.000001</option>
              </select>
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">Display scale 4mA</label>
            <div className="edit-form-input-wrapper">
              <input 
                className="edit-form-input" 
                value={displayScale4mA}
                onChange={(e) => setDisplayScale4mA(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="edit-channel-footer">
          <button className="btn-edit-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-edit-confirm" onClick={handleConfirm}>Confirm</button>
        </footer>
      </div>
    </div>
  );
};

export default AnalogDigitalModal;
