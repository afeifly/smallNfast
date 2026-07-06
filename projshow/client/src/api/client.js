const BASE = '/api';

async function request(url, options = {}) {
  const token = localStorage.getItem('projshow_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${url}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Download a response as a file without parsing JSON
async function downloadBlob(url, defaultFilename) {
  const token = localStorage.getItem('projshow_token');
  const res = await fetch(`${BASE}${url}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  const disposition = res.headers.get('Content-Disposition') || '';
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : defaultFilename;
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getSpace: (userId) => request(`/auth/space/${userId}`),
  getUsers: () => request('/auth/users'),
  createUser: (data) => request('/auth/users', { method: 'POST', body: JSON.stringify(data) }),
  deactivateUser: (id) => request(`/auth/users/${id}/deactivate`, { method: 'PATCH' }),
  activateUser: (id) => request(`/auth/users/${id}/activate`, { method: 'PATCH' }),
  impersonateUser: (id) => request(`/auth/impersonate/${id}`, { method: 'POST' }),
  updateMe: (data) => request('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),

  // Space backup
  exportSpace: () => downloadBlob('/archive/export', 'projshow-space.zip'),
  importSpace: async (file) => {
    const token = localStorage.getItem('projshow_token');
    const formData = new FormData();
    formData.append('archive', file);
    const res = await fetch(`${BASE}/archive/import`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Import failed: ${res.status}`);
    }
    return res.json();
  },

  // Image upload (multipart/form-data — no JSON header)
  uploadImage: async (file) => {
    const token = localStorage.getItem('projshow_token');
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${BASE}/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Upload failed: ${res.status}`);
    }
    return res.json();
  },

  // Projects
  getProjects: (status) => request(status ? `/projects?status=${status}` : '/projects'),
  getProject: (id) => request(`/projects/${id}`),
  createProject: (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
  resetAll: () => request('/projects/reset', { method: 'POST' }),
  getHistoryList: () => request('/projects/history'),
  getHistorySnapshot: (id) => request(`/projects/history/${id}`),

  // Public Projects (unauthenticated)
  getPublicProjects: (userId) => request(`/projects/public/${userId}`),
  getPublicTasks: (projectId) => request(`/public/projects/${projectId}/tasks`),
  getPublicMilestones: (projectId) => request(`/public/projects/${projectId}/milestones`),

  // Tasks
  getTasks: (projectId) => request(`/projects/${projectId}/tasks`),
  createTask: (projectId, data) => request(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  // Milestones
  getMilestones: (projectId) => request(`/projects/${projectId}/milestones`),
  createMilestone: (projectId, data) => request(`/projects/${projectId}/milestones`, { method: 'POST', body: JSON.stringify(data) }),
  updateMilestone: (id, data) => request(`/milestones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMilestone: (id) => request(`/milestones/${id}`, { method: 'DELETE' }),
};
