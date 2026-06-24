import React, { useState, useEffect } from 'react';
import iconBtnClose from '../../assets/images/icon_btn_close.png';
import FormulaEditorModal from './FormulaEditorModal';
import CustomDialog from '../../components/CustomDialog';
import { useLanguage } from '../../context/LanguageContext';
import './VirtualChannelModal.css';

const VirtualChannelModal = ({ isOpen, onClose, initialData, onSave }) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [resolution, setResolution] = useState('1');
  const [formula, setFormula] = useState('');
  const [isFormulaEditorOpen, setIsFormulaEditorOpen] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.Name || '');
      setUnit(initialData.Unit || '');
      setResolution(initialData.Resolution?.toString() || '1');
      setFormula(initialData.Formula || '');
    } else {
      setName('');
      setUnit('');
      setResolution('1');
      setFormula('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!name.trim()) {
      setErrorMessage(t({ en: 'Please enter a virtual channel name.', de: 'Bitte geben Sie einen virtuellen Kanalnamen ein.', cn: '请输入虚拟通道名称。' }));
      setShowErrorDialog(true);
      return;
    }
    if (!formula.trim()) {
      setErrorMessage(t({ en: 'Please enter a formula.', de: 'Bitte geben Sie eine Formel ein.', cn: '请输入公式。' }));
      setShowErrorDialog(true);
      return;
    }

    onSave({
      Name: name,
      Unit: unit,
      Resolution: Number(resolution),
      Formula: formula,
      CreatedOn: initialData?.CreatedOn || new Date().toISOString().split('T')[0]
    });
    onClose();
  };

  return (
    <>
      <div className="edit-channel-modal-overlay">
        <div className="edit-channel-modal">
          {/* Header */}
          <header className="edit-channel-header">
            <div className="edit-channel-title">
              {initialData ? t({ en: 'Edit virtual channel', de: 'Virtuellen Kanal bearbeiten', cn: '编辑虚拟通道' }) : t({ en: 'Add virtual channel', de: 'Virtuellen Kanal hinzufügen', cn: '添加虚拟通道' })}
            </div>
            <div className="edit-channel-close" onClick={onClose}>
              <img src={iconBtnClose} alt="Close" style={{ width: 32, height: 32 }} />
            </div>
          </header>

          <div className="edit-channel-body">
            <div className="edit-form-item">
              <label className="edit-form-label">{t({ en: 'Virtual channel', de: 'Virtueller Kanal', cn: '虚拟通道' })}</label>
              <div className="edit-form-input-wrapper">
                <input
                  className="edit-form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t({ en: 'Enter channel name', de: 'Kanalname eingeben', cn: '输入通道名称' })}
                />
              </div>
            </div>

            <div className="edit-form-item">
              <label className="edit-form-label">{t({ en: 'Unit', de: 'Einheit', cn: '单位' })}</label>
              <div className="edit-form-input-wrapper">
                <input
                  className="edit-form-input"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder={t({ en: 'Enter unit', de: 'Einheit eingeben', cn: '输入单位' })}
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

            <div className="edit-form-item" style={{ alignItems: 'flex-start' }}>
              <label className="edit-form-label" style={{ marginTop: '8px' }}>{t({ en: 'Formula', de: 'Formel', cn: '公式' })}</label>
              <div className="edit-form-input-wrapper" style={{ height: '80px', padding: '0px' }}>
                <textarea
                  className="edit-form-input"
                  style={{ resize: 'none', background: '#F9FAFB', cursor: 'pointer', padding: '15px' }}
                  value={formula || t({ en: 'Click to create formula...', de: 'Klicken, um Formel zu erstellen...', cn: '点击创建公式...' })}
                  readOnly
                  onClick={() => setIsFormulaEditorOpen(true)}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="edit-channel-footer">
            <button className="btn-edit-cancel" onClick={onClose}>{t({ en: 'Cancel', de: 'Abbrechen', cn: '取消' })}</button>
            <button className="btn-edit-confirm" onClick={handleConfirm}>{t({ en: 'Confirm', de: 'Bestätigen', cn: '确认' })}</button>
          </footer>
        </div>
      </div>

      <FormulaEditorModal
        isOpen={isFormulaEditorOpen}
        onClose={() => setIsFormulaEditorOpen(false)}
        initialFormula={formula}
        onConfirm={(newFormula) => setFormula(newFormula)}
      />

      <CustomDialog
        isOpen={showErrorDialog}
        onClose={() => setShowErrorDialog(false)}
        onConfirm={() => setShowErrorDialog(false)}
        title={t({ en: 'Warning Notification', de: 'Warnhinweis', cn: '警告通知' })}
        body={errorMessage}
        confirmText={t({ en: 'OK', de: 'OK', cn: '好的' })}
        showCancel={false}
        type="err"
      />
    </>
  );
};

export default VirtualChannelModal;
