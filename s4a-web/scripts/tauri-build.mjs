#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// First argument can be mode (full or basic)
let mode = process.env.VITE_BUILD_MODE || 'full';
const extraArgs = [];

for (const arg of process.argv.slice(2)) {
  if (arg === 'basic' || arg === 'full') {
    mode = arg;
  } else {
    extraArgs.push(arg);
  }
}

process.env.VITE_BUILD_MODE = mode;

console.log(`[tauri-build] Building Tauri application in [${mode}] mode...`);

const isWin = process.platform === 'win32';
const cmd = isWin ? 'npx.cmd' : 'npx';

const child = spawn(cmd, ['tauri', 'build', ...extraArgs], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: isWin,
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
