<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('close')">
      <div class="modal-panel">

        <!-- ── Header ─────────────────────────────────────────── -->
        <div class="modal-header">
          <h2>📋 Template Manager</h2>
          <button type="button" class="close-btn" @click="$emit('close')" title="Close">✕</button>
        </div>

        <!-- ── Body ──────────────────────────────────────────── -->
        <div class="modal-body">

          <!-- TOP: Template List -->
          <div class="list-section">
            <div class="list-header">
              <span class="section-title">Templates</span>
              <button type="button" class="btn-new" @click="$emit('create-new')">
                ➕ New Template
              </button>
            </div>

            <div class="table-wrap">
              <table class="template-table">
                <thead>
                  <tr>
                    <th class="col-sel"></th>
                    <th class="col-name">Name</th>
                    <th class="col-items">Item Numbers / SKUs</th>
                    <th class="col-size">Size</th>
                    <th class="col-dpi">DPI</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="t in templates"
                    :key="t.id"
                    class="tpl-row"
                    :class="{ selected: selectedId === t.id }"
                    @click="selectedId = t.id"
                  >
                    <td class="col-sel">
                      <span class="tpl-dot" :class="{ active: selectedId === t.id }"></span>
                    </td>
                    <td class="col-name">
                      <span class="cell-text" :title="t.name">{{ t.name }}</span>
                    </td>
                    <td class="col-items">
                      <span class="cell-text muted" :title="t.itemNumbers?.join(', ')">
                        {{ t.itemNumbers?.join(', ') || '—' }}
                      </span>
                    </td>
                    <td class="col-size">{{ t.config?.widthMm }}×{{ t.config?.heightMm }}<small>mm</small></td>
                    <td class="col-dpi">{{ t.config?.dpi }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- BOTTOM: Edit Panel -->
          <div class="edit-section" v-if="selectedTemplate">
            <div class="section-title edit-title">
              Edit — <em>{{ selectedTemplate.name }}</em>
            </div>

            <div class="edit-grid">
              <!-- Template Name -->
              <div class="edit-field">
                <label>Template Name</label>
                <input
                  type="text"
                  v-model="draftName"
                  placeholder="e.g. Standard Flow Sensor"
                />
              </div>

              <!-- Item Numbers -->
              <div class="edit-field">
                <label>Item Numbers / SKUs <span class="hint">(comma-separated)</span></label>
                <input
                  type="text"
                  v-model="draftItemNumbers"
                  placeholder="e.g. S695 4035, S695 4036, S403"
                />
              </div>

              <!-- Dimensions row -->
              <div class="edit-field dim-field">
                <label>Label Size & DPI</label>
                <div class="dim-inputs">
                  <div class="dim-input-group">
                    <span class="dim-label">W (mm)</span>
                    <input type="number" step="0.1" v-model.number="draftConfig.widthMm" min="10" max="200" />
                  </div>
                  <span class="dim-sep">×</span>
                  <div class="dim-input-group">
                    <span class="dim-label">H (mm)</span>
                    <input type="number" step="0.1" v-model.number="draftConfig.heightMm" min="10" max="200" />
                  </div>
                  <div class="dim-input-group dpi-group">
                    <span class="dim-label">DPI</span>
                    <select v-model.number="draftConfig.dpi">
                      <option :value="203">203 DPI</option>
                      <option :value="300">300 DPI</option>
                      <option :value="600">600 DPI</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- Save changes -->
            <div class="save-row">
              <button type="button" class="btn-save" @click="applyChanges">
                ✅ Apply Changes
              </button>
            </div>
          </div>
        </div>

        <!-- ── Footer Action Toolbar ─────────────────────────── -->
        <div class="modal-footer">
          <div class="footer-actions">
            <button type="button" class="action-btn duplicate-btn" :disabled="!selectedTemplate" @click="$emit('duplicate')">
              📋 Duplicate
            </button>
            <button type="button" class="action-btn danger-btn" :disabled="templates.length <= 1" @click="onDeleteConfirm">
              🗑️ Delete
            </button>
            <button type="button" class="action-btn reset-btn" :disabled="!selectedTemplate" @click="onResetConfirm">
              🔄 Reset Layout
            </button>
            <button type="button" class="action-btn export-btn" @click="$emit('export-json')">
              📤 Backup JSON
            </button>
            <label class="action-btn import-btn">
              📥 Restore JSON
              <input type="file" accept=".json" style="display:none;" @change="onImport" />
            </label>
          </div>
          <button type="button" class="btn-close-footer" @click="$emit('close')">Close</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  templates: { type: Array, required: true },
  activeTemplateId: { type: String, required: true }
});

const emit = defineEmits([
  'close',
  'update:activeTemplateId',
  'update:templateField',
  'create-new',
  'duplicate',
  'delete',
  'reset-defaults',
  'export-json',
  'import-json'
]);

// Selected ID within the modal (default to the currently active template)
const selectedId = ref(props.activeTemplateId);

// When user changes selectedId, also tell the parent to switch active template
watch(selectedId, (id) => {
  emit('update:activeTemplateId', id);
});

// Sync if parent changes activeTemplateId externally
watch(() => props.activeTemplateId, (id) => {
  if (id !== selectedId.value) selectedId.value = id;
});

const selectedTemplate = computed(() =>
  props.templates.find(t => t.id === selectedId.value) || null
);

// ── Draft state for the edit form ─────────────────────
const draftName = ref('');
const draftItemNumbers = ref('');
const draftConfig = ref({ widthMm: 35, heightMm: 22, dpi: 203 });

// Populate draft whenever selected template changes
watch(selectedTemplate, (t) => {
  if (!t) return;
  draftName.value = t.name || '';
  draftItemNumbers.value = (t.itemNumbers || []).join(', ');
  draftConfig.value = { ...t.config };
}, { immediate: true });

function applyChanges() {
  if (!selectedTemplate.value) return;
  emit('update:templateField', {
    id: selectedId.value,
    name: draftName.value.trim() || selectedTemplate.value.name,
    itemNumbers: draftItemNumbers.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    config: { ...draftConfig.value }
  });
}

function onDeleteConfirm() {
  if (props.templates.length <= 1) return;
  if (confirm(`Delete template "${selectedTemplate.value?.name}"? This cannot be undone.`)) {
    emit('delete');
  }
}

function onResetConfirm() {
  if (confirm(`Reset template "${selectedTemplate.value?.name}" to default elements? All layer edits will be lost.`)) {
    emit('reset-defaults');
  }
}

function onImport(event) {
  emit('import-json', event);
  event.target.value = '';
}
</script>

<style scoped>
/* ── Backdrop & Panel ─────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.modal-panel {
  background: white;
  border-radius: 16px;
  width: 92%;
  max-width: 720px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
  animation: slideUp 0.18s ease;
  overflow: hidden;
}

@keyframes slideUp {
  from { transform: translateY(24px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

/* ── Header ─────────────────────────────────────────── */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.1rem 1.5rem;
  background: linear-gradient(135deg, #6b46c1, #553c9a);
  color: white;
  flex-shrink: 0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.close-btn {
  background: rgba(255, 255, 255, 0.15) !important;
  border: none !important;
  color: white !important;
  width: 28px !important;
  height: 28px !important;
  border-radius: 50% !important;
  cursor: pointer;
  font-size: 0.85rem !important;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
  box-shadow: none !important;
  padding: 0 !important;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3) !important;
}

/* ── Body ────────────────────────────────────────────── */
.modal-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* ── List Section ────────────────────────────────────── */
.list-section {
  padding: 1.1rem 1.5rem 0.75rem;
  border-bottom: 2px solid #edf2f7;
  flex-shrink: 0;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.section-title {
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #a0aec0;
}

.btn-new {
  background: #3182ce !important;
  color: white !important;
  border: none !important;
  padding: 0.4rem 0.85rem !important;
  border-radius: 6px !important;
  cursor: pointer;
  font-size: 0.82rem !important;
  font-weight: 600 !important;
  box-shadow: none !important;
  width: auto !important;
}

.btn-new:hover { background: #2b6cb0 !important; }

.table-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  overflow-y: auto;
  max-height: 220px;
}

.template-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.86rem;
}

.template-table thead {
  position: sticky;
  top: 0;
  z-index: 1;
}

.template-table th {
  background: #f7fafc;
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #718096;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
}

.col-sel  { width: 28px; text-align: center; padding: 0; }
.col-name { width: 28%; }
.col-items { width: auto; }
.col-size { width: 80px; text-align: center; }
.col-dpi  { width: 56px; text-align: center; }

.tpl-row {
  cursor: pointer;
  transition: background 0.1s ease;
  user-select: none;
}

.tpl-row:nth-child(even) { background: #fafafa; }

.tpl-row:hover {
  background: #f0f9ff;
}

.tpl-row.selected {
  background: #ebf8ff;
}

.template-table td {
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid #edf2f7;
  vertical-align: middle;
  overflow: hidden;
}

.tpl-row:last-child td { border-bottom: none; }

.tpl-row.selected td {
  border-bottom-color: #bee3f8;
}

.tpl-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #cbd5e0;
  transition: background 0.12s ease;
}

.tpl-dot.active { background: #3182ce; }

.cell-text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: #2d3748;
}

.tpl-row.selected .cell-text { color: #2b6cb0; }

.cell-text.muted {
  font-weight: 400;
  color: #718096;
}

.col-size, .col-dpi {
  font-size: 0.8rem;
  color: #4a5568;
  font-weight: 500;
}

.col-size small, .col-dpi small {
  font-size: 0.68rem;
  color: #a0aec0;
}

/* ── Edit Section ────────────────────────────────────── */
.edit-section {
  padding: 1.1rem 1.5rem;
  flex: 1;
}

.edit-title {
  margin-bottom: 1rem;
  color: #2d3748;
}

.edit-title em {
  font-style: normal;
  color: #6b46c1;
}

.edit-grid {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.edit-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.edit-field label {
  font-size: 0.82rem;
  font-weight: 600;
  color: #4a5568;
}

.hint {
  font-weight: 400;
  color: #a0aec0;
  font-size: 0.76rem;
}

.edit-field input[type="text"] {
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e0;
  border-radius: 7px;
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.edit-field input[type="text"]:focus {
  outline: none;
  border-color: #6b46c1;
  box-shadow: 0 0 0 3px rgba(107, 70, 193, 0.12);
}

/* Dimensions */
.dim-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.dim-input-group {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.dim-label {
  font-size: 0.78rem;
  color: #718096;
  white-space: nowrap;
}

.dim-input-group input[type="number"],
.dim-input-group select {
  padding: 0.45rem 0.6rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.88rem;
  width: 72px;
  box-sizing: border-box;
}

.dim-input-group.dpi-group input,
.dim-input-group.dpi-group select {
  width: 100px;
}

.dim-sep {
  color: #a0aec0;
  font-size: 0.9rem;
}

/* Save row */
.save-row {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

.btn-save {
  background: #6b46c1 !important;
  color: white !important;
  border: none !important;
  padding: 0.55rem 1.25rem !important;
  border-radius: 7px !important;
  font-size: 0.9rem !important;
  font-weight: 600 !important;
  cursor: pointer;
  box-shadow: none !important;
  width: auto !important;
  transition: background 0.15s ease;
}

.btn-save:hover { background: #553c9a !important; }

/* ── Footer ─────────────────────────────────────────── */
.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.9rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
  background: #fafafa;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.footer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.action-btn {
  padding: 0.4rem 0.75rem !important;
  font-size: 0.82rem !important;
  font-weight: 600 !important;
  border-radius: 6px !important;
  border: 1px solid transparent !important;
  cursor: pointer;
  box-shadow: none !important;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  width: auto !important;
  transition: all 0.12s ease;
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.duplicate-btn { background: #ebf8ff !important; color: #2b6cb0 !important; border-color: #bee3f8 !important; }
.duplicate-btn:hover:not(:disabled) { background: #bee3f8 !important; }

.danger-btn { background: #fff5f5 !important; color: #c53030 !important; border-color: #fed7d7 !important; }
.danger-btn:hover:not(:disabled) { background: #fed7d7 !important; }

.reset-btn { background: #fffff0 !important; color: #b7791f !important; border-color: #faf089 !important; }
.reset-btn:hover:not(:disabled) { background: #faf089 !important; }

.export-btn { background: #f0fff4 !important; color: #276749 !important; border-color: #c6f6d5 !important; }
.export-btn:hover:not(:disabled) { background: #c6f6d5 !important; }

.import-btn { background: #faf5ff !important; color: #553c9a !important; border-color: #e9d8fd !important; }
.import-btn:hover { background: #e9d8fd !important; }

.btn-close-footer {
  background: #edf2f7 !important;
  color: #4a5568 !important;
  border: none !important;
  padding: 0.45rem 1rem !important;
  border-radius: 6px !important;
  cursor: pointer;
  font-size: 0.85rem !important;
  font-weight: 600 !important;
  box-shadow: none !important;
  width: auto !important;
}

.btn-close-footer:hover { background: #cbd5e0 !important; }
</style>
