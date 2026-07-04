import React from 'react';
import ProjectCard from './ProjectCard.jsx';
import { useProjects } from '../context/ProjectContext.jsx';
import { Zap, Clock, Wrench } from 'lucide-react';

const LANES = [
  { key: 'active', label: 'Current Active', icon: Zap, accent: 'var(--cyan)' },
  { key: 'low-priority', label: 'Low Priority', icon: Clock, accent: 'var(--purple)' },
  { key: 'maintenance', label: 'Under Maintenance', icon: Wrench, accent: 'var(--emerald)' },
];

export default function BoardView() {
  const { projects, setSelectedProject } = useProjects();

  return (
    <div className="board-view">
      {LANES.map((lane) => {
        const laneProjects = projects.filter((p) => p.status === lane.key);
        if (laneProjects.length === 0) return null;
        const Icon = lane.icon;
        return (
          <section key={lane.key} className="board-lane animate-fade-in">
            <div className="board-lane-header">
              <Icon size={18} style={{ color: lane.accent }} />
              <h2 className="board-lane-title" style={{ color: lane.accent }}>{lane.label}</h2>
              <span className="board-lane-count">{laneProjects.length}</span>
            </div>
            <div className="board-lane-grid">
              {laneProjects.map((project, i) => (
                <div key={project.id} style={{ animationDelay: `${i * 80}ms` }} className="animate-fade-in">
                  <ProjectCard
                    project={project}
                    onClick={() => setSelectedProject(project)}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
