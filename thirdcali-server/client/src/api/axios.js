import axios from 'axios'
import router from '../router'

const api = axios.create()

// Auto-inject the Bearer token on every request
api.interceptors.request.use(config => {
    const token = localStorage.getItem('admin_token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// On 401 (session expired / invalid token), clear session and redirect to login
api.interceptors.response.use(
    response => response,
    async error => {
        if (
            error.response?.status === 401 &&
            router.currentRoute.value.name !== 'Login'
        ) {
            localStorage.removeItem('admin_token')
            // Dynamic import avoids a circular dependency (store imports this file).
            // Pinia is always active by the time a real HTTP response fires.
            try {
                const { useAppStore } = await import('../store')
                useAppStore().token = null
            } catch {}
            router.push('/login')
        }
        return Promise.reject(error)
    }
)

export default api
