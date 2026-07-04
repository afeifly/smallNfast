import db from './db.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function seedDatabase() {
  const count = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
  if (count > 0) {
    console.log('  Database already seeded, skipping.');
    return;
  }

  runSeed();
}

export function resetDatabase() {
  db.exec('DELETE FROM milestones');
  db.exec('DELETE FROM tasks');
  db.exec('DELETE FROM projects');
  db.exec('DELETE FROM history_snapshots');
  db.exec('DELETE FROM users');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('projects','tasks','milestones','history_snapshots','users')");
  runSeed();
}

function runSeed() {
  const seedPath = path.join(__dirname, '..', 'data', 'seed.json');
  const projects = JSON.parse(readFileSync(seedPath, 'utf-8'));

  // Seed default admin user
  const insertUser = db.prepare(`
    INSERT INTO users (username, password, space_name, role)
    VALUES (?, ?, ?, ?)
  `);
  const userResult = insertUser.run('admin', '12345', "Ethan's work", 'admin');
  const adminUserId = userResult.lastInsertRowid;

  const insertProject = db.prepare(`
    INSERT INTO projects (user_id, name, description, category, status, progress, start_date, end_date, links, tags, color_seed, preview_images)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTask = db.prepare(`
    INSERT INTO tasks (project_id, title, status, start_date, end_date, sort_order)
    VALUES (@project_id, @title, @status, @start_date, @end_date, @sort_order)
  `);

  const insertMilestone = db.prepare(`
    INSERT INTO milestones (project_id, title, date, status, sort_order)
    VALUES (@project_id, @title, @date, @status, @sort_order)
  `);

  const seedAll = db.transaction(() => {
    for (const project of projects) {
      const result = insertProject.run(
        adminUserId,
        project.name,
        project.description || '',
        project.category || 'other',
        project.status || 'active',
        project.progress || 0,
        project.start_date || null,
        project.end_date || null,
        JSON.stringify(project.links || []),
        JSON.stringify(project.tags || []),
        project.color_seed || project.name,
        JSON.stringify(project.preview_images || [])
      );

      const projectId = result.lastInsertRowid;

      if (project.tasks) {
        for (const task of project.tasks) {
          insertTask.run({
            project_id: projectId,
            title: task.title,
            status: task.status || 'pending',
            start_date: task.start_date || null,
            end_date: task.end_date || null,
            sort_order: task.sort_order || 0,
          });
        }
      }

      if (project.milestones) {
        for (const ms of project.milestones) {
          insertMilestone.run({
            project_id: projectId,
            title: ms.title,
            date: ms.date || null,
            status: ms.status || 'pending',
            sort_order: ms.sort_order || 0,
          });
        }
      }
    }
  });

  seedAll();

  // Create mock historical snapshots representing schedule growth
  try {
    const currentProjects = db.prepare('SELECT * FROM projects WHERE user_id = ?').all(adminUserId).map((p) => ({
      ...p,
      links: JSON.parse(p.links || '[]'),
      tags: JSON.parse(p.tags || '[]'),
      preview_images: JSON.parse(p.preview_images || '[]'),
    }));
    
    const projectIds = currentProjects.map(p => p.id);
    let currentTasks = [];
    let currentMilestones = [];
    if (projectIds.length > 0) {
      const placeholders = projectIds.map(() => '?').join(',');
      currentTasks = db.prepare(`SELECT * FROM tasks WHERE project_id IN (${placeholders})`).all(...projectIds);
      currentMilestones = db.prepare(`SELECT * FROM milestones WHERE project_id IN (${placeholders})`).all(...projectIds);
    }

    // Snapshot 1 (2 weeks ago - e.g. June 20, 2026)
    const snap1Tasks = currentTasks.map((t) => {
      if (t.end_date) {
        const d = new Date(t.end_date + 'T00:00:00');
        d.setDate(d.getDate() - 12);
        return { ...t, end_date: d.toISOString().split('T')[0] };
      }
      return t;
    });
    const snap1Snapshot = {
      projects: currentProjects,
      tasks: snap1Tasks,
      milestones: currentMilestones,
    };
    db.prepare(`
      INSERT INTO history_snapshots (user_id, timestamp, label, data)
      VALUES (?, ?, ?, ?)
    `).run(adminUserId, '2026-06-20 10:00:00', 'Initial Scope Setup (June 20)', JSON.stringify(snap1Snapshot));

    // Snapshot 2 (1 week ago - e.g. June 27, 2026)
    const snap2Tasks = currentTasks.map((t) => {
      if (t.end_date) {
        const d = new Date(t.end_date + 'T00:00:00');
        d.setDate(d.getDate() - 6);
        return { ...t, end_date: d.toISOString().split('T')[0] };
      }
      return t;
    });
    const snap2Snapshot = {
      projects: currentProjects,
      tasks: snap2Tasks,
      milestones: currentMilestones,
    };
    db.prepare(`
      INSERT INTO history_snapshots (user_id, timestamp, label, data)
      VALUES (?, ?, ?, ?)
    `).run(adminUserId, '2026-06-27 10:00:00', 'Mid-Sprint Iteration (June 27)', JSON.stringify(snap2Snapshot));

    // Snapshot 3 (Today)
    const snap3Snapshot = {
      projects: currentProjects,
      tasks: currentTasks,
      milestones: currentMilestones,
    };
    db.prepare(`
      INSERT INTO history_snapshots (user_id, timestamp, label, data)
      VALUES (?, ?, ?, ?)
    `).run(adminUserId, new Date().toISOString().replace('T', ' ').substring(0, 19), 'Current Baseline (July 4)', JSON.stringify(snap3Snapshot));
  } catch (err) {
    console.error('Failed to seed historical snapshots:', err);
  }

  console.log(`  Seeded ${projects.length} projects, tasks, milestones and history snapshots.`);
}
