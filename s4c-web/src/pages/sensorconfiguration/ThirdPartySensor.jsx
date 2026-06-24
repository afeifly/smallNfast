import React, { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import SensorConfigModal from './SensorConfigModal';
import CustomDialog from '../../components/CustomDialog';
import iconBtnEdit from '../../assets/images/icon_btn_edit.png';
import iconBtnDelete from '../../assets/images/icon_btn_delete.png';
import { isSensorUsedInLogger, remarshalAll } from '../../util/remarshalUtils';
import './SUTOSensor.css';

const ThirdPartySensor = () => {
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

  const handleDeleteSensor = (sensor) => {
    const usedChannel = isSensorUsedInLogger(configData, sensor);
    if (usedChannel) {
      setDialogState({
        isOpen: true,
        title: t({ en: 'Delete Restricted', de: 'Löschen eingeschränkt', cn: '删除受限' }),
        body: t({ 
          en: `Cannot delete sensor. Channel "${usedChannel}" is currently used in Logger settings. Please remove it from Logger settings first.`, 
          de: `Sensor kann nicht gelöscht werden. Kanal "${usedChannel}" wird derzeit in den Logger-Einstellungen verwendet. Bitte entfernen Sie ihn zuerst aus den Logger-Einstellungen.`, 
          cn: `无法删除传感器。通道 "${usedChannel}" 当前在记录仪设置中使用。请先从记录仪设置中移除它。` 
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
        en: `Are you sure you want to delete sensor "${sensor.Name || sensor.Description}"?`, 
        de: `Sind Sie sicher, dass Sie den Sensor "${sensor.Name || sensor.Description}" löschen möchten?`, 
        cn: `确定要删除传感器 "${sensor.Name || sensor.Description}" 吗？` 
      }),
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

  // Extract and filter sensors (isSuto !== true for 3-Party sensors)
  const sensors = (
    configData?.configs?.['/config/SUTO-SensorList.sutolist']?.cfgsensor ||
    configData?.configs?.['config/SUTO-SensorList.sutolist']?.cfgsensor ||
    []
  ).filter(s => s.isSuto !== true && s.isVirtualSensor !== true);

  return (
    <div className="content-card suto-sensor-page">
      {/* Header */}
      <header className="suto-header">
        <h2 className="suto-title">{t({ en: '3-Party sensor list', de: 'Drittanbieter-Sensorliste', cn: '第三方传感器列表' })}</h2>
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
          <span>{t({ en: 'Add 3-Party sensor', de: 'Drittanbieter-Sensor hinzufügen', cn: '添加第三方传感器' })}</span>
        </button>
      </header>

      {/* Body */}
      <div className="suto-body">
        <div className="suto-table-container">
          <table className="suto-table">
            <thead>
              <tr>
                <th className="col-sensor">{t({ en: 'Sensor', de: 'Sensor', cn: '传感器' })}</th>
                <th className="col-description">{t({ en: 'Description', de: 'Beschreibung', cn: '描述' })}</th>
                <th className="col-address">{t({ en: 'Address', de: 'Adresse', cn: '地址' })}</th>
                <th className="col-sn">{t({ en: 'S/N', de: 'S/N', cn: '序列号' })}</th>
                <th className="col-operate">{t({ en: 'Operate', de: 'Aktion', cn: '操作' })}</th>
              </tr>
            </thead>
            <tbody>
              {sensors.length > 0 ? (
                sensors.map((sensor, index) => (
                  <tr key={index}>
                    <td>{sensor.Name || '---'}</td>
                    <td>{sensor.Description || '---'}</td>
                    <td>{sensor.Addr || '---'}</td>
                    <td>{sensor.SN || '---'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn-icon-img"
                          title={t({ en: 'Edit', de: 'Bearbeiten', cn: '编辑' })}
                          onClick={() => {
                            setEditingSensor(sensor);
                            setIsModalOpen(true);
                          }}
                        >
                          <img src={iconBtnEdit} alt={t({ en: 'Edit', de: 'Bearbeiten', cn: '编辑' })} style={{ width: 18, height: 18 }} />
                        </button>
                        <button 
                          className="btn-icon-img" 
                          title={t({ en: 'Delete', de: 'Löschen', cn: '删除' })}
                          onClick={() => handleDeleteSensor(sensor)}
                        >
                          <img src={iconBtnDelete} alt={t({ en: 'Delete', de: 'Löschen', cn: '删除' })} style={{ width: 18, height: 18 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ borderBottom: 'none', padding: 0 }}>
                    <div className="suto-empty-container">
                      {t({ 
                        en: 'No 3-Party sensor configured. Click "Add 3-Party sensor"', 
                        de: 'Kein Drittanbieter-Sensor konfiguriert. Klicken Sie auf "Drittanbieter-Sensor hinzufügen"', 
                        cn: '未配置第三方传感器。点击“添加第三方传感器”开始。' 
                      })}
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
          <span>{t({ en: 'Items per page:', de: 'Einträge pro Seite:', cn: '每页条数:' })}</span>
          <div className="items-per-page">
            <span>10</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>

        <div className="page-counter">
          {sensors.length} {t({ en: 'of', de: 'von', cn: '/' })} {sensors.length}
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
        isSuto={false}
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

export default ThirdPartySensor;
