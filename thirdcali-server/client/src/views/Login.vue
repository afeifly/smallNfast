<template>
  <div class="login-page flex center center-content">
    <div class="glass card login-card">
      <div class="login-header">
        <div class="logo flex center justify-center mb-16 gap-8">
          <div class="logo-icon"></div>
          <span class="logo-text">LAB<span>CALI</span></span>
        </div>
        <p>Enter your credentials to manage calibrations</p>
      </div>
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label>Username</label>
          <input v-model="username" type="text" placeholder="admin" required />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input v-model="password" type="password" placeholder="••••••••" required />
        </div>
        <p v-if="error" class="error-msg">{{ error }}</p>
        <button type="submit" class="primary w-full" :disabled="loading">
          <span v-if="!loading">Sign In</span>
          <span v-else>Authenticating...</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAppStore } from '../store'
import { useRouter } from 'vue-router'

const store = useAppStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
  loading.ref = true
  error.value = ''
  const success = await store.login(username.value, password.value)
  if (success) {
    router.push('/')
  } else {
    error.value = store.error
  }
  loading.value = false
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  justify-content: center;
  align-items: center;
  background: #f0f2f5;
}
.login-card {
  width: 100%;
  max-width: 400px;
}
.login-header {
  text-align: center;
  margin-bottom: 32px;
}
.login-header h1 {
  margin-bottom: 8px;
  font-size: 1.8rem;
}
.login-header p {
  color: var(--text-muted);
  font-size: 0.9rem;
}
.form-group {
  margin-bottom: 20px;
}
.error-msg {
  color: #ff7b72;
  font-size: 0.85rem;
  margin-bottom: 16px;
  background: rgba(255, 123, 114, 0.1);
  padding: 8px;
  border-radius: 4px;
}
.w-full {
  width: 100%;
  justify-content: center;
}
</style>
