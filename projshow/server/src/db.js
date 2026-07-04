import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'projshow.db');

const db = new Database(dbPath);

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password      TEXT NOT NULL,
    space_name    TEXT NOT NULL,
    role          TEXT DEFAULT 'user'
  );

  CREATE TABLE IF NOT EXISTS projects (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    description   TEXT DEFAULT '',
    category      TEXT DEFAULT 'other',
    status        TEXT DEFAULT 'active',
    progress      INTEGER DEFAULT 0,
    start_date    TEXT,
    end_date      TEXT,
    links         TEXT DEFAULT '[]',
    tags          TEXT DEFAULT '[]',
    color_seed    TEXT,
    preview_images TEXT DEFAULT '[]',
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    status        TEXT DEFAULT 'pending',
    start_date    TEXT,
    end_date      TEXT,
    sort_order    INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS milestones (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    date          TEXT,
    status        TEXT DEFAULT 'pending',
    sort_order    INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS history_snapshots (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    timestamp     TEXT DEFAULT (datetime('now')),
    label         TEXT,
    data          TEXT NOT NULL
  );
`);

// Try altering in case the database file already exists without newer columns
try {
  db.exec("ALTER TABLE projects ADD COLUMN preview_images TEXT DEFAULT '[]'");
} catch (e) {}

try {
  db.exec("ALTER TABLE projects ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
} catch (e) {}

try {
  db.exec("ALTER TABLE history_snapshots ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1");
} catch (e) {}

export function saveHistorySnapshot(userId, label = 'Schedule Update') {
  if (!userId) return;
  try {
    const projects = db.prepare('SELECT * FROM projects WHERE user_id = ?').all(userId);
    const projectIds = projects.map(p => p.id);

    let tasks = [];
    let milestones = [];
    if (projectIds.length > 0) {
      const placeholders = projectIds.map(() => '?').join(',');
      tasks = db.prepare(`SELECT * FROM tasks WHERE project_id IN (${placeholders})`).all(...projectIds);
      milestones = db.prepare(`SELECT * FROM milestones WHERE project_id IN (${placeholders})`).all(...projectIds);
    }

    const snapshot = {
      projects: projects.map((p) => ({
        ...p,
        links: JSON.parse(p.links || '[]'),
        tags: JSON.parse(p.tags || '[]'),
        preview_images: JSON.parse(p.preview_images || '[]'),
      })),
      tasks,
      milestones,
    };

    db.prepare(`
      INSERT INTO history_snapshots (user_id, label, data)
      VALUES (?, ?, ?)
    `).run(userId, label, JSON.stringify(snapshot));
  } catch (err) {
    console.error('Failed to save history snapshot:', err);
  }
}

export default db;
