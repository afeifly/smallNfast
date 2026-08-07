<template>
  <div class="editor-card">
    <!-- Card header: title + EN/CN toggle -->
    <div class="card-header">
      <h3>📏 Template basic infos</h3>
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

    <!-- Two-line read-only info grid -->
    <div class="info-grid">
      <!-- Line 1: Name + W×H -->
      <span class="info-label">NAME</span>
      <span class="info-value" :title="templateName || '—'">{{ templateName || '—' }}</span>
      <span class="info-metric">{{ config.widthMm }} × {{ config.heightMm }} <small>mm</small></span>

      <!-- Line 2: Items + DPI -->
      <span class="info-label">ITEMS</span>
      <span class="info-value" :title="itemNumbers || '—'">{{ itemNumbers || '—' }}</span>
      <span class="info-metric">{{ config.dpi }} <small>DPI</small></span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  config: { type: Object, required: true },
  templateName: { type: String, default: '' },
  itemNumbers: { type: String, default: '' },
  activeLang: { type: String, default: 'EN' }
});

defineEmits(['update:activeLang']);
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
</style>
