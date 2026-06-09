import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'
import Projects from '../views/Projects.vue'
import Reports from '../views/Reports.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/login',
            name: 'login',
            component: Login
        },
        {
            path: '/',
            name: 'dashboard',
            component: Dashboard,
            meta: { requiresAuth: true }
        },
        {
            path: '/projects',
            name: 'projects',
            component: Projects,
            meta: { requiresAuth: true }
        },
        {
            path: '/reports',
            name: 'reports',
            component: Reports,
            meta: { requiresAuth: true }
        },
        {
            path: '/logs',
            name: 'logs',
            component: () => import('../views/ActivityLogs.vue'),
            meta: { requiresAuth: true, requiresAdmin: true }
        },
        {
            path: '/email-settings',
            name: 'email-settings',
            component: () => import('../views/EmailSettings.vue'),
            meta: { requiresAuth: true, requiresAdmin: true }
        },
        {
            path: '/backups',
            name: 'backups',
            component: () => import('../views/BackupManager.vue'),
            meta: { requiresAuth: true, requiresAdmin: true }
        },
        {
            path: '/workdays',
            name: 'workdays',
            component: () => import('../views/WorkDayManagement.vue'),
            meta: { requiresAuth: true, requiresAdmin: true }
        },
        {
            path: '/team-timesheets',
            name: 'team-timesheets',
            component: () => import('../views/TeamTimesheets.vue'),
            meta: { requiresAuth: true, requiresTeamLeader: true }
        },
        {
            path: '/log-work',
            name: 'log-work',
            component: () => import('../views/LogWork.vue')
        },
        {
            path: '/employees',
            name: 'employees',
            component: () => import('../views/Employees.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/help',
            name: 'help',
            component: () => import('../views/Help.vue'),
            meta: { requiresAuth: true }
        }
    ]
})

router.beforeEach((to, from, next) => {
    const authStore = useAuthStore()
    if (!authStore.user && authStore.token) {
        authStore.decodeToken()
    }

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        next('/login')
    } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
        next('/')
    } else if (to.meta.requiresTeamLeader && authStore.user.role !== 'team_leader') {
        next('/')
    } else {
        next()
    }
})

export default router
