<template>
  <div class="preview-card">
    <h3>💻 Generated EZPL Instruction Stream</h3>
    <pre class="ezpl-code-box">{{ code }}</pre>
  </div>
</template>

<script setup>
defineProps({
  code: {
    type: String,
    default: ''
  }
});
</script>

<style scoped>
.preview-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.preview-card h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.15rem;
  color: #2d3748;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ezpl-code-box {
  background: #1a202c;
  color: #68d391;
  padding: 1rem;
  border-radius: 8px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 250px;
  overflow-y: auto;
  margin: 0;
}
</style>
