import { ref, computed } from 'vue';
import {
  fetchTemplatesFromServer,
  saveTemplatesToServer,
  createInitialDefaultTemplates,
  DEFAULT_CONFIG,
  DEFAULT_ELEMENTS_EN,
  DEFAULT_ELEMENTS_CN
} from '../utils/stTemplateManager.js';

// ── Shared template state (used by both the Template Manager page and the ST designer) ──

export const templates = ref([]);
export const activeTemplateId = ref('');
export const activeSubTemplateId = ref('');
export const templatesLoaded = ref(false);

export const activeTemplate = computed(() =>
  templates.value.find(t => t.id === activeTemplateId.value) || templates.value[0]
);

export const activeSubTemplate = computed(() => {
  if (!activeTemplate.value || !activeSubTemplateId.value) return null;
  return (activeTemplate.value.subTemplates || []).find(s => s.id === activeSubTemplateId.value) || null;
});

// ── Load / save ─────────────────────────────────────────────────────────

export async function loadTemplates() {
  try {
    templates.value = await fetchTemplatesFromServer();
  } catch (err) {
    console.error('Failed to load templates from server:', err);
    templates.value = createInitialDefaultTemplates();
  }
  if (templates.value.length > 0 && !templates.value.find(t => t.id === activeTemplateId.value)) {
    activeTemplateId.value = templates.value[0].id;
  }
  templatesLoaded.value = true;
  return templates.value;
}

let saveTimer = null;

export function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTemplateNow();
  }, 800);
}

export async function flushTemplateSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  await saveTemplateNow();
}

async function saveTemplateNow() {
  try {
    await saveTemplatesToServer(templates.value);
  } catch (err) {
    console.error('Failed to save templates to server:', err);
  }
}

// ── Selection ───────────────────────────────────────────────────────────

export function setActiveTemplate(id) {
  activeSubTemplateId.value = '';
  activeTemplateId.value = id;
}

export function setActiveSubTemplate(id) {
  activeSubTemplateId.value = id || '';
}

export function clearSubSelection() {
  activeSubTemplateId.value = '';
}

// ── Helpers ─────────────────────────────────────────────────────────────

function generateId() {
  return 'tpl_' + Math.random().toString(36).substr(2, 9);
}

function defaultConfig() {
  return DEFAULT_CONFIG ? JSON.parse(JSON.stringify(DEFAULT_CONFIG)) : { widthMm: 35, heightMm: 22, dpi: 300 };
}

// ── Main template CRUD ──────────────────────────────────────────────────

export function createTemplate() {
  const newTpl = {
    id: generateId(),
    name: 'New Template',
    itemNumbers: [],
    deviceName: '',
    config: defaultConfig(),
    elements_en: JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_EN)),
    elements_cn: JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_CN)),
    subTemplates: []
  };
  templates.value.push(newTpl);
  activeSubTemplateId.value = '';
  activeTemplateId.value = newTpl.id;
  scheduleSave();
  return newTpl;
}

export function duplicateTemplate() {
  const tpl = activeTemplate.value;
  if (!tpl) return null;
  const clone = JSON.parse(JSON.stringify(tpl));
  clone.id = generateId();
  clone.name = clone.name + ' (Copy)';
  clone.subTemplates = (clone.subTemplates || []).map(s => ({ ...s, id: generateId() }));
  templates.value.push(clone);
  activeSubTemplateId.value = '';
  activeTemplateId.value = clone.id;
  scheduleSave();
  return clone;
}

export function deleteTemplate() {
  if (templates.value.length <= 1) return false;
  const idx = templates.value.findIndex(t => t.id === activeTemplateId.value);
  templates.value.splice(idx, 1);
  activeSubTemplateId.value = '';
  activeTemplateId.value = templates.value[Math.max(0, idx - 1)]?.id || templates.value[0]?.id;
  scheduleSave();
  return true;
}

export function updateTemplateField({ id, name, itemNumbers, deviceName, config }) {
  const tpl = templates.value.find(t => t.id === id);
  if (!tpl) return;
  if (name !== undefined) tpl.name = name;
  if (itemNumbers !== undefined) tpl.itemNumbers = itemNumbers;
  if (deviceName !== undefined) tpl.deviceName = deviceName;
  if (config !== undefined) tpl.config = { ...config };
  scheduleSave();
}

export function resetTemplateDefaults() {
  const tpl = activeTemplate.value;
  if (!tpl) return;
  tpl.elements_en = JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_EN));
  tpl.elements_cn = JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_CN));
  tpl.config = defaultConfig();
  scheduleSave();
}

export function copyEnToCn(container = null) {
  const target = container || activeSubTemplate.value || activeTemplate.value;
  if (!target) return;
  target.elements_cn = JSON.parse(JSON.stringify(target.elements_en || []));
  scheduleSave();
}

// ── Sub-template CRUD (one level) ───────────────────────────────────────

export function addSubTemplate() {
  const tpl = activeTemplate.value;
  if (!tpl) return null;
  const sub = {
    id: generateId(),
    name: 'Sub Template',
    config: defaultConfig(),
    elements_en: [],
    elements_cn: []
  };
  if (!Array.isArray(tpl.subTemplates)) tpl.subTemplates = [];
  tpl.subTemplates.push(sub);
  scheduleSave();
  return sub;
}

export function updateSubTemplate(subId, patch) {
  const tpl = activeTemplate.value;
  if (!tpl || !Array.isArray(tpl.subTemplates)) return;
  const sub = tpl.subTemplates.find(s => s.id === subId);
  if (!sub) return;
  if (patch.name !== undefined) sub.name = patch.name;
  if (patch.config !== undefined) sub.config = { ...patch.config };
  scheduleSave();
}

export function removeSubTemplate(subId) {
  const tpl = activeTemplate.value;
  if (!tpl || !Array.isArray(tpl.subTemplates)) return;
  tpl.subTemplates = tpl.subTemplates.filter(s => s.id !== subId);
  if (activeSubTemplateId.value === subId) activeSubTemplateId.value = '';
  scheduleSave();
}
