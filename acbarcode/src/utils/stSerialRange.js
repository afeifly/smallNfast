/**
 * Parses start and end serial numbers and generates an array of serial numbers.
 * Handles numeric formats, padded zeros, space separators, and prefixed strings.
 *
 * @param {string} startStr - Starting serial number (e.g. "12345678" or "3726 0001")
 * @param {string} endStr - Ending serial number (e.g. "12345680" or "3726 0003")
 * @returns {Array<string>} Array of serial number strings in range
 */
export function generateSerialRange(startStr = '', endStr = '') {
  const cleanStart = String(startStr || '').trim();
  const cleanEnd = String(endStr || '').trim();

  if (!cleanStart) return ['3726 0001'];
  if (!cleanEnd || cleanStart === cleanEnd) return [cleanStart];

  // Helper to extract prefix and trailing number
  function parseSN(sn) {
    // Match trailing digits (e.g. "3726 0001" -> prefix "3726 ", digits "0001")
    const m = sn.match(/^(.*?)(\d+)$/);
    if (!m) return null;
    return {
      prefix: m[1],
      digitsStr: m[2],
      val: parseInt(m[2], 10),
      padLen: m[2].length
    };
  }

  const pStart = parseSN(cleanStart);
  const pEnd = parseSN(cleanEnd);

  // If format doesn't have trailing digits or prefixes don't match
  if (!pStart || !pEnd) {
    return [cleanStart];
  }

  // If prefixes match (e.g. both have "3726 " or both empty)
  let prefix = pStart.prefix;
  let startNum = pStart.val;
  let endNum = pEnd.val;
  let padLen = pStart.padLen;

  // Handles case where endStr is just number (e.g. start: "3726 0001", end: "0003")
  if (pStart.prefix && !pEnd.prefix) {
    prefix = pStart.prefix;
  } else if (pStart.prefix !== pEnd.prefix) {
    return [cleanStart];
  }

  if (endNum < startNum) {
    return [cleanStart];
  }

  // Limit max range size to prevent browser crash
  const count = endNum - startNum + 1;
  if (count > 1000) {
    console.warn(`Serial range too large (${count}). Capping at 1000 labels.`);
    endNum = startNum + 999;
  }

  const range = [];
  for (let i = startNum; i <= endNum; i++) {
    const padded = String(i).padStart(padLen, '0');
    range.push(`${prefix}${padded}`);
  }

  return range;
}
