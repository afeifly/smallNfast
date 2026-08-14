<template>
  <LoginPage v-if="!isAuthenticated" @login-success="onLoginSuccess" />
  <template v-else>
    <header class="app-header">
      <div class="header-inner">
        <h1 class="app-title">Product Label Generator</h1>
        <div class="header-actions">
        <template v-if="currentRole === 'admin'">
          <button
            type="button"
            class="header-btn"
            :class="{ active: view === 'labels' && activeTab === 'maker' }"
            @click="goLabels('maker')"
          >AC</button>
          <button
            type="button"
            class="header-btn"
            :class="{ active: view === 'labels' && activeTab === 'st' }"
            @click="goLabels('st')"
          >ST</button>
          <button
            type="button"
            class="header-btn"
            :class="{ active: view === 'templates' }"
            @click="view = 'templates'"
          >Templates</button>
        </template>
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
    <StTemplateManagerPage v-if="view === 'templates'" @open-in-designer="openInDesigner" />
    <LabelMaker v-else v-model:active-tab="activeTab" @open-templates="view = 'templates'" />
  </template>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import LoginPage from './components/LoginPage.vue';
import LabelMaker from './components/LabelMaker.vue';
import StTemplateManagerPage from './components/st/StTemplateManagerPage.vue';
import { setActiveTemplate } from './stores/templateStore.js';

const isAuthenticated = ref(false);
const currentRole = ref('user');
const activeTab = ref('maker');
const view = ref('labels');

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

function goLabels(tab) {
  activeTab.value = tab;
  view.value = 'labels';
}

function openInDesigner(templateId) {
  setActiveTemplate(templateId);
  view.value = 'labels';
  activeTab.value = 'st';
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
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.app-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
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
  padding: 8px 18px;
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

.header-btn.active {
  background: rgba(255, 255, 255, 0.92);
  color: #553c9a;
  border-color: transparent;
}

.header-btn.logout-btn {
  background: rgba(180, 40, 30, 0.55);
}

.header-btn.logout-btn:hover {
  background: rgba(180, 40, 30, 0.75);
}
</style>