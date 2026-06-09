<template>
  <div class="email-settings-container">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>Email Settings</span>
        </div>
      </template>
      
      <el-form :model="form" label-width="140px" v-loading="loading">
        <el-form-item label="SMTP Server">
          <el-input v-model="form.smtp_server" placeholder="smtp.example.com" />
        </el-form-item>
        
        <el-form-item label="SMTP Port">
          <el-input-number v-model="form.smtp_port" :min="1" :max="65535" />
        </el-form-item>
        
        <el-form-item label="SMTP Username">
          <el-input v-model="form.smtp_username" placeholder="user@example.com" />
        </el-form-item>
        
        <el-form-item label="SMTP Password">
          <el-input v-model="form.smtp_password" type="password" show-password placeholder="Password" />
        </el-form-item>
        
        <el-form-item label="Sender Email">
          <el-input v-model="form.sender_email" placeholder="noreply@example.com" />
        </el-form-item>
        
        <el-form-item label="Checking Service">
          <el-switch v-model="form.checking_service_enabled" active-text="Enable (Every Monday 10 AM)" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="saveSettings">Save Settings</el-button>
          <el-button type="success" @click="showTestDialog = true">Send Test Email</el-button>
        </el-form-item>

        <el-form-item>
          <el-button type="warning" @click="checkTimesheetCompliance" :loading="checkingTimesheets">Test no finish timesheet notify</el-button>
          <el-button type="danger" @click="checkApprovalCompliance" :loading="checkingApprovals">Test no approval notify</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-dialog v-model="showTestDialog" title="Send Test Email" width="400px">
      <el-form :model="testForm">
        <el-form-item label="Recipient Email">
          <el-input v-model="testForm.recipient" placeholder="recipient@example.com" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showTestDialog = false">Cancel</el-button>
          <el-button type="primary" @click="sendTestEmail" :loading="sendingTest">Send</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api/axios'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const showTestDialog = ref(false)
const sendingTest = ref(false)
const checkingTimesheets = ref(false)
const checkingApprovals = ref(false)

const form = ref({
  smtp_server: '',
  smtp_port: 587,
  smtp_username: '',
  smtp_password: '',
  sender_email: '',
  checking_service_enabled: false
})

const testForm = ref({
  recipient: ''
})

const fetchSettings = async () => {
  loading.value = true
  try {
    const response = await api.get('/settings/email')
    if (response.data) {
      form.value = response.data
    }
  } catch (error) {
    ElMessage.error('Failed to load settings: ' + (error.response?.data?.detail || error.message))
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  loading.value = true
  try {
    await api.put('/settings/email', form.value)
    ElMessage.success('Settings saved successfully')
  } catch (error) {
    ElMessage.error('Failed to save settings: ' + (error.response?.data?.detail || error.message))
  } finally {
    loading.value = false
  }
}

const sendTestEmail = async () => {
  if (!testForm.value.recipient) {
    ElMessage.warning('Please enter a recipient email')
    return
  }
  
  sendingTest.value = true
  try {
    await api.post('/settings/email/test', testForm.value)
    ElMessage.success('Test email sent successfully')
    showTestDialog.value = false
    testForm.value.recipient = ''
  } catch (error) {
    ElMessage.error('Failed to send test email: ' + (error.response?.data?.detail || error.message))
  } finally {
    sendingTest.value = false
  }
}

const checkTimesheetCompliance = async () => {
  checkingTimesheets.value = true
  try {
    const response = await api.post('/settings/email/test-no-finish-timesheet')
    ElMessage.success(response.data.message || 'Compliance check email sent')
  } catch (error) {
    ElMessage.error('Failed to check timesheets: ' + (error.response?.data?.detail || error.message))
  } finally {
    checkingTimesheets.value = false
  }
}

const checkApprovalCompliance = async () => {
  checkingApprovals.value = true
  try {
    const response = await api.post('/settings/email/test-no-approval-notify')
    ElMessage.success(response.data.message || 'Approval check email sent')
  } catch (error) {
    ElMessage.error('Failed to check approvals: ' + (error.response?.data?.detail || error.message))
  } finally {
    checkingApprovals.value = false
  }
}

onMounted(() => {
  fetchSettings()
})
</script>

<style scoped>
.email-settings-container {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
