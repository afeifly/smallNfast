<template>
  <div class="backup-manager">
    <h2>Backup Manager</h2>
    <div class="actions">
      <el-button type="primary" @click="runBackup" :loading="backingUp">Run Manual Backup</el-button>
      <el-button @click="fetchBackups">Refresh</el-button>
    </div>
    
    <el-table :data="backups" border style="width: 100%; margin-top: 20px" v-loading="loading">
      <el-table-column prop="filename" label="Filename" />
      <el-table-column prop="size" label="Size (Bytes)" width="150">
        <template #default="scope">
          {{ (scope.row.size / 1024).toFixed(2) }} KB
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="Created At">
        <template #default="scope">
          {{ formatDate(scope.row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="Actions" width="150" align="center">
        <template #default="scope">
          <el-button type="danger" size="small" @click="promptRestore(scope.row)">Restore</el-button>
        </template>
      </el-table-column>
    </el-table>
    
    <el-dialog v-model="restoreDialogVisible" title="Restore Database" width="500px">
      <div class="restore-warning">
        <el-alert
          title="Warning: Restore will overwrite current data"
          type="warning"
          description="This action is irreversible. All current data will be replaced by the backup."
          show-icon
          :closable="false"
        />
      </div>
      <el-form class="mt-4" label-position="top">
        <el-form-item label="Super Pass Code">
          <el-input 
            v-model="superCode" 
            placeholder="Paste your Super Pass Code here" 
            type="password"
            show-password
          />
          <div class="help-text">Code format: relative to (admin's password & date)</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="restoreDialogVisible = false">Cancel</el-button>
          <el-button type="danger" @click="confirmRestore" :loading="restoring">Confirm Restore</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api/axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const backups = ref([])
const loading = ref(false)
const backingUp = ref(false)
const restoring = ref(false)
const restoreDialogVisible = ref(false)
const superCode = ref('')
const selectedBackup = ref(null)

const fetchBackups = async () => {
  loading.value = true
  try {
    const response = await api.get('/backups/')
    backups.value = response.data
  } catch (error) {
    ElMessage.error('Failed to fetch backups')
  } finally {
    loading.value = false
  }
}

const runBackup = async () => {
  backingUp.value = true
  try {
    await api.post('/backups/run')
    ElMessage.success('Backup created successfully')
    fetchBackups()
  } catch (error) {
    ElMessage.error('Backup failed')
  } finally {
    backingUp.value = false
  }
}

const promptRestore = (backup) => {
  selectedBackup.value = backup
  superCode.value = ''
  restoreDialogVisible.value = true
}

const formatDate = (timestamp) => {
  if (!timestamp) return ''
  // Python float timestamp is in seconds
  return new Date(parseFloat(timestamp) * 1000).toLocaleString()
}

const confirmRestore = async () => {
  if (!superCode.value) {
    ElMessage.warning('Please enter the Super Pass Code')
    return
  }
  
  restoring.value = true
  try {
    await api.post('/backups/restore', {
      filename: selectedBackup.value.filename,
      super_code: superCode.value
    })
    ElMessage.success('Database restored successfully. Please restart the backend server.')
    restoreDialogVisible.value = false
  } catch (error) {
    const msg = error.response?.data?.detail || 'Restore failed'
    ElMessage.error(msg)
  } finally {
    restoring.value = false
  }
}

onMounted(() => {
  fetchBackups()
})
</script>

<style scoped>
.backup-manager {
  padding: 20px;
}
.actions {
  display: flex;
  gap: 10px;
}
.restore-warning {
  margin-bottom: 20px;
}
.mt-4 {
  margin-top: 20px;
}
.help-text {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}
</style>
