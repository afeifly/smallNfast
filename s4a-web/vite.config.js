import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from "vite-plugin-singlefile"
import packageJson from './package.json'

const useSingleFile = process.env.VITE_SINGLE_FILE === 'true';

// https://vite.dev/config/
export default defineConfig({
  plugins: useSingleFile ? [react(), viteSingleFile()] : [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  base: './',
  server: {
    host: true,
    allowedHosts: true
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    globals: true
  }
})
