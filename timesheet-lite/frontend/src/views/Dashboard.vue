<template>
  <div class="dashboard">
    <el-container>
      <el-main>
        <el-row :gutter="20">
          <!-- Activity Feed -->
          <el-col :span="12" :xs="24">
            <el-card class="dashboard-card">
              <template #header>
                <div class="card-header">
                  <h3>Activity Feed</h3>
                  <el-button type="text" @click="fetchLogs">Refresh</el-button>
                </div>
              </template>
              
              <div class="activity-feed-container">
                <div v-if="loading" class="loading">
                  <el-skeleton :rows="5" animated />
                </div>
                
                <el-timeline v-else>
                  <el-timeline-item
                    v-for="(log, index) in logs"
                    :key="index"
                    :timestamp="formatDate(log.timestamp)"
                    :type="getLogType(log.action)"
                    :size="log.action.includes('ASSIGN') ? 'large' : 'normal'"
                  >
                    <h4>{{ formatAction(log.action) }} <small class="text-gray">by {{ log.username }}</small></h4>
                    <p>{{ log.details }}</p>
                  </el-timeline-item>
                </el-timeline>
                
                <el-empty v-if="!loading && logs.length === 0" description="No recent activity" />
              </div>
            </el-card>
          </el-col>

          <!-- My Statistics -->
          <el-col :span="12" :xs="24">
            <el-card class="dashboard-card">
              <template #header>
                <div class="card-header">
                  <h3>My Statistics</h3>
                </div>
              </template>
              
              <div v-if="statsLoading">
                <el-skeleton :rows="5" animated />
              </div>
              
              <div v-else class="stats-container">
                <div class="stats-summary">
                  <div class="stat-item">
                    <div class="stat-label">Projects Participated</div>
                    <div class="stat-value">{{ userStats.projects_count }}</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-label">Total Hours</div>
                    <div class="stat-value">{{ userStats.total_hours }}h</div>
                  </div>
                </div>

                <div class="project-list">
                  <h4>Project Time Percentage</h4>
                  <div v-if="userStats.projects && userStats.projects.length > 0" class="chart-container">
                    <Pie :key="chartKey" :data="chartData" :options="chartOptions" />
                  </div>
                  <el-empty v-else description="No project data" />
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../api/axios'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Pie } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, ArcElement)

dayjs.extend(relativeTime)

const logs = ref([])
const loading = ref(false)
const userStats = ref({ projects_count: 0, total_hours: 0, projects: [] })
const statsLoading = ref(false)

const chartData = computed(() => ({
  labels: userStats.value.projects.map(p => p.full_name || p.name),
  datasets: [{
    label: 'Hours',
    data: userStats.value.projects.map(p => p.hours),
    backgroundColor: [
      'rgba(255, 99, 132, 0.7)',
      'rgba(54, 162, 235, 0.7)',
      'rgba(255, 206, 86, 0.7)',
      'rgba(75, 192, 192, 0.7)',
      'rgba(153, 102, 255, 0.7)',
      'rgba(255, 159, 64, 0.7)',
    ],
    borderColor: [
      'rgba(255, 99, 132, 1)',
      'rgba(54, 162, 235, 1)',
      'rgba(255, 206, 86, 1)',
      'rgba(75, 192, 192, 1)',
      'rgba(153, 102, 255, 1)',
      'rgba(255, 159, 64, 1)',
    ],
    borderWidth: 1
  }]
}))

const chartKey = computed(() => {
  return userStats.value.projects.length > 0 ? `chart-${userStats.value.projects.length}` : 'empty'
})


const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'right'
    },
    tooltip: {
      callbacks: {
        label: function(context) {
          const hours = context.parsed
          const project = userStats.value.projects[context.dataIndex]
          return `${project.full_name || project.name}: ${hours}h (${project.percentage}%)`
        }
      }
    }
  }
}


const customColors = [
  { color: '#f56c6c', percentage: 20 },
  { color: '#e6a23c', percentage: 40 },
  { color: '#5cb87a', percentage: 60 },
  { color: '#1989fa', percentage: 80 },
  { color: '#6f7ad3', percentage: 100 },
]

const fetchLogs = async () => {
  loading.value = true
  try {
    const response = await api.get('/activity_logs/', { params: { limit: 20 } })
    logs.value = response.data
  } catch (error) {
    console.error('Failed to fetch logs', error)
  } finally {
    loading.value = false
  }
}

const fetchUserStats = async () => {
  statsLoading.value = true
  try {
    const response = await api.get('/reports/user_stats')
    userStats.value = response.data
  } catch (error) {
    console.error('Failed to fetch user stats', error)
  } finally {
    statsLoading.value = false
  }
}

const formatDate = (date) => {
  if (!date.endsWith('Z')) {
    date += 'Z'
  }
  return dayjs(date).fromNow()
}

const formatAction = (action) => {
  return action.replace(/_/g, ' ')
}

const getLogType = (action) => {
  if (action.includes('CREATE')) return 'success'
  if (action.includes('DELETE')) return 'danger'
  if (action.includes('ASSIGN')) return 'primary'
  return 'info'
}

onMounted(() => {
  fetchLogs()
  fetchUserStats()
})
</script>

<style scoped>
.dashboard {
  padding: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.dashboard-card {
  height: 100%;
  margin-bottom: 20px;
}
.activity-feed-container {
  height: 500px;
  overflow-y: auto;
  padding-right: 10px;
}
.stats-summary {
  display: flex;
  justify-content: space-around;
  margin-bottom: 30px;
  text-align: center;
}
.stat-label {
  color: #909399;
  font-size: 14px;
  margin-bottom: 5px;
}
.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #409EFF;
}
.chart-container {
  height: 300px;
  margin-top: 20px;
}

.project-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 14px;
}
.project-name {
  font-weight: 500;
}
.project-hours {
  color: #909399;
}
.text-gray {
  color: #909399;
  font-size: 0.9em;
  margin-left: 8px;
}
</style>
```
