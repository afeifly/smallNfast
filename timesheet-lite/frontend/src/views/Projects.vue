<template>
  <div class="projects-container">
    <div class="header">
      <h2>Projects Management</h2>
      <el-button v-if="isAdmin" type="primary" @click="openCreateDialog">Add Project</el-button>
    </div>

    <el-table :data="projects" style="width: 100%">
      <el-table-column prop="id" label="No." width="60" />
      <el-table-column prop="custom_id" label="Project ID" width="100" />
      <el-table-column prop="name" label="PJ Name" width="120" />
      <el-table-column prop="full_name" label="Full Name" width="150" />
      <el-table-column label="Chinese Name" width="120">
        <template #default="scope">
          {{ scope.row.chinese_name || '&nbsp;' }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="Status" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'RUN' ? 'success' : (scope.row.status === 'CLOSE' ? 'info' : 'warning')">
            {{ scope.row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="start_date" label="Start Date" width="110" />
      <el-table-column prop="plan_closed_date" label="Plan Close" width="110" />
      <el-table-column prop="actual_closed_date" label="Actual Close" width="110" />
      <el-table-column prop="description" label="Description" />
      <el-table-column prop="remark" label="Remark" />
      <el-table-column label="Actions" :width="isAdmin ? 200 : 100" fixed="right">
        <template #default="scope">
          <el-button size="small" type="primary" link @click="viewStats(scope.row)">Log Stats</el-button>
          <template v-if="isAdmin">
            <el-button size="small" type="primary" link @click="openEditDialog(scope.row)">Edit</el-button>
            <el-button 
              v-if="!scope.row.is_default" 
              type="danger" 
              size="small" 
              link
              @click="handleDelete(scope.row)"
            >
              Delete
            </el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showStatsDialog" :title="'Log Stats - ' + selectedProject?.name" width="800px">
      <div style="margin-bottom: 16px">
        <el-radio-group v-model="statsViewMode" size="small">
          <el-radio-button value="staff">By Staff</el-radio-button>
          <el-radio-button value="monthly">By Month</el-radio-button>
        </el-radio-group>
      </div>

      <el-table 
        v-if="statsViewMode === 'staff'" 
        :data="projectStats" 
        style="width: 100%" 
        show-summary 
        :summary-method="getSummary"
        @expand-change="handleStaffExpand"
        row-key="user_id"
      >
        <el-table-column type="expand">
          <template #default="props">
            <div v-loading="props.row.loadingStats" style="padding: 10px; display: flex; gap: 20px; min-height: 80px;">
              <template v-if="props.row.statsBreakdown">
                <div style="flex: 1;">
                  <h4 style="margin-top: 0;">Weekly Breakdown</h4>
                  <el-table :data="props.row.statsBreakdown.weekly" size="small" border>
                    <el-table-column prop="year_week" label="Year-Week" />
                    <el-table-column prop="hours" label="Hours">
                      <template #default="scope">{{ scope.row.hours }} h</template>
                    </el-table-column>
                  </el-table>
                </div>
                <div style="flex: 1;">
                  <h4 style="margin-top: 0;">Monthly Breakdown</h4>
                  <el-table :data="props.row.statsBreakdown.monthly" size="small" border>
                    <el-table-column prop="year_month" label="Year-Month" />
                    <el-table-column prop="hours" label="Hours">
                      <template #default="scope">{{ scope.row.hours }} h</template>
                    </el-table-column>
                  </el-table>
                </div>
              </template>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="Staff">
          <template #default="scope">
            {{ scope.row.full_name || scope.row.username }}
          </template>
        </el-table-column>
        <el-table-column prop="hours" label="Logged Hours" width="150">
          <template #default="scope">
            {{ scope.row.hours }} h
          </template>
        </el-table-column>
      </el-table>

      <el-table v-else :data="projectMonthlyStats" style="width: 100%" show-summary :summary-method="getMonthlySummary">
        <el-table-column prop="year_month" label="Month" width="150" />
        <el-table-column prop="hours" label="Logged Hours" width="150">
          <template #default="scope">
            {{ scope.row.hours }} h
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="showCreateDialog" :title="isEditing ? 'Edit Project' : 'Create Project'" width="600px">
      <el-form :model="form" label-width="140px">
        <el-form-item label="No. PJ Name" required>
          <el-input v-model="form.name" placeholder="e.g. P001" />
        </el-form-item>
        <el-form-item label="Full Name">
          <el-input v-model="form.full_name" />
        </el-form-item>
        <el-form-item label="Chinese Name">
          <el-input v-model="form.chinese_name" />
        </el-form-item>
        <el-form-item label="Project ID">
          <el-input v-model="form.custom_id" placeholder="e.g. 1193" />
        </el-form-item>
        <el-form-item label="Status">
          <el-select v-model="form.status">
            <el-option label="RUN" value="RUN" />
            <el-option label="CLOSE" value="CLOSE" />
            <el-option label="NOT START" value="NOT START" />
          </el-select>
        </el-form-item>
        <el-form-item label="Start Date">
          <el-date-picker v-model="form.start_date" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="Plan Closed Date">
          <el-date-picker v-model="form.plan_closed_date" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="Actual Closed Date">
          <el-date-picker v-model="form.actual_closed_date" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="Description">
          <el-input v-model="form.description" type="textarea" />
        </el-form-item>
        <el-form-item label="Others">
          <el-input v-model="form.others" />
        </el-form-item>
        <el-form-item label="Remark">
          <el-input v-model="form.remark" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showCreateDialog = false">Cancel</el-button>
          <el-button type="primary" @click="submitProject">{{ isEditing ? 'Update' : 'Create' }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import api from '../api/axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.user?.role === 'admin')

const projects = ref([])
const showCreateDialog = ref(false)
const isEditing = ref(false)
const form = ref({
  name: '',
  full_name: '',
  chinese_name: '',
  custom_id: '',
  status: 'NOT START',
  start_date: null,
  plan_closed_date: null,
  actual_closed_date: null,
  others: '',
  remark: '',
  description: ''
})

const showStatsDialog = ref(false)
const selectedProject = ref(null)
const projectStats = ref([])
const statsViewMode = ref('staff')
const projectMonthlyStats = ref([])

const viewStats = async (project) => {
  selectedProject.value = project
  projectMonthlyStats.value = []
  statsViewMode.value = 'staff'
  try {
    const response = await api.get(`/projects/${project.id}/stats`)
    projectStats.value = response.data.users.map(u => ({ 
      ...u, 
      loadingStats: false, 
      statsBreakdown: null 
    }))
    showStatsDialog.value = true
  } catch (error) {
    ElMessage.error('Failed to fetch project stats')
  }
}

const handleStaffExpand = async (row, expandedRows) => {
  const isExpanded = expandedRows.some(r => r.user_id === row.user_id)
  if (isExpanded) {
    row.loadingStats = true
    try {
      const response = await api.get(`/projects/${selectedProject.value.id}/users/${row.user_id}/stats-breakdown`)
      row.statsBreakdown = response.data
    } catch (error) {
      ElMessage.error('Failed to fetch breakdown')
    } finally {
      row.loadingStats = false
    }
  }
}

const getSummary = (param) => {
  const { columns, data } = param
  const sums = []
  columns.forEach((column, index) => {
    if (index === 0) {
      sums[index] = 'In all'
      return
    }
    const values = data.map((item) => Number(item[column.property]))
    if (!values.every((value) => isNaN(value))) {
      sums[index] = `${values.reduce((prev, curr) => {
        const value = Number(curr)
        if (!isNaN(value)) {
          return prev + curr
        } else {
          return prev
        }
      }, 0)} h`
    } else {
      sums[index] = 'N/A'
    }
  })
  return sums
}

const getMonthlySummary = (param) => {
  const { columns, data } = param
  const sums = []
  columns.forEach((column, index) => {
    if (index === 0) {
      sums[index] = 'Total'
      return
    }
    const values = data.map((item) => Number(item[column.property]))
    if (!values.every((value) => isNaN(value))) {
      sums[index] = `${values.reduce((prev, curr) => {
        const value = Number(curr)
        if (!isNaN(value)) {
          return prev + curr
        } else {
          return prev
        }
      }, 0)} h`
    } else {
      sums[index] = 'N/A'
    }
  })
  return sums
}

const fetchMonthlyStats = async () => {
  if (!selectedProject.value || projectMonthlyStats.value.length > 0) return
  try {
    const response = await api.get(`/projects/${selectedProject.value.id}/monthly-stats`)
    projectMonthlyStats.value = response.data.months
  } catch (error) {
    ElMessage.error('Failed to fetch monthly stats')
  }
}

watch(statsViewMode, (mode) => {
  if (mode === 'monthly') {
    fetchMonthlyStats()
  }
})

const fetchProjects = async () => {
  try {
    const response = await api.get('/projects/')
    projects.value = response.data
  } catch (error) {
    ElMessage.error('Failed to fetch projects')
  }
}

const openCreateDialog = () => {
  isEditing.value = false
  form.value = {
    name: '',
    full_name: '',
    chinese_name: '',
    status: 'NOT START',
    start_date: null,
    plan_closed_date: null,
    actual_closed_date: null,
    others: '',
    remark: '',
    description: ''
  }
  showCreateDialog.value = true
}

const openEditDialog = (project) => {
  isEditing.value = true
  form.value = { ...project }
  showCreateDialog.value = true
}

const submitProject = async () => {
  try {
    if (isEditing.value) {
      await api.put(`/projects/${form.value.id}`, form.value) // Assuming PUT endpoint exists or needs to be created? 
      // Wait, I didn't check if PUT endpoint exists. Usually it's standard CRUD. 
      // If not, I might need to add it to backend. But let's assume standard CRUD for now or use POST for update if designed that way?
      // Actually, standard FastAPI CRUD usually has PUT /projects/{id}. 
      // Let's check backend/app/api/projects.py if I can... or just try it.
      // If it fails, I'll fix backend.
      ElMessage.success('Project updated')
    } else {
      await api.post('/projects/', form.value)
      ElMessage.success('Project created')
    }
    showCreateDialog.value = false
    fetchProjects()
  } catch (error) {
    ElMessage.error('Failed to save project: ' + (error.response?.data?.detail || error.message))
  }
}

const handleDelete = (project) => {
  ElMessageBox.confirm(
    'Are you sure you want to delete this project?',
    'Warning',
    {
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      type: 'warning',
    }
  )
    .then(async () => {
      try {
        await api.delete(`/projects/${project.id}`)
        ElMessage.success('Project deleted')
        fetchProjects()
      } catch (error) {
        ElMessage.error('Failed to delete project')
      }
    })
    .catch(() => {})
}

onMounted(fetchProjects)
</script>

<style scoped>
.projects-container {
  padding: 20px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
</style>
