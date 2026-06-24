import React, { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import VirtualChannelModal from './VirtualChannelModal';
import iconBtnEdit from '../../assets/images/icon_btn_edit.png';
import iconBtnDelete from '../../assets/images/icon_btn_delete.png';
import './SUTOSensor.css';

const VirtualChannel = () => {
  const { configData, setConfigData } = useConfig();
  const { t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Dynamically find the config path
  const configPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('SUTO-SensorList.sutolist'));

  // Extract channels from the Virtual Sensor entry in configData
  const virtualSensorEntry = configPath ? configData?.configs?.[configPath]?.cfgsensor?.find(s => s.isVirtualSensor) : null;
  const items = virtualSensorEntry?.cfgchannel || [];

  const handleSave = (newItem) => {
    if (!configPath) return;
    const currentConfig = configData.configs[configPath];
    if (!currentConfig) return;

    // 1. Ensure "Virtual Sensor" exists in cfgsensor
    let sensorList = [...(currentConfig.cfgsensor || [])];
    let vSensorIdx = sensorList.findIndex(s => s.isVirtualSensor);
    let virtualSensor = vSensorIdx !== -1 ? { ...sensorList[vSensorIdx] } : {
      Index: sensorList.length + 1,
      SensorID: sensorList.length + 1,
      Name: "Virtual Sensor",
      Description: "Virtual Sensor",
      ConnectType: 8,
      ProtocolType: 0,
      Addr: 0,
      IpAddr: "0.0.0.0",
      Port: 502,
      isSuto: false,
      isVirtualSensor: true,
      isReadMultRegister: false,
      RegisterNumber: 0,
      DataStartAddr: 0,
      UnitStartAddr: 0,
      ResolutionStartAddr: 0,
      RelayIndex: 0,
      SN: "", PN: "", FW: "", HW: "", Location: "", Meapoint: "", ConfigFileName: "",
      CreateTime: Date.now().toString(),
      cfgchannel: []
    };

    // 2. Update the cfgchannel within that virtual sensor
    let channels = [...(virtualSensor.cfgchannel || [])];
    const channelData = {
      channelid: editingItem ? editingItem.channelid : (channels.length > 0 ? Math.max(...channels.map(c => c.channelid)) + 1 : 0),
      ChannelDescription: newItem.Name,
      UnitInASCII: newItem.Unit,
      Resolution: newItem.Resolution,
      Formula: newItem.Formula,
      isvirtualsensor: true,
      Show: true,
      logger: true,
      CreatedOn: newItem.CreatedOn
    };

    if (editingItem) {
      channels = channels.map(ch => ch.channelid === editingItem.channelid ? channelData : ch);
    } else {
      channels.push(channelData);
    }
    virtualSensor.cfgchannel = channels;

    // 3. Update the sensor in the list
    if (vSensorIdx !== -1) {
      sensorList[vSensorIdx] = virtualSensor;
    } else {
      sensorList.push(virtualSensor);
    }

    // 4. Update Global Context
    setConfigData({
      ...configData,
      configs: {
        ...configData.configs,
        [configPath]: { ...currentConfig, cfgsensor: sensorList }
      }
    });

    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleDelete = (channelId) => {
    if (!configPath) return;
    const currentConfig = configData.configs[configPath];
    if (!currentConfig) return;

    let sensorList = [...(currentConfig.cfgsensor || [])];
    let vSensor = sensorList.find(s => s.isVirtualSensor);
    if (!vSensor) return;

    vSensor.cfgchannel = (vSensor.cfgchannel || []).filter(ch => ch.channelid !== channelId);

    setConfigData({
      ...configData,
      configs: {
        ...configData.configs,
        [configPath]: { ...currentConfig, cfgsensor: sensorList }
      }
    });
  };

  return (
    <div className="content-card suto-sensor-page">
      {/* Header */}
      <header className="suto-header">
        <h2 className="suto-title">{t('Virtual channel list')}</h2>
        <button
          className="add-sensor-btn"
          onClick={() => {
            setEditingItem(null);
            setIsModalOpen(true);
          }}
        >
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M8 3V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{t('Create Virtual channel')}</span>
        </button>
      </header>

      {/* Body */}
      <div className="suto-body">
        <div className="suto-table-container">
          <table className="suto-table">
            <thead>
              <tr>
                <th>{t('Created on')}</th>
                <th>{t('Virtual channel')}</th>
                <th>{t('Unit')}</th>
                <th>{t('Resolution')}</th>
                <th>{t('Formula')}</th>
                <th className="col-operate">{t('Operate')}</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.CreatedOn || '---'}</td>
                    <td>{item.ChannelDescription || '---'}</td>
                    <td>{item.UnitInASCII || '---'}</td>
                    <td>{item.Resolution || '---'}</td>
                    <td>{item.Formula || '---'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn-icon-img" 
                          title={t('Edit')}
                          onClick={() => {
                            setEditingItem(item);
                            setIsModalOpen(true);
                          }}
                        >
                          <img src={iconBtnEdit} alt={t('Edit')} style={{ width: 18, height: 18 }} />
                        </button>
                        <button 
                          className="btn-icon-img" 
                          title={t('Delete')}
                          onClick={() => handleDelete(item.channelid)}
                        >
                          <img src={iconBtnDelete} alt={t('Delete')} style={{ width: 18, height: 18 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ borderBottom: 'none', padding: 0 }}>
                    <div className="suto-empty-container">
                      {t('No Virtual channel configured. Click "Create Virtual channel"')}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer / Pagination */}
      <footer className="suto-footer">
        <div className="pagination-info">
          <span>{t('Items per page:')}</span>
          <div className="items-per-page">
            <span>10</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>

        <div className="page-counter">
          {items.length} {t('of')} {items.length}
        </div>

        <div className="pagination-controls">
          <button className="page-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
            </svg>
          </button>
          <button className="page-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button className="page-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <button className="page-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
            </svg>
          </button>
        </div>
      </footer>

      <VirtualChannelModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={editingItem}
        onSave={handleSave}
      />
    </div>
  );
};

export default VirtualChannel;
