import React from 'react';
import useGameStore, { PHASE } from '../../store/gameStore';
import { useT } from '../../store/localeStore';

const TILE_ICONS = {
  plain:    '',
  forest:   '🌲',
  mountain: '⛰',
  wall:     '',
  fort:     '⊞',
  throne:   '♛',
  village:  '⌂',
  water:    '～',
  road:     '',
  gate:     '⬛',
};

export default function StatusBar() {
  const _ = useT();
  const phase = useGameStore(s => s.phase);
  const turn  = useGameStore(s => s.turn);

  return (
    <div className="status-bar">
      <div className={`phase-badge ${phase === PHASE.ENEMY ? 'enemy' : ''}`}>
        <span className="dot" />
        <span>{phase === PHASE.PLAYER ? `▶ ${_('ui.player').toUpperCase()} PHASE` : `◀ ${_('ui.enemy').toUpperCase()} PHASE`}</span>
      </div>
      <div className="turn-info">
        <span>{_('ui.turn')} {String(turn).padStart(2, '0')}</span>
        <span style={{ color: 'var(--ink-3)' }}>|</span>
        <span style={{ color: 'var(--gold-light)' }}>Ch.1 — {_('map.chapterName')}</span>
      </div>
    </div>
  );
}
