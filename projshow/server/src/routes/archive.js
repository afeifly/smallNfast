import { Router } from 'express';
import { ZipArchive } from 'archiver';   // archiver v7 — class-based ESM API
import { createRequire } from 'module';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

// unzipper is CJS-only — load via createRequire inside ESM
const require = createRequire(import.meta.url);
const unzipper = require('unzipper');


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', '..', 'data', 'uploads');

// Multer: store zip in memory (max 200 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      file.originalname.endsWith('.zip')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .zip files are allowed'));
    }
  },
});

const router = Router();
router.use(authMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/archive/export
// Builds a zip and streams it to the client.
// zip layout:
//   space.json          — user meta + all projects with tasks & milestones
//   uploads/<file>.jpg  — every image referenced in preview_images
// ─────────────────────────────────────────────────────────────────────────────
router.get('/export', (req, res) => {
  try {
    const user = db
      .prepare('SELECT id, username, space_name, role FROM users WHERE id = ?')
      .get(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const projects = db
      .prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY id')
      .all(req.userId);

    const projectIds = projects.map((p) => p.id);

    let tasks = [];
    let milestones = [];
    if (projectIds.length > 0) {
      const ph = projectIds.map(() => '?').join(',');
      tasks = db
        .prepare(`SELECT * FROM tasks WHERE project_id IN (${ph}) ORDER BY project_id, sort_order`)
        .all(...projectIds);
      milestones = db
        .prepare(`SELECT * FROM milestones WHERE project_id IN (${ph}) ORDER BY project_id, sort_order`)
        .all(...projectIds);
    }

    // Parse JSON fields and collect image filenames
    const imageFilenames = new Set();
    const parsedProjects = projects.map((p) => {
      const previewImages = JSON.parse(p.preview_images || '[]');
      previewImages.forEach((url) => {
        // url is like "/uploads/1234567890-123456789.jpg"
        const filename = path.basename(url);
        imageFilenames.add(filename);
      });
      return {
        ...p,
        links: JSON.parse(p.links || '[]'),
        tags: JSON.parse(p.tags || '[]'),
        preview_images: previewImages,
      };
    });

    const spaceJson = {
      version: 1,
      exported_at: new Date().toISOString(),
      user: {
        username: user.username,
        space_name: user.space_name,
        role: user.role,
      },
      projects: parsedProjects,
      tasks,
      milestones,
    };

    // Set up streaming zip response
    const username = user.username.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="projshow-space-${username}.zip"`
    );

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.end();
    });

    archive.pipe(res);

    // Add space.json
    archive.append(JSON.stringify(spaceJson, null, 2), { name: 'space.json' });

    // Add each image file (skip missing ones silently)
    for (const filename of imageFilenames) {
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: `uploads/${filename}` });
      }
    }

    archive.finalize();
  } catch (err) {
    console.error('Export error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/archive/import
// Accepts a multipart zip upload.  Import is ADDITIVE — existing projects are
// untouched.  Projects, tasks, milestones get new IDs.  Images are saved with
// new filenames; preview_images URLs are remapped accordingly.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/import', upload.single('archive'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No zip file provided' });
  }

  try {
    // Parse the zip from the in-memory buffer
    const zipBuffer = req.file.buffer;
    const directory = await unzipper.Open.buffer(zipBuffer);

    // Extract space.json
    const spaceEntry = directory.files.find((f) => f.path === 'space.json');
    if (!spaceEntry) {
      return res.status(400).json({ error: 'Invalid archive: space.json not found' });
    }
    const spaceRaw = await spaceEntry.buffer();
    const spaceData = JSON.parse(spaceRaw.toString('utf8'));

    if (!spaceData.projects || !Array.isArray(spaceData.projects)) {
      return res.status(400).json({ error: 'Invalid space.json: missing projects array' });
    }

    // Ensure uploads dir exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Save images — build a filename → new filename map
    const imageMap = {}; // old relative path → new /uploads/<newname>
    const imageEntries = directory.files.filter(
      (f) => f.path.startsWith('uploads/') && !f.type.includes('Directory')
    );

    let imagesImported = 0;
    for (const entry of imageEntries) {
      const oldFilename = path.basename(entry.path);
      const ext = path.extname(oldFilename) || '.jpg';
      const newFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const destPath = path.join(uploadsDir, newFilename);
      const buf = await entry.buffer();
      fs.writeFileSync(destPath, buf);
      imageMap[`/uploads/${oldFilename}`] = `/uploads/${newFilename}`;
      imageMap[oldFilename] = `/uploads/${newFilename}`; // handle bare name too
      imagesImported++;
    }

    // Build a project_id remap for tasks/milestones
    const projectIdMap = {}; // old id → new id
    let projectsImported = 0;
    let tasksImported = 0;
    let milestonesImported = 0;

    const insertProject = db.prepare(`
      INSERT INTO projects
        (user_id, name, description, category, status, progress, scale,
         start_date, end_date, links, tags, color_seed, preview_images,
         created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTask = db.prepare(`
      INSERT INTO tasks (project_id, title, status, start_date, end_date, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMilestone = db.prepare(`
      INSERT INTO milestones (project_id, title, date, status, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const doImport = db.transaction(() => {
      for (const project of spaceData.projects) {
        // Remap preview_images URLs
        const remappedImages = (project.preview_images || []).map(
          (url) => imageMap[url] || imageMap[path.basename(url)] || url
        );

        const result = insertProject.run(
          req.userId,
          project.name || 'Imported Project',
          project.description || '',
          project.category || 'other',
          project.status || 'active',
          project.progress ?? 0,
          project.scale ?? 5,
          project.start_date || null,
          project.end_date || null,
          JSON.stringify(project.links || []),
          JSON.stringify(project.tags || []),
          project.color_seed || project.name || 'default',
          JSON.stringify(remappedImages),
          project.created_at || new Date().toISOString(),
          project.updated_at || new Date().toISOString()
        );

        const newProjectId = result.lastInsertRowid;
        projectIdMap[project.id] = newProjectId;
        projectsImported++;
      }

      // Insert tasks
      for (const task of spaceData.tasks || []) {
        const newProjectId = projectIdMap[task.project_id];
        if (!newProjectId) continue;
        insertTask.run(
          newProjectId,
          task.title || 'Task',
          task.status || 'pending',
          task.start_date || null,
          task.end_date || null,
          task.sort_order ?? 0,
          task.created_at || new Date().toISOString(),
          task.updated_at || new Date().toISOString()
        );
        tasksImported++;
      }

      // Insert milestones
      for (const ms of spaceData.milestones || []) {
        const newProjectId = projectIdMap[ms.project_id];
        if (!newProjectId) continue;
        insertMilestone.run(
          newProjectId,
          ms.title || 'Milestone',
          ms.date || null,
          ms.status || 'pending',
          ms.sort_order ?? 0,
          ms.created_at || new Date().toISOString(),
          ms.updated_at || new Date().toISOString()
        );
        milestonesImported++;
      }
    });

    doImport();

    res.json({
      success: true,
      imported: {
        projects: projectsImported,
        tasks: tasksImported,
        milestones: milestonesImported,
        images: imagesImported,
      },
      source_space: spaceData.user?.space_name || 'Unknown',
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message || 'Import failed' });
  }
});

export default router;
