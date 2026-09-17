<template>
  <div class="st-header-actions">
    <!-- LEFT: Unified Variables Trigger & Popover -->
    <div class="st-header-left">
      <div class="cstm-control-wrapper" ref="varsWrapperRef">
        <button 
          type="button" 
          class="vars-trigger-btn"
          :class="{ active: isCstmPopoverOpen, 'has-active': hasActiveCustomVars || optionsValue }"
          @click="isCstmPopoverOpen = !isCstmPopoverOpen"
          title="Configure all template variables (SN, Prod, Opt, and Option Variables)"
        >
          <span class="vars-btn-icon">⚡</span>
          <span class="vars-btn-title">Variables</span>
          <span class="vars-tag vars-tag-sn" title="Serial Number">
            <span class="vars-tag-lbl">SN:</span> {{ modelValue || '12345678' }}
          </span>
          <span class="vars-tag vars-tag-prod" title="Product / Item No">
            <span class="vars-tag-lbl">Prod:</span> {{ productValue || 'S695 4120' }}
          </span>
          <span v-if="optionsValue" class="vars-tag vars-tag-opt" title="Option Codes">
            <span class="vars-tag-lbl">Opt:</span> {{ optionsValue }}
          </span>
          <span v-if="activeCustomVarsCount > 0" class="vars-active-badge" title="Active Option Variables">
            +{{ activeCustomVarsCount }}
          </span>
          <span v-else-if="detectedOptionVars && detectedOptionVars.length > 0" class="vars-detected-badge" title="Detected Option Variables">
            {{ detectedOptionVars.length }}
          </span>
          <span class="vars-caret">{{ isCstmPopoverOpen ? '▲' : '▼' }}</span>
        </button>

        <span v-if="rangeCount > 1" class="range-badge" title="Total labels in this batch">
          📦 {{ rangeCount }} Labels
        </span>

        <!-- Centered Modal Dialog for Variables & Mapping Rules -->
        <Teleport to="body">
          <transition name="modal-fade">
            <div v-if="isCstmPopoverOpen" class="st-modal-overlay">
              <div class="st-modal-container vars-modal" @click.stop>
                <!-- Modal Header -->
                <div class="st-modal-header">
                  <div class="vars-modal-title-row">
                    <span class="vars-modal-icon">⚡</span>
                    <div>
                      <h3 class="vars-modal-title">Variables &amp; Mapping Rules</h3>
                      <p class="vars-modal-subtitle">Configure Core inputs, custom Product-to-Value mapping rules, and Option variables</p>
                    </div>
                  </div>
                  <div class="vars-modal-header-actions">
                    <button 
                      v-if="hasActiveCustomVars || optionsValue" 
                      type="button" 
                      class="cstm-clear-btn" 
                      @click="resetAllVariables" 
                      title="Reset custom variables and options"
                    >
                      Reset Values
                    </button>
                    <button type="button" class="close-modal-btn" @click="isCstmPopoverOpen = false" title="Close (Esc)">✕</button>
                  </div>
                </div>

                <!-- Modal Body (Scrollable, full space) -->
                <div class="st-modal-body custom-scrollbar">
                  <!-- SECTION 1: Core Variables (SN, Prod, Opt) -->
                  <div class="vars-section-title">
                    <span>Core Variables</span>
                  </div>

                  <div class="core-vars-grid">
                    <!-- 1. Serial Number (SN) -->
                    <div class="core-var-card">
                      <div class="core-var-card-header">
                        <code class="cstm-var-code">&#123;&#123;sn&#125;&#125;</code>
                        <span class="cstm-var-alias">&#123;&#123;serial&#125;&#125;</span>
                        <span v-if="rangeCount > 1" class="cstm-range-hint" title="Total labels in batch">
                          📦 {{ rangeCount }} Labels
                        </span>
                      </div>
                      <input 
                        type="text" 
                        :value="modelValue" 
                        @input="$emit('update:modelValue', $event.target.value)"
                        placeholder="e.g. 12345678 or 1001..1005" 
                        class="cstm-var-val-input"
                        title="Serial number or range"
                      />
                    </div>

                    <!-- 2. Product / Item Number (Prod) -->
                    <div class="core-var-card">
                      <div class="core-var-card-header">
                        <code class="cstm-var-code">&#123;&#123;prod&#125;&#125;</code>
                        <span class="cstm-var-alias">&#123;&#123;product&#125;&#125;</span>
                      </div>
                      <select
                        v-if="availableProducts.length > 0"
                        class="cstm-var-val-input cstm-prod-select"
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
                        type="text" 
                        :value="productValue" 
                        @input="$emit('update:productValue', $event.target.value)"
                        placeholder="e.g. S695 4120" 
                        class="cstm-var-val-input"
                        title="Active product / item number"
                      />
                    </div>

                    <!-- 3. Options (Opt) -->
                    <div class="core-var-card">
                      <div class="core-var-card-header">
                        <code class="cstm-var-code">&#123;&#123;opt&#125;&#125;</code>
                        <span class="cstm-var-alias">&#123;&#123;options&#125;&#125;</span>
                      </div>
                      <div class="core-opt-input-wrap">
                        <input 
                          type="text" 
                          :value="optionsValue" 
                          @input="$emit('update:optionsValue', $event.target.value)"
                          placeholder="e.g. A1410, A1411..." 
                          class="cstm-var-val-input"
                          title="Option variant codes"
                        />
                        <button 
                          v-if="optionsValue" 
                          type="button" 
                          class="cstm-var-val-clear" 
                          @click="$emit('update:optionsValue', '')"
                          title="Clear options"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- SECTION 2: Mid-Variables (Product-to-Value Mapping) -->
                  <div class="vars-section-title">
                    <span>Mid-Variables (Product-to-Value Mapping Rules)</span>
                    <button 
                      v-if="!isAddingMidVar"
                      type="button" 
                      class="midvar-add-trigger-btn" 
                      @click="isAddingMidVar = true"
                      title="Create a new Product-to-Value Mid-Variable"
                    >
                      + Add Mid-Variable
                    </button>
                  </div>

                  <div class="midvar-section-desc">
                    Define custom mapping rules where multiple products map to a value (e.g. <code>Product 1, Product 2</code> ➔ <code>Value A</code>; <code>Product 3, Product 4</code> ➔ <code>Value B</code>). Then use <code>&#123;&#123;variableName&#125;&#125;</code> anywhere in label elements.
                  </div>

                  <!-- Box for adding a new mid-variable -->
                  <div v-if="isAddingMidVar" class="midvar-create-box">
                    <div class="midvar-create-header">
                      <span class="midvar-create-title">Define New Mid-Variable</span>
                      <button type="button" class="close-modal-btn" @click="isAddingMidVar = false">✕</button>
                    </div>
                    <div class="midvar-create-fields">
                      <div class="midvar-field-col">
                        <label class="midvar-mini-lbl">Variable Name:</label>
                        <input 
                          type="text" 
                          v-model="newMidVarName" 
                          placeholder="e.g. sensorName" 
                          class="cstm-var-val-input"
                          @keydown.enter.prevent="createMidVar"
                        />
                      </div>
                      <div class="midvar-field-col" style="max-width: 180px;">
                        <label class="midvar-mini-lbl">Match Against:</label>
                        <select v-model="newMidVarSource" class="cstm-var-val-input midvar-source-select">
                          <option value="prod">Product (prod)</option>
                          <option value="opt">Options (opt)</option>
                        </select>
                      </div>
                      <div class="midvar-field-col">
                        <label class="midvar-mini-lbl">Fallback Default (optional):</label>
                        <input 
                          type="text" 
                          v-model="newMidVarDefault" 
                          placeholder="e.g. S401" 
                          class="cstm-var-val-input"
                          @keydown.enter.prevent="createMidVar"
                        />
                      </div>
                    </div>
                    <div class="midvar-create-actions">
                      <button type="button" class="cstm-clear-btn" @click="isAddingMidVar = false">Cancel</button>
                      <button type="button" class="cstm-add-btn" @click="createMidVar" :disabled="!newMidVarName.trim()">
                        Create Variable &amp; Configure Rules ➔
                      </button>
                    </div>
                  </div>

                  <p v-if="midVariablesList.length === 0 && !isAddingMidVar" class="cstm-empty-hint">
                    No Mid-Variables defined yet. Click <strong>+ Add Mid-Variable</strong> to map product codes to device values (e.g. <code>S695 4120, S695 4121</code> → <code>S421</code>).
                  </p>

                  <!-- Compact List of Mid-Variables (Never cramps the main UI) -->
                  <div v-if="midVariablesList.length > 0" class="midvar-summary-list">
                    <div v-for="(mv, mvIdx) in midVariablesList" :key="mv.name || mvIdx" class="midvar-summary-card">
                      <div class="midvar-summary-info">
                        <div class="midvar-summary-top">
                          <code class="midvar-name-code">&#123;&#123;{{ mv.name }}&#125;&#125;</code>
                          <span class="midvar-source-tag">
                            {{ mv.source === 'opt' ? 'Option (opt)' : 'Product (prod)' }}
                          </span>
                          <span class="midvar-rules-count-pill">
                            {{ (mv.rules || []).length }} mapping {{ (mv.rules || []).length === 1 ? 'rule' : 'rules' }}
                          </span>
                        </div>
                        <div class="midvar-summary-bottom">
                          <span class="midvar-live-preview-label">Active value:</span>
                          <strong class="midvar-live-val-text">"{{ getMidVarLiveValue(mv) || '(none)' }}"</strong>
                          <span v-if="mv.defaultValue" class="midvar-default-pill">Fallback: "{{ mv.defaultValue }}"</span>
                        </div>
                      </div>

                      <div class="midvar-summary-actions">
                        <button 
                          type="button" 
                          class="midvar-configure-btn"
                          @click="openMidVarDetails(mv)"
                          title="Open full dialog to view and edit mapping rules"
                        >
                          ⚙️ Configure Rules (Details)
                        </button>
                        <button 
                          type="button" 
                          class="midvar-card-del-btn" 
                          @click="deleteMidVar(mvIdx)"
                          title="Delete this Mid-Variable"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- SECTION 3: Custom / Template Option Variables -->
                  <div class="vars-section-title">
                    <span>Option Variables ({{ allConfigurableVars.length }})</span>
                  </div>

                  <p v-if="allConfigurableVars.length === 0" class="cstm-empty-hint">
                    No custom <code>&#123;&#123;variable&#125;&#125;</code> detected in this template. When you use any <code>&#123;&#123;your_var&#125;&#125;</code> in an element's text or condition, it will automatically appear here.
                  </p>

                  <!-- List of custom variables in a clean 2-column grid -->
                  <div v-if="allConfigurableVars.length > 0" class="custom-vars-grid">
                    <div v-for="v in allConfigurableVars" :key="v" class="cstm-var-grid-card">
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
                  </div>
                </div>

                <!-- Modal Footer -->
                <div class="st-modal-footer">
                  <span class="modal-save-hint">✓ Rules and variables are auto-saved to the template in real time</span>
                  <button type="button" class="vars-done-btn" @click="isCstmPopoverOpen = false">Done</button>
                </div>
              </div>
            </div>
          </transition>
        </Teleport>

        <!-- Dedicated Details Dialog for Mid-Variable Rules -->
        <Teleport to="body">
          <transition name="modal-fade">
            <div v-if="editingMidVar" class="st-modal-overlay midvar-details-overlay">
              <div class="st-modal-container vars-modal midvar-details-modal" @click.stop>
                <!-- Modal Header -->
                <div class="st-modal-header">
                  <div class="vars-modal-title-row">
                    <span class="vars-modal-icon">🔀</span>
                    <div>
                      <h3 class="vars-modal-title">Mapping Rules: &#123;&#123;{{ editingMidVar.name }}&#125;&#125;</h3>
                      <p class="vars-modal-subtitle">Define product or option codes that map to dynamic output values</p>
                    </div>
                  </div>
                  <button type="button" class="close-modal-btn" @click="closeMidVarDetails" title="Close (Esc)">✕</button>
                </div>

                <!-- Modal Body (Scrollable, full space) -->
                <div class="st-modal-body custom-scrollbar">
                  <!-- Settings row: Variable Name, Source, Fallback -->
                  <div class="midvar-config-grid">
                    <div class="midvar-field-col">
                      <label class="midvar-mini-lbl">Variable Name:</label>
                      <input 
                        type="text" 
                        v-model="editingMidVar.name" 
                        @input="onRuleChange"
                        @blur="editingMidVar.name = (editingMidVar.name || '').replace(/^\{+|\}+$/g, '').trim(); onRuleChange();"
                        class="cstm-var-val-input"
                        placeholder="e.g. sensorName"
                      />
                    </div>
                    <div class="midvar-field-col" style="max-width: 200px;">
                      <label class="midvar-mini-lbl">Match Against:</label>
                      <select 
                        v-model="editingMidVar.source" 
                        class="cstm-var-val-input midvar-source-select"
                        @change="onRuleChange"
                      >
                        <option value="prod">Product Code (prod)</option>
                        <option value="opt">Option Code (opt)</option>
                      </select>
                    </div>
                    <div class="midvar-field-col">
                      <label class="midvar-mini-lbl">Fallback Default (when no rule matches):</label>
                      <input 
                        type="text" 
                        v-model="editingMidVar.defaultValue" 
                        @input="onRuleChange"
                        placeholder="e.g. S401" 
                        class="cstm-var-val-input"
                      />
                    </div>
                  </div>

                  <!-- Explanatory Guide Box -->
                  <div class="midvar-guide-box">
                    <span class="midvar-guide-bulb">💡</span>
                    <div>
                      <strong>Full Control Mapping:</strong> Define which products map to which values.
                      For example:
                      <br />• Row 1: Match <code>product 1, product 2</code> ➔ Output Value <code>Value A</code>
                      <br />• Row 2: Match <code>product 3, product 4</code> ➔ Output Value <code>Value B</code>
                      <br />Then use <code>&#123;&#123;{{ editingMidVar.name }}&#125;&#125;</code> anywhere in your label text or barcode elements.
                    </div>
                  </div>

                  <!-- Rules Table -->
                  <div class="midvar-rules-wrapper">
                    <div class="midvar-table-header">
                      <span class="midvar-th-match">Match {{ editingMidVar.source === 'opt' ? 'Option' : 'Product' }} Code(s) (comma-separated or wildcard*)</span>
                      <span class="midvar-th-arrow"></span>
                      <span class="midvar-th-val">Output Value</span>
                      <span class="midvar-th-status">Live Match</span>
                      <span class="midvar-th-del"></span>
                    </div>

                    <div class="midvar-rules-list">
                      <div v-if="!editingMidVar.rules || editingMidVar.rules.length === 0" class="midvar-no-rules-hint">
                        No mapping rules yet. Click <strong>+ Add Mapping Rule</strong> below to add your first rule.
                      </div>

                      <div 
                        v-for="(rule, rIdx) in editingMidVar.rules || []" 
                        :key="rIdx" 
                        class="midvar-rule-row"
                        :class="{ 'rule-active-match': isRuleMatching(rule, editingMidVar) }"
                      >
                        <div class="midvar-rule-match-col">
                          <div class="midvar-input-with-pick">
                            <input 
                              type="text" 
                              v-model="rule.match" 
                              @input="onRuleChange"
                              :placeholder="rIdx === 0 ? 'e.g. S695 4120, S695 4121 (product 1, 2)' : (rIdx === 1 ? 'e.g. S695 4122, S695 4123 (product 3, 4)' : 'e.g. product 5, 6 or wildcard*')" 
                              class="cstm-var-val-input midvar-rule-input"
                              title="Enter product numbers separated by commas, or wildcard *"
                            />
                            <select 
                              v-if="availableProducts.length > 0 && editingMidVar.source !== 'opt'"
                              class="midvar-quick-pick"
                              title="Append a product from the template database"
                              @change="appendProductToRule(rule, $event)"
                            >
                              <option value="" disabled selected>+ Pick</option>
                              <option v-for="p in availableProducts" :key="p" :value="p">{{ p }}</option>
                            </select>
                          </div>
                        </div>
                        <div class="midvar-rule-arrow">➔</div>
                        <div class="midvar-rule-val-col">
                          <input 
                            type="text" 
                            v-model="rule.value" 
                            @input="onRuleChange"
                            :placeholder="rIdx === 0 ? 'e.g. S421 (value A)' : (rIdx === 1 ? 'e.g. S422 (value B)' : 'e.g. value C')" 
                            class="cstm-var-val-input midvar-rule-input"
                            title="Value to output when product matches"
                          />
                        </div>
                        <div class="midvar-rule-status-col">
                          <span v-if="isRuleMatching(rule, editingMidVar)" class="midvar-matched-tag" title="Matches current active product!">
                            ● Matched
                          </span>
                          <span v-else class="midvar-unmatched-tag">
                            —
                          </span>
                        </div>
                        <button 
                          type="button" 
                          class="midvar-rule-del-btn" 
                          @click="deleteRule(editingMidVar, rIdx)"
                          title="Remove this rule"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
                      <button type="button" class="midvar-add-rule-btn" @click="addRule(editingMidVar)">
                        + Add Mapping Rule
                      </button>
                    </div>
                  </div>

                  <!-- Live Test Box -->
                  <div class="midvar-live-test-bar">
                    <span class="midvar-test-icon">🔍</span>
                    <span>
                      Active Test: 
                      <strong>{{ editingMidVar.source === 'opt' ? 'Option' : 'Product' }}</strong> = 
                      <code>{{ editingMidVar.source === 'opt' ? (optionsValue || '(none)') : (productValue || 'S695 4120') }}</code>
                      ➔ Output Value: 
                      <strong class="midvar-test-res">"{{ getMidVarLiveValue(editingMidVar) || '(none)' }}"</strong>
                    </span>
                  </div>
                </div>

                <!-- Modal Footer -->
                <div class="st-modal-footer">
                  <span class="modal-save-hint">✓ Rules auto-saved to template in real time</span>
                  <button type="button" class="vars-done-btn" @click="closeMidVarDetails">Done</button>
                </div>
              </div>
            </div>
          </transition>
        </Teleport>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { evaluateMidVariables, matchesOptionRule } from '../../utils/stOptionResolver.js';
import { scheduleSave } from '../../stores/templateStore.js';

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
const varsWrapperRef = ref(null);
const newVarName = ref('');

function handleClickOutside(e) {
  if (isCstmPopoverOpen.value && varsWrapperRef.value && !varsWrapperRef.value.contains(e.target)) {
    isCstmPopoverOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

// ── Mid-Variables (Product-to-Value Mapping) ───────────────────────────
const isAddingMidVar = ref(false);
const newMidVarName = ref('');
const newMidVarSource = ref('prod');
const newMidVarDefault = ref('');

const midVariablesList = computed(() => {
  if (!props.activeTemplate) return [];
  if (!Array.isArray(props.activeTemplate.midVariables)) {
    props.activeTemplate.midVariables = [];
  }
  // Auto-clean any existing mid-vars that might have curly braces saved
  props.activeTemplate.midVariables.forEach(mv => {
    if (mv && mv.name && (mv.name.startsWith('{') || mv.name.endsWith('}'))) {
      mv.name = mv.name.replace(/^\{+|\}+$/g, '').trim();
    }
  });
  return props.activeTemplate.midVariables;
});

const editingMidVar = ref(null);

function openMidVarDetails(mv) {
  if (mv && mv.name) {
    mv.name = mv.name.replace(/^\{+|\}+$/g, '').trim();
  }
  editingMidVar.value = mv;
}

function closeMidVarDetails() {
  if (editingMidVar.value && editingMidVar.value.name) {
    editingMidVar.value.name = editingMidVar.value.name.replace(/^\{+|\}+$/g, '').trim();
  }
  editingMidVar.value = null;
  scheduleSave();
}

function createMidVar() {
  const name = newMidVarName.value.replace(/^\{+|\}+$/g, '').trim();
  if (!name || !props.activeTemplate) return;
  if (!Array.isArray(props.activeTemplate.midVariables)) {
    props.activeTemplate.midVariables = [];
  }
  let targetVar = props.activeTemplate.midVariables.find(v => (v.name || '').replace(/^\{+|\}+$/g, '').trim().toLowerCase() === name.toLowerCase());
  if (!targetVar) {
    targetVar = {
      name,
      source: newMidVarSource.value || 'prod',
      defaultValue: newMidVarDefault.value.trim() || '',
      rules: [
        { match: '', value: '' },
        { match: '', value: '' }
      ]
    };
    props.activeTemplate.midVariables.push(targetVar);
    scheduleSave();
  }
  newMidVarName.value = '';
  newMidVarDefault.value = '';
  newMidVarSource.value = 'prod';
  isAddingMidVar.value = false;
  editingMidVar.value = targetVar;
}

function deleteMidVar(idx) {
  if (!props.activeTemplate?.midVariables) return;
  if (editingMidVar.value === props.activeTemplate.midVariables[idx]) {
    editingMidVar.value = null;
  }
  props.activeTemplate.midVariables.splice(idx, 1);
  scheduleSave();
}

function addRule(mv) {
  if (!Array.isArray(mv.rules)) mv.rules = [];
  mv.rules.push({ match: '', value: '' });
  scheduleSave();
}

function deleteRule(mv, rIdx) {
  if (!Array.isArray(mv.rules)) return;
  mv.rules.splice(rIdx, 1);
  scheduleSave();
}

function onRuleChange() {
  scheduleSave();
}

function appendProductToRule(rule, event) {
  const chosen = event?.target?.value;
  if (!chosen) return;
  const current = (rule.match || '').trim();
  if (!current) {
    rule.match = chosen;
  } else {
    const list = current.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    if (!list.includes(chosen)) {
      list.push(chosen);
      rule.match = list.join(', ');
    }
  }
  if (event?.target) {
    event.target.value = '';
  }
  scheduleSave();
}

function isRuleMatching(rule, mv) {
  if (!rule || !rule.match || !mv) return false;
  const currentVal = (mv.source === 'opt')
    ? (props.optionsValue || '')
    : (props.productValue || 'S695 4120');
  return matchesOptionRule(rule.match, currentVal);
}

function getMidVarLiveValue(mv) {
  if (!mv) return '';
  const evaluated = evaluateMidVariables([mv], {
    prod: props.productValue || 'S695 4120',
    product: props.productValue || 'S695 4120',
    opt: props.optionsValue,
    options: props.optionsValue
  });
  return evaluated[mv.name] !== undefined ? evaluated[mv.name] : (mv.defaultValue || '');
}

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

function resetAllVariables() {
  emit('update:customVarsValue', '');
  emit('update:optionsValue', '');
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

.vars-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.75rem;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 8px;
  color: #ffffff;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  line-height: 1.2;
}

.vars-trigger-btn:hover, .vars-trigger-btn.active {
  background: #667eea;
  border-color: #5a67d8;
  color: #ffffff;
  box-shadow: 0 2px 10px rgba(102, 126, 234, 0.4);
}

.vars-btn-icon {
  font-size: 0.95rem;
}

.vars-btn-title {
  font-weight: 800;
  color: #ffffff;
  font-size: 0.85rem;
  margin-right: 0.15rem;
}

.vars-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.76rem;
  color: #edf2f7;
}

.vars-tag-lbl {
  color: #cbd5e0;
  font-weight: 700;
  font-size: 0.72rem;
}

.vars-active-badge {
  background: #38a169;
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 10px;
}

.vars-detected-badge {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
}

.vars-caret {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.7);
  margin-left: 2px;
}

.cstm-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 1000;
  background: #ffffff;
  border: 1px solid #cbd5e0;
  border-radius: 10px;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.3);
  width: 640px;
  max-width: calc(100vw - 20px);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: popoverFadeIn 0.15s ease;
  box-sizing: border-box;
}

.cstm-popover-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 520px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 6px;
  box-sizing: border-box;
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
  font-size: 0.88rem;
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


.vars-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  padding-bottom: 3px;
  border-bottom: 1px solid #edf2f7;
  margin-top: 4px;
}

.vars-section-title:first-child {
  margin-top: 0;
}

.cstm-var-alias {
  display: block;
  font-size: 0.68rem;
  color: #a0aec0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  margin-top: 2px;
}

.cstm-range-hint {
  font-size: 0.74rem;
  font-weight: 700;
  color: #667eea;
  margin-left: 6px;
  white-space: nowrap;
}

.cstm-prod-select {
  cursor: pointer;
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

/* ── Mid-Variables Styles ────────────────────────────────────────────── */
.midvar-add-trigger-btn {
  margin-left: auto;
  background: transparent;
  border: 1px dashed #667eea;
  color: #667eea;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.midvar-add-trigger-btn:hover {
  background: #667eea;
  color: #ffffff;
}

.midvar-create-box {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.midvar-create-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.midvar-create-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: #2d3748;
}

.midvar-create-fields {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.midvar-create-fields .midvar-field-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.midvar-create-fields .cstm-var-val-input,
.midvar-create-fields .midvar-source-select {
  height: 32px;
  line-height: 20px;
  padding: 5px 8px;
  font-size: 0.82rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  background: #ffffff;
  box-sizing: border-box;
  color: #2d3748;
}

.midvar-create-fields .midvar-source-select {
  cursor: pointer;
}

.midvar-create-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.midvar-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.midvar-card:hover {
  border-color: #cbd5e0;
}

.midvar-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #edf2f7;
}

.midvar-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.midvar-source-select {
  font-size: 0.72rem;
  padding: 2px 6px;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  background: #ffffff;
  color: #4a5568;
  cursor: pointer;
}

.midvar-eval-badge {
  font-size: 0.75rem;
  color: #2b6cb0;
  background: #ebf8ff;
  border: 1px solid #bee3f8;
  padding: 2px 8px;
  border-radius: 4px;
}

.midvar-card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.midvar-del-btn {
  background: transparent;
  border: 1px solid #fed7d7;
  color: #e53e3e;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.midvar-del-btn:hover {
  background: #fff5f5;
  border-color: #feb2b2;
}

.midvar-card-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #ffffff;
}

.midvar-create-desc {
  font-size: 0.74rem;
  color: #718096;
  line-height: 1.4;
}

.midvar-create-desc code {
  background: #edf2f7;
  padding: 1px 4px;
  border-radius: 3px;
  color: #2b6cb0;
  font-weight: 600;
}

.midvar-field-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.midvar-sub-hint {
  font-size: 0.73rem;
  color: #718096;
  line-height: 1.4;
  margin-bottom: 2px;
}

.midvar-sub-hint code {
  background: #edf2f7;
  padding: 1px 4px;
  border-radius: 3px;
  color: #2b6cb0;
  font-weight: 600;
}

.midvar-table-header {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 18px minmax(0, 1fr) 74px 26px;
  align-items: center;
  gap: 8px;
  font-size: 0.68rem;
  font-weight: 700;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 4px 6px 4px;
  border-bottom: 1px solid #edf2f7;
  box-sizing: border-box;
  width: 100%;
}

.midvar-th-match {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.midvar-th-arrow {
  width: 18px;
}

.midvar-th-val {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.midvar-th-status {
  width: 74px;
  text-align: center;
  white-space: nowrap;
}

.midvar-th-del {
  width: 26px;
}

.midvar-no-rules-hint {
  font-size: 0.78rem;
  color: #718096;
  background: #f7fafc;
  padding: 10px 12px;
  border-radius: 6px;
  text-align: center;
  border: 1px dashed #e2e8f0;
}

.midvar-rules-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.midvar-rule-row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 18px minmax(0, 1fr) 74px 26px;
  align-items: center;
  gap: 8px;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 8px;
  box-sizing: border-box;
  width: 100%;
  transition: all 0.15s ease;
}

.midvar-rule-row.rule-active-match {
  background: #f0fff4;
  border-color: #68d391;
  box-shadow: 0 0 0 1px rgba(72, 187, 120, 0.2);
}

.midvar-rule-match-col {
  min-width: 0;
  width: 100%;
}

.midvar-input-with-pick {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  width: 100%;
}

.midvar-quick-pick {
  flex-shrink: 0;
  font-size: 0.7rem;
  padding: 3px 5px;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  background: #ffffff;
  color: #4a5568;
  cursor: pointer;
  max-width: 68px;
}

.midvar-quick-pick:hover {
  border-color: #667eea;
  color: #667eea;
}

.midvar-rule-val-col {
  min-width: 0;
  width: 100%;
}

.midvar-rule-status-col {
  width: 74px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.midvar-matched-tag {
  font-size: 0.68rem;
  font-weight: 700;
  color: #22543d;
  background: #c6f6d5;
  border: 1px solid #9ae6b4;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.midvar-unmatched-tag {
  font-size: 0.72rem;
  color: #cbd5e0;
}

.midvar-mini-lbl {
  font-size: 0.68rem;
  font-weight: 700;
  color: #718096;
  text-transform: uppercase;
}

.midvar-rule-input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  font-size: 0.8rem;
  padding: 4px 7px;
}

.midvar-rule-arrow {
  text-align: center;
  color: #a0aec0;
  font-size: 0.85rem;
  user-select: none;
}

.midvar-rule-del-btn {
  background: transparent;
  border: none;
  color: #e53e3e;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  line-height: 1;
  transition: all 0.15s ease;
  justify-self: center;
}

.midvar-rule-del-btn:hover {
  background: #fff5f5;
  color: #c53030;
}

.midvar-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px dashed #edf2f7;
}

.midvar-default-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.midvar-default-input {
  font-size: 0.8rem;
  padding: 4px 7px;
}

.midvar-add-rule-btn {
  background: #ebf8ff;
  border: 1px dashed #bee3f8;
  color: #2b6cb0;
  font-size: 0.74rem;
  font-weight: 700;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.midvar-add-rule-btn:hover {
  background: #bee3f8;
  border-color: #3182ce;
  color: #2c5282;
}

/* ==========================================================================
   Centered Teleport Modal for Variables & Mapping Rules
   ========================================================================== */
.st-modal-overlay {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.st-modal-container.vars-modal {
  background: #ffffff;
  color: #2d3748;
  width: 940px;
  max-width: 95vw;
  height: 88vh;
  max-height: 88vh;
  border-radius: 14px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.8);
}

.vars-modal .st-modal-header {
  padding: 14px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  flex-shrink: 0;
}

.vars-modal-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.vars-modal-icon {
  font-size: 1.4rem;
  background: #edf2f7;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.vars-modal-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #1a202c;
}

.vars-modal-subtitle {
  margin: 2px 0 0 0;
  font-size: 0.76rem;
  color: #718096;
}

.vars-modal-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.vars-modal .st-modal-body {
  padding: 18px 22px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.core-vars-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.core-var-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.core-var-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.core-opt-input-wrap {
  position: relative;
  width: 100%;
}

.custom-vars-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 10px;
}

.cstm-var-grid-card {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 10px;
}

.cstm-var-label-col {
  flex-shrink: 0;
}

.cstm-var-input-col {
  flex: 1;
  position: relative;
}

.vars-modal .st-modal-footer {
  padding: 12px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.modal-save-hint {
  font-size: 0.76rem;
  color: #38a169;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.vars-done-btn {
  background: #4f46e5;
  color: #ffffff;
  border: none;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 7px 22px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.vars-done-btn:hover {
  background: #4338ca;
  box-shadow: 0 2px 6px rgba(79, 70, 229, 0.35);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* ==========================================================================
   Compact Mid-Variables Summary List
   ========================================================================== */
.midvar-summary-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.midvar-summary-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.midvar-summary-card:hover {
  background: #ffffff;
  border-color: #cbd5e0;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.04);
}

.midvar-summary-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.midvar-summary-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.midvar-source-tag {
  font-size: 0.72rem;
  color: #4a5568;
  background: #edf2f7;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.midvar-rules-count-pill {
  font-size: 0.7rem;
  color: #2b6cb0;
  background: #ebf8ff;
  border: 1px solid #bee3f8;
  padding: 1px 7px;
  border-radius: 10px;
  font-weight: 600;
}

.midvar-summary-bottom {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  color: #718096;
}

.midvar-live-preview-label {
  font-size: 0.74rem;
  color: #a0aec0;
}

.midvar-live-val-text {
  color: #2b6cb0;
}

.midvar-default-pill {
  font-size: 0.7rem;
  color: #a0aec0;
  background: #ffffff;
  padding: 1px 5px;
  border: 1px dashed #cbd5e0;
  border-radius: 4px;
}

.midvar-summary-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.midvar-configure-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #ebf8ff;
  border: 1px solid #bee3f8;
  color: #2b6cb0;
  border-radius: 6px;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.midvar-configure-btn:hover {
  background: #bee3f8;
  border-color: #3182ce;
  color: #2c5282;
}

.midvar-card-del-btn {
  background: transparent;
  border: 1px solid #fed7d7;
  color: #e53e3e;
  border-radius: 6px;
  padding: 5px 8px;
  cursor: pointer;
  font-size: 0.8rem;
  line-height: 1;
  transition: all 0.15s ease;
}

.midvar-card-del-btn:hover {
  background: #fff5f5;
  border-color: #feb2b2;
}

/* ==========================================================================
   Focused Details Dialog for Mid-Variable Mapping Rules
   ========================================================================== */
.st-modal-overlay.midvar-details-overlay {
  z-index: 10050;
  background: rgba(15, 23, 42, 0.75);
}

.st-modal-container.vars-modal.midvar-details-modal {
  background: #ffffff;
  color: #2d3748;
  width: 900px;
  max-width: 95vw;
  height: 84vh;
  max-height: 84vh;
  border-radius: 14px;
  box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.9);
}

.close-modal-btn {
  background: transparent;
  border: none;
  font-size: 1.2rem;
  color: #718096;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.close-modal-btn:hover {
  background: #edf2f7;
  color: #e53e3e;
}

.midvar-details-modal .st-modal-header {
  padding: 14px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  flex-shrink: 0;
}

.midvar-details-modal .st-modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.midvar-details-modal .st-modal-footer {
  padding: 14px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.midvar-config-grid {
  display: flex;
  gap: 14px;
  align-items: flex-end;
  background: #f8fafc;
  padding: 14px 18px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.midvar-config-grid .midvar-field-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.midvar-config-grid .cstm-var-val-input,
.midvar-config-grid .midvar-source-select {
  height: 36px;
  padding: 6px 10px;
  font-size: 0.85rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  background: #ffffff;
  box-sizing: border-box;
}

.midvar-guide-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #f0fff4;
  border: 1px solid #c6f6d5;
  color: #22543d;
  font-size: 0.78rem;
  padding: 12px 16px;
  border-radius: 8px;
  line-height: 1.45;
}

.midvar-guide-bulb {
  font-size: 1.15rem;
  line-height: 1;
}

.midvar-guide-box code {
  background: rgba(255, 255, 255, 0.85);
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 700;
  color: #22543d;
  border: 1px solid #b2f5ea;
}

.midvar-rules-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
}

.midvar-details-modal .midvar-rule-row {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) 20px minmax(0, 1.1fr) 80px 28px;
  align-items: center;
  gap: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
  box-sizing: border-box;
  width: 100%;
}

.midvar-details-modal .midvar-table-header {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) 20px minmax(0, 1.1fr) 80px 28px;
  align-items: center;
  gap: 10px;
  font-size: 0.7rem;
  font-weight: 700;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 12px 8px 12px;
  border-bottom: 1px solid #edf2f7;
  box-sizing: border-box;
  width: 100%;
}

.midvar-details-modal .midvar-rule-input {
  height: 34px;
  padding: 6px 10px;
  font-size: 0.84rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  background: #ffffff;
  box-sizing: border-box;
}

.midvar-details-modal .midvar-quick-pick {
  height: 34px;
  padding: 0 8px;
  font-size: 0.74rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  background: #ffffff;
  max-width: 78px;
}

.midvar-live-test-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #edf2f7;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px 16px;
  font-size: 0.8rem;
  color: #4a5568;
}

.midvar-test-icon {
  font-size: 1rem;
}

.midvar-live-test-bar code {
  background: #ffffff;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  color: #2b6cb0;
  border: 1px solid #cbd5e0;
}

.midvar-test-res {
  color: #276749;
  font-size: 0.85rem;
}
</style>
