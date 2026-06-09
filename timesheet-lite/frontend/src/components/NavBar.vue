<template>
  <el-menu
    :default-active="activeIndex"
    class="el-menu-demo"
    mode="horizontal"
    :ellipsis="false"
    router
  >
    <el-menu-item index="/" class="logo-item">
      <div class="logo-container">
        <img src="../assets/logo.png" alt="Logo" class="navbar-logo" />
        <span class="logo">SUTO Timesheet</span>
      </div>
    </el-menu-item>
    
    <div class="flex-grow" />
    
    <el-menu-item index="/">Dashboard</el-menu-item>
    <template v-if="!authStore.isAdmin">
      <el-menu-item index="/log-work">
        <span>Log Work</span>
        <el-icon v-if="!isCompliant" class="alarm-icon" @click.stop="handleAlarmClick">
          <el-tooltip content="Incomplete timesheets in last 2 weeks" placement="bottom">
            <Warning />
          </el-tooltip>
        </el-icon>
      </el-menu-item>
    </template>

    
    <el-menu-item index="/projects">Projects</el-menu-item>
    <el-menu-item index="/employees">Employees</el-menu-item>
    <el-menu-item index="/reports">Reports</el-menu-item>
    
    <template v-if="authStore.isAdmin">
      <el-menu-item index="/logs">Activity Logs</el-menu-item>
    </template>
    
    <template v-if="authStore.user?.role === 'team_leader'">
      <el-menu-item index="/team-timesheets">
        <span>Team Timesheets</span>
        <el-icon v-if="hasPendingApprovals" class="alarm-icon" @click.stop="handleTeamAlarmClick">
          <el-tooltip content="Pending approvals from your team" placement="bottom">
            <Warning />
          </el-tooltip>
        </el-icon>
      </el-menu-item>
    </template>

    <el-sub-menu index="user" v-if="authStore.user">
      <template #title>{{ authStore.user.username }}</template>
      <el-menu-item index="/help">About & Help</el-menu-item>
      <el-menu-item @click="showPasswordDialog = true">Change Password</el-menu-item>
      <template v-if="authStore.isAdmin">
        <el-menu-item index="/email-settings">Email Settings</el-menu-item>
        <el-menu-item index="/workdays">Work Day Management</el-menu-item>
        <el-menu-item index="/backups">Backup Manager</el-menu-item>
      </template>
      <el-menu-item @click="handleLogout">Logout</el-menu-item>
    </el-sub-menu>

    <el-dialog v-model="showPasswordDialog" title="Change Password" width="400px">
      <el-form :model="passwordForm" label-width="140px">
        <el-form-item label="Current Password">
          <el-input v-model="passwordForm.current_password" type="password" />
        </el-form-item>
        <el-form-item label="New Password">
          <el-input v-model="passwordForm.new_password" type="password" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showPasswordDialog = false">Cancel</el-button>
          <el-button type="primary" @click="changePassword">Change</el-button>
        </span>
      </template>
    </el-dialog>
  </el-menu>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../api/axios'
import { ElMessage } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const activeIndex = computed(() => route.path)
const showPasswordDialog = ref(false)
const passwordForm = ref({
  current_password: '',
  new_password: ''
})

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

const changePassword = async () => {
  if (passwordForm.value.new_password.length < 6 || passwordForm.value.new_password.length > 16) {
    ElMessage.error('Password must be between 6 and 16 characters')
    return
  }
  try {
    await api.put('/users/me/password', passwordForm.value)
    ElMessage.success('Password changed successfully')
    showPasswordDialog.value = false
    passwordForm.value = { current_password: '', new_password: '' }
  } catch (error) {
    ElMessage.error('Failed to change password: ' + (error.response?.data?.detail || error.message))
  }
}


const isCompliant = ref(true)
const firstIncompleteDate = ref(null)
const hasPendingApprovals = ref(false)

const checkCompliance = async () => {
  if (!authStore.user) return
  try {
    const response = await api.get('/users/me/compliance')
    isCompliant.value = response.data.compliant
    firstIncompleteDate.value = response.data.first_incomplete_date
  } catch (error) {
    console.error('Failed to check compliance', error)
  }
}

const checkPendingApprovals = async () => {
  if (!authStore.user || authStore.user.role !== 'team_leader') return
  try {
    const response = await api.get('/users/me/pending-approvals')
    hasPendingApprovals.value = response.data.has_pending
  } catch (error) {
    console.error('Failed to check pending approvals', error)
  }
}

const handleAlarmClick = () => {
  if (firstIncompleteDate.value) {
    router.push({ path: '/log-work', query: { date: firstIncompleteDate.value } })
  }
}

const handleTeamAlarmClick = () => {
  router.push('/team-timesheets')
}

onMounted(() => {
  checkCompliance()
  checkPendingApprovals()
  
  // Listen for refresh events from TeamTimesheets
  window.addEventListener('refresh-pending-approvals', checkPendingApprovals)
})

onUnmounted(() => {
  window.removeEventListener('refresh-pending-approvals', checkPendingApprovals)
})
</script>

<style scoped>
.flex-grow {
  flex-grow: 1;
}
.logo-container {
  display: flex;
  align-items: center;
  gap: 10px;
}
.navbar-logo {
  height: 60px;
  width: auto;
  object-fit: contain;
  transition: transform 0.3s ease;
}
.navbar-logo:hover {
  transform: scale(1.05);
}
.logo {
  font-weight: bold;
  font-size: 1.5em;
  color: #409EFF;
  white-space: nowrap;
}
:deep(.el-menu-item.logo-item) {
  padding: 0 8px !important;
}
.alarm-icon {
  color: #F56C6C;
  margin-left: 5px;
  font-size: 1.2em;
  vertical-align: middle;
  cursor: pointer;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
</style>
