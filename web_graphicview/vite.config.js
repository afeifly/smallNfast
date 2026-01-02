import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { viteSingleFile } from "vite-plugin-singlefile"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  server: {
    host: true
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    globals: true
  }
})
