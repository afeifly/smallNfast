/**
 * Helper to parse comma/space separated options input string into an array of normalized option codes.
 * e.g. "A1410, A1411" -> ["A1410", "A1411"]
 */
export function parseOptionCodes(optionsStr = '') {
  if (!optionsStr || typeof optionsStr !== 'string') return [];
  return optionsStr
    .split(/[,;\s]+/)
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Resolves text for an element, taking into account option code translation rules if enabled.
 * 
 * @param {Object} el - Element configuration object
 * @param {Array<string>|string} activeOptions - Active option codes list or string
 * @param {string} serial - Serial number for {{serial}} replacement
 * @param {string} product - Product name for {{product}} replacement
 * @returns {string} Evaluated text value
 */
export function resolveElementText(el, activeOptions = [], serial = '', product = '') {
  const codesList = Array.isArray(activeOptions) 
    ? activeOptions.map(c => String(c).trim().toUpperCase())
    : parseOptionCodes(activeOptions);

  let rawText = el.text || el.data || '';

  // If option mapping mode is enabled for this element
  if (el.useOptionMapping || el.isOptionMode) {
    let matchedRule = null;
    if (Array.isArray(el.optionMappings)) {
      for (const rule of el.optionMappings) {
        if (!rule || !rule.code) continue;
        const targetCode = String(rule.code).trim().toUpperCase();
        if (codesList.includes(targetCode)) {
          matchedRule = rule;
          break; // Match first matching option code rule
        }
      }
    }

    if (matchedRule && matchedRule.text !== undefined) {
      rawText = matchedRule.text;
    } else if (el.defaultText !== undefined && el.defaultText !== '') {
      rawText = el.defaultText;
    } else {
      rawText = '';
    }
  }

  // Replace placeholders. Preserve {{serial}} when no serial value is supplied
  // so downstream compilers can inject their own serial command (^C00 / ^F00).
  return rawText
    .replace(/\{\{serial\}\}/g, (serial !== undefined && serial !== '') ? serial : '{{serial}}')
    .replace(/\{\{product\}\}/g, product || '')
    .replace(/\{\{product_no\}\}/g, product || '')
    .replace(/\{\{options\}\}/g, Array.isArray(activeOptions) ? activeOptions.join(', ') : (activeOptions || ''));
}
