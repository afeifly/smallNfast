import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const BACKEND_TARGET = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5005}`;
const PRINTER_BRIDGE_TARGET = process.env.PRINTER_BRIDGE_URL || 'http://127.0.0.1:8799';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '^/(api|st_label)': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '^/print_bridge': {
        target: PRINTER_BRIDGE_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/print_bridge/, ''),
      }
    }
  }
})