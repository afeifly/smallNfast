import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5005',
        changeOrigin: true,
      },
      '/st_label': {
        target: 'http://localhost:5005',
        changeOrigin: true,
      },
      '/suto_st_label': {
        target: 'http://localhost:5005',
        changeOrigin: true,
      }
    }
  }
})