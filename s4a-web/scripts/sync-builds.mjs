import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

const OWNER = 'afeifly';
const REPO = 'smallNfast';
const WORKFLOW_FILE = 's4a-windows-build.yml';

// CLI args: node scripts/sync-builds.mjs [full|basic|all] [android|windows|macos|all]
const args = process.argv.slice(2).map(a => a.toLowerCase().replace(/^--/, ''));
const targetFlavor = args.find(a => ['full', 'basic', 'all'].includes(a)) || 'all';
const targetPlatform = args.find(a => ['android', 'apk', 'windows', 'macos', 'mac', 'win'].includes(a)) || 'all';

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const headers = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'S4A-Artifact-Sync',
  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
};

export function selectArtifacts(artifacts, flavor, platform) {
  const platforms = platform === 'all' ? ['windows', 'macos', 'android'] : [
    ({ win: 'windows', mac: 'macos', apk: 'android' })[platform] || platform
  ];
  const flavors = flavor === 'all' ? ['full', 'basic'] : [flavor];
  const expected = new Set(flavors.flatMap(mode => platforms.map(os => {
    const name = os === 'windows' ? 'window' : os === 'macos' ? 'mac' : os;
    return `s4a_${mode === 'basic' ? 'basic_' : ''}${name}.zip`;
  })));
  const selected = new Map();

  for (const artifact of artifacts) {
    if (artifact.expired) continue;
    const name = artifact.name.toLowerCase();
    const isBasic = name.includes('basic');
    const os = name.includes('windows') || name.includes('exe') ? 'window'
      : name.includes('macos') || name.includes('dmg') ? 'mac'
        : name.includes('android') || name.includes('apk') ? 'android' : null;
    if (!os) continue;
    const filename = `s4a_${isBasic ? 'basic_' : ''}${os}.zip`;
    if (!expected.has(filename)) continue;
    if (selected.has(filename)) throw new Error(`Multiple artifacts match ${filename}`);
    selected.set(filename, { artifact, filename, isBasic });
  }

  const missing = [...expected].filter(filename => !selected.has(filename));
  if (missing.length) {
    throw new Error(`Missing or expired artifacts for: ${missing.join(', ')}`);
  }
  return [...selected.values()];
}

async function apiRequest(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API request failed (${res.status} ${res.statusText}): ${body}`);
  }
  return res.json();
}

async function downloadBuffer(url) {
  const res = await fetch(url, {
    headers: {
      ...headers,
      'Accept': 'application/vnd.github+json'
    },
    redirect: 'follow'
  });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status} ${res.statusText})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// Unpack zip using tar (standard in Ubuntu 24/Debian/macOS) or python3 as fallback
function extractZip(srcZip, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  try {
    // Ubuntu 24's tar can extract zip natively
    execSync(`tar -xf "${srcZip}" -C "${destDir}" 2>/dev/null`);
    return;
  } catch (_) {}

  try {
    // Python3 standard library zipfile (present on almost all Linux machines)
    execSync(`python3 -m zipfile -e "${srcZip}" "${destDir}"`);
    return;
  } catch (_) {}

  try {
    execSync(`unzip -q -o "${srcZip}" -d "${destDir}"`);
    return;
  } catch (_) {
    throw new Error(`Could not extract zip ${srcZip}. Neither 'tar', 'python3', nor 'unzip' succeeded.`);
  }
}

// Pack folder or file into a zip without requiring external zip command
function createZip(sourceFileOrDir, outputZip) {
  try {
    execSync(`python3 -c "import zipfile, os, sys; z = zipfile.ZipFile(sys.argv[2], 'w', zipfile.ZIP_DEFLATED); [z.write(os.path.join(root, f), os.path.relpath(os.path.join(root, f), os.path.dirname(sys.argv[1]))) for root, dirs, files in os.walk(sys.argv[1]) for f in files] if os.path.isdir(sys.argv[1]) else z.write(sys.argv[1], os.path.basename(sys.argv[1])); z.close()" "${sourceFileOrDir}" "${outputZip}"`);
    return;
  } catch (_) {}

  try {
    execSync(`zip -q -r "${outputZip}" .`, { cwd: path.dirname(sourceFileOrDir) });
    return;
  } catch (_) {
    throw new Error(`Could not create zip ${outputZip}.`);
  }
}

async function main() {
  console.log(`[sync:builds] Checking repository ${OWNER}/${REPO} for latest workflow run...`);

  let runsData = await apiRequest(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?status=success&branch=main&per_page=1`
  );

  let latestRun = runsData.workflow_runs?.[0];
  if (!latestRun) {
    console.log('[sync:builds] No successful run on branch "main". Checking all branches...');
    runsData = await apiRequest(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?status=success&per_page=1`
    );
    latestRun = runsData.workflow_runs?.[0];
  }

  if (!latestRun) {
    console.error('[sync:builds] No successful run found for workflow ' + WORKFLOW_FILE);
    process.exit(1);
  }

  console.log(`[sync:builds] Found successful Run #${latestRun.run_number} (${latestRun.head_sha.slice(0, 7)}) on branch "${latestRun.head_branch}".`);
  console.log(`[sync:builds] Commit: "${latestRun.head_commit?.message?.split('\n')[0]}"`);
  console.log(`[sync:builds] Completed at: ${latestRun.updated_at}`);

  const artifactsData = await apiRequest(latestRun.artifacts_url);
  const artifacts = artifactsData.artifacts || [];

  if (artifacts.length === 0) {
    console.warn('[sync:builds] No artifacts found for this run.');
    process.exit(1);
  }

  console.log(`[sync:builds] Found ${artifacts.length} artifacts:`, artifacts.map(a => a.name).join(', '));
  console.log(`[sync:builds] Filter settings: Flavor = [${targetFlavor}], Platform = [${targetPlatform}]`);
  const selectedArtifacts = selectArtifacts(artifacts, targetFlavor, targetPlatform);

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 's4a-sync-'));

  try {
    for (const { artifact, filename: targetPublicFile, isBasic } of selectedArtifacts) {
      const artName = artifact.name;
      const sizeMb = (artifact.size_in_bytes / 1024 / 1024).toFixed(2);

      console.log(`[sync:builds] Downloading ${artName} (${sizeMb} MB)...`);
      const zipBuffer = await downloadBuffer(artifact.archive_download_url);

      const artZipPath = path.join(tmpDir, `${artName}.zip`);
      fs.writeFileSync(artZipPath, zipBuffer);

      // Extract the outer GitHub wrapper zip
      const extractSubDir = path.join(tmpDir, artName);
      extractZip(artZipPath, extractSubDir);

      const extractedFiles = fs.readdirSync(extractSubDir).filter(f => !f.startsWith('.'));
      if (extractedFiles.length === 0) {
        throw new Error(`No file extracted from ${artName}`);
      }

      const innerFile = path.join(extractSubDir, extractedFiles[0]);
      const destPath = path.join(publicDir, targetPublicFile);

      // If it's a raw file (.apk or .dmg or .exe), package it into target zip
      if (extractedFiles[0].endsWith('.zip')) {
        fs.copyFileSync(innerFile, destPath);
      } else {
        createZip(innerFile, destPath);
      }

      // If it's an APK, also save the raw .apk directly for instant Android install without unzipping
      if (extractedFiles[0].endsWith('.apk')) {
        const rawApkTarget = isBasic ? 's4a_app_basic.apk' : 's4a_app.apk';
        fs.copyFileSync(innerFile, path.join(publicDir, rawApkTarget));
        console.log(`[sync:builds] -> Updated direct APK public/${rawApkTarget}`);
      }

      const finalSizeMb = (fs.statSync(destPath).size / 1024 / 1024).toFixed(2);
      console.log(`[sync:builds] -> Updated public/${targetPublicFile} (${finalSizeMb} MB)`);
    }

    console.log('\n[sync:builds] Successfully synchronized latest build artifacts to s4a-web/public/ !');
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(err => {
    console.error('[sync:builds] Error:', err.message);
    process.exitCode = 1;
  });
}
