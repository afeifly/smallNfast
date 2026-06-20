import React from 'react';
import useGameStore, { UI_STATE } from '../../store/gameStore';
import { useT } from '../../store/localeStore';
import { CLASS_ICON, TEAM } from '../../data/units';
import { TERRAIN } from '../../data/maps';
import { getCombatPreview, getWeaponTriangleAdv } from '../../utils/combat';
import { getManhattanDist } from '../../utils/pathfinding';

/**
 * Full-featured combat preview panel — GBA Fire Emblem style forecast.
 * Shows hit%, damage, crit% and projected HP for both combatants.
 */
export default function CombatPreview() {
  const _ = useT();
  const {
    uiState, selectedUnitId, targetUnitId, units, map,
    pendingMovePos, confirmAttack, cancelCombatPreview
  } = useGameStore();

  if (uiState !== UI_STATE.COMBAT_PREVIEW) return null;

  const attacker = units.find(u => u.id === selectedUnitId);
  const defender = units.find(u => u.id === targetUnitId);
  if (!attacker || !defender) return null;

  const atkPos  = pendingMovePos || attacker.pos;
  const dist    = getManhattanDist(atkPos, defender.pos);
  const defTile = map.tiles[defender.pos.y]?.[defender.pos.x];

  const preview = getCombatPreview(attacker, defender, defTile, dist);
  const atk = preview.attacker;
  const def = preview.defender;

  const wtAdv = getWeaponTriangleAdv(attacker.weaponType, defender.weaponType);
  const wtLabel = wtAdv > 0 ? _('combat.wta') : wtAdv < 0 ? _('combat.wtd') : '';

  return (
    <div className="combat-preview">
      <div className="cp-title">⚔ {_('combat.forecast')}</div>

      {/* Unit portraits */}
      <div className="cp-units">
        <div className="cp-unit cp-attacker">
          <div className="cp-unit-icon">{CLASS_ICON[attacker.class]}</div>
          <div className="cp-unit-name">{attacker.name}</div>
          <div className="cp-unit-hp">{attacker.hp}→{atk.projHp === undefined ? attacker.hp : def.projHp}</div>
        </div>

        <div className="cp-vs">{_('combat.vs')}</div>

        <div className="cp-unit cp-defender">
          <div className="cp-unit-icon">{CLASS_ICON[defender.class]}</div>
          <div className="cp-unit-name">{defender.name}</div>
          <div className="cp-unit-hp">{defender.hp}→{atk.projHp}</div>
        </div>
      </div>

      {/* Combat stats columns */}
      <div className="cp-stats">
        {/* Attacker column */}
        <div className="cp-stat-col">
          <div className="cp-stat-row">
            <span className="cp-stat-label">{_('combat.hit')}</span>
            <span className={`cp-stat-val ${atk.hit >= 90 ? 'high' : atk.hit === 0 ? 'zero' : ''}`}>{atk.hit}%</span>
          </div>
          <div className="cp-stat-row">
            <span className="cp-stat-label">{_('combat.dmg')}</span>
            <span className="cp-stat-val">{atk.dmg}</span>
          </div>
          <div className="cp-stat-row">
            <span className="cp-stat-label">{_('combat.crit')}</span>
            <span className={`cp-stat-val ${atk.crit > 0 ? 'high' : 'zero'}`}>{atk.crit}%</span>
          </div>
          {atk.doubles && (
            <div style={{ fontSize: 7, color: 'var(--gold-mid)', fontFamily: 'var(--font-pixel)', marginTop: 2 }}>
              ×2 ATTACK
            </div>
          )}
          {wtLabel && (
            <div className="cp-wt-badge" style={{ marginTop: 2, background: wtAdv > 0 ? 'var(--blue-dark)' : 'var(--red-dark)' }}>
              {wtLabel}
            </div>
          )}
        </div>

        {/* Defender column */}
        <div className="cp-stat-col">
          {def.canCounter ? (
            <>
              <div className="cp-stat-row">
                <span className="cp-stat-label">{_('combat.hit')}</span>
                <span className={`cp-stat-val ${def.hit >= 90 ? 'high' : def.hit === 0 ? 'zero' : ''}`}>{def.hit}%</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-label">{_('combat.dmg')}</span>
                <span className="cp-stat-val">{def.dmg}</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-label">{_('combat.crit')}</span>
                <span className={`cp-stat-val ${def.crit > 0 ? 'high' : 'zero'}`}>{def.crit}%</span>
              </div>
              {def.doubles && (
                <div style={{ fontSize: 7, color: 'var(--red-light)', fontFamily: 'var(--font-pixel)', marginTop: 2 }}>
                  {_('combat.double')}
    </div>
              )}
            </>
          ) : (
            <div className="cp-no-counter">
              {_('combat.noCounter')}<br />{_('combat.outOfRange')}
            </div>
          )}
        </div>
      </div>

      {/* Terrain info */}
      {defTile && TERRAIN[defTile] && (
        <div style={{ padding: '4px 8px', borderTop: 'var(--border-mid)', fontSize: 8, color: 'var(--ink-4)' }}>
          {_('combat.defTerrain', { label: _('terrain.' + defTile), def: TERRAIN[defTile].def, avo: TERRAIN[defTile].avo })}
        </div>
      )}

      {/* Action buttons */}
      <div className="cp-actions">
        <button
          className="action-btn"
          onClick={() => confirmAttack(selectedUnitId, targetUnitId)}
        >
          ⚔ {_('combat.fight')}
        </button>
        <button
          className="action-btn danger"
          onClick={cancelCombatPreview}
          style={{ background: 'transparent', border: '2px solid var(--ink-4)', color: 'var(--ink-6)' }}
        >
          ✕ {_('combat.back')}
        </button>
      </div>
    </div>
  );
}
