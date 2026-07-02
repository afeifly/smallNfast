import React, { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import SensorConfigModal from './SensorConfigModal';
import EditChannelModal from './EditChannelModal';
import CustomDialog from '../../components/CustomDialog';
import iconBtnEdit from '../../assets/images/icon_btn_edit.png';
import iconBtnDelete from '../../assets/images/icon_btn_delete.png';
import { isSensorUsedInLogger, isSensorUsedInAlarm, isSensorUsedInLayout, remarshalAll } from '../../util/remarshalUtils';
import './SUTOSensor.css';

const formatSN = (sn) => {
  if (!sn) return '---';
  const clean = String(sn).trim();
  if (clean.length > 4) {
    return `${clean.slice(0, 4)} ${clean.slice(4)}`;
  }
  return clean;
};

const SUTOSensor = () => {
  const { configData, setConfigData } = useConfig();
  const { t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSensor, setEditingSensor] = useState(null);

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

  const handleDeleteSensor = async (sensor) => {
    const usedChannelLogger = isSensorUsedInLogger(configData, sensor);
    if (usedChannelLogger) {
      setDialogState({
        isOpen: true,
        title: t('Delete Restricted'),
        body: t('Cannot delete sensor. Channel "{usedChannel}" is currently used in Logger settings. Please remove it from Logger settings first.').replaceAll('{usedChannel}', usedChannelLogger),
        type: 'err',
        showCancel: false,
        onConfirm: closeDialog
      });
      return;
    }

    const usedChannelAlarm = await isSensorUsedInAlarm(configData, sensor);
    if (usedChannelAlarm) {
      setDialogState({
        isOpen: true,
        title: t('Delete Restricted'),
        body: t('Cannot delete sensor. Channel "{usedChannel}" is currently used in Alarm settings. Please remove it from Alarm settings first.').replaceAll('{usedChannel}', usedChannelAlarm),
        type: 'err',
        showCancel: false,
        onConfirm: closeDialog
      });
      return;
    }

    const usedChannelLayout = isSensorUsedInLayout(configData, sensor);
    if (usedChannelLayout) {
      setDialogState({
        isOpen: true,
        title: t('Delete Restricted'),
        body: t('Cannot delete sensor. Channel "{usedChannel}" is currently used in Layout settings. Please remove it from Layout settings first.').replaceAll('{usedChannel}', usedChannelLayout),
        type: 'err',
        showCancel: false,
        onConfirm: closeDialog
      });
      return;
    }

    setDialogState({
      isOpen: true,
      title: t('Delete Confirmation'),
      body: t('Are you sure you want to delete sensor "{sensor.Name}"?').replaceAll('{sensor.Name}', sensor.Name),
      type: 'warn',
      showCancel: true,
      onConfirm: () => {
        const listPath = Object.keys(configData.configs).find(p => p.endsWith('SUTO-SensorList.sutolist'));
        if (listPath) {
          const currentList = configData.configs[listPath];
          const updatedSensors = (currentList.cfgsensor || []).filter(s => s !== sensor);
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
        }
        closeDialog();
      }
    });
  };

  // Extract and filter sensors
  const sensors = (
    configData?.configs?.['/config/SUTO-SensorList.sutolist']?.cfgsensor ||
    configData?.configs?.['config/SUTO-SensorList.sutolist']?.cfgsensor ||
    []
  ).filter(s => s.isSuto === true);

  return (
    <div className="content-card suto-sensor-page">
      {/* Header */}
      <header className="suto-header">
        <h2 className="suto-title">{t('SUTO sensor list')}</h2>
        <button
          className="add-sensor-btn"
          onClick={() => {
            setEditingSensor(null);
            setIsModalOpen(true);
          }}
        >
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M8 3V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{t('Add SUTO Sensor')}</span>
        </button>
      </header>

      {/* Body */}
      <div className="suto-body">
        <div className="suto-table-container">
          <table className="suto-table">
            <thead>
              <tr>
                <th className="col-sensor">{t('Sensor')}</th>
                <th className="col-description">{t('Description')}</th>
                <th className="col-address">{t('Address')}</th>
                <th className="col-sn">{t('S/N')}</th>
                <th className="col-operate">{t('Operate')}</th>
              </tr>
            </thead>
            <tbody>
              {sensors.length > 0 ? (
                sensors.map((sensor, index) => (
                  <tr key={index}>
                    <td>{sensor.Name || '---'}</td>
                    <td>{sensor.Description || '---'}</td>
                    <td>{sensor.ConnectType === 9 ? (sensor.IpAddr || '---') : (sensor.Addr || '---')}</td>
                    <td>{formatSN(sensor.SN)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn-icon-img"
                          title={t('Edit')}
                          onClick={() => {
                            setEditingSensor(sensor);
                            setIsModalOpen(true);
                          }}
                        >
                          <img src={iconBtnEdit} alt={t('Edit')} style={{ width: 18, height: 18 }} />
                        </button>
                        <button 
                          className="btn-icon-img" 
                          title={t('Delete')}
                          onClick={() => handleDeleteSensor(sensor)}
                        >
                          <img src={iconBtnDelete} alt={t('Delete')} style={{ width: 18, height: 18 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ borderBottom: 'none', padding: 0 }}>
                    <div className="suto-empty-container">
                      {t('No SUTO sensors configured. Click "Add SUTO Sensor" to get started.')}
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
          {sensors.length} {t('of')} {sensors.length}
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
      {/* Sensor Config Modal (Add/Edit) */}
      <SensorConfigModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSensor(null);
        }}
        initialData={editingSensor}
        isSuto={true}
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

export default SUTOSensor;
