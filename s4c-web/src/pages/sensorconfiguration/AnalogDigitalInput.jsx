import React, { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import AnalogDigitalModal from './AnalogDigitalModal';
import CustomDialog from '../../components/CustomDialog';
import iconBtnEdit from '../../assets/images/icon_btn_edit.png';
import iconBtnDelete from '../../assets/images/icon_btn_delete.png';
import './SUTOSensor.css';

const AnalogDigitalInput = () => {
  const { configData, setConfigData } = useConfig();
  const { t } = useLanguage();
  const [items, setItems] = useState([]); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingIndex, setEditingIndex] = useState(-1);
  
  // Delete confirmation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [indexToDelete, setIndexToDelete] = useState(-1);

  // Load initial data from the correct config file path
  useEffect(() => {
    const optionBoardConfig = configData?.configs?.['cfgOptionBoard.json']?.cfgOptionBoard || [];
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
    newConfigs['cfgOptionBoard.json'] = {
      ...newConfigs['cfgOptionBoard.json'],
      cfgOptionBoard: newItems
    };

    // Rebuild/Sync Option Board sensor in SUTO-SensorList.sutolist
    const configPath = Object.keys(newConfigs).find(p => p.endsWith('SUTO-SensorList.sutolist'));
    if (configPath && newConfigs[configPath]) {
      const sutoConfig = newConfigs[configPath];
      let sensorList = [...(sutoConfig.cfgsensor || [])];
      let obIdx = sensorList.findIndex(s => s.isOptionBoardSensor);
      
      if (newItems.length > 0) {
        let optionBoardSensor = obIdx !== -1 ? { ...sensorList[obIdx] } : {
          Index: sensorList.length + 1,
          SensorID: sensorList.length + 1,
          Name: "Option Board",
          Description: "Option Board",
          ConnectType: 9,
          ProtocolType: 0,
          Addr: 0,
          IpAddr: "0.0.0.0",
          Port: 502,
          isSuto: false,
          isOptionBoardSensor: true,
          isReadMultRegister: false,
          RegisterNumber: 0,
          DataStartAddr: 0,
          UnitStartAddr: 0,
          ResolutionStartAddr: 0,
          RelayIndex: 0,
          SN: "", PN: "", FW: "", HW: "", Location: "", Meapoint: "", ConfigFileName: "",
          CreateTime: "option-board-sensor-id",
          cfgchannel: []
        };
        
        optionBoardSensor.cfgchannel = newItems.map(item => ({
          ChannelId: item.ChannelId,
          ChannelDescription: item.ChannelDescription,
          UnitInASCII: item.PreDefineUnit || item.DisplayUnit || '',
          Resolution: item.Resolution,
          OptionBoardType: item.OptionBoardType,
          TerminalNo: item.TerminalNo,
          isOptionBoardChannel: true,
          Show: true,
          logger: true,
          CreateTime: item.CreateTime
        }));
        
        if (obIdx !== -1) {
          sensorList[obIdx] = optionBoardSensor;
        } else {
          sensorList.push(optionBoardSensor);
        }
      } else {
        if (obIdx !== -1) {
          sensorList.splice(obIdx, 1);
        }
      }
      
      newConfigs[configPath] = {
        ...sutoConfig,
        cfgsensor: sensorList
      };
    }

    setConfigData(prev => ({
      ...prev,
      configs: newConfigs
    }));
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

  const handleDeleteClick = (index) => {
    setIndexToDelete(index);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    const newItems = items.filter((_, i) => i !== indexToDelete);
    setItems(newItems);
    updateConfig(newItems);
    setIsDeleteDialogOpen(false);
    setIndexToDelete(-1);
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
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title={t('Delete Confirmation')}
        body={t('Are you sure you want to delete this analog & digital input?')}
        confirmText={t('Delete')}
        cancelText={t('Cancel')}
        type="warn"
      />
    </div>
  );
};

export default AnalogDigitalInput;
