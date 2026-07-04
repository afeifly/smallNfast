import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const adminMiddleware = (req, res, next) => {
  const user = db.prepare('SELECT role FROM users WHERE id = ? AND is_active = 1').get(req.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    res.json({
      id: user.id,
      username: user.username,
      space_name: user.space_name,
      role: user.role,
      token: 'mock-jwt-token-' + user.id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/space/:userId (public lookup for space headers)
router.get('/space/:userId', (req, res) => {
  try {
    const user = db.prepare('SELECT id, space_name FROM users WHERE id = ? AND is_active = 1').get(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Space not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/users (admin only) — includes inactive for admin visibility
router.get('/users', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const users = db.prepare(
      'SELECT id, username, space_name, role, is_active FROM users ORDER BY id'
    ).all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/users (admin only) — create new user
router.post('/users', authMiddleware, adminMiddleware, (req, res) => {
  const { username, password, space_name, role } = req.body;
  if (!username || !password || !space_name) {
    return res.status(400).json({ error: 'Username, password, and space_name are required' });
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const result = db.prepare(`
      INSERT INTO users (username, password, space_name, role, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(username, password, space_name, role || 'user');

    const created = db.prepare(
      'SELECT id, username, space_name, role, is_active FROM users WHERE id = ?'
    ).get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/users/:id/deactivate (admin only) — soft delete
router.patch('/users/:id/deactivate', authMiddleware, adminMiddleware, (req, res) => {
  const targetId = parseInt(req.params.id, 10);

  // Prevent self-deactivation
  if (targetId === req.userId) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }

  try {
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(targetId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(targetId);
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/users/:id/activate (admin only) — re-activate a deactivated user
router.patch('/users/:id/activate', authMiddleware, adminMiddleware, (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  try {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(targetId);
    res.json({ success: true, message: 'User reactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/impersonate/:id (admin only) — login as another user
router.post('/impersonate/:id', authMiddleware, adminMiddleware, (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  try {
    const user = db.prepare(
      'SELECT id, username, space_name, role, is_active FROM users WHERE id = ?'
    ).get(targetId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: user.id,
      username: user.username,
      space_name: user.space_name,
      role: user.role,
      token: 'mock-jwt-token-' + user.id,
      _impersonatedBy: req.userId,  // track who impersonated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/me — any logged-in user can update their own space_name / password
router.patch('/me', authMiddleware, (req, res) => {
  const { space_name, password } = req.body;
  if (!space_name && !password) {
    return res.status(400).json({ error: 'Provide space_name and/or password to update' });
  }

  try {
    const fields = [];
    const values = [];
    if (space_name && space_name.trim()) {
      fields.push('space_name = ?');
      values.push(space_name.trim());
    }
    if (password && password.trim()) {
      fields.push('password = ?');
      values.push(password.trim());
    }
    values.push(req.userId);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const updated = db.prepare('SELECT id, username, space_name, role FROM users WHERE id = ?').get(req.userId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
