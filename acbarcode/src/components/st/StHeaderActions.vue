<template>
  <div class="st-header-actions">
    <!-- LEFT: Compact SN Range Inputs -->
    <div class="st-header-left">
      <div class="sn-input-group">
        <label for="st-sn-input" class="sn-label">SN:</label>
        <input 
          id="st-sn-input"
          type="text" 
          :value="modelValue" 
          @input="$emit('update:modelValue', $event.target.value)"
          placeholder="1000 1000" 
          class="sn-input"
        />
        <label for="st-sn-end-input" class="sn-label end-label">End:</label>
        <input 
          id="st-sn-end-input"
          type="text" 
          :value="endValue" 
          @input="$emit('update:endValue', $event.target.value)"
          placeholder="1000 1000" 
          class="sn-input sn-input-end"
        />
        <label for="st-options-input" class="sn-label opt-label">Opt:</label>
        <input 
          id="st-options-input"
          type="text" 
          :value="optionsValue" 
          @input="$emit('update:optionsValue', $event.target.value)"
          placeholder="A1410, A1411" 
          class="sn-input options-input"
        />
        <span v-if="rangeCount > 1" class="range-badge" title="Total labels in this batch">
          📦 {{ rangeCount }} Labels
        </span>
      </div>
    </div>

    <!-- RIGHT: Sub-Template Dropdown & Template Back Button -->
    <div class="st-header-right">
      <div v-if="activeTemplate" class="template-controls">
        <span class="template-pill" :title="'Template: ' + activeTemplate.name">
          <span class="pill-icon">📄</span>
          <span class="pill-text">{{ activeTemplate.name }}</span>
        </span>

        <div class="subtemplate-select-group">
          <label for="subtemplate-select" class="sub-label">Label:</label>
          <select 
            id="subtemplate-select"
            class="subtemplate-dropdown"
            :value="activeSubTemplateId || ''"
            @change="$emit('update:activeSubTemplateId', $event.target.value)"
          >
            <option value="">
              Main ({{ activeTemplate.config?.widthMm }}×{{ activeTemplate.config?.heightMm }}mm)
            </option>
            <option 
              v-for="sub in activeTemplate.subTemplates || []" 
              :key="sub.id" 
              :value="sub.id"
            >
              {{ sub.name }} ({{ sub.config?.widthMm }}×{{ sub.config?.heightMm }}mm)
            </option>
          </select>
        </div>
      </div>

      <button 
        type="button" 
        class="template-mgr-btn" 
        @click="$emit('open-templates')"
        title="Back to Template Manager"
      >
        ← Templates
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  endValue: {
    type: String,
    default: ''
  },
  optionsValue: {
    type: String,
    default: ''
  },
  rangeCount: {
    type: Number,
    default: 1
  },
  activeTemplate: {
    type: Object,
    default: null
  },
  activeSubTemplateId: {
    type: String,
    default: ''
  }
});

defineEmits([
  'update:modelValue',
  'update:endValue',
  'update:optionsValue',
  'update:activeSubTemplateId',
  'fetch-odoo',
  'open-odoo-modal',
  'open-templates'
]);
</script>

<style scoped>
.st-header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  padding: 8px 14px;
}

.st-header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.st-header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.sn-input-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.sn-label {
  font-weight: 600;
  font-size: 0.85rem;
  color: #ffffff;
  white-space: nowrap;
}

.sn-input {
  padding: 0.4rem 0.55rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.85rem;
  width: 95px;
  background: #ffffff;
  color: #2d3748;
}

.sn-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3);
}

.end-label, .opt-label {
  margin-left: 0.2rem;
}

.sn-input-end {
  width: 95px;
}

.options-input {
  width: 110px;
}

.range-badge {
  background: #ebf8ff;
  color: #2b6cb0;
  border: 1px solid #bee3f8;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.25rem 0.55rem;
  border-radius: 16px;
  white-space: nowrap;
}

.template-controls {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.template-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 6px;
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 600;
  max-width: 180px;
}

.pill-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtemplate-select-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.sub-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
}

.subtemplate-dropdown {
  padding: 0.4rem 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.95);
  color: #2d3748;
  cursor: pointer;
  max-width: 220px;
}

.subtemplate-dropdown:focus {
  outline: none;
  border-color: #6b46c1;
  box-shadow: 0 0 0 2px rgba(107, 70, 193, 0.3);
}

.template-mgr-btn {
  background: #6b46c1 !important;
  color: white !important;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 0.45rem 0.9rem !important;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15) !important;
  width: auto !important;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.template-mgr-btn:hover {
  background: #553c9a !important;
  transform: translateY(-1px);
}
</style>
