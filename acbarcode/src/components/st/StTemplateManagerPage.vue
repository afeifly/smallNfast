<template>
  <div class="tpl-page">
    <div class="tpl-page-header">
      <h2>Template Manager</h2>
    </div>

    <div class="tpl-layout">
      <!-- ── LEFT: template list ─────────────────────────────────── -->
      <aside class="tpl-list-pane">
        <input v-model="searchQuery" type="text" placeholder="🔍 Search templates..." class="tpl-search" />
        <div class="tpl-list">
          <div
            v-for="t in filteredTemplates"
            :key="t.id"
            class="tpl-item"
            :class="{ selected: t.id === activeTemplateId }"
            @click="selectTemplate(t.id)"
          >
            <div class="tpl-item-name">{{ t.name }}</div>
            <div class="tpl-item-items">{{ (t.itemNumbers || []).join(', ') || '—' }}</div>
            <div class="tpl-item-meta">
              <span>{{ t.config?.widthMm }}×{{ t.config?.heightMm }}mm · {{ t.config?.dpi }}dpi</span>
              <span v-if="subCount(t) > 0" class="sub-badge">● {{ subCount(t) }} sub</span>
            </div>
          </div>
          <div v-if="!filteredTemplates.length" class="tpl-empty">No templates found</div>
        </div>
      </aside>

      <!-- ── RIGHT: edit ─────────────────────────────────────────── -->
      <section class="tpl-edit-pane">
        <template v-if="activeTemplate">
          <!-- Main template -->
          <div class="card">
            <div class="card-head">
              <span class="card-title">Main Template</span>
              <div class="card-actions">
                <button type="button" class="mini-btn" @click="createTemplate">＋ New</button>
                <button type="button" class="mini-btn" @click="duplicateTemplate">📋 Duplicate</button>
                <button type="button" class="mini-btn danger" :disabled="templates.length <= 1" @click="onDelete">🗑️ Delete</button>
                <button type="button" class="mini-btn" @click="onReset">🔄 Reset</button>
              </div>
            </div>
            <div class="card-body">
              <!-- Line 1: Template Name + Item Numbers / SKUs -->
              <div class="field-grid-2">
                <div class="field-col">
                  <label>Template Name</label>
                  <input type="text" :value="activeTemplate.name" @input="activeTemplate.name = $event.target.value; scheduleSave()" placeholder="e.g. Standard" />
                </div>
                <div class="field-col">
                  <label>Item Numbers / SKUs <span class="hint-inline">(comma-separated)</span></label>
                  <input type="text" :value="rawItemNumbersText" @input="onItemNumbersInput" placeholder="e.g. S695 4035, S695 4036, S403" />
                </div>
              </div>

              <!-- Line 2: Device Name + Label Size & DPI -->
              <div class="field-grid-2">
                <div class="field-col">
                  <label>Device Name <span class="hint-inline">(for SUTO QR code)</span></label>
                  <input type="text" :value="activeTemplate.deviceName || ''" @input="activeTemplate.deviceName = $event.target.value; scheduleSave()" placeholder="e.g. S4C-APP or WTU" />
                </div>
                <div class="field-col">
                  <label>Label Size &amp; DPI</label>
                  <div class="dims-inputs">
                    <input type="number" step="0.1" :value="activeTemplate.config?.widthMm" @input="setConfig('widthMm', $event.target.value)" />
                    <span class="dim-sep">×</span>
                    <input type="number" step="0.1" :value="activeTemplate.config?.heightMm" @input="setConfig('heightMm', $event.target.value)" />
                    <span class="dim-unit">mm</span>
                    <select :value="activeTemplate.config?.dpi" @change="setConfig('dpi', +$event.target.value)">
                      <option :value="203">203 DPI</option>
                      <option :value="300">300 DPI</option>
                      <option :value="600">600 DPI</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Line 3: Button group aligned right -->
              <div class="field-row-actions-right">
                <div class="inline-card-actions">
                  <button type="button" class="mini-btn" @click="exportMainJson">📤 Export JSON</button>
                  <label class="mini-btn">
                    📥 Import JSON
                    <input type="file" accept=".json" style="display:none" @change="importMainJson" />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Sub-templates -->
          <div class="card">
            <div class="card-head">
              <span class="card-title">Sub-Templates ({{ subCount(activeTemplate) }})</span>
              <button type="button" class="mini-btn" @click="addSubTemplate">＋ Add Sub-Template</button>
            </div>
            <div class="card-body tight">
              <div v-if="subCount(activeTemplate) === 0" class="tpl-empty small">No sub-templates configured.</div>
              <div v-for="sub in activeTemplate.subTemplates" :key="sub.id" class="sub-row-compact">
                <input type="text" :value="sub.name" @input="sub.name = $event.target.value; scheduleSave()" class="sub-name-compact" placeholder="Sub-template name" />
                <div class="sub-dims-compact">
                  <input type="number" step="0.1" :value="sub.config?.widthMm" @input="setSubConfig(sub.id, 'widthMm', $event.target.value)" />
                  <span class="dim-sep">×</span>
                  <input type="number" step="0.1" :value="sub.config?.heightMm" @input="setSubConfig(sub.id, 'heightMm', $event.target.value)" />
                  <span class="dim-unit">mm</span>
                  <select :value="sub.config?.dpi" @change="setSubConfig(sub.id, 'dpi', +$event.target.value)">
                    <option :value="203">203</option>
                    <option :value="300">300</option>
                    <option :value="600">600</option>
                  </select>
                  <span class="dim-unit">dpi</span>
                </div>
                <button type="button" class="mini-btn danger" @click="removeSubTemplate(sub.id)" title="Remove sub-template">✕</button>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="open-row">
            <button type="button" class="primary-btn" @click="$emit('open-in-designer', activeTemplate.id)">
              Open in Designer →
            </button>
            <button type="button" class="ghost-btn" @click="onPasteEzpx">📋 Paste EZPX Text</button>
          </div>
        </template>

        <div v-else class="tpl-empty big">
          Select a template from the left, or click "＋ New" to create one.
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import {
  templates,
  activeTemplateId,
  activeTemplate,
  templatesLoaded,
  loadTemplates,
  scheduleSave,
  flushTemplateSave,
  createTemplate,
  duplicateTemplate,
  deleteTemplate,
  resetTemplateDefaults,
  addSubTemplate,
  removeSubTemplate,
  setActiveTemplate
} from '../../stores/templateStore.js';
import { DEFAULT_ELEMENTS_EN, DEFAULT_ELEMENTS_CN } from '../../utils/stTemplateManager.js';
import { parseEzpxXmlToTemplate } from '../../utils/stEzpxParser.js';
import { showStAlert, showStConfirm } from '../../utils/stDialog.js';

defineEmits(['open-in-designer']);

const searchQuery = ref('');

const filteredTemplates = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return templates.value;
  return templates.value.filter(t =>
    (t.name || '').toLowerCase().includes(q) ||
    (t.itemNumbers || []).some(n => String(n).toLowerCase().includes(q))
  );
});

const rawItemNumbersText = ref('');

watch(
  () => activeTemplate.value?.id,
  () => {
    rawItemNumbersText.value = (activeTemplate.value?.itemNumbers || []).join(', ');
  },
  { immediate: true }
);

function subCount(t) {
  return Array.isArray(t?.subTemplates) ? t.subTemplates.length : 0;
}

function selectTemplate(id) {
  setActiveTemplate(id);
}

function onItemNumbersInput(e) {
  const val = e.target.value;
  rawItemNumbersText.value = val;
  const t = activeTemplate.value;
  if (!t) return;
  t.itemNumbers = val.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  scheduleSave();
}

function setConfig(key, val) {
  const t = activeTemplate.value;
  if (!t) return;
  if (!t.config) t.config = { widthMm: 35, heightMm: 22, dpi: 203 };
  t.config[key] = val === '' ? 0 : Number(val);
  scheduleSave();
}

function setSubConfig(subId, key, val) {
  const t = activeTemplate.value;
  const sub = (t?.subTemplates || []).find(s => s.id === subId);
  if (!sub) return;
  if (!sub.config) sub.config = { widthMm: 35, heightMm: 22, dpi: 203 };
  sub.config[key] = val === '' ? 0 : Number(val);
  scheduleSave();
}

async function onDelete() {
  if (templates.value.length <= 1) return;
  const ok = await showStConfirm({
    title: 'Delete Template',
    message: `Delete template "${activeTemplate.value?.name}"? This cannot be undone.`,
    confirmText: 'Delete',
    type: 'danger'
  });
  if (ok) deleteTemplate();
}

async function onReset() {
  const ok = await showStConfirm({
    title: 'Reset Layout',
    message: `Reset "${activeTemplate.value?.name}" to factory defaults? All layer edits will be lost.`,
    confirmText: 'Reset',
    type: 'warning'
  });
  if (ok) resetTemplateDefaults();
}

function exportMainJson() {
  const t = activeTemplate.value;
  if (!t) return;
  const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `template_${(t.name || 'template').replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importMainJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const t = activeTemplate.value;
      if (data.name) t.name = data.name;
      if (data.itemNumbers && Array.isArray(data.itemNumbers)) t.itemNumbers = data.itemNumbers;
      if (data.deviceName !== undefined) t.deviceName = data.deviceName;
      t.config = { ...(data.config || { widthMm: 35, heightMm: 22, dpi: 203 }) };
      t.elements_en = JSON.parse(JSON.stringify(data.elements_en || data.elements || DEFAULT_ELEMENTS_EN));
      t.elements_cn = JSON.parse(JSON.stringify(data.elements_cn || data.elements || DEFAULT_ELEMENTS_CN));
      if (data.subTemplates && Array.isArray(data.subTemplates)) {
        t.subTemplates = JSON.parse(JSON.stringify(data.subTemplates));
      }
      rawItemNumbersText.value = (t.itemNumbers || []).join(', ');
      scheduleSave();
      await flushTemplateSave();
      showStAlert(`Layout imported into "${t.name}".`, 'Imported', 'success');
    } catch (err) {
      showStAlert('Failed to parse JSON: ' + err.message, 'Import Error', 'danger');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function onPasteEzpx() {
  const xml = window.prompt('Paste EZPX XML text to create a new template:');
  if (!xml || !xml.trim()) return;
  try {
    const parsed = parseEzpxXmlToTemplate(xml.trim(), 'Pasted EZPX Template');
    if (parsed && parsed.elements_en?.length) {
      parsed.id = 'tpl_' + Math.random().toString(36).substr(2, 9);
      parsed.itemNumbers = [];
      parsed.subTemplates = [];
      templates.value.push(parsed);
      setActiveTemplate(parsed.id);
      scheduleSave();
      showStAlert(`Created template "${parsed.name}" (${parsed.elements_en.length} elements).`, 'EZPX Paste', 'success');
    } else {
      showStAlert('Could not parse elements from the pasted EZPX.', 'Paste Failed', 'warning');
    }
  } catch (err) {
    showStAlert('Failed to parse EZPX XML: ' + err.message, 'Paste Error', 'danger');
  }
}

onMounted(async () => {
  if (!templatesLoaded.value) await loadTemplates();
});
</script>

<style scoped>
.tpl-page {
  padding: 0;
  font-family: inherit;
}

.tpl-page-header {
  margin-bottom: 14px;
}

.tpl-page-header h2 {
  margin: 0;
  color: #ffffff;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}

.tpl-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 20px;
  align-items: start;
}

@media (max-width: 900px) {
  .tpl-layout { grid-template-columns: 1fr; }
}

/* ── List ── */
.tpl-list-pane {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.tpl-search {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: none;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.9rem;
  outline: none;
}

.tpl-list {
  max-height: 60vh;
  overflow-y: auto;
}

.tpl-item {
  padding: 10px 12px;
  border-bottom: 1px solid #f0f2f5;
  cursor: pointer;
  transition: background 0.12s ease;
}

.tpl-item:hover { background: #f0f9ff; }
.tpl-item.selected { background: #ebf8ff; border-left: 3px solid #3182ce; }

.tpl-item-name { font-weight: 600; color: #2d3748; font-size: 0.92rem; }
.tpl-item.selected .tpl-item-name { color: #2b6cb0; }
.tpl-item-items { font-size: 0.78rem; color: #718096; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tpl-item-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 0.75rem; color: #a0aec0; }
.sub-badge { background: #553c9a; color: #fff; border-radius: 10px; padding: 1px 8px; font-size: 0.7rem; font-weight: 600; }

.tpl-empty {
  padding: 20px;
  text-align: center;
  color: #a0aec0;
  font-size: 0.85rem;
}
.tpl-empty.big { padding: 60px 20px; font-size: 1rem; }
.tpl-empty.small { padding: 12px; }

/* ── Edit ── */
.tpl-edit-pane {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border-bottom: 1px solid #e2e8f0;
  background: #f7fafc;
}

.card-title { font-weight: 700; color: #2d3748; font-size: 0.92rem; }

.card-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

.card-body { padding: 12px 14px; }
.card-body.tight { padding: 10px 14px; }

.field-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 12px;
  margin-bottom: 10px;
}

@media (max-width: 600px) {
  .field-grid-2 { grid-template-columns: 1fr; }
}

.field-col label,
.field-col-size label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 4px;
}

.field-col input[type="text"],
.field-col input[type="number"],
.sub-name-compact,
.sub-dims-compact input,
.sub-dims-compact select {
  padding: 6px 9px;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.88rem;
  width: 100%;
  box-sizing: border-box;
}

.field-row-tight {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.field-col-size {
  display: flex;
  flex-direction: column;
}

.dims-inputs {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: nowrap;
  white-space: nowrap;
}
.dims-inputs input {
  width: 52px;
  padding: 5px 6px;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.85rem;
  text-align: center;
}
.dims-inputs select {
  padding: 5px 6px;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.85rem;
}

.dim-sep { color: #a0aec0; font-weight: bold; flex-shrink: 0; }
.dim-unit { color: #718096; font-size: 0.8rem; flex-shrink: 0; margin-right: 4px; }
.field-row-actions-right {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.inline-card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/* ── Sub-templates compact rows ── */
.sub-row-compact {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid #edf2f7;
  border-radius: 6px;
  margin-bottom: 6px;
  background: #fafbfc;
}
.sub-name-compact { flex: 1; min-width: 120px; }
.sub-dims-compact { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.sub-dims-compact input { width: 55px !important; }
.sub-dims-compact select { width: 68px !important; }

.mini-btn {
  padding: 5px 10px;
  font-size: 0.78rem;
  font-weight: 600;
  background: #edf2f7;
  color: #2d3748;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.mini-btn:hover { background: #e2e8f0; }
.mini-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.mini-btn.danger { color: #c53030; border-color: #fed7d7; background: #fff5f5; }
.mini-btn.danger:hover { background: #fed7d7; }

.open-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 2px; }

.primary-btn {
  background: #6b46c1 !important;
  color: #fff !important;
  border: none !important;
  padding: 10px 20px !important;
  border-radius: 8px !important;
  font-size: 0.92rem !important;
  font-weight: 600 !important;
  cursor: pointer;
  width: auto !important;
  box-shadow: none !important;
  transition: background 0.15s ease;
}
.primary-btn:hover { background: #553c9a !important; }

.ghost-btn {
  background: transparent !important;
  color: #fff !important;
  border: 1px solid rgba(255, 255, 255, 0.4) !important;
  padding: 10px 18px !important;
  border-radius: 8px !important;
  font-size: 0.88rem !important;
  font-weight: 600 !important;
  cursor: pointer;
  width: auto !important;
  box-shadow: none !important;
}
.ghost-btn:hover { background: rgba(255, 255, 255, 0.12) !important; }
</style>
