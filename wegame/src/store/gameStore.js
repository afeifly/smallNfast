import { create } from 'zustand';
import initialUnits, { TEAM } from '../data/units';
import { CHAPTER_1 } from '../data/maps';
import useLocaleStore, { t } from './localeStore';

/** Shortcut: translate messages inside the store (no hooks). */
function msg(key, vars) {
  return t(useLocaleStore.getState().locale, key, vars);
}

export const PHASE = {
  PLAYER: 'player',
  ENEMY:  'enemy',
};

export const UI_STATE = {
  IDLE:            'idle',          // nothing selected
  UNIT_SELECTED:   'unit_selected', // unit selected, showing move range
  UNIT_MOVED:      'unit_moved',    // unit moved, showing action menu
  COMBAT_PREVIEW:  'combat_preview',// showing combat preview panel
  ENEMY_TURN:      'enemy_turn',    // enemy AI processing
};

const useGameStore = create((set, get) => ({
  // ── Map ──────────────────────────────────────────────────────────────────
  map: CHAPTER_1,
  turn: 1,
  phase: PHASE.PLAYER,
  uiState: UI_STATE.IDLE,
  message: msg('game.playerPhase'),

  // ── Units ─────────────────────────────────────────────────────────────────
  units: initialUnits.map(u => ({ ...u })),

  // ── Selection ─────────────────────────────────────────────────────────────
  selectedUnitId:   null,
  hoveredTile:      null,  // { x, y }
  pendingMovePos:   null,  // { x, y } — where unit moved before acting
  targetUnitId:     null,  // enemy being targeted for combat preview

  // ── Derived highlight sets (computed on unit select) ─────────────────────
  movementRange:  new Set(),   // Set<"x,y">
  attackRange:    new Set(),   // Set<"x,y">  (tiles only attackable, not reachable)

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  setHoveredTile(tile) {
    set({ hoveredTile: tile });
  },

  selectUnit(unitId) {
    const { units, phase, uiState } = get();
    const unit = units.find(u => u.id === unitId);

    // Only select player units during player phase
    if (!unit || unit.team !== TEAM.PLAYER) return;
    if (phase !== PHASE.PLAYER) return;
    if (unit.hasMoved && unit.hasActed) return; // exhausted
    if (uiState === UI_STATE.COMBAT_PREVIEW) return;

    set({
      selectedUnitId: unitId,
      uiState: UI_STATE.UNIT_SELECTED,
      targetUnitId: null,
      pendingMovePos: null,
    });
  },

  deselect() {
    const { uiState, units, selectedUnitId, pendingMovePos } = get();

    // If unit moved but hasn't acted yet, move it back
    if (uiState === UI_STATE.UNIT_MOVED && selectedUnitId && pendingMovePos) {
      const origPos = initialUnits.find(u => u.id === selectedUnitId)?.pos;
      // Actually just clear — we don't revert in this prototype
    }

    set({
      selectedUnitId: null,
      uiState: UI_STATE.IDLE,
      targetUnitId: null,
      pendingMovePos: null,
      movementRange: new Set(),
      attackRange: new Set(),
      message: msg('game.playerPhase'),
    });
  },

  setMovementRange(reachable, attackable) {
    set({ movementRange: reachable, attackRange: attackable });
  },

  moveUnit(unitId, toPos) {
    const { units, uiState, selectedUnitId } = get();
    if (unitId !== selectedUnitId) return;
    if (uiState !== UI_STATE.UNIT_SELECTED) return;

    const unit = units.find(u => u.id === unitId);
    if (!unit || unit.hasMoved) return;

    const newUnits = units.map(u =>
      u.id === unitId
        ? { ...u, pos: toPos, hasMoved: true }
        : u
    );

    set({
      units: newUnits,
      pendingMovePos: toPos,
      uiState: UI_STATE.UNIT_MOVED,
      movementRange: new Set(),
      attackRange: new Set(),
      message: msg('game.chooseAction'),
    });
  },

  waitUnit(unitId) {
    const { units } = get();
    const newUnits = units.map(u =>
      u.id === unitId ? { ...u, hasMoved: true, hasActed: true } : u
    );
    const allActed = newUnits
      .filter(u => u.team === TEAM.PLAYER && u.hp > 0)
      .every(u => u.hasActed);

    set({
      units: newUnits,
      selectedUnitId: null,
      uiState: allActed ? UI_STATE.ENEMY_TURN : UI_STATE.IDLE,
      pendingMovePos: null,
      movementRange: new Set(),
      attackRange: new Set(),
      message: allActed ? msg('game.enemyPhase') : msg('game.playerPhase'),
    });

    if (allActed) {
      setTimeout(() => get().startEnemyPhase(), 1200);
    }
  },

  selectTarget(enemyId) {
    set({
      targetUnitId: enemyId,
      uiState: UI_STATE.COMBAT_PREVIEW,
      message: msg('game.combatPrev'),
    });
  },

  cancelCombatPreview() {
    set({
      targetUnitId: null,
      uiState: UI_STATE.UNIT_MOVED,
      message: msg('game.chooseAction'),
    });
  },

  confirmAttack(attackerId, defenderId) {
    const { units } = get();
    // Simple combat resolution (full formulas in combat.js)
    // We'll resolve damage here for prototype
    const attacker = units.find(u => u.id === attackerId);
    const defender = units.find(u => u.id === defenderId);
    if (!attacker || !defender) return;

    // Import would cause circular issue; use inline simplified
    const atkDmg = Math.max(0, attacker.str - defender.def + 3);
    const defDmg = Math.max(0, defender.str - attacker.def + 1);

    let newUnits = units.map(u => {
      if (u.id === defenderId) return { ...u, hp: Math.max(0, u.hp - atkDmg) };
      return u;
    });

    // Counterattack
    const defAlive = newUnits.find(u => u.id === defenderId)?.hp > 0;
    if (defAlive) {
      newUnits = newUnits.map(u => {
        if (u.id === attackerId) return { ...u, hp: Math.max(0, u.hp - defDmg) };
        return u;
      });
    }

    // Mark attacker as done
    newUnits = newUnits.map(u =>
      u.id === attackerId ? { ...u, hasMoved: true, hasActed: true } : u
    );

    // Remove dead units
    newUnits = newUnits.filter(u => u.hp > 0);

    const allActed = newUnits
      .filter(u => u.team === TEAM.PLAYER && u.hp > 0)
      .every(u => u.hasActed);

    const allEnemiesDead = newUnits.filter(u => u.team === TEAM.ENEMY).length === 0;

    set({
      units: newUnits,
      selectedUnitId: null,
      targetUnitId: null,
      pendingMovePos: null,
      uiState: allEnemiesDead ? UI_STATE.IDLE : allActed ? UI_STATE.ENEMY_TURN : UI_STATE.IDLE,
      movementRange: new Set(),
      attackRange: new Set(),
      message: allEnemiesDead
        ? msg('game.victory')
        : allActed ? msg('game.enemyPhase') : msg('game.playerPhase'),
    });

    if (!allEnemiesDead && allActed) {
      setTimeout(() => get().startEnemyPhase(), 1200);
    }
  },

  startEnemyPhase() {
    set({ phase: PHASE.ENEMY, uiState: UI_STATE.ENEMY_TURN, message: msg('game.enemyPhase') });

    // Simple enemy AI: mark all enemies as done (they "acted")
    setTimeout(() => {
      const { units } = get();
      const newUnits = units.map(u =>
        u.team === TEAM.ENEMY ? { ...u, hasMoved: false, hasActed: false } : u
      );
      const playerUnits = newUnits.filter(u => u.team === TEAM.PLAYER && u.hp > 0);
      const resetPlayer = newUnits.map(u =>
        u.team === TEAM.PLAYER ? { ...u, hasMoved: false, hasActed: false } : u
      );

      set({
        units: resetPlayer,
        phase: PHASE.PLAYER,
        uiState: UI_STATE.IDLE,
        turn: get().turn + 1,
        message: msg('game.turn', { n: get().turn + 1 }),
      });
    }, 1500);
  },
}));

export default useGameStore;
