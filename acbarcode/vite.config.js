import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const BACKEND_TARGET = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5005}`;

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '^/(api|st_label)': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      }
    }
  }
})