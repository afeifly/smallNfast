<template>
  <div class="logs-container">
    <h2>System Activity Logs</h2>
    <el-table :data="logs" style="width: 100%" stripe>
      <el-table-column prop="timestamp" label="Time" width="180">
        <template #default="scope">
          {{ formatDate(scope.row.timestamp) }}
        </template>
      </el-table-column>
      <el-table-column prop="username" label="User" width="120" />
      <el-table-column prop="action" label="Action" width="180" />
      <el-table-column prop="details" label="Details" />
    </el-table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api/axios'
import dayjs from 'dayjs'

const logs = ref([])

const fetchLogs = async () => {
  try {
    const response = await api.get('/activity_logs/')
    logs.value = response.data
  } catch (error) {
    console.error(error)
  }
}

const formatDate = (date) => {
  if (!date.endsWith('Z')) {
    date += 'Z'
  }
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(fetchLogs)
</script>

<style scoped>
.logs-container {
  padding: 20px;
}
</style>
