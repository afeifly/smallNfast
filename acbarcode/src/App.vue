<template>
  <LoginPage v-if="!isAuthenticated" @login-success="onLoginSuccess" />
  <template v-else>
    <header class="app-header">
      <div class="header-inner">
        <div class="header-left">
          <h1 class="app-title">Product Label Generator</h1>
          <nav v-if="currentRole === 'admin'" class="header-nav-tabs">
            <button
              type="button"
              class="nav-tab-btn"
              :class="{ active: activeTab === 'maker' }"
              @click="activeTab = 'maker'"
            >
              Atlas Copco
            </button>
            <button
              type="button"
              class="nav-tab-btn"
              :class="{ active: activeTab === 'st' }"
              @click="activeTab = 'st'"
            >
              SUTO-iTEC
            </button>
          </nav>
        </div>

        <div class="header-actions">
          <button type="button" class="header-btn logout-btn" @click="handleLogout" title="Logout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      </div>
    </header>
    <LabelMaker v-model:active-tab="activeTab" />
    <StConfirmDialog />
  </template>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import LoginPage from './components/LoginPage.vue';
import LabelMaker from './components/LabelMaker.vue';
import StConfirmDialog from './components/st/StConfirmDialog.vue';

const isAuthenticated = ref(false);
const currentRole = ref('user');
const activeTab = ref('maker');

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
html,
body,
#app {
  margin: 0;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(118, 75, 162, 0.55);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 28px;
  flex-wrap: wrap;
}

.app-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}

.header-nav-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-tab-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.95rem;
  font-weight: 600;
  padding: 8px 14px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  border-radius: 6px;
  letter-spacing: 0.01em;
}

.nav-tab-btn:hover {
  color: #ffffff;
}

.nav-tab-btn.active {
  color: #ffffff;
  font-weight: 700;
}

.nav-tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 10px;
  right: 10px;
  height: 2.5px;
  background: #ffffff;
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.header-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-btn svg {
  width: 15px;
  height: 15px;
}

.header-btn:hover {
  background: rgba(0, 0, 0, 0.35);
}

.header-btn.logout-btn {
  background: rgba(180, 40, 30, 0.55);
}

.header-btn.logout-btn:hover {
  background: rgba(180, 40, 30, 0.75);
}
</style>