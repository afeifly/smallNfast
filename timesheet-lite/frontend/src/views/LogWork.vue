<template>
  <div class="log-work">
    <el-container>
      <el-main>
        <div v-if="authStore.isAdmin" class="admin-warning">
          <el-alert title="Admins cannot log work" type="warning" :closable="false" show-icon />
        </div>
        <el-card v-else class="timesheet-card">
          <div class="timesheet-header">
            <h3>Log Work (Mon - Sun)</h3>
            <div class="header-actions">
               <div class="week-navigation">
                  <el-button @click="changeWeek(-1)">Previous Week</el-button>
                  <span class="week-range">{{ weekRange }}</span>
                  <el-button @click="changeWeek(1)" :disabled="isCurrentWeek">Next Week</el-button>
               </div>
               <el-button type="primary" @click="saveTimesheet" :loading="saving" :disabled="isWeekApproved">
                  {{ isWeekApproved ? 'Week Approved' : 'Save Changes' }}
               </el-button>
            </div>
          </div>

          <!-- Header Row -->
          <div class="header-row">
            <div class="project-info-header">Project</div>
            <div class="days-header">
              <div v-for="(day, index) in weekDays" :key="index" class="day-header-item">
                <div>{{ day.label }}</div>
                <div :class="['header-total', { 'warning': getDailyTotal(index) !== 8 }]" v-if="getDayType(day.date) !== 'off'">
                  {{ getDailyTotal(index) }}h
                </div>
                <div v-if="getDayType(day.date) !== 'work'" class="day-status-badge">
                  <el-tag :type="getDayType(day.date) === 'off' ? 'danger' : 'warning'" size="small">
                    {{ getDayType(day.date) === 'off' ? 'OFF' : 'HALF' }}
                  </el-tag>
                </div>
                <el-tag v-if="isDayVerified(index)" type="success" size="small" class="verify-badge">Approved</el-tag>
              </div>
              </div>


          </div>

          <div v-for="project in projectRows" :key="project.id" class="project-row-wrapper">
            <div class="project-row">
              <div class="project-info">
                <h4>
                  {{ project.name }} 
                  <el-tag v-if="project.is_assigned" size="small" type="success">Assigned</el-tag>
                </h4>
              </div>
              <div class="days-container">
                <div v-for="(day, index) in weekDays" :key="index" class="day-column">
                  <!-- Removed day-label here -->
                  <div class="slider-wrapper" v-if="getDayType(day.date) !== 'off'" :style="{ width: getSliderWidth(index, project.hours[index]) }">
                    <el-slider 
                      v-model="project.hours[index]" 
                      :min="0" 
                      :max="getMaxHours(index, project.hours[index])" 
                      :step="1" 
                      show-stops
                      :active="false"
                      :disabled="isDayVerified(index)"
                      @change="handleHoursChange(project.id, day.date, project.hours[index])"
                    />
                  </div>
                  <div class="hours-display" v-if="getDayType(day.date) !== 'off'">{{ project.hours[index] }}h</div>
                </div>
              </div>

            </div>
            <!-- Removed el-divider -->
          </div>

          <div class="summary-section">
            <!-- Daily Totals section removed -->
            
            <div class="weekly-total">
              <strong>Weekly Total: {{ getWeeklyTotal() }} / {{ weeklyLimit }}h</strong>
              <el-progress 
                :percentage="weeklyLimit > 0 ? Math.min((getWeeklyTotal() / weeklyLimit) * 100, 100) : (getWeeklyTotal() > 0 ? 100 : 0)" 
                :status="getWeeklyTotal() > weeklyLimit ? 'exception' : (getWeeklyTotal() === weeklyLimit ? 'success' : '')"
              />
              <el-alert v-if="getWeeklyTotal() > weeklyLimit" title="Weekly limit exceeded!" type="error" show-icon :closable="false" class="mt-2" />
            </div>
          </div>


        </el-card>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../api/axios'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'

const authStore = useAuthStore()
const saving = ref(false)
const route = useRoute()
const router = useRouter()

const currentDate = ref(dayjs())
const projects = ref([])


const timesheets = ref([])
const projectRows = ref([])
const workDayMap = ref({})

const weekDays = computed(() => {
  const startOfWeek = currentDate.value.startOf('week') // Monday (en-gb)
  // 7 days (Mon-Sun)
  return Array.from({ length: 7 }, (_, i) => {
    const d = startOfWeek.add(i, 'day')
    return {
      label: d.format('ddd M-D'),
      date: d.format('YYYY-MM-DD')
    }
  })
})

const weekRange = computed(() => {
  if (!weekDays.value || weekDays.value.length < 7) return ''
  const start = weekDays.value[0].date
  const end = weekDays.value[6].date
  return `${start} - ${end}`
})

const isCurrentWeek = computed(() => {
  const today = dayjs()
  const startOfCurrentWeek = today.startOf('week')
  const startOfDisplayedWeek = currentDate.value.startOf('week')
  return startOfDisplayedWeek.isSame(startOfCurrentWeek, 'day') || startOfDisplayedWeek.isAfter(startOfCurrentWeek)
})


const changeWeek = (offset) => {
  currentDate.value = currentDate.value.add(offset, 'week')
  fetchData()
}

const getDayType = (date) => {
  if (workDayMap.value[date]) return workDayMap.value[date]
  
  const d = dayjs(date)
  if (d.day() === 0 || d.day() === 6) return 'off'
  
  return 'work'
}

const weeklyLimit = computed(() => {
  return weekDays.value.reduce((acc, day) => {
    const type = getDayType(day.date)
    if (type === 'off') return acc + 0
    if (type === 'half_off') return acc + 4
    return acc + 8
  }, 0)
})

const fetchData = async () => {
  try {
    const [pRes, tRes, userProjectsRes, wRes] = await Promise.all([
      api.get('/projects/'), // Get all projects (to find defaults)
      api.get('/timesheets/', {
        params: {
          start_date: weekDays.value[0].date,
          end_date: weekDays.value[6].date,
          user_id: authStore.user.id // Explicitly pass user_id
        }
      }),
      api.get(`/users/${authStore.user.id}/projects`), // Get assigned projects
      api.get('/workdays/', {
        params: {
          start_date: weekDays.value[0].date,
          end_date: weekDays.value[6].date
        }
      })
    ])
    
    // Process WorkDays
    const map = {}
    wRes.data.forEach(item => {
      map[item.date] = item.day_type
    })
    workDayMap.value = map

    const allProjects = pRes.data
    const assignedProjects = userProjectsRes.data
    const assignedIds = new Set(assignedProjects.map(p => p.id))
    
    // Filter: Default projects OR Assigned projects
    projects.value = allProjects.filter(p => p.is_default || assignedIds.has(p.id))
    
    timesheets.value = tRes.data
    
    // Sort projects: Non-default (Assigned) > Default.
    const sortedProjects = [...projects.value].sort((a, b) => {
        if (a.is_default === b.is_default) return 0;
        return a.is_default ? 1 : -1; 
    })
    
    // Build grid
    projectRows.value = sortedProjects.map(p => {
      const hours = weekDays.value.map(day => {
        const entry = timesheets.value.find(t => t.project_id === p.id && t.date === day.date)
        return entry ? entry.hours : 0
      })
      return {
        id: p.id,
        name: p.name,
        is_assigned: !p.is_default, // Approximation for UI
        hours
      }
    })
  } catch (error) {
    ElMessage.error('Failed to load data')
  }
}

const getDailyTotal = (dayIndex) => {
  const date = weekDays.value[dayIndex].date
  if (getDayType(date) === 'off') return 0
  return projectRows.value.reduce((sum, row) => sum + (row.hours[dayIndex] || 0), 0)
}

const getWeeklyTotal = () => {
  return projectRows.value.reduce((sum, row) => {
    const rowTotal = row.hours.reduce((a, b, index) => {
      // Check if this specific day is OFF
      const date = weekDays.value[index].date
      if (getDayType(date) === 'off') return a
      return a + (b || 0)
    }, 0)
    return sum + rowTotal
  }, 0)
}

const getMaxHours = (dayIndex, currentHours) => {
  const dailyTotal = getDailyTotal(dayIndex)
  const otherProjectsTotal = dailyTotal - currentHours
  const date = weekDays.value[dayIndex].date
  const type = getDayType(date)
  
  let dayLimit = 8
  if (type === 'off') dayLimit = 0
  if (type === 'half_off') dayLimit = 4
  
  const remainingHours = dayLimit - otherProjectsTotal
  return Math.max(0, Math.min(remainingHours, dayLimit))
}

const getSliderWidth = (dayIndex, currentHours) => {
  const maxHours = getMaxHours(dayIndex, currentHours)
  // Calculate width as percentage of 8 hours
  // If max is 8, width is 100%, if max is 1, width is 12.5%
  const widthPercentage = (maxHours / 8) * 100
  return `${widthPercentage}%`
}

const isDayVerified = (dayIndex) => {
  const date = weekDays.value[dayIndex].date
  const entry = timesheets.value.find(t => t.date === date)
  return entry ? entry.verify : false
}

const isWeekApproved = computed(() => {
  return weekDays.value.every((day, index) => {
    // Week is approved if every day is either verified OR is an OFF day (no work needed)
    return isDayVerified(index) || getDayType(day.date) === 'off'
  })
})

const handleHoursChange = (projectId, date, hours) => {
  // Optional: Real-time validation
}

const saveTimesheet = async () => {
  saving.value = true
  try {
    const batchEntries = []
    
    for (const row of projectRows.value) {
      row.hours.forEach((h, index) => {
        if (h >= 0) {
           const date = weekDays.value[index].date
           // Skip if day is verified
           if (isDayVerified(index)) return

           // Logic: Save if hours > 0 OR if there was an existing entry (to update/clear it)
           if (h > 0 || timesheets.value.some(t => t.project_id === row.id && t.date === date && t.hours > 0)) {
               batchEntries.push({
                 user_id: authStore.user.id,
                 project_id: row.id,
                 date: date,
                 hours: h
               })
           }
        }
      })
    }
    
    if (batchEntries.length > 0) {
        await api.post('/timesheets/batch', batchEntries)
    }
    ElMessage.success('Timesheet saved')
    fetchData() // Refresh
  } catch (error) {
    ElMessage.error('Failed to save: ' + (error.response?.data?.detail || error.message))
  } finally {
    saving.value = false
  }
}

// Watch for query param changes to update date
watch(() => route.query.date, (newDate) => {
  if (newDate) {
    currentDate.value = dayjs(newDate)
    fetchData()
  }
}, { immediate: true })

onMounted(fetchData)
</script>

<style scoped>
.timesheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}
.week-navigation {
  display: flex;
  align-items: center;
}
.week-range {
  margin: 0 10px;
  font-weight: bold;
  font-size: 1.1em;
}

/* New Header Row Styles */
.header-row {
  display: flex;
  align-items: center;
  background-color: #f5f7fa;
  padding: 10px 0;
  border-radius: 4px;
  margin-bottom: 10px;
  font-weight: bold;
  color: #606266;
  padding-right: 0; /* Match row padding */
}
.project-info-header {
  width: 200px; /* Match project-info width */
  padding-left: 10px;
  flex-shrink: 0;
}
.days-header {
  display: flex;
  flex: 1;
  gap: 5px;
}
.day-header-item {
  flex: 1;
  text-align: center;
  min-width: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.header-total {
  font-size: 0.9em;
  color: #67C23A;
  font-weight: bold;
  margin-top: 4px;
}

.header-total.warning {
  color: #E6A23C;
}
.verify-badge {
  margin-top: 4px;
}


.project-row-wrapper {
  margin-bottom: 0;
}

.project-row {
  display: flex;
  align-items: stretch;
  padding: 0;
  border-bottom: 1px solid #ebeef5;
}
.project-info {
  width: 200px;
  padding: 10px 10px 10px 10px; /* added vertical padding */
  display: flex;
  align-items: center;
  flex-shrink: 0;
  box-sizing: border-box;
}
.days-container {
  display: flex;
  flex: 1;
  gap: 5px;
}
.day-column {
  flex: 1;
  min-width: 80px;
  text-align: center;
  padding: 10px 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start; /* Changed from center to flex-start for left alignment */
  border-right: 1px dashed #dcdfe6;
}
.day-column:last-child {
  border-right: none;
}
.slider-wrapper {
  width: 100%;
  transition: width 0.3s ease;
}
.hours-display {
  margin-top: 5px;
  font-weight: bold;
  color: #409EFF;
  font-size: 0.9em;
}


.summary-section {
  background-color: #f5f7fa;
  padding: 20px;
  border-radius: 8px;
  margin-top: 30px;
}
.totals-grid {
  display: flex;
  align-items: center;
}
.total-label-placeholder {
  width: 200px;
  flex-shrink: 0;
}
.days-container-totals {
  display: flex;
  flex: 1;
  gap: 5px;
}
.total-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: white;
  padding: 10px;
  border-radius: 4px;
  flex: 1;
  min-width: 80px;
}
.total-spacer {
  width: 80px;
  flex-shrink: 0;
}

.total-value {
  font-size: 1.2em;
  font-weight: bold;
  color: #67C23A;
}
.total-value.warning {
  color: #E6A23C;
}
.weekly-total {
  margin-top: 20px;
}
.mt-2 {
  margin-top: 10px;
}
.actions {
  margin-top: 30px;
  text-align: right;
}
.day-status-badge {
  margin-top: 4px;
}
</style>
