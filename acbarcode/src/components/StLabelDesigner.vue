<template>
  <div class="st-designer-container">
    <StHeaderActions 
      v-model="stSerialNumbersInput" 
      v-model:endValue="stEndSerialNumberInput"
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
        />
        <StCanvasPreviewCard 
          ref="previewCardRef"
          :config="stCanvasConfig"
          :range-count="serialRange.length"
          :current-idx="currentPreviewIndex"
          :current-s-n="currentPreviewSN"
          @prev-page="prevPreviewPage"
          @next-page="nextPreviewPage"
          @export-ezpl="exportEZPL"
          @export-ezpx="exportEZPX"
          @copy-ezpl="copyEZPL"
          @download-pdf="downloadStPDF"
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
      @export-json="onExportJson"
      @import-json="onImportJson"
      @import-ezpx="onImportEzpx"
      @paste-ezpx="onPasteEzpx"
    />
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

import { compileEZPL } from '../utils/stEzplCompiler.js';
import { compileEZPX, compileEZPXRange } from '../utils/stEzpxCompiler.js';
import { parseEzpxXmlToTemplate } from '../utils/stEzpxParser.js';
import { renderStCanvasDynamic } from '../utils/stCanvasRenderer.js';
import { generateSerialRange } from '../utils/stSerialRange.js';
import {
  loadTemplatesFromStorage,
  saveTemplatesToStorage,
  matchTemplateByItemNo,
  createInitialDefaultTemplates,
  DEFAULT_ELEMENTS_EN,
  DEFAULT_ELEMENTS_CN
} from '../utils/stTemplateManager.js';

defineEmits(['open-odoo-modal']);

// ── State ──────────────────────────────────────────────────────────────
const stSerialNumbersInput = ref('12345678');
const stEndSerialNumberInput = ref('');
const currentPreviewIndex = ref(0);
const previewCardRef = ref(null);
const showTemplateModal = ref(false);

const templates = ref(loadTemplatesFromStorage());
const activeTemplateId = ref(templates.value[0]?.id || '');
const activeLang = ref('EN'); // 'EN' | 'CN'

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
    alert(`🔄 Odoo Stub: Auto-matched template "${matched.name}" for SN "${sn}".`);
  } else {
    alert('🔄 Odoo Data Sync Stub:\nIn production, this will query Odoo for MO / Serial Number details.');
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
  saveTemplatesToStorage(templates.value);
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
  saveTemplatesToStorage(templates.value);
}

function onDuplicateTemplate() {
  if (!activeTemplate.value) return;
  const clone = JSON.parse(JSON.stringify(activeTemplate.value));
  clone.id = generateId();
  clone.name = clone.name + ' (Copy)';
  templates.value.push(clone);
  activeTemplateId.value = clone.id;
  saveTemplatesToStorage(templates.value);
}

function onDeleteTemplate() {
  if (templates.value.length <= 1) return;
  const idx = templates.value.findIndex(t => t.id === activeTemplateId.value);
  templates.value.splice(idx, 1);
  activeTemplateId.value = templates.value[Math.max(0, idx - 1)]?.id || templates.value[0]?.id;
  saveTemplatesToStorage(templates.value);
}

function onResetDefaults() {
  if (!activeTemplate.value) return;
  activeTemplate.value.elements_en = JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_EN));
  activeTemplate.value.elements_cn = JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_CN));
  activeTemplate.value.config = { widthMm: 35, heightMm: 22, dpi: 203 };
  saveTemplatesToStorage(templates.value);
}

function onExportJson() {
  const json = JSON.stringify(templates.value, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'st_templates_backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

function onImportJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data) && data.length > 0) {
        templates.value = data;
        activeTemplateId.value = data[0].id;
        saveTemplatesToStorage(templates.value);
        alert('📥 Templates restored successfully!');
      } else {
        alert('Invalid JSON: Expected an array of templates.');
      }
    } catch (err) {
      alert('Failed to parse JSON file.');
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
        saveTemplatesToStorage(templates.value);
        alert(`📥 EZPX Template "${newTpl.name}" imported with ${newTpl.elements_en.length} elements!`);
      } else {
        alert('Could not parse any elements from the provided EZPX file.');
      }
    } catch (err) {
      console.error('EZPX import error:', err);
      alert('Failed to parse EZPX file: ' + err.message);
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
      saveTemplatesToStorage(templates.value);
      alert(`🎉 EZPX Template "${newTpl.name}" created with ${newTpl.elements_en.length} elements!`);
    } else {
      alert('Could not parse any elements from the pasted EZPX text.');
    }
  } catch (err) {
    console.error('EZPX paste error:', err);
    alert('Failed to parse EZPX XML text: ' + err.message);
  }
}

// ── EZPL / EZPX / PDF Exports ──────────────────────────────────────────
const liveEzplCode = computed(() => {
  return serialRange.value
    .map(sn => compileEZPL(stElements.value, stCanvasConfig.value, sn))
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
  // Use compileEZPXRange so GoLabel auto-increments serial across all labels in range
  const ezpxXml = await compileEZPXRange(
    stElements.value,
    stCanvasConfig.value,
    range.length > 0 ? range : [firstSN],
    { labelsPerCut: 0, product: activeProd }
  );
  const blob = new Blob([ezpxXml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // Filename shows range: firstSN_to_lastSN when multi
  const lastSN = range.length > 1 ? range[range.length - 1] : firstSN;
  const fname = range.length > 1
    ? `label_${firstSN.replace(/\s+/g, '_')}_to_${lastSN.replace(/\s+/g, '_')}.ezpx`
    : `label_${firstSN.replace(/\s+/g, '_')}.ezpx`;
  a.download = fname;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyEZPL() {
  try {
    await navigator.clipboard.writeText(liveEzplCode.value);
    alert(`📋 EZPL code for ${serialRange.value.length} label(s) copied to clipboard!`);
  } catch (err) {
    console.error('Failed to copy EZPL code:', err);
  }
}

// ── Canvas Update ──────────────────────────────────────────────────────
function updateCanvas() {
  const canvas = previewCardRef.value?.canvasRef;
  if (canvas) {
    const activeProd = activeTemplate.value?.itemNumbers?.[0] || 'S695 4035 (Air)';
    renderStCanvasDynamic(canvas, stElements.value, stCanvasConfig.value, currentPreviewSN.value, activeProd);
  }
}

watch(
  [activeTemplateId, activeLang, stSerialNumbersInput, stEndSerialNumberInput, currentPreviewIndex, templates],
  async () => {
    saveTemplatesToStorage(templates.value);
    await nextTick();
    updateCanvas();
  },
  { deep: true }
);

onMounted(() => {
  nextTick(() => {
    updateCanvas();
  });
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

    const offscreenCanvas = document.createElement('canvas');

    for (let i = 0; i < range.length; i++) {
      const sn = range[i];
      await renderStCanvasDynamic(offscreenCanvas, stElements.value, stCanvasConfig.value, sn);
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
