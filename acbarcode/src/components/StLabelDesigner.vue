<template>
  <div class="st-designer-container">
    <StHeaderActions 
      v-model="stSerialNumbersInput" 
      @fetch-odoo="fetchFromOdooStub"
      @open-odoo-modal="$emit('open-odoo-modal')"
    />

    <div class="st-editor-layout">
      <!-- LEFT PANEL: Label Settings & Elements Layer Manager -->
      <div class="st-editor-panel">
        <StCanvasConfigCard :config="stCanvasConfig" />
        <StElementsManagerCard :elements="stElements" :canvasConfig="stCanvasConfig" />
      </div>

      <!-- RIGHT PANEL: Live Canvas Preview & Code Stream -->
      <div class="st-preview-panel">
        <StCanvasPreviewCard 
          ref="previewCardRef"
          :config="stCanvasConfig"
          @export-ezpl="exportEZPL"
          @export-ezpx="exportEZPX"
          @copy-ezpl="copyEZPL"
          @download-pdf="downloadStSinglePDF"
          @save-template="saveStTemplate"
          @load-template="loadStTemplate"
        />
        <StCodePreviewCard :code="liveEzplCode" />
      </div>
    </div>
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

import { compileEZPL } from '../utils/stEzplCompiler.js';
import { compileEZPX } from '../utils/stEzpxCompiler.js';
import { renderStCanvasDynamic } from '../utils/stCanvasRenderer.js';

defineEmits(['open-odoo-modal']);

const stSerialNumbersInput = ref('3726 0001');
const previewCardRef = ref(null);

const LOCAL_STORAGE_KEY = 'acbarcode_st_template';

function getInitialStTemplate() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.elements && Array.isArray(data.elements)) {
        const sep = data.elements.find(e => e.id === 'el_separator' || e.name === 'Vertical Separator');
        if (sep) {
          sep.lineShape = 'VLine';
          if (sep.y1Mm === undefined) {
            sep.y1Mm = sep.heightMm ? sep.yMm + sep.heightMm : 17.3;
          }
          if (sep.xMm === 27.0 || sep.xMm === 24.6 || sep.xMm === 23.8) {
            sep.xMm = 19.6;
            sep.yMm = 14.3;
            sep.y1Mm = 17.3;
          }
        }
        return data;
      }
    }
  } catch (e) {
    console.warn('Failed to parse initial saved template:', e);
  }
  return null;
}

const savedStTemplate = getInitialStTemplate();

const stCanvasConfig = ref(savedStTemplate?.config || {
  widthMm: 35,
  heightMm: 22,
  dpi: 203
});

const stElements = ref(savedStTemplate?.elements || [
  {
    id: 'el_logo',
    type: 'image',
    name: 'Logo',
    src: '/t_logo.jpg',
    xMm: 1,
    yMm: 1,
    widthMm: 9.6,
    storedName: 'LOGO',
    expanded: true
  },
  {
    id: 'el_header_url',
    type: 'text',
    name: 'Header URL',
    text: 'www.suto-itec.com',
    xMm: 15.5,
    yMm: 1.8,
    fontSize: 5,
    bold: true,
    expanded: false
  },
  {
    id: 'el_divider',
    type: 'hline',
    name: 'Top Divider Line',
    xMm: 1,
    yMm: 4.2,
    x1Mm: 34,
    thicknessDots: 9,
    expanded: false
  },
  {
    id: 'el_model',
    type: 'text',
    name: 'Model Title',
    text: 'Model: S403 | Thermal Mass Flow',
    xMm: 1,
    yMm: 4.8,
    fontSize: 5,
    bold: true,
    expanded: false
  },
  {
    id: 'el_item_no',
    type: 'text',
    name: 'Item No.',
    text: 'Item No.: S695 4035 (Air)',
    xMm: 1,
    yMm: 7.2,
    fontSize: 4,
    bold: true,
    expanded: false
  },
  {
    id: 'el_serial',
    type: 'text',
    name: 'Serial No.',
    text: 'Serial No.: {{serial}}',
    xMm: 1,
    yMm: 8.9,
    fontSize: 4,
    bold: true,
    expanded: false
  },
  {
    id: 'el_range',
    type: 'text',
    name: 'Range',
    text: 'Range: Standard',
    xMm: 1,
    yMm: 10.6,
    fontSize: 4,
    bold: true,
    expanded: false
  },
  {
    id: 'el_fieldbus',
    type: 'text',
    name: 'Fieldbus',
    text: 'Fieldbus: Modbus/RTU+Analog',
    xMm: 1,
    yMm: 12.3,
    fontSize: 4,
    bold: true,
    expanded: false
  },
  {
    id: 'el_power',
    type: 'text',
    name: 'Power supply',
    text: 'Power supply: 16...30 VDC',
    xMm: 1,
    yMm: 14.2,
    fontSize: 4,
    bold: true,
    expanded: false
  },
  {
    id: 'el_pressure',
    type: 'text',
    name: 'Max. Pressure',
    text: 'Max. Pressure: 5.0 MPa(g)',
    xMm: 1,
    yMm: 15.9,
    fontSize: 4,
    bold: true,
    expanded: false
  },
  {
    id: 'el_separator',
    type: 'hline',
    lineShape: 'VLine',
    name: 'Vertical Separator',
    xMm: 19.6,
    yMm: 14.3,
    y1Mm: 17.3,
    thicknessDots: 5,
    expanded: false
  },
  {
    id: 'el_accuracy',
    type: 'text',
    name: 'Accuracy',
    text: 'Accuracy: 1.5%',
    xMm: 20.4,
    yMm: 14.2,
    fontSize: 4,
    bold: true,
    expanded: false
  },
  {
    id: 'el_mfd',
    type: 'text',
    name: 'MFD',
    text: 'MFD: 2027-07',
    xMm: 20.4,
    yMm: 15.9,
    fontSize: 4,
    bold: true,
    expanded: false
  },
  {
    id: 'el_bgx',
    type: 'image',
    name: 'Bottom Right Image',
    src: '/b_bgx.png',
    xMm: 18,
    yMm: 17.6,
    widthMm: 16,
    storedName: 'BGX',
    autoBottomRight: true,
    expanded: false
  }
]);

function fetchFromOdooStub() {
  alert('🔄 Odoo Data Sync Stub:\nIn production, this button will query Odoo for MO / Serial Number details and populate template text fields!');
}

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

function saveStTemplate() {
  const data = {
    config: stCanvasConfig.value,
    elements: stElements.value
  };
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  alert('💾 Label Template saved successfully to local storage!');
}

function loadStTemplate() {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (data.config) stCanvasConfig.value = data.config;
      if (data.elements) stElements.value = data.elements;
      alert('📂 Label Template loaded successfully!');
    } catch (err) {
      alert('Failed to parse saved template.');
    }
  } else {
    alert('No saved template found in local storage.');
  }
}

function autoSaveStTemplate() {
  const data = {
    config: stCanvasConfig.value,
    elements: stElements.value
  };
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Auto-save to localStorage failed:', e);
  }
}

function updateCanvas() {
  const canvas = previewCardRef.value?.canvasRef;
  const firstSerial = (stSerialNumbersInput.value || '').split(/\r?\n/)[0]?.trim() || '3726 0001';
  if (canvas) {
    renderStCanvasDynamic(canvas, stElements.value, stCanvasConfig.value, firstSerial);
  }
}

watch(
  [stCanvasConfig, stElements, stSerialNumbersInput],
  async () => {
    autoSaveStTemplate();
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
