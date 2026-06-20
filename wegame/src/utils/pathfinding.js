import { TERRAIN } from '../data/maps';

/**
 * BFS to compute movement range for a unit on a given map.
 * Returns a Set of "x,y" strings that the unit can reach.
 *
 * @param {Object} unit - unit with pos {x,y} and mov
 * @param {Array<Array<string>>} tiles - 2D tile array [y][x]
 * @param {Array<Object>} allUnits - all units (to block occupied tiles)
 * @returns {{ reachable: Set<string>, costs: Map<string, number> }}
 */
export function getMovementRange(unit, tiles, allUnits) {
  const height = tiles.length;
  const width  = tiles[0].length;
  const maxMov = unit.mov;

  // Occupied tiles by enemy units (can't pass or land on)
  const enemyOccupied = new Set(
    allUnits
      .filter(u => u.id !== unit.id && u.team !== unit.team && u.hp > 0)
      .map(u => `${u.pos.x},${u.pos.y}`)
  );

  // Ally-occupied tiles (can pass through but not land on)
  const allyOccupied = new Set(
    allUnits
      .filter(u => u.id !== unit.id && u.team === unit.team && u.hp > 0)
      .map(u => `${u.pos.x},${u.pos.y}`)
  );

  // costs[key] = movement points spent to reach this tile
  const costs = new Map();
  costs.set(`${unit.pos.x},${unit.pos.y}`, 0);

  // BFS queue: { x, y, remainingMov }
  const queue = [{ x: unit.pos.x, y: unit.pos.y, remainingMov: maxMov }];
  const reachable = new Set();
  reachable.add(`${unit.pos.x},${unit.pos.y}`);

  const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];

  while (queue.length > 0) {
    const { x, y, remainingMov } = queue.shift();

    for (const { dx, dy } of dirs) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

      const tileType = tiles[ny][nx];
      const terrain  = TERRAIN[tileType];
      if (!terrain || !terrain.passable) continue;

      const key  = `${nx},${ny}`;
      const cost = terrain.cost;
      const newRem = remainingMov - cost;

      if (newRem < 0) continue;

      const prevCost = costs.get(key);
      if (prevCost !== undefined && prevCost >= newRem) continue;

      // Enemy-blocked: can't enter at all
      if (enemyOccupied.has(key)) continue;

      costs.set(key, newRem);

      // Can only land on non-ally tiles
      if (!allyOccupied.has(key)) {
        reachable.add(key);
      }

      queue.push({ x: nx, y: ny, remainingMov: newRem });
    }
  }

  return { reachable, costs };
}

/**
 * Get tiles within attack range from a set of reachable tiles.
 * Returns a Set of "x,y" strings that can be attacked.
 *
 * @param {Set<string>} reachable - tiles the unit can move to
 * @param {number} minRange - minimum attack range
 * @param {number} maxRange - maximum attack range
 * @param {number} mapWidth
 * @param {number} mapHeight
 * @returns {Set<string>}
 */
export function getAttackRange(reachable, minRange, maxRange, mapWidth, mapHeight) {
  const attackable = new Set();

  for (const key of reachable) {
    const [x, y] = key.split(',').map(Number);

    for (let r = minRange; r <= maxRange; r++) {
      // All tiles at Manhattan distance r
      for (let dx = -r; dx <= r; dx++) {
        const dy_abs = r - Math.abs(dx);
        for (const dy of (dy_abs === 0 ? [0] : [-dy_abs, dy_abs])) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < mapWidth && ny < mapHeight) {
            const nk = `${nx},${ny}`;
            if (!reachable.has(nk)) {
              attackable.add(nk);
            }
          }
        }
      }
    }
  }

  return attackable;
}

/**
 * Calculate Manhattan distance between two positions
 */
export function getManhattanDist(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
