import React, { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
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
  const { t } = useLanguage();
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
          title: t({ en: 'Duplicate Address', de: 'Doppelte Adresse', cn: '地址重复' }),
          body: t({ 
            en: `The Modbus Address "${address}" is already in use by another sensor. Please use a unique address.`, 
            de: `Die Modbus-Adresse "${address}" wird bereits von einem anderen Sensor verwendet. Bitte verwenden Sie eine eindeutige Adresse.`, 
            cn: `Modbus 地址 "${address}" 已被其他传感器使用。请使用唯一的地址。` 
          }),
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
        title: t({ en: 'Delete Restricted', de: 'Löschen eingeschränkt', cn: '删除受限' }),
        body: t({ 
          en: `Cannot delete channel "${channel.ChannelDescription}". it is currently used in Logger settings. Please remove it from Logger settings first.`, 
          de: `Kanal "${channel.ChannelDescription}" kann nicht gelöscht werden. Er wird derzeit in den Logger-Einstellungen verwendet. Bitte entfernen Sie ihn zuerst aus den Logger-Einstellungen.`, 
          cn: `无法删除通道 "${channel.ChannelDescription}"。它当前在记录仪设置中使用。请先从记录仪设置中移除它。` 
        }),
        type: 'err',
        showCancel: false,
        onConfirm: closeDialog
      });
      return;
    }

    setDialogState({
      isOpen: true,
      title: t({ en: 'Delete Confirmation', de: 'Löschbestätigung', cn: '删除确认' }),
      body: t({ 
        en: `Are you sure you want to delete channel "${channel.ChannelDescription}"?`, 
        de: `Sind Sie sicher, dass Sie den Kanal "${channel.ChannelDescription}" löschen möchten?`, 
        cn: `确定要删除通道 "${channel.ChannelDescription}" 吗？` 
      }),
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
          <div className="config-title">{t({ en: 'Channel configuration', de: 'Kanalkonfiguration', cn: '通道配置' })}</div>
          <div className="close-btn" onClick={onClose}>
            <img src={iconBtnClose} alt={t({ en: 'Close', de: 'Schließen', cn: '关闭' })} style={{ width: 32, height: 32 }} />
          </div>
        </header>

        {/* Warning & Add Channel */}
        <div className="config-warning" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t({ en: 'Please check and confirm that the unit matches the sensor', de: 'Bitte überprüfen und bestätigen Sie, dass die Einheit mit dem Sensor übereinstimmt', cn: '请检查并确认单位与传感器匹配' })}</span>
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
              + {t({ en: 'Add channel', de: 'Kanal hinzufügen', cn: '添加通道' })}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="config-content">
          {/* Left Form */}
          <div className="config-left">
            <div className="form-item">
              <label className="form-label">{t({ en: 'Protocol', de: 'Protokoll', cn: '协议' })}</label>
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
                <label className="form-label">{t({ en: 'Sensor', de: 'Sensor', cn: '传感器' })}</label>
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
                    <span>{selectedSensor || t({ en: 'Select Sensor', de: 'Sensor auswählen', cn: '选择传感器' })}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            <div className="form-item">
              <label className="form-label">{t({ en: 'Description', de: 'Beschreibung', cn: '描述' })}</label>
              <input
                className="form-input"
                placeholder={t({ en: '20 characters max', de: 'max. 20 Zeichen', cn: '20个字符以内' })}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {protocol === 4 ? (
              <div className="form-item">
                <label className="form-label">{t({ en: 'Address', de: 'Adresse', cn: '地址' })}</label>
                <input
                  className="form-input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div className="form-item">
                  <label className="form-label">{t({ en: 'IP Address', de: 'IP-Adresse', cn: 'IP 地址' })}</label>
                  <input
                    className="form-input"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                  />
                </div>

                <div className="form-item">
                  <label className="form-label">{t({ en: 'Port', de: 'Port', cn: '端口' })}</label>
                  <input
                    className="form-input"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="form-item">
              <label className="form-label">{t({ en: 'S/N', de: 'S/N', cn: '序列号' })}</label>
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
                    <th className="col-channel">{t({ en: 'Channel', de: 'Kanal', cn: '通道' })}</th>
                    <th className="col-unit">{t({ en: 'Unit', de: 'Einheit', cn: '单位' })}</th>
                    <th className="col-resolution">{t({ en: 'Resolution', de: 'Auflösung', cn: '分辨率' })}</th>
                    <th className="col-operate">{t({ en: 'Operate', de: 'Aktion', cn: '操作' })}</th>
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
                            title={t({ en: 'Edit', de: 'Bearbeiten', cn: '编辑' })}
                          >
                            <img src={iconBtnEdit} alt={t({ en: 'Edit', de: 'Bearbeiten', cn: '编辑' })} style={{ width: 18, height: 18 }} />
                          </button>
                          <button
                            className="btn-icon-img"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => deleteChannel(idx)}
                            title={t({ en: 'Delete', de: 'Löschen', cn: '删除' })}
                          >
                            <img src={iconBtnDelete} alt={t({ en: 'Delete', de: 'Löschen', cn: '删除' })} style={{ width: 18, height: 18 }} />
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
          <button className="btn-cancel" onClick={onClose}>{t({ en: 'Cancel', de: 'Abbrechen', cn: '取消' })}</button>
          <button className="btn-confirm" onClick={handleConfirm}>{t({ en: 'Confirm', de: 'Bestätigen', cn: '确认' })}</button>
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
