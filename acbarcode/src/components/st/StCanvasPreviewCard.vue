<template>
  <div class="preview-card">
    <div class="preview-card-header">
      <h3>👁️ Live Canvas Preview</h3>
      <div class="header-tags">
        <span v-if="rangeCount > 1" class="preview-nav-tag">
          <button type="button" class="nav-btn" :disabled="currentIdx <= 0" @click="$emit('prev-page')">◀</button>
          <span class="nav-sn-info">Label {{ currentIdx + 1 }} / {{ rangeCount }} (SN: {{ currentSN }})</span>
          <button type="button" class="nav-btn" :disabled="currentIdx >= rangeCount - 1" @click="$emit('next-page')">▶</button>
        </span>
        <span class="canvas-dim-tag">{{ config.widthMm }}mm × {{ config.heightMm }}mm</span>
      </div>
    </div>

    <div class="st-preview-viewport">
      <canvas ref="canvasRef" class="st-single-preview-canvas"></canvas>
    </div>

    <div class="st-action-toolbar">
      <!-- ── 1. Export Dropdown (3 types: .ezpx, .ezpl, .json) ──── -->
      <div class="export-dropdown-wrapper" ref="dropdownWrapperRef">
        <button
          type="button"
          class="action-btn export-trigger-btn"
          :class="{ active: isDropdownOpen }"
          @click="isDropdownOpen = !isDropdownOpen"
        >
          <span class="btn-main-icon">📤</span>
          <span>Export</span>
          <span class="arrow-indicator">{{ isDropdownOpen ? '▴' : '▾' }}</span>
        </button>

        <transition name="dropdown-fade">
          <div v-if="isDropdownOpen" class="export-menu">
            <button type="button" class="export-menu-item ezpx-opt" @click="handleAction('export-ezpx')">
              <span class="item-icon">📦</span>
              <div class="item-desc">
                <span class="item-title">.ezpx Package</span>
                <span class="item-sub">GoLabel batch zip with data.csv</span>
              </div>
            </button>

            <button type="button" class="export-menu-item ezpl-opt" @click="handleAction('export-ezpl')">
              <span class="item-icon">🖨️</span>
              <div class="item-desc">
                <span class="item-title">.ezpl Print File</span>
                <span class="item-sub">Graphic stream for Godex printers</span>
              </div>
            </button>

            <button type="button" class="export-menu-item json-opt" @click="handleAction('export-template-json')">
              <span class="item-icon">📄</span>
              <div class="item-desc">
                <span class="item-title">.json Template</span>
                <span class="item-sub">Save layout & design configuration</span>
              </div>
            </button>
          </div>
        </transition>
      </div>

      <!-- ── 2. Import JSON Button ──────────────────────────────── -->
      <label class="action-btn import-json-btn" title="Load template design from JSON file into current editor">
        📥 Import JSON
        <input type="file" accept=".json" style="display:none;" @change="$emit('import-template-json', $event)" />
      </label>

      <!-- ── 3. Download PDF Button (Standalone) ─────────────────── -->
      <button type="button" class="action-btn pdf-btn" @click="$emit('download-pdf', $event)">
        📄 Download PDF {{ rangeCount > 1 ? `(${rangeCount})` : '' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

defineProps({
  config: {
    type: Object,
    required: true
  },
  rangeCount: {
    type: Number,
    default: 1
  },
  currentIdx: {
    type: Number,
    default: 0
  },
  currentSN: {
    type: String,
    default: ''
  }
});

const emit = defineEmits([
  'export-ezpx',
  'export-ezpl',
  'download-pdf',
  'export-template-json',
  'import-template-json',
  'prev-page',
  'next-page'
]);

const canvasRef = ref(null);
const dropdownWrapperRef = ref(null);
const isDropdownOpen = ref(false);

function handleAction(actionName) {
  isDropdownOpen.value = false;
  emit(actionName);
}

function handleClickOutside(event) {
  if (dropdownWrapperRef.value && !dropdownWrapperRef.value.contains(event.target)) {
    isDropdownOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

defineExpose({
  canvasRef
});
</script>

<style scoped>
.preview-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.preview-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.preview-card-header h3 {
  margin: 0;
  font-size: 1.15rem;
  color: #2d3748;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-tags {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.preview-nav-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #edf2f7;
  padding: 0.2rem 0.5rem;
  border-radius: 20px;
  font-size: 0.8rem;
  color: #2d3748;
}

.nav-sn-info {
  font-weight: 600;
}

.nav-btn {
  background: #cbd5e0 !important;
  color: #2d3748 !important;
  border: none;
  border-radius: 50%;
  width: 22px !important;
  height: 22px !important;
  padding: 0 !important;
  font-size: 0.75rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: none !important;
  line-height: 1;
}

.nav-btn:hover:not(:disabled) {
  background: #a0aec0 !important;
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.canvas-dim-tag {
  background: #edf2f7;
  color: #4a5568;
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

.st-preview-viewport {
  background: #f7fafc;
  border: 2px dashed #cbd5e0;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 240px;
}

.st-single-preview-canvas {
  background: white;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border: 1px solid #e2e8f0;
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

/* ── Action Toolbar & Dropdown ────────────────────────────── */
.st-action-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.export-dropdown-wrapper {
  position: relative;
  flex: 1;
}

.action-btn {
  padding: 0.65rem 0.9rem !important;
  font-size: 0.88rem !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
  cursor: pointer;
  border: none;
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.export-trigger-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  color: white !important;
  box-shadow: 0 4px 14px rgba(102, 126, 234, 0.35);
}

.export-trigger-btn:hover {
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.45);
  transform: translateY(-1px);
}

.export-trigger-btn.active {
  box-shadow: 0 0 0 3px rgba(118, 75, 162, 0.3);
}

.arrow-indicator {
  font-size: 0.8rem;
  opacity: 0.85;
}

.import-json-btn {
  flex: 1;
  background: #4a5568 !important;
  color: white !important;
  box-shadow: 0 2px 8px rgba(74, 85, 104, 0.25);
}

.import-json-btn:hover {
  background: #2d3748 !important;
  transform: translateY(-1px);
}

.pdf-btn {
  flex: 1.15;
  background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%) !important;
  color: white !important;
  box-shadow: 0 2px 8px rgba(229, 62, 62, 0.3);
}

.pdf-btn:hover {
  background: linear-gradient(135deg, #c53030 0%, #9b2c2c 100%) !important;
  transform: translateY(-1px);
}

/* ── Dropdown Menu ────────────────────────────────────────── */
.export-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 100%;
  min-width: 290px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  padding: 6px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.export-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
  width: 100%;
}

.export-menu-item:hover {
  background: #f7fafc;
}

.export-menu-item.ezpx-opt:hover { background: #faf5ff; }
.export-menu-item.ezpl-opt:hover { background: #f0fff4; }
.export-menu-item.pdf-opt:hover { background: #fff5f5; }
.export-menu-item.json-opt:hover { background: #ebf8ff; }

.item-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.item-desc {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.item-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: #2d3748;
}

.item-sub {
  font-size: 0.74rem;
  color: #718096;
}

.menu-separator {
  height: 1px;
  background: #edf2f7;
  margin: 4px 6px;
}

/* Transition */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
