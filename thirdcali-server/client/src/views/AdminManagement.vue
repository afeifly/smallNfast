<template>
  <div class="admin-management container page-transition">
    <div class="header-section flex between center mb-32">
      <div>
        <h1 class="gradient-text">Administrator Accounts</h1>
        <p class="subtitle">Manage system administrators and their access levels.</p>
      </div>
      <button @click="showAddModal = true" class="primary flex center gap-8">
        <i class="fas fa-user-plus"></i> Add New Admin
      </button>
    </div>

    <!-- Admin List -->
    <div class="glass-card overflow-hidden">
      <table class="w-100">
        <thead>
          <tr>
            <th>Username</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="admin in admins" :key="admin.id">
            <td>
              <div class="flex center gap-12">
                <div class="user-avatar">{{ admin.username.charAt(0).toUpperCase() }}</div>
                <div class="flex-column">
                  <div class="flex center gap-8">
                    <span class="font-600">{{ admin.username }}</span>
                    <span v-if="admin.username === 'admin'" class="badge-tag">Default</span>
                  </div>
                  <span class="text-xs text-muted">Administrator</span>
                </div>
              </div>
            </td>
            <td class="text-right">
              <div class="flex justify-end gap-8">
                <!-- Removed individual password change as requested -->
                <button 
                  v-if="admin.username !== 'admin'"
                  @click="deleteAdmin(admin)" 
                  class="danger small" 
                  :disabled="admins.length <= 1"
                  :title="admins.length <= 1 ? 'Cannot delete the last admin' : 'Remove access'"
                >
                  <i class="fas fa-trash-alt"></i> Delete
                </button>
                <span v-else class="text-xs text-muted italic">System Account</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="loading" class="flex center p-32">
        <div class="loader"></div>
      </div>
      
      <div v-if="!loading && admins.length === 0" class="text-center p-32 text-muted">
        No administrators found.
      </div>
    </div>

    <!-- Add Admin Modal -->
    <div v-if="showAddModal" class="modal-overlay flex-center" @click.self="showAddModal = false">
      <div class="modal-content glass-card animate-pop">
        <div class="modal-header mb-24 flex between center">
          <h3>Register New Administrator</h3>
          <button @click="showAddModal = false" class="icon-btn">&times;</button>
        </div>
        <form @submit.prevent="handleAddAdmin">
          <div class="form-group">
            <label>Username</label>
            <input v-model="newAdmin.username" type="text" required placeholder="e.g. admin_jane" />
          </div>
          <div class="form-group">
            <label>Temporary Password</label>
            <input v-model="newAdmin.password" type="password" required placeholder="Create a secure password" />
          </div>
          <div class="form-group">
            <label>Confirm Password</label>
            <input v-model="newAdmin.confirmPassword" type="password" required placeholder="Repeat password" />
          </div>
          <div v-if="error" class="error-msg mb-16">{{ error }}</div>
          <div class="flex justify-end gap-12 mt-24">
            <button type="button" @click="showAddModal = false" class="secondary">Cancel</button>
            <button type="submit" class="primary" :disabled="submitting">
              {{ submitting ? 'Creating Account...' : 'Create Account' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useAppStore } from '../store'

const store = useAppStore()
const admins = ref([])
const loading = ref(false)
const submitting = ref(false)
const error = ref('')

const showAddModal = ref(false)

const newAdmin = ref({
  username: '',
  password: '',
  confirmPassword: ''
})

const fetchAdmins = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/admins', {
      headers: { Authorization: `Bearer ${store.token}` }
    })
    admins.value = res.data
  } catch (err) {
    console.error('Failed to fetch admins', err)
  } finally {
    loading.value = false
  }
}

const handleAddAdmin = async () => {
    if (newAdmin.value.password !== newAdmin.value.confirmPassword) {
        error.value = 'Passwords do not match'
        return
    }
    
    submitting.value = true
    error.value = ''
    try {
        await axios.post('/api/admins', {
            username: newAdmin.value.username,
            password: newAdmin.value.password
        }, {
            headers: { Authorization: `Bearer ${store.token}` }
        })
        await fetchAdmins()
        showAddModal.value = false
        newAdmin.value = { username: '', password: '', confirmPassword: '' }
    } catch (err) {
        error.value = err.response?.data?.error || 'Failed to add admin'
    } finally {
        submitting.value = false
    }
}

const deleteAdmin = async (admin) => {
    if (!confirm(`Are you sure you want to revoke access for "${admin.username}"?`)) return
    
    try {
        await axios.delete(`/api/admins/${admin.id}`, {
            headers: { Authorization: `Bearer ${store.token}` }
        })
        await fetchAdmins()
    } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete admin')
    }
}

onMounted(fetchAdmins)
</script>

<style scoped>
.user-avatar {
  width: 40px;
  height: 40px;
  background: var(--gradient-blue);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 1.1rem;
}

table {
  border-collapse: collapse;
}

th {
  text-align: left;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-muted);
}

td {
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

tr:last-child td {
  border-bottom: none;
}

.text-xs {
  font-size: 0.75rem;
}

.subtitle {
  color: var(--text-muted);
  margin-top: 4px;
}

.badge-tag {
  background: var(--gradient-cyan);
  color: white;
  font-size: 0.65rem;
  padding: 2px 8px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 700;
}
</style>
