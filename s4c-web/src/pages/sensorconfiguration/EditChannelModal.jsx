import React, { useState, useEffect } from 'react';
import './EditChannelModal.css';

const EditChannelModal = ({ isOpen, onClose, channelData, onSave, isSuto }) => {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [resolution, setResolution] = useState('1'); // Default index 1 (0.1)
  const [address, setAddress] = useState('');
  const [inputValueType, setInputValueType] = useState('8'); // Default FLOAT_L
  const [outputValueType, setOutputValueType] = useState('8'); // Default FLOAT_L
  const [functionCode, setFunctionCode] = useState('');
  const [errorValue, setErrorValue] = useState('');

  useEffect(() => {
    if (channelData) {
      setName(channelData.ChannelDescription || '');
      setUnit(channelData.UnitInASCII || '');
      setResolution(channelData.Resolution?.toString() || '1');
      setAddress(channelData.Address?.toString() || '');
      setInputValueType(channelData.InDataType?.toString() || '8');
      setOutputValueType(channelData.OutDataType?.toString() || '8');
      setFunctionCode(channelData.FunctionCode?.toString() || '');
      setErrorValue(channelData.ErrorValue?.toString() || '');
    }
  }, [channelData, isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onSave({
      ChannelDescription: name,
      UnitInASCII: unit,
      Resolution: Number(resolution),
      Address: address,
      InDataType: Number(inputValueType),
      OutDataType: Number(outputValueType),
      FunctionCode: functionCode,
      ErrorValue: errorValue
    });
  };

  return (
    <div className="edit-channel-modal-overlay">
      <div className="edit-channel-modal">
        {/* Header */}
        <header className="edit-channel-header">
          <div className="edit-channel-title">{isSuto ? 'Edit SUTO channel' : 'Edit channel'}</div>
          <div className="edit-channel-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </div>
        </header>

        <div className="edit-channel-body">
          <div className="edit-form-item">
            <label className="edit-form-label">Channel Description</label>
            <div className="edit-form-input-wrapper">
              <input 
                className="edit-form-input" 
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">Unit</label>
            <div className="edit-form-input-wrapper">
              <input 
                className="edit-form-input" 
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
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

          <div className={`edit-form-item ${isSuto ? 'disabled' : ''}`}>
            <label className="edit-form-label">Address</label>
            <div className="edit-form-input-wrapper">
              <input 
                className="edit-form-input" 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={isSuto}
              />
            </div>
          </div>

          <div className={`edit-form-item ${isSuto ? 'disabled' : ''}`}>
            <label className="edit-form-label">Input value type</label>
            <div className="edit-form-input-wrapper">
              <select 
                className="edit-form-input"
                style={{ appearance: 'auto', paddingRight: '10px' }}
                value={inputValueType}
                onChange={(e) => setInputValueType(e.target.value)}
                disabled={isSuto}
              >
                <option value="1">INT 16</option>
                <option value="2">UINT 16</option>
                <option value="3">INT 32_B</option>
                <option value="4">INT 32_L</option>
                <option value="5">UNIT 32_B</option>
                <option value="6">UNIT 32_L</option>
                <option value="7">FLOAT_B</option>
                <option value="8">FLOAT_L</option>
              </select>
            </div>
          </div>

          <div className={`edit-form-item ${isSuto ? 'disabled' : ''}`}>
            <label className="edit-form-label">Output value type</label>
            <div className="edit-form-input-wrapper">
              <select 
                className="edit-form-input"
                style={{ appearance: 'auto', paddingRight: '10px' }}
                value={outputValueType}
                onChange={(e) => setOutputValueType(e.target.value)}
                disabled={isSuto}
              >
                <option value="1">INT 16</option>
                <option value="2">UINT 16</option>
                <option value="3">INT 32_B</option>
                <option value="4">INT 32_L</option>
                <option value="5">UNIT 32_B</option>
                <option value="6">UNIT 32_L</option>
                <option value="7">FLOAT_B</option>
                <option value="8">FLOAT_L</option>
              </select>
            </div>
          </div>

          <div className={`edit-form-item ${isSuto ? 'disabled' : ''}`}>
            <label className="edit-form-label">Function Code</label>
            <div className="edit-form-input-wrapper">
              <input 
                className="edit-form-input" 
                value={functionCode}
                onChange={(e) => setFunctionCode(e.target.value)}
                disabled={isSuto}
              />
            </div>
          </div>

          <div className={`edit-form-item ${isSuto ? 'disabled' : ''}`}>
            <label className="edit-form-label">Error Value</label>
            <div className="edit-form-input-wrapper">
              <input 
                className="edit-form-input" 
                value={errorValue}
                onChange={(e) => setErrorValue(e.target.value)}
                disabled={isSuto}
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

export default EditChannelModal;
