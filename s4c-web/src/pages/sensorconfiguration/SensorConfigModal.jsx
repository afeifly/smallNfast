import React, { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import EditChannelModal from './EditChannelModal';
import CustomDialog from '../../components/CustomDialog';
import iconBtnEdit from '../../assets/images/icon_btn_edit.png';
import iconBtnDelete from '../../assets/images/icon_btn_delete.png';
import iconBtnClose from '../../assets/images/icon_btn_close.png';
import { isChannelUsedInLogger, remarshalAll } from '../../util/remarshalUtils';
import './SensorConfigModal.css';

// Dynamically import all .sutoch files from the sensordata directory as raw text
const sensorFiles = import.meta.glob('../../sensordata/*.sutoch', { query: '?raw', import: 'default', eager: true });

const SensorConfigModal = ({ isOpen, onClose, initialData, isSuto = true }) => {
  const { configData, setConfigData } = useConfig();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);

  // Dynamic data state
  const [sensorNames, setSensorNames] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState('');
  const [channels, setChannels] = useState([]);
  const [description, setDescription] = useState('');
  const [protocol, setProtocol] = useState(9); // 4 for RTU, 9 for TCP (ConnectType)
  const [address, setAddress] = useState(''); // Addr
  const [ipAddress, setIpAddress] = useState(''); // IpAddr
  const [port, setPort] = useState(''); // Port
  const [sn, setSn] = useState('');

  // Dialog state for CustomDialog
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    body: '',
    type: 'warn',
    onConfirm: null,
    showCancel: true
  });

  const closeDialog = () => setDialogState(prev => ({ ...prev, isOpen: false }));

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
      setProtocol(initialData.ConnectType || 9);
      setAddress(initialData.Addr || '');
      setIpAddress(initialData.IpAddr || '');
      setPort(initialData.Port || '0008');
      setSn(initialData.SN || '');
      // If the sensor data already has channels, use them; otherwise handleSensorSelect will load them from file
      if (initialData.cfgchannel && initialData.cfgchannel.length > 0) {
        setChannels(initialData.cfgchannel);
      }
    } else {
      // Add mode - reset fields
      setDescription('');
      setSelectedSensor('');
      setProtocol(9);
      setAddress('1');
      setIpAddress('192.168.1.1');
      setPort('0008');
      setSn('0000 0020');
      if (isSuto && names.length > 0) {
        handleSensorSelect(names[0]);
      } else {
        setChannels([]);
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
        const loadedChannels = (content.cfgchannel || []).map((ch, idx) => ({
          ...ch,
          CreateTime: ch.CreateTime || `${Date.now()}_${idx}`
        }));
        setChannels(loadedChannels);
        if (content.ConnectType) {
          setProtocol(content.ConnectType);
        }
        // Copy sensor name to description as requested
        setDescription(name);
      } catch (err) {
        console.error('Failed to parse .sutoch file:', path, err);
        setChannels([]);
      }
    }
  };

  const handleConfirm = () => {
    if (!configData) return;

    // Construct the updated sensor object
    const updatedSensor = {
      ...initialData,
      Name: isSuto ? selectedSensor : description,
      Description: description,
      Addr: address,
      IpAddr: ipAddress,
      Port: port,
      SN: sn,
      ConnectType: protocol,
      ConfigFileName: isSuto ? `${selectedSensor}.sutoch` : '',
      isSuto: initialData ? initialData.isSuto : isSuto,
      cfgchannel: channels.map((ch, idx) => ({
        ...ch,
        CreateTime: ch.CreateTime || `${Date.now()}_${idx}`
      }))
    };

    // Find the sensor list path
    const listPath = Object.keys(configData.configs).find(p => p.endsWith('SUTO-SensorList.sutolist'));
    if (!listPath) {
      console.error('Sensor list configuration not found');
      onClose();
      return;
    }

    const currentList = configData.configs[listPath];
    let updatedSensors = [...(currentList.cfgsensor || [])];

    // Address uniqueness check for Modbus/RTU
    if (protocol === 4) {
      const isDuplicate = updatedSensors.some(s => 
        s !== initialData && 
        String(s.Addr) === String(address) && 
        s.ConnectType === 4
      );
      if (isDuplicate) {
        setDialogState({
          isOpen: true,
          title: 'Duplicate Address',
          body: `The Modbus Address "${address}" is already in use by another sensor. Please use a unique address.`,
          type: 'err',
          showCancel: false,
          onConfirm: closeDialog
        });
        return;
      }
    }

    if (initialData) {
      // Update existing
      const index = updatedSensors.findIndex(s => s === initialData);
      if (index !== -1) {
        updatedSensors[index] = updatedSensor;
      }
    } else {
      // Add new
      updatedSensors.push(updatedSensor);
    }

    // Update global config
    const intermediateConfig = {
      ...configData,
      configs: {
        ...configData.configs,
        [listPath]: {
          ...currentList,
          cfgsensor: updatedSensors
        }
      }
    };

    const finalizedConfig = remarshalAll(intermediateConfig);
    setConfigData(finalizedConfig);
    onClose();
  };

  if (!isOpen) return null;

  const handleEditClick = (ch, index) => {
    setEditingChannel({
      ...ch,
      index // Track which channel we are editing
    });
    setIsEditModalOpen(true);
  };

  const toggleChannelVisibility = (index) => {
    setChannels(prev => {
      const updatedChannels = [...prev];
      updatedChannels[index] = {
        ...updatedChannels[index],
        Show: !updatedChannels[index].Show
      };
      return updatedChannels;
    });
  };

  const addChannel = () => {
    const newChannel = {
      ChannelDescription: 'New Channel',
      UnitInASCII: '---',
      Resolution: 0.1,
      Show: true,
      Address: '0',
      InDataType: 0,
      OutDataType: 0,
      FunctionCode: '3',
      ErrorValue: '0',
      CreateTime: `${Date.now()}_${Math.floor(Math.random() * 1000)}`
    };
    const newIndex = channels.length;
    setChannels(prev => [...prev, newChannel]);
    setEditingChannel({
      ...newChannel,
      index: newIndex
    });
    setIsEditModalOpen(true);
  };

  const deleteChannel = (index) => {
    const channel = channels[index];
    if (isChannelUsedInLogger(configData, channel)) {
      setDialogState({
        isOpen: true,
        title: 'Delete Restricted',
        body: `Cannot delete channel "${channel.ChannelDescription}". it is currently used in Logger settings. Please remove it from Logger settings first.`,
        type: 'err',
        showCancel: false,
        onConfirm: closeDialog
      });
      return;
    }

    setDialogState({
      isOpen: true,
      title: 'Delete Confirmation',
      body: `Are you sure you want to delete channel "${channel.ChannelDescription}"?`,
      type: 'warn',
      showCancel: true,
      onConfirm: () => {
        setChannels(prev => prev.filter((_, i) => i !== index));
        closeDialog();
      }
    });
  };

  const updateChannelData = (index, newData) => {
    setChannels(prev => {
      const updatedChannels = [...prev];
      updatedChannels[index] = {
        ...updatedChannels[index],
        ...newData
      };
      return updatedChannels;
    });
    setIsEditModalOpen(false);
  };

  return (
    <div className="modal-overlay">
      <div className="config-modal">
        {/* Header */}
        <header className="config-header">
          <div className="config-title">Channel configuration</div>
          <div className="close-btn" onClick={onClose}>
            <img src={iconBtnClose} alt="Close" style={{ width: 32, height: 32 }} />
          </div>
        </header>

        {/* Warning & Add Channel */}
        <div className="config-warning" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Please check and confirm that the unit matches the sensor</span>
          {!isSuto && (
            <button
              className="btn-add-channel"
              onClick={addChannel}
              style={{
                background: '#00AB84',
                color: 'white',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              + Add channel
            </button>
          )}
        </div>

        {/* Content */}
        <div className="config-content">
          {/* Left Form */}
          <div className="config-left">
            <div className="form-item">
              <label className="form-label">Protocol</label>
              <div className="form-control-wrapper">
                <select
                  className="form-select-hidden"
                  value={protocol}
                  onChange={(e) => setProtocol(Number(e.target.value))}
                >
                  <option value={4}>Modbus/RTU</option>
                  <option value={9}>Modbus/TCP</option>
                </select>
                <div className="form-control">
                  <span>{protocol === 4 ? 'Modbus/RTU' : 'Modbus/TCP'}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </div>
            </div>

            {isSuto && (
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
            )}

            <div className="form-item">
              <label className="form-label">Description</label>
              <input
                className="form-input"
                placeholder="20个字符"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {protocol === 4 ? (
              <div className="form-item">
                <label className="form-label">Address</label>
                <input
                  className="form-input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            ) : (
              <>
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
              </>
            )}

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
                        <div
                          className={`checkbox-custom ${ch.Show ? 'checked' : ''}`}
                          onClick={() => toggleChannelVisibility(idx)}
                        >
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
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="btn-icon-img"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => handleEditClick(ch, idx)}
                          >
                            <img src={iconBtnEdit} alt="Edit" style={{ width: 18, height: 18 }} />
                          </button>
                          <button
                            className="btn-icon-img"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => deleteChannel(idx)}
                          >
                            <img src={iconBtnDelete} alt="Delete" style={{ width: 18, height: 18 }} />
                          </button>
                        </div>
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
          <button className="btn-confirm" onClick={handleConfirm}>Confirm</button>
        </footer>

        {/* Nested Edit Channel Modal */}
        <EditChannelModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          channelData={editingChannel}
          onSave={(newData) => updateChannelData(editingChannel.index, newData)}
          isSuto={isSuto}
        />

        <CustomDialog
          isOpen={dialogState.isOpen}
          onClose={closeDialog}
          onConfirm={dialogState.onConfirm}
          title={dialogState.title}
          body={dialogState.body}
          type={dialogState.type}
          showCancel={dialogState.showCancel}
        />
      </div>
    </div>
  );
};

export default SensorConfigModal;
