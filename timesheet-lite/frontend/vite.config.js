import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue()],
    server: {
        host: '0.0.0.0', // Listen on all network interfaces
	allowedHosts: ['test.exmm.top','eco.exmm.top'],
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8003',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, '')
            }
        }
    }
})
