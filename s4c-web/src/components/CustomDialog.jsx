import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import './CustomDialog.css';
import smallWarnIcon from '../assets/images/small_warn_icon.png';
import smallInfoIcon from '../assets/images/small_info_icon.png';
import smallSuccIcon from '../assets/images/small_succ_icon.png';
import smallErrIcon from '../assets/images/small_err_icon.png';

const CustomDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  body = '',
  confirmText,
  cancelText,
  type = 'warn', // warn, info, succ, err
  showConfirm = true,
  showCancel = true,
  style = {}
}) => {
  const lang = useLanguage();
  const t = lang ? lang.t : (key) => key;
  if (!isOpen) return null;

  const displayTitle = title || t('Note');
  const displayConfirmText = confirmText || t('Confirm');
  const displayCancelText = cancelText || t('Cancel');

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
              <div className="custom-dialog-title">{displayTitle}</div>
            </div>
            <div className="custom-dialog-body">{body}</div>
          </div>
        </div>

        <div className="custom-dialog-footer">
          {showCancel && (
            <div className="custom-dialog-btn cancel" onClick={onClose}>
              {displayCancelText}
            </div>
          )}
          {showConfirm && (
            <div className="custom-dialog-btn confirm" onClick={onConfirm}>
              {displayConfirmText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomDialog;
