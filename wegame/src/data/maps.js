// Tile types
export const TILE = {
  PLAIN:   'plain',
  FOREST:  'forest',
  MOUNTAIN:'mountain',
  WALL:    'wall',
  FORT:    'fort',
  THRONE:  'throne',
  VILLAGE: 'village',
  WATER:   'water',
  ROAD:    'road',
  GATE:    'gate',
};

// Terrain data: movement cost & defense bonus
export const TERRAIN = {
  [TILE.PLAIN]:    { cost: 1, def: 0,  avo: 0,  label: 'Plain',    passable: true  },
  [TILE.FOREST]:   { cost: 2, def: 1,  avo: 20, label: 'Forest',   passable: true  },
  [TILE.MOUNTAIN]: { cost: 4, def: 2,  avo: 10, label: 'Mountain', passable: true  },
  [TILE.WALL]:     { cost: 99,def: 0,  avo: 0,  label: 'Wall',     passable: false },
  [TILE.FORT]:     { cost: 1, def: 2,  avo: 20, label: 'Fort',     passable: true  },
  [TILE.THRONE]:   { cost: 1, def: 3,  avo: 30, label: 'Throne',   passable: true  },
  [TILE.VILLAGE]:  { cost: 1, def: 0,  avo: 0,  label: 'Village',  passable: true  },
  [TILE.WATER]:    { cost: 99,def: 0,  avo: 0,  label: 'Water',    passable: false },
  [TILE.ROAD]:     { cost: 1, def: 0,  avo: 5,  label: 'Road',     passable: true  },
  [TILE.GATE]:     { cost: 1, def: 2,  avo: 30, label: 'Gate',     passable: true  },
};

// Tile visual patterns (for e-ink CSS rendering)
export const TILE_PATTERN = {
  [TILE.PLAIN]:    'plain',
  [TILE.FOREST]:   'forest',
  [TILE.MOUNTAIN]: 'mountain',
  [TILE.WALL]:     'wall',
  [TILE.FORT]:     'fort',
  [TILE.THRONE]:   'throne',
  [TILE.VILLAGE]:  'village',
  [TILE.WATER]:    'water',
  [TILE.ROAD]:     'road',
  [TILE.GATE]:     'gate',
};

// 12x10 map for chapter 1 "The Crossing"
// Layout uses TILE constants
const P = TILE.PLAIN;
const F = TILE.FOREST;
const M = TILE.MOUNTAIN;
const W = TILE.WALL;
const R = TILE.ROAD;
const T = TILE.FORT;
const H = TILE.THRONE;
const V = TILE.VILLAGE;
const A = TILE.WATER;
const G = TILE.GATE;

export const CHAPTER_1 = {
  id: 'ch1',
  name: 'The Crossing',
  objective: 'Rout all enemies',
  width: 12,
  height: 10,
  // tiles[y][x]
  tiles: [
    [M, M, W, W, W, W, W, W, W, W, M, M],  // row 0
    [M, F, W, R, R, H, R, R, W, F, F, M],  // row 1
    [M, F, W, R, P, P, P, R, W, P, F, M],  // row 2
    [P, F, G, R, P, T, P, R, G, P, F, M],  // row 3
    [P, P, P, R, P, P, P, R, P, P, P, M],  // row 4
    [P, V, P, R, F, F, F, R, P, V, P, M],  // row 5
    [P, P, P, R, P, P, P, R, P, P, P, P],  // row 6
    [P, P, P, R, P, F, P, R, P, P, P, P],  // row 7
    [P, P, P, R, P, P, P, R, P, P, P, P],  // row 8
    [M, M, M, R, P, P, P, R, M, M, M, M],  // row 9
  ],
};

export default CHAPTER_1;
