import React from 'react';
import ReadoutView from '../modules/readout/ReadoutView';
import { resolveLoggerType } from '../modules/readout/readoutSession';
import './ReadLoggerModal.css';

export { resolveLoggerType };

export default function ReadLoggerModal({
  isOpen,
  onClose,
  deviceInfo,
  onAnalyzeCsv,
}) {
  if (!isOpen) return null;

  return (
    <div className="read-logger-overlay" onClick={onClose}>
      <div
        className="read-logger-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '92vw', maxWidth: '1100px', height: '88vh' }}
      >
        <ReadoutView
          deviceInfo={deviceInfo}
          onAnalyzeCsv={onAnalyzeCsv}
          isModal={true}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
