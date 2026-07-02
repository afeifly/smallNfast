import React, { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import VirtualChannelModal from './VirtualChannelModal';
import CustomDialog from '../../components/CustomDialog';
import iconBtnEdit from '../../assets/images/icon_btn_edit.png';
import iconBtnDelete from '../../assets/images/icon_btn_delete.png';
import { isChannelUsedInLogger, isChannelUsedInAlarm, isChannelUsedInLayout, remarshalAll } from '../../util/remarshalUtils';
import './SUTOSensor.css';

const VirtualChannel = () => {
  const { configData, setConfigData } = useConfig();
  const { t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    body: '',
    type: 'warn',
    onConfirm: null,
    showCancel: true
  });

  const closeDialog = () => setDialogState(prev => ({ ...prev, isOpen: false }));

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
    const channelIdVal = editingItem ? (editingItem.ChannelId ?? editingItem.channelid) : (channels.length > 0 ? Math.max(...channels.map(c => c.ChannelId ?? c.channelid ?? 0)) + 1 : 0);
    const channelData = {
      ChannelDescription: newItem.Name,
      DeviceID: 0,
      ErrorValue: -9999,
      ChannelId: channelIdVal,
      InputValueType: 0,
      MBAccessFuncCode: 0,
      MBValueAddr: 0,
      MBValueByteOrder: 0,
      MBValueLength: 0,
      Maximum: 0,
      MeasureType: 0,
      Minimum: 0,
      Output: false,
      OutputValueType: 0,
      Resolution: newItem.Resolution,
      Show: true,
      SlaverInnerChannelNo: -1,
      SubDeviceID: 0,
      UnitInASCII: newItem.Unit,
      UnitIndex: 0,
      UseErrorValue: false,
      UseMinMax: false,
      Logger: true,
      Formula: newItem.Formula,
      isVirtualSensor: true,
      EnableAlarm: false,
      MaxThreshold: 0,
      MaxHysteresis: 0,
      Direction: 0,
      RelayIndex: 0,
      Id: channelIdVal,
      CreateTime: editingItem ? (editingItem.CreateTime || editingItem.CreatedOn || Date.now().toString()) : Date.now().toString()
    };

    if (editingItem) {
      channels = channels.map(ch => (ch.ChannelId ?? ch.channelid) === (editingItem.ChannelId ?? editingItem.channelid) ? channelData : ch);
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
    const nextConfigData = {
      ...configData,
      configs: {
        ...configData.configs,
        [configPath]: { ...currentConfig, cfgsensor: sensorList }
      }
    };
    setConfigData(remarshalAll(nextConfigData));

    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleDeleteClick = async (channel) => {
    // 1. Check Logger
    const usedInLogger = isChannelUsedInLogger(configData, channel);
    // 2. Check Alarm
    const usedInAlarm = await isChannelUsedInAlarm(configData, channel);
    // 3. Check Layout
    const usedInLayout = isChannelUsedInLayout(configData, channel);
    
    if (usedInLogger || usedInAlarm || usedInLayout) {
      let body = '';
      if (usedInLogger) {
        body = t('Cannot delete channel "{channel.ChannelDescription}". it is currently used in Logger settings. Please remove it from Logger settings first.').replaceAll('{channel.ChannelDescription}', channel.ChannelDescription);
      } else if (usedInAlarm) {
        body = t('Cannot delete channel "{channel.ChannelDescription}". it is currently used in Alarm settings. Please remove it from Alarm settings first.').replaceAll('{channel.ChannelDescription}', channel.ChannelDescription);
      } else {
        body = t('Cannot delete channel "{channel.ChannelDescription}". it is currently used in Layout settings. Please remove it from Layout settings first.').replaceAll('{channel.ChannelDescription}', channel.ChannelDescription);
      }
      
      setDialogState({
        isOpen: true,
        title: t('Delete Restricted'),
        body: body,
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
        if (!configPath) return;
        const currentConfig = configData.configs[configPath];
        if (!currentConfig) return;

        let sensorList = [...(currentConfig.cfgsensor || [])];
        let vSensor = sensorList.find(s => s.isVirtualSensor);
        if (!vSensor) return;

        vSensor.cfgchannel = (vSensor.cfgchannel || []).filter(ch => (ch.ChannelId ?? ch.channelid) !== (channel.ChannelId ?? channel.channelid));

        const nextConfigData = {
          ...configData,
          configs: {
            ...configData.configs,
            [configPath]: { ...currentConfig, cfgsensor: sensorList }
          }
        };
        setConfigData(remarshalAll(nextConfigData));
        closeDialog();
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
                    <td>
                      {item.CreatedOn || 
                       (item.CreateTime 
                         ? (isNaN(Number(item.CreateTime)) 
                             ? item.CreateTime.split(' ')[0] 
                             : new Date(Number(item.CreateTime)).toISOString().split('T')[0]) 
                         : '---')}
                    </td>
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
                           onClick={() => handleDeleteClick(item)}
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
  );
};

export default VirtualChannel;
