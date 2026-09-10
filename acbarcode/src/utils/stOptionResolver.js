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
 * Checks if an input option code matches a rule pattern.
 * Supports:
 * 1. Exact match: e.g. "A1410" matches "A1410"
 * 2. Positional wildcard using 'X' or '?': e.g. rule "A13X2" matches input "A1322", "A1302", etc.
 * 3. Multi-character wildcard using '*': e.g. rule "A13*" matches "A1322"
 * 4. Comma-separated rule codes: e.g. "A13X2, A14X2"
 */
export function matchesOptionRule(rulePattern, inputCode) {
  if (!rulePattern || !inputCode) return false;
  const patterns = String(rulePattern).split(/[,;\s]+/).map(p => p.trim().toUpperCase()).filter(Boolean);
  const input = String(inputCode).trim().toUpperCase();

  return patterns.some(pattern => {
    if (pattern === input) return true;

    // Positional wildcard using 'X' or '?'
    if (pattern.length === input.length && (pattern.includes('X') || pattern.includes('?'))) {
      for (let i = 0; i < pattern.length; i++) {
        const p = pattern[i];
        if (p !== 'X' && p !== '?' && p !== input[i]) {
          return false;
        }
      }
      return true;
    }

    // Multi-character wildcard using '*'
    if (pattern.includes('*')) {
      const regexStr = '^' + pattern.split('*').map(s => s.replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&').replace(/X/g, '.')).join('.*') + '$';
      try {
        return new RegExp(regexStr).test(input);
      } catch (e) {
        return false;
      }
    }

    return false;
  });
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
  if (!el.isPatched && (el.textType === 'product' || el.useProductMapping || el.isProductMode)) {
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
  // 3. Option Code Mapping Mode (supports exact codes and wildcards like A13X2)
  else if (!el.isPatched && (el.textType === 'option' || el.useOptionMapping || el.isOptionMode)) {
    const codesList = Array.isArray(activeOptions) 
      ? activeOptions.map(c => String(c).trim().toUpperCase())
      : parseOptionCodes(activeOptions);

    let matchedRule = null;
    if (Array.isArray(el.optionMappings)) {
      // Pass 1: exact match
      for (const rule of el.optionMappings) {
        if (!rule || !rule.code) continue;
        const targetCode = String(rule.code).trim().toUpperCase();
        if (codesList.includes(targetCode)) {
          matchedRule = rule;
          break;
        }
      }
      // Pass 2: wildcard match (e.g. A13X2 matches A1322, A15X1 matches A1501)
      if (!matchedRule) {
        for (const rule of el.optionMappings) {
          if (!rule || !rule.code) continue;
          if (codesList.some(c => matchesOptionRule(rule.code, c))) {
            matchedRule = rule;
            break;
          }
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

  const varMap = {
    serial: snVal,
    sn: snVal,
    origin: originVal,
    order: originVal,
    order_id: orderIdVal,
    orderid: orderIdVal,
    delivery_order: orderIdVal,
    dn: orderIdVal,
    categ: categVal,
    device_name: deviceName || categVal || product || '',
    devicename: deviceName || categVal || product || '',
    product: product || '',
    product_no: product || '',
    productno: product || '',
    item_no: product || '',
    itemno: product || '',
    options_text: Array.isArray(activeOptions) ? activeOptions.join(', ') : (activeOptions || ''),
    optionstext: Array.isArray(activeOptions) ? activeOptions.join(', ') : (activeOptions || ''),
    options: Array.isArray(activeOptions) ? activeOptions.join(', ') : (activeOptions || '')
  };

  if (extraObj) {
    for (const [k, v] of Object.entries(extraObj)) {
      if (v !== undefined && v !== null) {
        varMap[k.toLowerCase()] = String(v);
        varMap[k] = String(v);
      }
    }
  }

  // Matches: {{ varName }} or {{ varName | filter1:arg | filter2 }}
  const placeholderRegex = /\{\{\s*([^}|]+?)(?:\s*\|\s*([^}]+))?\s*\}\}/g;

  let resolved = rawText.replace(placeholderRegex, (match, rawKey, filterStr) => {
    const key = rawKey.trim();
    const val = varMap[key] !== undefined ? varMap[key] : varMap[key.toLowerCase()];
    if (val === undefined) {
      return match;
    }
    // If serial placeholder was kept as literal '{{serial}}', preserve placeholder
    if (val === '{{serial}}') {
      return match;
    }
    if (filterStr) {
      return applyFilter(val, filterStr.trim());
    }
    return val;
  });

  return resolved;
}

/**
 * Applies filter pipeline (e.g. "mid:3:2", "last:2", "nospace | mid:3:2") to a string value.
 * 
 * Supported filters:
 * - mid:start:length   -> 1-based substring (Excel MID style, e.g. "2826 8415" | mid:3:2 -> "26")
 * - substr:start:len   -> alias for mid
 * - last:N / right:N   -> last N characters (e.g. "2826 8415" | last:2 -> "15")
 * - first:N / left:N   -> first N characters (e.g. "2826 8415" | first:4 -> "2826")
 * - slice:start:end    -> 0-based JS slice (e.g. slice:2:4 -> "26", slice:-2 -> "15")
 * - nospace / strip    -> removes all whitespace
 * - trim               -> trims whitespace at start & end
 * - upper / uppercase  -> converts to uppercase
 * - lower / lowercase  -> converts to lowercase
 * - pad_left:len:char  -> pads string on left (e.g. pad_left:8:0)
 * - pad_right:len:char -> pads string on right
 */
export function applyFilter(value, filterStr) {
  if (value === undefined || value === null) return '';
  let str = String(value);
  if (!filterStr) return str;

  const filters = filterStr.split('|').map(f => f.trim()).filter(Boolean);
  for (const f of filters) {
    const parts = f.split(':').map(p => p.trim());
    const action = parts[0].toLowerCase();
    const arg1 = parts[1];
    const arg2 = parts[2];

    switch (action) {
      case 'mid':
      case 'substr': {
        // 1-based start position (Excel MID style)
        const start1 = arg1 !== undefined ? parseInt(arg1, 10) : 1;
        const start0 = Math.max(0, start1 - 1);
        if (arg2 !== undefined && arg2 !== '') {
          const len = parseInt(arg2, 10);
          str = str.substr(start0, len);
        } else {
          str = str.substr(start0);
        }
        break;
      }
      case 'last':
      case 'right': {
        const count = arg1 !== undefined ? parseInt(arg1, 10) : 2;
        str = str.slice(-count);
        break;
      }
      case 'first':
      case 'left': {
        const count = arg1 !== undefined ? parseInt(arg1, 10) : 2;
        str = str.slice(0, count);
        break;
      }
      case 'slice': {
        const s = arg1 !== undefined ? parseInt(arg1, 10) : 0;
        const e = arg2 !== undefined && arg2 !== '' ? parseInt(arg2, 10) : undefined;
        str = str.slice(s, e);
        break;
      }
      case 'nospace':
      case 'nospaces':
      case 'strip': {
        str = str.replace(/\s+/g, '');
        break;
      }
      case 'trim': {
        str = str.trim();
        break;
      }
      case 'upper':
      case 'uppercase': {
        str = str.toUpperCase();
        break;
      }
      case 'lower':
      case 'lowercase': {
        str = str.toLowerCase();
        break;
      }
      case 'pad_left':
      case 'padstart': {
        const targetLen = parseInt(arg1, 10) || str.length;
        const padChar = arg2 || '0';
        str = str.padStart(targetLen, padChar);
        break;
      }
      case 'pad_right':
      case 'padend': {
        const targetLen = parseInt(arg1, 10) || str.length;
        const padChar = arg2 || '0';
        str = str.padEnd(targetLen, padChar);
        break;
      }
      default:
        break;
    }
  }
  return str;
}
