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

// Optional GITHUB_TOKEN or GH_TOKEN from environment for private repos or higher rate limits
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

async function main() {
  console.log(`[sync:builds] Checking repository ${OWNER}/${REPO} for latest workflow run...`);

  // 1. Get the latest successful run on main (or fall back to any branch if main has none yet)
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

  // 2. Fetch artifacts for this run
  const artifactsData = await apiRequest(latestRun.artifacts_url);
  const artifacts = artifactsData.artifacts || [];

  if (artifacts.length === 0) {
    console.warn('[sync:builds] No artifacts found for this run (they may have expired).');
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
      let extractInner = false;

      if (artName === 'S4A-Windows-Portable-ZIP') {
        targetPublicFile = 's4a_window.zip';
        extractInner = true;
      } else if (artName === 'S4A-macOS-Portable-ZIP') {
        targetPublicFile = 's4a_mac.zip';
        extractInner = true;
      } else if (artName === 'S4A-Android-APK') {
        targetPublicFile = 's4a_android.zip';
        extractInner = true;
      }

      if (!targetPublicFile) {
        continue;
      }

      console.log(`[sync:builds] Downloading ${artName} (${sizeMb} MB)...`);
      const zipBuffer = await downloadBuffer(artifact.archive_download_url);

      const artZipPath = path.join(tmpDir, `${artName}.zip`);
      fs.writeFileSync(artZipPath, zipBuffer);

      // GitHub actions artifacts are always wrapped in a zip container.
      // We extract the container to get the actual build file.
      const extractSubDir = path.join(tmpDir, artName);
      fs.mkdirSync(extractSubDir, { recursive: true });
      execSync(`unzip -q -o "${artZipPath}" -d "${extractSubDir}"`);

      const extractedFiles = fs.readdirSync(extractSubDir);
      if (extractedFiles.length === 0) {
        console.warn(`[sync:builds] Warning: No file extracted from ${artName}`);
        continue;
      }

      const innerFile = path.join(extractSubDir, extractedFiles[0]);
      const destPath = path.join(publicDir, targetPublicFile);

      // If the target is android apk, we keep it as a zip containing the apk (or zip it)
      if (artName === 'S4A-Android-APK') {
        if (extractedFiles[0].endsWith('.zip')) {
          fs.copyFileSync(innerFile, destPath);
        } else {
          // Zip the APK so browser downloads /s4a_android.zip
          const apkName = extractedFiles[0];
          execSync(`cd "${extractSubDir}" && zip -q "${destPath}" "${apkName}"`);
        }
      } else {
        // Windows and macOS portable packages are already zip files inside the artifact
        if (extractedFiles[0].endsWith('.zip')) {
          fs.copyFileSync(innerFile, destPath);
        } else {
          // If a raw executable or file, zip it for the web download link
          execSync(`cd "${extractSubDir}" && zip -q "${destPath}" "${extractedFiles[0]}"`);
        }
      }

      const finalSizeMb = (fs.statSync(destPath).size / 1024 / 1024).toFixed(2);
      console.log(`[sync:builds] -> Updated public/${targetPublicFile} (${finalSizeMb} MB)`);
    }

    console.log('\n[sync:builds] Successfully synchronized latest build artifacts to s4a-web/public/ !');
  } finally {
    // Cleanup temporary files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

main().catch(err => {
  console.error('[sync:builds] Error:', err.message);
  process.exit(1);
});

