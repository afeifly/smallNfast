import React, { useState, useEffect } from 'react';
import EditChannelModal from './EditChannelModal';
import iconBtnEdit from '../../assets/images/icon_btn_edit.png';
import './SensorConfigModal.css';

// Dynamically import all .sutoch files from the sensordata directory as raw text
const sensorFiles = import.meta.glob('../../sensordata/*.sutoch', { query: '?raw', import: 'default', eager: true });

const SensorConfigModal = ({ isOpen, onClose, initialData }) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  
  // Dynamic data state
  const [sensorNames, setSensorNames] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState('');
  const [channels, setChannels] = useState([]);
  const [description, setDescription] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState('');
  const [sn, setSn] = useState('');

  useEffect(() => {
    // Process sensor names from the globbed files
    const names = Object.keys(sensorFiles).map(path => {
      const fileName = path.split('/').pop().split('?')[0];
      return fileName.replace('.sutoch', '');
    });
    setSensorNames(names);
    
    if (initialData) {
      // Edit mode
      const configName = initialData.ConfigFileName ? initialData.ConfigFileName.replace('.sutoch', '') : (initialData.Name || '');
      handleSensorSelect(configName);
      setDescription(initialData.Description || '');
      setIpAddress(initialData.Address || '');
      setPort(initialData.Port || '0008');
      setSn(initialData.SerialNumber || '');
      // If the sensor data already has channels, use them; otherwise handleSensorSelect will load them from file
      if (initialData.cfgchannel && initialData.cfgchannel.length > 0) {
        setChannels(initialData.cfgchannel);
      }
    } else {
      // Add mode - reset fields and set first sensor as default
      setDescription('');
      setIpAddress('0000 0000');
      setPort('0008');
      setSn('0000 0020');
      if (names.length > 0) {
        handleSensorSelect(names[0]);
      }
    }
  }, [initialData, isOpen]);

  const handleSensorSelect = (name) => {
    setSelectedSensor(name);
    // Find the corresponding file content (matching the key which includes ?raw)
    const path = Object.keys(sensorFiles).find(p => p.includes(`${name}.sutoch`));
    if (path && sensorFiles[path]) {
      try {
        const content = JSON.parse(sensorFiles[path]);
        setChannels(content.cfgchannel || []);
      } catch (err) {
        console.error('Failed to parse .sutoch file:', path, err);
        setChannels([]);
      }
    }
  };

  if (!isOpen) return null;

  const handleEditClick = (ch) => {
    setEditingChannel({
      name: ch.ChannelDescription,
      unit: ch.UnitInASCII,
      resolution: ch.Resolution
    });
    setIsEditModalOpen(true);
  };

  return (
    <div className="modal-overlay">
      <div className="config-modal">
        {/* Header */}
        <header className="config-header">
          <div className="config-title">Channel configuration</div>
          <div className="close-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </div>
        </header>

        {/* Warning */}
        <div className="config-warning">
          Please check and confirm that the unit matches the sensor
        </div>

        {/* Content */}
        <div className="config-content">
          {/* Left Form */}
          <div className="config-left">
            <div className="form-item">
              <label className="form-label">Protocol</label>
              <div className="form-control">
                <span>Modbus/TCP</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>

            <div className="form-item">
              <label className="form-label">Sensor</label>
              <div className="form-control-wrapper">
                <select 
                  className="form-select-hidden" 
                  value={selectedSensor}
                  onChange={(e) => handleSensorSelect(e.target.value)}
                >
                  {sensorNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <div className="form-control">
                  <span>{selectedSensor || 'Select Sensor'}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="form-item">
              <label className="form-label">Description</label>
              <input 
                className="form-input" 
                placeholder="20个字符" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-item">
              <label className="form-label">IP Address</label>
              <input 
                className="form-input" 
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
              />
            </div>

            <div className="form-item">
              <label className="form-label">Port</label>
              <input 
                className="form-input" 
                value={port}
                onChange={(e) => setPort(e.target.value)}
              />
            </div>

            <div className="form-item">
              <label className="form-label">S/N</label>
              <input 
                className="form-input" 
                value={sn}
                onChange={(e) => setSn(e.target.value)}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="config-divider" />

          {/* Right Table */}
          <div className="config-right">
            <div className="config-table-container">
              <table className="config-table">
                <thead>
                  <tr>
                    <th className="checkbox-cell">
                      <div className="checkbox-custom indeterminate" />
                    </th>
                    <th className="col-channel">Channel</th>
                    <th className="col-unit">Unit</th>
                    <th className="col-resolution">Resolution</th>
                    <th className="col-operate">Operate</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((ch, idx) => (
                    <tr key={idx}>
                      <td className="checkbox-cell">
                        <div className={`checkbox-custom ${ch.Show ? 'checked' : ''}`}>
                          {ch.Show && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      </td>
                      <td>{ch.ChannelDescription}</td>
                      <td>{ch.UnitInASCII}</td>
                      <td>{ch.Resolution}</td>
                      <td>
                        <button 
                          className="btn-icon-img" 
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => handleEditClick(ch)}
                        >
                          <img src={iconBtnEdit} alt="Edit" style={{ width: 18, height: 18 }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="config-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-confirm" onClick={onClose}>Confirm</button>
        </footer>

        {/* Nested Edit Channel Modal */}
        <EditChannelModal 
          isOpen={isEditModalOpen} 
          onClose={() => setIsEditModalOpen(false)}
          channelData={editingChannel}
        />
      </div>
    </div>
  );
};

export default SensorConfigModal;
