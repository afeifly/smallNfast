<template>
  <div class="editor-card template-manager-card">
    <div class="editor-card-header">
      <h3>📑 Label Template Manager</h3>
      <span class="element-count-badge">{{ templates.length }} Saved Templates</span>
    </div>

    <div class="form-row template-select-row">
      <div class="form-group flex-2">
        <label>Select Template</label>
        <select :value="activeTemplateId" @change="$emit('update:activeTemplateId', $event.target.value)">
          <option v-for="t in templates" :key="t.id" :value="t.id">
            {{ t.name }} {{ t.itemNumbers && t.itemNumbers.length ? `[${t.itemNumbers.join(', ')}]` : '' }}
          </option>
        </select>
      </div>
      <div class="form-group flex-1 action-btns-col">
        <label>&nbsp;</label>
        <button type="button" class="btn-secondary" @click="$emit('create-new')">➕ New</button>
      </div>
    </div>

    <div v-if="activeTemplate" class="template-details-section">
      <div class="form-row">
        <div class="form-group flex-2">
          <label>Template Name</label>
          <input 
            type="text" 
            v-model="activeTemplate.name" 
            placeholder="e.g. Standard Flow Sensor" 
            @input="$emit('save-templates')" 
          />
        </div>
        <div class="form-group flex-1">
          <label>Language Variant</label>
          <div class="lang-switch-group">
            <button 
              type="button" 
              class="lang-btn" 
              :class="{ active: activeLang === 'EN' }" 
              @click="$emit('update:activeLang', 'EN')"
            >
              🇬🇧 EN
            </button>
            <button 
              type="button" 
              class="lang-btn" 
              :class="{ active: activeLang === 'CN' }" 
              @click="$emit('update:activeLang', 'CN')"
            >
              🇨🇳 CN
            </button>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label>Mapped Item Numbers / SKUs (Auto-Match from Odoo)</label>
        <input 
          type="text" 
          v-model="itemNumbersModel" 
          placeholder="e.g. S695 4035, S695 4036, S403" 
        />
        <span class="field-hint">When Odoo serial lookup matches any of these Item Numbers, this template loads automatically.</span>
      </div>

      <div class="template-action-toolbar">
        <button type="button" class="mini-action-btn" @click="$emit('duplicate')">📋 Duplicate</button>
        <button type="button" class="mini-action-btn danger" @click="$emit('delete')" :disabled="templates.length <= 1">🗑️ Delete</button>
        <button type="button" class="mini-action-btn" @click="$emit('reset-defaults')">🔄 Reset Layout</button>
        <button type="button" class="mini-action-btn" @click="$emit('export-json')">📤 Backup JSON</button>
        <label class="mini-action-btn import-btn">
          📥 Restore
          <input type="file" accept=".json" @change="$emit('import-json', $event)" style="display:none;" />
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  templates: { type: Array, required: true },
  activeTemplateId: { type: String, required: true },
  activeTemplate: { type: Object, default: null },
  activeLang: { type: String, default: 'EN' }
});

const emit = defineEmits([
  'update:activeTemplateId',
  'update:activeLang',
  'create-new',
  'duplicate',
  'delete',
  'reset-defaults',
  'export-json',
  'import-json',
  'save-templates'
]);

const itemNumbersModel = computed({
  get() {
    return props.activeTemplate && props.activeTemplate.itemNumbers ? props.activeTemplate.itemNumbers.join(', ') : '';
  },
  set(val) {
    if (props.activeTemplate) {
      props.activeTemplate.itemNumbers = val.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
      emit('save-templates');
    }
  }
});
</script>

<style scoped>
.template-manager-card {
  border-left: 4px solid #3182ce;
  background: #f7fafc;
}
.template-select-row {
  margin-bottom: 0.75rem;
}
.flex-2 { flex: 2; }
.flex-1 { flex: 1; }
.action-btns-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.lang-switch-group {
  display: flex;
  gap: 4px;
  background: #edf2f7;
  padding: 3px;
  border-radius: 6px;
  border: 1px solid #cbd5e0;
}
.lang-btn {
  flex: 1;
  padding: 6px 10px;
  border: none;
  background: transparent;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.2s ease;
}
.lang-btn.active {
  background: #3182ce;
  color: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.field-hint {
  display: block;
  font-size: 0.75rem;
  color: #718096;
  margin-top: 4px;
}
.template-action-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e2e8f0;
}
.mini-action-btn {
  padding: 5px 10px;
  font-size: 0.8rem;
  font-weight: 500;
  background: #edf2f7;
  color: #2d3748;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease;
}
.mini-action-btn:hover { background: #e2e8f0; }
.mini-action-btn.danger { color: #c53030; border-color: #feb2b2; }
.mini-action-btn.danger:hover { background: #fff5f5; }
.import-btn input[type="file"] { display: none; }
</style>
