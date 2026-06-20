import React, { useState } from 'react';
import TitleScreen from './screens/TitleScreen';
import MapScreen from './screens/MapScreen';
import useLocaleStore, { useT } from './store/localeStore';
import './index.css';

export default function App() {
  const [screen, setScreen] = useState('title'); // 'title' | 'map'
  const [einkMode, setEinkMode] = useState(false);
  const _ = useT();
  const toggleLocale = useLocaleStore(s => s.toggleLocale);

  return (
    <div className={`app-wrapper ${einkMode ? 'eink-mode' : ''}`}>
      {/* Top-right controls */}
      <div className="top-controls">
        <button
          className="eink-toggle"
          onClick={() => setEinkMode(m => !m)}
          title="Toggle e-ink grayscale mode"
        >
          {einkMode ? `🖥 ${_('toggle.color')}` : `📄 ${_('toggle.eink')}`}
        </button>
        <button
          className="lang-toggle"
          onClick={toggleLocale}
          title="Toggle English / 中文"
        >
          {_('toggle.lang')}
        </button>
      </div>

      {screen === 'title' && (
        <TitleScreen onStart={() => setScreen('map')} />
      )}
      {screen === 'map' && (
        <MapScreen />
      )}
    </div>
  );
}
