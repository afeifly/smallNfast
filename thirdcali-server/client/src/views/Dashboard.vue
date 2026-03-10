<template>
  <div class="container container-dashboard">
    <div class="header flex between center">
      <div>
        <h1>Lab calibration management</h1>
        <p class="subtitle">Manage individual users and their calibration records</p>
      </div>
      <button @click="showAddModal = true" class="primary">
        <Plus :size="18" /> Add New User
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
    </div>

    <div v-else class="glass user-table-wrapper">
      <table class="user-table">
        <thead>
          <tr>
            <th>User / Company</th>
            <th>Email</th>
            <th>Passcode</th>
            <th class="text-right">Service Details</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in companyUsers" :key="user.id" :class="{ 'user-blocked': user.status === 2 || isExpired(user.serviceTime) }">
            <td>
              <div class="user-info">
                <div class="username-large">
                  {{ user.username }}
                </div>
                <div class="company-sub">{{ user.companyName }}</div>
              </div>
            </td>
            <td><div class="email-text">{{ user.email }}</div></td>
            <td>
              <code :class="['mono-badge', { 'strikethrough': user.status === 2 || isExpired(user.serviceTime) }]">
                {{ user.passcode }}
              </code>
            </td>
            <td class="text-right">
              <span v-if="user.status === 2" class="status-badge blocked">Account Blocked</span>
              <div v-else class="flex flex-col end gap-4">
                <span v-if="isExpired(user.serviceTime)" class="status-badge blocked">Service Expired</span>
                <span :class="['expiry-tag', isExpired(user.serviceTime) ? 'expired' : 'active']">
                  {{ formatDate(user.serviceTime) }}
                </span>
              </div>
            </td>
            <td class="text-right">
              <div class="actions flex gap-8 end">
                <button v-if="user._count?.sensors > 0" @click="viewDetail(user.id)" class="icon-btn info" title="View Details">
                  <Eye :size="18" />
                </button>
                <button @click="openEditModal(user)" class="icon-btn primary-ghost" title="Edit User">
                  <Pencil :size="18" />
                </button>
                <button v-if="user.status !== 2" @click="toggleStatus(user)" class="icon-btn danger" title="Block User">
                  <UserX :size="18" />
                </button>
                <button v-else @click="toggleStatus(user)" class="icon-btn success" title="Unblock User">
                  <UserCheck :size="18" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add User Modal -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="glass modal-content card">
        <h3>Create New User Account</h3>
        <form @submit.prevent="handleAddUser">
          <div class="form-row flex gap-16">
            <div class="form-group flex-1">
              <label>Username</label>
              <input v-model="newUser.username" type="text" placeholder="johndoe" required />
            </div>
            <div class="form-group flex-1">
              <label>Email</label>
              <input v-model="newUser.email" type="email" placeholder="john@example.com" required />
            </div>
          </div>
          <div class="form-group">
            <label>Company (Select or Type New)</label>
            <input v-model="newUser.companyName" list="companyList" placeholder="Search or add company..." required />
            <datalist id="companyList">
              <option v-for="company in uniqueCompanies" :key="company" :value="company" />
            </datalist>
          </div>
          <div class="form-group">
            <label>Service Duration</label>
            <select v-model="newUser.serviceOption" required>
              <option value="1m">1 Month</option>
              <option value="1y">1 Year (Default)</option>
              <option value="3y">3 Years</option>
            </select>
          </div>
          <div class="form-group">
            <label>Note</label>
            <textarea v-model="newUser.note" rows="3" placeholder="Additional details..."></textarea>
          </div>
          <div class="modal-actions flex end gap-16">
            <button type="button" @click="showAddModal = false" class="secondary">Cancel</button>
            <button type="submit" class="primary">Create User Account</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
      <div class="glass modal-content card">
        <div class="modal-header">
          <h3>Edit User Account</h3>
          <p class="subtitle">{{ editingUser.username }} / {{ editingUser.companyName }}</p>
        </div>
        
        <div class="read-only-info-grid">
          <div class="info-item">
            <label>Email Address</label>
            <div class="val">{{ editingUser.email }}</div>
          </div>
          <div class="info-item">
            <label>Current Passcode</label>
            <div class="val"><code>{{ editingUser.passcode }}</code></div>
          </div>
          <div class="info-item">
            <label>Account Status</label>
            <div class="val">
              <span v-if="editingUser.status === 2" class="status-badge blocked">Blocked</span>
              <span v-else-if="isExpired(editingUser.serviceTime)" class="status-badge blocked">Expired</span>
              <span v-else class="status-badge enabled">Active</span>
            </div>
          </div>
        </div>

        <form @submit.prevent="handleUpdateUser">
          <div class="form-group">
            <label>Service Expiry Date</label>
            <input v-model="editingUser.serviceTime" type="date" required />
            <small class="help-text">Change when this user's access expires.</small>
          </div>
          <div class="form-group">
            <label>Note</label>
            <textarea v-model="editingUser.note" rows="3" placeholder="Additional details..."></textarea>
          </div>
          <div class="modal-actions flex end gap-16">
            <button type="button" @click="showEditModal = false" class="secondary">Cancel</button>
            <button type="submit" class="primary" :disabled="loading">Save Changes</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Custom Warning Dialog -->
    <ConfirmModal 
      v-model="confirmData.show"
      :title="confirmData.title"
      :message="confirmData.message"
      :confirmText="confirmData.confirmText"
      :type="confirmData.type"
      @confirm="confirmData.onConfirm"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAppStore } from '../store'
import { useRouter } from 'vue-router'
import { Plus, Eye, UserX, UserCheck, Pencil } from 'lucide-vue-next'
import ConfirmModal from '../components/ConfirmModal.vue'

const store = useAppStore()
const router = useRouter()

const showAddModal = ref(false)
const showEditModal = ref(false)
const editingUser = ref(null)

const confirmData = ref({
  show: false,
  title: '',
  message: '',
  confirmText: '',
  type: 'info',
  onConfirm: () => {}
})
const companyUsers = computed(() => store.companyUsers)
const loading = computed(() => store.loading)

const uniqueCompanies = computed(() => {
  const companies = companyUsers.value.map(u => u.companyName)
  return [...new Set(companies)].sort()
})

const newUser = ref({
  username: '',
  email: '',
  companyName: '',
  note: '',
  serviceOption: '1y'
})

onMounted(() => {
  store.fetchUsers()
})

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const isExpired = (dateString) => {
  return new Date(dateString) < new Date()
}

const handleAddUser = async () => {
  const success = await store.createUser(newUser.value)
  if (success) {
    showAddModal.value = false
    newUser.value = { username: '', email: '', companyName: '', note: '', serviceOption: '1y' }
  }
}

const toggleStatus = (user) => {
  const isBlocking = user.status !== 2
  
  confirmData.value = {
    show: true,
    title: isBlocking ? 'Block User Account' : 'Unblock User Account',
    message: isBlocking 
      ? `Are you sure you want to block ${user.username}? This will immediately disable their passcode and app access.`
      : `Are you sure you want to unblock ${user.username}? Their passcode and access will be restored immediately.`,
    confirmText: isBlocking ? 'Block Account' : 'Unblock Account',
    type: isBlocking ? 'danger' : 'success',
    onConfirm: async () => {
      await store.updateStatus(user.id, isBlocking ? 2 : 1)
    }
  }
}

const viewDetail = (id) => {
  router.push(`/user/${id}`)
}

const openEditModal = (user) => {
  editingUser.value = {
    id: user.id,
    username: user.username,
    email: user.email,
    companyName: user.companyName,
    status: user.status,
    passcode: user.passcode,
    serviceTime: new Date(user.serviceTime).toISOString().split('T')[0],
    note: user.note || ''
  }
  showEditModal.value = true
}

const handleUpdateUser = async () => {
  const success = await store.updateUser(editingUser.value.id, {
    serviceTime: editingUser.value.serviceTime,
    note: editingUser.value.note
  })
  if (success) {
    showEditModal.value = false
  }
}
</script>

<style scoped>
.header { margin-bottom: 40px; }
.subtitle { color: var(--text-muted); font-size: 0.9rem; }
.user-table-wrapper { overflow: hidden; }
.user-table { width: 100%; border-collapse: collapse; text-align: left; }
.user-table th { padding: 16px 24px; border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
.user-table td { padding: 20px 24px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }

.username-large { font-weight: 700; color: var(--text-main); font-size: 1.05rem; display: flex; align-items: center; gap: 8px; }
.company-sub { font-size: 0.8rem; color: var(--text-muted); margin-top: 2px; }
.email-text { font-size: 0.9rem; color: var(--text-muted); }

.status-badge { font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 800; text-transform: uppercase; }
.status-badge.blocked { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }

.user-blocked { background-color: #fafafa; }
.strikethrough { text-decoration: line-through; opacity: 0.5; }

.mono-badge { background: rgba(9, 105, 218, 0.05); color: var(--primary-color); padding: 4px 8px; border-radius: 4px; font-family: monospace; border: 1px solid rgba(9, 105, 218, 0.1); }
.expiry-tag { padding: 4px 10px; border-radius: 100px; font-size: 0.75rem; font-weight: 600; }
.expiry-tag.active { background: rgba(26, 127, 55, 0.1); color: var(--secondary-color); }
.expiry-tag.expired { background: rgba(207, 34, 46, 0.1); color: #cf222e; }

/* Action Buttons */
.icon-btn {
  background: transparent;
  padding: 8px;
  border-radius: 6px;
  color: var(--text-muted);
  transition: all 0.2s;
}
.icon-btn:hover { background: #f0f2f5; color: var(--text-main); }
.icon-btn.info:hover { color: var(--primary-color); background: rgba(9, 105, 218, 0.1); }
.icon-btn.primary-ghost:hover { color: var(--primary-color); background: rgba(9, 105, 218, 0.1); }
.icon-btn.danger:hover { color: #cf222e; background: rgba(207, 34, 46, 0.1); }
.icon-btn.success:hover { color: var(--secondary-color); background: rgba(26, 127, 55, 0.1); }

.text-right { text-align: right; }
.end { justify-content: flex-end; }
.flex-1 { flex: 1; }

.form-row { margin-bottom: 20px; }
.modal-header { margin-bottom: 24px; }
.modal-header h3 { margin-bottom: 4px; }

/* Read-only Info Grid */
.read-only-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
  border: 1px solid #e2e8f0;
}
.info-item label {
  font-size: 0.65rem;
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 800;
  margin-bottom: 4px;
  display: block;
}
.info-item .val {
  font-size: 0.9rem;
  color: var(--text-main);
  font-weight: 600;
}
.info-item code {
  color: var(--primary-color);
  font-family: monospace;
}
.status-badge.enabled { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }

/* Modal */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { width: 100%; max-width: 600px; }

.small { padding: 4px 12px; font-size: 0.8rem; }
</style>
