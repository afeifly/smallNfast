import React, { useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import iconBtnEdit from '../assets/images/icon_btn_edit.png';
import iconBtnDelete from '../assets/images/icon_btn_delete.png';
import './sensorconfiguration/SUTOSensor.css';

const Alarm = () => {
  const { configData } = useConfig();
  const [alarms, setAlarms] = useState([]); // Placeholder for alarm data

  return (
    <div className="content-card suto-sensor-page">
      {/* Header */}
      <header className="suto-header">
        <h2 className="suto-title">Alarm list</h2>
        <button
          className="add-sensor-btn"
          onClick={() => {
            // Handle add alarm
          }}
        >
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M8 3V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>Add Alarm</span>
        </button>
      </header>

      {/* Body */}
      <div className="suto-body">
        <div className="suto-table-container">
          <table className="suto-table">
            <thead>
              <tr>
                <th>Sensor</th>
                <th>Channel</th>
                <th>Unit</th>
                <th>Threshold</th>
                <th>Hysteresis</th>
                <th>Direction</th>
                <th>Delay</th>
                <th>Relay</th>
                <th>Pending</th>
                <th className="col-operate">Action</th>
              </tr>
            </thead>
            <tbody>
              {alarms.length > 0 ? (
                alarms.map((alarm, index) => (
                  <tr key={index}>
                    <td>{alarm.Sensor || '---'}</td>
                    <td>{alarm.Channel || '---'}</td>
                    <td>{alarm.Unit || '---'}</td>
                    <td>{alarm.Threshold || '---'}</td>
                    <td>{alarm.Hysteresis || '---'}</td>
                    <td>{alarm.Direction || '---'}</td>
                    <td>{alarm.Delay || '---'}</td>
                    <td>{alarm.Relay || '---'}</td>
                    <td>{alarm.Pending || '---'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-icon-img" title="Edit">
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
                  <td colSpan={10} style={{ borderBottom: 'none', padding: 0 }}>
                    <div className="suto-empty-container">
                      No Alarms configured. Click "Add Alarm" to get started.
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
          {alarms.length} of {alarms.length}
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
    </div>
  );
};

export default Alarm;
