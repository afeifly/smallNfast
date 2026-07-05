import { Router } from 'express';
import db, { saveHistorySnapshot } from '../db.js';
import { resetDatabase } from '../seed.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// PUBLIC GET /api/projects/public/:userId — list all projects for a specific shared space
router.get('/public/:userId', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY id').all(req.params.userId);
    res.json(rows.map(parseProject));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protect all following routes with authentication
router.use(authMiddleware);

// GET /api/projects — list all for authenticated user (optional ?status=active filter)
router.get('/', (req, res) => {
  const { status } = req.query;
  let rows;
  if (status) {
    rows = db.prepare('SELECT * FROM projects WHERE user_id = ? AND status = ? ORDER BY id').all(req.userId, status);
  } else {
    rows = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY id').all(req.userId);
  }
  const projects = rows.map(parseProject);
  res.json(projects);
});

// GET /api/projects/history — list all schedule history snapshots
router.get('/history', (req, res) => {
  try {
    const snapshots = db.prepare('SELECT id, timestamp, label FROM history_snapshots WHERE user_id = ? ORDER BY timestamp DESC').all(req.userId);
    res.json(snapshots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/history/:id — get data for a specific snapshot
router.get('/history/:id', (req, res) => {
  try {
    const snapshot = db.prepare('SELECT * FROM history_snapshots WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
    res.json({
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      label: snapshot.label,
      data: JSON.parse(snapshot.data)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id — single project
router.get('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order').all(project.id);
  const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY sort_order').all(project.id);

  res.json({ ...parseProject(project), tasks, milestones });
});

// POST /api/projects — create project
router.post('/', (req, res) => {
  const { name, description, category, status, progress, start_date, end_date, links, tags, color_seed, preview_images } = req.body;
  const result = db.prepare(`
    INSERT INTO projects (user_id, name, description, category, status, progress, start_date, end_date, links, tags, color_seed, preview_images)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.userId,
    name || 'New Project',
    description || '',
    category || 'other',
    status || 'active',
    progress || 0,
    start_date || null,
    end_date || null,
    JSON.stringify(links || []),
    JSON.stringify(tags || []),
    color_seed || name || 'default',
    JSON.stringify(preview_images || [])
  );

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  saveHistorySnapshot(req.userId, `Created project "${project.name}"`);
  res.status(201).json({ ...parseProject(project), tasks: [], milestones: [] });
});

// PATCH /api/projects/:id — partial update
router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const fields = ['name', 'description', 'category', 'status', 'progress', 'scale', 'start_date', 'end_date', 'color_seed'];
  const jsonFields = ['links', 'tags', 'preview_images'];
  const updates = [];
  const values = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }
  for (const field of jsonFields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(JSON.stringify(req.body[field]));
    }
  }

  if (updates.length === 0) return res.json(parseProject(existing));

  updates.push("updated_at = datetime('now')");
  values.push(req.params.id);

  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  saveHistorySnapshot(req.userId, `Updated project "${updated.name}"`);
  res.json(parseProject(updated));
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  saveHistorySnapshot(req.userId, `Deleted project "${existing.name}"`);
  res.json({ success: true });
});

// POST /api/reset — truncate + re-seed
router.post('/reset', (req, res) => {
  resetDatabase();
  const projects = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY id').all(req.userId).map(parseProject);
  res.json(projects);
});

function parseProject(row) {
  return {
    ...row,
    links: JSON.parse(row.links || '[]'),
    tags: JSON.parse(row.tags || '[]'),
    preview_images: JSON.parse(row.preview_images || '[]'),
  };
}

export default router;
