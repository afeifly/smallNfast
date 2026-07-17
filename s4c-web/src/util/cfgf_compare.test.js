import { describe, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { unzipConfigFile } from './configFileUtils';

const OUT_DIR = 'reference/temp_unzip/comparison';

async function extractCfgf(filePath, label) {
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer]);
  const fileMap = await unzipConfigFile(blob);
  const decoder = new TextDecoder();
  const outDir = path.join(OUT_DIR, label);
  fs.mkdirSync(outDir, { recursive: true });

  for (const [key, bytes] of fileMap.entries()) {
    const content = decoder.decode(bytes);
    const outPath = path.join(outDir, key.replace(/\//g, '__'));
    fs.writeFileSync(outPath, content);
  }
  console.log(`[${label}] Extracted ${fileMap.size} files to ${outDir}`);
  return fileMap;
}

describe('cfgf comparison', () => {
  it('extracts both cfgf files', async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await extractCfgf('reference/temp_unzip/myconfig.cfgf', 'myconfig');
    await extractCfgf('reference/temp_unzip/SUTO_config_20260703174644.cfgf', 'suto');
  });
});
