import React from 'react';
import useGameStore, { UI_STATE } from '../../store/gameStore';
import { useT } from '../../store/localeStore';
import { TEAM } from '../../data/units';
import { getManhattanDist } from '../../utils/pathfinding';

/**
 * Action menu shown in sidebar after a unit has moved.
 * Options: Attack (if enemy in range), Wait
 */
export default function ActionMenu() {
  const _ = useT();
  const { selectedUnitId, units, uiState, pendingMovePos, waitUnit, selectTarget, deselect } = useGameStore();

  if (uiState !== UI_STATE.UNIT_MOVED || !selectedUnitId) return null;

  const actor = units.find(u => u.id === selectedUnitId);
  if (!actor) return null;

  const pos = pendingMovePos || actor.pos;
  const [minR, maxR] = actor.attackRange;

  // Enemies in attack range
  const attackableEnemies = units.filter(u => {
    if (u.team !== TEAM.ENEMY || u.hp <= 0) return false;
    const dist = getManhattanDist(pos, u.pos);
    return dist >= minR && dist <= maxR;
  });

  const canAttack = attackableEnemies.length > 0;

  return (
    <div className="action-menu">
      <button
        className="action-btn"
        disabled={!canAttack}
        onClick={() => {
          if (canAttack) {
            // If only one target, auto-select; else first one
            selectTarget(attackableEnemies[0].id);
          }
        }}
      >
        <span>⚔</span> {_('menu.attack')}
        {canAttack && <span style={{ fontSize: 6, color: 'var(--gold-light)', marginLeft: 'auto' }}>
          {attackableEnemies.length} {attackableEnemies.length > 1 ? _('menu.targets') : _('menu.target')}
        </span>}
      </button>

      <button
        className="action-btn"
        onClick={() => waitUnit(selectedUnitId)}
      >
        <span>⏸</span> {_('menu.wait')}
      </button>

      <button
        className="action-btn danger"
        onClick={deselect}
        style={{ marginTop: 8, background: 'transparent', border: '2px solid var(--ink-4)', color: 'var(--ink-6)' }}
      >
        <span>✕</span> {_('menu.cancel')}
      </button>
    </div>
  );
}
