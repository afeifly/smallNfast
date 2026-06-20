import React from 'react';
import { useT } from '../../store/localeStore';
import { CLASS_ICON } from '../../data/units';
import { TERRAIN } from '../../data/maps';

/**
 * Unit stat card shown in sidebar when a unit is hovered/selected.
 */
export default function UnitCard({ unit, isEnemy = false }) {
  const _ = useT();
  if (!unit) return null;

  const hpPct  = (unit.hp / unit.maxHp) * 100;
  const hpClass = hpPct <= 25 ? 'crit' : hpPct <= 50 ? 'low' : '';
  const icon    = CLASS_ICON[unit.class] || '?';

  return (
    <div className={`unit-card ${isEnemy ? 'enemy' : ''}`}>
      <div className="uc-header">
        <div className="uc-icon">{icon}</div>
        <div>
          <div className="uc-name">{unit.name}</div>
          <div className="uc-class">{_('class.' + unit.class.toLowerCase())} · {_('stats.lv')} {unit.level}</div>
        </div>
      </div>

      <div className="uc-hp-wrap">
        <span className="uc-hp-label">HP</span>
        <div className="uc-hp-bar-bg">
          <div
            className={`uc-hp-bar-fill ${hpClass}`}
            style={{ width: `${hpPct}%` }}
          />
        </div>
        <span className="uc-hp-nums">{unit.hp}/{unit.maxHp}</span>
      </div>

      <div className="stat-grid">
        {[
          [_('stats.str'), unit.str],
          [_('stats.mag'), unit.mag],
          [_('stats.skl'), unit.skl],
          [_('stats.spd'), unit.spd],
          [_('stats.lck'), unit.lck],
          [_('stats.def'), unit.def],
          [_('stats.res'), unit.res],
          [_('stats.mov'), unit.mov],
        ].map(([label, val]) => (
          <div className="stat-row" key={label}>
            <span className="stat-label">{label}</span>
            <span className="stat-val">{val}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 4, fontSize: 8, color: 'var(--ink-4)', fontFamily: 'var(--font-pixel)' }}>
        {_('weapon.' + unit.weaponType.toLowerCase())} · {_('stats.range')} {unit.attackRange.join('–')}
      </div>
    </div>
  );
}
