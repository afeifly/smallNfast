import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// If a new version was passed as CLI argument (e.g. node scripts/sync-version.mjs 0.2.0)
const targetVersion = process.argv[2] || pkg.version;

if (process.argv[2]) {
  pkg.version = targetVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`[sync-version] Updated package.json to ${targetVersion}`);
}

// 1. Sync src-tauri/tauri.conf.json
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  if (tauriConf.version !== targetVersion) {
    tauriConf.version = targetVersion;
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
    console.log(`[sync-version] Synced src-tauri/tauri.conf.json to ${targetVersion}`);
  } else {
    console.log(`[sync-version] src-tauri/tauri.conf.json already at ${targetVersion}`);
  }
}

// 2. Sync src-tauri/Cargo.toml
if (fs.existsSync(cargoTomlPath)) {
  let cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
  const packageVersionRegex = /(\[package\][\s\S]*?version\s*=\s*")[^"]+(")/;
  if (packageVersionRegex.test(cargoContent)) {
    cargoContent = cargoContent.replace(packageVersionRegex, `$1${targetVersion}$2`);
    fs.writeFileSync(cargoTomlPath, cargoContent, 'utf8');
    console.log(`[sync-version] Synced src-tauri/Cargo.toml to ${targetVersion}`);
  }
}

console.log(`[sync-version] Version ${targetVersion} synchronized across web, desktop, and mobile.`);
