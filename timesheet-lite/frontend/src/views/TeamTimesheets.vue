<template>
  <div class="team-timesheets">
    <el-container>
      <el-aside width="250px">
        <el-menu :default-active="selectedEmployeeId?.toString()" @select="handleEmployeeSelect">
          <el-menu-item v-for="emp in employees" :key="emp.id" :index="emp.id.toString()">
            {{ emp.username }} ({{ emp.full_name || 'No Name' }})
          </el-menu-item>
        </el-menu>
      </el-aside>
      
      <el-main>
        <div v-if="!selectedEmployeeId" class="empty-state">
          Select an employee to view their timesheet
        </div>
        
        <el-card v-else class="timesheet-card">
          <div v-if="isWeekFullyApproved" class="approved-stamp">APPROVED</div>
          <div class="timesheet-header">
            <h3>{{ selectedEmployee?.username }}'s Timesheet</h3>
            <div class="header-actions">
                <div class="week-navigation">
                  <el-button @click="changeWeek(-1)">Previous Week</el-button>
                  <span class="week-range">{{ weekRange }}</span>
                  <el-button @click="changeWeek(1)" :disabled="isCurrentWeek">Next Week</el-button>
                </div>
                <el-button type="primary" @click="saveTimesheet" :loading="saving" :disabled="!canApprove">Approve</el-button>
            </div>
          </div>

          <!-- Header Row -->
          <div class="header-row">
            <div class="project-info-header">Project</div>
            <div class="days-header">
              <div v-for="(day, index) in weekDays" :key="index" class="day-header-item">
                <div>{{ day.label }}</div>
                <div v-if="getExpectedHours(index) < 8" style="font-size: 0.8em; color: #E6A23C; font-weight: bold;">
                  {{ getExpectedHours(index) === 0 ? '(OFF)' : '(HALF)' }}
                </div>
                <div :class="['header-total', { 'warning': getDailyTotal(index) > getExpectedHours(index) }]" v-if="getExpectedHours(index) > 0">
                  {{ getDailyTotal(index) }}h / {{ getExpectedHours(index) }}h
                </div>
                <el-tag v-if="isDayVerified(index)" type="success" size="small" class="verify-badge">Approved</el-tag>
                <el-tag v-else-if="getExpectedHours(index) > 0" type="info" size="small" class="verify-badge">Unapproved</el-tag>
              </div>
            </div>

          </div>

          <div v-for="project in projectRows" :key="project.id" class="project-row-wrapper">
            <div class="project-row">
              <div class="project-info">
                <h4>{{ project.name }}</h4>
              </div>
              <div class="days-container">
                <div v-for="(day, index) in weekDays" :key="index" class="day-column">
                  <div class="slider-wrapper" v-if="getExpectedHours(index) > 0" :style="{ width: getSliderWidth(index, project.hours[index]) }">
                    <el-slider 
                      v-model="project.hours[index]" 
                      :min="0" 
                      :max="getMaxHours(index, project.hours[index])" 
                      :step="1" 
                      show-stops
                      @change="handleHoursChange(project.id, day.date, project.hours[index])"
                    />
                  </div>
                  <div class="hours-display" v-if="getExpectedHours(index) > 0">{{ project.hours[index] }}h</div>
                </div>
              </div>

            </div>
            <!-- Removed el-divider -->
          </div>


        </el-card>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../api/axios'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'

const authStore = useAuthStore()

const employees = ref([])
const selectedEmployeeId = ref(null)
const selectedEmployee = computed(() => employees.value.find(e => e.id == selectedEmployeeId.value))

const currentDate = ref(dayjs())
const projects = ref([])
const timesheets = ref([])
const projectRows = ref([])
const workDays = ref({})
const saving = ref(false)

const weekDays = computed(() => {
  const startOfWeek = currentDate.value.startOf('week')
  return Array.from({ length: 7 }, (_, i) => {
    const d = startOfWeek.add(i, 'day')
    return {
      label: d.format('ddd M-D'),
      date: d.format('YYYY-MM-DD')
    }
  })
})

const weekRange = computed(() => {
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

const canApprove = computed(() => {
  // Check if every day (Mon-Fri) has MET its expected hours
  return weekDays.value.every((_, index) => {
      const total = getDailyTotal(index)
      const expected = getExpectedHours(index)
      return total === expected
  })
})

const isWeekFullyApproved = computed(() => {
  if (!weekDays.value.length) return false
  return weekDays.value.every((_, index) => {
    // Week is fully approved if every day is either OFF (0 expected) 
    // OR is verified (approved)
    return getExpectedHours(index) === 0 || isDayVerified(index)
  })
})

const fetchEmployees = async () => {
  try {
    const response = await api.get('/users/')
    // Filter for employees assigned to me (Backend doesn't filter by default, so we filter here or need backend endpoint)
    // Actually, backend /users/ returns all users. We need to filter by team_leader_id if we had current user id.
    // But better to have an endpoint /users/my-employees. 
    // For now, let's assume we can filter on frontend if we know our ID.
    // Wait, we can use authStore.user.id
    // But `read_users` returns ALL users.
    // Let's filter on frontend.
    // Let's filter on frontend.
    const myId = authStore.user?.id
    if (myId) {
        employees.value = response.data.filter(u => u.team_leader_id === myId)
        // Check if previously selected employee is still in list
        if (selectedEmployeeId.value && !employees.value.find(e => e.id == selectedEmployeeId.value)) {
            selectedEmployeeId.value = null
        }
        
        // Default select first employee if available and nothing selected
        if (!selectedEmployeeId.value && employees.value.length > 0) {
           selectedEmployeeId.value = employees.value[0].id
           fetchData()
        }
    }
  } catch (error) {
    ElMessage.error('Failed to fetch employees')
  }
}

const fetchData = async () => {
  if (!selectedEmployeeId.value) return
  
  try {
    const [allProjectsRes, assignedProjectsRes, tRes, workDaysRes] = await Promise.all([
      api.get('/projects/'), // Get all projects (to find defaults)
      api.get(`/users/${selectedEmployeeId.value}/projects`), // Get assigned projects
      api.get('/timesheets/', {
        params: {
          start_date: weekDays.value[0].date,
          end_date: weekDays.value[6].date,
          user_id: selectedEmployeeId.value
        }
      }),
      api.get('/workdays/', {
        params: {
          start_date: weekDays.value[0].date,
          end_date: weekDays.value[6].date
        }
      })
    ])
    
    // Process WorkDays
    const wdMap = {}
    workDaysRes.data.forEach(item => {
      wdMap[item.date] = item.day_type
    })
    workDays.value = wdMap

    const allProjects = allProjectsRes.data
    const assignedProjects = assignedProjectsRes.data
    const assignedIds = new Set(assignedProjects.map(p => p.id))
    
    // Filter: Default projects OR Assigned projects
    projects.value = allProjects.filter(p => p.is_default || assignedIds.has(p.id))
    
    // Sort: Custom projects (is_default=false) at top, Default projects (is_default=true) at bottom
    projects.value.sort((a, b) => {
        if (a.is_default === b.is_default) return 0
        return a.is_default ? 1 : -1
    })
    
    timesheets.value = tRes.data
    
    projectRows.value = projects.value.map(p => {
      const hours = weekDays.value.map(day => {
        const entry = timesheets.value.find(t => t.project_id === p.id && t.date === day.date)
        return entry ? entry.hours : 0
      })
      return {
        id: p.id,
        name: p.name,
        hours
      }
    })
  } catch (error) {
    console.error(error)
    ElMessage.error('Failed to load timesheet data')
  }
}

const handleEmployeeSelect = (index) => {
  selectedEmployeeId.value = index
  fetchData()
}

const changeWeek = (offset) => {
  currentDate.value = currentDate.value.add(offset, 'week')
  fetchData()
}

const getDailyTotal = (dayIndex) => {
  const dateStr = weekDays.value[dayIndex].date
  if (getExpectedHours(dayIndex) === 0 && !workDays.value[dateStr]) { // simplistic check? Better to check type
     // actually getExpectedHours returns 0 for OFF days
  }
  // Better use getExpectedHours check or direct type check
  const type = workDays.value[dateStr] || 'work'
  // logic from getExpectedHours:
  const d = dayjs(dateStr)
  const isWeekend = d.day() === 0 || d.day() === 6
  let isOff = false
  if (isWeekend && !workDays.value[dateStr]) isOff = true
  if (type === 'off') isOff = true
  
  if (isOff) return 0
  
  return projectRows.value.reduce((sum, row) => sum + (row.hours[dayIndex] || 0), 0)
}

const getProjectTotal = (project) => {
  return project.hours.reduce((sum, h, index) => {
    // Check if day is OFF using same logic
    const dateStr = weekDays.value[index].date
    const type = workDays.value[dateStr] || 'work'
    const d = dayjs(dateStr)
    const isWeekend = d.day() === 0 || d.day() === 6
    let isOff = false
    if (isWeekend && !workDays.value[dateStr]) isOff = true
    if (type === 'off') isOff = true
    
    if (isOff) return sum
    return sum + (h || 0)
  }, 0)
}

const getExpectedHours = (dayIndex) => {
  const dateStr = weekDays.value[dayIndex].date
  const type = workDays.value[dateStr] || 'work'
  
  // Default Sat/Sun to 0 if not specified
  const d = dayjs(dateStr)
  if (d.day() === 0 || d.day() === 6) {
      if (!workDays.value[dateStr]) return 0
  }

  if (type === 'off') return 0
  if (type === 'half_off') return 4
  return 8
}

const isDayVerified = (dayIndex) => {
  const date = weekDays.value[dayIndex].date
  // Check if any entry for this date is verified (all should be same)
  const entry = timesheets.value.find(t => t.date === date)
  return entry ? entry.verify : false
}

const getMaxHours = (dayIndex, currentHours) => {
  const dailyTotal = getDailyTotal(dayIndex)
  const otherProjectsTotal = dailyTotal - currentHours
  const max = getExpectedHours(dayIndex)
  const remainingHours = max - otherProjectsTotal
  return Math.max(0, Math.min(remainingHours, max))
}

const getSliderWidth = (dayIndex, currentHours) => {
  const maxHours = getMaxHours(dayIndex, currentHours)
  const widthPercentage = (maxHours / 8) * 100
  return `${widthPercentage}%`
}

const handleHoursChange = (projectId, date, hours) => {
  // Update local state
}

const saveTimesheet = async () => {
  saving.value = true
  try {
    const promises = []
    
    const dailyTotals = weekDays.value.map((day, index) => {
        return {
            date: day.date,
            total: getDailyTotal(index),
            expected: getExpectedHours(index)
        }
    })

    const batchEntries = []

    for (const row of projectRows.value) {
      row.hours.forEach((h, index) => {
        const date = weekDays.value[index].date
        const dayTotal = dailyTotals[index].total
        const expected = dailyTotals[index].expected
        
        // precise verification: total matches expected (e.g. 0/0, 4/4, 8/8)
        const shouldVerify = dayTotal === expected
        
        // Always save if > 0 or if existing entry > 0 (to clear it)
        if (h >= 0) {
           if (h > 0 || timesheets.value.some(t => t.project_id === row.id && t.date === date && t.hours > 0)) {
               batchEntries.push({
                 user_id: selectedEmployeeId.value,
                 project_id: row.id,
                 date: date,
                 hours: h,
                 verify: shouldVerify
               })
           }
        }
      })
    }
    
    if (batchEntries.length > 0) {
        await api.post('/timesheets/batch', batchEntries)
    }
    ElMessage.success('Timesheet saved and approved where applicable')
    fetchData()
    
    // Trigger refresh of pending approvals alert in NavBar
    window.dispatchEvent(new CustomEvent('refresh-pending-approvals'))
  } catch (error) {
    ElMessage.error('Failed to save: ' + (error.response?.data?.detail || error.message))
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchEmployees()
})
</script>

<style scoped>
.team-timesheets {
  height: 100%;
}
.timesheet-card {
  margin-bottom: 20px;
  position: relative; /* For stamp positioning */
}
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
  margin: 0 20px;
  font-weight: bold;
}
.header-row {
  display: flex;
  align-items: center;
  background-color: #f5f7fa;
  padding: 10px 0;
  border-radius: 4px;
  margin-bottom: 10px;
  font-weight: bold;
  color: #606266;
}
.project-info-header {
  width: 200px;
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
  margin-top: 4px;
}
.header-total.warning {
  color: #E6A23C;
}
.verify-badge {
  margin-top: 5px;
}

.project-row {
  display: flex;
  align-items: stretch;
  padding: 0;
  border-bottom: 1px solid #ebeef5;
}
.project-info {
  width: 200px;
  padding: 10px 10px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
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
  align-items: flex-start;
  border-right: 1px dashed #dcdfe6;
}
.day-column:last-child {
  border-right: none;
}
.slider-wrapper {
  width: 100%;
}
.hours-display {
  margin-top: 5px;
  font-weight: bold;
  color: #409EFF;
}

.actions {
  margin-top: 20px;
  text-align: right;
}
.empty-state {
  text-align: center;
  color: #909399;
  margin-top: 50px;
}
.project-list {
  max-height: 300px;
  overflow-y: auto;
  margin: 20px 0;
}

.approved-stamp {
  position: absolute;
  top: 60px;
  right: 40px;
  border: 4px solid #F56C6C;
  color: #F56C6C;
  font-weight: bold;
  font-size: 2.5em;
  padding: 10px 20px;
  transform: rotate(-15deg);
  opacity: 0.8;
  pointer-events: none;
  z-index: 100;
  border-radius: 10px;
  letter-spacing: 2px;
  font-family: 'Courier New', Courier, monospace;
}
</style>
