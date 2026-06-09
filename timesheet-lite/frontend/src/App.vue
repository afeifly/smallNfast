<template>
  <div class="app-layout">
    <NavBar v-if="!isLoginPage" />
    <div class="main-content">
      <router-view />
    </div>
    <footer class="global-footer">
      <div class="footer-content">
        EX@SUTO-iTEC © All rights reserved. 2025 想必值得怀念
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth'
import NavBar from './components/NavBar.vue'

const route = useRoute()
const authStore = useAuthStore()
const isLoginPage = computed(() => route.name === 'login')

onMounted(() => {
  if (authStore.token) {
    authStore.decodeToken()
  }
})
</script>

<style>
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1;
}

.global-footer {
  border-top: 1px solid #dcdfe6;
  padding: 10px 20px;
  background-color: #fff;
  margin-top: auto;
}

.footer-content {
  text-align: right;
  color: #909399;
  font-size: 12px;
}
</style>
