<template>
  <LoginPage v-if="!isAuthenticated" @login-success="onLoginSuccess" />
  <template v-else>
    <div class="floating-actions">
      <button class="action-btn" @click="showChangePassword = true" title="Change Password">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </button>
      <button class="action-btn logout-btn" @click="handleLogout" title="Logout">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>
    </div>
    <LabelMaker />
    <ChangePassword v-if="showChangePassword" @close="showChangePassword = false" />
  </template>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import LoginPage from './components/LoginPage.vue';
import LabelMaker from './components/LabelMaker.vue';
import ChangePassword from './components/ChangePassword.vue';

const isAuthenticated = ref(false);
const currentRole = ref('user');
const showChangePassword = ref(false);

onMounted(() => {
  if (sessionStorage.getItem('acbarcode_auth') === 'true') {
    isAuthenticated.value = true;
    currentRole.value = sessionStorage.getItem('acbarcode_role') || 'user';
  }
});

function onLoginSuccess() {
  isAuthenticated.value = true;
  currentRole.value = sessionStorage.getItem('acbarcode_role') || 'user';
}

function handleLogout() {
  sessionStorage.removeItem('acbarcode_auth');
  sessionStorage.removeItem('acbarcode_role');
  isAuthenticated.value = false;
  currentRole.value = 'user';
}
</script>

<style>
.floating-actions {
  position: fixed;
  top: 16px;
  right: 20px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  width: 40px;
  height: 40px;
  min-height: unset;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.action-btn svg {
  width: 18px;
  height: 18px;
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.5);
  transform: none;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.25);
}

.action-btn:active {
  transform: scale(0.93);
}

.logout-btn {
  background: rgba(180, 40, 30, 0.4);
}

.logout-btn:hover {
  background: rgba(180, 40, 30, 0.6);
}

@media (max-width: 600px) {
  .floating-actions {
    top: 10px;
    right: 10px;
  }

  .action-btn {
    width: 36px;
    height: 36px;
  }

  .action-btn svg {
    width: 16px;
    height: 16px;
  }
}
</style>