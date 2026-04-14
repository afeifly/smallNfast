import React from 'react';

const OnlineValueCard = ({ title = '1S461-energy 1S461-energy', items = [] }) => {
  // Default items if none provided
  const displayItems = items.length > 0 ? items : [
    { label: 'flow', value: '34.566.774.8', unit: 'Sm³/Min' },
    { label: 'S401 2# Consumption', value: '74.8', unit: 'Sm³/Min' },
    { label: 'S401 2# Rev.consumption', value: '4.8', unit: 'Sm³/Min' },
    { label: 'heat accumulated', value: '566.174.8', unit: 'KWH' },
    { label: 'flow', value: '34.566.774.8', unit: 'Sm³/Min' },
    { label: 'flow', value: '34.566.774.8', unit: 'Sm³/Min' },
    { label: 'flow', value: '34.566.774.8', unit: 'Sm³/Min' },
  ];

  return (
    <div style={{ width: 368, height: 390, position: 'relative', background: 'white', overflow: 'hidden', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      {/* Header */}
      <div style={{ width: '100%', height: 40, left: 0, top: 0, position: 'absolute', background: '#00AE86' }}>
        <div style={{ left: 16, top: 9, position: 'absolute', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'white', fontSize: 16, fontFamily: 'PingFang SC', fontWeight: '600', textTransform: 'capitalize', wordWrap: 'break-word' }}>
          {title}
        </div>
        <div style={{ width: 24, height: 24, left: 336, top: 8, position: 'absolute', overflow: 'hidden', cursor: 'pointer' }}>
          <div style={{ width: 2, height: 2, left: 11, top: 11, position: 'absolute', outline: '2px white solid', outlineOffset: '-1px' }} />
          <div style={{ width: 2, height: 2, left: 18, top: 11, position: 'absolute', outline: '2px white solid', outlineOffset: '-1px' }} />
          <div style={{ width: 2, height: 2, left: 4, top: 11, position: 'absolute', outline: '2px white solid', outlineOffset: '-1px' }} />
        </div>
      </div>

      {/* Content */}
      <div style={{ width: '100%', left: 0, top: 40, position: 'absolute', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
        {displayItems.map((item, index) => (
          <div key={index} style={{ alignSelf: 'stretch', height: 48, position: 'relative', borderBottom: index === displayItems.length - 1 ? 'none' : '1px #E8E8E8 solid' }}>
            <div style={{ left: 16, top: 18, position: 'absolute', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: '#181818', fontSize: 14, fontFamily: 'PingFang SC', fontWeight: '600', textTransform: 'capitalize', wordWrap: 'break-word', width: 130, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {item.label}
            </div>
            <div style={{ width: 65, height: 22, left: 290, top: 17, position: 'absolute', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: '#999999', fontSize: 13, fontFamily: 'PingFang SC', fontWeight: '600', textTransform: 'none', wordWrap: 'break-word', textAlign: 'right' }}>
              {item.unit}
            </div>
            <div style={{ right: 85, top: 7, position: 'absolute', textAlign: 'right', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: '#181818', fontSize: 20, fontFamily: 'PingFang SC', fontWeight: '600', textTransform: 'capitalize', wordWrap: 'break-word' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OnlineValueCard;
