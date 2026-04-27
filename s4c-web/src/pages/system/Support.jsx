import React, { useState } from 'react';
import './Support.css';

const Support = () => {
  const [supportInfo, setSupportInfo] = useState({
    companyName: 'SUTO iTEC GmbH',
    address: 'Grißheimer Weg 21, 79423 Heitersheim, Germany',
    telephone: '+49 (0) 7634 50488 00',
    email: 'sales@suto-itec.com',
    website: 'https://www.suto-itec.com'
  });

  const handleChange = (field, value) => {
    setSupportInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    console.log('Saving Support data:', supportInfo);
    // TODO: Persist to config
  };

  const handleCancel = () => {
    // Reset to default or initial (mock logic)
    setSupportInfo({
      companyName: 'SUTO iTEC GmbH',
      address: 'Grißheimer Weg 21, 79423 Heitersheim, Germany',
      telephone: '+49 (0) 7634 50488 00',
      email: 'sales@suto-itec.com',
      website: 'https://www.suto-itec.com'
    });
  };

  return (
    <div className="content-card support-page">
      {/* Header */}
      <header className="support-header">
        <h2 className="support-title">Support information</h2>
      </header>

      {/* Content Body */}
      <div className="support-body">
        <div className="support-row">
          {/* Service company name */}
          <div className="support-field">
            <label className="support-label">Service company name <span className="required">*</span></label>
            <div className="support-input-container">
              <input 
                type="text"
                className="support-input"
                value={supportInfo.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
              />
            </div>
          </div>

          {/* Address */}
          <div className="support-field">
            <label className="support-label">Address <span className="required">*</span></label>
            <div className="support-input-container">
              <input 
                type="text"
                className="support-input"
                value={supportInfo.address}
                onChange={(e) => handleChange('address', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="support-row">
          {/* Telephone */}
          <div className="support-field">
            <label className="support-label">Telephone <span className="required">*</span></label>
            <div className="support-input-container">
              <input 
                type="text"
                className="support-input"
                value={supportInfo.telephone}
                onChange={(e) => handleChange('telephone', e.target.value)}
              />
            </div>
          </div>

          {/* Email */}
          <div className="support-field">
            <label className="support-label">Email <span className="required">*</span></label>
            <div className="support-input-container">
              <input 
                type="email"
                className="support-input"
                value={supportInfo.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="support-row">
          {/* Website */}
          <div className="support-field">
            <label className="support-label">Website <span className="required">*</span></label>
            <div className="support-input-container">
              <input 
                type="url"
                className="support-input"
                value={supportInfo.website}
                onChange={(e) => handleChange('website', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="support-footer">
        <button className="btn-support-cancel" onClick={handleCancel}>Cancel</button>
        <button className="btn-support-save" onClick={handleSave}>Save</button>
      </footer>
    </div>
  );
};

export default Support;
