<template>
  <div class="employees-container">
    <div class="header">
      <h2>Employees Management</h2>
      <div>
        <el-button v-if="isTeamLeader" type="success" @click="viewTeamStats(authStore.user)" style="margin-right: 10px;">My Team Stats</el-button>
        <el-button v-if="canManageUsers" type="primary" @click="openCreateDialog">Add Employee</el-button>
      </div>
    </div>

    <el-table :data="users" style="width: 100%">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="username" label="Username (Login)" min-width="120" />
      <el-table-column prop="email" label="Email" min-width="180" />
      <el-table-column prop="full_name" label="Full Name" min-width="150" />
      <el-table-column prop="cost_center" label="Cost Center" width="120" />
      <el-table-column prop="remark" label="Mark" min-width="120" />
      <el-table-column prop="start_date" label="Start Date" width="110" />
      <el-table-column prop="end_date" label="End Date" width="110" />
      <el-table-column prop="role" label="Role" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.role === 'admin' ? 'danger' : 'success'">{{ scope.row.role }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Statistics" width="120">
        <template #default="scope">
          <el-button 
            v-if="scope.row.role === 'team_leader'" 
            size="small" 
            type="primary" 
            @click="viewTeamStats(scope.row)">
            Team Stats
          </el-button>
        </template>
      </el-table-column>
      <el-table-column v-if="canManageUsers" label="Actions" width="200" fixed="right">
        <template #default="scope">
          <el-tooltip content="Edit" placement="top">
            <el-button 
              link 
              type="primary" 
              @click="openEditDialog(scope.row)"
              v-if="isAdmin || (isTeamLeader && isSubordinate(scope.row))"
            >
              <el-icon><Edit /></el-icon>
            </el-button>
          </el-tooltip>
          
          <el-tooltip v-if="canAssignProjects(scope.row)" content="Assign Projects" placement="top">
            <el-button link type="primary" @click="openProjectDialog(scope.row)">
              <el-icon><Folder /></el-icon>
            </el-button>
          </el-tooltip>

          <el-tooltip v-if="canLoginAs(scope.row)" content="Login As" placement="top">
            <el-button link type="warning" @click="handleLoginAs(scope.row)">
              <el-icon><Key /></el-icon>
            </el-button>
          </el-tooltip>

          <el-tooltip v-if="canDelete(scope.row)" content="Delete" placement="top">
            <el-button link type="danger" @click="handleDelete(scope.row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showCreateDialog" :title="isEditing ? 'Edit Employee' : 'Create Employee'" width="600px">
      <el-form :model="form" label-width="120px">
        <el-form-item label="Username" required>
          <el-input v-model="form.username" :disabled="isEditing" />
        </el-form-item>
        <el-form-item label="Full Name">
          <el-input v-model="form.full_name" />
        </el-form-item>
        <el-form-item label="Email">
          <el-input v-model="form.email" placeholder="user@example.com" />
        </el-form-item>
        <el-form-item label="Cost Center">
          <el-select v-model="form.cost_center" placeholder="Select Cost Center">
            <el-option 
              v-for="cc in costCenters" 
              :key="cc" 
              :label="cc" 
              :value="cc" 
            />
          </el-select>
          <el-button 
            v-if="isAdmin" 
            type="text" 
            style="margin-left: 10px;"
            @click="showCostCenterDialog = true"
          >
            Manage
          </el-button>
        </el-form-item>
        <el-form-item label="Mark">
          <el-input v-model="form.remark" />
        </el-form-item>
        <el-form-item label="Start Date">
          <el-date-picker v-model="form.start_date" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="End Date">
          <el-date-picker v-model="form.end_date" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="Password" v-if="!isEditing" required>
          <el-input v-model="form.password" type="password" />
        </el-form-item>
        <el-form-item label="Role">
          <el-select v-model="form.role" placeholder="Select role" v-if="isAdmin">
            <el-option label="Employee" value="employee" />
            <el-option label="Team Leader" value="team_leader" />
            <el-option label="Admin" value="admin" />
          </el-select>
          <el-input v-else model-value="Employee" disabled />
        </el-form-item>
        <el-form-item label="Team Leader" v-if="['employee', 'team_leader'].includes(form.role) && isAdmin">
          <el-select v-model="form.team_leader_id" placeholder="Select Team Leader" clearable>
            <el-option 
              v-for="tl in teamLeaders" 
              :key="tl.id" 
              :label="tl.username" 
              :value="tl.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="Team Leader" v-if="isTeamLeader">
            <el-input :model-value="authStore.user?.username" disabled />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showCreateDialog = false">Cancel</el-button>
          <el-button type="primary" @click="submitUser">{{ isEditing ? 'Update' : 'Create' }}</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog v-model="showProjectDialog" title="Assign Projects">
      <p>Assign projects to <strong>{{ selectedUser?.username }}</strong></p>
      <div class="project-list">
        <el-checkbox-group v-model="selectedProjects">
          <el-checkbox 
            v-for="project in allProjects" 
            :key="project.id" 
            :label="project.id"
            :disabled="project.is_default"
          >
            {{ project.name }} <span v-if="project.is_default">(Default)</span>
          </el-checkbox>
        </el-checkbox-group>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showProjectDialog = false">Cancel</el-button>
          <el-button type="primary" @click="saveProjectAssignments">Save</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
    <el-dialog v-model="showCostCenterDialog" title="Manage Cost Centers" width="500px">
      <div style="margin-bottom: 20px; display: flex; gap: 10px;">
        <el-input v-model="newCostCenter" placeholder="New Cost Center Name" />
        <el-button type="primary" @click="addCostCenter" :disabled="!newCostCenter">Add</el-button>
      </div>
      <el-table :data="costCentersTable" style="width: 100%" max-height="400">
        <el-table-column prop="name" label="Name" />
        <el-table-column label="Action" width="100" align="right">
          <template #default="scope">
            <el-button 
              type="danger" 
              link 
              :disabled="costCenters.length <= 1"
              @click="deleteCostCenter(scope.row.name)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showCostCenterDialog = false">Close</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog v-model="showTeamStatsDialog" :title="'Team Statistics Dashboard - ' + (selectedTeamLeader?.full_name || selectedTeamLeader?.username)" width="800px">
      <div v-loading="loadingTeamStats" style="min-height: 200px;">
        <div v-if="teamStatsData" style="margin-bottom: 20px;">
          <h3>Total Team Hours: {{ teamStatsData.total_team_hours }} h</h3>
        </div>
        
        <el-table 
          v-if="teamStatsData" 
          :data="teamStatsData.projects" 
          style="width: 100%" 
          @expand-change="handleProjectExpand"
          row-key="project_id"
        >
          <el-table-column type="expand">
            <template #default="props">
              <div v-loading="props.row.loadingBreakdown" style="padding: 10px; display: flex; gap: 20px; min-height: 100px;">
                <div style="flex: 1;" v-if="props.row.weekly">
                  <h4 style="margin-top: 0;">Weekly Breakdown</h4>
                  <el-table :data="props.row.weekly" size="small" border>
                    <el-table-column prop="year_week" label="Year-Week" />
                    <el-table-column prop="hours" label="Hours">
                      <template #default="scope">{{ scope.row.hours }} h</template>
                    </el-table-column>
                  </el-table>
                </div>
                <div style="flex: 1;" v-if="props.row.monthly">
                  <h4 style="margin-top: 0;">Monthly Breakdown</h4>
                  <el-table :data="props.row.monthly" size="small" border>
                    <el-table-column prop="year_month" label="Year-Month" />
                    <el-table-column prop="hours" label="Hours">
                      <template #default="scope">{{ scope.row.hours }} h</template>
                    </el-table-column>
                  </el-table>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="project_name" label="Project" />
          <el-table-column prop="total_hours" label="Total Hours" width="150">
            <template #default="scope">
              {{ scope.row.total_hours }} h
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../api/axios'
import { useAuthStore } from '../stores/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Delete, Folder, Key, DataAnalysis } from '@element-plus/icons-vue'

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.user?.role === 'admin')
const isTeamLeader = computed(() => authStore.user?.role === 'team_leader')
const canManageUsers = computed(() => isAdmin.value || isTeamLeader.value)

const users = ref([])
const teamLeaders = computed(() => users.value.filter(u => u.role === 'team_leader'))
const allProjects = ref([])
const showCreateDialog = ref(false)
const showProjectDialog = ref(false)
const isEditing = ref(false)
const selectedUser = ref(null)
const selectedProjects = ref([])

const costCenters = ref([])
const showCostCenterDialog = ref(false)
const newCostCenter = ref('')
const costCentersTable = computed(() => costCenters.value.map(c => ({ name: c })))

const showTeamStatsDialog = ref(false)
const selectedTeamLeader = ref(null)
const teamStatsData = ref(null)
const loadingTeamStats = ref(false)

const viewTeamStats = async (user) => {
  selectedTeamLeader.value = user
  teamStatsData.value = null
  showTeamStatsDialog.value = true
  loadingTeamStats.value = true
  try {
    const response = await api.get(`/users/${user.id}/team-stats`)
    teamStatsData.value = {
      ...response.data,
      projects: response.data.projects.map(p => ({
        ...p,
        loadingBreakdown: false,
        weekly: null,
        monthly: null
      }))
    }
  } catch (error) {
    ElMessage.error('Failed to fetch team statistics')
  } finally {
    loadingTeamStats.value = false
  }
}

const handleProjectExpand = async (row, expandedRows) => {
  const isExpanded = expandedRows.some(r => r.project_id === row.project_id)
  if (isExpanded) {
    row.loadingBreakdown = true
    try {
      const response = await api.get(`/users/${selectedTeamLeader.value.id}/team-stats/projects/${row.project_id}/breakdown`)
      row.weekly = response.data.weekly
      row.monthly = response.data.monthly
    } catch (error) {
      ElMessage.error('Failed to load breakdown stats')
    } finally {
      row.loadingBreakdown = false
    }
  }
}

const isSubordinate = (user) => {
  return isTeamLeader.value && user.team_leader_id === authStore.user?.id
}

const canAssignProjects = (user) => {
  if (isAdmin.value) return user.role !== 'admin'
  if (isTeamLeader.value) return isSubordinate(user)
  return false
}

const canLoginAs = (user) => {
  // Only Admins can login as other users
  if (isAdmin.value) return user.role !== 'admin'
  return false
}

const canDelete = (user) => {
  if (user.username === authStore.user?.username) return false
  if (isAdmin.value) return true
  // TLs probably shouldn't delete users, but if they created them...
  // User prompt didn't ask for delete rights, just 'add' and 'edit'.
  // I'll hide delete for TLs to be safe/conservative as per earlier plan.
  return false 
}

const form = ref({
  username: '',
  email: '',
  full_name: '',
  cost_center: '',
  remark: '',
  start_date: null,
  end_date: null,
  start_date: null,
  end_date: null,
  password: '',
  role: 'employee',
  team_leader_id: null
})

const fetchUsers = async () => {
  try {
    const response = await api.get('/users/')
    users.value = response.data
  } catch (error) {
    ElMessage.error('Failed to fetch users')
  }
}

const fetchProjects = async () => {
  try {
    const response = await api.get('/projects/')
    allProjects.value = response.data
  } catch (error) {
    console.error(error)
  }
}

const openCreateDialog = () => {
  isEditing.value = false
  form.value = {
    username: '',
    email: '',
    full_name: '',
    cost_center: '',
    remark: '',
    start_date: null,
    end_date: null,
    password: '',
    end_date: null,
    password: '',
    role: isAdmin.value ? 'employee' : 'employee', // Default to employee
    team_leader_id: isTeamLeader.value ? authStore.user?.id : null
  }
  showCreateDialog.value = true
}

const openEditDialog = (user) => {
  isEditing.value = true
  form.value = { ...user, password: '' }
  showCreateDialog.value = true
}

const submitUser = async () => {
  try {
    if (isEditing.value) {
      await api.put(`/users/${form.value.id}`, form.value)
      ElMessage.success('User updated')
    } else {
      const userData = {
        username: form.value.username,
        email: form.value.email,
        full_name: form.value.full_name,
        cost_center: form.value.cost_center,
        remark: form.value.remark,
        start_date: form.value.start_date,
        end_date: form.value.end_date,
        password_hash: form.value.password,
        start_date: form.value.start_date,
        end_date: form.value.end_date,
        password_hash: form.value.password,
        role: form.value.role,
        team_leader_id: form.value.team_leader_id
      }
      await api.post('/users/', userData)
      ElMessage.success('User created')
    }
    showCreateDialog.value = false
    fetchUsers()
  } catch (error) {
    ElMessage.error('Failed to save user: ' + (error.response?.data?.detail || error.message))
  }
}

const handleDelete = (user) => {
  ElMessageBox.confirm(
    'Are you sure you want to delete this user?',
    'Warning',
    {
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      type: 'warning',
    }
  )
    .then(async () => {
      try {
        await api.delete(`/users/${user.id}`)
        ElMessage.success('User deleted')
        fetchUsers()
      } catch (error) {
        ElMessage.error('Failed to delete user')
      }
    })
    .catch(() => {})
}

const handleLoginAs = async (user) => {
  try {
    const response = await api.post(`/auth/login-as/${user.id}`)
    const { access_token, user: userData } = response.data
    
    // Update auth store
    authStore.token = access_token
    authStore.user = userData
    localStorage.setItem('token', access_token)
    localStorage.setItem('user', JSON.stringify(userData))
    
    ElMessage.success(`Logged in as ${user.username}`)
    
    // Redirect to home or refresh to update view
    window.location.href = '/'
  } catch (error) {
    ElMessage.error('Failed to login as user: ' + (error.response?.data?.detail || error.message))
  }
}

const openProjectDialog = async (user) => {
  selectedUser.value = user
  try {
    const response = await api.get(`/users/${user.id}/projects`)
    const assigned = response.data.map(p => p.id)
    selectedProjects.value = assigned
    showProjectDialog.value = true
  } catch (error) {
    ElMessage.error('Failed to fetch user projects')
  }
}

const saveProjectAssignments = async () => {
  try {
    const currentRes = await api.get(`/users/${selectedUser.value.id}/projects`)
    const currentIds = currentRes.data.map(p => p.id)
    const newIds = selectedProjects.value
    
    const toAdd = newIds.filter(id => !currentIds.includes(id))
    const toRemove = currentIds.filter(id => !newIds.includes(id))
    
    const promises = []
    for (const id of toAdd) {
      promises.push(api.post(`/users/${selectedUser.value.id}/projects/${id}`))
    }
    for (const id of toRemove) {
      const proj = allProjects.value.find(p => p.id === id)
      if (proj && !proj.is_default) {
        promises.push(api.delete(`/users/${selectedUser.value.id}/projects/${id}`))
      }
    }
    
    await Promise.all(promises)
    ElMessage.success('Assignments updated')
    showProjectDialog.value = false
  } catch (error) {
    ElMessage.error('Failed to update assignments')
  }
}


const fetchCostCenters = async () => {
  try {
    const response = await api.get('/cost-centers/')
    costCenters.value = response.data
  } catch (error) {
    console.error('Failed to fetch cost centers')
  }
}

const addCostCenter = async () => {
  if (!newCostCenter.value) return
  try {
    const response = await api.post('/cost-centers/', { name: newCostCenter.value })
    costCenters.value = response.data
    newCostCenter.value = ''
    ElMessage.success('Cost Center added')
  } catch (error) {
    ElMessage.error('Failed to add cost center')
  }
}

const deleteCostCenter = async (name) => {
  try {
    const response = await api.delete(`/cost-centers/${name}`)
    costCenters.value = response.data
    ElMessage.success('Cost Center deleted')
  } catch (error) {
    ElMessage.error(error.response?.data?.detail || 'Failed to delete cost center')
  }
}
onMounted(() => {
  fetchUsers()
  fetchProjects()
  fetchCostCenters()
})

</script>

<style scoped>
.employees-container {
  padding: 20px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.project-list {
  max-height: 300px;
  overflow-y: auto;
  margin: 20px 0;
}
</style>
