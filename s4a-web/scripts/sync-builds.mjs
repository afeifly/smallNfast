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
    for (const artifact of artifacts) {
      const artName = artifact.name;
      const sizeMb = (artifact.size_in_bytes / 1024 / 1024).toFixed(2);

      let targetPublicFile = null;

      if (artName === 'S4A-Windows-Portable-ZIP') {
        targetPublicFile = 's4a_window.zip';
      } else if (artName === 'S4A-macOS-Portable-ZIP' || artName === 'S4A-macOS-DMG') {
        targetPublicFile = 's4a_mac.zip';
      } else if (artName === 'S4A-Android-APK') {
        targetPublicFile = 's4a_android.zip';
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

      // If the inner file is already a zip (e.g. s4a-app_xxx_windows_x64.zip),
      // we copy that real zip directly as s4a_window.zip
      if (extractedFiles[0].endsWith('.zip')) {
        fs.copyFileSync(innerFile, destPath);
      } else {
        // If it's a raw file (.apk or .dmg or .exe), package it into target zip
        createZip(innerFile, destPath);
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
