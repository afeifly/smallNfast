import { defineStore } from 'pinia'
import axios from 'axios'
import api from '../api/axios'

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
                // Use bare axios for login — no auth header needed here
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
                const res = await api.get(`${API_URL}/company-users`)
                this.companyUsers = res.data
            } catch (err) {
                this.error = 'Failed to fetch users'
            } finally {
                this.loading = false
            }
        },
        async createUser(userData) {
            try {
                await api.post(`${API_URL}/company-users`, userData)
                await this.fetchUsers()
                return true
            } catch (err) {
                this.error = err.response?.data?.error || 'Failed to create user'
                return false
            }
        },
        async updateStatus(userId, status) {
            try {
                await api.patch(`${API_URL}/company-users/${userId}/status`, { status })
                await this.fetchUsers()
                return true
            } catch (err) {
                this.error = 'Failed to update status'
                return false
            }
        },
        async updateUser(userId, userData) {
            try {
                await api.put(`${API_URL}/company-users/${userId}`, userData)
                await this.fetchUsers()
                return true
            } catch (err) {
                this.error = err.response?.data?.error || 'Failed to update user'
                return false
            }
        }
    }
})
