import React, { useState } from 'react';

const ChannelSelectModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const demoChannels = [
    { id: '1', sensor: 'S4038999', channel: 'Phase 1 Current', location: 'TCL e' },
    { id: '2', sensor: 'S4038998', channel: 'Phase 2 Current', location: 'TCL e' },
    { id: '3', sensor: 'S4038997', channel: 'Total Power', location: 'TCL e' },
    { id: '4', sensor: 'S4038996', channel: 'Phase 3 Voltage', location: 'Main Distribution' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        {/* Header - Fixed with YELLOW BACKGROUND for Close icon */}
        <header className="modal-header" style={{ height: '68px', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Channel configuration</h3>
            <div className="search-input-wrapper" style={{ width: '320px' }}>
              <input type="text" placeholder="please search sensor name" />
              <span className="search-icon" style={{ right: '10px', left: 'auto' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span>
            </div>
          </div>
          {/* Close Button with Yellow Background Container */}
          <div 
            onClick={onClose} 
            style={{ 
              cursor: 'pointer', 
              width: '32px', 
              height: '32px', 
              background: '#FFE000', 
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </header>

        <div className="modal-content-table" style={{ padding: '24px' }}>
          <table className="channel-table">
            <thead>
              <tr>
                <th style={{ width: '54px', textAlign: 'center' }}>
                  <div className="custom-checkbox" style={{ margin: '0 auto' }}></div>
                </th>
                <th>Sensor</th>
                <th>Channel</th>
                <th>Measurement Location</th>
              </tr>
            </thead>
            <tbody>
              {demoChannels.map(ch => (
                <tr key={ch.id}>
                  <td style={{ textAlign: 'center' }}>
                    <div className="custom-checkbox" style={{ margin: '0 auto' }}></div>
                  </td>
                  <td>{ch.sensor}</td>
                  <td>{ch.channel}</td>
                  <td>{ch.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer - Confirm is SPECIAL GREEN and on the LEFT */}
        <footer className="modal-footer" style={{ borderTop: '1px solid #E7E7E7', height: '72px', background: 'white' }}>
          <button 
            className="btn-primary" 
            style={{ 
              background: '#00AB84', 
              border: '1px solid #00AB84', 
              color: 'white',
              order: 1,
              width: '120px'
            }} 
            onClick={onClose}
          >
            Confirm
          </button>
          <button 
            className="btn-secondary" 
            style={{ 
              order: 2,
              width: '120px'
            }} 
            onClick={onClose}
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
};

const Graphic = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="content-card graphic-view">
      <header className="card-header">
        <div className="graphic-title">
          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>create chart name</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="add-graphic-btn" style={{ height: '32px', borderRadius: '4px', background: '#FFE000', border: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>add graphic</span>
          </button>
          <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </div>
        </div>
      </header>

      <div className="channel-bar">
        <div style={{ width: '40px', height: '72px', background: '#F3F3F3', borderRadius: '0 0 4px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </div>
        <div style={{ display: 'flex', gap: '4px', overflowX: 'hidden', flex: 1 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="channel-item" onClick={() => setIsModalOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              <span>Add Channel</span>
            </div>
          ))}
        </div>
        <div style={{ width: '40px', height: '72px', background: '#FFE000', borderRadius: '0 0 4px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>

      <div className="chart-section">
        <div className="y-axis-labels" style={{ fontWeight: 'bold' }}>
          <span>100</span>
          <span>40</span>
          <span>30</span>
          <span>20</span>
          <span>10</span>
          <span>0</span>
        </div>
        <div className="chart-area">
          <div className="grid-workspace"></div>
          <div className="x-axis-labels" style={{ fontWeight: 'bold' }}>
            <span>10:30:28</span>
            <span>10:50:28</span>
            <span>11:10:28</span>
            <span>11:30:28</span>
            <span>11:50:28</span>
            <span>12:10:28</span>
          </div>
        </div>
      </div>

      <div className="info-footer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4E5969" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>Please long press add channel for channel configuration!</span>
      </div>

      <ChannelSelectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default Graphic;
