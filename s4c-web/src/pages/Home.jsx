import { useState } from 'react';
import { Link } from 'react-router-dom';
import iconAlertBig from '../assets/images/icon_alert_big.png';
import OnlineValueCard from '../components/OnlineValueCard';
import { useConfig } from '../context/ConfigContext';
import { useLanguage } from '../context/LanguageContext';

const PlusCircleLarge = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
    <rect x="0.5" y="0.5" width="55" height="55" rx="27.5" fill="var(--primary-color)" stroke="var(--primary-color)" />
    <line x1="28" y1="16" x2="28" y2="40" stroke="#191919" strokeWidth="3" strokeLinecap="round" />
    <line x1="16" y1="28" x2="40" y2="28" stroke="#191919" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const Home = () => {
  const { configData } = useConfig();
  const { t } = useLanguage();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // If no config data is loaded, show the empty state
  if (!configData || !configData.configs) {
    return (
      <div className="content-card" style={{ padding: '48px' }}>
        <div className="empty-state" style={{ maxWidth: '400px', margin: '0 auto', gap: '20px', textAlign: 'center' }}>
          <img src={iconAlertBig} alt="Alert" style={{ width: 68, height: 68, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
          <p className="empty-text" style={{ fontSize: '14px', color: '#86909C', fontWeight: 'normal', margin: 0, lineHeight: '1.5' }}>
            {t('Please load a configuration file first to view the Home dashboard.')}
          </p>
          <Link 
            to="/config-manager" 
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
            {t('Go to Config File Page')}
          </Link>
        </div>
      </div>
    );
  }

  const { configs } = configData;
  const layoutFile = configs['/config/cfgLayout.json'] || configs['config/cfgLayout.json'] || {};
  const layoutList = layoutFile.LayoutList || [];
  const sensorListFile = configs['/config/SUTO-SensorList.sutolist'] || configs['config/SUTO-SensorList.sutolist'] || {};
  const sensors = sensorListFile.cfgsensor || [];

  const obConfigPath = Object.keys(configs || {}).find(p => p.endsWith('cfgOptionBoard.json'));
  const obItems = configs?.[obConfigPath]?.cfgOptionBoard || [];

  // Helper to find channel info by UID (matching CreateTime) across all sensors & option board
  const findChannelInfo = (uid) => {
    for (const sensor of sensors) {
      if (!sensor.cfgchannel) continue;
      const channel = sensor.cfgchannel.find(ch => String(ch.CreateTime) === String(uid));
      if (channel) return {
        description: channel.ChannelDescription,
        unit: channel.UnitInASCII
      };
    }
    const obItem = obItems.find(ch => String(ch.CreateTime) === String(uid));
    if (obItem) return {
      description: obItem.ChannelDescription,
      unit: obItem.PreDefineUnit || obItem.UnitInASCII || ''
    };
    return null;
  };

  // Process layout into cards
  // Process layout into cards
  const unknownText = t('Unknown');
  const cards = layoutList.map((group, idx) => {
    const title = `${group.location || unknownText} / ${group.meapoint || unknownText}`;
    const items = (group.channels || []).map(uid => {
      const info = findChannelInfo(uid);
      return {
        label: info ? info.description : `CH ${uid}`,
        value: '---', // Placeholder for real-time value
        unit: info ? info.unit : ''
      };
    });

    return { 
      title, 
      items, 
      index: typeof group.index === 'number' ? group.index : idx,
      is2Height: !!group.is2Height
    };
  });

  // Sort cards by index ascending
  const sortedCards = [...cards].sort((a, b) => a.index - b.index);

  // If no cards are configured, show a big centered message matching Graphic style and container margins
  if (sortedCards.length === 0) {
    return (
      <div className="content-card" style={{ flexDirection: 'column', gap: 4 }}>
        <PlusCircleLarge />
        <span style={{ textAlign: 'center', color: '#4E5969', fontSize: 16, fontWeight: 700, maxWidth: 349 }}>
          {t('Add more at Layout setting page')}
        </span>
      </div>
    );
  }

  // Pagination algorithm preferring vertical (column-first) placement without backfilling
  const pages = [];
  let currentPageItems = [];
  let col = 0;
  let row = 0;

  sortedCards.forEach(card => {
    if (card.is2Height) {
      if (row === 1) {
        col += 1;
        row = 0;
      }
      if (col >= 3) {
        pages.push(currentPageItems);
        currentPageItems = [];
        col = 0;
        row = 0;
      }
      currentPageItems.push({ card, col, row, span: 2 });
      col += 1;
      row = 0;
    } else {
      if (col >= 3) {
        pages.push(currentPageItems);
        currentPageItems = [];
        col = 0;
        row = 0;
      }
      currentPageItems.push({ card, col, row, span: 1 });
      if (row === 0) {
        row = 1;
      } else {
        col += 1;
        row = 0;
      }
    }
  });

  if (currentPageItems.length > 0) {
    pages.push(currentPageItems);
  }

  // Fill empty slots with placeholders for all pages
  const paginatedPages = pages.map(pageItems => {
    const grid = [
      [false, false, false],
      [false, false, false]
    ];
    pageItems.forEach(({ col, row, span }) => {
      grid[row][col] = true;
      if (span === 2) {
        grid[row + 1][col] = true;
      }
    });

    const finalItems = [...pageItems];
    for (let c = 0; c < 3; c++) {
      for (let r = 0; r < 2; r++) {
        if (!grid[r][c]) {
          finalItems.push({
            card: { isPlaceholder: true },
            col: c,
            row: r,
            span: 1
          });
          grid[r][c] = true;
        }
      }
    }
    return finalItems;
  });

  const totalPages = paginatedPages.length > 0 ? paginatedPages.length : 1;
  const activePageIndex = Math.min(currentPageIndex, totalPages - 1);

  // If there are no items, construct 6 default empty placeholders
  const activePageItems = paginatedPages[activePageIndex] || [
    { card: { isPlaceholder: true }, col: 0, row: 0, span: 1 },
    { card: { isPlaceholder: true }, col: 0, row: 1, span: 1 },
    { card: { isPlaceholder: true }, col: 1, row: 0, span: 1 },
    { card: { isPlaceholder: true }, col: 1, row: 1, span: 1 },
    { card: { isPlaceholder: true }, col: 2, row: 0, span: 1 },
    { card: { isPlaceholder: true }, col: 2, row: 1, span: 1 }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 104px)', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: 'fit-content' }}>
        {/* Grid Panel */}
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 368px)',
          gridTemplateRows: 'repeat(2, minmax(184px, 1fr))',
          gap: '16px',
          padding: '16px',
          justifyContent: 'flex-start',
          alignContent: 'stretch'
        }}>
          {activePageItems.map((itemObj) => {
            const { card, col, row, span } = itemObj;
            const gridStyle = {
              gridColumn: col + 1,
              gridRow: `${row + 1} / span ${span}`
            };
            return card.isPlaceholder ? (
              <div key={`empty-${col}-${row}`} style={gridStyle} />
            ) : (
              <div key={`card-${col}-${row}`} style={{ ...gridStyle, height: '100%' }}>
                <OnlineValueCard
                  title={card.title}
                  items={card.items}
                  style={{ height: '100%' }}
                />
              </div>
            );
          })}
        </div>

        {/* Footer Navigation */}
        <footer style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px',
          padding: '16px 0',
          marginTop: 'auto',
          flexShrink: 0
        }}>
          <button
            onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
            disabled={activePageIndex === 0}
            style={{
              background: 'none',
              border: 'none',
              cursor: activePageIndex === 0 ? 'not-allowed' : 'pointer',
              opacity: activePageIndex === 0 ? 0.3 : 0.8,
              color: '#1D2129',
              padding: '4px'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#4E5969',
            fontFamily: 'PingFang SC, sans-serif'
          }}>
            {activePageIndex + 1} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPageIndex(prev => Math.min(totalPages - 1, prev + 1))}
            disabled={activePageIndex === totalPages - 1}
            style={{
              background: 'none',
              border: 'none',
              cursor: activePageIndex === totalPages - 1 ? 'not-allowed' : 'pointer',
              opacity: activePageIndex === totalPages - 1 ? 0.3 : 0.8,
              color: '#1D2129',
              padding: '4px'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </footer>
      </div>
    </div>
  );
};

export default Home;
