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

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 's4a-sync-'));

  try {
    console.log(`[sync:builds] Filter settings: Flavor = [${targetFlavor}], Platform = [${targetPlatform}]`);

    for (const artifact of artifacts) {
      const artName = artifact.name;
      const artLower = artName.toLowerCase();
      const isBasic = artLower.includes('basic');
      const isFull = !isBasic;

      if (targetFlavor === 'full' && isBasic) continue;
      if (targetFlavor === 'basic' && isFull) continue;

      const isAndroid = artLower.includes('android') || artLower.includes('apk');
      const isWindows = artLower.includes('windows') || artLower.includes('exe');
      const isMac = artLower.includes('macos') || artLower.includes('dmg');

      if (['android', 'apk'].includes(targetPlatform) && !isAndroid) continue;
      if (['windows', 'win'].includes(targetPlatform) && !isWindows) continue;
      if (['macos', 'mac'].includes(targetPlatform) && !isMac) continue;

      const sizeMb = (artifact.size_in_bytes / 1024 / 1024).toFixed(2);

      let targetPublicFile = null;

      // When a specific flavor is requested ('full' or 'basic'), save to standard clean names
      // (s4a_android.zip, s4a_window.zip, s4a_mac.zip) so web download links work immediately
      // without renaming!
      if (targetFlavor !== 'all') {
        if (isWindows) targetPublicFile = 's4a_window.zip';
        else if (isMac) targetPublicFile = 's4a_mac.zip';
        else if (isAndroid) targetPublicFile = 's4a_android.zip';
      } else {
        // When syncing all, keep distinct names for both flavors:
        if (isWindows) targetPublicFile = isBasic ? 's4a_window_basic.zip' : 's4a_window.zip';
        else if (isMac) targetPublicFile = isBasic ? 's4a_mac_basic.zip' : 's4a_mac.zip';
        else if (isAndroid) targetPublicFile = isBasic ? 's4a_android_basic.zip' : 's4a_android.zip';
      }

      if (!targetPublicFile) {
        continue;
      }

      console.log(`[sync:builds] Downloading ${artName} (${sizeMb} MB)...`);
      const zipBuffer = await downloadBuffer(artifact.archive_download_url);

      const artZipPath = path.join(tmpDir, `${artName}.zip`);
      fs.writeFileSync(artZipPath, zipBuffer);

      // Extract the outer GitHub wrapper zip
      const extractSubDir = path.join(tmpDir, artName);
      extractZip(artZipPath, extractSubDir);

      const extractedFiles = fs.readdirSync(extractSubDir).filter(f => !f.startsWith('.'));
      if (extractedFiles.length === 0) {
        console.warn(`[sync:builds] Warning: No file extracted from ${artName}`);
        continue;
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
        if (targetFlavor !== 'all') {
          fs.copyFileSync(innerFile, path.join(publicDir, 's4a_app.apk'));
          console.log(`[sync:builds] -> Updated direct APK public/s4a_app.apk`);
        } else {
          const rawApkTarget = isBasic ? 's4a_app_basic.apk' : 's4a_app.apk';
          fs.copyFileSync(innerFile, path.join(publicDir, rawApkTarget));
          console.log(`[sync:builds] -> Updated direct APK public/${rawApkTarget}`);
        }
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

main().catch(err => {
  console.error('[sync:builds] Error:', err.message);
  process.exit(1);
});
