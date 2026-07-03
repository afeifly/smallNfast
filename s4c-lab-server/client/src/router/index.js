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

router.beforeEach((to, from, next) => {
    const token = localStorage.getItem('admin_token')
    if (to.meta.requiresAuth && !token) {
        next('/login')
    } else {
        next()
    }
})

export default router
