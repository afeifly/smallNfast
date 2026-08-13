const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(path.join(dbDir, 'templates.db'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    itemNumbers TEXT NOT NULL DEFAULT '[]',
    config TEXT NOT NULL DEFAULT '{}',
    elements_en TEXT NOT NULL DEFAULT '[]',
    elements_cn TEXT NOT NULL DEFAULT '[]',
    created_at TEXT,
    updated_at TEXT
  )
`);

function rowToTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    itemNumbers: safeParse(row.itemNumbers, []),
    config: safeParse(row.config, {}),
    elements_en: safeParse(row.elements_en, []),
    elements_cn: safeParse(row.elements_cn, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function safeParse(str, fallback) {
  try {
    const val = JSON.parse(str);
    return val == null ? fallback : val;
  } catch (e) {
    return fallback;
  }
}

function normalizeTemplate(tpl) {
  return {
    id: String(tpl.id || ''),
    name: String(tpl.name || 'New Template'),
    itemNumbers: Array.isArray(tpl.itemNumbers) ? tpl.itemNumbers : [],
    config: (tpl.config && typeof tpl.config === 'object') ? tpl.config : { widthMm: 35, heightMm: 22, dpi: 203 },
    elements_en: Array.isArray(tpl.elements_en) ? tpl.elements_en : [],
    elements_cn: Array.isArray(tpl.elements_cn) ? tpl.elements_cn : []
  };
}

function getAllTemplates() {
  const rows = db.prepare('SELECT * FROM templates ORDER BY created_at ASC').all();
  return rows.map(rowToTemplate);
}

function getTemplateById(id) {
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(String(id));
  return row ? rowToTemplate(row) : null;
}

function insertTemplate(tpl) {
  const t = normalizeTemplate(tpl);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO templates (id, name, itemNumbers, config, elements_en, elements_cn, created_at, updated_at)
    VALUES (@id, @name, @itemNumbers, @config, @elements_en, @elements_cn, @created_at, @updated_at)
  `).run({
    id: t.id,
    name: t.name,
    itemNumbers: JSON.stringify(t.itemNumbers),
    config: JSON.stringify(t.config),
    elements_en: JSON.stringify(t.elements_en),
    elements_cn: JSON.stringify(t.elements_cn),
    created_at: now,
    updated_at: now
  });
  return getTemplateById(t.id);
}

function updateTemplate(id, tpl) {
  const existing = getTemplateById(id);
  if (!existing) return null;
  const t = normalizeTemplate({ ...existing, ...tpl, id });
  db.prepare(`
    UPDATE templates
    SET name = @name, itemNumbers = @itemNumbers, config = @config,
        elements_en = @elements_en, elements_cn = @elements_cn, updated_at = @updated_at
    WHERE id = @id
  `).run({
    id: t.id,
    name: t.name,
    itemNumbers: JSON.stringify(t.itemNumbers),
    config: JSON.stringify(t.config),
    elements_en: JSON.stringify(t.elements_en),
    elements_cn: JSON.stringify(t.elements_cn),
    updated_at: new Date().toISOString()
  });
  return getTemplateById(t.id);
}

function replaceAll(templatesList) {
  const list = Array.isArray(templatesList) ? templatesList.map(normalizeTemplate) : [];
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO templates (id, name, itemNumbers, config, elements_en, elements_cn, created_at, updated_at)
    VALUES (@id, @name, @itemNumbers, @config, @elements_en, @elements_cn, @created_at, @updated_at)
  `);
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM templates').run();
    for (const t of list) {
      insert.run({
        id: t.id,
        name: t.name,
        itemNumbers: JSON.stringify(t.itemNumbers),
        config: JSON.stringify(t.config),
        elements_en: JSON.stringify(t.elements_en),
        elements_cn: JSON.stringify(t.elements_cn),
        created_at: now,
        updated_at: now
      });
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return getAllTemplates();
}

function deleteTemplate(id) {
  const result = db.prepare('DELETE FROM templates WHERE id = ?').run(String(id));
  return result.changes > 0;
}

function count() {
  return db.prepare('SELECT COUNT(*) AS c FROM templates').get().c;
}

async function seedIfEmpty() {
  if (count() > 0) return;
  const { createInitialDefaultTemplates } = await import('../src/utils/stTemplateManager.js');
  const defaults = createInitialDefaultTemplates();
  if (Array.isArray(defaults) && defaults.length > 0) {
    replaceAll(defaults);
  }
}

module.exports = {
  getAllTemplates,
  getTemplateById,
  insertTemplate,
  updateTemplate,
  replaceAll,
  deleteTemplate,
  count,
  seedIfEmpty
};
