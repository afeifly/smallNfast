import React, { useState, useEffect } from 'react';
import iconBtnClose from '../../assets/images/icon_btn_close.png';
import './AnalogDigitalModal.css';

const AnalogDigitalModal = ({ isOpen, onClose, initialData, onSave }) => {
  const [optionBoardType, setOptionBoardType] = useState(0); // 0: Analog, 1: Digital
  const [terminalNo, setTerminalNo] = useState(1);
  const [sensorDescription, setSensorDescription] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [analogSignalType, setAnalogSignalType] = useState(0);
  const [uintType, setUintType] = useState(0);
  const [preDefineUnit, setPreDefineUnit] = useState('');
  const [resolution, setResolution] = useState(1);
  const [minScale, setMinScale] = useState(0);
  const [maxScale, setMaxScale] = useState(10);
  const [digitalType, setDigitalType] = useState(0);

  useEffect(() => {
    if (initialData) {
      setOptionBoardType(initialData.OptionBoardType ?? 0);
      setTerminalNo(initialData.TerminalNo ?? 1);
      setSensorDescription(initialData.SensorDescription || '');
      setChannelDescription(initialData.ChannelDescription || '');
      setAnalogSignalType(initialData.AnalogSignalType ?? 0);
      setUintType(initialData.UintType ?? 0);
      setPreDefineUnit(initialData.PreDefineUnit || '');
      setResolution(initialData.Resolution ?? 1);
      setMinScale(initialData.MinScale ?? 0);
      setMaxScale(initialData.MaxScale ?? 10);
      setDigitalType(initialData.DigitalType ?? 0);
    } else {
      // Reset for new item
      setOptionBoardType(0);
      setTerminalNo(1);
      setSensorDescription('');
      setChannelDescription('');
      setAnalogSignalType(0);
      setUintType(0);
      setPreDefineUnit('');
      setResolution(1);
      setMinScale(0);
      setMaxScale(10);
      setDigitalType(0);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onSave({
      ...initialData,
      OptionBoardType: Number(optionBoardType),
      TerminalNo: Number(terminalNo),
      SensorDescription: sensorDescription,
      ChannelDescription: channelDescription,
      AnalogSignalType: Number(analogSignalType),
      UintType: Number(uintType),
      PreDefineUnit: preDefineUnit,
      Resolution: Number(resolution),
      MinScale: Number(minScale),
      MaxScale: Number(maxScale),
      DigitalType: Number(digitalType),
      shown: true,
      ChannelId: 2000 + Number(terminalNo)
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
                value={optionBoardType}
                onChange={(e) => setOptionBoardType(e.target.value)}
              >
                <option value={0}>Analog</option>
                <option value={1}>Digital</option>
              </select>
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">Terminal</label>
            <div className="edit-form-input-wrapper">
              <select 
                className="edit-form-input"
                style={{ appearance: 'auto', paddingRight: '10px' }}
                value={terminalNo}
                onChange={(e) => setTerminalNo(e.target.value)}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(no => (
                  <option key={no} value={no}>T{no}</option>
                ))}
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
                value={optionBoardType === 0 ? analogSignalType : digitalType}
                onChange={(e) => optionBoardType === 0 ? setAnalogSignalType(e.target.value) : setDigitalType(e.target.value)}
              >
                {optionBoardType === 0 ? (
                  <>
                    <option value={0}>4-20mA</option>
                    <option value={1}>0-20mA</option>
                    <option value={2}>0-1V</option>
                    <option value={3}>0-10V</option>
                  </>
                ) : (
                  <>
                    <option value={0}>Pulse</option>
                    <option value={1}>State</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">Unit type</label>
            <div className="edit-form-input-wrapper">
              <select 
                className="edit-form-input"
                style={{ appearance: 'auto', paddingRight: '10px' }}
                value={uintType}
                onChange={(e) => setUintType(e.target.value)}
              >
                <option value={0}>Flow</option>
                <option value={10}>Voltage</option>
                <option value={1}>Pressure</option>
              </select>
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">Unit</label>
            <div className="edit-form-input-wrapper">
              <input 
                className="edit-form-input" 
                value={preDefineUnit}
                onChange={(e) => setPreDefineUnit(e.target.value)}
                placeholder="e.g. V, A, m3/h"
              />
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
            <label className="edit-form-label">Scale Min</label>
            <div className="edit-form-input-wrapper">
              <input 
                type="number"
                className="edit-form-input" 
                value={minScale}
                onChange={(e) => setMinScale(e.target.value)}
              />
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">Scale Max</label>
            <div className="edit-form-input-wrapper">
              <input 
                type="number"
                className="edit-form-input" 
                value={maxScale}
                onChange={(e) => setMaxScale(e.target.value)}
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
