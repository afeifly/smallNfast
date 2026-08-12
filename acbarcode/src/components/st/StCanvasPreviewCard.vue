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
      <button type="button" class="action-btn primary-ezpx" @click="$emit('export-ezpx')">
        📦 Export EZPX (.ezpx)
      </button>
      <button type="button" class="action-btn pdf-btn" @click="$emit('download-pdf')">
        📄 Download PDF {{ rangeCount > 1 ? `(${rangeCount} Pages)` : '' }}
      </button>
      <button type="button" class="action-btn export-json-btn" @click="$emit('export-template-json')" title="Save current template design as JSON file">
        📤 Backup JSON
      </button>
      <label class="action-btn import-json-btn" title="Load template design from JSON file into current editor">
        📥 Restore JSON
        <input type="file" accept=".json" style="display:none;" @change="$emit('import-template-json', $event)" />
      </label>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

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

defineEmits([
  'export-ezpx',
  'download-pdf',
  'export-template-json',
  'import-template-json',
  'prev-page',
  'next-page'
]);

const canvasRef = ref(null);

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

.st-action-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 1.25rem;
}

.action-btn {
  padding: 0.6rem 1rem !important;
  font-size: 0.9rem !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
  cursor: pointer;
  flex: 1;
  min-width: 130px;
  text-align: center;
  border: none;
}

.primary-ezpx {
  background: #805ad5 !important;
  color: white !important;
}

.primary-ezpx:hover {
  background: #6b46c1 !important;
}

.pdf-btn {
  background: #e53e3e !important;
  color: white !important;
}

.pdf-btn:hover {
  background: #c53030 !important;
}

.export-json-btn {
  background: #2b6cb0 !important;
  color: white !important;
}

.export-json-btn:hover {
  background: #2c5282 !important;
}

.import-json-btn {
  background: #4a5568 !important;
  color: white !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.import-json-btn:hover {
  background: #2d3748 !important;
}
</style>
