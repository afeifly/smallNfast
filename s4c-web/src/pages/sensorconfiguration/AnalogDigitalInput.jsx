import React, { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import AnalogDigitalModal from './AnalogDigitalModal';
import CustomDialog from '../../components/CustomDialog';
import iconBtnEdit from '../../assets/images/icon_btn_edit.png';
import iconBtnDelete from '../../assets/images/icon_btn_delete.png';
import { isChannelUsedInLogger, isChannelUsedInAlarm, isChannelUsedInLayout, remarshalAll } from '../../util/remarshalUtils';
import './SUTOSensor.css';

const AnalogDigitalInput = () => {
  const { configData, setConfigData } = useConfig();
  const { t } = useLanguage();
  const [items, setItems] = useState([]); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingIndex, setEditingIndex] = useState(-1);
  
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    body: '',
    type: 'warn',
    onConfirm: null,
    showCancel: true
  });

  const closeDialog = () => setDialogState(prev => ({ ...prev, isOpen: false }));

  // Load initial data from the correct config file path
  useEffect(() => {
    const optionBoardConfig = configData?.configs?.['config/cfgOptionBoard.json']?.cfgOptionBoard || [];
    setItems(optionBoardConfig);
  }, [configData]);

  // Formatting helpers based on the Vue code and JSON structure
  const formatOptionBoardType = (type) => {
    return type === 0 ? t('Analog') : (type === 1 ? t('Digital') : '---');
  };

  const formatTerminal = (item) => {
    if (!item.TerminalNo) return '---';
    return `x${item.TerminalNo}`;
  };

  const formatSignal = (item) => {
    if (item.OptionBoardType === 0) {
      // Mapping based on common analog signal types
      const types = { 0: '4-20mA', 1: '0-20mA', 2: '0-1V', 3: '0-10V' };
      return types[item.AnalogSignalType] || t('Analog');
    }
    const types = { 
      0: t('Counter'), 
      1: t('Runtime'), 
      2: t('Status') 
    };
    return types[item.DigitalType] || t('Digital');
  };

  const updateConfig = (newItems) => {
    const newConfigs = { ...configData.configs };
    newConfigs['config/cfgOptionBoard.json'] = {
      ...newConfigs['config/cfgOptionBoard.json'],
      cfgOptionBoard: newItems
    };

    // Make sure we remove any Option Board sensor from SUTO-SensorList.sutolist if present
    const configPath = Object.keys(newConfigs).find(p => p.endsWith('SUTO-SensorList.sutolist'));
    if (configPath && newConfigs[configPath]) {
      const sutoConfig = newConfigs[configPath];
      let sensorList = [...(sutoConfig.cfgsensor || [])];
      let obIdx = sensorList.findIndex(s => s.isOptionBoardSensor);
      if (obIdx !== -1) {
        sensorList.splice(obIdx, 1);
        newConfigs[configPath] = {
          ...sutoConfig,
          cfgsensor: sensorList
        };
      }
    }

    const nextConfigData = {
      ...configData,
      configs: newConfigs
    };
    setConfigData(remarshalAll(nextConfigData));
  };

  const handleSave = (newItem) => {
    let newItems;
    if (editingIndex !== -1) {
      newItems = [...items];
      newItems[editingIndex] = newItem;
    } else {
      const newItemWithDefaults = {
        shown: true,
        ChannelValid: false,
        Location: "",
        Meapoint: "",
        CreateTime: Date.now().toString(),
        ...newItem
      };
      newItems = [...items, newItemWithDefaults];
    }
    
    setItems(newItems);
    updateConfig(newItems);
    setIsModalOpen(false);
  };

  const handleDeleteClick = async (index) => {
    const channel = items[index];
    
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
      body: t('Are you sure you want to delete this analog & digital input?'),
      type: 'warn',
      showCancel: true,
      onConfirm: () => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
        updateConfig(newItems);
        closeDialog();
      }
    });
  };


  return (
    <div className="content-card suto-sensor-page">
      {/* Header */}
      <header className="suto-header">
        <h2 className="suto-title">{t('Analog & digital input list')}</h2>
        <button
          className="add-sensor-btn"
          onClick={() => {
            setEditingItem(null);
            setEditingIndex(-1);
            setIsModalOpen(true);
          }}
        >
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M8 3V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{t('Create Analog & digital input')}</span>
        </button>
      </header>

      {/* Body */}
      <div className="suto-body">
        <div className="suto-table-container">
          <table className="suto-table">
            <thead>
              <tr>
                <th>{t('Module')}</th>
                <th>{t('Terminal')}</th>
                <th>{t('Sensor')}</th>
                <th>{t('Channel')}</th>
                <th>{t('Signal')}</th>
                <th className="col-operate">{t('Operate')}</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item, index) => (
                  <tr key={item.CreateTime || index}>
                    <td>{formatOptionBoardType(item.OptionBoardType)}</td>
                    <td>{formatTerminal(item)}</td>
                    <td>{item.SensorDescription || '---'}</td>
                    <td>{item.ChannelDescription || '---'}</td>
                    <td>{formatSignal(item)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn-icon-img" 
                          title={t('Edit')}
                          onClick={() => {
                            setEditingItem(item);
                            setEditingIndex(index);
                            setIsModalOpen(true);
                          }}
                        >
                          <img src={iconBtnEdit} alt={t('Edit')} style={{ width: 18, height: 18 }} />
                        </button>
                        <button 
                          className="btn-icon-img" 
                          title={t('Delete')}
                          onClick={() => handleDeleteClick(index)}
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
                      {t('No Analog & digital input configured. Click "Create Analog & digital input"')}
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

      <AnalogDigitalModal
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

export default AnalogDigitalInput;
