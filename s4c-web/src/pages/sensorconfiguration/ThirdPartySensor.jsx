import React, { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import SensorConfigModal from './SensorConfigModal';
import iconBtnEdit from '../../assets/images/icon_btn_edit.png';
import iconBtnDelete from '../../assets/images/icon_btn_delete.png';
import './SUTOSensor.css';

const ThirdPartySensor = () => {
  const { configData } = useConfig();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSensor, setEditingSensor] = useState(null);

  // Extract and filter sensors (isSuto !== true for 3-Party sensors)
  const sensors = (
    configData?.configs?.['/config/SUTO-SensorList.sutolist']?.cfgsensor ||
    configData?.configs?.['config/SUTO-SensorList.sutolist']?.cfgsensor ||
    []
  ).filter(s => s.isSuto !== true);

  return (
    <div className="content-card suto-sensor-page">
      {/* Header */}
      <header className="suto-header">
        <h2 className="suto-title">3-Party sensor list</h2>
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
          <span>Add 3-Party sensor</span>
        </button>
      </header>

      {/* Body */}
      <div className="suto-body">
        <div className="suto-table-container">
          <table className="suto-table">
            <thead>
              <tr>
                <th className="col-sensor">Sensor</th>
                <th className="col-description">Description</th>
                <th className="col-address">Address</th>
                <th className="col-sn">S/N</th>
                <th className="col-operate">Operate</th>
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
                          title="Edit"
                          onClick={() => {
                            setEditingSensor(sensor);
                            setIsModalOpen(true);
                          }}
                        >
                          <img src={iconBtnEdit} alt="Edit" style={{ width: 18, height: 18 }} />
                        </button>
                        <button className="btn-icon-img" title="Delete">
                          <img src={iconBtnDelete} alt="Delete" style={{ width: 18, height: 18 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ borderBottom: 'none', padding: 0 }}>
                    <div className="suto-empty-container">
                      No 3-Party sensor configured. Click "Add 3-Party sensor"
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
          <span>Items per page:</span>
          <div className="items-per-page">
            <span>10</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>

        <div className="page-counter">
          {sensors.length} of {sensors.length}
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
    </div>
  );
};

export default ThirdPartySensor;
