import defaultTemplateStandard from '../data/defaultTemplateStandard.js';

export const DEFAULT_CONFIG = defaultTemplateStandard.config || { widthMm: 35, heightMm: 22, dpi: 300 };
export const DEFAULT_ELEMENTS_EN = defaultTemplateStandard.elements_en || [];
export const DEFAULT_ELEMENTS_CN = defaultTemplateStandard.elements_cn || [];

export function isSpecialTemplate(t) {
  if (!t) return false;
  return Boolean(
    t.isSpecial ||
    t.id === 'tpl_delivery' ||
    t.id === 'tpl_std_flow' ||
    t.name === 'Delivery Template' ||
    t.name === 'Deliver label'
  );
}

export function sortTemplatesWithDeliveryFirst(templatesList) {
  if (!Array.isArray(templatesList)) return [];
  const special = [];
  const regular = [];
  for (const t of templatesList) {
    if (isSpecialTemplate(t)) {
      special.push({ ...t, isSpecial: true });
    } else {
      regular.push(t);
    }
  }
  return [...special, ...regular];
}

export function createInitialDefaultTemplates() {
  return [
    {
      id: 'tpl_delivery',
      name: 'Delivery Template',
      isSpecial: true,
      itemNumbers: ['S695 4035', 'S695 4036', 'S403'],
      deviceName: '',
      note: 'Default SUTO-iTEC Delivery label template (35×22mm @300 DPI). Always pinned to top and protected.',
      config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      elements_en: JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_EN)),
      elements_cn: JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_CN)),
      subTemplates: JSON.parse(JSON.stringify(defaultTemplateStandard.subTemplates || []))
    },
    {
      id: 'tpl_high_temp',
      name: 'High Temp Sensor',
      itemNumbers: ['S695 4099', 'S4099'],
      deviceName: '',
      note: 'High temperature flow sensor label. Matches S695 4099 / S4099 item numbers.',
      config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      elements_en: JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_EN)),
      elements_cn: JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_CN)),
      subTemplates: []
    }
  ];
}

// ── Server API (templates are stored server-side in SQLite) ─────────────

export function getAdminHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (sessionStorage.getItem('acbarcode_role') === 'admin') {
    headers['X-Admin-Password'] = 'SUTOadmin1234';
  }
  return headers;
}

export async function fetchTemplatesFromServer() {
  const res = await fetch('/api/templates');
  if (!res.ok) {
    let msg = 'Failed to load templates';
    try { msg = (await res.json()).error || msg; } catch (e) { /* ignore */ }
    throw new Error(msg);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function saveTemplatesToServer(templates) {
  const res = await fetch('/api/templates', {
    method: 'PUT',
    headers: getAdminHeaders(),
    body: JSON.stringify(Array.isArray(templates) ? templates : [])
  });
  if (!res.ok) {
    let msg = 'Failed to save templates';
    try { msg = (await res.json()).error || msg; } catch (e) { /* ignore */ }
    throw new Error(msg);
  }
  const data = await res.json();
  return data.templates || templates;
}

export async function importTemplatesToServer(templates) {
  return saveTemplatesToServer(templates);
}

export function matchTemplateByItemNo(templates, itemNo) {
  if (!itemNo || !Array.isArray(templates)) return null;
  const target = itemNo.trim().toLowerCase();
  const matched = templates.find(t => {
    if (!t.itemNumbers || !Array.isArray(t.itemNumbers)) return false;
    return t.itemNumbers.some(inNum => inNum.trim().toLowerCase() === target || target.includes(inNum.trim().toLowerCase()));
  });
  return matched || null;
}
