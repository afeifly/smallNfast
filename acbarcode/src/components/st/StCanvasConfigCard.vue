<template>
  <div class="editor-card">
    <h3>📏 Label Dimensions & DPI</h3>
    <div class="form-row">
      <div class="form-group">
        <label>Width (mm)</label>
        <input type="number" step="0.1" v-model.number="config.widthMm" min="10" max="200" />
      </div>
      <div class="form-group">
        <label>Height (mm)</label>
        <input type="number" step="0.1" v-model.number="config.heightMm" min="10" max="200" />
      </div>
      <div class="form-group">
        <label>Resolution</label>
        <select v-model.number="config.dpi">
          <option :value="203">203 DPI (8 dots/mm)</option>
          <option :value="300">300 DPI (12 dots/mm)</option>
          <option :value="600">600 DPI (24 dots/mm)</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  config: {
    type: Object,
    required: true
  }
});
</script>

<style scoped>
.editor-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.editor-card h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.15rem;
  color: #2d3748;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-row {
  display: flex;
  gap: 0.75rem;
}

.form-row .form-group {
  flex: 1;
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.35rem;
  font-weight: 500;
  color: #4a5568;
  font-size: 0.85rem;
}

input[type="number"], select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.9rem;
  box-sizing: border-box;
}
</style>
