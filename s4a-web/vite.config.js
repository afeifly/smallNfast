import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from "vite-plugin-singlefile"
import packageJson from './package.json'

const useSingleFile = process.env.VITE_SINGLE_FILE === 'true';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const rawMode = process.env.VITE_BUILD_MODE || process.env.BUILD_MODE || (mode === 'basic' ? 'basic' : 'full');
  const buildMode = String(rawMode).toLowerCase() === 'basic' ? 'basic' : 'full';
  process.env.VITE_BUILD_MODE = buildMode;

  return {
    plugins: useSingleFile ? [react(), viteSingleFile()] : [react()],
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
      __BUILD_MODE__: JSON.stringify(buildMode),
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
  };
})
