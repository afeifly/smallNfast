import { defineStore } from 'pinia'
import api from '../api/axios'
import { jwtDecode } from 'jwt-decode'

export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: localStorage.getItem('token') || null,
        user: null
    }),
    getters: {
        isAuthenticated: (state) => !!state.token,
        isAdmin: (state) => state.user?.role === 'admin'
    },
    actions: {
        async login(username, password) {
            const params = new URLSearchParams()
            params.append('username', username)
            params.append('password', password)
            const response = await api.post('/auth/token', params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
            this.token = response.data.access_token
            localStorage.setItem('token', this.token)
            this.decodeToken()
        },
        logout() {
            this.token = null
            this.user = null
            localStorage.removeItem('token')
        },
        decodeToken() {
            if (this.token) {
                try {
                    const decoded = jwtDecode(this.token)
                    this.user = {
                        id: decoded.id,
                        username: decoded.sub,
                        role: decoded.role
                    }
                } catch (e) {
                    this.logout()
                }
            }
        }
    }
})
