import React from 'react';
import iconAlertBig from '../assets/images/icon_alert_big.png';
import OnlineValueCard from '../components/OnlineValueCard';
import { useConfig } from '../context/ConfigContext';

const EmptyCard = () => (
  <div style={{ width: 368, height: 390, position: 'relative', background: 'white', overflow: 'hidden', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
    <div style={{ width: 185, left: 91.5, top: 126, position: 'absolute', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 4, display: 'inline-flex' }}>
      <img src={iconAlertBig} alt="Alert" style={{ width: 68, height: 68, objectFit: 'contain', marginBottom: 8 }} />
      <div style={{ width: 309, textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', }}>
        <span style={{ color: '#4E5969', fontSize: 16, fontFamily: 'Arial', fontWeight: '700', textTransform: 'capitalize' }}>
          Add more at sensor configuration page
        </span>
      </div>
    </div>
  </div>
);

const Home = () => {
  const { configData } = useConfig();

  // If no config data is loaded, show the empty state
  if (!configData || !configData.configs) {
    return (
      <div className="content-card">
        <div className="empty-state">
          <div className="empty-icon">
            <img src={iconAlertBig} alt="Alert" style={{ width: 68, height: 68, objectFit: 'contain' }} />
          </div>
          <p className="empty-text">Add more at sensor configuration page</p>
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

  // Ensure at least 6 cards
  const displayCards = [...cards];
  while (displayCards.length < 6) {
    displayCards.push({ isPlaceholder: true });
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 368px)', gap: '16px', padding: '16px' }}>
      {displayCards.map((card, i) => (
        card.isPlaceholder ? (
          <EmptyCard key={`empty-${i}`} />
        ) : (
          <OnlineValueCard
            key={i}
            title={card.title}
            items={card.items}
          />
        )
      ))}
    </div>
  );
};

export default Home;
