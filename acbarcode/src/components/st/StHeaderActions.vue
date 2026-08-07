<template>
  <div class="st-header-actions">
    <div class="st-header-left">
      <div class="sn-input-group">
        <label for="st-sn-input" class="sn-label">SN:</label>
        <input 
          id="st-sn-input"
          type="text" 
          :value="modelValue" 
          @input="$emit('update:modelValue', $event.target.value)"
          placeholder="e.g. 3726 0001" 
          class="sn-input"
        />
      </div>
      <button type="button" class="fetch-odoo-stub-btn" @click="$emit('fetch-odoo')">
        🔄 Fetch Data from Odoo
      </button>
    </div>
    <div class="st-header-right">
      <button type="button" class="template-mgr-btn" @click="$emit('open-template-modal')">
        📋 Template Manager
      </button>
      <button type="button" class="manage-odoo-btn" @click="$emit('open-odoo-modal')">
        ⚙️ Manage Odoo Server
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: ''
  }
});

defineEmits(['update:modelValue', 'fetch-odoo', 'open-odoo-modal', 'open-template-modal']);
</script>

<style scoped>
.st-header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.st-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.st-header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sn-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sn-label {
  font-weight: 600;
  font-size: 0.9rem;
  color: #2d3748;
  white-space: nowrap;
}

.sn-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.9rem;
  width: 200px;
}

.fetch-odoo-stub-btn {
  background: #319795 !important;
  color: white !important;
  border: none;
  padding: 0.5rem 1rem !important;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: none !important;
  width: auto !important;
}

.fetch-odoo-stub-btn:hover {
  background: #2c7a7b !important;
}

.manage-odoo-btn {
  background: #4a5568 !important;
  color: white !important;
  border: none;
  padding: 0.5rem 1rem !important;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: none !important;
  width: auto !important;
}

.manage-odoo-btn:hover {
  background: #2d3748 !important;
}

.template-mgr-btn {
  background: #6b46c1 !important;
  color: white !important;
  border: none;
  padding: 0.5rem 1rem !important;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: none !important;
  width: auto !important;
}

.template-mgr-btn:hover {
  background: #553c9a !important;
}
</style>
