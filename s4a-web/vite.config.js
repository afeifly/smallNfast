import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from "vite-plugin-singlefile"

// In CSD mode (VITE_USE_CSD=true) we skip viteSingleFile so the
// .wasm module can be served as a separate static asset.
const isCsdMode = process.env.VITE_USE_CSD === 'true';

// https://vite.dev/config/
export default defineConfig({
  plugins: isCsdMode ? [react()] : [react(), viteSingleFile()],
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
