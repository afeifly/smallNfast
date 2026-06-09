<template>
  <div class="login-container">
    <el-card class="login-card">
      <div class="login-header">
        <img src="../assets/logo.png" alt="Logo" class="login-logo" />
        <h2>SUTO Timesheet System</h2>
      </div>
      <el-form :model="form" label-width="80px" @keyup.enter="handleLogin">
        <el-form-item label="Username">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item label="Password">
          <el-input v-model="form.password" type="password" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleLogin">Login</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { ElMessage } from 'element-plus'

const router = useRouter()
const authStore = useAuthStore()

const form = ref({
  username: '',
  password: ''
})

const handleLogin = async () => {
  try {
    await authStore.login(form.value.username, form.value.password)
    ElMessage.success('Login successful')
    
    if (authStore.isAdmin) {
        router.push('/')
    } else {
        router.push('/log-work')
    }
  } catch (error) {
    ElMessage.error('Login failed: ' + (error.response?.data?.detail || error.message))
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f2f5;
}
.login-card {
  width: 400px;
}
.login-header {
  text-align: center;
  margin-bottom: 30px;
}
.login-logo {
  height: 80px;
  width: auto;
  margin-bottom: 10px;
}
.login-header h2 {
  margin: 0;
  color: #409EFF;
}
</style>
