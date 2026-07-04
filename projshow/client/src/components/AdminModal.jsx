import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useProjects } from '../context/ProjectContext.jsx';
import {
  X, UserPlus, ShieldAlert, FolderHeart, LogIn,
  UserX, UserCheck, Eye, EyeOff, ChevronRight, Users, Plus
} from 'lucide-react';

const TABS = [
  { id: 'users', label: 'Manage Users', icon: Users },
  { id: 'add', label: 'Add User', icon: UserPlus },
];

export default function AdminModal({ isOpen, onClose }) {
  const { currentUser, loginAs } = useProjects();
  const [tab, setTab] = useState('users');

  // Users list state
  const [users, setUsers] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // id of user being actioned
  const [confirmDelete, setConfirmDelete] = useState(null); // id of user pending confirm

  // Create user form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [role, setRole] = useState('user');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(false);

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

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setCreateError(null);
      setCreateSuccess(false);
      setConfirmDelete(null);
    }
  }, [isOpen]);

  // --- Create user ---
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !spaceName.trim()) return;
    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(false);
    try {
      await api.createUser({
        username: username.trim(),
        password: password.trim(),
        space_name: spaceName.trim(),
        role,
      });
      setUsername('');
      setPassword('');
      setSpaceName('');
      setRole('user');
      setCreateSuccess(true);
      fetchUsers();
      setTimeout(() => setCreateSuccess(false), 3000);
    } catch (err) {
      setCreateError(err.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  // --- Soft delete ---
  const handleDeactivate = async (userId) => {
    setActionLoading(userId);
    try {
      await api.deactivateUser(userId);
      setConfirmDelete(null);
      fetchUsers();
    } catch (err) {
      console.error('Deactivate failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // --- Re-activate ---
  const handleActivate = async (userId) => {
    setActionLoading(userId);
    try {
      await api.activateUser(userId);
      fetchUsers();
    } catch (err) {
      console.error('Activate failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // --- Login As ---
  const handleLoginAs = async (userId) => {
    setActionLoading(userId);
    try {
      await loginAs(userId);
      onClose();
    } catch (err) {
      console.error('Impersonate failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="admin-modal-card glass-panel animate-scale-in">
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-title-group">
            <ShieldAlert className="admin-title-icon" size={20} />
            <h3>Admin Settings</h3>
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

        {/* Tab: Manage Users */}
        {tab === 'users' && (
          <div className="admin-tab-content">
            <div className="admin-user-list-header">
              <span className="admin-list-count">{users.length} space{users.length !== 1 ? 's' : ''}</span>
            </div>

            {listLoading ? (
              <div className="admin-list-loading">
                <div className="loading-spinner" style={{ width: 20, height: 20 }} />
                <span>Loading users…</span>
              </div>
            ) : (
              <div className="admin-users-list-full">
                {users.map((u) => {
                  const isMe = u.id === currentUser?.id;
                  const isActioning = actionLoading === u.id;
                  const isPendingDelete = confirmDelete === u.id;
                  const isInactive = !u.is_active;

                  return (
                    <div
                      key={u.id}
                      className={`admin-user-card ${isInactive ? 'inactive' : ''}`}
                    >
                      {/* Avatar area */}
                      <div className="admin-user-avatar">
                        <span>{u.space_name.charAt(0).toUpperCase()}</span>
                        {u.role === 'admin' && (
                          <span className="admin-user-crown" title="Admin">★</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="admin-user-card-info">
                        <div className="admin-user-card-name">
                          {u.space_name}
                          {isMe && <span className="admin-user-me-badge">You</span>}
                          {isInactive && <span className="admin-user-inactive-badge">Inactive</span>}
                        </div>
                        <div className="admin-user-card-sub">
                          @{u.username} · {u.role === 'admin' ? 'Admin' : 'User'}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="admin-user-card-actions">
                        {!isMe && !isInactive && (
                          <>
                            {/* Login As */}
                            <button
                              className="admin-action-btn login-as"
                              onClick={() => handleLoginAs(u.id)}
                              disabled={isActioning}
                              title={`Login as ${u.space_name}`}
                            >
                              <LogIn size={13} />
                              {isActioning ? '…' : 'Login As'}
                            </button>

                            {/* Soft Delete */}
                            {isPendingDelete ? (
                              <div className="admin-confirm-row">
                                <span className="admin-confirm-msg">Deactivate?</span>
                                <button
                                  className="admin-action-btn danger"
                                  onClick={() => handleDeactivate(u.id)}
                                  disabled={isActioning}
                                >
                                  {isActioning ? '…' : 'Yes'}
                                </button>
                                <button
                                  className="admin-action-btn cancel"
                                  onClick={() => setConfirmDelete(null)}
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                className="admin-action-btn deactivate"
                                onClick={() => setConfirmDelete(u.id)}
                                disabled={isActioning}
                                title="Deactivate (hide) user"
                              >
                                <UserX size={13} />
                                Deactivate
                              </button>
                            )}
                          </>
                        )}

                        {/* Re-activate */}
                        {!isMe && isInactive && (
                          <button
                            className="admin-action-btn activate"
                            onClick={() => handleActivate(u.id)}
                            disabled={isActioning}
                            title="Re-activate user"
                          >
                            <UserCheck size={13} />
                            {isActioning ? '…' : 'Restore'}
                          </button>
                        )}

                        {isMe && (
                          <span className="admin-self-note">Current session</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Add User */}
        {tab === 'add' && (
          <div className="admin-tab-content">
            <form onSubmit={handleCreate} className="admin-create-form">
              {createError && <div className="admin-error-box">{createError}</div>}
              {createSuccess && (
                <div className="admin-success-box">
                  ✓ User space created successfully!
                </div>
              )}

              <div className="admin-create-grid">
                <div className="form-field">
                  <label>Username</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. alice"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={createLoading}
                    autoComplete="off"
                  />
                </div>

                <div className="form-field">
                  <label>Password</label>
                  <div className="password-input-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Set a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={createLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Space Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alice's workspace"
                    value={spaceName}
                    onChange={(e) => setSpaceName(e.target.value)}
                    disabled={createLoading}
                  />
                </div>

                <div className="form-field">
                  <label>Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={createLoading}
                  >
                    <option value="user">User — Standard Workspace</option>
                    <option value="admin">Admin — System Manager</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="submit" className="admin-submit-btn" disabled={createLoading} style={{ width: '100%' }}>
                    <UserPlus size={15} />
                    {createLoading ? 'Creating…' : 'Create User & Space'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
