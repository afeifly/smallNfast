import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = pkg.version;
const distDir = path.join(rootDir, 'dist-packages');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log(`[package-artifacts] Packaging versioned artifacts for v${version}...`);

let packagedCount = 0;

// 1. macOS DMG & App Bundle
const dmgDir = path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'dmg');
if (fs.existsSync(dmgDir)) {
  const dmgs = fs.readdirSync(dmgDir).filter(f => f.endsWith('.dmg'));
  for (const dmg of dmgs) {
    const src = path.join(dmgDir, dmg);
    const destName = dmg.includes(version) ? dmg : `s4a-app_${version}_${dmg}`;
    const dest = path.join(distDir, destName);
    fs.copyFileSync(src, dest);
    console.log(`[package-artifacts] macOS DMG -> ${destName}`);
    packagedCount++;
  }
}
const macAppDir = path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'macos', 's4a-app.app');
if (fs.existsSync(macAppDir)) {
  try {
    const { execSync } = await import('child_process');
    const zipDest = path.join(distDir, `s4a-app_${version}_macos.zip`);
    execSync(`ditto -c -k --sequesterRsrc --keepParent "${macAppDir}" "${zipDest}"`);
    console.log(`[package-artifacts] macOS App ZIP -> s4a-app_${version}_macos.zip`);
    packagedCount++;
  } catch (err) {
    console.warn(`[package-artifacts] Could not package macOS zip: ${err.message}`);
  }
}

// 2. Android APK
const apkBaseDir = path.join(rootDir, 'src-tauri', 'gen', 'android', 'app', 'build', 'outputs', 'apk');
function findApks(dir) {
  let apks = [];
  if (!fs.existsSync(dir)) return apks;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      apks = apks.concat(findApks(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.apk')) {
      apks.push(fullPath);
    }
  }
  return apks;
}

const apks = findApks(apkBaseDir);
for (const apk of apks) {
  const isDebug = apk.includes('debug');
  const destName = `s4a-app_${version}_android${isDebug ? '-debug' : ''}.apk`;
  const dest = path.join(distDir, destName);
  fs.copyFileSync(apk, dest);
  console.log(`[package-artifacts] Android APK -> ${destName}`);
  packagedCount++;
}

// 3. Windows EXE
const releaseDir = path.join(rootDir, 'src-tauri', 'target', 'release');
if (fs.existsSync(releaseDir)) {
  const exes = fs.readdirSync(releaseDir).filter(f => f.endsWith('.exe') && !f.includes('build'));
  for (const exe of exes) {
    const src = path.join(releaseDir, exe);
    const destName = `s4a-app_${version}_x64.exe`;
    const dest = path.join(distDir, destName);
    fs.copyFileSync(src, dest);
    console.log(`[package-artifacts] Windows EXE -> ${destName}`);
    packagedCount++;
  }
}

console.log(`[package-artifacts] Finished packaging ${packagedCount} artifacts into dist-packages/`);
