import { Router } from 'express';
import db, { saveHistorySnapshot } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const verifyProjectOwner = (projectId, userId) => {
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
  return !!project;
};

// PUBLIC GET /api/public/projects/:projectId/milestones
router.get('/public/projects/:projectId/milestones', (req, res) => {
  try {
    const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY sort_order').all(req.params.projectId);
    res.json(milestones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protect all following routes with authentication
router.use(authMiddleware);

// GET /api/projects/:projectId/milestones
router.get('/projects/:projectId/milestones', (req, res) => {
  if (!verifyProjectOwner(req.params.projectId, req.userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY sort_order').all(req.params.projectId);
  res.json(milestones);
});

// POST /api/projects/:projectId/milestones
router.post('/projects/:projectId/milestones', (req, res) => {
  if (!verifyProjectOwner(req.params.projectId, req.userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { title, date, status, sort_order } = req.body;
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM milestones WHERE project_id = ?').get(req.params.projectId).m || 0;

  const result = db.prepare(`
    INSERT INTO milestones (project_id, title, date, status, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    req.params.projectId,
    title || 'New Milestone',
    date || null,
    status || 'pending',
    sort_order !== undefined ? sort_order : maxOrder + 1
  );

  const milestone = db.prepare('SELECT * FROM milestones WHERE id = ?').get(result.lastInsertRowid);
  saveHistorySnapshot(req.userId, `Created milestone "${milestone.title}"`);
  res.status(201).json(milestone);
});

// PATCH /api/milestones/:id
router.patch('/milestones/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM milestones WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Milestone not found' });

  if (!verifyProjectOwner(existing.project_id, req.userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const fields = ['title', 'date', 'status', 'sort_order'];
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

  db.prepare(`UPDATE milestones SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM milestones WHERE id = ?').get(req.params.id);
  saveHistorySnapshot(req.userId, `Updated milestone "${updated.title}"`);
  res.json(updated);
});

// DELETE /api/milestones/:id
router.delete('/milestones/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM milestones WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Milestone not found' });

  if (!verifyProjectOwner(existing.project_id, req.userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.prepare('DELETE FROM milestones WHERE id = ?').run(req.params.id);
  saveHistorySnapshot(req.userId, `Deleted milestone "${existing.title}"`);
  res.json({ success: true });
});

export default router;
