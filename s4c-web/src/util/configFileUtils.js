import * as zip from "@zip.js/zip.js";
import SparkMD5 from "spark-md5";
import yaml from "js-yaml";

const CONFIG_PASSWORD = "SUTOXZCONFIG";

/**
 * Calculates the special two-level MD5 hash defined in configfile.md.
 * 1. Collect all file relative paths (ZIP paths).
 * 2. Sort them alphabetically.
 * 3. Calculate MD5 for each file individually.
 * 4. Concatenate these MD5 strings and calculate the final MD5.
 * 
 * @param {Map<string, Uint8Array>} fileMap - Map of ZIP relative path to file content.
 * @returns {string} The final MD5 hash.
 */
export async function calculateConfigHash(fileMap) {
  // 1. Collect all paths
  const allPaths = Array.from(fileMap.keys());
  console.group('[ConfigHash] Hash Calculation');
  console.log(`[ConfigHash] All files in fileMap (${allPaths.length}):`);
  allPaths.forEach((p, i) => {
    const val = fileMap.get(p);
    console.log(`  [${i}] ${p} (${val?.length ?? '?'} bytes, type: ${val?.constructor?.name ?? typeof val})`);
  });

  // 2. Filter and sort
  const filteredPaths = allPaths
    .filter(path => !path.endsWith('summary.yml') && !path.startsWith('parser.'));
  console.log(`[ConfigHash] After filter (removed summary.yml & parser.*) (${filteredPaths.length}):`);
  filteredPaths.forEach((p, i) => console.log(`  [${i}] ${p}`));

  const sortedPaths = [...filteredPaths].sort();
  console.log(`[ConfigHash] After sort (${sortedPaths.length}):`);
  sortedPaths.forEach((p, i) => console.log(`  [${i}] ${p}`));

  const spark = new SparkMD5();
  let concatenatedMD5 = '';

  console.log('[ConfigHash] --- Per-file MD5 ---');
  for (const path of sortedPaths) {
    const content = fileMap.get(path);
    const contentType = content?.constructor?.name ?? typeof content;
    const contentSize = content?.length ?? content?.byteLength ?? '?';
    // 3. Calculate individual MD5 for each file
    const fileMD5 = SparkMD5.ArrayBuffer.hash(content.buffer);
    concatenatedMD5 += fileMD5;
    console.log(`[ConfigHash]   ${path}  |  ${contentSize} bytes (${contentType})  |  MD5: ${fileMD5}`);
    // 4. Update the combined MD5
    spark.append(fileMD5);
  }

  const finalHash = spark.end();
  console.log(`[ConfigHash] Concatenated MD5 string: ${concatenatedMD5}`);
  console.log(`[ConfigHash] Final combined hash: ${finalHash}`);
  console.groupEnd();

  return finalHash;
}

/**
 * Unzips an encrypted .cfgf file.
 * 
 * @param {File | Blob} file - The .cfgf file to extract.
 * @returns {Promise<Map<string, Uint8Array>>} Map of path to Uint8Array.
 */
export async function unzipConfigFile(file) {
  const reader = new zip.ZipReader(new zip.BlobReader(file), { password: CONFIG_PASSWORD });
  const entries = await reader.getEntries();
  const fileMap = new Map();

  for (const entry of entries) {
    if (!entry.directory) {
      const uint8Array = await entry.getData(new zip.Uint8ArrayWriter());
      fileMap.set(entry.filename, uint8Array);
    }
  }

  await reader.close();
  return fileMap;
}

/**
 * Creates an encrypted .cfgf package.
 * 
 * @param {Map<string, Uint8Array>} fileMap - Map of relative path to content.
 * @returns {Promise<Blob>} The resulting encrypted ZIP blob.
 */
export async function zipConfigFile(fileMap) {
  const blobWriter = new zip.BlobWriter("application/zip");
  const writer = new zip.ZipWriter(blobWriter, { password: CONFIG_PASSWORD });

  for (const [path, content] of fileMap.entries()) {
    await writer.add(path, new zip.Uint8ArrayReader(content));
  }

  await writer.close();
  return blobWriter.getData();
}

/**
 * Parses the summary.yml file from the unzipped map.
 * 
 * @param {Map<string, Uint8Array>} fileMap 
 * @returns {Object} The parsed YAML summary.
 */
export function parseSummary(fileMap) {
  const summaryContent = fileMap.get('summary.yml');
  if (!summaryContent) throw new Error("summary.yml not found in package");
  
  const decoder = new TextDecoder();
  const yamlText = decoder.decode(summaryContent);
  return yaml.load(yamlText);
}

/**
 * Generates a summary.yml file content.
 * 
 * @param {Object} summaryData 
 * @returns {Uint8Array}
 */
export function generateSummary(summaryData) {
  const yamlText = yaml.dump(summaryData);
  const encoder = new TextEncoder();
  return encoder.encode(yamlText);
}

/**
 * Prepares and zips a complete configuration package.
 * 
 * @param {Object} configs - Map of paths to JSON objects.
 * @param {Object} summary - The summary object.
 * @param {Map<string, Uint8Array>} [originalFileMap] - Optional original binary files to preserve non-config files.
 * @returns {Promise<Blob>}
 */
export async function exportConfigPackage(configs, summary, originalFileMap) {
  console.group('[Export] exportConfigPackage');
  const fileMap = originalFileMap ? new Map(originalFileMap) : new Map();
  const encoder = new TextEncoder();

  console.log('[Export] Original fileMap keys:', Array.from(fileMap.keys()));

  // 1. Update/Add all JSON configs back to the fileMap
  for (const [path, data] of Object.entries(configs)) {
    const jsonString = JSON.stringify(data, null, 2);
    fileMap.set(path, encoder.encode(jsonString));
    console.log(`[Export] Serialized config: ${path} (${jsonString.length} bytes)`);
  }

  // 2. Remove summary.yml temporarily to calculate hash of payload
  fileMap.delete('summary.yml');
  console.log('[Export] fileMap after removing summary.yml:', Array.from(fileMap.keys()));

  // 3. Calculate new hash
  const newHash = await calculateConfigHash(fileMap);
  console.log('[Export] Old hash: %s', summary.hash);
  console.log('[Export] New hash: %s', newHash);

  // 4. Update summary with new hash and timestamp
  const updatedSummary = {
    ...summary,
    hash: newHash,
    'Config-Date': new Date().toISOString()
  };

  // 5. Add updated summary.yml
  const summaryContent = generateSummary(updatedSummary);
  fileMap.set('summary.yml', summaryContent);
  console.log('[Export] Final fileMap keys:', Array.from(fileMap.keys()));
  console.groupEnd();

  // 6. Zip it all up
  return await zipConfigFile(fileMap);
}
