import { useState, useEffect, useRef, useCallback } from 'react';
import './FileVerification.css';
import { calculateSHA512, parseVerificationFile } from '../../util/verificationUtils';
import { useLanguage } from '../../context/LanguageContext';

const FileVerification = () => {
  const { t } = useLanguage();
  const [dataFile, setDataFile] = useState(null);
  const [fvFile, setFvFile] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'verifying' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const processFiles = (files) => {
    let data = null;
    let txt = null;
    let hasInvalid = false;

    files.forEach(file => {
      const nameLower = file.name.toLowerCase();
      if (nameLower.endsWith('.csv') || nameLower.endsWith('.xls') || nameLower.endsWith('.xlsx')) {
        data = file;
      } else if (nameLower.endsWith('.txt')) {
        txt = file;
      } else {
        hasInvalid = true;
      }
    });

    if (hasInvalid) {
      setStatus('error');
      setErrorMessage(t('not valid file'));
      return;
    }

    if (data) {
      setDataFile(data);
      if (status === 'error') {
        setStatus('idle');
        setErrorMessage('');
      }
    }
    if (txt) {
      setFvFile(txt);
      if (status === 'error') {
        setStatus('idle');
        setErrorMessage('');
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const runVerification = useCallback(async () => {
    if (!dataFile || !fvFile) return;
    setStatus('verifying');
    setErrorMessage('');

    try {
      // 1. Parse Verification File
      const text = await fvFile.text();
      const parsed = parseVerificationFile(text);

      if (!parsed || !parsed.expectedHash) {
        setStatus('error');
        setErrorMessage(t('not valid file'));
        return;
      }

      // 2. Calculate Data File Hash
      const hash = await calculateSHA512(dataFile);

      // 3. Compare
      if (hash.toLowerCase() === parsed.expectedHash.toLowerCase()) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(t('Verification failed'));
      }
    } catch (err) {
      console.error('[FileVerification] Error during verification:', err);
      setStatus('error');
      setErrorMessage(t('Verification failed'));
    }
  }, [dataFile, fvFile]);

  // Run validation whenever both files are loaded
  useEffect(() => {
    runVerification();
  }, [runVerification]);

  const renderResultBox = () => {
    if (status === 'idle') {
      return (
        <div className="result-box" style={{ justifyContent: 'center' }}>
          {t('Pending upload of CSV/Excel and verification files...')}
        </div>
      );
    }
    if (status === 'verifying') {
      return (
        <div className="result-box verifying" style={{ justifyContent: 'center' }}>
          {t('Verifying signatures...')}
        </div>
      );
    }
    if (status === 'success') {
      return (
        <div className="result-box success" style={{ backgroundColor: '#00B42A', color: 'white', borderColor: '#00B42A', justifyContent: 'center' }}>
          {t('Pass')}
        </div>
      );
    }
    if (status === 'error') {
      return (
        <div className="result-box error" style={{ backgroundColor: '#FF7200', color: 'white', borderColor: '#FF7200', justifyContent: 'center' }}>
          {errorMessage || t('Verification failed')}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="content-card verification-page">
      <header className="verification-header">
        <h2 className="verification-title">{t('Import File & Verification')}</h2>
      </header>

      <div className="verification-body">
        {/* Row 1: Upload & verify */}
        <div className="verification-row">
          <div className="verification-label-container">
            <span className="verification-label">{t('Upload & verify')}</span>
          </div>
          <div className="verification-content">
            <div
              className={`upload-zone ${isDragging ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                className="file-input-hidden"
                ref={fileInputRef}
                multiple
                accept=".csv,.txt,.xls,.xlsx"
                onChange={(e) => {
                  if (e.target.files) {
                    processFiles(Array.from(e.target.files));
                  }
                }}
              />

              <svg className="upload-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>

              <div className="upload-text">{t('Upload & verify')}</div>
            </div>

            {/* Display selected files */}
            {(dataFile || fvFile) && (
              <div className="file-cards-list">
                {dataFile && (
                  <div className="file-card">
                    <span className="file-icon">📊</span>
                    <span className="file-name" title={dataFile.name}>{dataFile.name}</span>
                    <span className="file-size">({(dataFile.size / 1024).toFixed(1)} KB)</span>
                    <span className="icon-check">✓</span>
                    <button className="btn-remove" onClick={(e) => { e.stopPropagation(); setDataFile(null); setStatus('idle'); }}>&times;</button>
                  </div>
                )}
                {fvFile && (
                  <div className="file-card">
                    <span className="file-icon">📄</span>
                    <span className="file-name" title={fvFile.name}>{fvFile.name}</span>
                    <span className="file-size">({(fvFile.size / 1024).toFixed(1)} KB)</span>
                    <span className="icon-check">✓</span>
                    <button className="btn-remove" onClick={(e) => { e.stopPropagation(); setFvFile(null); setStatus('idle'); }}>&times;</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Verification Result */}
        <div className="verification-row">
          <div className="verification-label-container">
            <span className="verification-label">{t('Verification Result')}</span>
          </div>
          <div className="verification-content">
            {renderResultBox()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileVerification;
