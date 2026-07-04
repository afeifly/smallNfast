import { Router } from 'express';
import db, { saveHistorySnapshot } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const verifyProjectOwner = (projectId, userId) => {
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
  return !!project;
};

// PUBLIC GET /api/public/projects/:projectId/tasks
router.get('/public/projects/:projectId/tasks', (req, res) => {
  try {
    const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order').all(req.params.projectId);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protect all following routes with authentication
router.use(authMiddleware);

// GET /api/projects/:projectId/tasks
router.get('/projects/:projectId/tasks', (req, res) => {
  if (!verifyProjectOwner(req.params.projectId, req.userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order').all(req.params.projectId);
  res.json(tasks);
});

// POST /api/projects/:projectId/tasks
router.post('/projects/:projectId/tasks', (req, res) => {
  if (!verifyProjectOwner(req.params.projectId, req.userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { title, status, start_date, end_date, sort_order } = req.body;
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM tasks WHERE project_id = ?').get(req.params.projectId).m || 0;

  const result = db.prepare(`
    INSERT INTO tasks (project_id, title, status, start_date, end_date, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    req.params.projectId,
    title || 'New Task',
    status || 'pending',
    start_date || null,
    end_date || null,
    sort_order !== undefined ? sort_order : maxOrder + 1
  );

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  saveHistorySnapshot(req.userId, `Created task "${task.title}"`);
  res.status(201).json(task);
});

// PATCH /api/tasks/:id
router.patch('/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  if (!verifyProjectOwner(existing.project_id, req.userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const fields = ['title', 'status', 'start_date', 'end_date', 'sort_order'];
  const updates = [];
  const values = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }

  if (updates.length === 0) return res.json(existing);

  updates.push("updated_at = datetime('now')");
  values.push(req.params.id);

  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  saveHistorySnapshot(req.userId, `Updated task "${updated.title}"`);
  res.json(updated);
});

// DELETE /api/tasks/:id
router.delete('/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  if (!verifyProjectOwner(existing.project_id, req.userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  saveHistorySnapshot(req.userId, `Deleted task "${existing.title}"`);
  res.json({ success: true });
});

export default router;
