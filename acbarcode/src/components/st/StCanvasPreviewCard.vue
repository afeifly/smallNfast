<template>
  <div class="preview-card">
    <div class="preview-card-header">
      <h3>👁️ Live Canvas Preview</h3>
      <span class="canvas-dim-tag">{{ config.widthMm }}mm × {{ config.heightMm }}mm</span>
    </div>

    <div class="st-preview-viewport">
      <canvas ref="canvasRef" class="st-single-preview-canvas"></canvas>
    </div>

    <div class="st-action-toolbar">
      <button type="button" class="action-btn primary-ezpl" @click="$emit('export-ezpl')">
        📥 Export EZPL (.ezpl)
      </button>
      <button type="button" class="action-btn primary-ezpx" @click="$emit('export-ezpx')">
        📦 Export EZPX (.ezpx)
      </button>
      <button type="button" class="action-btn copy-ezpl" @click="$emit('copy-ezpl')">
        📋 Copy EZPL Code
      </button>
      <button type="button" class="action-btn pdf-btn" @click="$emit('download-pdf')">
        📄 Download PDF
      </button>
      <button type="button" class="action-btn save-btn" @click="$emit('save-template')">
        💾 Save Template
      </button>
      <button type="button" class="action-btn load-btn" @click="$emit('load-template')">
        📂 Load Template
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

defineProps({
  config: {
    type: Object,
    required: true
  }
});

defineEmits([
  'export-ezpl',
  'export-ezpx',
  'copy-ezpl',
  'download-pdf',
  'save-template',
  'load-template'
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

.primary-ezpl {
  background: #3182ce !important;
  color: white !important;
}

.primary-ezpl:hover {
  background: #2b6cb0 !important;
}

.primary-ezpx {
  background: #805ad5 !important;
  color: white !important;
}

.primary-ezpx:hover {
  background: #6b46c1 !important;
}

.copy-ezpl {
  background: #38a169 !important;
  color: white !important;
}

.copy-ezpl:hover {
  background: #2f855a !important;
}

.pdf-btn {
  background: #e53e3e !important;
  color: white !important;
}

.pdf-btn:hover {
  background: #c53030 !important;
}

.save-btn {
  background: #d69e2e !important;
  color: white !important;
}

.save-btn:hover {
  background: #b7791f !important;
}

.load-btn {
  background: #718096 !important;
  color: white !important;
}

.load-btn:hover {
  background: #4a5568 !important;
}
</style>
