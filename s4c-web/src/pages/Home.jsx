import React from 'react';
import iconAlertBig from '../assets/images/icon_alert_big.png';
import OnlineValueCard from '../components/OnlineValueCard';
import { useConfig } from '../context/ConfigContext';

const Home = () => {
  const { configData } = useConfig();

  // If no config data is loaded, show the empty state
  if (!configData || !configData.configs) {
    return (
      <div className="content-card">
        <div className="empty-state">
          <div className="empty-icon">
            <img src={iconAlertBig} alt="Alert" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          </div>
          <p className="empty-text">Please import a .cfgf configuration file in the Config Manager first.</p>
        </div>
      </div>
    );
  }

  const { configs } = configData;
  const layoutFile = configs['/config/cfgLayout.json'] || configs['config/cfgLayout.json'] || {};
  const layoutList = layoutFile.LayoutList || [];
  const sensorListFile = configs['/config/SUTO-SensorList.sutolist'] || configs['config/SUTO-SensorList.sutolist'] || {};
  const sensors = sensorListFile.cfgsensor || [];

  // Helper to find channel info by UID (matching CreateTime) across all sensors
  const findChannelInfo = (uid) => {
    for (const sensor of sensors) {
      if (!sensor.cfgchannel) continue;
      const channel = sensor.cfgchannel.find(ch => String(ch.CreateTime) === String(uid));
      if (channel) return {
        description: channel.ChannelDescription,
        unit: channel.UnitInASCII
      };
    }
    return null;
  };

  // Process layout into cards
  const cards = layoutList.map((group, idx) => {
    const title = `${group.location || 'Unknown'} / ${group.meapoint || group.measurepoint || 'Unknown'}`;
    const items = (group.channels || []).map(uid => {
      const info = findChannelInfo(uid);
      return {
        label: info ? info.description : `CH ${uid}`,
        value: '---', // Placeholder for real-time value
        unit: info ? info.unit : ''
      };
    });

    return { title, items };
  });

  if (cards.length === 0) {
    return (
      <div className="content-card">
        <div className="empty-state">
          <p className="empty-text">No layout information found in cfgLayout.json</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 368px)', gap: '16px', padding: '16px' }}>
      {cards.map((card, i) => (
        <OnlineValueCard
          key={i}
          title={card.title}
          items={card.items}
        />
      ))}
    </div>
  );
};

export default Home;
