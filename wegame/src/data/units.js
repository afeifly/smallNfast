// Unit class types
export const CLASS = {
  LORD:   'Lord',
  KNIGHT: 'Knight',
  MAGE:   'Mage',
  ARCHER: 'Archer',
  CLERIC: 'Cleric',
  FIGHTER:'Fighter',
  SOLDIER:'Soldier',
};

// Weapon types for the weapon triangle
export const WEAPON_TYPE = {
  SWORD: 'Sword',
  LANCE: 'Lance',
  AXE:   'Axe',
  BOW:   'Bow',
  MAGIC: 'Magic',
  STAFF: 'Staff',
};

// Weapon triangle: attacker weapon -> defender weapon -> advantage multiplier
// Sword > Axe > Lance > Sword
export const WEAPON_TRIANGLE = {
  [WEAPON_TYPE.SWORD]: { [WEAPON_TYPE.AXE]:   1, [WEAPON_TYPE.LANCE]: -1 },
  [WEAPON_TYPE.LANCE]: { [WEAPON_TYPE.SWORD]:  1, [WEAPON_TYPE.AXE]:  -1 },
  [WEAPON_TYPE.AXE]:   { [WEAPON_TYPE.LANCE]:  1, [WEAPON_TYPE.SWORD]:-1 },
};

export const TEAM = {
  PLAYER: 'player',
  ENEMY:  'enemy',
};

// Pixel-art style class icons (ASCII/text for e-ink)
export const CLASS_ICON = {
  [CLASS.LORD]:    '♞',
  [CLASS.KNIGHT]:  '⛨',
  [CLASS.MAGE]:    '✦',
  [CLASS.ARCHER]:  '⟹',
  [CLASS.CLERIC]:  '✚',
  [CLASS.FIGHTER]: '⚔',
  [CLASS.SOLDIER]: '⚡',
};

export const CLASS_COLOR = {
  [CLASS.LORD]:    '#000',
  [CLASS.KNIGHT]:  '#111',
  [CLASS.MAGE]:    '#222',
  [CLASS.ARCHER]:  '#333',
  [CLASS.CLERIC]:  '#444',
  [CLASS.FIGHTER]: '#555',
  [CLASS.SOLDIER]: '#666',
};

// Default unit templates by class
export const CLASS_DEFAULTS = {
  [CLASS.LORD]:    { weaponType: WEAPON_TYPE.SWORD, mov: 5, range: [1,1] },
  [CLASS.KNIGHT]:  { weaponType: WEAPON_TYPE.LANCE, mov: 4, range: [1,1] },
  [CLASS.MAGE]:    { weaponType: WEAPON_TYPE.MAGIC, mov: 5, range: [1,2] },
  [CLASS.ARCHER]:  { weaponType: WEAPON_TYPE.BOW,   mov: 5, range: [2,2] },
  [CLASS.CLERIC]:  { weaponType: WEAPON_TYPE.STAFF, mov: 5, range: [1,2] },
  [CLASS.FIGHTER]: { weaponType: WEAPON_TYPE.AXE,   mov: 5, range: [1,1] },
  [CLASS.SOLDIER]: { weaponType: WEAPON_TYPE.LANCE, mov: 4, range: [1,1] },
};

// Chapter 1 unit roster
const initialUnits = [
  // --- Player Units ---
  {
    id: 'p1',
    name: 'Airen',
    team: TEAM.PLAYER,
    class: CLASS.LORD,
    level: 1,
    hp: 20, maxHp: 20,
    str: 5, mag: 2, skl: 7, spd: 8, lck: 5, def: 4, res: 3,
    weaponType: WEAPON_TYPE.SWORD,
    mov: 5,
    attackRange: [1, 1],
    pos: { x: 1, y: 7 },
    hasMoved: false,
    hasActed: false,
  },
  {
    id: 'p2',
    name: 'Brek',
    team: TEAM.PLAYER,
    class: CLASS.KNIGHT,
    level: 1,
    hp: 22, maxHp: 22,
    str: 7, mag: 0, skl: 5, spd: 4, lck: 3, def: 8, res: 2,
    weaponType: WEAPON_TYPE.LANCE,
    mov: 4,
    attackRange: [1, 1],
    pos: { x: 2, y: 7 },
    hasMoved: false,
    hasActed: false,
  },
  {
    id: 'p3',
    name: 'Lyra',
    team: TEAM.PLAYER,
    class: CLASS.MAGE,
    level: 1,
    hp: 16, maxHp: 16,
    str: 2, mag: 8, skl: 6, spd: 7, lck: 4, def: 2, res: 6,
    weaponType: WEAPON_TYPE.MAGIC,
    mov: 5,
    attackRange: [1, 2],
    pos: { x: 1, y: 8 },
    hasMoved: false,
    hasActed: false,
  },
  {
    id: 'p4',
    name: 'Cass',
    team: TEAM.PLAYER,
    class: CLASS.ARCHER,
    level: 1,
    hp: 18, maxHp: 18,
    str: 6, mag: 1, skl: 8, spd: 7, lck: 5, def: 3, res: 2,
    weaponType: WEAPON_TYPE.BOW,
    mov: 5,
    attackRange: [2, 2],
    pos: { x: 2, y: 8 },
    hasMoved: false,
    hasActed: false,
  },
  // --- Enemy Units ---
  {
    id: 'e1',
    name: 'Grald',
    team: TEAM.ENEMY,
    class: CLASS.FIGHTER,
    level: 1,
    hp: 24, maxHp: 24,
    str: 8, mag: 0, skl: 4, spd: 5, lck: 2, def: 5, res: 1,
    weaponType: WEAPON_TYPE.AXE,
    mov: 5,
    attackRange: [1, 1],
    pos: { x: 8, y: 2 },
    hasMoved: false,
    hasActed: false,
    ai: 'aggressive',
  },
  {
    id: 'e2',
    name: 'Vorn',
    team: TEAM.ENEMY,
    class: CLASS.SOLDIER,
    level: 1,
    hp: 20, maxHp: 20,
    str: 6, mag: 0, skl: 5, spd: 6, lck: 3, def: 4, res: 2,
    weaponType: WEAPON_TYPE.LANCE,
    mov: 4,
    attackRange: [1, 1],
    pos: { x: 9, y: 3 },
    hasMoved: false,
    hasActed: false,
    ai: 'aggressive',
  },
  {
    id: 'e3',
    name: 'Silas',
    team: TEAM.ENEMY,
    class: CLASS.SOLDIER,
    level: 1,
    hp: 18, maxHp: 18,
    str: 5, mag: 0, skl: 5, spd: 6, lck: 2, def: 3, res: 2,
    weaponType: WEAPON_TYPE.LANCE,
    mov: 4,
    attackRange: [1, 1],
    pos: { x: 7, y: 4 },
    hasMoved: false,
    hasActed: false,
    ai: 'patrol',
  },
  {
    id: 'e4',
    name: 'Zeth',
    team: TEAM.ENEMY,
    class: CLASS.FIGHTER,
    level: 1,
    hp: 22, maxHp: 22,
    str: 7, mag: 0, skl: 4, spd: 4, lck: 1, def: 4, res: 1,
    weaponType: WEAPON_TYPE.AXE,
    mov: 5,
    attackRange: [1, 1],
    pos: { x: 10, y: 5 },
    hasMoved: false,
    hasActed: false,
    ai: 'aggressive',
  },
];

export default initialUnits;
