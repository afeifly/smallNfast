<template>
  <div id="app">
    <nav v-if="token" class="glass main-nav">
      <div class="nav-container container flex between center">
        <div class="logo flex center gap-8">
          <div class="logo-icon"></div>
          <span class="logo-text">LAB<span>CALI</span></span>
        </div>
        <div class="nav-links flex gap-8 center">
          <router-link to="/" class="nav-icon-btn nav-home-icon" title="Home">
            <i class="fas fa-home"></i>
          </router-link>
          
          <!-- User Profile Dropdown -->
          <div class="dropdown">
            <div @click.stop="toggleDropdown" class="user-trigger flex center">
              <div class="nav-icon-btn">
                <i class="fas fa-user"></i>
              </div>
              <i class="fas fa-chevron-down nav-chevron"></i>
            </div>
            
            <div v-show="showDropdown" class="dropdown-content glass animate-pop">
              <div class="dropdown-header">
                <span class="text-xs text-muted uppercase bold">Admin Menu</span>
              </div>
              <router-link to="/admins" class="dropdown-item" @click="showDropdown = false">
                <i class="fas fa-users-cog"></i> Management
              </router-link>
              <a href="#" @click.prevent="openPasswordModal" class="dropdown-item">
                <i class="fas fa-key"></i> Change Password
              </a>
              <div class="dropdown-divider"></div>
              <a href="#" @click.prevent="handleLogout" class="dropdown-item logout-item">
                <i class="fas fa-sign-out-alt"></i> Logout
              </a>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <!-- Change Password Modal (Global) -->
    <div v-if="showPasswordModal" class="modal-overlay flex-center" @click.self="showPasswordModal = false">
      <div class="modal-content glass-card animate-pop">
        <div class="modal-header mb-24 flex between center">
          <h3>Change Your Password</h3>
          <button @click="showPasswordModal = false" class="icon-btn">&times;</button>
        </div>
        <p class="subtitle mb-24">Ensure your account is secure with a strong password.</p>
        <form @submit.prevent="handleChangePassword">
          <div class="form-group">
            <label>Current Password</label>
            <input v-model="passChange.oldPassword" type="password" required placeholder="Enter current password" />
          </div>
          <div class="form-group">
            <label>New Password</label>
            <input v-model="passChange.password" type="password" required placeholder="Enter new password" />
          </div>
          <div class="form-group">
            <label>Confirm New Password</label>
            <input v-model="passChange.confirmPassword" type="password" required placeholder="Confirm new password" />
          </div>
          <div v-if="error" class="error-msg mb-16">{{ error }}</div>
          <div class="flex justify-end gap-12 mt-24">
            <button type="button" @click="showPasswordModal = false" class="secondary">Cancel</button>
            <button type="submit" class="primary" :disabled="submitting">
              {{ submitting ? 'Updating...' : 'Update Password' }}
            </button>
          </div>
        </form>
      </div>
    </div>
    
    <router-view />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from './store'
import { useRouter } from 'vue-router'
import axios from 'axios'

const store = useAppStore()
const router = useRouter()
const token = computed(() => store.token)

const showDropdown = ref(false)
const showPasswordModal = ref(false)
const passChange = ref({ oldPassword: '', password: '', confirmPassword: '' })
const submitting = ref(false)
const error = ref('')

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
}

const closeDropdown = (e) => {
  if (!e.target.closest('.dropdown')) {
    showDropdown.value = false
  }
}

const openPasswordModal = () => {
  showPasswordModal.value = true
  showDropdown.value = false
  passChange.value = { oldPassword: '', password: '', confirmPassword: '' }
  error.value = ''
}

const handleChangePassword = async () => {
  if (passChange.value.password !== passChange.value.confirmPassword) {
    error.value = 'Passwords do not match'
    return
  }
  
  submitting.value = true
  error.value = ''
  try {
    await axios.put('/api/admins/me/password', {
      oldPassword: passChange.value.oldPassword,
      password: passChange.value.password
    }, {
      headers: { Authorization: `Bearer ${store.token}` }
    })
    showPasswordModal.value = false
    alert('Password updated successfully')
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to update password'
  } finally {
    submitting.value = false
  }
}

const handleLogout = () => {
  store.logout()
  router.push('/login')
}

onMounted(() => {
  window.addEventListener('click', closeDropdown)
})

onUnmounted(() => {
  window.removeEventListener('click', closeDropdown)
})
</script>

<style scoped>
.main-nav {
  margin-bottom: 0;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
  position: sticky;
  top: 0;
  z-index: 100;
}
.nav-container {
  padding: 12px 20px;
}
.nav-links a {
  color: var(--text-main);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  transition: color 0.2s;
}
.nav-links a:hover, .nav-links a.router-link-active {
  color: var(--primary-color);
}
button.small {
  padding: 6px 12px;
  font-size: 0.8rem;
}

/* Dropdown Styles */
.dropdown {
  position: relative;
  display: inline-block;
}

.nav-icon-btn {
  width: 36px;
  height: 36px;
  display: flex !important;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-muted) !important;
  font-size: 1.1rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.nav-icon-btn:hover {
  background: rgba(9, 105, 218, 0.08);
  color: var(--primary-color) !important;
}

.nav-home-icon.router-link-active {
  background: rgba(9, 105, 218, 0.1);
  color: var(--primary-color) !important;
}

.user-trigger {
  padding-left: 4px;
  padding-right: 8px;
  gap: 4px;
  border-radius: 50px;
}

.user-trigger:hover .nav-icon-btn {
  background: transparent; /* Prevent double background */
}

.user-trigger:hover {
  background: rgba(9, 105, 218, 0.08);
}

.nav-chevron {
  font-size: 0.65rem;
  color: var(--text-muted);
  transition: transform 0.2s;
}

.user-trigger:hover .nav-chevron {
  color: var(--primary-color);
}

.dropdown-content {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  width: 180px;
  padding: 8px;
  z-index: 1000;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

.dropdown-header {
  padding: 8px 16px;
  margin-bottom: 4px;
}

.dropdown-divider {
  height: 1px;
  background: rgba(0,0,0,0.05);
  margin: 8px;
}

.dropdown-item {
  color: var(--text-main);
  padding: 10px 12px;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  transition: background 0.2s;
}

.dropdown-item:hover {
  background: rgba(9, 105, 218, 0.08);
  color: var(--primary-color);
}

.logout-item:hover {
  background: rgba(209, 36, 47, 0.08);
  color: #d1242f;
}

.dropdown-item i {
  width: 16px;
  text-align: center;
}

.text-xs { font-size: 0.7rem; }
.uppercase { text-transform: uppercase; }
.bold { font-weight: 700; }
</style>
