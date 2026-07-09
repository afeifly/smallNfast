import React, { useState, useEffect } from 'react';
import iconBtnClose from '../../assets/images/icon_btn_close.png';
import { useLanguage } from '../../context/LanguageContext';
import './AnalogDigitalModal.css';

const AnalogDigitalModal = ({ isOpen, onClose, initialData, onSave }) => {
  const [optionBoardType, setOptionBoardType] = useState(0); // 0: Analog, 1: Digital
  const [terminalNo, setTerminalNo] = useState(9);
  const [sensorDescription, setSensorDescription] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [analogSignalType, setAnalogSignalType] = useState(0);
  const [uintType, setUintType] = useState(0);
  const [preDefineUnit, setPreDefineUnit] = useState('');
  const [resolution, setResolution] = useState(1);
  const [minScale, setMinScale] = useState(0);
  const [maxScale, setMaxScale] = useState(10);
  const [digitalType, setDigitalType] = useState(0);
  const [digitalState0, setDigitalState0] = useState('Off');
  const [digitalState1, setDigitalState1] = useState('On');
  const { t } = useLanguage();

  useEffect(() => {
    if (initialData) {
      setOptionBoardType(initialData.OptionBoardType ?? 0);
      setTerminalNo(initialData.TerminalNo ?? 9);
      setSensorDescription(initialData.SensorDescription || '');
      
      // Strip status suffix (e.g. (0-Good/1-Failure) or (1-Good/0-Failure))
      let desc = initialData.ChannelDescription || '';
      if (Number(initialData.OptionBoardType) === 1 && Number(initialData.DigitalType) === 2) {
        desc = desc.replace(/\(0-Good\/1-Failure\)/g, '')
                   .replace(/\(1-Good\/0-Failure\)/g, '')
                   .replace(/\(0-正常\/1-故障\)/g, '')
                   .replace(/\(1-正常\/0-故障\)/g, '')
                   .replace(/\(0-.*?\/1-.*?\)/, '')
                   .replace(/\(1-.*?\/0-.*?\)/, '');
      }
      setChannelDescription(desc.trim());
      
      setAnalogSignalType(initialData.AnalogSignalType ?? 0);
      setUintType(initialData.UintType ?? 0);
      setPreDefineUnit(initialData.PreDefineUnit || initialData.DisplayUnit || '');
      setResolution(initialData.Resolution ?? 1);
      setMinScale(initialData.MinScale ?? 0);
      setMaxScale(initialData.MaxScale ?? 10);
      setDigitalType(initialData.DigitalType ?? 0);
      setDigitalState0(initialData.DigitalState0 ?? 'Off');
      setDigitalState1(initialData.DigitalState1 ?? 'On');
    } else {
      // Reset for new item
      setOptionBoardType(0);
      setTerminalNo(9);
      setSensorDescription('');
      setChannelDescription('');
      setAnalogSignalType(0);
      setUintType(0);
      setPreDefineUnit('');
      setResolution(1);
      setMinScale(0);
      setMaxScale(10);
      setDigitalType(0);
      setDigitalState0('Off');
      setDigitalState1('On');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleOptionBoardTypeChange = (e) => {
    const type = Number(e.target.value);
    setOptionBoardType(type);
    if (terminalNo < 9 || terminalNo > 16) {
      setTerminalNo(9);
    }
  };

  const handleDigitalTypeChange = (e) => {
    const type = Number(e.target.value);
    setDigitalType(type);
    if (type === 1) {
      setDigitalState0('Off');
      setDigitalState1('On');
    } else if (type === 2) {
      setDigitalState0('Good');
      setDigitalState1('Failure');
    }
  };

  const handleRuntimeState0Change = (val) => {
    setDigitalState0(val);
    setDigitalState1(val === 'On' ? 'Off' : 'On');
  };

  const handleRuntimeState1Change = (val) => {
    setDigitalState1(val);
    setDigitalState0(val === 'On' ? 'Off' : 'On');
  };

  const handleStatusState0Change = (val) => {
    setDigitalState0(val);
    setDigitalState1(val === 'Good' ? 'Failure' : 'Good');
  };

  const handleStatusState1Change = (val) => {
    setDigitalState1(val);
    setDigitalState0(val === 'Good' ? 'Failure' : 'Good');
  };

  const handleConfirm = () => {
    const isDigital = Number(optionBoardType) === 1;
    const term = Number(terminalNo);
    
    // Address check: 9-12 is 2, 13-16 is 3
    let addr = 1;
    if (term >= 9 && term <= 12) {
      addr = 2;
    } else if (term >= 13 && term <= 16) {
      addr = 3;
    }
    
    // ID check:
    // Analog Current (AnalogSignalType 0/1) -> 0x108B (4235)
    // Analog Voltage (AnalogSignalType 2/3) -> 0x108C (4236)
    // Digital -> 0x108D (4237)
    let obId = 0x108D;
    if (!isDigital) {
      const sigType = Number(analogSignalType);
      if (sigType === 0 || sigType === 1) {
        obId = 0x108B;
      } else {
        obId = 0x108C;
      }
    }

    // Status suffix check
    let channelDesc = channelDescription;
    if (isDigital && Number(digitalType) === 2) {
      const suffix = digitalState0 === 'Good' ? '(0-Good/1-Failure)' : '(1-Good/0-Failure)';
      if (!channelDesc.endsWith(suffix)) {
        channelDesc = channelDesc.replace(/\(0-Good\/1-Failure\)/g, '')
                                 .replace(/\(1-Good\/0-Failure\)/g, '')
                                 .replace(/\(0-正常\/1-故障\)/g, '')
                                 .replace(/\(1-正常\/0-故障\)/g, '')
                                 .replace(/\(0-.*?\/1-.*?\)/, '')
                                 .replace(/\(1-.*?\/0-.*?\)/, '')
                                 .trim() + suffix;
      }
    }

    let s0Val = 0;
    let s1Val = 1;
    if (isDigital) {
      if (Number(digitalType) === 1) {
        s0Val = digitalState0 === 'Off' ? 0 : 1;
        s1Val = digitalState0 === 'Off' ? 1 : 0;
      } else if (Number(digitalType) === 2) {
        s0Val = digitalState0 === 'Good' ? 0 : 1;
        s1Val = digitalState0 === 'Good' ? 1 : 0;
      }
    }

    onSave({
      ...initialData,
      OptionBoardType: Number(optionBoardType),
      TerminalNo: term,
      SensorDescription: sensorDescription,
      ChannelDescription: channelDesc,
      AnalogSignalType: isDigital ? 0 : Number(analogSignalType),
      UintType: isDigital ? 0 : Number(uintType),
      PreDefineUnit: isDigital && Number(digitalType) !== 0 ? '' : preDefineUnit,
      DisplayUnit: isDigital ? preDefineUnit : '',
      Resolution: isDigital ? 1 : Number(resolution),
      MinScale: isDigital ? 0 : Number(minScale),
      MaxScale: isDigital ? 10 : Number(maxScale),
      DigitalType: isDigital ? Number(digitalType) : 0,
      DigitalState0: isDigital && Number(digitalType) !== 0 ? digitalState0 : undefined,
      DigitalState1: isDigital && Number(digitalType) !== 0 ? digitalState1 : undefined,
      shown: true,
      ChannelId: 2000 + term,
      OptionBoardAddress: addr,
      OptionBoardID: obId,
      ChannelValid: false,
      Status0Value: s0Val,
      Status1Value: s1Val
    });
  };

  return (
    <div className="edit-channel-modal-overlay">
      <div className="edit-channel-modal" style={{ width: '560px' }}>
        {/* Header */}
        <header className="edit-channel-header">
          <div className="edit-channel-title">
            {initialData 
              ? t('Edit analog & digital input')
              : t('Add analog & digital input')
            }
          </div>
          <div className="edit-channel-close" onClick={onClose}>
            <img src={iconBtnClose} alt={t('Close')} style={{ width: 32, height: 32 }} />
          </div>
        </header>

        <div className="edit-channel-body">
          <div className="edit-form-item">
            <label className="edit-form-label">{t('Input module')}</label>
            <div className="edit-form-input-wrapper">
              <select 
                className="edit-form-input"
                style={{ appearance: 'auto', paddingRight: '10px' }}
                value={optionBoardType}
                onChange={handleOptionBoardTypeChange}
              >
                <option value={0}>{t('Analog')}</option>
                <option value={1}>{t('Digital')}</option>
              </select>
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">{t('Terminal')}</label>
            <div className="edit-form-input-wrapper">
              <select 
                className="edit-form-input"
                style={{ appearance: 'auto', paddingRight: '10px' }}
                value={terminalNo}
                onChange={(e) => setTerminalNo(e.target.value)}
              >
                {[9, 10, 11, 12, 13, 14, 15, 16].map(no => (
                  <option key={no} value={no}>x{no}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">{t('Sensor description')}</label>
            <div className="edit-form-input-wrapper">
              <input 
                className="edit-form-input" 
                value={sensorDescription}
                onChange={(e) => setSensorDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">{t('Channel description')}</label>
            <div className="edit-form-input-wrapper">
              <input 
                className="edit-form-input" 
                value={channelDescription}
                onChange={(e) => setChannelDescription(e.target.value)}
              />
            </div>
          </div>

          {Number(optionBoardType) === 0 ? (
            <>
              <div className="edit-form-item">
                <label className="edit-form-label">{t('Signal')}</label>
                <div className="edit-form-input-wrapper">
                  <select 
                    className="edit-form-input"
                    style={{ appearance: 'auto', paddingRight: '10px' }}
                    value={analogSignalType}
                    onChange={(e) => setAnalogSignalType(e.target.value)}
                  >
                    <option value={0}>4-20mA</option>
                    <option value={1}>0-20mA</option>
                    <option value={2}>0-1V</option>
                    <option value={3}>0-10V</option>
                  </select>
                </div>
              </div>

              <div className="edit-form-item">
                <label className="edit-form-label">{t('Unit type')}</label>
                <div className="edit-form-input-wrapper">
                  <select 
                    className="edit-form-input"
                    style={{ appearance: 'auto', paddingRight: '10px' }}
                    value={uintType}
                    onChange={(e) => setUintType(e.target.value)}
                  >
                    <option value={0}>{t('Flow')}</option>
                    <option value={10}>{t('Voltage')}</option>
                    <option value={1}>{t('Pressure')}</option>
                  </select>
                </div>
              </div>

              <div className="edit-form-item">
                <label className="edit-form-label">{t('Unit')}</label>
                <div className="edit-form-input-wrapper">
                  <input 
                    className="edit-form-input" 
                    value={preDefineUnit}
                    onChange={(e) => setPreDefineUnit(e.target.value)}
                    placeholder="e.g. V, A, m3/h"
                  />
                </div>
              </div>

              <div className="edit-form-item">
                <label className="edit-form-label">{t('Resolution')}</label>
                <div className="edit-form-input-wrapper">
                  <select 
                    className="edit-form-input"
                    style={{ appearance: 'auto', paddingRight: '10px' }}
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                  >
                    <option value="0">1</option>
                    <option value="1">0.1</option>
                    <option value="2">0.01</option>
                    <option value="3">0.001</option>
                    <option value="4">0.0001</option>
                    <option value="5">0.00001</option>
                    <option value="6">0.000001</option>
                  </select>
                </div>
              </div>

              <div className="edit-form-item">
                <label className="edit-form-label">{t('Scale Min')}</label>
                <div className="edit-form-input-wrapper">
                  <input 
                    type="number"
                    className="edit-form-input" 
                    value={minScale}
                    onChange={(e) => setMinScale(e.target.value)}
                  />
                </div>
              </div>

              <div className="edit-form-item">
                <label className="edit-form-label">{t('Scale Max')}</label>
                <div className="edit-form-input-wrapper">
                  <input 
                    type="number"
                    className="edit-form-input" 
                    value={maxScale}
                    onChange={(e) => setMaxScale(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="edit-form-item">
                <label className="edit-form-label">{t('Type')}</label>
                <div className="edit-form-input-wrapper">
                  <select 
                    className="edit-form-input"
                    style={{ appearance: 'auto', paddingRight: '10px' }}
                    value={digitalType}
                    onChange={handleDigitalTypeChange}
                  >
                    <option value={0}>{t('Counter')}</option>
                    <option value={1}>{t('Runtime')}</option>
                    <option value={2}>{t('Status')}</option>
                  </select>
                </div>
              </div>

              {Number(digitalType) === 0 && (
                <div className="edit-form-item">
                  <label className="edit-form-label">{t('Display unit')}</label>
                  <div className="edit-form-input-wrapper">
                    <input 
                      className="edit-form-input" 
                      value={preDefineUnit}
                      onChange={(e) => setPreDefineUnit(e.target.value)}
                      placeholder="e.g. m3, kWh"
                    />
                  </div>
                </div>
              )}

              {Number(digitalType) === 1 && (
                <>
                  <div className="edit-form-item">
                    <label className="edit-form-label">0</label>
                    <div className="edit-form-input-wrapper">
                      <select 
                        className="edit-form-input"
                        style={{ appearance: 'auto', paddingRight: '10px' }}
                        value={digitalState0}
                        onChange={(e) => handleRuntimeState0Change(e.target.value)}
                      >
                        <option value="Off">{t('Off')}</option>
                        <option value="On">{t('On')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="edit-form-item">
                    <label className="edit-form-label">1</label>
                    <div className="edit-form-input-wrapper">
                      <select 
                        className="edit-form-input"
                        style={{ appearance: 'auto', paddingRight: '10px' }}
                        value={digitalState1}
                        onChange={(e) => handleRuntimeState1Change(e.target.value)}
                      >
                        <option value="Off">{t('Off')}</option>
                        <option value="On">{t('On')}</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {Number(digitalType) === 2 && (
                <>
                  <div className="edit-form-item">
                    <label className="edit-form-label">0</label>
                    <div className="edit-form-input-wrapper">
                      <select 
                        className="edit-form-input"
                        style={{ appearance: 'auto', paddingRight: '10px' }}
                        value={digitalState0}
                        onChange={(e) => handleStatusState0Change(e.target.value)}
                      >
                        <option value="Good">{t('Good')}</option>
                        <option value="Failure">{t('Failure')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="edit-form-item">
                    <label className="edit-form-label">1</label>
                    <div className="edit-form-input-wrapper">
                      <select 
                        className="edit-form-input"
                        style={{ appearance: 'auto', paddingRight: '10px' }}
                        value={digitalState1}
                        onChange={(e) => handleStatusState1Change(e.target.value)}
                      >
                        <option value="Good">{t('Good')}</option>
                        <option value="Failure">{t('Failure')}</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="edit-channel-footer">
          <button className="btn-edit-cancel" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn-edit-confirm" onClick={handleConfirm}>{t('Confirm')}</button>
        </footer>
      </div>
    </div>
  );
};

export default AnalogDigitalModal;
