import React, { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Calendar, Tag, CheckCircle2, Circle, Clock, Trash2, Plus, Upload, ImagePlus } from 'lucide-react';
import { useProjects } from '../context/ProjectContext.jsx';
import { api } from '../api/client.js';
import MilestoneTimeline from './MilestoneTimeline.jsx';
import ProjectArt from './ProjectArt.jsx';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'low-priority', label: 'Low Priority' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'archived', label: 'Archived' },
];

const TASK_STATUS_CYCLE = ['pending', 'in-progress', 'completed'];
const TASK_STATUS_ICON = {
  completed: { icon: CheckCircle2, color: 'var(--emerald)' },
  'in-progress': { icon: Clock, color: 'var(--cyan)' },
  pending: { icon: Circle, color: 'var(--text-muted)' },
};

export default function DetailDrawer() {
  const {
    selectedProject: project,
    setSelectedProject,
    updateProject,
    deleteProject,
    updateTask,
    createTask,
    deleteTask,
    isSharedView,
  } = useProjects();

  const [isEditing, setIsEditing] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', start_date: '', end_date: '' });
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [activeImgIndex, setActiveImgIndex] = useState(0);

  // Editable project name
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef(null);

  // Tag management
  const [newTag, setNewTag] = useState('');

  // Image upload
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setActiveImgIndex(0);
    setIsEditing(false);
    setEditingName(false);
    setNameDraft('');
  }, [project?.id]);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  if (!project) return null;

  const handleClose = () => setSelectedProject(null);

  const handleStatusChange = (e) => {
    updateProject(project.id, { status: e.target.value });
  };

  const handleProgressChange = (e) => {
    updateProject(project.id, { progress: parseInt(e.target.value) });
  };

  const handleTaskStatusToggle = (task) => {
    if (!isEditing) return;
    const idx = TASK_STATUS_CYCLE.indexOf(task.status);
    const next = TASK_STATUS_CYCLE[(idx + 1) % TASK_STATUS_CYCLE.length];
    updateTask(task.id, { status: next }, project.id);
  };

  const handleAddTask = () => {
    if (!newTask.title.trim()) return;
    createTask(project.id, {
      title: newTask.title,
      start_date: newTask.start_date || null,
      end_date: newTask.end_date || null,
      status: 'pending',
    });
    setNewTask({ title: '', start_date: '', end_date: '' });
    setAddingTask(false);
  };

  const handleDeleteProject = () => {
    if (confirm(`Delete "${project.name}" and all its tasks/milestones?`)) {
      deleteProject(project.id);
    }
  };

  // Commit edited name
  const handleNameSave = () => {
    if (nameDraft.trim() && nameDraft.trim() !== project.name) {
      updateProject(project.id, { name: nameDraft.trim() });
    }
    setEditingName(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') handleNameSave();
    if (e.key === 'Escape') setEditingName(false);
  };

  // File upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (file.type !== 'image/jpeg') {
      setUploadError('Only JPEG images are allowed.');
      e.target.value = '';
      return;
    }
    if (file.size > 1_000_000) {
      setUploadError('File size must be less than 1 MB.');
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const { url } = await api.uploadImage(file);
      const nextImages = [...(project.preview_images || []), url];
      await updateProject(project.id, { preview_images: nextImages });
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Tag handlers
  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    const existingTags = project.tags || [];
    if (existingTags.includes(trimmed)) { setNewTag(''); return; }
    updateProject(project.id, { tags: [...existingTags, trimmed] });
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove) => {
    const nextTags = (project.tags || []).filter((t) => t !== tagToRemove);
    updateProject(project.id, { tags: nextTags });
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }
  };

  const links = project.links || [];
  const tags = project.tags || [];
  const tasks = project.tasks || [];

  return (
    <>
      <div className="drawer-overlay" onClick={handleClose} />
      <aside className="detail-drawer glass-panel">
        <div className="drawer-scroll">
          {/* Header */}
          <div className="drawer-header">
            {project.preview_images && project.preview_images.length > 0 ? (
              <div className="drawer-header-preview-container">
                <img
                  src={project.preview_images[activeImgIndex]}
                  alt={`${project.name} Preview ${activeImgIndex + 1}`}
                  className="drawer-header-preview-img"
                />
                {project.preview_images.length > 1 && (
                  <>
                    <button
                      className="preview-nav-btn prev"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setActiveImgIndex((prev) => (prev === 0 ? project.preview_images.length - 1 : prev - 1));
                      }}
                    >
                      &lt;
                    </button>
                    <button
                      className="preview-nav-btn next"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setActiveImgIndex((prev) => (prev === project.preview_images.length - 1 ? 0 : prev + 1));
                      }}
                    >
                      &gt;
                    </button>
                    <div className="preview-dots">
                      {project.preview_images.map((_, idx) => (
                        <span
                          key={idx}
                          className={`preview-dot ${idx === activeImgIndex ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setActiveImgIndex(idx);
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <ProjectArt seed={project.color_seed || project.name} height={540} />
            )}
            <div className="drawer-header-actions">
              {!isSharedView && (
                <button
                  className={`drawer-edit-mode-btn ${isEditing ? 'active' : ''}`}
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? 'Done' : 'Edit Project'}
                </button>
              )}
              <button className="drawer-close" onClick={handleClose}><X size={20} /></button>
            </div>
          </div>

          <div className="drawer-body">
            <div className="drawer-grid">
              {/* Left Column: Project Info */}
              <div className="drawer-left-col">
                <div className="drawer-title-row">
                  {/* Editable project name */}
                  {isEditing && editingName ? (
                    <input
                      ref={nameInputRef}
                      className="drawer-title-input"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onBlur={handleNameSave}
                      onKeyDown={handleNameKeyDown}
                    />
                  ) : (
                    <h2
                      className={`drawer-title ${isEditing ? 'drawer-title-editable' : ''}`}
                      onClick={() => {
                        if (isEditing) {
                          setNameDraft(project.name);
                          setEditingName(true);
                        }
                      }}
                      title={isEditing ? 'Click to edit project name' : undefined}
                    >
                      {project.name}
                      {isEditing && <span className="drawer-title-edit-hint">✎</span>}
                    </h2>
                  )}
                  {isEditing ? (
                    <select
                      className={`drawer-status-select status-${project.status}`}
                      value={project.status}
                      onChange={handleStatusChange}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`project-status-badge status-${project.status}`}>
                      {project.status === 'low-priority' ? 'Low Priority'
                        : project.status === 'maintenance' ? 'Maintenance'
                        : project.status === 'archived' ? 'Archived'
                        : 'Active'}
                    </span>
                  )}
                </div>

                <p className="drawer-desc">{project.description}</p>

                {/* Meta */}
                <div className="drawer-meta">
                  <div className="drawer-meta-item">
                    <Tag size={14} />
                    <span>{project.category}</span>
                  </div>
                  <div className="drawer-meta-item">
                    <Calendar size={14} />
                    <span>{project.start_date || '—'} → {project.end_date || '—'}</span>
                  </div>
                </div>

                {/* Progress section */}
                <div className="drawer-progress-section">
                  <label className="drawer-label">Progress: {project.progress}%</label>
                  {isEditing ? (
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={project.progress}
                      onChange={handleProgressChange}
                      className="drawer-progress-slider"
                    />
                  ) : (
                    <div className="drawer-progress-display">
                      <div className="drawer-progress-track">
                        <div className="drawer-progress-fill" style={{ width: `${project.progress}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="drawer-section">
                  <h4 className="drawer-section-title">Tags</h4>
                  <div className="drawer-tags">
                    {tags.map((tag, i) => (
                      <span key={i} className={`drawer-tag ${isEditing ? 'drawer-tag-removable' : ''}`}>
                        {tag}
                        {isEditing && (
                          <button
                            className="drawer-tag-remove"
                            onClick={() => handleRemoveTag(tag)}
                            title={`Remove tag "${tag}"`}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                    {tags.length === 0 && !isEditing && (
                      <span style={{ opacity: 0.5, fontSize: '0.9rem' }}>No tags.</span>
                    )}
                  </div>
                  {isEditing && (
                    <div className="drawer-tag-add-row">
                      <input
                        placeholder="New tag…"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        className="drawer-tag-input"
                      />
                      <button className="milestone-add-btn" onClick={handleAddTag}>+ Add</button>
                    </div>
                  )}
                </div>

                {/* Links */}
                <div className="drawer-section">
                  <h4 className="drawer-section-title">Links {links.length > 0 && `(${links.length}/5)`}</h4>
                  
                  {!isEditing && links.length > 0 && (
                    <div className="drawer-links">
                      {links.map((link, i) => (
                        <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="drawer-link">
                          <ExternalLink size={13} />
                          <span>{link.label}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  {!isEditing && links.length === 0 && (
                    <span className="drawer-text-empty" style={{ opacity: 0.5, fontSize: '0.9rem' }}>No links attached.</span>
                  )}

                  {isEditing && (
                    <div className="drawer-edit-list">
                      {links.map((link, i) => (
                        <div key={i} className="drawer-edit-item">
                          <span className="drawer-edit-item-text">{link.label} ({link.url})</span>
                          <button
                            className="milestone-delete-btn"
                            onClick={() => {
                              const nextLinks = links.filter((_, idx) => idx !== i);
                              updateProject(project.id, { links: nextLinks });
                            }}
                            title="Delete link"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}

                      {links.length < 5 ? (
                        <div className="drawer-add-row-form">
                          <input
                            placeholder="Link Label (e.g. GitHub)"
                            value={newLinkLabel}
                            onChange={(e) => setNewLinkLabel(e.target.value)}
                          />
                          <input
                            placeholder="Link URL (e.g. https://...)"
                            value={newLinkUrl}
                            onChange={(e) => setNewLinkUrl(e.target.value)}
                          />
                          <button
                            className="milestone-add-btn"
                            style={{ alignSelf: 'flex-start' }}
                            onClick={() => {
                              if (!newLinkLabel.trim() || !newLinkUrl.trim()) return;
                              const nextLinks = [...links, { label: newLinkLabel.trim(), url: newLinkUrl.trim() }];
                              updateProject(project.id, { links: nextLinks });
                              setNewLinkLabel('');
                              setNewLinkUrl('');
                            }}
                          >
                            + Add Link
                          </button>
                        </div>
                      ) : (
                        <span className="drawer-limit-text">Max 5 links reached.</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Preview Images */}
                <div className="drawer-section">
                  <h4 className="drawer-section-title">
                    Preview Images {project.preview_images?.length > 0 && `(${project.preview_images.length}/9)`}
                  </h4>

                  {isEditing && (
                    <div className="drawer-edit-list">
                      {project.preview_images?.map((url, i) => (
                        <div key={i} className="drawer-edit-item">
                          <span className="drawer-edit-item-text">{url.startsWith('/uploads/') ? `📁 ${url}` : url}</span>
                          <button
                            className="milestone-delete-btn"
                            onClick={() => {
                              const nextImages = project.preview_images.filter((_, idx) => idx !== i);
                              updateProject(project.id, { preview_images: nextImages });
                              if (activeImgIndex >= nextImages.length && nextImages.length > 0) {
                                setActiveImgIndex(nextImages.length - 1);
                              } else {
                                setActiveImgIndex(0);
                              }
                            }}
                            title="Delete image"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}

                      {(!project.preview_images || project.preview_images.length < 9) ? (
                        <div className="drawer-image-add-section">
                          {/* Upload file */}
                          <div className="drawer-image-upload-row">
                            <button
                              className="drawer-upload-btn"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploading}
                              title="Upload JPEG image (max 1 MB)"
                            >
                              <Upload size={14} />
                              {uploading ? 'Uploading…' : 'Upload JPEG (≤1MB)'}
                            </button>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/jpeg"
                              style={{ display: 'none' }}
                              onChange={handleFileUpload}
                            />
                          </div>
                          {uploadError && (
                            <span className="drawer-upload-error">{uploadError}</span>
                          )}
                          {/* Or by URL */}
                          <div className="drawer-add-row-form" style={{ marginTop: 8 }}>
                            <input
                              placeholder="…or paste Image URL"
                              value={newImageUrl}
                              onChange={(e) => setNewImageUrl(e.target.value)}
                            />
                            <button
                              className="milestone-add-btn"
                              style={{ alignSelf: 'flex-start' }}
                              onClick={() => {
                                if (!newImageUrl.trim()) return;
                                const nextImages = [...(project.preview_images || []), newImageUrl.trim()];
                                updateProject(project.id, { preview_images: nextImages });
                                setNewImageUrl('');
                              }}
                            >
                              + Add URL
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="drawer-limit-text">Max 9 images reached.</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Danger zone */}
                {isEditing && (
                  <div className="drawer-danger animate-fade-in">
                    <button className="drawer-delete-btn" onClick={handleDeleteProject}>
                      <Trash2 size={14} /> Delete Project
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: Tasks & Milestones */}
              <div className="drawer-right-col">
                {/* Tasks */}
                <div className="drawer-section">
                  <div className="drawer-section-header">
                    <h4 className="drawer-section-title">Tasks</h4>
                    {isEditing && (
                      <button className="milestone-add-btn" onClick={() => setAddingTask(!addingTask)}>
                        <Plus size={14} /> Add
                      </button>
                    )}
                  </div>
                  {isEditing && addingTask && (
                    <div className="drawer-add-task-form">
                      <input
                        placeholder="Task title"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      />
                      <div className="drawer-add-task-dates">
                        <input
                          type="date"
                          value={newTask.start_date}
                          onChange={(e) => setNewTask({ ...newTask, start_date: e.target.value })}
                        />
                        <input
                          type="date"
                          value={newTask.end_date}
                          onChange={(e) => setNewTask({ ...newTask, end_date: e.target.value })}
                        />
                      </div>
                      <button className="drawer-add-task-submit" onClick={handleAddTask}>Create Task</button>
                    </div>
                  )}
                  <div className="drawer-task-list">
                    {tasks.map((task) => {
                      const statusCfg = TASK_STATUS_ICON[task.status] || TASK_STATUS_ICON.pending;
                      const Icon = statusCfg.icon;
                      return (
                        <div key={task.id} className="drawer-task-item">
                          <button
                            className="drawer-task-status-btn"
                            onClick={() => handleTaskStatusToggle(task)}
                            style={{ cursor: isEditing ? 'pointer' : 'default' }}
                            title={isEditing ? 'Toggle status' : undefined}
                            disabled={!isEditing}
                          >
                            <Icon size={16} color={statusCfg.color} />
                          </button>
                          <div className="drawer-task-info">
                            <span className={`drawer-task-title ${task.status === 'completed' ? 'completed' : ''}`}>
                              {task.title}
                            </span>
                            <span className="drawer-task-dates">
                              {task.start_date || '?'} → {task.end_date || '?'}
                            </span>
                          </div>
                          {isEditing && (
                            <button
                              className="milestone-delete-btn"
                              onClick={() => deleteTask(task.id, project.id)}
                              title="Delete task"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Milestone Timeline */}
                <div className="drawer-section">
                  <MilestoneTimeline project={project} isEditing={isEditing} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
