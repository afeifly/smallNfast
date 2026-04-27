import React, { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import iconBtnClose from '../../assets/images/icon_btn_close.png';
import './FormulaEditorModal.css';

const FormulaEditorModal = ({ isOpen, onClose, initialFormula, onConfirm }) => {
  const { configData } = useConfig();
  const [formulaItems, setFormulaItems] = useState([]); // Array of strings/tokens
  const [searchQuery, setSearchQuery] = useState('');

  // Extract all channels from all sensors for the selection list
  const sensors = (
    configData?.configs?.['/config/SUTO-SensorList.sutolist']?.cfgsensor ||
    configData?.configs?.['config/SUTO-SensorList.sutolist']?.cfgsensor ||
    []
  );

  const allChannels = [];
  sensors.forEach(sensor => {
    (sensor.cfgchannel || []).forEach(ch => {
      allChannels.push({
        id: allChannels.length,
        sensorName: sensor.Name,
        channelName: ch.ChannelDescription,
        displayName: `${sensor.Name}.${ch.ChannelDescription}`
      });
    });
  });

  const filteredChannels = allChannels.filter(ch => 
    ch.sensorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ch.channelName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  const addToken = (token) => {
    setFormulaItems([...formulaItems, token]);
  };

  const removeLastToken = () => {
    setFormulaItems(formulaItems.slice(0, -1));
  };

  const handleConfirm = () => {
    onConfirm(formulaItems.join(' '));
    onClose();
  };

  const allTokens = [
    '+', '-', '*', '/', '(', ')', 'π', '√', '.', 'backspace',
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'
  ];

  return (
    <div className="formula-modal-overlay">
      <div className="formula-modal">
        {/* Header */}
        <div className="formula-header">
          <div style={{ width: '586px', flexShrink: 0 }}>
            <div className="formula-header-left">
              <h2 className="formula-title">Create formula</h2>
              <p className="formula-subtitle">Create a new virtual channel for complex calculations</p>
            </div>
          </div>
          
          <div style={{ width: '24px' }}></div> {/* Gap alignment */}

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="formula-search-container">
              <div className="search-box">
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input 
                  type="text" 
                  placeholder="please search sensor name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="formula-close" onClick={onClose}>
              <img src={iconBtnClose} alt="Close" style={{ width: 32, height: 32 }} />
            </div>
          </div>
        </div>

        <div className="formula-content">
          {/* Left Side: Builder & Keypad */}
          <div className="formula-left">
            <div className="formula-display-area">
              <label>Formula</label>
              <div className="formula-builder-box">
                {formulaItems.map((item, idx) => (
                  <span key={idx} className="formula-token">{item}</span>
                ))}
                {formulaItems.length === 0 && <span className="formula-placeholder">Your formula will appear here...</span>}
              </div>
            </div>

            <div className="formula-keypad-section">
              <div className="keypad-group">
                <label>Operators</label>
                <div className="keypad-grid-unified">
                  {allTokens.map((token, idx) => (
                    token === 'backspace' ? (
                      <button key="back" className="key-btn backspace-btn" onClick={removeLastToken}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                          <line x1="18" y1="9" x2="12" y2="15" />
                          <line x1="12" y1="9" x2="18" y2="15" />
                        </svg>
                      </button>
                    ) : (
                      <button 
                        key={idx} 
                        className={`key-btn ${token === '3' ? 'highlight' : ''}`} 
                        onClick={() => addToken(token)}
                      >
                        {token === '*' ? '×' : token === '/' ? '÷' : token}
                      </button>
                    )
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Sensor/Channel Table */}
          <div className="formula-right">
            <div className="channel-table-container">
              <table className="channel-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>ID</th>
                    <th style={{ width: '100px' }}>Sensor</th>
                    <th>Channel</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChannels.map(ch => (
                    <tr key={ch.id} onClick={() => addToken(ch.displayName)}>
                      <td>{ch.id}</td>
                      <td>{ch.sensorName}</td>
                      <td>{ch.channelName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="formula-footer">
          <button className="btn-formula-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-formula-confirm" onClick={handleConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

export default FormulaEditorModal;
