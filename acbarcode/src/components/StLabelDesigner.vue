<template>
  <div class="st-designer-container">
    <StHeaderActions 
      v-model="stSerialNumbersInput" 
      v-model:customVarsValue="stCustomVarsInput"
      :detected-option-vars="detectedOptionVars"
      v-model:optionsValue="stOptionsInput"
      v-model:productValue="stProductInput"
      :available-products="allAvailableProducts"
      :range-count="serialRange.length"
      :active-template="activeTemplate"
      :active-sub-template-id="activeSubTemplateId"
      :is-locked="isCurrentTemplateLocked"
      @update:active-sub-template-id="handleSubTemplateChange($event)"
      @fetch-odoo="fetchFromOdooStub"
      @open-odoo-modal="$emit('open-odoo-modal')"
      @open-templates="handleOpenTemplates"
      @unlock-requested="openUnlockModal"
    />

    <div class="st-editor-layout">
      <!-- LEFT PANEL: Elements Layer Manager -->
      <div class="st-editor-panel">
        <StElementsManagerCard 
          :elements="stElements" 
          :canvasConfig="stCanvasConfig" 
          :available-products="allAvailableProducts"
          :active-product="activeProd"
          :active-options="stOptionsInput"
          :custom-vars="parsedCustomVars"
          :has-unsaved-changes="hasUnsavedChanges"
          :is-saving="isSaving"
          :is-locked="isCurrentTemplateLocked"
          @save-elements="saveCurrentElements"
          @unlock-requested="openUnlockModal"
        />
      </div>

      <!-- RIGHT PANEL: Template Basic Infos & Live Canvas Preview & Code Stream -->
      <div class="st-preview-panel">
        <StCanvasConfigCard 
          :config="stCanvasConfig"
          :template-name="currentLabelName"
          :template-note="currentLabelNote"
          :item-numbers="itemNumbersString"
          :active-lang="activeLang"
          :is-locked="isCurrentTemplateLocked"
          @update:active-lang="activeLang = $event"
          @copy-from-en="onCopyEnToCn"
        />
        <StCanvasPreviewCard 
          ref="previewCardRef"
          :config="stCanvasConfig"
          :range-count="serialRange.length"
          :current-idx="currentPreviewIndex"
          :current-s-n="currentPreviewSN"
          :is-locked="isCurrentTemplateLocked"
          :is-special="isCurrentTemplateSpecial"
          @prev-page="prevPreviewPage"
          @next-page="nextPreviewPage"
          @export-ezpx="exportEZPX"
          @export-ezpl="exportGraphicEZPL"
          @open-all-possible="onOpenAllPossible"
          @export-template-json="exportSingleTemplateJson"
          @import-template-json="importSingleTemplateJson"
        />
      </div>
    </div>

    <!-- Unlock Template Password Modal -->
    <transition name="modal-fade">
      <div v-if="isUnlockModalOpen" class="st-modal-overlay">
        <div class="st-modal-container unlock-modal">
          <div class="st-modal-header">
            <h3>🔒 Unlock Template</h3>
            <button type="button" class="close-modal-btn" @click="closeUnlockModal">✕</button>
          </div>
          <div class="st-modal-body">
            <p class="unlock-desc">
              Enter the admin password to unlock and edit <strong>{{ activeTemplate?.name }}</strong>:
            </p>
            <form @submit.prevent="submitUnlock">
              <input
                ref="unlockInputRef"
                type="password"
                v-model="unlockPasswordInput"
                class="unlock-password-input"
                placeholder="Enter admin password"
                autocomplete="current-password"
              />
              <div v-if="unlockError" class="unlock-error-msg">
                {{ unlockError }}
              </div>
              <div class="unlock-modal-actions">
                <button type="button" class="mini-btn modal-cancel-btn" @click="closeUnlockModal">Cancel</button>
                <button type="submit" class="primary-btn unlock-btn">Unlock</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue';
import jsPDF from 'jspdf';

import StHeaderActions from './st/StHeaderActions.vue';
import StCanvasConfigCard from './st/StCanvasConfigCard.vue';
import StElementsManagerCard from './st/StElementsManagerCard.vue';
import StCanvasPreviewCard from './st/StCanvasPreviewCard.vue';
import { showStAlert, showStConfirm } from '../utils/stDialog.js';

import { compileGraphicEZPLRange } from '../utils/stEzplGraphicCompiler.js';
import { compileEZPXRange, buildSerialCsv } from '../utils/stEzpxCompiler.js';
import { START_BAT } from '../utils/stGoLabelBatch.js';
import JSZip from 'jszip';
import { renderStCanvasDynamic } from '../utils/stCanvasRenderer.js';
import { generateSerialRange } from '../utils/stSerialRange.js';
import { resolveElementText, evaluateMidVariables } from '../utils/stOptionResolver.js';
import { matchTemplateByItemNo, DEFAULT_ELEMENTS_EN, DEFAULT_ELEMENTS_CN, isSpecialTemplate } from '../utils/stTemplateManager.js';
import {
  templates,
  activeTemplateId,
  activeTemplate,
  activeSubTemplateId,
  activeSubTemplate,
  templatesLoaded,
  loadTemplates,
  scheduleSave,
  flushTemplateSave,
  hasUnsavedDesignerChanges,
  copyEnToCn as storeCopyEnToCn,
  setActiveSubTemplate,
  isCurrentTemplateLocked,
  unlockTemplate
} from '../stores/templateStore.js';
import { verifyAdminPassword } from '../utils/auth.js';

const emit = defineEmits(['open-odoo-modal', 'open-templates']);

// ── State ──────────────────────────────────────────────────────────────
const stSerialNumbersInput = ref('12345678');
const stEndSerialNumberInput = ref('');
const stCustomVarsInput = ref('');
const stOptionsInput = ref('');
const stProductInput = ref('');
const currentPreviewIndex = ref(0);
const previewCardRef = ref(null);
const activeLang = ref('EN'); // 'EN' | 'CN'

// Parsed key-value map from CSTM input + evaluated Mid-Variables from active template
const parsedCustomVars = computed(() => {
  const map = {};
  const str = stCustomVarsInput.value;
  if (str && typeof str === 'string') {
    const parts = str.split(/[,;\n]+/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf('=') !== -1 ? trimmed.indexOf('=') : trimmed.indexOf(':');
      if (eqIdx !== -1) {
        const k = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (k) {
          const cleanK = k.replace(/^\{+|\}+$/g, '').trim();
          map[k] = val;
          map[k.toLowerCase()] = val;
          map[cleanK] = val;
          map[cleanK.toLowerCase()] = val;
        }
      } else {
        const cleanK = trimmed.replace(/^\{+|\}+$/g, '').trim();
        map[trimmed] = '1';
        map[trimmed.toLowerCase()] = '1';
        map[cleanK] = '1';
        map[cleanK.toLowerCase()] = '1';
      }
    }
  }

  // Also evaluate template-level Mid-Variables (Product-to-Value or Option-to-Value mapping)
  const midVars = activeTemplate.value?.midVariables;
  if (Array.isArray(midVars) && midVars.length > 0) {
    const evaluated = evaluateMidVariables(midVars, {
      prod: activeProd.value,
      product: activeProd.value,
      opt: stOptionsInput.value,
      options: stOptionsInput.value,
      sn: currentPreviewSN.value
    });
    for (const [k, v] of Object.entries(evaluated)) {
      const cleanK = k.replace(/^\{+|\}+$/g, '').trim();
      map[k] = v;
      map[k.toLowerCase()] = v;
      map[cleanK] = v;
      map[cleanK.toLowerCase()] = v;
    }
  }

  map.midVariables = midVars || [];
  return map;
});

// Auto-detect any dynamic variables (especially option_xxx / opition_xxx) in elements and conditions
const detectedOptionVars = computed(() => {
  const vars = new Set();
  const builtinNames = new Set([
    'serial', 'sn', 'product', 'prod', 'product_no', 'productno', 'item_no', 'itemno',
    'producttype', 'product type', 'options', 'opt', 'option', 'options_text', 'optionstext',
    'done_date', 'donedate', 'date', 'devicename', 'device_name', 'categ', 'origin', 'order',
    'order_id', 'orderid', 'delivery_order', 'dn'
  ]);

  (activeTemplate.value?.midVariables || []).forEach(mv => {
    if (mv && mv.name) {
      builtinNames.add(mv.name.toLowerCase().replace(/[\s_-]+/g, ''));
    }
  });

  (stElements.value || []).forEach(el => {
    const fieldsToScan = [el.text, el.rawText, el.data, el.sutoProductType, el.sutoPrefix, el.enableCondition];
    for (const field of fieldsToScan) {
      if (typeof field === 'string') {
        const matches = field.matchAll(/\{\{\s*([^}|!=<>'"\s]+?)(?:\s*\|\s*[^}]+)?\s*\}\}/g);
        for (const m of matches) {
          const name = m[1].trim();
          const lower = name.toLowerCase().replace(/[\s_-]+/g, '');
          if (!builtinNames.has(lower)) {
            vars.add(name);
          }
        }
      }
    }
  });

  return Array.from(vars);
});

const isCurrentTemplateSpecial = computed(() => {
  return isSpecialTemplate(activeTemplate.value);
});

// ── Lock & Unlock State ────────────────────────────────────────────────
const isUnlockModalOpen = ref(false);
const unlockPasswordInput = ref('');
const unlockError = ref('');
const unlockInputRef = ref(null);

function openUnlockModal() {
  unlockPasswordInput.value = '';
  unlockError.value = '';
  isUnlockModalOpen.value = true;
  nextTick(() => {
    if (unlockInputRef.value) {
      unlockInputRef.value.focus();
    }
  });
}

function closeUnlockModal() {
  isUnlockModalOpen.value = false;
  unlockPasswordInput.value = '';
  unlockError.value = '';
}

function submitUnlock() {
  if (!verifyAdminPassword(unlockPasswordInput.value)) {
    unlockError.value = 'Incorrect admin password. Please try again.';
    return;
  }
  if (activeTemplate.value) {
    unlockTemplate(activeTemplate.value.id);
  }
  closeUnlockModal();
  showStAlert(`Template "${activeTemplate.value?.name}" unlocked. You can now edit elements.`, 'Template Unlocked', 'success');
}

const savedSnapshot = ref('');
const isSaving = ref(false);
const hasUnsavedChanges = computed({
  get: () => hasUnsavedDesignerChanges.value,
  set: (val) => { hasUnsavedDesignerChanges.value = val; }
});

function takeSnapshot(label) {
  if (!label) return '';
  return JSON.stringify(
    {
      elements_en: label.elements_en || [],
      elements_cn: label.elements_cn || [],
      config: label.config || {},
      midVariables: activeTemplate.value?.midVariables || []
    },
    (key, value) => (key === 'expanded' ? undefined : value)
  );
}

function revertCurrentLabelToSnapshot() {
  if (!savedSnapshot.value || !currentLabel.value) return;
  try {
    const parsed = JSON.parse(savedSnapshot.value);
    if (parsed.elements_en) currentLabel.value.elements_en = JSON.parse(JSON.stringify(parsed.elements_en));
    if (parsed.elements_cn) currentLabel.value.elements_cn = JSON.parse(JSON.stringify(parsed.elements_cn));
    if (parsed.config) currentLabel.value.config = JSON.parse(JSON.stringify(parsed.config));
    if (parsed.midVariables && activeTemplate.value) activeTemplate.value.midVariables = JSON.parse(JSON.stringify(parsed.midVariables));
    hasUnsavedChanges.value = false;
  } catch (err) {
    console.error('Failed to revert label snapshot:', err);
  }
}

async function saveCurrentElements() {
  if (isCurrentTemplateLocked.value) {
    showStAlert('Template is locked (read-only mode). Please unlock first to save changes.', 'Template Locked', 'warning');
    return;
  }
  if (!currentLabel.value) return;
  isSaving.value = true;
  try {
    await flushTemplateSave();
    savedSnapshot.value = takeSnapshot(currentLabel.value);
    hasUnsavedChanges.value = false;
    showStAlert(`All elements and layout for "${currentLabelName.value}" saved successfully!`, 'Template Saved', 'success');
  } catch (err) {
    console.error('Failed to save template elements:', err);
    showStAlert('Failed to save template: ' + err.message, 'Save Error', 'danger');
  } finally {
    isSaving.value = false;
  }
}

async function handleSubTemplateChange(newId) {
  if (newId === (activeSubTemplateId.value || '')) return;
  if (hasUnsavedChanges.value) {
    const ok = await showStConfirm({
      title: 'Unsaved Changes',
      message: `You have unsaved changes in "${currentLabelName.value}". Discard them and switch?`,
      confirmText: 'Discard & Switch',
      cancelText: 'Stay on Current',
      type: 'warning'
    });
    if (!ok) return;
    revertCurrentLabelToSnapshot();
  }
  setActiveSubTemplate(newId);
  savedSnapshot.value = takeSnapshot(currentLabel.value);
  hasUnsavedChanges.value = false;
}

async function handleOpenTemplates() {
  if (hasUnsavedChanges.value) {
    const ok = await showStConfirm({
      title: 'Unsaved Changes',
      message: `You have unsaved element changes in "${currentLabelName.value}". Leave without saving?`,
      confirmText: 'Leave without saving',
      cancelText: 'Stay & Save',
      type: 'warning'
    });
    if (!ok) return;
    revertCurrentLabelToSnapshot();
  }
  emit('open-templates');
}

// ── Computed ───────────────────────────────────────────────────────────
const currentLabel = computed(() => activeSubTemplate.value || activeTemplate.value);

const currentLabelName = computed(() => {
  if (!activeTemplate.value) return '';
  if (activeSubTemplate.value) {
    return `${activeTemplate.value.name} / ${activeSubTemplate.value.name}`;
  }
  return activeTemplate.value.name;
});

const currentLabelNote = computed(() => currentLabel.value?.note || '');

const stCanvasConfig = computed(() => currentLabel.value?.config || { widthMm: 35, heightMm: 22, dpi: 300 });

const stElements = computed(() => {
  if (!currentLabel.value) return [];
  return activeLang.value === 'CN'
    ? (currentLabel.value.elements_cn || [])
    : (currentLabel.value.elements_en || []);
});

const itemNumbersString = computed(() =>
  (activeTemplate.value?.itemNumbers || []).join(', ')
);

const allAvailableProducts = computed(() => {
  return activeTemplate.value?.itemNumbers || [];
});

const activeProd = computed(() => {
  return stProductInput.value || activeTemplate.value?.itemNumbers?.[0] || 'S695 4120';
});

watch(
  () => activeTemplate.value?.itemNumbers,
  (items) => {
    if (Array.isArray(items) && items.length > 0) {
      if (!stProductInput.value || !items.includes(stProductInput.value)) {
        stProductInput.value = items[0];
      }
    } else if (!stProductInput.value) {
      stProductInput.value = 'S695 4120';
    }
  },
  { immediate: true }
);

const serialRange = computed(() =>
  generateSerialRange(stSerialNumbersInput.value, stEndSerialNumberInput.value)
);

const currentPreviewSN = computed(() => {
  if (!serialRange.value.length) return '12345678';
  const idx = Math.min(currentPreviewIndex.value, serialRange.value.length - 1);
  return serialRange.value[Math.max(0, idx)];
});

// ── Navigation ─────────────────────────────────────────────────────────
function prevPreviewPage() {
  if (currentPreviewIndex.value > 0) {
    currentPreviewIndex.value--;
  }
}

function nextPreviewPage() {
  if (currentPreviewIndex.value < serialRange.value.length - 1) {
    currentPreviewIndex.value++;
  }
}

// ── Fetch / Auto-match ─────────────────────────────────────────────────
function fetchFromOdooStub() {
  const sn = stSerialNumbersInput.value?.trim() || '';
  const matched = matchTemplateByItemNo(templates.value, sn);
  if (matched) {
    activeTemplateId.value = matched.id;
    showStAlert(`Auto-matched template "${matched.name}" for SN "${sn}".`, 'Odoo Data Sync', 'success');
  } else {
    showStAlert('In production, this button will query Odoo for MO / Serial Number details to populate template fields.', 'Odoo Data Sync Stub', 'info');
  }
}

function onCopyEnToCn() {
  if (isCurrentTemplateLocked.value) {
    showStAlert('Template is locked (read-only mode). Please unlock first.', 'Template Locked', 'warning');
    return;
  }
  storeCopyEnToCn(currentLabel.value);
  hasUnsavedChanges.value = true;
  showStAlert(`Copied EN layout to CN for "${currentLabelName.value}". Click "Save Changes" to commit!`, 'Copy EN → CN', 'info');
}

// ── Per-label JSON export / import (current editor elements & mid-variables) ────
function exportSingleTemplateJson() {
  const tpl = activeTemplate.value;
  const label = currentLabel.value;
  if (!label) return;
  const currentElements = activeLang.value === 'CN' ? (label.elements_cn || []) : (label.elements_en || []);

  const data = {
    name: currentLabelName.value,
    deviceName: tpl?.deviceName || '',
    note: tpl?.note || label.note || '',
    itemNumbers: tpl?.itemNumbers ? JSON.parse(JSON.stringify(tpl.itemNumbers)) : [],
    config: label.config ? JSON.parse(JSON.stringify(label.config)) : { widthMm: 35, heightMm: 22, dpi: 203 },
    elements: JSON.parse(JSON.stringify(currentElements)),
    elements_en: label.elements_en ? JSON.parse(JSON.stringify(label.elements_en)) : (activeLang.value === 'EN' ? JSON.parse(JSON.stringify(currentElements)) : []),
    elements_cn: label.elements_cn ? JSON.parse(JSON.stringify(label.elements_cn)) : (activeLang.value === 'CN' ? JSON.parse(JSON.stringify(currentElements)) : []),
    midVariables: tpl?.midVariables ? JSON.parse(JSON.stringify(tpl.midVariables)) : []
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (data.name || 'label').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `template_${safeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importSingleTemplateJson(event) {
  if (isCurrentTemplateLocked.value) {
    showStAlert('Template is locked (read-only mode). Please unlock first.', 'Template Locked', 'warning');
    if (event?.target) event.target.value = '';
    return;
  }
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const tpl = activeTemplate.value;
        const label = currentLabel.value;
        if (!label || !tpl) return;
        const ok = await showStConfirm({
          title: 'Import JSON Layout',
          message: `Importing will OVERWRITE the current editor elements and settings of "${currentLabelName.value}". Continue?`,
          confirmText: 'Import & Overwrite',
          type: 'warning'
        });
        if (!ok) {
          event.target.value = '';
          return;
        }
        if (data.config) {
          label.config = { ...label.config, ...data.config };
        }
        if (data.deviceName && !tpl.deviceName) {
          tpl.deviceName = data.deviceName;
        }
        if (data.note && !tpl.note) {
          tpl.note = data.note;
        }
        if (Array.isArray(data.itemNumbers) && data.itemNumbers.length > 0 && (!tpl.itemNumbers || tpl.itemNumbers.length === 0)) {
          tpl.itemNumbers = JSON.parse(JSON.stringify(data.itemNumbers));
        }

        // Import midVariables (mid-variables belonging to the template)
        let importedMidVarsCount = 0;
        if (Array.isArray(data.midVariables) && data.midVariables.length > 0) {
          tpl.midVariables = JSON.parse(JSON.stringify(data.midVariables));
          importedMidVarsCount = tpl.midVariables.length;
        }

        // Extract elements
        if (Array.isArray(data.elements_en) && data.elements_en.length > 0) {
          label.elements_en = JSON.parse(JSON.stringify(data.elements_en));
        }
        if (Array.isArray(data.elements_cn) && data.elements_cn.length > 0) {
          label.elements_cn = JSON.parse(JSON.stringify(data.elements_cn));
        }

        // Fallback for older json files that only had a single elements array
        if (Array.isArray(data.elements) && !data.elements_en && !data.elements_cn) {
          if (activeLang.value === 'CN') {
            label.elements_cn = JSON.parse(JSON.stringify(data.elements));
          } else {
            label.elements_en = JSON.parse(JSON.stringify(data.elements));
          }
        }

        hasUnsavedChanges.value = true;
        scheduleSave();
        updateCanvas();
        const midVarMsg = importedMidVarsCount > 0 ? ` (${importedMidVarsCount} mid-variables included)` : '';
        showStAlert(`Template elements and settings${midVarMsg} imported into editor for "${currentLabelName.value}". Click "Save Changes" to commit!`, 'Template Imported', 'info');
      } else {
        showStAlert('Invalid template JSON file format.', 'Import Failed', 'warning');
      }
    } catch (err) {
      console.error('Import template JSON error:', err);
      showStAlert('Failed to parse template JSON file: ' + err.message, 'Import Error', 'danger');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ── EZPL / EZPX / PDF Exports ──────────────────────────────────────────

/**
 * Graphic EZPL export — renders the full label canvas (including Chinese text, images,
 * barcodes, QR codes) as a 1-bit bitmap graphic per serial, then downloads a binary
 * EZPL file using native GW (Graphic Write) commands. No printer font required,
 * no Flash storage needed.
 */
async function exportGraphicEZPL() {
  const range = serialRange.value;
  if (!range.length) return;

  const currentProduct = activeProd.value;
  const devName        = activeTemplate.value?.deviceName || '';

  // Returns a binary Blob (GW command contains raw bitmap bytes)
  const blob = await compileGraphicEZPLRange(
    stElements.value,
    stCanvasConfig.value,
    range,
    { product: currentProduct, optionsText: stOptionsInput.value, deviceName: devName }
  );

  const rangeName = range.length > 1
    ? `${range[0]}_to_${range[range.length - 1]}`
    : range[0];

  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ST_Labels_Graphic_${rangeName.replace(/\s+/g, '_')}.ezpl`;
  a.click();
  URL.revokeObjectURL(url);
}


function langElements(container) {
  return activeLang.value === 'CN'
    ? (container.elements_cn || [])
    : (container.elements_en || []);
}

// Build one label definition per label design (main + each sub-template).
function buildLabelDefs() {
  const main = activeTemplate.value;
  if (!main) return [];
  
  const sanitize = (str, fallback) => {
    const s = String(str || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    return s || fallback;
  };

  const usedFilenames = new Set();
  const mainBase = sanitize(main.name, 'template');
  const mainFilename = `${mainBase}_main_label.ezpx.tmp`;
  usedFilenames.add(mainFilename);

  const defs = [{
    filename: mainFilename,
    name: main.name,
    elements: langElements(main),
    config: main.config || { widthMm: 35, heightMm: 22, dpi: 203 },
    midVariables: main.midVariables || []
  }];

  (main.subTemplates || []).forEach((sub, i) => {
    const subBase = sanitize(sub.name, `sub${i + 1}`);
    let fname = `${subBase}_label.ezpx.tmp`;
    if (usedFilenames.has(fname)) {
      fname = `${subBase}_${i + 1}_label.ezpx.tmp`;
    }
    usedFilenames.add(fname);
    defs.push({
      filename: fname,
      name: sub.name,
      elements: langElements(sub),
      config: sub.config || { widthMm: 35, heightMm: 22, dpi: 203 },
      midVariables: main.midVariables || []
    });
  });
  return defs;
}

async function exportEZPX() {
  const range = serialRange.value;
  const firstSN = range[0] || '12345678';
  const serials = range.length > 0 ? range : [firstSN];
  const currentProduct = activeProd.value;
  const extraContext = {
    midVariables: activeTemplate.value?.midVariables || [],
    ...(parsedCustomVars.value || {})
  };
  const opts = {
    labelsPerCut: 0,
    product: currentProduct,
    optionsText: stOptionsInput.value,
    deviceName: devName,
    csvDatabase: true,
    extra: extraContext
  };

  // Main + each sub-template produce their own .ezpx, all sharing data.csv
  const defs = buildLabelDefs();
  const xmls = [];
  for (const def of defs) {
    xmls.push(await compileEZPXRange(def.elements, def.config, serials, opts));
  }
  const csvContent = buildSerialCsv(serials, {
    defs,
    product: currentProduct,
    deviceName: devName,
    optionsText: stOptionsInput.value,
    extra: extraContext
  });

  // Filename shows range: firstSN_to_lastSN when multi
  const lastSN = range.length > 1 ? range[range.length - 1] : firstSN;
  const baseName = range.length > 1
    ? `label_${firstSN.replace(/\s+/g, '_')}_to_${lastSN.replace(/\s+/g, '_')}`
    : `label_${firstSN.replace(/\s+/g, '_')}`;

  const zip = new JSZip();
  defs.forEach((def, i) => zip.file(def.filename, xmls[i]));
  zip.file('data.csv', csvContent);
  zip.file('0_start.bat', START_BAT);
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyEZPL() {
  try {
    await navigator.clipboard.writeText(liveEzplCode.value);
    showStAlert(`EZPL code for ${serialRange.value.length} label(s) copied to clipboard!`, 'Copied', 'success');
  } catch (err) {
    console.error('Failed to copy EZPL code:', err);
  }
}

// ── Canvas Update ──────────────────────────────────────────────────────
function updateCanvas() {
  const canvas = previewCardRef.value?.canvasRef;
  if (canvas) {
    const currentProduct = activeProd.value;
    const devName = activeTemplate.value?.deviceName || '';
    renderStCanvasDynamic(canvas, stElements.value, stCanvasConfig.value, currentPreviewSN.value, currentProduct, stOptionsInput.value, devName, parsedCustomVars.value);
  }
}

// Ensure the bundled label fonts are fully loaded before drawing, so the
// canvas does not fall back to a different OS font (e.g. DejaVu Sans on
// Ubuntu) and stays pixel-identical across machines.
async function ensureLabelFonts() {
  try {
    if (document && document.fonts && document.fonts.load) {
      await Promise.all([
        document.fonts.load('400 10px "Noto Sans"'),
        document.fonts.load('700 10px "Noto Sans"'),
        document.fonts.load('400 10px "Noto Sans SC"')
      ]);
    }
  } catch (err) {
    console.warn('Font preload failed, using fallback fonts:', err);
  }
  await nextTick();
  updateCanvas();
}

watch(
  () => (currentLabel.value ? takeSnapshot(currentLabel.value) : ''),
  (newSnap) => {
    if (!savedSnapshot.value) {
      savedSnapshot.value = newSnap;
      hasUnsavedChanges.value = false;
      return;
    }
    hasUnsavedChanges.value = (newSnap !== savedSnapshot.value);
  }
);

watch(
  () => currentLabel.value?.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      savedSnapshot.value = takeSnapshot(currentLabel.value);
      hasUnsavedChanges.value = false;
    }
  }
);

watch(
  [activeTemplateId, activeSubTemplateId, activeLang, stSerialNumbersInput, stCustomVarsInput, stOptionsInput, stProductInput, currentPreviewIndex, templates],
  async () => {
    await nextTick();
    updateCanvas();
  },
  { deep: true }
);

function handleBeforeUnload(e) {
  if (hasUnsavedChanges.value) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
}

onMounted(async () => {
  window.addEventListener('beforeunload', handleBeforeUnload);
  if (!templatesLoaded.value) await loadTemplates();
  savedSnapshot.value = takeSnapshot(currentLabel.value);
  hasUnsavedChanges.value = false;
  await ensureLabelFonts();
  if (document && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => updateCanvas()).catch(() => {});
  }
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  hasUnsavedChanges.value = false;
});

// ── Interactive All Possible Configurations View ─────────────────────
function onOpenAllPossible() {
  const tplId = activeTemplateId.value;
  const prod = activeProd.value;
  const opt = stOptionsInput.value;
  const sn = currentPreviewSN.value;
  let url = `${window.location.origin}${window.location.pathname}?page=all-possible&id=${encodeURIComponent(tplId || '')}`;
  if (prod) url += `&item=${encodeURIComponent(prod)}`;
  if (opt) url += `&options=${encodeURIComponent(opt)}`;
  if (sn) url += `&sn=${encodeURIComponent(sn)}`;
  window.open(url, '_blank');
}

// ── Multi-Label PDF Download ───────────────────────────────────────────
function onDownloadPdf(e) {
  if (e && e.shiftKey) {
    downloadOptionsScenarioPDF();
  } else {
    downloadStPDF();
  }
}

// Shift+Click "Download PDF": generate a verification matrix PDF covering every
// meaningful combination of option codes. First serial only.
//
// Option codes are MUTUALLY EXCLUSIVE per element: an element shows either its
// fallback text ("nothing selected") OR exactly one of its mapped codes. So the
// scenario space is the cross-product of per-element states, not the full
// powerset of all codes (that would include impossible combos like A1410 + A1411
// together on the same element). Each scenario row shows the chosen codes +
// per-element resolved texts on the LEFT and the final rendered label on the
// RIGHT, so the user can verify all option mappings at once.
function collectOptionElements(container) {
  const elements = langElements(container);
  return (Array.isArray(elements) ? elements : []).filter(el =>
    el && (el.useOptionMapping || el.isOptionMode) &&
    Array.isArray(el.optionMappings) && el.optionMappings.length > 0
  );
}

// Possible states for ONE option-mapped element:
//   [{ codes: [] }]  -> fallback / nothing selected  (only if useDefaultText !== false)
//   + one entry per mapped code
function elementStates(el) {
  const states = [];
  // Required option (useDefaultText === false): the element must pick one of its
  // codes, so the empty state is NOT a valid scenario.
  if (el.useDefaultText !== false) {
    states.push({ codes: [] });
  }
  (Array.isArray(el.optionMappings) ? el.optionMappings : []).forEach(r => {
    const c = String(r.code || '').trim().toUpperCase();
    if (!c) return;
    states.push({ codes: [c] });
  });
  return states;
}

// Cross-product of per-element states. Returns [{ codes: [...], elementIndexes: [...] }].
// Dedupes by code set (two scenarios that resolve to the same selected codes produce
// the same label, so keep only the first).
function allOptionScenarios(elements) {
  const perElement = elements.map(elementStates);
  const totalStates = perElement.reduce((n, s) => n * s.length, 1);
  if (totalStates > 64) return { scenarios: [], totalStates };

  const scenarios = [];
  const seen = new Set();
  const numEl = perElement.length;
  // Iterate a mixed-radix counter over per-element states.
  const counters = new Array(numEl).fill(0);
  while (true) {
    const codes = [];
    for (let i = 0; i < numEl; i++) {
      const state = perElement[i][counters[i]];
      codes.push(...state.codes);
    }
    codes.sort();
    const key = codes.join('|');
    if (!seen.has(key)) {
      seen.add(key);
      scenarios.push({ codes });
    }
    // increment counter
    let k = numEl - 1;
    while (k >= 0) {
      counters[k]++;
      if (counters[k] < perElement[k].length) break;
      counters[k] = 0;
      k--;
    }
    if (k < 0) break;
  }
  return { scenarios, totalStates };
}

async function downloadOptionsScenarioPDF() {
  const label = currentLabel.value;
  if (!label) return;
  const optElements = collectOptionElements(label);
  if (optElements.length === 0) {
    showStAlert('This label has no option-mapped elements, so there are no option scenarios to verify.', 'No Options', 'warning');
    return;
  }

  const { scenarios, totalStates } = allOptionScenarios(optElements);
  if (totalStates > 64) {
    showStAlert(`This label produces ${totalStates} option combinations — too many to verify at once.`, 'Too Many Combinations', 'warning');
    return;
  }

  const config = currentLabel.value?.config || { widthMm: 35, heightMm: 22, dpi: 203 };
  const firstSN = serialRange.value[0] || '12345678';
  const currentProduct = activeProd.value;
  const devName = activeTemplate.value?.deviceName || '';

  const offscreenCanvas = document.createElement('canvas');
  const renderedScenarios = [];
  for (const sc of scenarios) {
    const optionsText = sc.codes.join(', ');
    await renderStCanvasDynamic(offscreenCanvas, langElements(label), config, firstSN, currentProduct, optionsText, devName, parsedCustomVars.value);
    const dataUrl = offscreenCanvas.toDataURL('image/png');
    const rows = optElements.map(el => {
      const resolved = resolveElementText(el, sc.codes, firstSN, currentProduct, devName, parsedCustomVars.value);
      return { name: el.name || el.type || 'element', text: resolved };
    });
    renderedScenarios.push({ codes: sc.codes, dataUrl, rows });
  }

  const w = config.widthMm || 35;
  const h = config.heightMm || 22;
  const labelAspect = w / h;

  const pageW = 297;   // A4 landscape mm
  const pageH = 210;
  const margin = 12;
  const gap = 8;
  const cols = 2;
  const rowsPerPage = 3;
  const cellW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
  const cellH = (pageH - margin * 2 - gap * (rowsPerPage - 1)) / rowsPerPage;
  let imgBoxH = cellH - 14;
  let imgBoxW = imgBoxH * labelAspect;
  // Guard: keep the image inside the right half of the cell, preserving aspect ratio.
  if (imgBoxW > (cellW - 40)) {
    imgBoxW = cellW - 40;
    imgBoxH = imgBoxW / labelAspect;
  }
  const leftW = cellW - imgBoxW - 10;

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  renderedScenarios.forEach((sc, idx) => {
    if (idx > 0 && idx % (cols * rowsPerPage) === 0) {
      pdf.addPage([pageW, pageH], 'landscape');
    }
    const within = idx % (cols * rowsPerPage);
    const col = within % cols;
    const row = Math.floor(within / cols);
    const x = margin + col * (cellW + gap);
    const y = margin + row * (cellH + gap);

    // Scenario header
    const comboLabel = sc.codes.length > 0 ? sc.codes.join(' + ') : '(no options)';
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(40, 40, 40);
    pdf.text(`Scenario ${idx + 1}: ${comboLabel}`, x + 4, y + 6);

    // LEFT: options + per-element resolved text
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    let ty = y + 12;
    sc.rows.forEach(r => {
      if (ty > y + cellH - 8) return;
      const line = `${r.name}: ${r.text}`;
      const wrapped = pdf.splitTextToSize(line, leftW);
      pdf.setTextColor(30, 30, 30);
      pdf.text(wrapped, x + 4, ty);
      ty += wrapped.length * 3.4;
    });

    // RIGHT: rendered label image
    const imgX = x + cellW - imgBoxW - 4;
    const imgY = y + (cellH - imgBoxH) / 2;
    pdf.addImage(sc.dataUrl, 'PNG', imgX, imgY, imgBoxW, imgBoxH);

    // Cell border
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.3);
    pdf.rect(x, y, cellW, cellH);
  });

  const safeName = (currentLabelName.value || 'label').replace(/[^a-zA-Z0-9_-]+/g, '_');
  pdf.save(`Options_Matrix_${safeName}.pdf`);
}

async function downloadStPDF() {
  const range = serialRange.value;
  if (!range.length) return;

  try {
    const w = stCanvasConfig.value.widthMm || 35;
    const h = stCanvasConfig.value.heightMm || 22;
    const orientation = w >= h ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ unit: 'mm', format: [w, h], orientation });
    const currentProduct = activeProd.value;
    const devName = activeTemplate.value?.deviceName || '';

    const offscreenCanvas = document.createElement('canvas');

    for (let i = 0; i < range.length; i++) {
      const sn = range[i];
      await renderStCanvasDynamic(offscreenCanvas, stElements.value, stCanvasConfig.value, sn, currentProduct, stOptionsInput.value, devName, parsedCustomVars.value);
      const dataUrl = offscreenCanvas.toDataURL('image/png');
      if (i > 0) {
        pdf.addPage([w, h], orientation);
      }
      pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);
    }

    const filename = range.length > 1
      ? `ST_Labels_${range[0]}_to_${range[range.length - 1]}_${range.length}pcs.pdf`.replace(/\s+/g, '_')
      : `ST_Label_${range[0]}.pdf`.replace(/\s+/g, '_');

    pdf.save(filename);
  } catch (err) {
    console.error('Error generating multi-label PDF:', err);
  }
}
</script>

<style scoped>
.st-designer-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.st-editor-layout {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 960px) {
  .st-editor-layout {
    grid-template-columns: 1fr;
  }
}

.st-editor-panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.st-preview-panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  position: sticky;
  top: 1rem;
  z-index: 10;
}

.st-editor-panel > * {
  flex: 1;
  min-height: 0;
}

/* ── Modal Overlay & Unlock Modal Dialog ── */
.st-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.st-modal-container.unlock-modal {
  background: #1e293b;
  color: #f8fafc;
  width: 90%;
  max-width: 440px;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  flex-direction: column;
}

.st-modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.st-modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: #f8fafc;
}

.close-modal-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.25rem;
  cursor: pointer;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.close-modal-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.st-modal-body {
  padding: 1.5rem;
}

.unlock-desc {
  margin: 0 0 16px 0;
  font-size: 0.9rem;
  color: #cbd5e1;
  line-height: 1.45;
}

.unlock-password-input {
  width: 100%;
  box-sizing: border-box;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #f8fafc;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.15s ease;
}

.unlock-password-input:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
}

.unlock-error-msg {
  color: #f87171;
  font-size: 0.82rem;
  margin-top: 8px;
  font-weight: 500;
}

.unlock-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.modal-cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.88rem;
  transition: all 0.15s ease;
}

.modal-cancel-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
}

.unlock-btn {
  background: #3b82f6 !important;
  color: #ffffff !important;
  padding: 8px 18px !important;
  border-radius: 6px !important;
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.88rem;
  transition: all 0.15s ease;
}

.unlock-btn:hover {
  background: #2563eb !important;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
