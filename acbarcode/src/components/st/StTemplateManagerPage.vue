<template>
  <div class="tpl-page">
    <div class="tpl-page-header">
      <h2>Template Manager</h2>
      <p class="tpl-page-sub">
        Templates are matched by item number and used by the ST Label designer. A template can have
        one level of sub-templates (extra label designs that share the same product / options / serial data).
      </p>
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
              <div class="field-row">
                <label>Template Name</label>
                <input type="text" :value="activeTemplate.name" @input="activeTemplate.name = $event.target.value; scheduleSave()" />
              </div>
              <div class="field-row">
                <label>Item Numbers / SKUs</label>
                <input type="text" :value="itemNumbersText" @input="onItemNumbersInput" placeholder="e.g. S695 4035, S695 4036, S403" />
                <span class="hint">Comma-separated. When a product / serial matches any of these, this template is used.</span>
              </div>
              <div class="field-row">
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
              <div class="card-actions bottom">
                <button type="button" class="mini-btn" @click="exportMainJson">📤 Export JSON</button>
                <label class="mini-btn">
                  📥 Import JSON
                  <input type="file" accept=".json" style="display:none" @change="importMainJson" />
                </label>
              </div>
            </div>
          </div>

          <!-- Sub-templates -->
          <div class="card">
            <div class="card-head">
              <span class="card-title">Sub-Templates ({{ subCount(activeTemplate) }})</span>
              <button type="button" class="mini-btn" @click="addSubTemplate">＋ Add Sub-Template</button>
            </div>
            <div class="card-body">
              <p class="hint">
                Sub-templates are extra labels for the same data — e.g. an outer packaging label, an option board
                label. Each prints alongside the main label and has its own size / design. One level only.
              </p>
              <div v-if="subCount(activeTemplate) === 0" class="tpl-empty small">No sub-templates yet.</div>
              <div v-for="sub in activeTemplate.subTemplates" :key="sub.id" class="sub-row">
                <div class="sub-row-main">
                  <input type="text" :value="sub.name" @input="sub.name = $event.target.value; scheduleSave()" class="sub-name" />
                  <div class="sub-dims">
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
import { ref, computed, onMounted } from 'vue';
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

const itemNumbersText = computed(() => (activeTemplate.value?.itemNumbers || []).join(', '));

function subCount(t) {
  return Array.isArray(t?.subTemplates) ? t.subTemplates.length : 0;
}

function selectTemplate(id) {
  setActiveTemplate(id);
}

function onItemNumbersInput(e) {
  const t = activeTemplate.value;
  if (!t) return;
  t.itemNumbers = e.target.value.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
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
      if (!t) return;
      t.config = { ...(data.config || { widthMm: 35, heightMm: 22, dpi: 203 }) };
      t.elements_en = JSON.parse(JSON.stringify(data.elements_en || data.elements || DEFAULT_ELEMENTS_EN));
      t.elements_cn = JSON.parse(JSON.stringify(data.elements_cn || data.elements || DEFAULT_ELEMENTS_CN));
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
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  font-family: 'Roboto', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.tpl-page-header h2 {
  margin: 0 0 4px;
  color: #fff;
  font-size: 1.5rem;
  font-weight: 600;
}

.tpl-page-sub {
  margin: 0 0 20px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.9rem;
  max-width: 780px;
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
  gap: 16px;
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
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #f7fafc;
}

.card-title { font-weight: 700; color: #2d3748; font-size: 0.95rem; }

.card-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.card-actions.bottom { margin-top: 14px; }

.card-body { padding: 16px; }

.field-row { margin-bottom: 12px; }
.field-row label { display: block; font-size: 0.8rem; font-weight: 600; color: #4a5568; margin-bottom: 4px; }
.field-row input[type="text"],
.field-row input[type="number"],
.field-row select,
.sub-name,
.sub-dims input,
.sub-dims select {
  padding: 7px 10px;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;
}
.field-row input[type="number"], .sub-dims input { width: 70px; }

.hint { display: block; font-size: 0.74rem; color: #718096; margin-top: 4px; }

.dims-inputs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dim-sep { color: #a0aec0; }
.dim-unit { color: #718096; font-size: 0.82rem; }

.sub-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid #edf2f7;
  border-radius: 8px;
  margin-bottom: 8px;
}
.sub-row-main { flex: 1; }
.sub-name { margin-bottom: 6px; }
.sub-dims { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sub-dims input { width: 60px !important; }
.sub-dims select { width: 70px !important; }

.mini-btn {
  padding: 6px 12px;
  font-size: 0.8rem;
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

.open-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 4px; }

.primary-btn {
  background: #6b46c1 !important;
  color: #fff !important;
  border: none !important;
  padding: 12px 24px !important;
  border-radius: 8px !important;
  font-size: 0.95rem !important;
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
  padding: 12px 20px !important;
  border-radius: 8px !important;
  font-size: 0.9rem !important;
  font-weight: 600 !important;
  cursor: pointer;
  width: auto !important;
  box-shadow: none !important;
}
.ghost-btn:hover { background: rgba(255, 255, 255, 0.12) !important; }
</style>
