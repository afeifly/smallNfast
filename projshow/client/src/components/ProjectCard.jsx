import React from 'react';
import ProjectArt from './ProjectArt.jsx';

const STATUS_LABELS = {
  active: 'Active',
  'low-priority': 'Low Priority',
  maintenance: 'Maintenance',
};

export default function ProjectCard({ project, onClick }) {
  const completedMilestones = (project.milestones || []).filter((m) => m.status === 'completed').length;
  const totalMilestones = (project.milestones || []).length;
  const tags = project.tags || [];
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (project.progress / 100) * circumference;

  return (
    <div className="project-card glass-panel" onClick={onClick} role="button" tabIndex={0}>
      {project.preview_images && project.preview_images.length > 0 ? (
        <div className="project-card-preview-container">
          <img
            src={project.preview_images[0]}
            alt={project.name}
            className="project-card-preview-img"
          />
        </div>
      ) : (
        <ProjectArt seed={project.color_seed || project.name} />
      )}
      <div className="project-card-body">
        <div className="project-card-header">
          <div className="project-card-info">
            <h3 className="project-card-title">{project.name}</h3>
            <span className={`project-card-status status-${project.status}`}>
              {STATUS_LABELS[project.status] || project.status}
            </span>
          </div>
          <div className="project-card-progress">
            <svg width="56" height="56" viewBox="0 0 80 80">
              <circle
                cx="40" cy="40" r="36"
                fill="none"
                stroke="var(--bg-surface)"
                strokeWidth="5"
              />
              <circle
                cx="40" cy="40" r="36"
                fill="none"
                stroke="var(--cyan)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform="rotate(-90 40 40)"
                style={{ transition: 'stroke-dashoffset 0.8s var(--ease-out)' }}
              />
              <text x="40" y="40" textAnchor="middle" dominantBaseline="central"
                fill="var(--text-primary)" fontSize="14" fontWeight="600">
                {project.progress}%
              </text>
            </svg>
          </div>
        </div>
        <p className="project-card-desc">{project.description}</p>
        <div className="project-card-meta">
          <span className="project-card-category">{project.category}</span>
          {totalMilestones > 0 && (
            <span className="project-card-milestones">
              {completedMilestones}/{totalMilestones} milestones
            </span>
          )}
        </div>
        {tags.length > 0 && (
          <div className="project-card-tags">
            {tags.map((tag, i) => (
              <span key={i} className="project-card-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
