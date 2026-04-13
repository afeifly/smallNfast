import React from 'react';

const Home = () => {
  return (
    <div className="content-card">
      <div className="empty-state">
        <div className="empty-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </div>
        <p className="empty-text">Add more at sensor configuration page</p>
      </div>
    </div>
  );
};

export default Home;
