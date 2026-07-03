<template>
  <Transition name="fade">
    <div v-if="modelValue" class="modal-overlay" @click.self="$emit('update:modelValue', false)">
      <Transition name="zoom">
        <div v-if="modelValue" class="glass modal-card card" :class="{ 'danger-theme': type === 'danger' }">
          <div class="modal-header flex between center">
            <div class="flex center gap-8">
              <component :is="icon" :size="20" class="modal-icon" />
              <h3>{{ title }}</h3>
            </div>
            <button @click="$emit('update:modelValue', false)" class="close-btn"><X :size="20" /></button>
          </div>
          
          <div class="modal-body">
            <p>{{ message }}</p>
          </div>
          
          <div class="modal-actions flex end gap-12">
            <button @click="$emit('update:modelValue', false)" class="secondary">Cancel</button>
            <button @click="handleConfirm" :class="type === 'danger' ? 'danger-btn' : 'primary'">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { X, AlertTriangle, Info, CheckCircle } from 'lucide-vue-next'

const props = defineProps({
  modelValue: Boolean,
  title: String,
  message: String,
  confirmText: { type: String, default: 'Confirm' },
  type: { type: String, default: 'info' } // info, danger, success
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const icon = computed(() => {
  if (props.type === 'danger') return AlertTriangle
  if (props.type === 'success') return CheckCircle
  return Info
})

const handleConfirm = () => {
  emit('confirm')
  emit('update:modelValue', false)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-card {
  width: 100%;
  max-width: 450px;
  background: white;
  padding: 24px;
  border-radius: 16px;
}

.modal-header h3 {
  margin-bottom: 0;
  font-size: 1.25rem;
}

.modal-icon {
  color: var(--primary-color);
}

.danger-theme .modal-icon {
  color: #cf222e;
}

.modal-body {
  margin: 20px 0 32px;
  color: var(--text-muted);
  line-height: 1.5;
}

.close-btn {
  background: transparent;
  padding: 4px;
  color: var(--text-muted);
}

.close-btn:hover {
  background: #f6f8fa;
  color: var(--text-main);
}

.danger-btn {
  background: #cf222e;
  color: white;
}

.danger-btn:hover {
  filter: brightness(1.1);
  box-shadow: 0 4px 12px rgba(207, 34, 46, 0.2);
}

.end { justify-content: flex-end; }
.gap-12 { gap: 12px; }

/* Animations */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.zoom-enter-active, .zoom-leave-active { transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.zoom-enter-from, .zoom-leave-to { transform: scale(0.9); }
</style>
