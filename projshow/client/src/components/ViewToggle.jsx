import React from 'react';
import { LayoutDashboard, BarChart3 } from 'lucide-react';

export default function ViewToggle({ view, onToggle }) {
  return (
    <div className="view-toggle">
      <button
        className={`view-toggle-btn ${view === 'board' ? 'active' : ''}`}
        onClick={() => onToggle('board')}
      >
        <LayoutDashboard size={16} />
        <span>Board</span>
      </button>
      <button
        className={`view-toggle-btn ${view === 'gantt' ? 'active' : ''}`}
        onClick={() => onToggle('gantt')}
      >
        <BarChart3 size={16} />
        <span>Gantt</span>
      </button>
      <div
        className="view-toggle-indicator"
        style={{ transform: view === 'gantt' ? 'translateX(100%)' : 'translateX(0)' }}
      />
    </div>
  );
}
