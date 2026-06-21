<template>
  <div class="workday-management">
    <div class="header">
      <h2>Work Day Management</h2>
      <el-button v-if="isAdmin" type="primary" @click="openManageProfilesDialog">
        Manage Profiles & Mapping
      </el-button>
    </div>

    <div class="profile-selector-bar">
      <span class="label">Active Workday Profile:</span>
      <el-select v-model="selectedProfileId" placeholder="Select workday profile" style="width: 250px;" @change="handleProfileChange">
        <el-option
          v-for="p in profiles"
          :key="p.id"
          :label="p.name + (p.is_default ? ' (Default)' : '')"
          :value="p.id"
        />
      </el-select>
      <el-tag 
        v-if="selectedProfile" 
        :type="selectedProfile.can_edit ? 'success' : 'info'" 
        style="margin-left: 15px;"
      >
        {{ selectedProfile.can_edit ? 'You can edit exceptions' : 'Read-only view' }}
      </el-tag>
    </div>

    <div class="calendar-container">
      <el-calendar v-model="currentDate" ref="calendar" :first-day-of-week="1">
        <template #header="{ date }">
          <span class="calendar-title">{{ date }}</span>
          <el-button-group>
            <el-button size="small" @click="changeMonth(-1)">Previous Month</el-button>
            <el-button size="small" @click="changeMonth(1)">Next Month</el-button>
          </el-button-group>
        </template>
        <template #date-cell="{ data }">
          <div 
            v-if="data.type === 'current-month'"
            class="custom-date-cell"
            :class="getDayClass(data.day)"
            @click.stop="toggleDayStatus(data.day)"
          >
             <div class="cell-content">
               <div class="date-header">
                 <div class="date-number">{{ data.day.split('-').slice(2).join('') }}</div>
                 <div class="status-badge" v-if="getStatusLabel(data.day)">{{ getStatusLabel(data.day) }}</div>
               </div>
             </div>
          </div>
        </template>
      </el-calendar>
    </div>

    <!-- Management Dialog for Admins -->
    <el-dialog v-model="showManageDialog" title="Manage Workday Profiles & Mapping" width="750px">
      <el-tabs v-model="activeTab">
        
        <!-- Tab 1: Profiles Management -->
        <el-tab-pane label="Workday Profiles" name="profiles">
          <div class="tab-content">
            <el-form :model="newProfileForm" inline style="margin-bottom: 20px;">
              <el-form-item label="Name" required>
                <el-input v-model="newProfileForm.name" placeholder="Profile name" />
              </el-form-item>
              <el-form-item label="Description">
                <el-input v-model="newProfileForm.description" placeholder="Optional details" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="createProfile" :disabled="!newProfileForm.name">Create Profile</el-button>
              </el-form-item>
            </el-form>

            <el-table :data="profiles" border style="width: 100%">
              <el-table-column prop="id" label="ID" width="60" />
              <el-table-column prop="name" label="Name" min-width="150">
                <template #default="scope">
                  {{ scope.row.name }} <el-tag v-if="scope.row.is_default" size="small" type="success">Default</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="Description" min-width="200" />
              <el-table-column label="Action" width="90" align="center">
                <template #default="scope">
                  <el-button 
                    type="danger" 
                    link 
                    :disabled="scope.row.is_default"
                    @click="deleteProfile(scope.row.id)"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <!-- Tab 2: Edit Delegation -->
        <el-tab-pane label="Edit Delegation" name="delegation">
          <div class="tab-content">
            <div class="delegation-selectors">
              <span class="label">Select Profile:</span>
              <el-select v-model="delegationProfileId" placeholder="Select profile" style="width: 220px;" @change="loadDelegatedUsers">
                <el-option
                  v-for="p in profiles"
                  :key="p.id"
                  :label="p.name"
                  :value="p.id"
                />
              </el-select>

              <span class="label" style="margin-left: 20px;">Grant User:</span>
              <el-select v-model="grantUserId" filterable placeholder="Select employee / TL" style="width: 220px;">
                <el-option
                  v-for="u in allUsers"
                  :key="u.id"
                  :label="u.username + (u.full_name ? ' (' + u.full_name + ')' : '')"
                  :value="u.id"
                />
              </el-select>
              <el-button type="primary" style="margin-left: 10px;" @click="assignRights" :disabled="!delegationProfileId || !grantUserId">
                Grant
              </el-button>
            </div>

            <el-table :data="delegatedUsers" border style="width: 100%; margin-top: 15px;">
              <el-table-column prop="id" label="User ID" width="80" />
              <el-table-column prop="username" label="Username" />
              <el-table-column prop="full_name" label="Full Name" />
              <el-table-column label="Action" width="90" align="center">
                <template #default="scope">
                  <el-button type="danger" link @click="revokeRights(scope.row.id)">
                    Revoke
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <!-- Tab 3: Cost Center Mapping -->
        <el-tab-pane label="Cost Center Mapping" name="mapping">
          <div class="tab-content">
            <el-table :data="costCenters" border style="width: 100%">
              <el-table-column prop="id" label="ID" width="80" />
              <el-table-column prop="name" label="Cost Center" />
              <el-table-column label="Assigned Workday Profile">
                <template #default="scope">
                  <el-select 
                    v-model="scope.row.workday_setting_id" 
                    placeholder="Default Profile" 
                    clearable
                    style="width: 100%;"
                    @change="mapCostCenter(scope.row)"
                  >
                    <el-option
                      v-for="p in profiles"
                      :key="p.id"
                      :label="p.name"
                      :value="p.id"
                    />
                  </el-select>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
      
      <template #footer>
        <el-button @click="showManageDialog = false">Close</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import api from '../api/axios'
import { useAuthStore } from '../stores/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.user?.role === 'admin')

const currentDate = ref(new Date())
const workDays = ref({})
const loading = ref(false)

// Profiles variables
const profiles = ref([])
const selectedProfileId = ref(null)
const selectedProfile = computed(() => profiles.value.find(p => p.id === selectedProfileId.value))

// Management dialog variables
const showManageDialog = ref(false)
const activeTab = ref('profiles')
const newProfileForm = ref({ name: '', description: '' })
const allUsers = ref([])
const costCenters = ref([])
const delegationProfileId = ref(null)
const grantUserId = ref(null)
const delegatedUsers = ref([])

const loadProfiles = async () => {
  try {
    const response = await api.get('/workdays/settings')
    profiles.value = response.data
    
    // Auto-select default setting initially if nothing is selected
    if (selectedProfileId.value === null && response.data.length > 0) {
      const def = response.data.find(p => p.is_default) || response.data[0]
      selectedProfileId.value = def.id
    }
  } catch (error) {
    ElMessage.error('Failed to load workday profiles')
  }
}

const loadWorkDays = async () => {
  if (selectedProfileId.value === null) return
  
  loading.value = true
  try {
    const viewStart = dayjs(currentDate.value).startOf('month').subtract(7, 'day').format('YYYY-MM-DD')
    const viewEnd = dayjs(currentDate.value).endOf('month').add(7, 'day').format('YYYY-MM-DD')

    const response = await api.get('/workdays/', {
      params: { 
        start_date: viewStart, 
        end_date: viewEnd,
        setting_id: selectedProfileId.value
      }
    })
    
    const map = {}
    response.data.forEach(item => {
      map[item.date] = item.day_type
    })
    workDays.value = map
  } catch (error) {
    ElMessage.error('Failed to load work days')
  } finally {
    loading.value = false
  }
}

const handleProfileChange = () => {
  loadWorkDays()
}

const getDayClass = (dateStr) => {
  let type = workDays.value[dateStr]
  if (!type) {
      const d = dayjs(dateStr)
      if (d.day() === 0 || d.day() === 6) type = 'off'
      else type = 'work'
  }
  return {
    'is-off': type === 'off',
    'is-work': type === 'work'
  }
}

const getStatusLabel = (dateStr) => {
  const type = workDays.value[dateStr]
  const d = dayjs(dateStr)
  const isWeekend = d.day() === 0 || d.day() === 6
  
  if (isWeekend) {
      if (type === 'work') return 'ON'
  } else {
      if (type === 'off') return 'OFF'
  }
  return '' 
}

const toggleDayStatus = async (dateStr) => {
  if (!selectedProfile.value || !selectedProfile.value.can_edit) {
    ElMessage.warning('You do not have permission to modify this profile.')
    return
  }

  const currentType = workDays.value[dateStr]
  const d = dayjs(dateStr)
  const isWeekend = d.day() === 0 || d.day() === 6
  let nextType = ''
  
  if (isWeekend) {
    if (currentType === 'work') {
      nextType = 'delete'
    } else {
      nextType = 'work'
    }
  } else {
    if (currentType === 'off') {
       nextType = 'delete'
    } else {
       nextType = 'off'
    }
  }

  try {
    if (nextType === 'delete') {
         await api.delete(`/workdays/${selectedProfileId.value}/${dateStr}`)
         const newMap = { ...workDays.value }
         delete newMap[dateStr]
         workDays.value = newMap
         ElMessage.success(`Reset ${dateStr} to default`)
    } else {
        await api.post('/workdays/', {
          setting_id: selectedProfileId.value,
          date: dateStr,
          day_type: nextType
        })
        workDays.value = {
          ...workDays.value,
          [dateStr]: nextType
        }
        ElMessage.success(`Set ${dateStr} to ${nextType.toUpperCase()}`)
    }
  } catch (error) {
    console.error('Failed to update workday:', error)
    const msg = error.response?.data?.detail || 'Failed to update workday status'
    ElMessage.error(msg)
  }
}

const changeMonth = (delta) => {
  currentDate.value = dayjs(currentDate.value).add(delta, 'month').toDate()
}

// Dialog admin management actions
const openManageProfilesDialog = async () => {
  showManageDialog.value = true
  loadProfiles()
  
  // Load users list for delegation tab
  try {
    const resUsers = await api.get('/users/')
    allUsers.value = resUsers.data
  } catch (err) {
    console.error('Failed to load users list')
  }

  // Load cost centers list for mapping tab
  try {
    const resCC = await api.get('/cost-centers/')
    costCenters.value = resCC.data
  } catch (err) {
    console.error('Failed to load cost centers')
  }
}

const createProfile = async () => {
  try {
    await api.post('/workdays/settings', newProfileForm.value)
    ElMessage.success('Profile created successfully')
    newProfileForm.value = { name: '', description: '' }
    loadProfiles()
  } catch (error) {
    ElMessage.error(error.response?.data?.detail || 'Failed to create profile')
  }
}

const deleteProfile = (id) => {
  ElMessageBox.confirm(
    'Are you sure you want to delete this profile? This will unlink cost centers and delete exceptions.',
    'Warning',
    { confirmButtonText: 'Delete', cancelButtonText: 'Cancel', type: 'warning' }
  ).then(async () => {
    try {
      await api.delete(`/workdays/settings/${id}`)
      ElMessage.success('Profile deleted')
      loadProfiles()
      
      // If we deleted the active profile, reset active selection
      if (selectedProfileId.value === id) {
        selectedProfileId.value = null
        await loadProfiles()
        loadWorkDays()
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.detail || 'Failed to delete profile')
    }
  }).catch(() => {})
}

// Delegation actions
const loadDelegatedUsers = async () => {
  if (!delegationProfileId.value) {
    delegatedUsers.value = []
    return
  }
  try {
    const res = await api.get(`/workdays/settings/${delegationProfileId.value}/users`)
    delegatedUsers.value = res.data
  } catch (err) {
    ElMessage.error('Failed to load delegated users')
  }
}

const assignRights = async () => {
  try {
    await api.post(`/workdays/settings/${delegationProfileId.value}/users`, { user_id: grantUserId.value })
    ElMessage.success('Rights granted')
    grantUserId.value = null
    loadDelegatedUsers()
  } catch (error) {
    ElMessage.error(error.response?.data?.detail || 'Failed to grant rights')
  }
}

const revokeRights = async (userId) => {
  try {
    await api.delete(`/workdays/settings/${delegationProfileId.value}/users/${userId}`)
    ElMessage.success('Rights revoked')
    loadDelegatedUsers()
  } catch (error) {
    ElMessage.error(error.response?.data?.detail || 'Failed to revoke rights')
  }
}

// Cost Center mapping
const mapCostCenter = async (ccRow) => {
  try {
    await api.put(`/cost-centers/${ccRow.name}/setting`, { workday_setting_id: ccRow.workday_setting_id })
    ElMessage.success(`Cost center ${ccRow.name} setting updated`)
  } catch (error) {
    ElMessage.error('Failed to update cost center mapping')
  }
}

watch(currentDate, () => {
  loadWorkDays()
})

onMounted(async () => {
  await loadProfiles()
  loadWorkDays()
})
</script>

<style scoped>
.workday-management {
  padding: 20px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.profile-selector-bar {
  display: flex;
  align-items: center;
  margin-bottom: 25px;
  background: #f8fafc;
  padding: 15px 20px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.profile-selector-bar .label {
  font-weight: 600;
  margin-right: 12px;
  color: #334155;
}
.calendar-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 10px;
}
.calendar-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
}
.custom-date-cell {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 8px;
}
.cell-content {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
.is-off {
  background-color: #fee2e2 !important;
  color: #991b1b;
}
.is-work {
  background-color: transparent;
}
.custom-date-cell:hover {
  background-color: #f1f5f9 !important;
}
.is-off.custom-date-cell:hover {
  background-color: #fecaca !important;
}
.date-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.date-number {
  font-size: 1.1em;
  font-weight: 500;
}
.status-badge {
  font-size: 0.75em;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.is-off .status-badge {
  background-color: #ef4444;
  color: white;
}
.is-work .status-badge {
  background-color: #10b981;
  color: white;
}
.tab-content {
  padding: 20px 0;
}
.delegation-selectors {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  background: #f8fafc;
  padding: 12px 15px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}
.delegation-selectors .label {
  font-weight: 500;
  color: #475569;
}
:deep(.el-calendar-table td.is-selected) {
  background-color: transparent !important;
  color: inherit !important;
}
:deep(.el-calendar-table td.is-selected .el-calendar-day) {
   background-color: transparent !important;
}
:deep(.el-calendar-day) {
  padding: 0 !important;
  height: 85px;
  display: flex;
  flex-direction: column;
}
:deep(.el-calendar-table td.prev),
:deep(.el-calendar-table td.next) {
  background-color: white !important;
  pointer-events: none;
}
:deep(.el-calendar-table td.prev .el-calendar-day),
:deep(.el-calendar-table td.next .el-calendar-day) {
  background-color: white !important;
  visibility: hidden;
}
</style>
