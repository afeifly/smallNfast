import React from 'react';
import './EditChannelModal.css';

const EditChannelModal = ({ isOpen, onClose, channelData }) => {
  if (!isOpen) return null;

  return (
    <div className="edit-channel-modal-overlay">
      <div className="edit-channel-modal">
        {/* Header */}
        <header className="edit-channel-header">
          <div className="edit-channel-title">Edit SUTO sensor channel</div>
          <div className="edit-channel-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </div>
        </header>

        {/* Body */}
        <div className="edit-channel-body">
          <div className="edit-form-item">
            <label className="edit-form-label">channel</label>
            <div className="edit-form-input-wrapper active">
              <input 
                className="edit-form-input" 
                defaultValue={channelData?.name || ''} 
                autoFocus 
              />
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">unit</label>
            <div className="edit-form-input-wrapper">
              <input 
                className="edit-form-input" 
                defaultValue={channelData?.unit || 'm3/h'} 
              />
            </div>
          </div>

          <div className="edit-form-item">
            <label className="edit-form-label">Resolution</label>
            <div className="edit-form-select">
              <span>{channelData?.resolution || '0.1'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="edit-channel-footer">
          <button className="btn-edit-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-edit-confirm" onClick={onClose}>Confirm</button>
        </footer>
      </div>
    </div>
  );
};

export default EditChannelModal;
