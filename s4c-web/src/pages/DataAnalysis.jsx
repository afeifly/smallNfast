import React from 'react';
import iconAlertBig from '../assets/images/icon_alert_big.png';
import { useLanguage } from '../context/LanguageContext';

const DataAnalysis = () => {
  const { t } = useLanguage();
  return (
    <div className="content-card" style={{ padding: '48px' }}>
      <div className="empty-state" style={{ maxWidth: '480px', margin: '0 auto', gap: '20px', textAlign: 'center' }}>
        <img src={iconAlertBig} alt="Alert" style={{ width: 68, height: 68, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
        <h3 style={{ margin: 0, fontSize: '18px', color: '#1D2129', fontWeight: 600 }}>
          {t('Data Analysis')}
        </h3>
        <p className="empty-text" style={{ fontSize: '14px', color: '#86909C', fontWeight: 'normal', margin: 0, lineHeight: '1.5' }}>
          {t('Go to S4A-Web for Professional and Precise Data Analysis.')}
        </p>
        <a
          href="https://s4a.suto-portal.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            padding: '8px 24px',
            fontSize: '14px',
            fontWeight: '600',
            borderRadius: '4px',
            color: '#191919',
            background: 'var(--primary-color)', // Matches --primary-color: var(--primary-color)
            border: 'none',
            cursor: 'pointer',
            marginTop: '12px',
            transition: 'background 0.2s'
          }}
        >
          {t('Visit S4A-Web')}
        </a>
      </div>
    </div>
  );
};

export default DataAnalysis;
