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
  // 1. Collect and 2. Sort relative paths alphabetically
  const sortedPaths = Array.from(fileMap.keys())
    // Skip the summary file itself as it's the metadata containing the hash
    .filter(path => !path.endsWith('summary.yml') && !path.startsWith('parser.'))
    .sort();

  const spark = new SparkMD5();

  for (const path of sortedPaths) {
    const content = fileMap.get(path);
    // 3. Calculate individual MD5 for each file
    const fileMD5 = SparkMD5.ArrayBuffer.hash(content.buffer);
    // 4. Update the combined MD5
    spark.append(fileMD5);
  }

  return spark.end();
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
