import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import { useProjects } from '../context/ProjectContext.jsx';
import {
  X, User, ShieldAlert, UserPlus, Users,
  UserX, UserCheck, LogIn, Eye, EyeOff, KeyRound, Save,
  ArchiveIcon, UploadCloud
} from 'lucide-react';

// ───────────── Profile Tab (all users) ─────────────
function ProfileTab({ currentUser, updateMe, fetchProjects, onClose }) {
  const [spaceName, setSpaceName] = useState(currentUser?.space_name || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Import state
  const importInputRef = useRef(null);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(null); // { projects, tasks, milestones, images }

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const payload = {};
    if (spaceName.trim() && spaceName.trim() !== currentUser?.space_name) {
      payload.space_name = spaceName.trim();
    }
    if (newPassword.trim()) {
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      payload.password = newPassword.trim();
    }
    if (Object.keys(payload).length === 0) {
      setError('No changes to save.');
      return;
    }

    setSaving(true);
    try {
      await updateMe(payload);
      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExportError(null);
    setExporting(true);
    try {
      await api.exportSpace();
    } catch (err) {
      setExportError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleImportFileChange = (e) => {
    setImportFile(e.target.files[0] || null);
    setImportError(null);
    setImportSuccess(null);
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImportError(null);
    setImportSuccess(null);
    setImporting(true);
    try {
      const result = await api.importSpace(importFile);
      setImportSuccess(result.imported);
      setImportFile(null);
      if (importInputRef.current) importInputRef.current.value = '';
      await fetchProjects();
      setTimeout(() => setImportSuccess(null), 6000);
    } catch (err) {
      setImportError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <form className="settings-profile-form" onSubmit={handleSave}>
      {error && <div className="admin-error-box">{error}</div>}
      {success && <div className="admin-success-box">✓ Profile updated successfully!</div>}

      <div className="form-field">
        <label>Username (read-only)</label>
        <input type="text" value={currentUser?.username || ''} disabled className="settings-disabled-input" />
      </div>

      <div className="form-field">
        <label>Space Name</label>
        <input
          type="text"
          placeholder="Your display name"
          value={spaceName}
          onChange={(e) => setSpaceName(e.target.value)}
          disabled={saving}
        />
      </div>

      <div className="settings-divider"><span>Change Password (optional)</span></div>

      <div className="form-field">
        <label>New Password</label>
        <div className="password-input-wrap">
          <input
            type={showPw ? 'text' : 'password'}
            placeholder="Leave blank to keep current"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={saving}
            autoComplete="new-password"
          />
          <button type="button" className="password-toggle-btn" onClick={() => setShowPw((v) => !v)} tabIndex={-1}>
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {newPassword && (
        <div className="form-field">
          <label>Confirm New Password</label>
          <div className="password-input-wrap">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={saving}
              autoComplete="new-password"
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="submit" className="admin-submit-btn" disabled={saving}>
          <Save size={15} />
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* ── Space Backup ── */}
      <div className="settings-divider"><span>Space Backup</span></div>

      <div className="space-backup-section">
        {/* Export */}
        <div className="space-backup-row">
          <div className="space-backup-row-info">
            <ArchiveIcon size={15} className="space-backup-icon export-icon" />
            <div>
              <div className="space-backup-row-title">Export Space</div>
              <div className="space-backup-row-desc">Download all projects, tasks, milestones &amp; images as a .zip file.</div>
            </div>
          </div>
          <button
            type="button"
            className="space-backup-btn export-btn"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <><span className="space-backup-spinner" />Exporting…</>
            ) : (
              <><ArchiveIcon size={13} />Export Space</>
            )}
          </button>
        </div>
        {exportError && <div className="space-backup-error">{exportError}</div>}

        {/* Import */}
        <div className="space-backup-row" style={{ marginTop: 10 }}>
          <div className="space-backup-row-info">
            <UploadCloud size={15} className="space-backup-icon import-icon" />
            <div>
              <div className="space-backup-row-title">Import Space</div>
              <div className="space-backup-row-desc">Restore from a .zip backup. Existing projects are kept — new ones are added.</div>
            </div>
          </div>
          <div className="space-backup-import-controls">
            <label className="space-backup-file-label" htmlFor="import-zip-input">
              {importFile ? (
                <span className="space-backup-file-chip">📦 {importFile.name}</span>
              ) : (
                <span className="space-backup-file-chip empty">Choose .zip…</span>
              )}
            </label>
            <input
              id="import-zip-input"
              ref={importInputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              style={{ display: 'none' }}
              onChange={handleImportFileChange}
            />
            <button
              type="button"
              className="space-backup-btn import-btn"
              onClick={handleImport}
              disabled={!importFile || importing}
            >
              {importing ? (
                <><span className="space-backup-spinner" />Importing…</>
              ) : (
                <><UploadCloud size={13} />Import &amp; Restore</>
              )}
            </button>
          </div>
        </div>
        {importError && <div className="space-backup-error">{importError}</div>}
        {importSuccess && (
          <div className="space-backup-success">
            ✓ Imported {importSuccess.projects} project{importSuccess.projects !== 1 ? 's' : ''},
            {' '}{importSuccess.tasks} task{importSuccess.tasks !== 1 ? 's' : ''},
            {' '}{importSuccess.milestones} milestone{importSuccess.milestones !== 1 ? 's' : ''},
            {' '}{importSuccess.images} image{importSuccess.images !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </form>
  );
}

// ───────────── Admin: Manage Users Tab ─────────────
function ManageUsersTab({ currentUser, loginAs, onClose }) {
  const [users, setUsers] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchUsers = async () => {
    setListLoading(true);
    try {
      const list = await api.getUsers();
      setUsers(list);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDeactivate = async (userId) => {
    setActionLoading(userId);
    try { await api.deactivateUser(userId); setConfirmDelete(null); fetchUsers(); }
    catch (err) { console.error(err); }
    finally { setActionLoading(null); }
  };

  const handleActivate = async (userId) => {
    setActionLoading(userId);
    try { await api.activateUser(userId); fetchUsers(); }
    catch (err) { console.error(err); }
    finally { setActionLoading(null); }
  };

  const handleLoginAs = async (userId) => {
    setActionLoading(userId);
    try { await loginAs(userId); onClose(); }
    catch (err) { console.error(err); }
    finally { setActionLoading(null); }
  };

  if (listLoading) return (
    <div className="admin-list-loading">
      <div className="loading-spinner" style={{ width: 20, height: 20 }} />
      <span>Loading users…</span>
    </div>
  );

  return (
    <div className="admin-tab-content">
      <div className="admin-user-list-header">
        <span className="admin-list-count">{users.length} space{users.length !== 1 ? 's' : ''}</span>
        <button className="admin-refresh-btn" onClick={fetchUsers} title="Refresh">↺</button>
      </div>
      <div className="admin-users-list-full">
        {users.map((u) => {
          const isMe = u.id === currentUser?.id;
          const isActioning = actionLoading === u.id;
          const isPendingDelete = confirmDelete === u.id;
          const isInactive = !u.is_active;
          return (
            <div key={u.id} className={`admin-user-card ${isInactive ? 'inactive' : ''}`}>
              <div className="admin-user-avatar">
                <span>{u.space_name.charAt(0).toUpperCase()}</span>
                {u.role === 'admin' && <span className="admin-user-crown" title="Admin">★</span>}
              </div>
              <div className="admin-user-card-info">
                <div className="admin-user-card-name">
                  {u.space_name}
                  {isMe && <span className="admin-user-me-badge">You</span>}
                  {isInactive && <span className="admin-user-inactive-badge">Inactive</span>}
                </div>
                <div className="admin-user-card-sub">@{u.username} · {u.role === 'admin' ? 'Admin' : 'User'}</div>
              </div>
              <div className="admin-user-card-actions">
                {!isMe && !isInactive && (
                  <>
                    <button className="admin-action-btn login-as" onClick={() => handleLoginAs(u.id)} disabled={isActioning} title={`Login as ${u.space_name}`}>
                      <LogIn size={13} />
                      {isActioning ? '…' : 'Login As'}
                    </button>
                    {isPendingDelete ? (
                      <div className="admin-confirm-row">
                        <span className="admin-confirm-msg">Deactivate?</span>
                        <button className="admin-action-btn danger" onClick={() => handleDeactivate(u.id)} disabled={isActioning}>{isActioning ? '…' : 'Yes'}</button>
                        <button className="admin-action-btn cancel" onClick={() => setConfirmDelete(null)}>No</button>
                      </div>
                    ) : (
                      <button className="admin-action-btn deactivate" onClick={() => setConfirmDelete(u.id)} disabled={isActioning} title="Deactivate user">
                        <UserX size={13} />Deactivate
                      </button>
                    )}
                  </>
                )}
                {!isMe && isInactive && (
                  <button className="admin-action-btn activate" onClick={() => handleActivate(u.id)} disabled={isActioning}>
                    <UserCheck size={13} />{isActioning ? '…' : 'Restore'}
                  </button>
                )}
                {isMe && <span className="admin-self-note">Current session</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────── Admin: Add User Tab ─────────────
function AddUserTab() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !spaceName.trim()) return;
    setLoading(true); setError(null); setSuccess(false);
    try {
      await api.createUser({ username: username.trim(), password: password.trim(), space_name: spaceName.trim(), role });
      setUsername(''); setPassword(''); setSpaceName(''); setRole('user');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-tab-content">
      <form onSubmit={handleCreate} className="admin-create-form">
        {error && <div className="admin-error-box">{error}</div>}
        {success && <div className="admin-success-box">✓ User space created successfully!</div>}
        <div className="admin-create-grid">
          <div className="form-field">
            <label>Username</label>
            <input type="text" required placeholder="e.g. alice" value={username} onChange={(e) => setUsername(e.target.value)} disabled={loading} autoComplete="off" />
          </div>
          <div className="form-field">
            <label>Password</label>
            <div className="password-input-wrap">
              <input type={showPassword ? 'text' : 'password'} required placeholder="Set a password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} autoComplete="new-password" />
              <button type="button" className="password-toggle-btn" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}>
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label>Space Name</label>
            <input type="text" required placeholder="e.g. Alice's workspace" value={spaceName} onChange={(e) => setSpaceName(e.target.value)} disabled={loading} />
          </div>
          <div className="form-field">
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} disabled={loading}>
              <option value="user">User — Standard Workspace</option>
              <option value="admin">Admin — System Manager</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="admin-submit-btn" disabled={loading} style={{ width: '100%' }}>
              <UserPlus size={15} />
              {loading ? 'Creating…' : 'Create User & Space'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ───────────── Main SettingsModal ─────────────
export default function SettingsModal({ isOpen, onClose }) {
  const { currentUser, loginAs, updateMe, fetchProjects } = useProjects();
  const isAdmin = currentUser?.role === 'admin';

  const TABS = [
    { id: 'profile', label: 'My Profile', icon: User },
    ...(isAdmin ? [
      { id: 'users', label: 'Manage Users', icon: Users },
      { id: 'add', label: 'Add User', icon: UserPlus },
    ] : []),
  ];

  const [tab, setTab] = useState('profile');

  useEffect(() => {
    if (isOpen) setTab('profile');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="admin-modal-card glass-panel animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-title-group">
            {isAdmin ? <ShieldAlert className="admin-title-icon" size={20} /> : <User className="admin-title-icon" size={20} />}
            <h3>Settings</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`admin-tab-btn ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === 'profile' && (
          <div className="admin-tab-content">
            <ProfileTab currentUser={currentUser} updateMe={updateMe} fetchProjects={fetchProjects} onClose={onClose} />
          </div>
        )}
        {tab === 'users' && isAdmin && (
          <ManageUsersTab currentUser={currentUser} loginAs={loginAs} onClose={onClose} />
        )}
        {tab === 'add' && isAdmin && <AddUserTab />}
      </div>
    </div>
  );
}
