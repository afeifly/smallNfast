import React, { useEffect } from 'react';
import useGameStore, { UI_STATE } from '../store/gameStore';
import { useT } from '../store/localeStore';
import { TERRAIN } from '../data/maps';
import { TEAM } from '../data/units';
import GameMap from '../components/map/GameMap';
import StatusBar from '../components/ui/StatusBar';
import UnitCard from '../components/ui/UnitCard';
import ActionMenu from '../components/ui/Menu';
import CombatPreview from '../components/combat/CombatPreview';

/**
 * Main map screen — assembles all game components.
 */
export default function MapScreen() {
  const _ = useT();
  const {
    map, units, hoveredTile, selectedUnitId, targetUnitId,
    uiState, message, phase,
  } = useGameStore();

  // Determine what to show in sidebar
  const selectedUnit = units.find(u => u.id === selectedUnitId);
  const targetUnit   = units.find(u => u.id === targetUnitId);
  const hoveredUnit  = hoveredTile
    ? units.find(u => u.pos.x === hoveredTile.x && u.pos.y === hoveredTile.y && u.hp > 0)
    : null;

  const displayUnit  = selectedUnit || hoveredUnit;
  const displayTile  = hoveredTile ? map.tiles[hoveredTile.y]?.[hoveredTile.x] : null;
  const terrainData  = displayTile ? TERRAIN[displayTile] : null;

  // All enemies defeated?
  const allEnemiesDead = units.filter(u => u.team === TEAM.ENEMY).length === 0;

  // Keyboard: Escape to deselect
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') useGameStore.getState().deselect();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="map-screen screen">
      <StatusBar />

      {/* Map area */}
      <div className="map-container">
        <GameMap />
      </div>

      {/* Sidebar */}
      <div className="sidebar">

        {/* Combat preview takes over sidebar */}
        {uiState === UI_STATE.COMBAT_PREVIEW ? (
          <CombatPreview />
        ) : (
          <>
            {/* Unit card */}
            <div className="sidebar-section">
              <div className="sidebar-title">
                {selectedUnit ? _('ui.selected') : hoveredUnit ? _('ui.unitInfo') : _('ui.status')}
              </div>
              {displayUnit ? (
                <UnitCard
                  unit={displayUnit}
                  isEnemy={displayUnit.team === TEAM.ENEMY}
                />
              ) : (
                <div style={{ fontSize: 8, color: 'var(--ink-4)', fontFamily: 'var(--font-pixel)', lineHeight: 2 }}>
                  <div>{_('ui.clickUnit')}</div>
                  <div>{_('ui.blueMov')}</div>
                  <div>{_('ui.redAtk')}</div>
                </div>
              )}
            </div>

            {/* Action menu (after move) */}
            {uiState === UI_STATE.UNIT_MOVED && (
              <div className="sidebar-section">
                <div className="sidebar-title">{_('ui.action')}</div>
                <ActionMenu />
              </div>
            )}

            {/* Terrain info */}
            {terrainData && (
              <div className="sidebar-section">
                <div className="sidebar-title">{_('ui.terrain')}</div>
                <div className="terrain-info">
                  <div className="ti-name">{_('terrain.' + displayTile)}</div>
                  <div className="ti-stats">
                    <span>{_('stats.def2')} +{terrainData.def}</span>
                    <span>{_('stats.avo')} +{terrainData.avo}</span>
                    <span>{_('stats.cost')} {terrainData.cost === 99 ? '—' : terrainData.cost}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Unit count summary */}
            <div className="sidebar-section">
              <div className="sidebar-title">{_('ui.forces')}</div>
              <div style={{ fontSize: 8, color: 'var(--ink-5)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ color: 'var(--blue-mid)' }}>
                  ⬛ {_('ui.player')}: {units.filter(u => u.team === TEAM.PLAYER && u.hp > 0).length}
                </div>
                <div style={{ color: 'var(--red-mid)' }}>
                  ⬛ {_('ui.enemy')}: {units.filter(u => u.team === TEAM.ENEMY && u.hp > 0).length}
                </div>
              </div>
            </div>

            {/* Keyboard hints */}
            <div className="kbd-hint">
              {_('ui.esc')}<br />
              {_('ui.click')}<br />
              {_('ui.hover')}
            </div>
          </>
        )}
      </div>

      {/* Message bar */}
      <div className="message-bar">
        <span className="msg-arrow">▶</span>
        <span>{message}</span>
      </div>

      {/* Victory banner */}
      {allEnemiesDead && (
        <div className="victory-banner">
          <h2>⚔ {_('map.victoryTitle')} ⚔</h2>
          <p>{_('map.victoryBanner')}</p>
          <p style={{ marginTop: 16, animation: 'blink 1.2s step-end infinite' }}>
            {_('game.chapterDone')}
          </p>
        </div>
      )}
    </div>
  );
}
