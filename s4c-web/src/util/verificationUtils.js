/**
 * WARNING: STRICT API / CONFIGURATION CONTRACT
 * This file defines or manipulates the binary/schema format of the SUTO .cfgf configuration packages.
 * Any change to naming conventions, key casing, password encryption, hashing algorithms, or database
 * schemas MUST be thoroughly tested. Mismatches will corrupt or reject configuration files on SUTO devices.
 */

/**
 * Computes the SHA-512 hash of a file using standard Web Crypto API.
 * @param {File} file - The file to hash.
 * @returns {Promise<string>} The SHA-512 hash hex string.
 */
export async function calculateSHA512(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-512', new Uint8Array(arrayBuffer));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Parses the verification file content to extract the algorithm and expected hash.
 * @param {string} txtContent - The contents of the FV.txt file.
 * @returns {{ algorithm: string, expectedHash: string } | null}
 */
export function parseVerificationFile(txtContent) {
  const lines = txtContent.split(/\r?\n/);
  let algorithm = '';
  let expectedHash = '';

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('hash algorithm:')) {
      algorithm = line.split(':')[1]?.trim() || '';
    } else if (lowerLine.includes('file hash:')) {
      expectedHash = line.split(':')[1]?.trim() || '';
    }
  }

  return { algorithm, expectedHash };
}
