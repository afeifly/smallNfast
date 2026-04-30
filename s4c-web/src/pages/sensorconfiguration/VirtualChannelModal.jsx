import React, { useState, useEffect } from 'react';
import iconBtnClose from '../../assets/images/icon_btn_close.png';
import FormulaEditorModal from './FormulaEditorModal';
import './VirtualChannelModal.css';

const VirtualChannelModal = ({ isOpen, onClose, initialData, onSave }) => {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [resolution, setResolution] = useState('1');
  const [formula, setFormula] = useState('');
  const [isFormulaEditorOpen, setIsFormulaEditorOpen] = useState(false);

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
    onSave({
      Name: name,
      Unit: unit,
      Resolution: Number(resolution),
      Formula: formula,
      CreatedOn: initialData?.CreatedOn || new Date().toISOString().split('T')[0]
    });
  };

  return (
    <>
      <div className="edit-channel-modal-overlay">
        <div className="edit-channel-modal">
          {/* Header */}
          <header className="edit-channel-header">
            <div className="edit-channel-title">
              {initialData ? 'Edit virtual channel' : 'Add virtual channel'}
            </div>
            <div className="edit-channel-close" onClick={onClose}>
              <img src={iconBtnClose} alt="Close" style={{ width: 32, height: 32 }} />
            </div>
          </header>

          <div className="edit-channel-body">
            <div className="edit-form-item">
              <label className="edit-form-label">Virtual channel</label>
              <div className="edit-form-input-wrapper">
                <input
                  className="edit-form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter channel name"
                />
              </div>
            </div>

            <div className="edit-form-item">
              <label className="edit-form-label">Unit</label>
              <div className="edit-form-input-wrapper">
                <input
                  className="edit-form-input"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Enter unit"
                />
              </div>
            </div>

            <div className="edit-form-item">
              <label className="edit-form-label">Resolution</label>
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
              <label className="edit-form-label" style={{ marginTop: '8px' }}>Formula</label>
              <div className="edit-form-input-wrapper" style={{ height: '80px', padding: '0px' }}>
                <textarea
                  className="edit-form-input"
                  style={{ resize: 'none', background: '#F9FAFB', cursor: 'pointer' }}
                  value={formula || 'Click to create formula...'}
                  readOnly
                  onClick={() => setIsFormulaEditorOpen(true)}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="edit-channel-footer">
            <button className="btn-edit-cancel" onClick={onClose}>Cancel</button>
            <button className="btn-edit-confirm" onClick={handleConfirm}>Confirm</button>
          </footer>
        </div>
      </div>

      <FormulaEditorModal
        isOpen={isFormulaEditorOpen}
        onClose={() => setIsFormulaEditorOpen(false)}
        initialFormula={formula}
        onConfirm={(newFormula) => setFormula(newFormula)}
      />
    </>
  );
};

export default VirtualChannelModal;
