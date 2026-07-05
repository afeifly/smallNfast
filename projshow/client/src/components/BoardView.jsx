import React, { useState } from 'react';
import ProjectCard from './ProjectCard.jsx';
import { useProjects } from '../context/ProjectContext.jsx';
import { Zap, Clock, Wrench, Archive, ChevronDown, Pencil, Check, X } from 'lucide-react';

const LANES = [
  {
    key: 'active',
    label: 'Current Active',
    icon: Zap,
    accent: 'var(--cyan)',
    defaultNote: 'These projects are actively being developed and are the current focus.',
  },
  {
    key: 'low-priority',
    label: 'Low Priority',
    icon: Clock,
    accent: 'var(--purple)',
    defaultNote: 'These projects are planned or in a holding pattern. Development may resume when capacity allows.',
  },
  {
    key: 'maintenance',
    label: 'Under Maintenance',
    icon: Wrench,
    accent: 'var(--emerald)',
    defaultNote: 'These projects are live and being maintained. No major new features are being added.',
  },
  {
    key: 'archived',
    label: 'Archived',
    icon: Archive,
    accent: 'var(--text-muted)',
    defaultNote: 'Archived projects mean no new development is needed. They are kept for reference only.',
  },
];

function getLaneNotes(userId) {
  try {
    const raw = localStorage.getItem(`projshow_lane_notes_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveLaneNotes(userId, notes) {
  try {
    localStorage.setItem(`projshow_lane_notes_${userId}`, JSON.stringify(notes));
  } catch {}
}

// ── Single lane section with inline toggle ─────────────────────────────────
function LaneSection({ lane, laneProjects, userId, isOwner, onSelect }) {
  const Icon = lane.icon;

  const [notes, setNotes] = useState(() => getLaneNotes(userId));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const text = notes[lane.key] ?? lane.defaultNote;

  const startEdit = (e) => {
    e.stopPropagation();
    setDraft(text);
    setEditing(true);
    setOpen(true);
  };

  const saveEdit = () => {
    const next = { ...notes, [lane.key]: draft.trim() || lane.defaultNote };
    setNotes(next);
    saveLaneNotes(userId, next);
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
  };

  return (
    <section className="board-lane animate-fade-in">
      {/* Header row — toggle lives here, right after the count badge */}
      <div className="board-lane-header">
        <Icon size={18} style={{ color: lane.accent }} />
        <h2 className="board-lane-title" style={{ color: lane.accent }}>{lane.label}</h2>
        <span className="board-lane-count">{laneProjects.length}</span>

        {/* Inline expand toggle */}
        <button
          className={`lane-note-toggle-btn ${open ? 'active' : ''}`}
          onClick={() => { if (!editing) setOpen((v) => !v); }}
          title={open ? 'Collapse description' : 'Expand description'}
        >
          <ChevronDown size={13} className={`lane-note-chevron ${open ? 'rotated' : ''}`} />
          {isOwner && !editing && (
            <Pencil
              size={11}
              className="lane-note-pencil"
              onClick={startEdit}
              title="Edit description"
            />
          )}
        </button>
      </div>

      {/* Collapsible body — opens below the header */}
      {open && (
        <div className="lane-note-body animate-fade-in">
          {editing ? (
            <div className="lane-note-edit-wrap">
              <textarea
                className="lane-note-textarea"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                rows={4}
                placeholder="Describe what this group means…"
              />
              <div className="lane-note-edit-actions">
                <button className="lane-note-save-btn" onClick={saveEdit}>
                  <Check size={13} /> Save
                </button>
                <button className="lane-note-cancel-btn" onClick={cancelEdit}>
                  <X size={13} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="lane-note-text">{text}</p>
          )}
        </div>
      )}

      <div className="board-lane-grid">
        {laneProjects.map((project, i) => (
          <div key={project.id} style={{ animationDelay: `${i * 80}ms` }} className="animate-fade-in">
            <ProjectCard project={project} onClick={() => onSelect(project)} />
          </div>
        ))}
      </div>
    </section>
  );
}

function getFarthestTaskTimestamp(project) {
  const tasks = project.tasks || [];
  let maxTime = 0;
  for (const t of tasks) {
    if (t.end_date) {
      const time = new Date(t.end_date).getTime();
      if (time > maxTime) maxTime = time;
    }
    if (t.start_date) {
      const time = new Date(t.start_date).getTime();
      if (time > maxTime) maxTime = time;
    }
  }
  return maxTime;
}

// ── Main BoardView ─────────────────────────────────────────────────────────
export default function BoardView() {
  const { projects, setSelectedProject, currentUser, isSharedView } = useProjects();
  const userId = currentUser?.id ?? 'guest';
  const isOwner = !isSharedView;

  return (
    <div className="board-view">
      {LANES.map((lane) => {
        let laneProjects = projects.filter((p) => p.status === lane.key);
        if (laneProjects.length === 0) return null;

        if (lane.key === 'active') {
          laneProjects = [...laneProjects].sort((a, b) => {
            const timeA = getFarthestTaskTimestamp(a);
            const timeB = getFarthestTaskTimestamp(b);
            if (timeA !== timeB) return timeB - timeA; // Farthest first
            return new Date(b.created_at) - new Date(a.created_at);
          });
        }

        return (
          <LaneSection
            key={lane.key}
            lane={lane}
            laneProjects={laneProjects}
            userId={userId}
            isOwner={isOwner}
            onSelect={setSelectedProject}
          />
        );
      })}
    </div>
  );
}
