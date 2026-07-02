import React, { useState, useEffect, useRef } from 'react';
import { useConfig } from '../../context/ConfigContext';
import iconBtnClose from '../../assets/images/icon_btn_close.png';
import CustomDialog from '../../components/CustomDialog';
import { useLanguage } from '../../context/LanguageContext';
import './FormulaEditorModal.css';

const FormulaEditorModal = ({ isOpen, onClose, initialFormula, onConfirm }) => {
  const { configData } = useConfig();
  const [formula, setFormula] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { t } = useLanguage();

  const timerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setFormula(initialFormula || '');
    }
  }, [isOpen, initialFormula]);

  // Extract all channels from all sensors for the selection list
  const sensors = (
    configData?.configs?.['/config/SUTO-SensorList.sutolist']?.cfgsensor ||
    configData?.configs?.['config/SUTO-SensorList.sutolist']?.cfgsensor ||
    []
  );

  const obConfigPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgOptionBoard.json'));
  const obItems = configData?.configs?.[obConfigPath]?.cfgOptionBoard || [];

  const allChannels = [];
  let globalId = 0;
  sensors.forEach(sensor => {
    (sensor.cfgchannel || []).forEach((ch) => {
      const cid = ch.ChannelId ?? ch.channelid ?? ch.ChannelID ?? globalId;
      allChannels.push({
        id: globalId,
        sensorName: sensor.Name,
        channelName: ch.ChannelDescription,
        displayName: `${sensor.Name}.${ch.ChannelDescription}`,
        channelId: cid
      });
      globalId++;
    });
  });

  obItems.forEach((item) => {
    const cid = item.ChannelId ?? item.channelid ?? item.ChannelID ?? globalId;
    allChannels.push({
      id: globalId,
      sensorName: item.SensorDescription || 'Option Board',
      channelName: item.ChannelDescription,
      displayName: `${item.SensorDescription || 'Option Board'}.${item.ChannelDescription}`,
      channelId: cid
    });
    globalId++;
  });

  const filteredChannels = allChannels.filter(ch => 
    ch.sensorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ch.channelName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  const handleKeyPressed = (value) => {
    if (value === 'X') {
      setFormula('');
    } else if (value === 'backspace') {
      setFormula(prev => removeLastCharacterOrBracketContent(prev));
    } else {
      setFormula(prev => prev + value);
    }
  };

  const handleBackspaceStart = () => {
    timerRef.current = setTimeout(() => {
      setFormula('');
      timerRef.current = null;
    }, 800); // 800ms long press to clear all
  };

  const handleBackspaceEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      handleKeyPressed('backspace');
      timerRef.current = null;
    }
  };

  const removeLastCharacterOrBracketContent = (str) => {
    const lastChar = str.charAt(str.length - 1);
    if (lastChar === ']') {
      const openingBracketIndex = str.lastIndexOf('[');
      if (openingBracketIndex > -1) {
        return str.slice(0, openingBracketIndex);
      }
    }
    return str.slice(0, -1);
  };

  const handleConfirm = () => {
    if (!formula.trim()) {
      onConfirm('');
      onClose();
      return;
    }

    // Basic validation: try to evaluate the expression by replacing [id] with 1
    try {
      // Replace [any number] with 1 for a dry-run evaluation
      const testFormula = formula.replace(/\[\d+\]/g, '1').replace(/π/g, 'Math.PI').replace(/√(\d+)/g, 'Math.sqrt($1)').replace(/√\(/g, 'Math.sqrt(');
      
      // Use Function constructor for a basic syntax check
      // This will throw if the syntax is invalid like "2+" or "(2"
      new Function(`return ${testFormula}`);
      
      onConfirm(formula);
      onClose();
    } catch (e) {
      setErrorMessage(t('Formula format is invalid. Please check your operators, brackets, and numbers.'));
      setShowErrorDialog(true);
    }
  };

  const allTokens = [
    '+', '-', '*', '/', '(', ')', 'π', '√', '.', 'backspace',
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'
  ];

  return (
    <>
      <div className="formula-modal-overlay">
        <div className="formula-modal">
          {/* Header */}
          <div className="formula-header">
            <div style={{ width: '586px', flexShrink: 0 }}>
              <div className="formula-header-left">
                <h2 className="formula-title">{t('Create formula')}</h2>
                <p className="formula-subtitle">{t('Create a new virtual channel for complex calculations')}</p>
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
                    placeholder={t('please search sensor name')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="formula-close" onClick={onClose}>
                <img src={iconBtnClose} alt={t('Close')} style={{ width: 32, height: 32 }} />
              </div>
            </div>
          </div>

          <div className="formula-content">
            {/* Left Side: Builder & Keypad */}
            <div className="formula-left">
              <div className="formula-display-area">
                <label>{t('Formula')}</label>
                <div className="formula-builder-box">
                  {formula ? <span className="formula-text-display">{formula}</span> : <span className="formula-placeholder">{t('Your formula will appear here...')}</span>}
                </div>
              </div>

              <div className="formula-keypad-section">
                <div className="keypad-group">
                  <label>{t('Operators')}</label>
                  <div className="keypad-grid-unified">
                    {allTokens.map((token, idx) => (
                      token === 'backspace' ? (
                        <button 
                          key="back" 
                          className="key-btn backspace-btn" 
                          onMouseDown={handleBackspaceStart}
                          onMouseUp={handleBackspaceEnd}
                          onMouseLeave={handleBackspaceEnd}
                          onTouchStart={handleBackspaceStart}
                          onTouchEnd={handleBackspaceEnd}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                            <line x1="18" y1="9" x2="12" y2="15" />
                            <line x1="12" y1="9" x2="18" y2="15" />
                          </svg>
                        </button>
                      ) : (
                        <button 
                          key={idx} 
                          className={`key-btn number-btn`} 
                          onClick={() => handleKeyPressed(token)}
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
                      <th style={{ width: '40px' }}>{t('ID')}</th>
                      <th style={{ width: '100px' }}>{t('Sensor')}</th>
                      <th>{t('Channel')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredChannels.map(ch => (
                      <tr key={`${ch.sensorName}-${ch.channelId}`} onClick={() => handleKeyPressed(`[${ch.channelId}]`)}>
                        <td>[{ch.channelId}]</td>
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
            <button className="btn-formula-cancel" onClick={onClose}>{t('Cancel')}</button>
            <button className="btn-formula-confirm" onClick={handleConfirm}>{t('Confirm')}</button>
          </div>
        </div>
      </div>

      <CustomDialog
        isOpen={showErrorDialog}
        onClose={() => setShowErrorDialog(false)}
        onConfirm={() => setShowErrorDialog(false)}
        title={t('Warning Notification')}
        body={errorMessage}
        confirmText={t('OK')}
        showCancel={false}
        type="err"
      />
    </>
  );
};

export default FormulaEditorModal;
