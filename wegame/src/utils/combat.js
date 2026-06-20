import { WEAPON_TRIANGLE, WEAPON_TYPE } from '../data/units';
import { TERRAIN } from '../data/maps';

/**
 * Get weapon triangle modifier: +1, -1, or 0
 */
export function getWeaponTriangleAdv(atkWeapon, defWeapon) {
  const tri = WEAPON_TRIANGLE[atkWeapon];
  if (!tri) return 0;
  return tri[defWeapon] ?? 0;
}

/**
 * Calculate hit rate (before terrain avoid)
 * FE GBA formula: Hit% = (Skill × 2) + (Luck / 2) + weapon_hit + weapon_triangle×15
 */
export function calcHit(attacker, defender, mapTile) {
  const wtAdv = getWeaponTriangleAdv(attacker.weaponType, defender.weaponType);
  const baseWeaponHit = attacker.weaponType === WEAPON_TYPE.MAGIC ? 90 :
                        attacker.weaponType === WEAPON_TYPE.BOW   ? 80 : 85;
  const atkHit = (attacker.skl * 2) + Math.floor(attacker.lck / 2) + baseWeaponHit + (wtAdv * 15);

  const terrain = mapTile ? TERRAIN[mapTile] : null;
  const avoid   = (defender.spd * 2) + defender.lck + (terrain ? terrain.avo : 0);

  const hit = Math.min(100, Math.max(0, atkHit - avoid));
  return hit;
}

/**
 * Calculate damage
 * FE GBA formula: Dmg = (Str + weapon_Mt) - (Def or Res) + weapon_triangle×1
 */
export function calcDamage(attacker, defender, mapTile) {
  const wtAdv = getWeaponTriangleAdv(attacker.weaponType, defender.weaponType);
  const isMagic = attacker.weaponType === WEAPON_TYPE.MAGIC;

  const weaponMt  = isMagic ? 6 : attacker.weaponType === WEAPON_TYPE.BOW ? 5 : 5;
  const atkStat   = isMagic ? attacker.mag : attacker.str;
  const defStat   = isMagic ? defender.res : defender.def;

  const terrain   = mapTile ? TERRAIN[mapTile] : null;
  const terrainDef = terrain ? terrain.def : 0;

  const dmg = Math.max(0, atkStat + weaponMt + wtAdv - defStat - terrainDef);
  return dmg;
}

/**
 * Calculate critical hit rate
 * FE GBA formula: Crit% = (Skill / 2) + weapon_crit - defender_lck
 */
export function calcCrit(attacker, defender) {
  const weaponCrit = attacker.weaponType === WEAPON_TYPE.SWORD ? 5 : 0;
  const crit = Math.min(100, Math.max(0,
    Math.floor(attacker.skl / 2) + weaponCrit - defender.lck
  ));
  return crit;
}

/**
 * Determine if a unit can counterattack (range overlap)
 */
export function canCounter(attacker, defender, distance) {
  const [dMin, dMax] = defender.attackRange;
  return distance >= dMin && distance <= dMax;
}

/**
 * Full combat preview between two units
 * Returns { attacker: {...stats}, defender: {...stats} }
 */
export function getCombatPreview(attacker, defender, defenderTile, distance = 1) {
  const atkHit  = calcHit(attacker, defender, defenderTile);
  const atkDmg  = calcDamage(attacker, defender, defenderTile);
  const atkCrit = calcCrit(attacker, defender);
  const atkDoubles = attacker.spd - defender.spd >= 4;

  const counterPossible = canCounter(attacker, defender, distance);
  let defHit = 0, defDmg = 0, defCrit = 0, defDoubles = false;

  if (counterPossible) {
    // attacker's tile as "no tile" for simplicity (attacker is moving)
    defHit  = calcHit(defender, attacker, null);
    defDmg  = calcDamage(defender, attacker, null);
    defCrit = calcCrit(defender, attacker);
    defDoubles = defender.spd - attacker.spd >= 4;
  }

  return {
    attacker: {
      unit:     attacker,
      hit:      atkHit,
      dmg:      atkDmg,
      crit:     atkCrit,
      doubles:  atkDoubles,
      projHp:   Math.max(0, defender.hp - atkDmg * (atkDoubles ? 2 : 1)),
    },
    defender: {
      unit:     defender,
      hit:      defHit,
      dmg:      defDmg,
      crit:     defCrit,
      doubles:  defDoubles,
      canCounter: counterPossible,
      projHp:   counterPossible
        ? Math.max(0, attacker.hp - defDmg * (defDoubles ? 2 : 1))
        : attacker.hp,
    },
  };
}
