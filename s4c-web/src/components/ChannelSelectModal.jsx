import React, { useState } from 'react';
import { useConfig } from '../context/ConfigContext';

const ChannelSelectModal = ({ isOpen, onClose, onSettingClick }) => {
  const { configData, setConfigData } = useConfig();
  const [searchTerm, setSearchTerm] = useState('');

  // Get current graphic config (assuming we're updating the first graphic in the list)
  const graphicConfigPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgGraphic.json'));
  const graphicList = configData?.configs?.[graphicConfigPath] || [];
  const currentGraphic = graphicList[0] || {};

  // Track selected IDs (CreateTime)
  const [selectedIds, setSelectedIds] = useState([]);

  // Initialize selection from config
  React.useEffect(() => {
    if (isOpen && currentGraphic.graphicChannels) {
      const activeIds = currentGraphic.graphicChannels
        .filter(c => c.isShow === true)
        .map(c => String(c.channelCreateTime));
      setSelectedIds(activeIds);
    }
  }, [isOpen, currentGraphic]);

  if (!isOpen) return null;

  // Extract channels from configData
  const sensors = configData?.configs?.['/config/SUTO-SensorList.sutolist']?.cfgsensor ||
    configData?.configs?.['config/SUTO-SensorList.sutolist']?.cfgsensor || [];

  // Get location/measurepoint mappings
  const configs = configData?.configs || {};
  const locationConfigPath = Object.keys(configs).find(p => p.endsWith('cfgLocation.json'));
  const locationJson = configs[locationConfigPath] || {};
  
  // Use the exact structure: Locations -> meapoints -> channels
  const locationsArray = locationJson.Locations || [];

  const allChannels = [];
  sensors.forEach(sensor => {
    if (sensor.cfgchannel) {
      sensor.cfgchannel.forEach(ch => {
        const createTimeStr = String(ch.CreateTime);

        // Find location info from cfgLocation.json nested structure
        let locationValue = '---';
        let pointValue = '---';

        // Search through the nested Locations -> meapoints structure
        if (Array.isArray(locationsArray)) {
          for (const locObj of locationsArray) {
            const meapoints = locObj.meapoints || [];
            if (Array.isArray(meapoints)) {
              const matchedPoint = meapoints.find(pointObj => 
                Array.isArray(pointObj.channels) && pointObj.channels.some(cid => String(cid) === createTimeStr)
              );
              
              if (matchedPoint) {
                // Get info from the matched point object
                locationValue = matchedPoint.location || '---';
                pointValue = matchedPoint.meapoint || '---';
                break; // Found the match, exit the loops
              }
            }
          }
        }

        allChannels.push({
          CreateTime: createTimeStr,
          sensorCreateTime: String(sensor.CreateTime || ''),
          sensorName: sensor.Name || sensor.Description,
          channelName: ch.ChannelDescription,
          location: locationValue,
          point: pointValue,
          unit: ch.UnitInASCII
        });
      });
    }
  });

  const filteredChannels = allChannels.filter(ch =>
    ch.sensorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ch.channelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ch.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ch.point.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        if (prev.length >= 5) {
          alert('You can only select up to 5 channels for this graphic.');
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  const handleConfirm = () => {
    if (!graphicConfigPath || graphicList.length === 0) {
      onClose();
      return;
    }

    const updatedGraphicList = [...graphicList];
    const targetGraphic = { ...updatedGraphicList[0] };

    // Update isShow based on selection
    const updatedGraphicChannels = allChannels.map((ch, index) => {
      const existing = (targetGraphic.graphicChannels || []).find(gc => String(gc.channelCreateTime) === String(ch.CreateTime));

      return {
        isShow: selectedIds.includes(ch.CreateTime),
        channelIndex: index,
        channelId: index,
        channelSensorId: 0,
        sensorCreateTime: ch.sensorCreateTime,
        channelCreateTime: ch.CreateTime,
        channelSensorName: ch.sensorName,
        channelName: ch.channelName,
        channelUnitInASCII: ch.unit,
        isAutomaticScale: existing ? existing.isAutomaticScale : true,
        yMin: existing ? existing.yMin : 0,
        yMax: existing ? existing.yMax : 100,
        color: existing ? existing.color : (index === 0 ? '#019A68' : index === 1 ? '#04CD94' : index === 2 ? '#6FB996' : index === 3 ? '#008F85' : '#1E7FF7')
      };
    }).slice(0, 5);

    targetGraphic.graphicChannels = updatedGraphicChannels;
    updatedGraphicList[0] = targetGraphic;

    setConfigData({
      ...configData,
      configs: {
        ...configData.configs,
        [graphicConfigPath]: updatedGraphicList
      }
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Channel configuration</h3>
            <div className="search-input-wrapper" style={{ width: '320px' }}>
              <input
                type="text"
                placeholder="please search sensor name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="search-icon" style={{ right: '10px', left: 'auto' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span>
            </div>
          </div>
          <div
            onClick={onClose}
            style={{
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              background: '#FFE000',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </header>

        <div className="modal-content-table" style={{ padding: '24px', maxHeight: '400px', overflowY: 'auto' }}>
          <table className="channel-table">
            <thead>
              <tr>
                <th style={{ width: '54px', textAlign: 'center' }}>
                  <div
                    className={`custom-checkbox ${selectedIds.length === filteredChannels.length && filteredChannels.length > 0 ? 'checked' : ''}`}
                    style={{ margin: '0 auto', cursor: 'pointer' }}
                    onClick={() => {
                      if (selectedIds.length === filteredChannels.length) {
                        setSelectedIds([]);
                      } else {
                        setSelectedIds(filteredChannels.map(ch => ch.CreateTime));
                      }
                    }}
                  ></div>
                </th>
                <th>Sensor</th>
                <th>Channel</th>
                <th>Unit</th>
                <th>Location</th>
                <th>Point</th>
                <th>Operate</th>
              </tr>
            </thead>
            <tbody>
              {filteredChannels.length > 0 ? (
                filteredChannels.map(ch => (
                  <tr key={ch.CreateTime} onClick={() => toggleSelection(ch.CreateTime)} style={{ cursor: 'pointer' }}>
                    <td style={{ textAlign: 'center' }}>
                      <div className={`custom-checkbox ${selectedIds.includes(ch.CreateTime) ? 'checked' : ''}`} style={{ margin: '0 auto' }}></div>
                    </td>
                    <td>{ch.sensorName}</td>
                    <td>{ch.channelName}</td>
                    <td>{ch.unit}</td>
                    <td>{ch.location}</td>
                    <td>{ch.point}</td>
                    <td>
                      <span
                        style={{ color: '#00AB84', cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSettingClick) onSettingClick(ch);
                        }}
                      >
                        Setting
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                    {configData ? 'No channels found matching search' : 'Please import a configuration file first'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="modal-footer" style={{ borderTop: '1px solid #E7E7E7', height: '72px', background: 'white' }}>
          <button
            className="btn-primary"
            style={{
              background: '#00AB84',
              border: '1px solid #00AB84',
              color: 'white',
              order: 1,
              width: '120px'
            }}
            onClick={handleConfirm}
          >
            Confirm
          </button>
          <button
            className="btn-secondary"
            style={{
              order: 2,
              width: '120px'
            }}
            onClick={onClose}
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ChannelSelectModal;
