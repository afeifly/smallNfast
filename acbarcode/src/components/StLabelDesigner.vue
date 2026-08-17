<template>
  <div class="st-designer-container">
    <StHeaderActions 
      v-model="stSerialNumbersInput" 
      v-model:endValue="stEndSerialNumberInput"
      v-model:optionsValue="stOptionsInput"
      :range-count="serialRange.length"
      :active-template="activeTemplate"
      :active-sub-template-id="activeSubTemplateId"
      @update:active-sub-template-id="setActiveSubTemplate($event)"
      @fetch-odoo="fetchFromOdooStub"
      @open-odoo-modal="$emit('open-odoo-modal')"
      @open-templates="$emit('open-templates')"
    />

    <div class="st-editor-layout">
      <!-- LEFT PANEL: Elements Layer Manager -->
      <div class="st-editor-panel">
        <StElementsManagerCard :elements="stElements" :canvasConfig="stCanvasConfig" />
      </div>

      <!-- RIGHT PANEL: Template Basic Infos & Live Canvas Preview & Code Stream -->
      <div class="st-preview-panel">
        <StCanvasConfigCard 
          :config="stCanvasConfig"
          :template-name="currentLabelName"
          :template-note="currentLabelNote"
          :item-numbers="itemNumbersString"
          :active-lang="activeLang"
          @update:active-lang="activeLang = $event"
          @copy-from-en="onCopyEnToCn"
        />
        <StCanvasPreviewCard 
          ref="previewCardRef"
          :config="stCanvasConfig"
          :range-count="serialRange.length"
          :current-idx="currentPreviewIndex"
          :current-s-n="currentPreviewSN"
          @prev-page="prevPreviewPage"
          @next-page="nextPreviewPage"
          @export-ezpx="exportEZPX"
          @download-pdf="downloadStPDF"
          @export-template-json="exportSingleTemplateJson"
          @import-template-json="importSingleTemplateJson"
        />
        <StCodePreviewCard :code="liveEzplCode" />
      </div>
    </div>

    <!-- Custom Modal Dialogs -->
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, nextTick } from 'vue';
import jsPDF from 'jspdf';

import StHeaderActions from './st/StHeaderActions.vue';
import StCanvasConfigCard from './st/StCanvasConfigCard.vue';
import StElementsManagerCard from './st/StElementsManagerCard.vue';
import StCanvasPreviewCard from './st/StCanvasPreviewCard.vue';
import StCodePreviewCard from './st/StCodePreviewCard.vue';
import { showStAlert, showStConfirm } from '../utils/stDialog.js';

import { compileEZPL } from '../utils/stEzplCompiler.js';
import { compileEZPXRange, buildSerialCsv } from '../utils/stEzpxCompiler.js';
import { PRINT_LABELS_BAT } from '../utils/stGoLabelBatch.js';
import JSZip from 'jszip';
import { renderStCanvasDynamic } from '../utils/stCanvasRenderer.js';
import { generateSerialRange } from '../utils/stSerialRange.js';
import { matchTemplateByItemNo, DEFAULT_ELEMENTS_EN, DEFAULT_ELEMENTS_CN } from '../utils/stTemplateManager.js';
import {
  templates,
  activeTemplateId,
  activeTemplate,
  activeSubTemplateId,
  activeSubTemplate,
  templatesLoaded,
  loadTemplates,
  scheduleSave,
  copyEnToCn as storeCopyEnToCn,
  setActiveSubTemplate
} from '../stores/templateStore.js';

defineEmits(['open-odoo-modal', 'open-templates']);

// ── State ──────────────────────────────────────────────────────────────
const stSerialNumbersInput = ref('12345678');
const stEndSerialNumberInput = ref('');
const stOptionsInput = ref('');
const currentPreviewIndex = ref(0);
const previewCardRef = ref(null);
const activeLang = ref('EN'); // 'EN' | 'CN'

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

const stCanvasConfig = computed(() => currentLabel.value?.config || { widthMm: 35, heightMm: 22, dpi: 203 });

const stElements = computed(() => {
  if (!currentLabel.value) return [];
  return activeLang.value === 'CN'
    ? (currentLabel.value.elements_cn || [])
    : (currentLabel.value.elements_en || []);
});

const itemNumbersString = computed(() =>
  (activeTemplate.value?.itemNumbers || []).join(', ')
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
  storeCopyEnToCn(currentLabel.value);
  showStAlert(`Copied EN layout to CN for "${currentLabelName.value}".`, 'Copy EN → CN', 'success');
}

// ── Per-label JSON export / import ─────────────────────────────────────
function exportSingleTemplateJson() {
  const label = currentLabel.value;
  if (!label) return;
  const data = JSON.parse(JSON.stringify(label));
  data.name = currentLabelName.value;
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
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const label = currentLabel.value;
        if (!label) return;
        const ok = await showStConfirm({
          title: 'Import JSON Layout',
          message: `Importing will OVERWRITE the current layout of "${currentLabelName.value}" (elements EN/CN, size/DPI). Continue?`,
          confirmText: 'Import & Overwrite',
          type: 'warning'
        });
        if (!ok) {
          event.target.value = '';
          return;
        }
        const importedConfig = data.config || { widthMm: 35, heightMm: 22, dpi: 203 };
        const importedEn = data.elements_en || data.elements || JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_EN));
        const importedCn = data.elements_cn || data.elements || JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_CN));
        label.config = { ...importedConfig };
        label.elements_en = JSON.parse(JSON.stringify(importedEn));
        label.elements_cn = JSON.parse(JSON.stringify(importedCn));
        scheduleSave();
        showStAlert(`Layout imported into "${currentLabelName.value}"!`, 'Template Imported', 'success');
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
const liveEzplCode = computed(() => {
  const activeProd = activeTemplate.value?.itemNumbers?.[0] || 'S695 4035 (Air)';
  const devName = activeTemplate.value?.deviceName || '';
  return serialRange.value
    .map(sn => compileEZPL(stElements.value, stCanvasConfig.value, sn, activeProd, stOptionsInput.value, devName))
    .join('\n; ========================\n');
});

function exportEZPL() {
  const ezplText = liveEzplCode.value;
  const blob = new Blob([ezplText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const rangeName = serialRange.value.length > 1
    ? `${serialRange.value[0]}_to_${serialRange.value[serialRange.value.length - 1]}`
    : serialRange.value[0];
  a.download = `ST_Labels_${rangeName.replace(/\s+/g, '_')}.ezpl`;
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
  const mainFilename = `${mainBase}_main_label.ezpx`;
  usedFilenames.add(mainFilename);

  const defs = [{
    filename: mainFilename,
    name: main.name,
    elements: langElements(main),
    config: main.config || { widthMm: 35, heightMm: 22, dpi: 203 }
  }];

  (main.subTemplates || []).forEach((sub, i) => {
    const subBase = sanitize(sub.name, `sub${i + 1}`);
    let fname = `${subBase}_label.ezpx`;
    if (usedFilenames.has(fname)) {
      fname = `${subBase}_${i + 1}_label.ezpx`;
    }
    usedFilenames.add(fname);
    defs.push({
      filename: fname,
      name: sub.name,
      elements: langElements(sub),
      config: sub.config || { widthMm: 35, heightMm: 22, dpi: 203 }
    });
  });
  return defs;
}

async function exportEZPX() {
  const range = serialRange.value;
  const firstSN = range[0] || '12345678';
  const serials = range.length > 0 ? range : [firstSN];
  const activeProd = activeTemplate.value?.itemNumbers?.[0] || 'S695 4035 (Air)';
  const devName = activeTemplate.value?.deviceName || '';
  const opts = { labelsPerCut: 0, product: activeProd, optionsText: stOptionsInput.value, deviceName: devName, csvDatabase: true };

  // Main + each sub-template produce their own .ezpx, all sharing data.csv
  const defs = buildLabelDefs();
  const xmls = [];
  for (const def of defs) {
    xmls.push(await compileEZPXRange(def.elements, def.config, serials, opts));
  }
  const csvContent = buildSerialCsv(serials, {
    defs,
    product: activeProd,
    deviceName: devName,
    optionsText: stOptionsInput.value
  });

  // Filename shows range: firstSN_to_lastSN when multi
  const lastSN = range.length > 1 ? range[range.length - 1] : firstSN;
  const baseName = range.length > 1
    ? `label_${firstSN.replace(/\s+/g, '_')}_to_${lastSN.replace(/\s+/g, '_')}`
    : `label_${firstSN.replace(/\s+/g, '_')}`;

  const zip = new JSZip();
  defs.forEach((def, i) => zip.file(def.filename, xmls[i]));
  zip.file('data.csv', csvContent);
  zip.file('print_labels.bat', PRINT_LABELS_BAT);
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
    const activeProd = activeTemplate.value?.itemNumbers?.[0] || 'S695 4035 (Air)';
    const devName = activeTemplate.value?.deviceName || '';
    renderStCanvasDynamic(canvas, stElements.value, stCanvasConfig.value, currentPreviewSN.value, activeProd, stOptionsInput.value, devName);
  }
}

watch(
  [activeTemplateId, activeSubTemplateId, activeLang, stSerialNumbersInput, stEndSerialNumberInput, stOptionsInput, currentPreviewIndex, templates],
  async () => {
    if (templatesLoaded.value) {
      scheduleSave();
    }
    await nextTick();
    updateCanvas();
  },
  { deep: true }
);

onMounted(async () => {
  if (!templatesLoaded.value) await loadTemplates();
  await nextTick();
  updateCanvas();
});

// ── Multi-Label PDF Download ───────────────────────────────────────────
async function downloadStPDF() {
  const range = serialRange.value;
  if (!range.length) return;

  try {
    const w = stCanvasConfig.value.widthMm || 35;
    const h = stCanvasConfig.value.heightMm || 22;
    const orientation = w >= h ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ unit: 'mm', format: [w, h], orientation });
    const activeProd = activeTemplate.value?.itemNumbers?.[0] || 'S695 4035 (Air)';
    const devName = activeTemplate.value?.deviceName || '';

    const offscreenCanvas = document.createElement('canvas');

    for (let i = 0; i < range.length; i++) {
      const sn = range[i];
      await renderStCanvasDynamic(offscreenCanvas, stElements.value, stCanvasConfig.value, sn, activeProd, stOptionsInput.value, devName);
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
  align-items: stretch;
}

@media (max-width: 960px) {
  .st-editor-layout {
    grid-template-columns: 1fr;
  }
}

.st-editor-panel, .st-preview-panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.st-editor-panel > * {
  flex: 1;
  min-height: 0;
}
</style>
