import React, { useState, useEffect, useRef } from 'react';
import './ScapeManagerModal.css';
import {
  getAllScapes,
  getActiveScapeId,
  setActiveScapeId,
  createNewScape,
  duplicateScape,
  deleteScape,
  importScapeFromJson
} from './engine/scapeStorage';
import { getLocations } from './engine/sensorManagerStorage';

export default function ScapeManagerModal({
  isOpen,
  onClose,
  onSelectActiveScape,
  onEditScape,
  currentScapeId
}) {
  const [scapes, setScapes] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [usedScapeIds, setUsedScapeIds] = useState(() => new Set());
  const [newTitle, setNewTitle] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [pendingDeleteScape, setPendingDeleteScape] = useState(null);
  const fileInputRef = useRef(null);

  const refreshList = () => {
    const list = getAllScapes();
    const curId = currentScapeId !== undefined ? currentScapeId : getActiveScapeId();
    const locs = getLocations();
    setScapes(list);
    setActiveId(curId || '');
    setUsedScapeIds(new Set(locs.map(l => l?.scapeId).filter(Boolean)));
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
      setShowCreateForm(false);
      setNewTitle('');
    }
  }, [isOpen, currentScapeId]);

  if (!isOpen) return null;

  const handleSetActive = (id) => {
    setActiveScapeId(id);
    setActiveId(id);
    const target = scapes.find(s => s.id === id);
    if (onSelectActiveScape && target) {
      onSelectActiveScape(target);
    }
    onClose();
  };

  const handleEdit = (id) => {
    const allLatest = getAllScapes();
    const target = allLatest.find(s => s.id === id) || scapes.find(s => s.id === id);
    if (onEditScape && target) {
      onEditScape(target);
    }
    onClose();
  };

  const handleCreateNew = (e) => {
    e.preventDefault();
    const title = newTitle.trim() || 'New Plant Scape';
    createNewScape(title, '', { setActive: false });
    refreshList();
    setNewTitle('');
    setShowCreateForm(false);
  };

  const handleDuplicate = (id, e) => {
    e.stopPropagation();
    duplicateScape(id);
    refreshList();
  };

  const handleDeleteClick = (scape, e) => {
    e.stopPropagation();
    const isActive = Boolean(activeId && scape.id === activeId);
    if (isActive || usedScapeIds.has(scape.id)) return;
    setPendingDeleteScape(scape);
  };

  const handleConfirmDelete = () => {
    if (!pendingDeleteScape) return;
    const { id, title } = pendingDeleteScape;
    deleteScape(id);
    const updatedList = getAllScapes();
    const newActive = getActiveScapeId();
    setScapes(updatedList);
    setActiveId(newActive);
    const target = updatedList.find(s => s.id === newActive) || null;
    if (onSelectActiveScape) {
      onSelectActiveScape(target);
    }
    setPendingDeleteScape(null);
    if (typeof window !== 'undefined' && window.showAppNotification) {
      window.showAppNotification('Scape Deleted', `"${title || 'Plant Scape'}" was removed.`, 'info');
    }
  };

  const handleExportJson = (scape, e) => {
    e.stopPropagation();
    const blob = new Blob([JSON.stringify(scape, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(scape.title || 'scape').toLowerCase().replace(/\s+/g, '-')}-topology.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        const imported = importScapeFromJson(json);
        refreshList();
        if (typeof window !== 'undefined' && window.showAppNotification) {
          window.showAppNotification('Scape Imported', `"${imported.title}" loaded successfully.`, 'success');
        }
        if (onSelectActiveScape) {
          onSelectActiveScape(imported);
        }
        onClose();
      } catch (err) {
        console.error('Import error:', err);
        if (typeof window !== 'undefined' && window.showAppNotification) {
          window.showAppNotification('Import Failed', 'Selected file is not a valid ProcessScape JSON topology.', 'error');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="ps-mgr-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="mgrModalTitle">
      <div className="ps-mgr-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="ps-mgr-header">
          <div className="ps-mgr-title-group">
            <span className="ps-mgr-badge">Plant SCADA</span>
            <h2 id="mgrModalTitle" className="ps-mgr-title">Scape Manager</h2>
            <p className="ps-mgr-subtitle">Manage, switch, or modify plant topology environments</p>
          </div>
          <div className="ps-mgr-header-actions">
            <button
              type="button"
              className="ps-mgr-icon-btn ps-mgr-btn-outline"
              onClick={() => fileInputRef.current?.click()}
              title="Import Scape"
              aria-label="Import Scape"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Import Scape</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleImportFileChange}
            />
            <button
              type="button"
              className="ps-mgr-btn-primary"
              onClick={() => setShowCreateForm(v => !v)}
            >
              {showCreateForm ? 'Cancel' : '+ New Scape'}
            </button>
            <button
              type="button"
              className="ps-mgr-close-btn"
              onClick={onClose}
              aria-label="Close Scape Manager"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Create Scape Inline Form */}
        {showCreateForm && (
          <form className="ps-mgr-create-form" onSubmit={handleCreateNew}>
            <input
              type="text"
              className="ps-mgr-input"
              placeholder="e.g. Workshop 2 Compressor Station..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <button type="submit" className="ps-mgr-btn-primary">
              Create
            </button>
          </form>
        )}

        {/* Scape Cards Grid or Empty State */}
        <div className="ps-mgr-list">
          {scapes.length === 0 ? (
            <div className="ps-mgr-empty-state">
              <div className="ps-mgr-empty-icon">🏭</div>
              <h3 className="ps-mgr-empty-title">No Plant Scapes</h3>
              <p className="ps-mgr-empty-desc">
                All plant scapes have been deleted. Click "+ New Scape" above to design a new plant layout.
              </p>
              <button
                type="button"
                className="ps-mgr-btn-primary"
                onClick={() => setShowCreateForm(true)}
              >
                + Create New Scape
              </button>
            </div>
          ) : (
            scapes.map((scape) => {
              const isActive = Boolean(activeId && scape.id === activeId);
              const isInUse = isActive || usedScapeIds.has(scape.id);
              const elemCount = scape.elements?.length || 0;
              const pipeCount = scape.pipes?.length || 0;
              const dateStr = scape.updatedAt
                ? new Date(scape.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'Built-in';

              return (
                <div
                  key={scape.id}
                  className="ps-mgr-card"
                >
                  <div className="ps-mgr-card-top">
                    <div className="ps-mgr-card-title-row">
                      <h3 className="ps-mgr-card-title">{scape.title || 'Untitled Scape'}</h3>
                      {isActive ? (
                        <span className="ps-mgr-active-badge" title="Used by current location">Current</span>
                      ) : (
                        <button
                          type="button"
                          className="ps-mgr-card-switch-btn"
                          onClick={(e) => { e.stopPropagation(); handleSetActive(scape.id); }}
                        >
                          Select
                        </button>
                      )}
                    </div>
                    {scape.description && (
                      <p className="ps-mgr-card-desc">{scape.description}</p>
                    )}
                    <div className="ps-mgr-card-meta">
                      <span>{elemCount} equipment/sensors</span>
                      <span>·</span>
                      <span>{pipeCount} pipe segments</span>
                      <span>·</span>
                      <span>{dateStr}</span>
                    </div>
                  </div>

                  <div className="ps-mgr-card-actions">
                    <button
                      type="button"
                      className={`ps-mgr-action-btn btn-edit ${isActive ? 'is-current-active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleEdit(scape.id); }}
                      title="Modify & edit this scape layout"
                    >
                      ✏️ Modify Scape
                    </button>
                    <button
                      type="button"
                      className="ps-mgr-action-icon-btn"
                      onClick={(e) => handleDuplicate(scape.id, e)}
                      title="Duplicate Scape"
                      aria-label="Duplicate"
                    >
                      📋
                    </button>
                    <button
                      type="button"
                      className="ps-mgr-action-icon-btn"
                      onClick={(e) => handleExportJson(scape, e)}
                      title="Export Scape"
                      aria-label="Export Scape"
                    >
                      ⬇️
                    </button>
                    <button
                      type="button"
                      className="ps-mgr-action-icon-btn btn-delete"
                      onClick={(e) => handleDeleteClick(scape, e)}
                      disabled={isInUse}
                      title={isInUse ? 'In-use scape cannot be deleted' : 'Delete Scape'}
                      aria-label={isInUse ? 'In-use scape cannot be deleted' : 'Delete'}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete Confirmation In-App Dialog */}
      {pendingDeleteScape && (
        <div
          className="ps-mgr-confirm-backdrop"
          onClick={() => setPendingDeleteScape(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="ps-mgr-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ps-mgr-confirm-header">
              <div className="ps-mgr-confirm-icon-danger">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="ps-mgr-confirm-title">Delete Plant Scape</h3>
                <p className="ps-mgr-confirm-subtitle">
                  Are you sure you want to delete <strong>"{pendingDeleteScape.title || 'this scape'}"</strong>?
                  {scapes.length <= 1 ? ' This is the only remaining scape.' : ''}
                </p>
              </div>
            </div>
            <div className="ps-mgr-confirm-actions">
              <button
                type="button"
                className="ps-mgr-action-btn"
                onClick={() => setPendingDeleteScape(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ps-mgr-btn-danger"
                onClick={handleConfirmDelete}
              >
                Delete Scape
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

