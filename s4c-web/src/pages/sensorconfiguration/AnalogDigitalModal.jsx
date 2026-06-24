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

    let s0Val = undefined;
    let s1Val = undefined;
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
              ? t({ en: 'Edit analog & digital input', de: 'Analogen & digitalen Eingang bearbeiten', cn: '编辑模拟与数字输入' })
              : t({ en: 'Add analog & digital input', de: 'Analogen & digitalen Eingang hinzufügen', cn: '添加模拟与数字输入' })
            }
          </div>
          <div className="edit-channel-close" onClick={onClose}>
            <img src={iconBtnClose} alt={t({ en: 'Close', de: 'Schließen', cn: '关闭' })} style={{ width: 32, height: 32 }} />
          </div>
        </header>

        <div className="edit-channel-body">
          <div className="edit-form-item">
            <label className="edit-form-label">{t({ en: 'Input module', de: 'Eingangsmodul', cn: '输入模块' })}</label>
            <div className="edit-form-input-wrapper">
              <select 
                className="edit-form-input"
                style={{ appearance: 'auto', paddingRight: '10px' }}
                value={optionBoardType}
                onChange={handleOptionBoardTypeChange}
              >
                <option value={0}>{t({ en: 'Analog', de: 'Analog', cn: '模拟' })}</option>
                <option value={1}>{t({ en: 'Digital', de: 'Digital', cn: '数字' })}</option>
              </select>
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">{t({ en: 'Terminal', de: 'Klemme', cn: '端子' })}</label>
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
            <label className="edit-form-label">{t({ en: 'Sensor description', de: 'Sensorbeschreibung', cn: '传感器描述' })}</label>
            <div className="edit-form-input-wrapper">
              <input 
                className="edit-form-input" 
                value={sensorDescription}
                onChange={(e) => setSensorDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">{t({ en: 'Channel description', de: 'Kanalbeschreibung', cn: '通道描述' })}</label>
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
                <label className="edit-form-label">{t({ en: 'Signal', de: 'Signal', cn: '信号' })}</label>
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
                <label className="edit-form-label">{t({ en: 'Unit type', de: 'Einheitstyp', cn: '单位类型' })}</label>
                <div className="edit-form-input-wrapper">
                  <select 
                    className="edit-form-input"
                    style={{ appearance: 'auto', paddingRight: '10px' }}
                    value={uintType}
                    onChange={(e) => setUintType(e.target.value)}
                  >
                    <option value={0}>{t({ en: 'Flow', de: 'Durchfluss', cn: '流量' })}</option>
                    <option value={10}>{t({ en: 'Voltage', de: 'Spannung', cn: '电压' })}</option>
                    <option value={1}>{t({ en: 'Pressure', de: 'Druck', cn: '压力' })}</option>
                  </select>
                </div>
              </div>

              <div className="edit-form-item">
                <label className="edit-form-label">{t({ en: 'Unit', de: 'Einheit', cn: '单位' })}</label>
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
                <label className="edit-form-label">{t({ en: 'Resolution', de: 'Auflösung', cn: '分辨率' })}</label>
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
                <label className="edit-form-label">{t({ en: 'Scale Min', de: 'Skala Min', cn: '量程下限' })}</label>
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
                <label className="edit-form-label">{t({ en: 'Scale Max', de: 'Skala Max', cn: '量程上限' })}</label>
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
                <label className="edit-form-label">{t({ en: 'Type', de: 'Typ', cn: '类型' })}</label>
                <div className="edit-form-input-wrapper">
                  <select 
                    className="edit-form-input"
                    style={{ appearance: 'auto', paddingRight: '10px' }}
                    value={digitalType}
                    onChange={handleDigitalTypeChange}
                  >
                    <option value={0}>{t({ en: 'Counter', de: 'Zähler', cn: '计数器' })}</option>
                    <option value={1}>{t({ en: 'Runtime', de: 'Laufzeit', cn: '运行时间' })}</option>
                    <option value={2}>{t({ en: 'Status', de: 'Status', cn: '状态' })}</option>
                  </select>
                </div>
              </div>

              {Number(digitalType) === 0 && (
                <div className="edit-form-item">
                  <label className="edit-form-label">{t({ en: 'Display unit', de: 'Anzeigeeinheit', cn: '显示单位' })}</label>
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
                        <option value="Off">{t({ en: 'Off', de: 'Aus', cn: '关' })}</option>
                        <option value="On">{t({ en: 'On', de: 'An', cn: '开' })}</option>
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
                        <option value="Off">{t({ en: 'Off', de: 'Aus', cn: '关' })}</option>
                        <option value="On">{t({ en: 'On', de: 'An', cn: '开' })}</option>
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
                        <option value="Good">{t({ en: 'Good', de: 'Gut', cn: '正常' })}</option>
                        <option value="Failure">{t({ en: 'Failure', de: 'Fehler', cn: '故障' })}</option>
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
                        <option value="Good">{t({ en: 'Good', de: 'Gut', cn: '正常' })}</option>
                        <option value="Failure">{t({ en: 'Failure', de: 'Fehler', cn: '故障' })}</option>
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
          <button className="btn-edit-cancel" onClick={onClose}>{t({ en: 'Cancel', de: 'Abbrechen', cn: '取消' })}</button>
          <button className="btn-edit-confirm" onClick={handleConfirm}>{t({ en: 'Confirm', de: 'Bestätigen', cn: '确认' })}</button>
        </footer>
      </div>
    </div>
  );
};

export default AnalogDigitalModal;
