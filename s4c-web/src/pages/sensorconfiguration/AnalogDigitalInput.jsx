import React, { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import AnalogDigitalModal from './AnalogDigitalModal';
import iconBtnEdit from '../../assets/images/icon_btn_edit.png';
import iconBtnDelete from '../../assets/images/icon_btn_delete.png';
import './SUTOSensor.css';

const AnalogDigitalInput = () => {
  const { configData } = useConfig();
  const [items, setItems] = useState([]); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const handleSave = (newItem) => {
    if (editingItem) {
      setItems(items.map(item => item === editingItem ? newItem : item));
    } else {
      setItems([...items, newItem]);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="content-card suto-sensor-page">
      {/* Header */}
      <header className="suto-header">
        <h2 className="suto-title">Analog & digital input list</h2>
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
          <span>Create Analog & digital input</span>
        </button>
      </header>

      {/* Body */}
      <div className="suto-body">
        <div className="suto-table-container">
          <table className="suto-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Terminal</th>
                <th>Sensor</th>
                <th>Channel</th>
                <th>Signal</th>
                <th className="col-operate">Operate</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.Module || '---'}</td>
                    <td>{item.Terminal || '---'}</td>
                    <td>{item.Sensor || '---'}</td>
                    <td>{item.Channel || '---'}</td>
                    <td>{item.Signal || '---'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn-icon-img" 
                          title="Edit"
                          onClick={() => {
                            setEditingItem(item);
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
                  <td colSpan={6} style={{ borderBottom: 'none', padding: 0 }}>
                    <div className="suto-empty-container">
                      No Analog & digital input configured. Click "Create Analog & digital input"
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
          {items.length} of {items.length}
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
    </div>
  );
};

export default AnalogDigitalInput;
