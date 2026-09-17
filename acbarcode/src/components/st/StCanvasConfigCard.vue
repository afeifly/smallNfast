<template>
  <div class="editor-card">
    <!-- Card header: title + Copy from EN + EN/CN toggle -->
    <div class="card-header">
      <h3>📏 Template basic infos</h3>
      <div class="header-controls">
        <button
          v-if="activeLang === 'CN'"
          type="button"
          class="copy-en-btn"
          :disabled="isLocked"
          @click="onCopyFromEn"
          :title="isLocked ? 'Template is locked (read-only)' : 'Copy element layout from EN version to CN version'"
        >
          📋 Copy from EN
        </button>
        <div class="lang-toggle">
          <button
            type="button"
            class="lang-btn"
            :class="{ active: activeLang === 'EN' }"
            @click="$emit('update:activeLang', 'EN')"
          >🇬🇧 EN</button>
          <button
            type="button"
            class="lang-btn"
            :class="{ active: activeLang === 'CN' }"
            @click="$emit('update:activeLang', 'CN')"
          >🇨🇳 CN</button>
        </div>
      </div>
    </div>

    <!-- Two-line read-only info grid -->
    <div class="info-grid">
      <!-- Line 1: Name + W×H -->
      <span class="info-label">NAME</span>
      <span class="info-value" :title="templateName || '—'">{{ templateName || '—' }}</span>
      <span class="info-metric">{{ config.widthMm }} × {{ config.heightMm }} <small>mm</small></span>

      <!-- Line 2: Items + DPI -->
      <span class="info-label">ITEMS</span>
      <span class="info-value" :title="itemNumbers || '—'">{{ itemNumbers || '—' }}</span>
      <div class="dpi-control">
        <span class="dpi-lang-tag">{{ activeLang }}</span>
        <select
          class="dpi-select"
          :disabled="isLocked"
          :value="activeDpi"
          @change="$emit('update:dpi', { lang: activeLang, dpi: Number($event.target.value) })"
          title="Print resolution (DPI) for this language version"
        >
          <option :value="203">203 DPI</option>
          <option :value="300">300 DPI</option>
          <option :value="600">600 DPI</option>
        </select>
      </div>

      <!-- Note row (purpose / usage hint) -->
      <span v-if="templateNote" class="info-label">NOTE</span>
      <span v-if="templateNote" class="info-value note-value" :title="templateNote">{{ templateNote }}</span>
      <span v-if="templateNote" class="info-metric"></span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { showStConfirm } from '../../utils/stDialog.js';

const props = defineProps({
  config: { type: Object, required: true },
  templateName: { type: String, default: '' },
  itemNumbers: { type: String, default: '' },
  templateNote: { type: String, default: '' },
  activeLang: { type: String, default: 'EN' },
  isLocked: { type: Boolean, default: false }
});

const emit = defineEmits(['update:activeLang', 'copy-from-en', 'update:dpi']);

const activeDpi = computed(() => {
  if (props.activeLang === 'CN') {
    return props.config?.dpi_cn || props.config?.dpi || 300;
  }
  return props.config?.dpi_en || props.config?.dpi || 300;
});

async function onCopyFromEn() {
  const confirmed = await showStConfirm({
    title: 'Copy from EN Template',
    message: 'This will overwrite your current CN elements configuration with a complete clone of the EN element layout.\n\nAll current CN modifications will be lost. Do you want to proceed?',
    confirmText: 'Copy from EN',
    cancelText: 'Cancel',
    type: 'warning'
  });
  if (confirmed) {
    emit('copy-from-en');
  }
}
</script>

<style scoped>
.editor-card {
  background: white;
  border-radius: 12px;
  padding: 0.9rem 1.25rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

/* ── Header ───────────────────────────────────── */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.7rem;
  gap: 0.75rem;
}

.card-header h3 {
  margin: 0;
  font-size: 0.95rem;
  color: #2d3748;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.copy-en-btn {
  background: #edf2f7 !important;
  color: #2b6cb0 !important;
  border: 1px solid #cbd5e0 !important;
  padding: 0.28rem 0.6rem !important;
  border-radius: 6px !important;
  font-size: 0.76rem !important;
  font-weight: 600 !important;
  cursor: pointer;
  box-shadow: none !important;
  transition: all 0.13s ease;
  white-space: nowrap;
  width: auto !important;
}

.copy-en-btn:hover {
  background: #ebf8ff !important;
  border-color: #3182ce !important;
}

/* ── EN/CN Toggle ─────────────────────────────── */
.lang-toggle {
  display: flex;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}

.lang-btn {
  padding: 0.28rem 0.55rem;
  font-size: 0.76rem;
  font-weight: 600;
  border: none;
  background: #f7fafc;
  color: #718096;
  cursor: pointer;
  transition: all 0.13s ease;
  box-shadow: none !important;
  width: auto !important;
}

.lang-btn + .lang-btn {
  border-left: 1px solid #cbd5e0;
}

.lang-btn.active {
  background: #3182ce;
  color: white;
}

.lang-btn:hover:not(.active) {
  background: #edf2f7;
  color: #2d3748;
}

/* ── Two-line Info Grid ───────────────────────── */
/*  Columns: [label fixed] [value flex] [metric fixed] */
.info-grid {
  display: grid;
  grid-template-columns: 38px 1fr auto;
  row-gap: 0.35rem;
  column-gap: 0.5rem;
  align-items: center;
  min-width: 0;
}

.info-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: #a0aec0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  padding: 0.22rem 0;
}

.info-value {
  font-size: 0.86rem;
  color: #2d3748;
  font-weight: 500;
  /* single-line ellipsis */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  cursor: default;
}

.note-value {
  font-style: italic;
  color: #718096;
}

.info-metric {
  font-size: 0.84rem;
  font-weight: 600;
  color: #4a5568;
  white-space: nowrap;
  text-align: right;
  padding-left: 0.5rem;
}

.info-metric small {
  font-size: 0.7rem;
  font-weight: 500;
  color: #a0aec0;
}

/* ── DPI Control ──────────────────────────────── */
.dpi-control {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  justify-content: flex-end;
}

.dpi-lang-tag {
  font-size: 0.68rem;
  font-weight: 700;
  color: #718096;
  background: #edf2f7;
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  letter-spacing: 0.04em;
  user-select: none;
}

.dpi-select {
  padding: 0.2rem 0.45rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #2d3748;
  background: #f7fafc;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  cursor: pointer;
  outline: none;
  transition: all 0.15s ease;
  width: auto !important;
  box-shadow: none !important;
}

.dpi-select:hover:not(:disabled) {
  border-color: #3182ce;
  background: #fff;
}

.dpi-select:focus:not(:disabled) {
  border-color: #3182ce;
  box-shadow: 0 0 0 2px rgba(49, 130, 206, 0.2) !important;
}

.dpi-select:disabled {
  background: #f0f4f8;
  color: #a0aec0;
  cursor: not-allowed;
  border-color: #e2e8f0;
}
</style>
