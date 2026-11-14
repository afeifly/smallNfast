#!/usr/bin/env node
/**
 * Cross-platform Tauri dev launcher:
 * - On macOS (darwin): runs `scripts/dev-macos.sh` so the dev binary is wrapped
 *   in a signed `.app` bundle with `NSBluetoothAlwaysUsageDescription` and launched
 *   via LaunchServices (`open`), preventing macOS TCC from terminating (`SIGABRT`)
 *   the process when CoreBluetooth (`btleplug`) initializes.
 * - On Windows / Linux: runs `tauri dev` directly.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const extraArgs = process.argv.slice(2);

if (process.platform === 'darwin') {
  const scriptPath = resolve(__dirname, 'dev-macos.sh');
  const child = spawn('bash', [scriptPath, ...extraArgs], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
} else {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'npx.cmd' : 'npx';
  const child = spawn(cmd, ['tauri', 'dev', ...extraArgs], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}
