<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card">
      <div class="modal-header">
        <h2>Change Password</h2>
        <button class="close-btn" @click="$emit('close')" title="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <p class="modal-hint">Only the normal user password can be changed.<br>The admin password is fixed and cannot be modified.</p>
      <form @submit.prevent="handleChangePassword">
        <div class="input-group">
          <label>Current Password</label>
          <div class="input-wrapper">
            <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              type="password"
              v-model="currentPassword"
              placeholder="Enter current password"
              autocomplete="off"
              ref="currentPasswordInput"
            />
          </div>
        </div>
        <div class="input-group">
          <label>New Password</label>
          <div class="input-wrapper">
            <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
            </svg>
            <input
              type="password"
              v-model="newPassword"
              placeholder="Enter new password"
              autocomplete="off"
            />
          </div>
        </div>
        <div class="input-group">
          <label>Confirm New Password</label>
          <div class="input-wrapper">
            <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <input
              type="password"
              v-model="confirmPassword"
              placeholder="Confirm new password"
              autocomplete="off"
            />
          </div>
        </div>
        <p v-if="errorMessage" class="error-message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="msg-icon">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {{ errorMessage }}
        </p>
        <p v-if="successMessage" class="success-message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="msg-icon">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="16 10 11 15 8 12"/>
          </svg>
          {{ successMessage }}
        </p>
        <button type="submit" class="submit-btn" :disabled="isLoading">
          <span v-if="isLoading" class="spinner"></span>
          <span v-else>Update Password</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const emit = defineEmits(['close']);

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const errorMessage = ref('');
const successMessage = ref('');
const isLoading = ref(false);
const currentPasswordInput = ref(null);

// Fixed hidden admin password
const ADMIN_PASSWORD = 'SUTOadmin1234';

onMounted(() => {
  if (currentPasswordInput.value) {
    currentPasswordInput.value.focus();
  }
});

// Get the current user password from server API
async function getCurrentUserPassword() {
  try {
    const response = await fetch('/api/password');
    const data = await response.json();
    return data.password || '';
  } catch (e) {
    return '';
  }
}

async function handleChangePassword() {
  errorMessage.value = '';
  successMessage.value = '';

  if (!currentPassword.value.trim()) {
    errorMessage.value = 'Please enter your current password';
    return;
  }
  if (!newPassword.value.trim()) {
    errorMessage.value = 'Please enter a new password';
    return;
  }
  if (newPassword.value.length < 4) {
    errorMessage.value = 'New password must be at least 4 characters';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'New passwords do not match';
    return;
  }
  if (newPassword.value === ADMIN_PASSWORD) {
    errorMessage.value = 'Cannot set user password same as admin password';
    return;
  }

  isLoading.value = true;
  await new Promise(resolve => setTimeout(resolve, 400));

  const currentUserPwd = await getCurrentUserPassword();

  // Verify current password - must be either the user password or admin password
  if (currentPassword.value !== currentUserPwd && currentPassword.value !== ADMIN_PASSWORD) {
    errorMessage.value = 'Current password is incorrect';
    isLoading.value = false;
    return;
  }

  // Save new user password to server (writes to data/password.json on disk)
  try {
    const response = await fetch('/api/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: newPassword.value })
    });
    const result = await response.json();
    if (!response.ok) {
      errorMessage.value = result.error || 'Failed to save password';
      isLoading.value = false;
      return;
    }
  } catch (e) {
    errorMessage.value = 'Failed to save password to server';
    isLoading.value = false;
    return;
  }

  successMessage.value = 'Password changed successfully!';
  currentPassword.value = '';
  newPassword.value = '';
  confirmPassword.value = '';
  isLoading.value = false;

  // Auto-close after a short delay
  setTimeout(() => {
    emit('close');
  }, 1500);
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 24px;
  animation: fadeIn 0.25s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-card {
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 36px 36px 32px;
  width: 100%;
  max-width: 440px;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.2),
    0 0 0 1px rgba(255, 255, 255, 0.2);
  animation: slideUp 0.35s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.modal-header h2 {
  font-size: 1.4rem;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}

.close-btn {
  width: 36px;
  height: 36px;
  min-height: 36px;
  border: none;
  background: #f0f0f0;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.2s ease;
  box-shadow: none;
}

.close-btn:hover {
  background: #e0e0e0;
  transform: none;
  box-shadow: none;
}

.close-btn svg {
  width: 16px;
  height: 16px;
  color: #666;
}

.modal-hint {
  color: #999;
  font-size: 0.82rem;
  margin-bottom: 24px;
  line-height: 1.5;
}

.input-group {
  margin-bottom: 16px;
}

.input-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: #555;
  margin-bottom: 6px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  width: 18px;
  height: 18px;
  color: #bbb;
  pointer-events: none;
  transition: color 0.3s ease;
}

.input-wrapper:focus-within .input-icon {
  color: #667eea;
}

.input-wrapper input {
  width: 100%;
  padding: 14px 14px 14px 44px;
  border: 2px solid #e8e8e8;
  border-radius: 10px;
  font-size: 0.95rem;
  background: #fafafa;
  transition: all 0.3s ease;
  font-family: inherit;
  color: #333;
}

.input-wrapper input:focus {
  outline: none;
  border-color: #667eea;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.input-wrapper input::placeholder {
  color: #ccc;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e74c3c;
  font-size: 0.85rem;
  margin-bottom: 14px;
  padding: 10px 14px;
  background: rgba(231, 76, 60, 0.08);
  border-radius: 8px;
  animation: shake 0.4s ease-in-out;
}

.success-message {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #27ae60;
  font-size: 0.85rem;
  margin-bottom: 14px;
  padding: 10px 14px;
  background: rgba(39, 174, 96, 0.08);
  border-radius: 8px;
  animation: fadeIn 0.3s ease-out;
}

.msg-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  50% { transform: translateX(5px); }
  75% { transform: translateX(-3px); }
}

.submit-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  font-family: inherit;
  margin-top: 4px;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 480px) {
  .modal-card {
    padding: 28px 20px 24px;
  }
}
</style>
