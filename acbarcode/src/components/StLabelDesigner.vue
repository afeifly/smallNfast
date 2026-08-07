<template>
  <div class="st-designer-container">
    <StHeaderActions 
      v-model="stSerialNumbersInput" 
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
          @export-ezpl="exportEZPL"
          @export-ezpx="exportEZPX"
          @copy-ezpl="copyEZPL"
          @download-pdf="downloadStSinglePDF"
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
import { compileEZPX } from '../utils/stEzpxCompiler.js';
import { renderStCanvasDynamic } from '../utils/stCanvasRenderer.js';
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
const stSerialNumbersInput = ref('3726 0001');
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

// ── Fetch / Auto-match ─────────────────────────────────────────────────
function fetchFromOdooStub() {
  // Attempt item-number auto-match from SN input as a demo
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

// Fired from modal when user clicks "Apply Changes"
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

// ── EZPL / EZPX Exports ────────────────────────────────────────────────
const liveEzplCode = computed(() => {
  const firstSerial = (stSerialNumbersInput.value || '').split(/\r?\n/)[0]?.trim() || '3726 0001';
  return compileEZPL(stElements.value, stCanvasConfig.value, firstSerial);
});

function exportEZPL() {
  const firstSerial = (stSerialNumbersInput.value || '').split(/\r?\n/)[0]?.trim() || '3726 0001';
  const ezplText = compileEZPL(stElements.value, stCanvasConfig.value, firstSerial);
  const blob = new Blob([ezplText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `label_${firstSerial.replace(/\s+/g, '_')}.ezpl`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportEZPX() {
  const firstSerial = (stSerialNumbersInput.value || '').split(/\r?\n/)[0]?.trim() || '3726 0001';
  const ezpxXml = await compileEZPX(stElements.value, stCanvasConfig.value, firstSerial);
  const blob = new Blob([ezpxXml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `label_${firstSerial.replace(/\s+/g, '_')}.ezpx`;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyEZPL() {
  const firstSerial = (stSerialNumbersInput.value || '').split(/\r?\n/)[0]?.trim() || '3726 0001';
  const ezplText = compileEZPL(stElements.value, stCanvasConfig.value, firstSerial);
  try {
    await navigator.clipboard.writeText(ezplText);
    alert('📋 EZPL command code copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy EZPL code:', err);
  }
}

// ── Canvas Update ──────────────────────────────────────────────────────
function updateCanvas() {
  const canvas = previewCardRef.value?.canvasRef;
  const firstSerial = (stSerialNumbersInput.value || '').split(/\r?\n/)[0]?.trim() || '3726 0001';
  if (canvas) {
    renderStCanvasDynamic(canvas, stElements.value, stCanvasConfig.value, firstSerial);
  }
}

watch(
  [activeTemplateId, activeLang, stSerialNumbersInput, templates],
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

// ── PDF Download ───────────────────────────────────────────────────────
function downloadStSinglePDF() {
  const canvas = previewCardRef.value?.canvasRef;
  if (!canvas) return;
  const firstSerial = (stSerialNumbersInput.value || '').split(/\r?\n/)[0]?.trim() || '3726 0001';
  try {
    const w = stCanvasConfig.value.widthMm || 35;
    const h = stCanvasConfig.value.heightMm || 22;
    const pdf = new jsPDF({ unit: 'mm', format: [w, h], orientation: w >= h ? 'landscape' : 'portrait' });
    const dataUrl = canvas.toDataURL('image/png');
    pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);
    pdf.save(`ST_Label_${firstSerial.replace(/\s+/g, '_')}.pdf`);
  } catch (err) {
    console.error('Error downloading ST PDF:', err);
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
  align-items: start;
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
</style>
