import React, { useState } from 'react';
import { Activity, Sun, Moon, Plus, Share2, LogOut, UserCircle, ChevronRight } from 'lucide-react';
import { useProjects } from '../context/ProjectContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import ViewToggle from './ViewToggle.jsx';
import SettingsModal from './SettingsModal.jsx';

export default function Layout({ children, view, onToggleView, onAddProject }) {
  const { projects, loading, setSelectedProject, currentUser, isSharedView, sharedSpaceName, logout } = useProjects();
  const { theme, toggleTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
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
          <div className="layout-logo-wrapper">
            <div className="logo-icon-milestone">
              <div className="logo-signpost-post" />
              <div className="logo-signpost-arm right">
                <span>ProJ</span>
              </div>
              <div className="logo-signpost-arm left">
                <span>View</span>
              </div>
              <div className="logo-signpost-foundation" />
            </div>
          </div>
          <h1 className="layout-title">
            <span className="layout-title-proj">ProJ</span>
            <span className="layout-title-show">View</span>
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
              {/* User icon — visible to all logged-in users, opens Settings dialog */}
              <button
                className="admin-btn"
                onClick={() => setSettingsOpen(true)}
                title={`Settings (${currentUser?.space_name})`}
              >
                <UserCircle size={18} />
              </button>
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
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

