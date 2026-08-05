import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'
import UserDetail from '../views/UserDetail.vue'
import AdminManagement from '../views/AdminManagement.vue'

const routes = [
    { path: '/login', name: 'Login', component: Login },
    {
        path: '/',
        name: 'Dashboard',
        component: Dashboard,
        meta: { requiresAuth: true }
    },
    {
        path: '/user/:id',
        name: 'UserDetail',
        component: UserDetail,
        meta: { requiresAuth: true }
    },
    {
        path: '/admins',
        name: 'AdminManagement',
        component: AdminManagement,
        meta: { requiresAuth: true }
    },
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

router.beforeEach(async (to, from, next) => {
    const token = localStorage.getItem('admin_token')

    if (!to.meta.requiresAuth) {
        // Public route (e.g. /login) — always allow
        return next()
    }

    if (!token) {
        // No token at all — go to login
        return next('/login')
    }

    // Verify the token is actually valid on the server, not just a fake string
    try {
        const res = await fetch('/api/admins', {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
            next()
        } else {
            // Token rejected by server (expired, tampered, wrong secret)
            localStorage.removeItem('admin_token')
            next('/login')
        }
    } catch {
        // Network error — still allow navigation (offline-safe)
        next()
    }
})

export default router
