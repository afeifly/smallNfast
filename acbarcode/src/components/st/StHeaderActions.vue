<template>
  <div class="st-header-actions">
    <!-- LEFT: Compact Inputs (SN, Prod, Opt, CSTM) -->
    <div class="st-header-left">
      <div class="sn-input-group">
        <!-- 1. Fixed SN badge (takes minimal space) -->
        <span class="sn-fixed-pill" title="Preview Serial Number">
          <span class="sn-pill-label">SN:</span>
          <span class="sn-pill-val">{{ modelValue || '12345678' }}</span>
        </span>

        <!-- 2. Prod (small width, default 'S695 4120') -->
        <label for="st-product-select" class="sn-label prod-label">Prod:</label>
        <select
          v-if="availableProducts.length > 0"
          id="st-product-select"
          class="sn-input prod-dropdown"
          :value="productValue || 'S695 4120'"
          @change="$emit('update:productValue', $event.target.value)"
          title="Active product / item number"
        >
          <option v-if="productValue && !availableProducts.includes(productValue)" :value="productValue">
            {{ productValue }}
          </option>
          <option v-for="p in availableProducts" :key="p" :value="p">{{ p }}</option>
        </select>
        <input 
          v-else
          id="st-product-input"
          type="text" 
          :value="productValue" 
          @input="$emit('update:productValue', $event.target.value)"
          placeholder="S695 4120" 
          class="sn-input prod-input"
          title="Active product / item number"
        />

        <!-- 3. Opt (compact) -->
        <label for="st-options-input" class="sn-label opt-label">Opt:</label>
        <input 
          id="st-options-input"
          type="text" 
          :value="optionsValue" 
          @input="$emit('update:optionsValue', $event.target.value)"
          placeholder="A1410..." 
          class="sn-input options-input"
          title="Option codes (e.g. A1410, A1411)"
        />

        <!-- 4. CSTM Trigger Button & Dropdown Dialog -->
        <div class="cstm-control-wrapper">
          <button 
            type="button" 
            class="cstm-trigger-btn"
            :class="{ active: isCstmPopoverOpen, 'has-active': hasActiveCustomVars }"
            @click="isCstmPopoverOpen = !isCstmPopoverOpen"
            title="Configure Option / Custom Variables (e.g. option_a, option_b)"
          >
            <span class="cstm-btn-icon">⚡</span>
            <span class="cstm-btn-text">CSTM</span>
            <span v-if="activeCustomVarsCount > 0" class="cstm-active-count">
              {{ activeCustomVarsCount }}
            </span>
            <span v-else-if="detectedOptionVars && detectedOptionVars.length > 0" class="cstm-detected-count">
              {{ detectedOptionVars.length }}
            </span>
          </button>

          <!-- Wide Dropdown Dialog for option variables -->
          <div v-if="isCstmPopoverOpen" class="cstm-popover" @click.stop>
            <div class="cstm-popover-header">
              <div class="cstm-popover-title-row">
                <span class="cstm-popover-icon">⚙️</span>
                <span class="cstm-popover-title">Option Variables</span>
                <span class="cstm-popover-sub">({{ allConfigurableVars.length }})</span>
              </div>
              <div class="cstm-popover-actions">
                <button 
                  v-if="hasActiveCustomVars" 
                  type="button" 
                  class="cstm-clear-btn" 
                  @click="clearAllCustomVars" 
                  title="Clear all variable values"
                >
                  Clear All
                </button>
                <button type="button" class="cstm-popover-close" @click="isCstmPopoverOpen = false">×</button>
              </div>
            </div>

            <div class="cstm-popover-body">
              <p v-if="allConfigurableVars.length === 0" class="cstm-empty-hint">
                No <code>&#123;&#123;option_xxx&#125;&#125;</code> variables detected in this template yet. Add one below to test:
              </p>

              <!-- List of variables with generous full-width display -->
              <div v-for="v in allConfigurableVars" :key="v" class="cstm-var-row">
                <div class="cstm-var-label-col" :title="`Variable {{${v}}}`">
                  <code class="cstm-var-code">&#123;&#123;{{ v }}&#125;&#125;</code>
                </div>
                <div class="cstm-var-input-col">
                  <input 
                    type="text" 
                    :value="getVarValue(v)" 
                    @input="setVarValue(v, $event.target.value)"
                    :placeholder="`Enter value for ${v}...`"
                    class="cstm-var-val-input"
                  />
                  <button 
                    v-if="getVarValue(v)" 
                    type="button" 
                    class="cstm-var-val-clear" 
                    @click="setVarValue(v, '')"
                    title="Clear this variable"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <!-- Quick Add Manual Variable Row -->
              <div class="cstm-add-row">
                <input 
                  type="text" 
                  v-model="newVarName" 
                  placeholder="+ Add option_xxx (e.g. option_c)"
                  class="cstm-new-var-input"
                  @keydown.enter.prevent="addNewVar"
                />
                <button type="button" class="cstm-add-btn" @click="addNewVar" :disabled="!newVarName.trim()">
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        <span v-if="rangeCount > 1" class="range-badge" title="Total labels in this batch">
          📦 {{ rangeCount }} Labels
        </span>
      </div>
    </div>

    <!-- RIGHT: Template & Controls -->
    <div class="st-header-right">
      <div v-if="activeTemplate" class="template-controls">
        <span class="template-pill" :title="'Template: ' + activeTemplate.name">
          <span class="pill-icon">📄</span>
          <span class="pill-text">{{ activeTemplate.name }}</span>
        </span>

        <!-- Locked / Read-Only icon button -->
        <button
          v-if="isLocked"
          type="button"
          class="header-lock-icon-btn"
          @click="$emit('unlock-requested')"
          title="Locked (Read-Only). Click to unlock with admin password."
        >
          🔒
        </button>

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
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  endValue: {
    type: String,
    default: ''
  },
  customVarsValue: {
    type: String,
    default: ''
  },
  detectedOptionVars: {
    type: Array,
    default: () => []
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
  },
  productValue: {
    type: String,
    default: ''
  },
  availableProducts: {
    type: Array,
    default: () => []
  },
  isLocked: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'update:modelValue',
  'update:endValue',
  'update:customVarsValue',
  'update:optionsValue',
  'update:productValue',
  'update:activeSubTemplateId',
  'fetch-odoo',
  'open-odoo-modal',
  'open-templates',
  'unlock-requested'
]);

const isCstmPopoverOpen = ref(false);
const newVarName = ref('');

const allConfigurableVars = computed(() => {
  const set = new Set(props.detectedOptionVars || []);
  const map = parseVars(props.customVarsValue);
  Object.keys(map).forEach(k => {
    if (!k) return;
    set.add(k);
  });
  return Array.from(set);
});

const activeCustomVarsCount = computed(() => {
  const map = parseVars(props.customVarsValue);
  return Object.values(map).filter(v => v !== '' && v !== undefined && v !== null).length;
});

const hasActiveCustomVars = computed(() => activeCustomVarsCount.value > 0);

function clearAllCustomVars() {
  emit('update:customVarsValue', '');
}

function addNewVar() {
  const trimmed = newVarName.value.trim();
  if (!trimmed) return;
  setVarValue(trimmed, '');
  newVarName.value = '';
}

function parseVars(str) {
  const map = {};
  if (!str || typeof str !== 'string') return map;
  const parts = str.split(/[,;\n]+/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=') !== -1 ? trimmed.indexOf('=') : trimmed.indexOf(':');
    if (eqIdx !== -1) {
      const k = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (k) map[k] = val;
    } else {
      map[trimmed] = '1';
    }
  }
  return map;
}

function getVarValue(v) {
  const map = parseVars(props.customVarsValue);
  return map[v] !== undefined ? map[v] : (map[v.toLowerCase()] || '');
}

function setVarValue(v, val) {
  const map = parseVars(props.customVarsValue);
  if (val === '') {
    delete map[v];
    delete map[v.toLowerCase()];
  } else {
    map[v] = val;
  }
  const pairs = [];
  const seen = new Set();
  for (const [k, vVal] of Object.entries(map)) {
    const lower = k.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    pairs.push(`${k}=${vVal}`);
  }
  emit('update:customVarsValue', pairs.join(', '));
}
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

.end-label, .cstm-label, .opt-label, .prod-label {
  margin-left: 0.2rem;
}

.sn-fixed-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 6px;
  padding: 0.32rem 0.55rem;
  font-size: 0.8rem;
  color: #ffffff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.sn-pill-label {
  font-weight: 700;
  color: #cbd5e0;
  font-size: 0.74rem;
}

.sn-pill-val {
  font-weight: 600;
  color: #ffffff;
}

.cstm-control-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.cstm-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.32rem 0.65rem;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 6px;
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1.2;
}

.cstm-trigger-btn:hover, .cstm-trigger-btn.active {
  background: #667eea;
  border-color: #5a67d8;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.35);
}

.cstm-trigger-btn.has-active {
  background: rgba(72, 187, 120, 0.25);
  border-color: #48bb78;
  color: #e6fffa;
}

.cstm-active-count {
  background: #38a169;
  color: #ffffff;
  font-size: 0.68rem;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 10px;
  line-height: 1.2;
}

.cstm-detected-count {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 10px;
  line-height: 1.2;
}

.cstm-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 1000;
  background: #ffffff;
  border: 1px solid #cbd5e0;
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  width: 400px;
  max-width: 90vw;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: popoverFadeIn 0.15s ease;
}

@keyframes popoverFadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.cstm-popover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #edf2f7;
  padding-bottom: 8px;
}

.cstm-popover-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cstm-popover-icon {
  font-size: 0.95rem;
}

.cstm-popover-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #1a202c;
}

.cstm-popover-sub {
  font-size: 0.78rem;
  font-weight: 600;
  color: #718096;
}

.cstm-popover-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cstm-clear-btn {
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.72rem;
  color: #e53e3e;
  padding: 2px 7px;
  cursor: pointer;
  font-weight: 600;
}

.cstm-clear-btn:hover {
  background: #fff5f5;
  border-color: #feb2b2;
}

.cstm-popover-close {
  background: transparent;
  border: none;
  font-size: 1.2rem;
  line-height: 1;
  color: #a0aec0;
  cursor: pointer;
  padding: 0 4px;
}

.cstm-popover-close:hover {
  color: #4a5568;
}

.cstm-popover-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
  padding-right: 2px;
}

.cstm-empty-hint {
  margin: 0;
  font-size: 0.8rem;
  color: #718096;
  line-height: 1.4;
  background: #f7fafc;
  padding: 8px 10px;
  border-radius: 6px;
}

.cstm-empty-hint code {
  color: #3182ce;
  font-weight: 600;
}

.cstm-var-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cstm-var-label-col {
  min-width: 140px;
  max-width: 170px;
  flex-shrink: 0;
}

.cstm-var-code {
  display: inline-block;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  padding: 4px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.78rem;
  color: #2b6cb0;
  font-weight: 600;
  word-break: break-word;
  line-height: 1.3;
}

.cstm-var-input-col {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.cstm-var-val-input {
  width: 100%;
  padding: 5px 24px 5px 8px;
  font-size: 0.82rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  color: #2d3748;
  background: #ffffff;
  outline: none;
  box-sizing: border-box;
}

.cstm-var-val-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.25);
}

.cstm-var-val-clear {
  position: absolute;
  right: 5px;
  background: transparent;
  border: none;
  font-size: 0.75rem;
  color: #a0aec0;
  cursor: pointer;
  padding: 2px 4px;
}

.cstm-var-val-clear:hover {
  color: #e53e3e;
}

.cstm-add-row {
  display: flex;
  gap: 6px;
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
}

.cstm-new-var-input {
  flex: 1;
  padding: 4px 8px;
  font-size: 0.78rem;
  border: 1px solid #cbd5e0;
  border-radius: 5px;
  color: #4a5568;
  outline: none;
}

.cstm-new-var-input:focus {
  border-color: #667eea;
}

.cstm-add-btn {
  padding: 4px 12px;
  background: #edf2f7;
  border: 1px solid #cbd5e0;
  border-radius: 5px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cstm-add-btn:hover:not(:disabled) {
  background: #667eea;
  color: #ffffff;
  border-color: #5a67d8;
}

.sn-input-end {
  width: 95px;
}

.options-input {
  width: 88px;
  font-size: 0.8rem;
  padding: 0.35rem 0.45rem;
}

.prod-dropdown, .prod-input {
  width: 96px;
  font-size: 0.8rem;
  padding: 0.35rem 0.45rem;
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
  gap: 0.5rem;
  flex-wrap: wrap;
}

.template-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.32rem 0.55rem;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 6px;
  color: #ffffff;
  font-size: 0.82rem;
  font-weight: 600;
  max-width: 140px;
}

.pill-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-lock-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #f59e0b;
  border-radius: 6px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.header-lock-icon-btn:hover {
  background: #fde68a;
  color: #78350f;
  transform: scale(1.08);
  box-shadow: 0 2px 6px rgba(245, 158, 11, 0.3);
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
