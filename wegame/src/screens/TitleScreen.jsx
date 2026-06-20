import React, { useState, useEffect } from 'react';
import { useT } from '../store/localeStore';

/**
 * Title screen — GBA Fire Emblem aesthetic.
 */
export default function TitleScreen({ onStart }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [show, setShow] = useState(false);
  const _ = useT();

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowUp')   setActiveIdx(i => Math.max(0, i - 1));
      if (e.key === 'ArrowDown') setActiveIdx(i => Math.min(1, i + 1));
      if (e.key === 'Enter' || e.key === 'z' || e.key === 'Z') {
        if (activeIdx === 0) onStart();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeIdx, onStart]);

  return (
    <div className="title-screen screen">
      <div className="title-bg-pattern" />

      <div className="title-emblem" style={{ opacity: show ? 1 : 0, transition: 'opacity 1s' }}>
        ⚔️
      </div>

      <div className="title-logo" style={{ opacity: show ? 1 : 0, transition: 'opacity 1s 0.3s' }}>
        <span className="title-we">WE</span>
        <span className="title-game">GAME</span>
      </div>

      <div className="title-subtitle" style={{ opacity: show ? 1 : 0, transition: 'opacity 1s 0.6s' }}>
        {_('title.subtitle')}
      </div>

      <div className="title-menu" style={{ opacity: show ? 1 : 0, transition: 'opacity 1s 0.9s' }}>
        <button
          className={`title-menu-btn ${activeIdx === 0 ? 'active' : ''}`}
          onClick={onStart}
          onMouseEnter={() => setActiveIdx(0)}
        >
          <span className="btn-arrow">▶</span> {_('title.newGame')}
        </button>
        <button
          className={`title-menu-btn ${activeIdx === 1 ? 'active' : ''}`}
          onMouseEnter={() => setActiveIdx(1)}
          onClick={() => alert(_('title.noSaveData'))}
        >
          <span className="btn-arrow">▶</span> {_('title.continue')}
        </button>
      </div>

      <div className="title-footer">{_('title.pressStart')}</div>
    </div>
  );
}
