import React from 'react';
import useGameStore, { UI_STATE } from '../../store/gameStore';
import { TILE_PATTERN, TERRAIN } from '../../data/maps';
import UnitSprite from './UnitSprite';

const TERRAIN_ICONS = {
  plain:    '',
  forest:   '🌲',
  mountain: '▲',
  wall:     '█',
  fort:     '⊞',
  throne:   '♛',
  village:  '⌂',
  water:    '~',
  road:     '',
  gate:     '⛩',
};

/**
 * A single map tile cell. Handles hover, click, move-range highlights.
 */
export default function MapTile({ tileType, x, y, unit }) {
  const {
    uiState, selectedUnitId, movementRange, attackRange,
    hoveredTile, setHoveredTile, moveUnit, deselect,
  } = useGameStore();

  const key = `${x},${y}`;
  const isMoveHighlight   = movementRange.has(key);
  const isAttackHighlight = attackRange.has(key) && !movementRange.has(key);
  const isHovered         = hoveredTile?.x === x && hoveredTile?.y === y;

  const handleClick = () => {
    if (unit) return; // unit click handled by UnitSprite

    if (uiState === UI_STATE.UNIT_SELECTED && isMoveHighlight && selectedUnitId) {
      moveUnit(selectedUnitId, { x, y });
    } else if (uiState === UI_STATE.IDLE || uiState === UI_STATE.UNIT_SELECTED) {
      deselect();
    }
  };

  const terrainIcon = TERRAIN_ICONS[tileType] || '';

  return (
    <div
      className={[
        'map-tile',
        `tile-${tileType}`,
        isMoveHighlight   ? 'move-highlight'   : '',
        isAttackHighlight ? 'attack-highlight' : '',
      ].filter(Boolean).join(' ')}
      onClick={handleClick}
      onMouseEnter={() => setHoveredTile({ x, y })}
      onMouseLeave={() => setHoveredTile(null)}
      style={{ gridColumn: x + 1, gridRow: y + 1 }}
    >
      {terrainIcon && (
        <span className="tile-terrain-icon">{terrainIcon}</span>
      )}
      {unit && <UnitSprite unit={unit} />}
    </div>
  );
}
