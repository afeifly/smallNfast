import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useProjects } from '../context/ProjectContext.jsx';

export default function CreateProjectModal({ isOpen, onClose }) {
  const { createProject, setSelectedProject } = useProjects();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Web App');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const created = await createProject({
        name: name.trim(),
        category: category.trim(),
        description: description.trim(),
        status,
        progress: 0,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        tags: [],
        links: [],
      });
      setSelectedProject(created);
      onClose();
      // Reset form
      setName('');
      setDescription('');
      setCategory('Web App');
      setStatus('active');
    } catch (err) {
      alert('Error creating project: ' + err.message);
    }
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="detail-drawer glass-panel create-project-modal">
        <div className="drawer-scroll">
          <div className="drawer-header">
            <h2 className="drawer-title" style={{ padding: '20px 20px 0', fontSize: '1.4rem' }}>
              Create New Project
            </h2>
            <button className="drawer-close" onClick={onClose}><X size={20} /></button>
          </div>
          <form className="drawer-body" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="drawer-progress-section">
              <label className="drawer-label">Project Name *</label>
              <input
                required
                placeholder="e.g. S4C Lab Server"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div className="drawer-progress-section">
              <label className="drawer-label">Category</label>
              <input
                placeholder="e.g. Backend API, Web App, Tool"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div className="drawer-progress-section">
              <label className="drawer-label">Initial Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="active">Active</option>
                <option value="low-priority">Low Priority</option>
                <option value="maintenance">Maintenance</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="drawer-progress-section">
              <label className="drawer-label">Description</label>
              <textarea
                placeholder="Enter a brief summary of the project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                className="drawer-delete-btn"
                style={{ border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="add-project-btn"
                style={{ border: 'none', padding: '10px 20px', borderRadius: 'var(--radius-sm)' }}
              >
                Create Project
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
