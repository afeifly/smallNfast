<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <img src="/logo.png" alt="Logo" class="login-logo" />
        <h1>Barcode Label Maker</h1>
        <p class="login-subtitle">Enter password to continue</p>
      </div>
      <form @submit.prevent="handleLogin">
        <div class="input-group">
          <div class="input-wrapper">
            <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              id="password-input"
              type="password"
              v-model="password"
              placeholder="Password"
              autocomplete="off"
              ref="passwordInput"
            />
          </div>
        </div>
        <p v-if="errorMessage" class="error-message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="error-icon">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {{ errorMessage }}
        </p>
        <button id="login-button" type="submit" :disabled="isLoading">
          <span v-if="isLoading" class="spinner"></span>
          <span v-else>Unlock</span>
        </button>
      </form>
      <p class="login-footer">Password protected access</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const emit = defineEmits(['login-success']);

const password = ref('');
const errorMessage = ref('');
const isLoading = ref(false);
const passwordInput = ref(null);
let userPassword = '';

// Fixed hidden admin password
const ADMIN_PASSWORD = 'SUTOadmin1234';

onMounted(async () => {
  // Load the user password from server API (reads from data/password.json on disk)
  try {
    const response = await fetch('/api/password');
    const data = await response.json();
    userPassword = data.password || '';
  } catch (e) {
    console.warn('Could not load password from API, only admin password will work.');
  }
  // Focus the password input
  if (passwordInput.value) {
    passwordInput.value.focus();
  }
});

async function handleLogin() {
  errorMessage.value = '';
  
  if (!password.value.trim()) {
    errorMessage.value = 'Please enter a password';
    return;
  }

  isLoading.value = true;

  // Small delay for UX feel
  await new Promise(resolve => setTimeout(resolve, 400));

  if (password.value === ADMIN_PASSWORD) {
    sessionStorage.setItem('acbarcode_auth', 'true');
    sessionStorage.setItem('acbarcode_role', 'admin');
    emit('login-success');
  } else if (password.value === userPassword) {
    sessionStorage.setItem('acbarcode_auth', 'true');
    sessionStorage.setItem('acbarcode_role', 'user');
    emit('login-success');
  } else {
    errorMessage.value = 'Incorrect password';
    password.value = '';
  }
  
  isLoading.value = false;
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 24px;
  font-family: 'Roboto', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.login-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 48px 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(255, 255, 255, 0.2);
  animation: slideUp 0.6s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.login-header {
  text-align: center;
  margin-bottom: 36px;
}

.login-logo {
  width: 64px;
  height: auto;
  margin-bottom: 16px;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.1));
}

.login-header h1 {
  font-size: 1.7rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.login-subtitle {
  color: #888;
  font-size: 0.95rem;
  font-weight: 300;
}

.input-group {
  margin-bottom: 20px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 16px;
  width: 20px;
  height: 20px;
  color: #aaa;
  pointer-events: none;
  transition: color 0.3s ease;
}

.input-wrapper:focus-within .input-icon {
  color: #667eea;
}

.input-wrapper input {
  width: 100%;
  padding: 16px 16px 16px 48px;
  border: 2px solid #e8e8e8;
  border-radius: 12px;
  font-size: 1rem;
  background: #fafafa;
  transition: all 0.3s ease;
  font-family: inherit;
  color: #333;
}

.input-wrapper input:focus {
  outline: none;
  border-color: #667eea;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}

.input-wrapper input::placeholder {
  color: #bbb;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e74c3c;
  font-size: 0.88rem;
  margin-bottom: 16px;
  padding: 10px 14px;
  background: rgba(231, 76, 60, 0.08);
  border-radius: 8px;
  animation: shake 0.4s ease-in-out;
}

.error-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  50% { transform: translateX(6px); }
  75% { transform: translateX(-4px); }
}

button {
  width: 100%;
  padding: 16px;
  border: none;
  border-radius: 12px;
  font-size: 1.05rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  font-family: inherit;
}

button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(102, 126, 234, 0.45);
}

button:active:not(:disabled) {
  transform: translateY(0);
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spinner {
  width: 22px;
  height: 22px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.login-footer {
  text-align: center;
  margin-top: 24px;
  color: #bbb;
  font-size: 0.82rem;
  font-weight: 300;
  letter-spacing: 0.5px;
}

/* Responsive */
@media (max-width: 480px) {
  .login-card {
    padding: 36px 24px;
  }
  
  .login-header h1 {
    font-size: 1.4rem;
  }
}
</style>
