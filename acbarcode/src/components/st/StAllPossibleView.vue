<template>
  <div class="all-possible-page light-theme">
    <!-- ── TOP HEADER BAR ─────────────────────────────────────── -->
    <header class="possible-header">
      <div class="header-left">
        <div class="brand-badge">
          <span class="badge-icon">🌐</span>
          <span class="badge-title">All Possible Scenarios</span>
        </div>
        
        <!-- Template Picker & Info -->
        <div class="template-selector-wrap">
          <label class="header-label">Template:</label>
          <select 
            v-if="availableTemplates.length > 1" 
            v-model="selectedTemplateId" 
            class="header-select tpl-select"
            @change="onTemplateChange"
          >
            <option v-for="tpl in availableTemplates" :key="tpl.id" :value="tpl.id">
              {{ tpl.name || 'Unnamed Template' }}
            </option>
          </select>
          <span v-else class="tpl-name-static">{{ activeTemplate?.name || 'Standard Label' }}</span>
        </div>

        <div class="tpl-meta-tags">
          <span class="meta-tag dim">{{ config.widthMm }}×{{ config.heightMm }}mm @{{ config.dpi || 203 }}DPI</span>
          <div class="lang-switch-group">
            <button 
              type="button" 
              class="lang-btn" 
              :class="{ active: activeLang === 'EN' }"
              @click="activeLang = 'EN'"
            >EN</button>
            <button 
              type="button" 
              class="lang-btn" 
              :class="{ active: activeLang === 'CN' }"
              @click="activeLang = 'CN'"
            >CN</button>
          </div>
        </div>
      </div>

      <!-- ITEM Selector (Prominent in Header) -->
      <div class="header-center">
        <div class="item-selector-card">
          <div class="item-label-row">
            <span class="item-badge">🏷️ ITEM No.</span>
            <span class="item-sub-hint">Pick or type product</span>
          </div>
          <div class="item-input-group">
            <select 
              v-if="allItemNumbers.length > 0"
              v-model="selectedItem" 
              class="item-dropdown"
              @change="onItemDropdownSelect"
            >
              <option value="" disabled>-- Select ITEM --</option>
              <option v-for="item in allItemNumbers" :key="item" :value="item">
                {{ item }}
              </option>
              <option value="__custom__">Custom / Type...</option>
            </select>
            <input 
              type="text" 
              v-model="selectedItem" 
              class="item-custom-input"
              placeholder="e.g. S465 4300"
              @input="onItemInputChange"
            />
          </div>
        </div>
      </div>

      <!-- Header Actions -->
      <div class="header-right">
        <button 
          type="button" 
          class="share-btn" 
          @click="copyShareLink"
          title="Copy shareable link with current configuration"
        >
          <span class="btn-icon">🔗</span>
          <span>{{ copiedNotice ? 'Copied!' : 'Share Link' }}</span>
        </button>
        <button 
          type="button" 
          class="download-png-btn" 
          @click="savePreviewImage"
          title="Save preview image as PNG"
        >
          <span class="btn-icon">🖼️</span>
          <span>Save PNG</span>
        </button>
        <button 
          type="button" 
          class="back-app-btn" 
          @click="goToMainApp"
          title="Back to Label Designer"
        >
          <span>✕ Exit</span>
        </button>
      </div>
    </header>

    <!-- Quick Item Pills Bar (if template has multiple item numbers) -->
    <div v-if="allItemNumbers.length > 1" class="quick-items-bar">
      <span class="quick-items-label">Available Items:</span>
      <div class="quick-items-scroll">
        <button
          v-for="item in allItemNumbers"
          :key="item"
          type="button"
          class="item-pill-btn"
          :class="{ active: selectedItem === item }"
          @click="selectQuickItem(item)"
        >
          {{ item }}
        </button>
      </div>
    </div>

    <!-- ── MAIN CONTENT AREA (Split Left / Right) ──────────────── -->
    <div class="main-body-split">
      <!-- ── LEFT SIDE: Controls & Possible Variables ─────────── -->
      <aside class="left-controls-panel custom-scrollbar">
        <div class="panel-header">
          <div class="panel-title-wrap">
            <h2 class="panel-title">Configuration & Variables</h2>
            <p class="panel-sub">Change options, serial numbers, or dynamic fields to see live updates</p>
          </div>
          <button 
            type="button" 
            class="reset-btn" 
            @click="resetAllToDefaults"
            title="Reset to template defaults"
          >
            ↺ Reset
          </button>
        </div>

        <!-- 1. Option Codes Section -->
        <div class="control-section">
          <div class="section-title-row">
            <span class="sec-icon">⚙️</span>
            <span class="sec-title">Option Codes (Active: {{ activeOptionCodesList.length }})</span>
            <button 
              v-if="activeOptionsInput" 
              type="button" 
              class="clear-sec-btn" 
              @click="activeOptionsInput = ''"
            >
              Clear
            </button>
          </div>
          
          <div class="options-text-row">
            <input 
              type="text" 
              v-model="activeOptionsInput" 
              class="options-input" 
              placeholder="e.g. A1410, A1420"
            />
          </div>

          <!-- Grouped Option Buttons -->
          <div v-if="availableOptionGroups.length > 0" class="option-groups-container">
            <div v-for="group in availableOptionGroups" :key="group.name" class="option-group-card">
              <div class="group-header">
                <span class="group-name">{{ group.name }}</span>
                <span v-if="group.selectedCode" class="group-active-code">{{ group.selectedCode }}</span>
              </div>
              <div class="group-chips">
                <button
                  type="button"
                  class="option-chip fallback-chip"
                  :class="{ active: !group.selectedCode }"
                  @click="clearGroupOption(group)"
                >
                  None
                </button>
                <button
                  v-for="opt in group.options"
                  :key="opt.code"
                  type="button"
                  class="option-chip"
                  :class="{ active: hasOptionCode(opt.code) }"
                  @click="toggleOptionCode(opt.code, group)"
                  :title="`${opt.code}: ${opt.text || ''}`"
                >
                  <span class="chip-code">{{ opt.code }}</span>
                  <span v-if="opt.text" class="chip-text">{{ opt.text }}</span>
                </button>
              </div>
            </div>
          </div>
          <div v-else class="empty-group-hint">
            No option mapping elements defined in this template. You can type option codes above.
          </div>
        </div>

        <!-- 2. Serial Number & Date Section -->
        <div class="control-section">
          <div class="section-title-row">
            <span class="sec-icon">🔢</span>
            <span class="sec-title">Serial Number & Date</span>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label class="field-label">Serial Number (SN)</label>
              <input 
                type="text" 
                v-model="activeSN" 
                class="field-input monospace" 
                placeholder="e.g. 3726 0001"
              />
            </div>
            <div class="form-field">
              <label class="field-label">Production Date</label>
              <input 
                type="date" 
                v-model="activeDoneDate" 
                class="field-input" 
              />
            </div>
          </div>

          <div class="sn-presets-row">
            <span class="presets-tag">SN Presets:</span>
            <button type="button" class="preset-chip" @click="activeSN = '3726 0001'">3726 0001</button>
            <button type="button" class="preset-chip" @click="activeSN = '2826 8415'">2826 8415</button>
            <button type="button" class="preset-chip" @click="activeSN = '12345678'">12345678</button>
          </div>
        </div>

        <!-- 3. Dynamic Variables Section -->
        <div v-if="detectedVariables.length > 0" class="control-section">
          <div class="section-title-row">
            <span class="sec-icon">✨</span>
            <span class="sec-title">Custom Template Variables</span>
            <span class="sec-counter">({{ detectedVariables.length }})</span>
          </div>
          <p class="sec-desc">These placeholder variables were detected inside the label elements.</p>

          <div class="custom-vars-grid">
            <div v-for="varName in detectedVariables" :key="varName" class="var-field-card">
              <label class="var-name">
                <code>&#123;&#123;{{ varName }}&#125;&#125;</code>
              </label>
              <input 
                type="text" 
                v-model="customVars[varName]" 
                class="var-input" 
                :placeholder="`Value for ${varName}`"
              />
            </div>
          </div>
        </div>

        <!-- 4. Condition Status & Simulation Inspector -->
        <div v-if="conditionalElements.length > 0" class="control-section">
          <div class="section-title-row">
            <span class="sec-icon">⚡</span>
            <span class="sec-title">Conditions Status Inspector</span>
            <span class="sec-counter">({{ activeConditionsCount }}/{{ conditionalElements.length }} Active)</span>
          </div>
          <p class="sec-desc">Real-time visibility status under current settings:</p>

          <div class="conditions-list">
            <div 
              v-for="item in conditionalElements" 
              :key="item.el.id" 
              class="cond-item-row"
              :class="{ 'is-active': item.isActive, 'is-hidden': !item.isActive }"
            >
              <div class="cond-item-head">
                <span class="cond-el-name">
                  <span class="el-type-icon">{{ getElementTypeIcon(item.el.type) }}</span>
                  {{ item.el.name || item.el.type }}
                </span>
                <span 
                  class="cond-status-pill"
                  :class="item.isActive ? 'active' : 'hidden'"
                >
                  {{ item.isActive ? '✓ Visible' : '✕ Hidden' }}
                </span>
              </div>
              <div class="cond-item-expr">
                <code>{{ item.el.enableCondition }}</code>
              </div>
              <div v-if="!item.isActive && item.satisfyHint" class="cond-fulfill-row">
                <button 
                  type="button" 
                  class="fulfill-btn" 
                  @click="fulfillCondition(item)"
                  title="Automatically adjust settings to make this element visible"
                >
                  ⚡ Simulate: {{ item.satisfyHint.text }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- ── RIGHT SIDE: Real-time Live Canvas Preview ────────── -->
      <main class="right-preview-panel">
        <div class="preview-toolbar">
          <div class="toolbar-left">
            <span class="preview-title">Live Label Preview</span>
            <span class="elements-badge">
              <strong>{{ visibleElementsCount }}</strong> / {{ currentElements.length }} active
            </span>
            <span class="dnd-hint" v-if="zoomLevel >= 1.5">
              ✋ Drag & Pan enabled
            </span>
          </div>

          <div class="toolbar-right">
            <button 
              v-if="panX !== 0 || panY !== 0" 
              type="button" 
              class="reset-pan-btn" 
              @click="resetPan"
              title="Reset position to center"
            >
              ↺ Center
            </button>

            <!-- Zoom Controls -->
            <div class="zoom-controls">
              <button 
                type="button" 
                class="zoom-btn" 
                :class="{ active: zoomLevel === 0.5 }"
                @click="setZoom(0.5)"
                title="50% Zoom"
              >
                50%
              </button>
              <button 
                type="button" 
                class="zoom-btn" 
                :class="{ active: zoomLevel === 0.75 }"
                @click="setZoom(0.75)"
                title="75% Zoom"
              >
                75%
              </button>
              <button 
                type="button" 
                class="zoom-btn" 
                :class="{ active: zoomLevel === 1 }"
                @click="setZoom(1)"
                title="100% Zoom"
              >
                100%
              </button>
              <button 
                type="button" 
                class="zoom-btn" 
                :class="{ active: zoomLevel === 1.5 }"
                @click="setZoom(1.5)"
                title="150% Zoom"
              >
                150%
              </button>
              <button 
                type="button" 
                class="zoom-btn" 
                :class="{ active: zoomLevel === 2 }"
                @click="setZoom(2)"
                title="200% Zoom"
              >
                200%
              </button>
            </div>
          </div>
        </div>

        <!-- Canvas Stage (NO scrollbars, Drag & Drop Pan enabled) -->
        <div 
          class="canvas-stage-wrapper"
          :class="{ dragging: isDragging, 'can-pan': true }"
          @mousedown="startDrag"
          @touchstart.passive="startDrag"
          @dblclick="resetPan"
          title="Click and drag to pan the canvas • Double-click to center"
        >
          <div 
            class="canvas-stage" 
            :style="{ 
              transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel})`,
              transition: isDragging ? 'none' : 'transform 0.12s ease-out'
            }"
          >
            <div class="canvas-dimension-tag top">
              {{ config.widthMm }} mm
            </div>
            <div class="canvas-dimension-tag right">
              {{ config.heightMm }} mm
            </div>

            <div class="canvas-shadow-box">
              <canvas ref="previewCanvasRef" class="rendered-label-canvas"></canvas>
            </div>
          </div>
        </div>

        <!-- Active Context Snapshot Bar -->
        <div class="context-snapshot-bar">
          <div class="snapshot-col">
            <span class="snap-k">ITEM:</span>
            <span class="snap-v highlight">{{ selectedItem || '(none)' }}</span>
          </div>
          <div class="snapshot-col">
            <span class="snap-k">Options:</span>
            <span class="snap-v">{{ activeOptionsInput || '(none)' }}</span>
          </div>
          <div class="snapshot-col">
            <span class="snap-k">SN:</span>
            <span class="snap-v monospace">{{ activeSN }}</span>
          </div>
          <div class="snapshot-col">
            <span class="snap-k">Date:</span>
            <span class="snap-v">{{ activeDoneDate || 'Today' }}</span>
          </div>
          <div class="snapshot-col pan-info" v-if="panX !== 0 || panY !== 0">
            <span class="snap-k">Pan:</span>
            <span class="snap-v monospace">{{ panX }}, {{ panY }}px</span>
          </div>
        </div>
      </main>
    </div>

    <!-- Toast Notification -->
    <transition name="toast-fade">
      <div v-if="toastMessage" class="possible-toast">
        {{ toastMessage }}
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted, nextTick } from 'vue';
import { renderStCanvasDynamic } from '../../utils/stCanvasRenderer.js';
import { isElementEnabled } from '../../utils/stConditionEvaluator.js';
import { parseOptionCodes } from '../../utils/stOptionResolver.js';
import {
  fetchTemplatesFromServer,
  isSpecialTemplate,
  DEFAULT_CONFIG,
  DEFAULT_ELEMENTS_EN,
  DEFAULT_ELEMENTS_CN
} from '../../utils/stTemplateManager.js';

// ── State ───────────────────────────────────────────────────────────────
const allTemplatesList = ref([]);
const selectedTemplateId = ref('');
const activeLang = ref('EN'); // 'EN' | 'CN'

const selectedItem = ref('');
const activeOptionsInput = ref('');
const activeSN = ref('3726 0001');
const activeDoneDate = ref(new Date().toISOString().slice(0, 10));
const customVars = reactive({});

const zoomLevel = ref(0.5);
const previewCanvasRef = ref(null);
const toastMessage = ref('');
const copiedNotice = ref(false);

// ── Panning / DND State ────────────────────────────────────────────────
const panX = ref(0);
const panY = ref(0);
const isDragging = ref(false);
let startX = 0;
let startY = 0;

function startDrag(e) {
  // Left mouse button or single touch
  if (e.button !== undefined && e.button !== 0) return;
  isDragging.value = true;
  const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
  const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
  startX = clientX - panX.value;
  startY = clientY - panY.value;

  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', endDrag);
  window.addEventListener('touchmove', onDragMove);
  window.addEventListener('touchend', endDrag);
}

function onDragMove(e) {
  if (!isDragging.value) return;
  const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
  const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
  panX.value = Math.round(clientX - startX);
  panY.value = Math.round(clientY - startY);
}

function endDrag() {
  isDragging.value = false;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', endDrag);
  window.removeEventListener('touchmove', onDragMove);
  window.removeEventListener('touchend', endDrag);
}

function resetPan() {
  panX.value = 0;
  panY.value = 0;
}

function setZoom(val) {
  zoomLevel.value = val;
  if (val <= 1) {
    resetPan();
  }
}

// ── URL Query Parameters ───────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const initialTemplateId = urlParams.get('id') || '';
const initialItem = urlParams.get('item') || '';
const initialOptions = urlParams.get('options') || '';
const initialSN = urlParams.get('sn') || '';
const initialLang = urlParams.get('lang') || 'EN';

// ── Templates ──────────────────────────────────────────────────────────
const availableTemplates = computed(() => {
  return allTemplatesList.value.filter(t => !isSpecialTemplate(t));
});

const activeTemplate = computed(() => {
  if (selectedTemplateId.value) {
    const found = availableTemplates.value.find(t => t.id === selectedTemplateId.value);
    if (found) return found;
  }
  return availableTemplates.value[0] || null;
});

const config = computed(() => {
  return activeTemplate.value?.config || DEFAULT_CONFIG;
});

const currentElements = computed(() => {
  if (!activeTemplate.value) return [];
  if (activeLang.value === 'CN' && Array.isArray(activeTemplate.value.elements_cn) && activeTemplate.value.elements_cn.length > 0) {
    return activeTemplate.value.elements_cn;
  }
  return activeTemplate.value.elements_en || DEFAULT_ELEMENTS_EN;
});

// ── Item Numbers Discovery ──────────────────────────────────────────────
const allItemNumbers = computed(() => {
  const items = new Set();
  const tpl = activeTemplate.value;
  if (!tpl) return [];

  // 1. Configured items in template
  if (Array.isArray(tpl.itemNumbers)) {
    tpl.itemNumbers.forEach(i => {
      const trimmed = String(i).trim();
      if (trimmed) items.add(trimmed);
    });
  }

  // 2. Elements with product mapping
  const elements = [
    ...(Array.isArray(tpl.elements_en) ? tpl.elements_en : []),
    ...(Array.isArray(tpl.elements_cn) ? tpl.elements_cn : [])
  ];

  elements.forEach(el => {
    if (Array.isArray(el.productMappings)) {
      el.productMappings.forEach(pm => {
        if (pm.product && String(pm.product).trim()) {
          items.add(String(pm.product).trim());
        }
      });
    }

    // 3. Condition expressions like {{Product Type}} == 'S695 4120' or in 'S695 4120', 'S695 4121'
    if (el.enableCondition) {
      const matches = el.enableCondition.match(/'([^']+)'|"([^"]+)"/g);
      if (matches) {
        matches.forEach(m => {
          const val = m.replace(/['"]/g, '').trim();
          if (/^S\d{3,4}/i.test(val)) {
            items.add(val);
          }
        });
      }
    }
  });

  return Array.from(items);
});

// ── Option Groups Discovery ────────────────────────────────────────────
const activeOptionCodesList = computed(() => {
  return parseOptionCodes(activeOptionsInput.value);
});

function hasOptionCode(code) {
  const normalized = String(code).trim().toUpperCase();
  return activeOptionCodesList.value.includes(normalized);
}

const availableOptionGroups = computed(() => {
  const groups = [];
  const seenCodes = new Set();

  currentElements.value.forEach(el => {
    if ((el.useOptionMapping || el.isOptionMode) && Array.isArray(el.optionMappings) && el.optionMappings.length > 0) {
      const groupName = el.name || 'Option Group';
      const validOptions = [];

      el.optionMappings.forEach(m => {
        const code = String(m.code || '').trim().toUpperCase();
        if (code && !seenCodes.has(code)) {
          seenCodes.add(code);
          validOptions.push({
            code,
            text: m.text || ''
          });
        }
      });

      if (validOptions.length > 0) {
        const activeCode = validOptions.find(opt => hasOptionCode(opt.code))?.code || '';
        groups.push({
          name: groupName,
          elementId: el.id,
          selectedCode: activeCode,
          options: validOptions
        });
      }
    }
  });

  // Extract standalone condition codes like {{options}} contains 'A1410'
  currentElements.value.forEach(el => {
    if (el.enableCondition && el.enableCondition.toLowerCase().includes('option')) {
      const matches = el.enableCondition.match(/'([^']+)'|"([^"]+)"/g);
      if (matches) {
        const extraCodes = [];
        matches.forEach(m => {
          const c = m.replace(/['"]/g, '').trim().toUpperCase();
          if (/^[A-Z]\d{3,4}/i.test(c) && !seenCodes.has(c)) {
            seenCodes.add(c);
            extraCodes.push({ code: c, text: 'Condition Option' });
          }
        });
        if (extraCodes.length > 0) {
          groups.push({
            name: `${el.name || 'Element'} Condition Options`,
            elementId: el.id,
            selectedCode: extraCodes.find(opt => hasOptionCode(opt.code))?.code || '',
            options: extraCodes
          });
        }
      }
    }
  });

  return groups;
});

// ── Detected Mustache Variables ─────────────────────────────────────────
const detectedVariables = computed(() => {
  const vars = new Set();
  const builtinNames = new Set([
    'serial', 'sn', 'product', 'product_no', 'productno', 'item_no', 'itemno',
    'producttype', 'product type', 'options', 'option', 'options_text', 'optionstext',
    'done_date', 'donedate', 'date', 'devicename', 'device_name', 'categ', 'origin', 'order'
  ]);

  currentElements.value.forEach(el => {
    const raw = el.text || el.rawText || el.data || '';
    if (typeof raw === 'string') {
      const matches = raw.matchAll(/\{\{\s*([^}|]+?)(?:\s*\|\s*[^}]+)?\s*\}\}/g);
      for (const m of matches) {
        const varName = m[1].trim();
        const cleanLower = varName.toLowerCase().replace(/[\s_-]+/g, '');
        if (!builtinNames.has(cleanLower) && !builtinNames.has(varName.toLowerCase())) {
          vars.add(varName);
        }
      }
    }

    // Also scan enableCondition for referenced custom variables like {{option_xxx}}
    if (typeof el.enableCondition === 'string' && el.enableCondition.trim()) {
      const condMatches = el.enableCondition.matchAll(/\{\{\s*([^}|!=<>'"\s]+?)(?:\s*\|\s*[^}]+)?\s*\}\}/g);
      for (const m of condMatches) {
        const varName = m[1].trim();
        const cleanLower = varName.toLowerCase().replace(/[\s_-]+/g, '');
        if (!builtinNames.has(cleanLower) && !builtinNames.has(varName.toLowerCase())) {
          vars.add(varName);
        }
      }
    }
  });

  return Array.from(vars);
});

// ── Conditions Inspector ───────────────────────────────────────────────
const conditionEvaluationContext = computed(() => {
  return {
    product: selectedItem.value,
    options: activeOptionsInput.value,
    serial: activeSN.value,
    done_date: activeDoneDate.value,
    deviceName: activeTemplate.value?.deviceName || '',
    ...customVars
  };
});

const conditionalElements = computed(() => {
  const list = [];
  const ctx = conditionEvaluationContext.value;

  currentElements.value.forEach(el => {
    if (el.enableCondition && el.enableCondition.trim()) {
      const active = isElementEnabled(el, ctx, currentElements.value);
      
      let satisfyHint = null;
      const cond = el.enableCondition;
      const prodMatch = cond.match(/(?:Product Type|product|itemno)\s*(?:==|in)\s*['"]([^'"]+)['"]/i);
      const optVarMatch = cond.match(/(?:\{\{\s*)?(op[ti]+on_[a-zA-Z0-9_-]+)(?:\s*\}\})?\s*(?:==|in|contains|has)\s*['"]([^'"]+)['"]/i);
      const optMatch = cond.match(/options?\s*(?:contains|has|==|in)\s*['"]([^'"]+)['"]/i);

      if (prodMatch) {
        satisfyHint = { type: 'item', value: prodMatch[1], text: `Set ITEM = "${prodMatch[1]}"` };
      } else if (optVarMatch) {
        satisfyHint = { type: 'customVar', varName: optVarMatch[1], value: optVarMatch[2], text: `Set {{${optVarMatch[1]}}} = "${optVarMatch[2]}"` };
      } else if (optMatch) {
        satisfyHint = { type: 'option', value: optMatch[1], text: `Add Option "${optMatch[1]}"` };
      }

      list.push({
        el,
        isActive: active,
        satisfyHint
      });
    }
  });

  return list;
});

const activeConditionsCount = computed(() => {
  return conditionalElements.value.filter(c => c.isActive).length;
});

const visibleElementsCount = computed(() => {
  const ctx = conditionEvaluationContext.value;
  return currentElements.value.filter(el => el.type !== 'folder' && isElementEnabled(el, ctx, currentElements.value)).length;
});

// ── Methods ────────────────────────────────────────────────────────────
function showToast(msg) {
  toastMessage.value = msg;
  setTimeout(() => {
    toastMessage.value = '';
  }, 2500);
}

function onItemDropdownSelect() {
  if (selectedItem.value === '__custom__') {
    selectedItem.value = '';
  }
}

function onItemInputChange() {
  // Handled via v-model
}

function selectQuickItem(item) {
  selectedItem.value = item;
}

function toggleOptionCode(code, group) {
  const normCode = String(code).trim().toUpperCase();
  let codes = [...activeOptionCodesList.value];

  if (group && Array.isArray(group.options)) {
    const groupCodes = group.options.map(o => o.code);
    codes = codes.filter(c => !groupCodes.includes(c));
  }

  if (hasOptionCode(normCode)) {
    codes = codes.filter(c => c !== normCode);
  } else {
    codes.push(normCode);
  }

  activeOptionsInput.value = codes.join(', ');
}

function clearGroupOption(group) {
  if (!group || !Array.isArray(group.options)) return;
  const groupCodes = group.options.map(o => o.code);
  const codes = activeOptionCodesList.value.filter(c => !groupCodes.includes(c));
  activeOptionsInput.value = codes.join(', ');
}

function fulfillCondition(item) {
  if (!item || !item.satisfyHint) return;
  const hint = item.satisfyHint;
  if (hint.type === 'item') {
    selectedItem.value = hint.value;
    showToast(`Switched ITEM to ${hint.value}`);
  } else if (hint.type === 'customVar' && hint.varName) {
    customVars[hint.varName] = hint.value;
    showToast(`Set {{${hint.varName}}} = "${hint.value}"`);
  } else if (hint.type === 'option') {
    if (!hasOptionCode(hint.value)) {
      const codes = [...activeOptionCodesList.value, hint.value];
      activeOptionsInput.value = codes.join(', ');
      showToast(`Added option code ${hint.value}`);
    }
  }
}

function resetAllToDefaults() {
  selectedItem.value = allItemNumbers.value[0] || 'S465 4300';
  activeOptionsInput.value = '';
  activeSN.value = '3726 0001';
  activeDoneDate.value = new Date().toISOString().slice(0, 10);
  Object.keys(customVars).forEach(k => delete customVars[k]);
  resetPan();
  showToast('Reset all parameters to default');
}

function onTemplateChange() {
  nextTick(() => {
    if (allItemNumbers.value.length > 0) {
      selectedItem.value = allItemNumbers.value[0];
    }
    resetPan();
  });
}

function getElementTypeIcon(type) {
  switch (type) {
    case 'text': return '🔤';
    case 'barcode': return '❚❚';
    case 'qrcode': return '🔲';
    case 'image': return '🖼️';
    case 'hline': return '━';
    case 'table': return '▦';
    default: return '📄';
  }
}

function copyShareLink() {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('page', 'all-possible');
  if (activeTemplate.value?.id) {
    url.searchParams.set('id', activeTemplate.value.id);
  }
  if (selectedItem.value) {
    url.searchParams.set('item', selectedItem.value);
  }
  if (activeOptionsInput.value) {
    url.searchParams.set('options', activeOptionsInput.value);
  }
  if (activeSN.value) {
    url.searchParams.set('sn', activeSN.value);
  }
  if (activeLang.value) {
    url.searchParams.set('lang', activeLang.value);
  }
  Object.entries(customVars).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });

  navigator.clipboard.writeText(url.toString()).then(() => {
    copiedNotice.value = true;
    showToast('✓ Shareable URL copied to clipboard!');
    setTimeout(() => {
      copiedNotice.value = false;
    }, 2000);
  }).catch(() => {
    showToast('Failed to copy link');
  });
}

function savePreviewImage() {
  if (!previewCanvasRef.value) return;
  const dataUrl = previewCanvasRef.value.toDataURL('image/png');
  const a = document.createElement('a');
  const tplName = (activeTemplate.value?.name || 'label').replace(/\s+/g, '_');
  const itemStr = (selectedItem.value || 'item').replace(/\s+/g, '_');
  a.download = `${tplName}_${itemStr}_preview.png`;
  a.href = dataUrl;
  a.click();
  showToast('✓ Preview image downloaded');
}

function goToMainApp() {
  const url = new URL(window.location.origin + window.location.pathname);
  window.location.href = url.toString();
}

// ── Font Preload Pipeline ──────────────────────────────────────────────
async function ensureLabelFonts() {
  try {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
      await Promise.all([
        document.fonts.load('400 12px "Noto Sans"').catch(() => {}),
        document.fonts.load('700 12px "Noto Sans"').catch(() => {}),
        document.fonts.load('400 12px "Noto Sans SC"').catch(() => {}),
        document.fonts.load('700 12px "Noto Sans SC"').catch(() => {})
      ]);
      if (document.fonts.ready) {
        await document.fonts.ready;
      }
    }
  } catch (err) {
    console.warn('Font preload failed:', err);
  }
}

// ── Canvas Rendering Pipeline ──────────────────────────────────────────
async function redrawCanvas() {
  await nextTick();
  const canvas = previewCanvasRef.value;
  if (!canvas || !activeTemplate.value) return;

  const elements = currentElements.value;
  const cfg = config.value;
  const sn = activeSN.value || '3726 0001';
  const prod = selectedItem.value || (allItemNumbers.value[0] || 'S465 4300');
  const opt = activeOptionsInput.value || '';
  const devName = activeTemplate.value.deviceName || '';

  const extra = {
    done_date: activeDoneDate.value,
    ...customVars
  };

  await renderStCanvasDynamic(canvas, elements, cfg, sn, prod, opt, devName, extra);
}

// ── Watchers for Real-time Redraw ──────────────────────────────────────
watch([
  activeTemplate,
  currentElements,
  selectedItem,
  activeOptionsInput,
  activeSN,
  activeDoneDate,
  activeLang,
  customVars
], () => {
  redrawCanvas();
}, { deep: true });

// ── Lifecycle ──────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const list = await fetchTemplatesFromServer();
    allTemplatesList.value = Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('Failed to load templates:', err);
  }

  if (availableTemplates.value.length > 0) {
    if (initialTemplateId && availableTemplates.value.some(t => t.id === initialTemplateId)) {
      selectedTemplateId.value = initialTemplateId;
    } else {
      selectedTemplateId.value = availableTemplates.value[0].id;
    }
  }

  if (initialLang && (initialLang === 'CN' || initialLang === 'EN')) {
    activeLang.value = initialLang;
  }
  if (initialSN) {
    activeSN.value = initialSN;
  }
  if (initialOptions) {
    activeOptionsInput.value = initialOptions;
  }
  if (initialItem) {
    selectedItem.value = initialItem;
  } else {
    selectedItem.value = allItemNumbers.value[0] || 'S465 4300';
  }

  urlParams.forEach((val, key) => {
    if (!['page', 'id', 'item', 'options', 'sn', 'lang'].includes(key.toLowerCase())) {
      customVars[key] = val;
    }
  });

  // Preload fonts before first canvas render so canvas never falls back to OS default fonts
  await ensureLabelFonts();
  await redrawCanvas();

  // If any remaining web font finishes loading asynchronously, redraw canvas automatically
  if (typeof document !== 'undefined' && document.fonts) {
    document.fonts.ready?.then(() => redrawCanvas()).catch(() => {});
    if (document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', () => redrawCanvas());
    }
  }
});
</script>

<style scoped>
/* ── Container Layout (Light Theme) ─────────────────────────── */
.all-possible-page.light-theme {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: #f8fafc;
  color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  overflow: hidden;
  user-select: none;
}

/* ── HEADER BAR ─────────────────────────────────────────────── */
.possible-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 20px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  z-index: 20;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  padding: 5px 12px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 13px;
  color: #ffffff;
  letter-spacing: 0.3px;
  box-shadow: 0 2px 6px rgba(2, 132, 199, 0.3);
}

.badge-icon {
  font-size: 14px;
}

.template-selector-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-label {
  font-size: 11px;
  color: #64748b;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tpl-select {
  background: #f8fafc;
  color: #0f172a;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: all 0.12s ease;
}

.tpl-select:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
}

.tpl-name-static {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.tpl-meta-tags {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meta-tag {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 10px;
  font-family: monospace;
  font-weight: 600;
}

.lang-switch-group {
  display: flex;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  overflow: hidden;
}

.lang-btn {
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.12s ease;
}

.lang-btn.active {
  background: #0284c7;
  color: white;
}

/* ── HEADER CENTER: ITEM SELECTOR ───────────────────────────── */
.header-center {
  flex: 1;
  max-width: 480px;
}

.item-selector-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f0f9ff;
  border: 1.5px solid #0284c7;
  padding: 4px 10px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(2, 132, 199, 0.1);
}

.item-label-row {
  display: flex;
  flex-direction: column;
}

.item-badge {
  font-size: 11px;
  font-weight: 800;
  color: #0369a1;
  white-space: nowrap;
}

.item-sub-hint {
  font-size: 9px;
  color: #64748b;
  white-space: nowrap;
}

.item-input-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.item-dropdown {
  background: #ffffff;
  color: #0f172a;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 700;
  font-family: monospace;
  outline: none;
  max-width: 170px;
}

.item-custom-input {
  flex: 1;
  background: #ffffff;
  color: #0f172a;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  font-family: monospace;
  outline: none;
}

.item-custom-input:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.2);
}

/* ── HEADER RIGHT ACTIONS ───────────────────────────────────── */
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.share-btn, .download-png-btn, .back-app-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}

.share-btn {
  background: #0284c7;
  color: white;
}
.share-btn:hover {
  background: #0369a1;
  box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25);
}

.download-png-btn {
  background: #059669;
  color: white;
}
.download-png-btn:hover {
  background: #047857;
  box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);
}

.back-app-btn {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
}
.back-app-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

/* ── QUICK ITEMS PILLS BAR ──────────────────────────────────── */
.quick-items-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 20px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  overflow-x: auto;
}

.quick-items-label {
  font-size: 10px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  white-space: nowrap;
}

.quick-items-scroll {
  display: flex;
  align-items: center;
  gap: 6px;
}

.item-pill-btn {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  color: #334155;
  font-size: 10px;
  font-weight: 600;
  font-family: monospace;
  padding: 2px 8px;
  border-radius: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.12s ease;
}

.item-pill-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.item-pill-btn.active {
  background: #0284c7;
  border-color: #0284c7;
  color: #ffffff;
  box-shadow: 0 1px 4px rgba(2, 132, 199, 0.35);
}

/* ── MAIN SPLIT BODY ────────────────────────────────────────── */
.main-body-split {
  display: flex;
  flex: 1;
  height: calc(100vh - 86px);
  overflow: hidden;
}

/* ── LEFT CONTROLS PANEL ────────────────────────────────────── */
.left-controls-panel {
  width: 440px;
  flex-shrink: 0;
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 8px;
  border-bottom: 1px solid #f1f5f9;
}

.panel-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.panel-sub {
  font-size: 11px;
  color: #64748b;
  margin: 2px 0 0;
}

.reset-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.reset-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

/* Control Sections */
.control-section {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sec-icon {
  font-size: 13px;
}

.sec-title {
  font-size: 12px;
  font-weight: 700;
  color: #1e293b;
  flex: 1;
}

.sec-counter {
  font-size: 10px;
  color: #0284c7;
  font-weight: 700;
}

.sec-desc {
  font-size: 10px;
  color: #64748b;
  margin: 0;
}

.clear-sec-btn {
  font-size: 10px;
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
  padding: 1px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}
.clear-sec-btn:hover {
  background: #fecaca;
}

.options-text-row {
  display: flex;
}

.options-input {
  width: 100%;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11px;
  font-family: monospace;
  color: #0f172a;
}
.options-input:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
  outline: none;
}

/* Option Groups & Chips */
.option-groups-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.option-group-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.group-name {
  font-size: 10px;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
}

.group-active-code {
  font-size: 10px;
  font-family: monospace;
  background: #0284c7;
  color: white;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 700;
}

.group-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.option-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #334155;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.12s ease;
}

.option-chip:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.option-chip.active {
  background: #0284c7;
  border-color: #0284c7;
  color: #ffffff;
  font-weight: 700;
}

.fallback-chip {
  color: #64748b;
  font-style: italic;
}

.chip-code {
  font-family: monospace;
  font-weight: 700;
}

.chip-text {
  font-size: 9px;
  opacity: 0.85;
}

.empty-group-hint {
  font-size: 10px;
  color: #64748b;
  font-style: italic;
}

/* Form Fields */
.form-row {
  display: flex;
  gap: 8px;
}

.form-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 10px;
  color: #475569;
  font-weight: 700;
}

.field-input {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 11px;
  color: #0f172a;
  outline: none;
}

.field-input.monospace {
  font-family: monospace;
}

.field-input:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
}

.sn-presets-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}

.presets-tag {
  color: #64748b;
}

.preset-chip {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #0284c7;
  font-family: monospace;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
  font-weight: 600;
}
.preset-chip:hover {
  background: #f0f9ff;
  border-color: #0284c7;
}

/* Custom Variables Grid */
.custom-vars-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.var-field-card {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 4px 8px;
}

.var-name {
  min-width: 100px;
  font-size: 10px;
  color: #0284c7;
  font-family: monospace;
  font-weight: 700;
}

.var-input {
  flex: 1;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  color: #0f172a;
}
.var-input:focus {
  border-color: #0284c7;
  background: #ffffff;
  outline: none;
}

/* Conditions Inspector */
.conditions-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cond-item-row {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.12s ease;
}

.cond-item-row.is-active {
  border-left: 3px solid #10b981;
}

.cond-item-row.is-hidden {
  border-left: 3px solid #ef4444;
  opacity: 0.75;
}

.cond-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cond-el-name {
  font-size: 11px;
  font-weight: 700;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 4px;
}

.cond-status-pill {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
}

.cond-status-pill.active {
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}

.cond-status-pill.hidden {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.cond-item-expr code {
  font-size: 10px;
  color: #475569;
  font-family: monospace;
}

.fulfill-btn {
  background: #fffbeb;
  border: 1px solid #fcd34d;
  color: #b45309;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 700;
}
.fulfill-btn:hover {
  background: #fef3c7;
}

/* ── RIGHT PREVIEW PANEL ────────────────────────────────────── */
.right-preview-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  overflow: hidden;
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.preview-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.elements-badge {
  font-size: 10px;
  background: #f1f5f9;
  color: #475569;
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.elements-badge strong {
  color: #0284c7;
}

.dnd-hint {
  font-size: 10px;
  color: #0284c7;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reset-pan-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
  font-size: 10px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.reset-pan-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.zoom-controls {
  display: flex;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  overflow: hidden;
}

.zoom-btn {
  background: transparent;
  border: none;
  color: #475569;
  font-size: 10px;
  font-weight: 700;
  padding: 4px 8px;
  cursor: pointer;
  transition: all 0.12s ease;
}

.zoom-btn.active {
  background: #0284c7;
  color: white;
}

/* Canvas Stage (NO scrollbars, Drag & Drop Pan enabled) */
.canvas-stage-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden; /* No scrollbars */
  position: relative;
  background-color: #f1f5f9;
  background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
  background-size: 16px 16px;
  user-select: none;
  cursor: grab;
}

.canvas-stage-wrapper.dragging {
  cursor: grabbing;
}

.canvas-stage {
  position: relative;
  transform-origin: center center;
  line-height: 0;
}

.canvas-dimension-tag {
  position: absolute;
  font-size: 9px;
  font-family: monospace;
  color: #64748b;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.85);
  padding: 1px 4px;
  border-radius: 2px;
  border: 1px solid #e2e8f0;
}

.canvas-dimension-tag.top {
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
}

.canvas-dimension-tag.right {
  right: -36px;
  top: 50%;
  transform: translateY(-50%) rotate(90deg);
}

.canvas-shadow-box {
  background: white;
  border-radius: 4px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.14), 0 0 1px rgba(0, 0, 0, 0.12);
  line-height: 0;
  overflow: hidden;
}

.rendered-label-canvas {
  display: block;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}

/* Context Snapshot Bar */
.context-snapshot-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 8px 20px;
  background: #ffffff;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
  font-size: 11px;
}

.snapshot-col {
  display: flex;
  align-items: center;
  gap: 6px;
}

.snap-k {
  color: #64748b;
  font-weight: 700;
}

.snap-v {
  color: #0f172a;
  font-weight: 600;
}

.snap-v.highlight {
  color: #0284c7;
  font-family: monospace;
  font-weight: 700;
}

.snap-v.monospace {
  font-family: monospace;
}

.pan-info {
  margin-left: auto;
  font-size: 10px;
  color: #94a3b8;
}

/* Toast */
.possible-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #0284c7;
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.toast-fade-enter-active, .toast-fade-leave-active {
  transition: all 0.2s ease;
}
.toast-fade-enter-from, .toast-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* Custom Scrollbar for Left Panel */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f5f9;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
