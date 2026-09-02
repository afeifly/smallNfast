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
  const orderIdVal = extraObj.order_id || extraObj.orderId || extraObj.delivery_order || extraObj.dn || '';
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
      .replace(/\{\{order_id\}\}/g, orderIdVal)
      .replace(/\{\{orderId\}\}/g, orderIdVal)
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
    if (originVal || orderIdVal) {
      prefix = prefix
        .replace(/\{\{origin\}\}/g, originVal)
        .replace(/\{\{order\}\}/g, originVal)
        .replace(/\{\{order_id\}\}/g, orderIdVal)
        .replace(/\{\{orderId\}\}/g, orderIdVal);
    }
    return generateSensorQr(pType, sn, prefix);
  }

  let rawText = el.text || el.data || '';

  // 2. Product Type Mapping Mode
  if (el.textType === 'product' || el.useProductMapping || el.isProductMode) {
    const targetProd = String(product || '').trim().toUpperCase();
    let matchedRule = null;
    if (Array.isArray(el.productMappings)) {
      // Pass 1: exact match
      matchedRule = el.productMappings.find(r => {
        if (!r) return false;
        const p = String(r.product || r.code || '').trim().toUpperCase();
        return p && p === targetProd;
      });
      // Pass 2: substring / contains match if exact not found
      if (!matchedRule && targetProd) {
        matchedRule = el.productMappings.find(r => {
          if (!r) return false;
          const p = String(r.product || r.code || '').trim().toUpperCase();
          return p && (targetProd.includes(p) || p.includes(targetProd));
        });
      }
    }

    if (matchedRule && matchedRule.text !== undefined) {
      rawText = matchedRule.text;
    } else if (el.useDefaultText === false) {
      // Required product (no fallback): show nothing when no product matches.
      rawText = '';
    } else if (el.defaultText !== undefined && el.defaultText !== '') {
      rawText = el.defaultText;
    } else {
      rawText = '';
    }
  }
  // 3. Option Code Mapping Mode
  else if (el.textType === 'option' || el.useOptionMapping || el.isOptionMode) {
    const codesList = Array.isArray(activeOptions) 
      ? activeOptions.map(c => String(c).trim().toUpperCase())
      : parseOptionCodes(activeOptions);

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
  let resolved = rawText
    .replace(/\{\{serial\}\}/g, snVal)
    .replace(/\{\{sn\}\}/g, snVal)
    .replace(/\{\{origin\}\}/g, originVal)
    .replace(/\{\{order\}\}/g, originVal)
    .replace(/\{\{order_id\}\}/g, orderIdVal)
    .replace(/\{\{orderId\}\}/g, orderIdVal)
    .replace(/\{\{categ\}\}/g, categVal)
    .replace(/\{\{device_name\}\}/g, deviceName || categVal || product || '')
    .replace(/\{\{product\}\}/g, product || '')
    .replace(/\{\{product_no\}\}/g, product || '')
    .replace(/\{\{item_no\}\}/g, product || '')
    .replace(/\{\{itemNo\}\}/g, product || '')
    .replace(/\{\{options_text\}\}/g, Array.isArray(activeOptions) ? activeOptions.join(', ') : (activeOptions || ''))
    .replace(/\{\{optionsText\}\}/g, Array.isArray(activeOptions) ? activeOptions.join(', ') : (activeOptions || ''))
    .replace(/\{\{options\}\}/g, Array.isArray(activeOptions) ? activeOptions.join(', ') : (activeOptions || ''));

  for (const [key, value] of Object.entries(extraObj)) {
    if (value !== undefined && value !== null) {
      const reg = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      resolved = resolved.replace(reg, String(value));
    }
  }

  return resolved;
}
