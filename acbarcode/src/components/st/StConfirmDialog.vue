<template>
  <Teleport to="body">
    <div v-if="dialogState.visible" class="st-dialog-backdrop">
      <div class="st-dialog-panel" :class="'type-' + dialogState.type">
        <!-- Header -->
        <div class="st-dialog-header">
          <div class="header-left">
            <span class="type-icon">{{ iconForType(dialogState.type) }}</span>
            <h3 class="dialog-title">{{ dialogState.title }}</h3>
          </div>
          <button type="button" class="close-btn" @click="handleCancel">✕</button>
        </div>

        <!-- Body -->
        <div class="st-dialog-body">
          <p class="dialog-message">{{ dialogState.message }}</p>
        </div>

        <!-- Footer -->
        <div class="st-dialog-footer">
          <button
            v-if="dialogState.cancelText"
            type="button"
            class="btn-dialog-cancel"
            @click="handleCancel"
          >
            {{ dialogState.cancelText }}
          </button>
          <button
            type="button"
            class="btn-dialog-confirm"
            :class="'btn-' + dialogState.type"
            @click="handleConfirm"
          >
            {{ dialogState.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { dialogState } from '../../utils/stDialog.js';

function iconForType(type) {
  if (type === 'danger') return '🗑️';
  if (type === 'warning') return '⚠️';
  if (type === 'success') return '✅';
  if (type === 'confirm') return '❓';
  return 'ℹ️';
}

function handleConfirm() {
  if (dialogState.value.onConfirm) {
    dialogState.value.onConfirm();
  }
}

function handleCancel() {
  if (dialogState.value.onCancel) {
    dialogState.value.onCancel();
  }
}
</script>

<style scoped>
.st-dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10050;
  animation: fadeIn 0.15s ease;
  backdrop-filter: blur(2px);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.st-dialog-panel {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 440px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  animation: popIn 0.16s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
}

@keyframes popIn {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.st-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.type-icon {
  font-size: 1.2rem;
}

.dialog-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1a202c;
}

.close-btn {
  background: transparent !important;
  border: none !important;
  color: #a0aec0 !important;
  font-size: 0.9rem !important;
  cursor: pointer;
  padding: 4px 8px !important;
  border-radius: 4px;
  box-shadow: none !important;
  width: auto !important;
}

.close-btn:hover {
  color: #2d3748 !important;
  background: #edf2f7 !important;
}

.st-dialog-body {
  padding: 1.25rem;
  font-size: 0.9rem;
  color: #4a5568;
  line-height: 1.5;
}

.dialog-message {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.st-dialog-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.6rem;
  padding: 0.85rem 1.25rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

.btn-dialog-cancel {
  background: #edf2f7 !important;
  color: #4a5568 !important;
  border: 1px solid #cbd5e0 !important;
  padding: 0.45rem 1rem !important;
  border-radius: 6px !important;
  font-size: 0.85rem !important;
  font-weight: 600 !important;
  cursor: pointer;
  box-shadow: none !important;
  width: auto !important;
}

.btn-dialog-cancel:hover {
  background: #e2e8f0 !important;
  color: #2d3748 !important;
}

.btn-dialog-confirm {
  background: #3182ce !important;
  color: white !important;
  border: none !important;
  padding: 0.45rem 1.1rem !important;
  border-radius: 6px !important;
  font-size: 0.85rem !important;
  font-weight: 600 !important;
  cursor: pointer;
  box-shadow: none !important;
  width: auto !important;
  transition: background 0.12s ease;
}

.btn-dialog-confirm:hover {
  background: #2b6cb0 !important;
}

.btn-dialog-confirm.btn-danger {
  background: #e53e3e !important;
}

.btn-dialog-confirm.btn-danger:hover {
  background: #c53030 !important;
}

.btn-dialog-confirm.btn-warning {
  background: #dd6b20 !important;
}

.btn-dialog-confirm.btn-warning:hover {
  background: #c05621 !important;
}

.btn-dialog-confirm.btn-success {
  background: #38a169 !important;
}

.btn-dialog-confirm.btn-success:hover {
  background: #2f855a !important;
}
</style>
