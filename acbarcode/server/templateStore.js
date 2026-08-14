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
    subTemplates TEXT NOT NULL DEFAULT '[]',
    deviceName TEXT NOT NULL DEFAULT '',
    created_at TEXT,
    updated_at TEXT
  )
`);

// Migration for existing databases
const cols = db.prepare('PRAGMA table_info(templates)').all().map(c => c.name);
if (!cols.includes('subTemplates')) {
  db.exec("ALTER TABLE templates ADD COLUMN subTemplates TEXT NOT NULL DEFAULT '[]'");
}
if (!cols.includes('deviceName')) {
  db.exec("ALTER TABLE templates ADD COLUMN deviceName TEXT NOT NULL DEFAULT ''");
}

function rowToTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    itemNumbers: safeParse(row.itemNumbers, []),
    deviceName: row.deviceName || '',
    config: safeParse(row.config, {}),
    elements_en: safeParse(row.elements_en, []),
    elements_cn: safeParse(row.elements_cn, []),
    subTemplates: safeParse(row.subTemplates, []),
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

function normalizeSubTemplate(sub) {
  return {
    id: String((sub && sub.id) || ''),
    name: String((sub && sub.name) || 'Sub Template'),
    config: (sub && sub.config && typeof sub.config === 'object') ? sub.config : { widthMm: 35, heightMm: 22, dpi: 203 },
    elements_en: (sub && Array.isArray(sub.elements_en)) ? sub.elements_en : [],
    elements_cn: (sub && Array.isArray(sub.elements_cn)) ? sub.elements_cn : []
  };
}

function normalizeTemplate(tpl) {
  return {
    id: String(tpl.id || ''),
    name: String(tpl.name || 'New Template'),
    itemNumbers: Array.isArray(tpl.itemNumbers) ? tpl.itemNumbers : [],
    deviceName: String(tpl.deviceName || ''),
    config: (tpl.config && typeof tpl.config === 'object') ? tpl.config : { widthMm: 35, heightMm: 22, dpi: 203 },
    elements_en: Array.isArray(tpl.elements_en) ? tpl.elements_en : [],
    elements_cn: Array.isArray(tpl.elements_cn) ? tpl.elements_cn : [],
    subTemplates: Array.isArray(tpl.subTemplates) ? tpl.subTemplates.map(normalizeSubTemplate) : []
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
    INSERT INTO templates (id, name, itemNumbers, deviceName, config, elements_en, elements_cn, subTemplates, created_at, updated_at)
    VALUES (@id, @name, @itemNumbers, @deviceName, @config, @elements_en, @elements_cn, @subTemplates, @created_at, @updated_at)
  `).run({
    id: t.id,
    name: t.name,
    itemNumbers: JSON.stringify(t.itemNumbers),
    deviceName: t.deviceName,
    config: JSON.stringify(t.config),
    elements_en: JSON.stringify(t.elements_en),
    elements_cn: JSON.stringify(t.elements_cn),
    subTemplates: JSON.stringify(t.subTemplates),
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
    SET name = @name, itemNumbers = @itemNumbers, deviceName = @deviceName, config = @config,
        elements_en = @elements_en, elements_cn = @elements_cn, subTemplates = @subTemplates, updated_at = @updated_at
    WHERE id = @id
  `).run({
    id: t.id,
    name: t.name,
    itemNumbers: JSON.stringify(t.itemNumbers),
    deviceName: t.deviceName,
    config: JSON.stringify(t.config),
    elements_en: JSON.stringify(t.elements_en),
    elements_cn: JSON.stringify(t.elements_cn),
    subTemplates: JSON.stringify(t.subTemplates),
    updated_at: new Date().toISOString()
  });
  return getTemplateById(t.id);
}

function replaceAll(templatesList) {
  const list = Array.isArray(templatesList) ? templatesList.map(normalizeTemplate) : [];
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO templates (id, name, itemNumbers, deviceName, config, elements_en, elements_cn, subTemplates, created_at, updated_at)
    VALUES (@id, @name, @itemNumbers, @deviceName, @config, @elements_en, @elements_cn, @subTemplates, @created_at, @updated_at)
  `);
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM templates').run();
    for (const t of list) {
      insert.run({
        id: t.id,
        name: t.name,
        itemNumbers: JSON.stringify(t.itemNumbers),
        deviceName: t.deviceName,
        config: JSON.stringify(t.config),
        elements_en: JSON.stringify(t.elements_en),
        elements_cn: JSON.stringify(t.elements_cn),
        subTemplates: JSON.stringify(t.subTemplates),
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

// ── Sub-template helpers (one level, stored as JSON in the subTemplates column) ──

function addSubTemplate(templateId, subTemplate) {
  const existing = getTemplateById(templateId);
  if (!existing) return null;
  const sub = normalizeSubTemplate(subTemplate);
  existing.subTemplates.push(sub);
  updateTemplate(templateId, existing);
  return sub;
}

function updateSubTemplate(templateId, subId, patch) {
  const existing = getTemplateById(templateId);
  if (!existing) return null;
  const idx = existing.subTemplates.findIndex(s => s.id === subId);
  if (idx === -1) return null;
  existing.subTemplates[idx] = normalizeSubTemplate({ ...existing.subTemplates[idx], ...patch, id: subId });
  updateTemplate(templateId, existing);
  return existing.subTemplates[idx];
}

function removeSubTemplate(templateId, subId) {
  const existing = getTemplateById(templateId);
  if (!existing) return null;
  existing.subTemplates = existing.subTemplates.filter(s => s.id !== subId);
  updateTemplate(templateId, existing);
  return true;
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
  addSubTemplate,
  updateSubTemplate,
  removeSubTemplate,
  seedIfEmpty
};
