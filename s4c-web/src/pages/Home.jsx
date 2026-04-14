import React, { useState } from 'react';
import iconAlertBig from '../assets/images/icon_alert_big.png';
import OnlineValueCard from '../components/OnlineValueCard';

const Home = () => {
  const [showCards, setShowCards] = useState(false);

  if (showCards) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 368px)', gap: '16px' }}>
        <OnlineValueCard />
        <OnlineValueCard />
        <OnlineValueCard />
        <OnlineValueCard />
        <OnlineValueCard />
      </div>
    );
  }

  return (
    <div className="content-card">
      <div className="empty-state">
        <div className="empty-icon">
          <img src={iconAlertBig} alt="Alert" style={{ width: 40, height: 40, objectFit: 'contain' }} />
        </div>
        <p className="empty-text">Add more at sensor configuration page</p>
        <button className="create-logger-btn" onClick={() => setShowCards(true)}>Test</button>
      </div>
    </div>
  );
};

export default Home;
