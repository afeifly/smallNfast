import React, { useState } from 'react';
import './ModbusTCP.css';

const ModbusTCP = () => {
  const [dhcp, setDhcp] = useState(false);
  const [ipAddress, setIpAddress] = useState('192.168.1.100');
  const [subnetMask, setSubnetMask] = useState('255.255.255.0');
  const [gateway, setGateway] = useState('192.168.1.1');
  const [port, setPort] = useState('502');

  const handleSave = () => {
    console.log('Saving Modbus TCP data:', { dhcp, ipAddress, subnetMask, gateway, port });
    // TODO: Persist to config
  };

  const handleCancel = () => {
    setDhcp(false);
    setIpAddress('192.168.1.100');
    setSubnetMask('255.255.255.0');
    setGateway('192.168.1.1');
    setPort('502');
  };

  return (
    <div className="content-card modbus-tcp-page">
      {/* Header */}
      <header className="modbus-header">
        <h2 className="modbus-title">Modbus TCP connection information</h2>
      </header>

      {/* Content Body */}
      <div className="modbus-body">
        <div className="modbus-row">
          {/* Protocol */}
          <div className="modbus-field">
            <label className="modbus-label">Protocol <span className="required">*</span></label>
            <div className="modbus-input-readonly">
              <span>TCP</span>
            </div>
          </div>

          {/* DHCP Switch */}
          <div className="modbus-field">
            <label className="modbus-label">DHCP Enable</label>
            <div 
              className={`modbus-switch ${dhcp ? 'on' : ''}`} 
              onClick={() => setDhcp(!dhcp)}
            >
              <div className="switch-knob"></div>
            </div>
          </div>
        </div>

        {!dhcp && (
          <>
            <div className="modbus-row">
              {/* IP Address */}
              <div className="modbus-field">
                <label className="modbus-label">IP address <span className="required">*</span></label>
                <div className="modbus-input-container">
                  <input 
                    type="text"
                    className="modbus-input"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    placeholder="0.0.0.0"
                  />
                </div>
              </div>

              {/* Subnet Mask */}
              <div className="modbus-field">
                <label className="modbus-label">Sub mask <span className="required">*</span></label>
                <div className="modbus-input-container">
                  <input 
                    type="text"
                    className="modbus-input"
                    value={subnetMask}
                    onChange={(e) => setSubnetMask(e.target.value)}
                    placeholder="255.255.255.0"
                  />
                </div>
              </div>
            </div>

            <div className="modbus-row">
              {/* Default Gateway */}
              <div className="modbus-field">
                <label className="modbus-label">Default gateway <span className="required">*</span></label>
                <div className="modbus-input-container">
                  <input 
                    type="text"
                    className="modbus-input"
                    value={gateway}
                    onChange={(e) => setGateway(e.target.value)}
                    placeholder="0.0.0.0"
                  />
                </div>
              </div>

              {/* Port */}
              <div className="modbus-field">
                <label className="modbus-label">Port <span className="required">*</span></label>
                <div className="modbus-input-container">
                  <input 
                    type="number"
                    className="modbus-input"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="modbus-footer">
        <button className="btn-modbus-cancel" onClick={handleCancel}>Cancel</button>
        <button className="btn-modbus-save" onClick={handleSave}>Save</button>
      </footer>
    </div>
  );
};

export default ModbusTCP;
