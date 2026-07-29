import React, { useState, useEffect } from 'react';
import { Plus, Folder, Trash2, ArrowRight, LogOut, Video, Music, Calendar } from 'lucide-react';
import { getProjects, createNewProject, deleteProject } from '../utils/storage';
import { deleteProjectStorage } from '../utils/idbStorage';

export default function Projects({ onSelectProject, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjName, setNewProjName] = useState('');

  useEffect(() => {
    setProjects(getProjects());
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newProjName.trim()) return;
    const proj = createNewProject(newProjName);
    setIsModalOpen(false);
    setNewProjName('');
    onSelectProject(proj);
  };

  const handleDelete = (e, proj) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this project?')) {
      const updated = deleteProject(proj.id);
      setProjects(updated);
      deleteProjectStorage(proj.id, (proj.tracks || []).map(t => t.id));
    }
  };

  return (
    <div className="app-container" style={{ padding: '30px 40px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '40px',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--primary), var(--accent-purple))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <Video size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '700' }}>SUTO VoiceOver Studio</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Project Management & Audio Overlay</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> New Project
          </button>
          <button className="btn btn-secondary" onClick={onLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main List */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Your Projects ({projects.length})
        </h2>

        {projects.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Folder size={48} color="var(--text-dim)" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No projects created yet</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
              Create a new project to start adding MiniMax voice narration to your videos.
            </p>
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} /> Create First Project
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px'
          }}>
            {projects.map((proj) => (
              <div 
                key={proj.id} 
                className="glass-panel animate-fade-in"
                onClick={() => onSelectProject(proj)}
                style={{ 
                  padding: '24px', 
                  cursor: 'pointer',
                  transition: 'transform 0.2s, border-color 0.2s',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = 'var(--border-highlight)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', wordBreak: 'break-word', paddingRight: '24px' }}>
                    {proj.name}
                  </h3>
                  <button 
                    onClick={(e) => handleDelete(e, proj)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                    title="Delete project"
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Music size={14} color="var(--accent-cyan)" />
                    <span>{(proj.tracks || []).length} Voice Tracks</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={14} color="var(--text-dim)" />
                    <span>{new Date(proj.updatedAt || proj.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                    Open Project <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '16px' }}>Create New Project</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Project Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. SUTO iTEC Product Demo 2026"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!newProjName.trim()}>
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
