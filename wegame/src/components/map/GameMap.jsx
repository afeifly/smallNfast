import React, { useEffect } from 'react';
import useGameStore, { UI_STATE } from '../../store/gameStore';
import { TERRAIN } from '../../data/maps';
import { getMovementRange, getAttackRange } from '../../utils/pathfinding';
import MapTile from './MapTile';
import TerrainLayer from './TerrainLayer';

const TILE_SIZE = 56; // px, matches --tile-size CSS variable

/**
 * Main game map grid — two-layer architecture:
 *   Layer 1 (background): SVG terrain art (trees, rocks, water ripples…)
 *   Layer 2 (foreground): interactive tile grid with units & highlights
 */
export default function GameMap() {
  const {
    map, units, selectedUnitId, uiState,
    setMovementRange,
  } = useGameStore();

  // Recompute movement/attack range whenever selected unit changes
  useEffect(() => {
    if (uiState !== UI_STATE.UNIT_SELECTED || !selectedUnitId) {
      useGameStore.getState().setMovementRange(new Set(), new Set());
      return;
    }

    const unit = useGameStore.getState().units.find(u => u.id === selectedUnitId);
    if (!unit) return;

    const { reachable } = getMovementRange(unit, map.tiles, units);
    const attackable    = getAttackRange(
      reachable,
      unit.attackRange[0],
      unit.attackRange[1],
      map.width,
      map.height
    );
    setMovementRange(reachable, attackable);
  }, [selectedUnitId, uiState]);

  // Build quick lookup: "x,y" -> unit
  const unitMap = {};
  units.forEach(u => {
    if (u.hp > 0) unitMap[`${u.pos.x},${u.pos.y}`] = u;
  });

  const mapStyle = {
    gridTemplateColumns: `repeat(${map.width}, ${TILE_SIZE}px)`,
    gridTemplateRows:    `repeat(${map.height}, ${TILE_SIZE}px)`,
    width:  map.width  * TILE_SIZE,
    height: map.height * TILE_SIZE,
  };

  return (
    <div className="map-root" style={{ width: map.width * TILE_SIZE, height: map.height * TILE_SIZE }}>

      {/* ── Layer 1: Background terrain art ── */}
      <TerrainLayer tiles={map.tiles} tileSize={TILE_SIZE} />

      {/* ── Layer 2: Interactive tile + unit grid ── */}
      <div className="map-grid" style={mapStyle}>
        {map.tiles.map((row, y) =>
          row.map((tileType, x) => (
            <MapTile
              key={`${x}-${y}`}
              tileType={tileType}
              x={x}
              y={y}
              unit={unitMap[`${x},${y}`] || null}
            />
          ))
        )}
      </div>
    </div>
  );
}
