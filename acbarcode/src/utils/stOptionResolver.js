import { generateSensorQr } from './stSutoProtocol.js';

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
 * Resolves text or QR content for an element, taking into account option code translation
 * rules or SUTO Protocol QR code generation if enabled.
 * 
 * @param {Object} el - Element configuration object
 * @param {Array<string>|string} activeOptions - Active option codes list or string
 * @param {string} serial - Serial number for {{serial}} replacement
 * @param {string} product - Product name for {{product}} replacement
 * @returns {string} Evaluated text or QR value
 */
export function resolveElementText(el, activeOptions = [], serial = '', product = '', deviceName = '', extra = {}) {
  const extraObj = (extra && typeof extra === 'object') ? extra : {};
  const originVal = extraObj.origin || extraObj.order || '';
  const categVal = extraObj.categ || deviceName || '';

  // 1. SUTO Protocol QR Code Mode
  if (el.type === 'qrcode' && (el.qrMode === 'suto_protocol' || el.isSutoProtocol)) {
    let pType = el.sutoProductType || '{{device_name}}';
    const effectiveDevice = categVal || deviceName || product || 'S4C-APP';
    pType = pType
      .replace(/\{\{device_name\}\}/g, effectiveDevice)
      .replace(/\{\{categ\}\}/g, effectiveDevice)
      .replace(/\{\{origin\}\}/g, originVal)
      .replace(/\{\{order\}\}/g, originVal)
      .replace(/\{\{product\}\}/g, product || effectiveDevice || 'S4C-APP')
      .replace(/\{\{product_no\}\}/g, product || effectiveDevice || 'S4C-APP')
      .replace(/\{\{item_no\}\}/g, product || effectiveDevice || 'S4C-APP')
      .replace(/\{\{itemNo\}\}/g, product || effectiveDevice || 'S4C-APP')
      .trim();

    if (!pType || pType === '{{device_name}}' || pType === '{{product}}') {
      pType = effectiveDevice || (product ? product.split(' ')[0] : 'S4C-APP');
    }
    const sn = (serial !== undefined && serial !== '') ? serial : '12345678';
    let prefix = el.sutoPrefix || 'sensor';
    if (originVal) {
      prefix = prefix.replace(/\{\{origin\}\}/g, originVal).replace(/\{\{order\}\}/g, originVal);
    }
    return generateSensorQr(pType, sn, prefix);
  }

  // 2. Option Code Mapping Mode
  const codesList = Array.isArray(activeOptions) 
    ? activeOptions.map(c => String(c).trim().toUpperCase())
    : parseOptionCodes(activeOptions);

  let rawText = el.text || el.data || '';

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
    } else if (el.useDefaultText === false) {
      // Required option (no fallback): show nothing when no code matches.
      rawText = '';
    } else if (el.defaultText !== undefined && el.defaultText !== '') {
      rawText = el.defaultText;
    } else {
      rawText = '';
    }
  }

  // Replace placeholders. Preserve {{serial}} when no serial value is supplied
  // so downstream compilers can inject their own serial command (^C00 / ^F00).
  const snVal = (serial !== undefined && serial !== '') ? serial : '{{serial}}';
  return rawText
    .replace(/\{\{serial\}\}/g, snVal)
    .replace(/\{\{sn\}\}/g, snVal)
    .replace(/\{\{origin\}\}/g, originVal)
    .replace(/\{\{order\}\}/g, originVal)
    .replace(/\{\{categ\}\}/g, categVal)
    .replace(/\{\{device_name\}\}/g, deviceName || categVal || product || '')
    .replace(/\{\{product\}\}/g, product || '')
    .replace(/\{\{product_no\}\}/g, product || '')
    .replace(/\{\{item_no\}\}/g, product || '')
    .replace(/\{\{itemNo\}\}/g, product || '')
    .replace(/\{\{options\}\}/g, Array.isArray(activeOptions) ? activeOptions.join(', ') : (activeOptions || ''));
}
