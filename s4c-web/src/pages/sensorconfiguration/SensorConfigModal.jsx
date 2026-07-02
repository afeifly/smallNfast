import React, { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import EditChannelModal from './EditChannelModal';
import CustomDialog from '../../components/CustomDialog';
import iconBtnEdit from '../../assets/images/icon_btn_edit.png';
import iconBtnDelete from '../../assets/images/icon_btn_delete.png';
import iconBtnClose from '../../assets/images/icon_btn_close.png';
import { isChannelUsedInLogger, isChannelUsedInAlarm, isChannelUsedInLayout, remarshalAll } from '../../util/remarshalUtils';
import './SensorConfigModal.css';

// Dynamically import all .sutoch files from the sensordata directory as raw text
const sensorFiles = import.meta.glob('../../sensordata/*.sutoch', { query: '?raw', import: 'default', eager: true });

const formatSN = (value) => {
  if (!value) return '';
  const clean = String(value).replace(/\s+/g, '');
  if (clean.length > 4) {
    return `${clean.slice(0, 4)} ${clean.slice(4)}`;
  }
  return clean;
};

const SensorConfigModal = ({ isOpen, onClose, initialData, isSuto = true }) => {
  const { configData, setConfigData } = useConfig();
  const { t } = useLanguage();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);

  // Dynamic data state
  const [sensorNames, setSensorNames] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState('');
  const [channels, setChannels] = useState([]);
  const [description, setDescription] = useState('');
  const [protocol, setProtocol] = useState(4); // 4 for RTU, 9 for TCP (ConnectType)
  const [address, setAddress] = useState(''); // Addr
  const [ipAddress, setIpAddress] = useState(''); // IpAddr
  const [port, setPort] = useState(''); // Port
  const [sn, setSn] = useState('');
  const [selectedSensorTemplate, setSelectedSensorTemplate] = useState(null);

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
      setAddress(initialData.Addr !== undefined ? String(initialData.Addr) : '1');
      setIpAddress(initialData.IpAddr || '');
      setPort(initialData.Port !== undefined ? String(initialData.Port) : '502');
      setSn(formatSN(initialData.SN || ''));
      // If the sensor data already has channels, use them; otherwise handleSensorSelect will load them from file
      if (initialData.cfgchannel && initialData.cfgchannel.length > 0) {
        setChannels(initialData.cfgchannel);
      }
    } else {
      // Add mode - reset fields
      setDescription('');
      setSelectedSensor('');
      setSelectedSensorTemplate(null);
      setProtocol(4);
      setAddress('1');
      setIpAddress('192.168.1.1');
      setPort('502');
      setSn(formatSN('00000000'));
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
        setSelectedSensorTemplate(content);
        const loadedChannels = (content.cfgchannel || []).map((ch, idx) => ({
          ...ch,
          CreateTime: ch.CreateTime || String(Date.now() + idx)
        }));
        setChannels(loadedChannels);
        if (content.ConnectType) {
          setProtocol(content.ConnectType);
        }
        if (content.Addr !== undefined) {
          setAddress(String(content.Addr));
        }
        if (content.Port !== undefined) {
          setPort(String(content.Port));
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

    // Find the sensor list path
    const listPath = Object.keys(configData.configs).find(p => p.endsWith('SUTO-SensorList.sutolist'));
    if (!listPath) {
      console.error('Sensor list configuration not found');
      onClose();
      return;
    }

    const currentList = configData.configs[listPath];
    let updatedSensors = [...(currentList.cfgsensor || [])];

    const cleanSn = sn ? sn.replace(/\s+/g, '') : '';

    // Determine the base template or object to inherit properties from
    const templateObj = isSuto ? { ...selectedSensorTemplate } : {};
    delete templateObj.SN;

    const baseObj = {
      Index: 0,
      SensorID: 0,
      Name: isSuto ? selectedSensor : (description || ''),
      Description: description || '',
      ConnectType: protocol,
      ProtocolType: 0,
      Addr: 1,
      IpAddr: '192.168.1.1',
      Port: 502,
      isSuto: isSuto,
      isVirtualSensor: false,
      isReadMultRegister: false,
      RegisterNumber: 0,
      DataStartAddr: 0,
      UnitStartAddr: 0,
      ResolutionStartAddr: 0,
      RelayIndex: 0,
      SN: cleanSn || '00000000',
      PN: '',
      FW: '',
      HW: '',
      Location: '',
      Meapoint: '',
      ConfigFileName: isSuto ? `${selectedSensor}.sutoch` : '',
      CreateTime: String(Date.now()),
      ...templateObj,
      ...(initialData || {})
    };

    // Parse values to ensure they are of correct types (numbers, booleans, strings)
    const parsedAddr = address === '' ? Number(baseObj.Addr || 1) : Number(address);
    const parsedPort = port === '' ? Number(baseObj.Port || 502) : Number(port);
    const parsedConnectType = Number(protocol);

    const updatedSensor = {
      ...baseObj,
      // User-editable/system fields
      Name: isSuto ? selectedSensor : (description || ''),
      Description: description || '',
      Addr: parsedAddr,
      IpAddr: ipAddress || baseObj.IpAddr || '',
      Port: parsedPort,
      SN: cleanSn || '00000000',
      ConnectType: parsedConnectType,
      ConfigFileName: isSuto ? `${selectedSensor}.sutoch` : '',
      isSuto: Boolean(baseObj.isSuto),
      isVirtualSensor: Boolean(baseObj.isVirtualSensor),
      isReadMultRegister: Boolean(baseObj.isReadMultRegister),
      RegisterNumber: Number(baseObj.RegisterNumber),
      DataStartAddr: Number(baseObj.DataStartAddr),
      UnitStartAddr: Number(baseObj.UnitStartAddr),
      ResolutionStartAddr: Number(baseObj.ResolutionStartAddr),
      RelayIndex: Number(baseObj.RelayIndex),
      SensorID: Number(baseObj.SensorID),
      ProtocolType: Number(baseObj.ProtocolType),
      PN: String(baseObj.PN ?? ''),
      FW: String(baseObj.FW ?? ''),
      HW: String(baseObj.HW ?? ''),
      Location: String(baseObj.Location ?? ''),
      Meapoint: String(baseObj.Meapoint ?? ''),
      CreateTime: (initialData && initialData.CreateTime) ? String(initialData.CreateTime) : String(baseObj.CreateTime || Date.now()),
      cfgchannel: channels.map((ch, idx) => ({
        ...ch,
        CreateTime: ch.CreateTime || String(Date.now() + idx)
      }))
    };

    // Duplicate Address check for channels in one sensor (3-party only)
    if (!isSuto) {
      const addresses = channels.map(ch => String(ch.Address || '').trim());
      const duplicates = addresses.filter((addr, index) => addr !== '' && addresses.indexOf(addr) !== index);
      if (duplicates.length > 0) {
        setDialogState({
          isOpen: true,
          title: t('Duplicate Channel Address'),
          body: t('Multiple channels use the same value address "{address}". Each channel within a sensor must have a unique address.').replaceAll('{address}', duplicates[0]),
          type: 'err',
          showCancel: false,
          onConfirm: closeDialog
        });
        return;
      }
    }

    // Address uniqueness check for Modbus/RTU
    if (protocol === 4) {
      const isDuplicate = updatedSensors.some(s =>
        s !== initialData &&
        !s.isVirtualSensor &&
        !s.isOptionBoardSensor &&
        s.ConnectType === 4 &&
        String(s.Addr) === String(address)
      );
      if (isDuplicate) {
        setDialogState({
          isOpen: true,
          title: t('Duplicate Address'),
          body: t('The Modbus Address "{address}" is already in use by another Modbus/RTU sensor. Please use a unique address.').replaceAll('{address}', address),
          type: 'err',
          showCancel: false,
          onConfirm: closeDialog
        });
        return;
      }
    }

    // IP Address uniqueness check for Modbus/TCP
    if (protocol === 9 && ipAddress) {
      const isDuplicateIp = updatedSensors.some(s =>
        s !== initialData &&
        !s.isVirtualSensor &&
        !s.isOptionBoardSensor &&
        s.ConnectType === 9 &&
        s.IpAddr &&
        String(s.IpAddr).trim() === String(ipAddress).trim()
      );
      if (isDuplicateIp) {
        setDialogState({
          isOpen: true,
          title: t('Duplicate IP Address'),
          body: t('The IP Address "{ipAddress}" is already in use by another Modbus/TCP sensor. Please use a unique IP address.').replaceAll('{ipAddress}', ipAddress),
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
        updatedSensor.Index = initialData.Index !== undefined ? Number(initialData.Index) : index;
        updatedSensors[index] = updatedSensor;
      }
    } else {
      // Add new
      updatedSensor.Index = updatedSensors.length;
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
      InDataType: 8,
      OutDataType: 8,
      FunctionCode: '3',
      ErrorValue: '0',
      CreateTime: String(Date.now() + channels.length)
    };
    const newIndex = channels.length;
    setChannels(prev => [...prev, newChannel]);
    setEditingChannel({
      ...newChannel,
      index: newIndex
    });
    setIsEditModalOpen(true);
  };

  const deleteChannel = async (index) => {
    const channel = channels[index];
    if (isChannelUsedInLogger(configData, channel)) {
      setDialogState({
        isOpen: true,
        title: t('Delete Restricted'),
        body: t('Cannot delete channel "{channel.ChannelDescription}". it is currently used in Logger settings. Please remove it from Logger settings first.').replaceAll('{channel.ChannelDescription}', channel.ChannelDescription),
        type: 'err',
        showCancel: false,
        onConfirm: closeDialog
      });
      return;
    }

    const usedInAlarm = await isChannelUsedInAlarm(configData, channel);
    if (usedInAlarm) {
      setDialogState({
        isOpen: true,
        title: t('Delete Restricted'),
        body: t('Cannot delete channel "{channel.ChannelDescription}". it is currently used in Alarm settings. Please remove it from Alarm settings first.').replaceAll('{channel.ChannelDescription}', channel.ChannelDescription),
        type: 'err',
        showCancel: false,
        onConfirm: closeDialog
      });
      return;
    }

    const usedInLayout = isChannelUsedInLayout(configData, channel);
    if (usedInLayout) {
      setDialogState({
        isOpen: true,
        title: t('Delete Restricted'),
        body: t('Cannot delete channel "{channel.ChannelDescription}". it is currently used in Layout settings. Please remove it from Layout settings first.').replaceAll('{channel.ChannelDescription}', channel.ChannelDescription),
        type: 'err',
        showCancel: false,
        onConfirm: closeDialog
      });
      return;
    }

    setDialogState({
      isOpen: true,
      title: t('Delete Confirmation'),
      body: t('Are you sure you want to delete channel "{channel.ChannelDescription}"?').replaceAll('{channel.ChannelDescription}', channel.ChannelDescription),
      type: 'warn',
      showCancel: true,
      onConfirm: () => {
        setChannels(prev => prev.filter((_, i) => i !== index));
        closeDialog();
      }
    });
  };

  const updateChannelData = (index, newData) => {
    if (!isSuto) {
      const newAddr = String(newData.Address || '').trim();
      if (newAddr !== '') {
        const isDuplicate = channels.some((ch, idx) => idx !== index && String(ch.Address || '').trim() === newAddr);
        if (isDuplicate) {
          setDialogState({
            isOpen: true,
            title: t('Duplicate Channel Address'),
            body: t('Multiple channels use the same value address "{address}". Each channel within a sensor must have a unique address.').replaceAll('{address}', newAddr),
            type: 'err',
            showCancel: false,
            onConfirm: closeDialog
          });
          return;
        }
      }
    }

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
          <div className="config-title">{t('Channel configuration')}</div>
          <div className="close-btn" onClick={onClose}>
            <img src={iconBtnClose} alt={t('Close')} style={{ width: 32, height: 32 }} />
          </div>
        </header>

        {/* Warning & Add Channel */}
        <div className="config-warning" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('Please check and confirm that the unit matches the sensor')}</span>
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
              + {t('Add channel')}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="config-content">
          {/* Left Form */}
          <div className="config-left">
            <div className="form-item">
              <label className="form-label">{t('Protocol')}</label>
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
                <label className="form-label">{t('Sensor')}</label>
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
                    <span>{selectedSensor || t('Select Sensor')}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            <div className="form-item">
              <label className="form-label">{t('Description')}</label>
              <input
                className="form-input"
                placeholder={t('20 characters max')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {protocol === 4 ? (
              <div className="form-item">
                <label className="form-label">{t('Address')}</label>
                <input
                  className="form-input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div className="form-item">
                  <label className="form-label">{t('IP Address')}</label>
                  <input
                    className="form-input"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                  />
                </div>

                <div className="form-item">
                  <label className="form-label">{t('Port')}</label>
                  <input
                    className="form-input"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="form-item">
              <label className="form-label">{t('S/N')}</label>
              <input
                className="form-input"
                value={sn}
                onChange={(e) => setSn(formatSN(e.target.value))}
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
                    <th className="col-channel">{t('Channel')}</th>
                    <th className="col-unit">{t('Unit')}</th>
                    <th className="col-resolution">{t('Resolution')}</th>
                    <th className="col-operate">{t('Operate')}</th>
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
                            title={t('Edit')}
                          >
                            <img src={iconBtnEdit} alt={t('Edit')} style={{ width: 18, height: 18 }} />
                          </button>
                          <button
                            className="btn-icon-img"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => deleteChannel(idx)}
                            title={t('Delete')}
                          >
                            <img src={iconBtnDelete} alt={t('Delete')} style={{ width: 18, height: 18 }} />
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
          <button className="btn-cancel" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn-confirm" onClick={handleConfirm}>{t('Confirm')}</button>
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
