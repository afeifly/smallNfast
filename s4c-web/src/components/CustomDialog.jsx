import React from 'react';
import './CustomDialog.css';
import smallWarnIcon from '../assets/images/small_warn_icon.png';
import smallInfoIcon from '../assets/images/small_info_icon.png';
import smallSuccIcon from '../assets/images/small_succ_icon.png';
import smallErrIcon from '../assets/images/small_err_icon.png';

const CustomDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Note',
  body = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warn', // warn, info, succ, err
  showConfirm = true,
  showCancel = true,
  style = {}
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'info': return smallInfoIcon;
      case 'succ': return smallSuccIcon;
      case 'err': return smallErrIcon;
      case 'warn':
      default: return smallWarnIcon;
    }
  };

  return (
    <div className="custom-dialog-overlay" onClick={onClose}>
      <div
        className="custom-dialog-container"
        onClick={(e) => e.stopPropagation()}
        style={style}
      >
        <div className="custom-dialog-content">
          <div className="custom-dialog-icon-wrapper">
            <img src={getIcon()} alt={type} className="custom-dialog-icon" />
          </div>
          <div className="custom-dialog-text-wrapper">
            <div className="custom-dialog-header">
              <div className="custom-dialog-title">{title}</div>
            </div>
            <div className="custom-dialog-body">{body}</div>
          </div>
        </div>

        <div className="custom-dialog-footer">
          {showCancel && (
            <div className="custom-dialog-btn cancel" onClick={onClose}>
              {cancelText}
            </div>
          )}
          {showConfirm && (
            <div className="custom-dialog-btn confirm" onClick={onConfirm}>
              {confirmText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomDialog;
