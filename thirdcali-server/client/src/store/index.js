import { defineStore } from 'pinia'
import axios from 'axios'

const API_URL = '/api'

export const useAppStore = defineStore('app', {
    state: () => ({
        token: localStorage.getItem('admin_token') || null,
        companyUsers: [],
        loading: false,
        error: null,
    }),
    actions: {
        async login(username, password) {
            try {
                const res = await axios.post(`${API_URL}/auth/login`, { username, password })
                this.token = res.data.token
                localStorage.setItem('admin_token', this.token)
                return true
            } catch (err) {
                this.error = err.response?.data?.error || 'Login failed'
                return false
            }
        },
        logout() {
            this.token = null
            localStorage.removeItem('admin_token')
        },
        async fetchUsers() {
            this.loading = true
            try {
                const res = await axios.get(`${API_URL}/company-users`, {
                    headers: { Authorization: `Bearer ${this.token}` }
                })
                this.companyUsers = res.data
            } catch (err) {
                this.error = 'Failed to fetch users'
            } finally {
                this.loading = false
            }
        },
        async createUser(userData) {
            try {
                await axios.post(`${API_URL}/company-users`, userData, {
                    headers: { Authorization: `Bearer ${this.token}` }
                })
                await this.fetchUsers()
                return true
            } catch (err) {
                this.error = err.response?.data?.error || 'Failed to create user'
                return false
            }
        },
        async updateStatus(userId, status) {
            try {
                await axios.patch(`${API_URL}/company-users/${userId}/status`, { status }, {
                    headers: { Authorization: `Bearer ${this.token}` }
                })
                await this.fetchUsers()
                return true
            } catch (err) {
                this.error = 'Failed to update status'
                return false
            }
        },
        async updateUser(userId, userData) {
            try {
                await axios.put(`${API_URL}/company-users/${userId}`, userData, {
                    headers: { Authorization: `Bearer ${this.token}` }
                })
                await this.fetchUsers()
                return true
            } catch (err) {
                this.error = err.response?.data?.error || 'Failed to update user'
                return false
            }
        }
    }
})
