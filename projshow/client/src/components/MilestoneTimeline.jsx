import React from 'react';
import { CheckCircle2, Circle, Clock, Trash2 } from 'lucide-react';
import { useProjects } from '../context/ProjectContext.jsx';

const STATUS_CONFIG = {
  completed: { icon: CheckCircle2, color: 'var(--emerald)', label: 'Completed' },
  'in-progress': { icon: Clock, color: 'var(--cyan)', label: 'In Progress' },
  pending: { icon: Circle, color: 'var(--text-muted)', label: 'Pending' },
};

const STATUS_CYCLE = ['pending', 'in-progress', 'completed'];

export default function MilestoneTimeline({ project, isEditing }) {
  const { updateMilestone, deleteMilestone, createMilestone } = useProjects();
  const milestones = (project.milestones || []).sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

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

  const handleAdd = async () => {
    if (!isEditing) return;
    const title = prompt('Milestone title:');
    if (!title) return;
    const date = prompt('Date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!date) return;
    await createMilestone(project.id, { title, date, status: 'pending' });
  };

  return (
    <div className="milestone-timeline">
      <div className="milestone-timeline-header">
        <h4>Milestones</h4>
        {isEditing && (
          <button className="milestone-add-btn" onClick={handleAdd}>+ Add</button>
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
                  <span className="milestone-title">{ms.title}</span>
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
  );
}
