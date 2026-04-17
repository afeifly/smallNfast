import React, { useState, useEffect } from 'react';
import '../pages/Graphic.css';

const ChannelSelectModal = ({ 
  isOpen, 
  onClose, 
  onSettingClick, 
  onConfirm, 
  allChannels = [], 
  initialSelectedIds = [] 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  // Initialize selection from prop
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(initialSelectedIds);
    }
  }, [isOpen, initialSelectedIds]);

  if (!isOpen) return null;

  const filteredChannels = allChannels.filter(ch =>
    ch.sensorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ch.channelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ch.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ch.point.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        if (prev.length >= 5) {
          alert('You can only select up to 5 channels for this graphic.');
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm(selectedIds);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <div className="modal-header-content">
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Channel configuration</h3>
            <div className="search-input-wrapper" style={{ width: '320px' }}>
              <input
                type="text"
                placeholder="please search sensor name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="search-icon" style={{ right: '10px', left: 'auto' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span>
            </div>
          </div>
          <div className="modal-close-btn" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </header>

        <div className="modal-content-area">
          <table className="channel-table">
            <thead>
              <tr>
                <th style={{ width: '54px', textAlign: 'center' }}>
                  <div
                    className={`custom-checkbox ${selectedIds.length === filteredChannels.length && filteredChannels.length > 0 ? 'checked' : ''}`}
                    style={{ margin: '0 auto', cursor: 'pointer' }}
                    onClick={() => {
                      if (selectedIds.length === filteredChannels.length) {
                        setSelectedIds([]);
                      } else {
                        setSelectedIds(filteredChannels.slice(0, 5).map(ch => ch.CreateTime));
                      }
                    }}
                  ></div>
                </th>
                <th>Sensor</th>
                <th>Channel</th>
                <th>Unit</th>
                <th>Location</th>
                <th>Point</th>
                <th>Operate</th>
              </tr>
            </thead>
            <tbody>
              {filteredChannels.length > 0 ? (
                filteredChannels.map(ch => (
                  <tr key={ch.CreateTime} onClick={() => toggleSelection(ch.CreateTime)} style={{ cursor: 'pointer' }}>
                    <td style={{ textAlign: 'center' }}>
                      <div className={`custom-checkbox ${selectedIds.includes(ch.CreateTime) ? 'checked' : ''}`} style={{ margin: '0 auto' }}></div>
                    </td>
                    <td>{ch.sensorName}</td>
                    <td>{ch.channelName}</td>
                    <td>{ch.unit}</td>
                    <td>{ch.location}</td>
                    <td>{ch.point}</td>
                    <td>
                      <span
                        style={{ color: '#00AB84', cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSettingClick) onSettingClick(ch);
                        }}
                      >
                        Setting
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                    No channels found matching search
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="modal-footer">
          <button className="btn-drawer-confirm" style={{ width: '120px' }} onClick={handleConfirm}>Confirm</button>
          <button className="btn-drawer-cancel" style={{ width: '120px' }} onClick={onClose}>Cancel</button>
        </footer>
      </div>
    </div>
  );
};

export default ChannelSelectModal;
