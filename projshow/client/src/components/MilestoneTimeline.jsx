import React, { useState } from 'react';
import { CheckCircle2, Circle, Clock, Trash2, X } from 'lucide-react';
import { useProjects } from '../context/ProjectContext.jsx';

const STATUS_CONFIG = {
  completed: { icon: CheckCircle2, color: 'var(--emerald)', label: 'Completed' },
  'in-progress': { icon: Clock, color: 'var(--cyan)', label: 'In Progress' },
  pending: { icon: Circle, color: 'var(--text-muted)', label: 'Pending' },
};

const STATUS_CYCLE = ['pending', 'in-progress', 'completed'];

// ── Small inline dialog for add/edit ──────────────────────────────────────────
function MilestoneDialog({ initialTitle = '', initialDate = '', onSave, onCancel }) {
  const today = new Date().toISOString().split('T')[0];
  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState(initialDate || today);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!date) { setError('Date is required.'); return; }
    onSave({ title: title.trim(), date });
  };

  return (
    <div className="milestone-dialog-backdrop" onClick={onCancel}>
      <div className="milestone-dialog glass-panel animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="milestone-dialog-header">
          <span className="milestone-dialog-title">{initialTitle ? 'Edit Milestone' : 'Add Milestone'}</span>
          <button className="milestone-dialog-close" onClick={onCancel}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} className="milestone-dialog-form">
          {error && <div className="milestone-dialog-error">{error}</div>}
          <div className="form-field">
            <label>Title</label>
            <input
              type="text"
              placeholder="e.g. MVP Release"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(''); }}
              autoFocus
            />
          </div>
          <div className="form-field">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setError(''); }}
            />
          </div>
          <div className="milestone-dialog-actions">
            <button type="button" className="milestone-dialog-cancel-btn" onClick={onCancel}>Cancel</button>
            <button type="submit" className="milestone-dialog-save-btn">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main MilestoneTimeline ─────────────────────────────────────────────────────
export default function MilestoneTimeline({ project, isEditing }) {
  const { updateMilestone, deleteMilestone, createMilestone } = useProjects();
  const milestones = (project.milestones || []).sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  // Dialog state: null | 'add' | { id, title, date } (edit mode)
  const [dialog, setDialog] = useState(null);

  const handleToggleStatus = async (ms) => {
    if (!isEditing) return;
    const currentIdx = STATUS_CYCLE.indexOf(ms.status);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    await updateMilestone(ms.id, { status: nextStatus }, project.id);
  };

  const handleDelete = async (ms) => {
    if (!isEditing) return;
    await deleteMilestone(ms.id, project.id);
  };

  const handleDialogSave = async ({ title, date }) => {
    if (dialog === 'add') {
      await createMilestone(project.id, { title, date, status: 'pending' });
    } else {
      // edit mode — dialog holds { id, title, date }
      await updateMilestone(dialog.id, { title, date }, project.id);
    }
    setDialog(null);
  };

  return (
    <>
      {dialog && (
        <MilestoneDialog
          initialTitle={dialog === 'add' ? '' : dialog.title}
          initialDate={dialog === 'add' ? '' : dialog.date}
          onSave={handleDialogSave}
          onCancel={() => setDialog(null)}
        />
      )}

      <div className="milestone-timeline">
        <div className="milestone-timeline-header">
          <h4>Milestones</h4>
          {isEditing && (
            <button className="milestone-add-btn" onClick={() => setDialog('add')}>+ Add</button>
          )}
        </div>
        <div className="milestone-timeline-list">
          {milestones.length === 0 && (
            <p className="milestone-empty">No milestones yet.</p>
          )}
          {milestones.map((ms, i) => {
            const config = STATUS_CONFIG[ms.status] || STATUS_CONFIG.pending;
            const Icon = config.icon;
            const isLast = i === milestones.length - 1;
            return (
              <div key={ms.id} className="milestone-node">
                <div className="milestone-line-segment">
                  <div
                    className={`milestone-dot ${ms.status === 'in-progress' ? 'animate-pulse' : ''}`}
                    style={{
                      borderColor: config.color,
                      background: ms.status === 'completed' ? config.color : 'var(--bg-primary)',
                      cursor: isEditing ? 'pointer' : 'default',
                    }}
                    onClick={() => handleToggleStatus(ms)}
                    title={isEditing ? `Click to cycle: ${config.label}` : `${config.label}`}
                  >
                    {ms.status === 'completed' && <CheckCircle2 size={14} color="white" />}
                    {ms.status === 'in-progress' && <Clock size={14} color={config.color} />}
                  </div>
                  {!isLast && <div className="milestone-connector" />}
                </div>
                <div className="milestone-content">
                  <div className="milestone-title-row">
                    <span
                      className={`milestone-title ${isEditing ? 'milestone-title-editable' : ''}`}
                      onClick={() => isEditing && setDialog({ id: ms.id, title: ms.title, date: ms.date || '' })}
                      title={isEditing ? 'Click to edit' : undefined}
                    >
                      {ms.title}
                      {isEditing && <span className="milestone-edit-hint">✎</span>}
                    </span>
                    {isEditing && (
                      <button className="milestone-delete-btn" onClick={() => handleDelete(ms)} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <span className="milestone-date" style={{ color: config.color }}>{ms.date || 'No date'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
