<template>
  <div class="st-designer-container">
    <StHeaderActions 
      v-model="stSerialNumbersInput" 
      v-model:endValue="stEndSerialNumberInput"
      v-model:optionsValue="stOptionsInput"
      :range-count="serialRange.length"
      @fetch-odoo="fetchFromOdooStub"
      @open-odoo-modal="$emit('open-odoo-modal')"
      @open-template-modal="showTemplateModal = true"
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
          :template-name="activeTemplate?.name || ''"
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

    <!-- Template Manager Modal -->
    <StTemplateModal
      v-if="showTemplateModal"
      :templates="templates"
      :active-template-id="activeTemplateId"
      @close="showTemplateModal = false"
      @update:active-template-id="activeTemplateId = $event"
      @update:template-field="onUpdateTemplateField"
      @create-new="onCreateNewTemplate"
      @duplicate="onDuplicateTemplate"
      @delete="onDeleteTemplate"
      @reset-defaults="onResetDefaults"
      @import-ezpx="onImportEzpx"
      @paste-ezpx="onPasteEzpx"
    />

    <!-- Custom Modal Dialogs -->
    <StConfirmDialog />
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
import StTemplateModal from './st/StTemplateModal.vue';
import StConfirmDialog from './st/StConfirmDialog.vue';
import { showStAlert, showStConfirm } from '../utils/stDialog.js';

import { compileEZPL } from '../utils/stEzplCompiler.js';
import { compileEZPX, compileEZPXRange, buildSerialCsv } from '../utils/stEzpxCompiler.js';
import { PRINT_LABELS_BAT } from '../utils/stGoLabelBatch.js';
import JSZip from 'jszip';
import { parseEzpxXmlToTemplate } from '../utils/stEzpxParser.js';
import { renderStCanvasDynamic } from '../utils/stCanvasRenderer.js';
import { generateSerialRange } from '../utils/stSerialRange.js';
import {
  fetchTemplatesFromServer,
  saveTemplatesToServer,
  matchTemplateByItemNo,
  createInitialDefaultTemplates,
  DEFAULT_ELEMENTS_EN,
  DEFAULT_ELEMENTS_CN
} from '../utils/stTemplateManager.js';

defineEmits(['open-odoo-modal']);

// ── State ──────────────────────────────────────────────────────────────
const stSerialNumbersInput = ref('12345678');
const stEndSerialNumberInput = ref('');
const stOptionsInput = ref('');
const currentPreviewIndex = ref(0);
const previewCardRef = ref(null);
const showTemplateModal = ref(false);

const templates = ref([]);
const activeTemplateId = ref('');
const activeLang = ref('EN'); // 'EN' | 'CN'
const templatesLoaded = ref(false);

// ── Server save (debounced) ────────────────────────────────────────────
let saveTimer = null;
function scheduleTemplateSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTemplateNow();
  }, 800);
}

async function flushTemplateSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  await saveTemplateNow();
}

async function saveTemplateNow() {
  try {
    await saveTemplatesToServer(templates.value);
  } catch (err) {
    console.error('Failed to save templates to server:', err);
    showStAlert('Failed to save templates: ' + err.message, 'Save Error', 'danger');
  }
}

// ── Computed ───────────────────────────────────────────────────────────
const activeTemplate = computed(() =>
  templates.value.find(t => t.id === activeTemplateId.value) || templates.value[0]
);

const stCanvasConfig = computed(() => activeTemplate.value?.config || { widthMm: 35, heightMm: 22, dpi: 203 });

const stElements = computed(() =>
  activeLang.value === 'CN'
    ? (activeTemplate.value?.elements_cn || [])
    : (activeTemplate.value?.elements_en || [])
);

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

// ── Template Modal Actions ─────────────────────────────────────────────
function generateId() {
  return 'tpl_' + Math.random().toString(36).substr(2, 9);
}

function onUpdateTemplateField({ id, name, itemNumbers, config }) {
  const tpl = templates.value.find(t => t.id === id);
  if (!tpl) return;
  tpl.name = name;
  tpl.itemNumbers = itemNumbers;
  tpl.config = { ...config };
  scheduleTemplateSave();
}

function onCopyEnToCn() {
  if (!activeTemplate.value) return;
  activeTemplate.value.elements_cn = JSON.parse(JSON.stringify(activeTemplate.value.elements_en || []));
  scheduleTemplateSave();
}

function onCreateNewTemplate() {
  const newTpl = {
    id: generateId(),
    name: 'New Template',
    itemNumbers: [],
    config: { widthMm: 35, heightMm: 22, dpi: 203 },
    elements_en: JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_EN)),
    elements_cn: JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_CN))
  };
  templates.value.push(newTpl);
  activeTemplateId.value = newTpl.id;
  scheduleTemplateSave();
}

function onDuplicateTemplate() {
  if (!activeTemplate.value) return;
  const clone = JSON.parse(JSON.stringify(activeTemplate.value));
  clone.id = generateId();
  clone.name = clone.name + ' (Copy)';
  templates.value.push(clone);
  activeTemplateId.value = clone.id;
  scheduleTemplateSave();
}

function onDeleteTemplate() {
  if (templates.value.length <= 1) return;
  const idx = templates.value.findIndex(t => t.id === activeTemplateId.value);
  templates.value.splice(idx, 1);
  activeTemplateId.value = templates.value[Math.max(0, idx - 1)]?.id || templates.value[0]?.id;
  scheduleTemplateSave();
}

function onResetDefaults() {
  if (!activeTemplate.value) return;
  activeTemplate.value.elements_en = JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_EN));
  activeTemplate.value.elements_cn = JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_CN));
  activeTemplate.value.config = { widthMm: 35, heightMm: 22, dpi: 203 };
  scheduleTemplateSave();
}

function exportSingleTemplateJson() {
  if (!activeTemplate.value) return;
  const tpl = JSON.parse(JSON.stringify(activeTemplate.value));
  const jsonStr = JSON.stringify(tpl, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (tpl.name || 'template').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `template_${safeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importSingleTemplateJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const importedConfig = data.config || { widthMm: 35, heightMm: 22, dpi: 203 };
        const importedEn = data.elements_en || data.elements || JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_EN));
        const importedCn = data.elements_cn || data.elements || JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_CN));

        if (activeTemplate.value) {
          // Preserve current template name & itemNumbers intact! Only update label size/DPI config and element layers
          activeTemplate.value.config = { ...importedConfig };
          activeTemplate.value.elements_en = JSON.parse(JSON.stringify(importedEn));
          activeTemplate.value.elements_cn = JSON.parse(JSON.stringify(importedCn));
        } else {
          const newTpl = {
            id: data.id || generateId(),
            name: data.name || 'Imported Template',
            itemNumbers: Array.isArray(data.itemNumbers) ? data.itemNumbers : [],
            config: importedConfig,
            elements_en: importedEn,
            elements_cn: importedCn
          };
          templates.value.push(newTpl);
          activeTemplateId.value = newTpl.id;
        }

        scheduleTemplateSave();
        showStAlert(`Template layout imported into "${activeTemplate.value?.name}"!`, 'Template Imported', 'success');
      } else if (Array.isArray(data) && data.length > 0) {
        templates.value = data;
        activeTemplateId.value = data[0].id;
        scheduleTemplateSave();
        showStAlert('All templates imported!', 'Import Successful', 'success');
      } else {
        showStAlert('Invalid template JSON file format.', 'Import Failed', 'warning');
      }
    } catch (err) {
      console.error('Import template JSON error:', err);
      showStAlert('Failed to parse template JSON file: ' + err.message, 'Import Error', 'danger');
    }
  };
  reader.readAsText(file);
}

function onImportEzpx(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const xmlStr = e.target.result;
      const newTpl = parseEzpxXmlToTemplate(xmlStr, file.name);
      if (newTpl && newTpl.elements_en?.length) {
        templates.value.push(newTpl);
        activeTemplateId.value = newTpl.id;
        scheduleTemplateSave();
        showStAlert(`EZPX Template "${newTpl.name}" imported with ${newTpl.elements_en.length} elements!`, 'EZPX Import', 'success');
      } else {
        showStAlert('Could not parse any elements from the provided EZPX file.', 'EZPX Import Failed', 'warning');
      }
    } catch (err) {
      console.error('EZPX import error:', err);
      showStAlert('Failed to parse EZPX file: ' + err.message, 'EZPX Import Error', 'danger');
    }
  };
  reader.readAsText(file);
}

function onPasteEzpx(xmlStr) {
  if (!xmlStr || typeof xmlStr !== 'string' || !xmlStr.trim()) return;
  try {
    const newTpl = parseEzpxXmlToTemplate(xmlStr.trim(), 'Pasted EZPX Template');
    if (newTpl && newTpl.elements_en?.length) {
      templates.value.push(newTpl);
      activeTemplateId.value = newTpl.id;
      scheduleTemplateSave();
      showStAlert(`EZPX Template "${newTpl.name}" created with ${newTpl.elements_en.length} elements!`, 'EZPX Paste', 'success');
    } else {
      showStAlert('Could not parse any elements from the pasted EZPX text.', 'EZPX Paste Failed', 'warning');
    }
  } catch (err) {
    console.error('EZPX paste error:', err);
    showStAlert('Failed to parse EZPX XML text: ' + err.message, 'EZPX Paste Error', 'danger');
  }
}

// ── EZPL / EZPX / PDF Exports ──────────────────────────────────────────
const liveEzplCode = computed(() => {
  const activeProd = activeTemplate.value?.itemNumbers?.[0] || 'S695 4035 (Air)';
  return serialRange.value
    .map(sn => compileEZPL(stElements.value, stCanvasConfig.value, sn, activeProd, stOptionsInput.value))
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

async function exportEZPX() {
  const range = serialRange.value;
  const firstSN = range[0] || '12345678';
  const activeProd = activeTemplate.value?.itemNumbers?.[0] || 'S695 4035 (Air)';
  const serials = range.length > 0 ? range : [firstSN];

  // CSV-database mode: GoLabel loads SNs from data.csv (one row per label)
  // and prints all labels in one run instead of using the ^C00 serial counter.
  const ezpxXml = await compileEZPXRange(
    stElements.value,
    stCanvasConfig.value,
    serials,
    { labelsPerCut: 0, product: activeProd, optionsText: stOptionsInput.value, csvDatabase: true }
  );
  const csvContent = buildSerialCsv(serials);

  // Filename shows range: firstSN_to_lastSN when multi
  const lastSN = range.length > 1 ? range[range.length - 1] : firstSN;
  const baseName = range.length > 1
    ? `label_${firstSN.replace(/\s+/g, '_')}_to_${lastSN.replace(/\s+/g, '_')}`
    : `label_${firstSN.replace(/\s+/g, '_')}`;

  // Package the .ezpx, data.csv and a Windows helper .bat into one ZIP download
  const zip = new JSZip();
  zip.file(`${baseName}.ezpx`, ezpxXml);
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
    renderStCanvasDynamic(canvas, stElements.value, stCanvasConfig.value, currentPreviewSN.value, activeProd, stOptionsInput.value);
  }
}

watch(
  [activeTemplateId, activeLang, stSerialNumbersInput, stEndSerialNumberInput, stOptionsInput, currentPreviewIndex, templates],
  async () => {
    if (templatesLoaded.value) {
      scheduleTemplateSave();
    }
    await nextTick();
    updateCanvas();
  },
  { deep: true }
);

onMounted(async () => {
  try {
    templates.value = await fetchTemplatesFromServer();
  } catch (err) {
    console.error('Failed to load templates from server:', err);
    templates.value = createInitialDefaultTemplates();
    showStAlert('Failed to load templates from server: ' + err.message, 'Load Error', 'danger');
  }
  if (templates.value.length > 0) {
    activeTemplateId.value = templates.value[0].id;
  }
  // Wait until the deep watcher has run on the freshly loaded data before
  // enabling saves, so the initial load is not written straight back.
  await nextTick();
  templatesLoaded.value = true;
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

    const offscreenCanvas = document.createElement('canvas');

    for (let i = 0; i < range.length; i++) {
      const sn = range[i];
      await renderStCanvasDynamic(offscreenCanvas, stElements.value, stCanvasConfig.value, sn, activeProd, stOptionsInput.value);
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
  gap: 1.5rem;
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
