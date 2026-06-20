import React, { useCallback } from 'react';
import useGameStore, { UI_STATE } from '../../store/gameStore';
import { useT } from '../../store/localeStore';
import { CLASS_ICON, TEAM } from '../../data/units';
import { getManhattanDist } from '../../utils/pathfinding';

/**
 * Individual unit sprite rendered on top of its map tile.
 */
export default function UnitSprite({ unit }) {
  const _ = useT();
  const {
    selectedUnitId, uiState, movementRange, attackRange,
    pendingMovePos, selectUnit, selectTarget
  } = useGameStore();

  const isSelected = selectedUnitId === unit.id;
  const isPlayer   = unit.team === TEAM.PLAYER;
  const isEnemy    = unit.team === TEAM.ENEMY;
  const isExhausted = unit.hasMoved && unit.hasActed;

  const hpPct  = (unit.hp / unit.maxHp) * 100;
  const hpClass = hpPct <= 25 ? 'crit' : hpPct <= 50 ? 'low' : '';

  // Determine if this enemy is in attack range of selected unit (after move)
  const canBeTargeted = useCallback(() => {
    if (!isEnemy) return false;
    if (uiState !== UI_STATE.UNIT_MOVED) return false;

    const actor = useGameStore.getState().units.find(u => u.id === selectedUnitId);
    if (!actor) return false;

    const pos    = pendingMovePos || actor.pos;
    const [minR, maxR] = actor.attackRange;
    const dist   = getManhattanDist(pos, unit.pos);
    return dist >= minR && dist <= maxR;
  }, [isEnemy, uiState, selectedUnitId, pendingMovePos, unit.pos]);

  const targeted = canBeTargeted();

  const handleClick = (e) => {
    e.stopPropagation();
    if (isPlayer) {
      selectUnit(unit.id);
    } else if (targeted) {
      selectTarget(unit.id);
    }
  };

  const icon = CLASS_ICON[unit.class] || '?';

  return (
    <div
      className={[
        'unit-sprite',
        isPlayer ? 'player-unit' : 'enemy-unit',
        isSelected ? 'selected' : '',
        isExhausted ? 'exhausted' : '',
        targeted ? 'enemy-target-hover' : '',
      ].filter(Boolean).join(' ')}
      onClick={handleClick}
      title={`${unit.name} (${_('class.' + unit.class.toLowerCase())}) HP:${unit.hp}/${unit.maxHp}`}
    >
      <span className="sprite-icon">{icon}</span>
      <span className="sprite-name">{unit.name.slice(0, 4)}</span>

      {/* HP bar */}
      <div className="unit-hp-bar-wrap">
        <div
          className={`unit-hp-bar ${hpClass}`}
          style={{ width: `${hpPct}%` }}
        />
      </div>
    </div>
  );
}
