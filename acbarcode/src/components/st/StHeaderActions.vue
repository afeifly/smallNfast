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
          placeholder="Start e.g. 12345678" 
          class="sn-input"
        />
        <label for="st-sn-end-input" class="sn-label end-label">End:</label>
        <input 
          id="st-sn-end-input"
          type="text" 
          :value="endValue" 
          @input="$emit('update:endValue', $event.target.value)"
          placeholder="End e.g. 12345680" 
          class="sn-input sn-input-end"
        />
        <label for="st-options-input" class="sn-label opt-label">Options:</label>
        <input 
          id="st-options-input"
          type="text" 
          :value="optionsValue" 
          @input="$emit('update:optionsValue', $event.target.value)"
          placeholder="e.g. A1410, A1411" 
          class="sn-input options-input"
        />
        <span v-if="rangeCount > 1" class="range-badge" title="Total labels to generate in this batch">
          📦 {{ rangeCount }} Labels
        </span>
      </div>
      <!-- Temporarily hidden per user request -->
      <button type="button" class="fetch-odoo-stub-btn" v-if="false" @click="$emit('fetch-odoo')">
        🔄 Fetch Data from Odoo
      </button>
    </div>
    <div class="st-header-right">
      <button type="button" class="template-mgr-btn" @click="$emit('open-templates')">
        ✎ Templates
      </button>
      <!-- Temporarily hidden per user request -->
      <button type="button" class="manage-odoo-btn" v-if="false" @click="$emit('open-odoo-modal')">
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
  },
  endValue: {
    type: String,
    default: ''
  },
  optionsValue: {
    type: String,
    default: ''
  },
  rangeCount: {
    type: Number,
    default: 1
  }
});

defineEmits(['update:modelValue', 'update:endValue', 'update:optionsValue', 'fetch-odoo', 'open-odoo-modal', 'open-templates']);
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
  color: #ffffff;
  white-space: nowrap;
}

.sn-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.9rem;
  width: 150px;
}

.end-label, .opt-label {
  margin-left: 0.25rem;
}

.sn-input-end, .options-input {
  width: 150px;
}

.range-badge {
  background: #ebf8ff;
  color: #2b6cb0;
  border: 1px solid #bee3f8;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.35rem 0.65rem;
  border-radius: 20px;
  white-space: nowrap;
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
