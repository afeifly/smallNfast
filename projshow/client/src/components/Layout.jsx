import React, { useState } from 'react';
import { Activity, Sun, Moon, Plus, Share2, LogOut, Shield, ChevronRight } from 'lucide-react';
import { useProjects } from '../context/ProjectContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import ViewToggle from './ViewToggle.jsx';
import AdminModal from './AdminModal.jsx';

function MilestoneLogo({ size = 24, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--cyan)" />
          <stop offset="100%" stopColor="var(--indigo)" />
        </linearGradient>
      </defs>
      {/* Base stand */}
      <path d="M6 21H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      {/* Post */}
      <path d="M12 21V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      {/* Milestone diamond at top */}
      <path d="M12 4L18 7L12 10L6 7L12 4Z" fill="url(#logoGrad)" />
      {/* Signboard pointing right */}
      <path d="M12 11L19 13.5L12 16V11Z" fill="url(#logoGrad)" opacity="0.95" />
    </svg>
  );
}

export default function Layout({ children, view, onToggleView, onAddProject }) {
  const { projects, loading, setSelectedProject, currentUser, isSharedView, sharedSpaceName, logout } = useProjects();
  const { theme, toggleTheme } = useTheme();
  const [adminOpen, setAdminOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const activeCount = projects.filter((p) => p.status === 'active').length;
  const totalTasks = projects.reduce((sum, p) => sum + (p.tasks?.length || 0), 0);
  const avgProgress = projects.length > 0
    ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
    : 0;

  const spaceName = isSharedView
    ? sharedSpaceName
    : currentUser?.space_name || '';

  const handleShare = async () => {
    if (!currentUser) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${currentUser.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      prompt('Copy this public link:', shareUrl);
    }
  };

  return (
    <div className="layout">
      <header className="layout-header glass-panel">
        <div className="layout-brand">
          <MilestoneLogo size={24} className="layout-logo" />
          <h1 className="layout-title">
            <span className="layout-title-proj">Proj</span>
            <span className="layout-title-show">Show</span>
          </h1>
          {spaceName && (
            <div className="layout-space-badge">
              <ChevronRight size={13} className="layout-space-sep" />
              <span className="layout-space-name">{spaceName}</span>
              {isSharedView && <span className="layout-shared-badge">Shared View</span>}
            </div>
          )}
        </div>
        <div className="layout-stats">
          <div className="stat-item">
            <span className="stat-value">{projects.length}</span>
            <span className="stat-label">Projects</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" style={{ color: 'var(--cyan)' }}>{activeCount}</span>
            <span className="stat-label">Active</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{totalTasks}</span>
            <span className="stat-label">Tasks</span>
          </div>
          <div className="stat-item">
            <Activity size={14} style={{ color: 'var(--emerald)' }} />
            <span className="stat-value">{avgProgress}%</span>
            <span className="stat-label">Avg</span>
          </div>
        </div>
        <div className="layout-actions">
          {!isSharedView && (
            <>
              <button className="add-project-btn" onClick={onAddProject} title="Add Project">
                <Plus size={16} />
                <span>Add Project</span>
              </button>
              <button
                className={`share-btn ${shareCopied ? 'copied' : ''}`}
                onClick={handleShare}
                title="Copy public share link"
              >
                <Share2 size={15} />
                <span>{shareCopied ? 'Copied!' : 'Share'}</span>
              </button>
              {currentUser?.role === 'admin' && (
                <button className="admin-btn" onClick={() => setAdminOpen(true)} title="Admin Settings">
                  <Shield size={15} />
                </button>
              )}
              <button className="logout-btn" onClick={logout} title="Sign out">
                <LogOut size={15} />
              </button>
            </>
          )}
          <ViewToggle view={view} onToggle={onToggleView} />
          <button className="theme-btn" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>
      <main className="layout-main">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading projects…</p>
          </div>
        ) : (
          children
        )}
      </main>
      <AdminModal isOpen={adminOpen} onClose={() => setAdminOpen(false)} />
    </div>
  );
}
