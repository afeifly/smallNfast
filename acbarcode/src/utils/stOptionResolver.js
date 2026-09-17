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
  const input = String(inputCode).trim().toUpperCase();

  // Split on commas, semicolons, or newlines first (preserves spaces inside product codes like "S695 4120")
  let patterns = String(rulePattern).split(/[,;\n]+/).map(p => p.trim().toUpperCase()).filter(Boolean);

  // If no comma/semicolon was used, and pattern has spaces but input doesn't match directly, try space split
  if (patterns.length === 1 && patterns[0] !== input && !input.startsWith(patterns[0])) {
    const spaceParts = patterns[0].split(/\s+/).filter(Boolean);
    if (spaceParts.length > 1 && !spaceParts.some(p => input.includes(p))) {
      patterns = spaceParts;
    }
  }

  return patterns.some(pattern => {
    if (pattern === input) return true;

    // Also support prefix/substring match for products (e.g. input "S695 4035 (Air)" matches rule "S695 4035")
    if (pattern && input.startsWith(pattern)) return true;

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
 * Evaluates template-level Mid-Variables (Product-to-Value or Option-to-Value rules).
 * Example midVar:
 * {
 *   name: 'sensorName',
 *   source: 'prod', // 'prod' | 'opt'
 *   defaultValue: 'S401',
 *   rules: [
 *     { match: 'S695 4120, S695 4121', value: 'S421' },
 *     { match: 'S695 4035*', value: 'S403' }
 *   ]
 * }
 */
export function evaluateMidVariables(midVariables = [], ctx = {}) {
  const result = {};
  if (!Array.isArray(midVariables) || midVariables.length === 0) return result;

  const prodVal = String(ctx.prod || ctx.product || ctx.item_no || '').trim();
  const optVal = ctx.opt || ctx.options || ctx.options_text || '';
  const optList = Array.isArray(optVal)
    ? optVal.map(c => String(c).trim().toUpperCase())
    : parseOptionCodes(optVal);

  for (const midVar of midVariables) {
    if (!midVar || !midVar.name) continue;
    const cleanName = String(midVar.name).replace(/^\{+|\}+$/g, '').trim();
    if (!cleanName) continue;

    const source = (midVar.source || 'prod').toLowerCase();
    let matchedVal = null;

    const rules = Array.isArray(midVar.rules) ? midVar.rules : [];
    for (const rule of rules) {
      if (!rule || rule.match === undefined) continue;
      const pattern = String(rule.match).trim();
      if (!pattern) continue;

      if (source === 'opt' || source === 'options') {
        if (optList.some(code => matchesOptionRule(pattern, code))) {
          matchedVal = rule.value !== undefined ? String(rule.value) : '';
          break;
        }
      } else {
        if (matchesOptionRule(pattern, prodVal)) {
          matchedVal = rule.value !== undefined ? String(rule.value) : '';
          break;
        }
      }
    }

    const finalVal = (matchedVal !== null)
      ? matchedVal
      : (midVar.defaultValue !== undefined ? String(midVar.defaultValue) : '');

    result[cleanName] = finalVal;
    result[cleanName.toLowerCase()] = finalVal;
    result[`{{${cleanName}}}`] = finalVal;
    result[`{{${cleanName.toLowerCase()}}}`] = finalVal;
  }

  return result;
}

/**
 * Formats a date string (e.g. "2026-07-07 03:59:23", "2026-07-07T03:59:23Z", timestamp, Date)
 * into a custom format string (e.g. "YYYY-MM", "YYYY年MM月", "YYYY-MM-DD", "YYYY.MM", "YY-MM", etc.).
 */
export function formatDate(dateInput, pattern = 'YYYY-MM') {
  if (!dateInput) return '';

  let d;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'number') {
    d = new Date(dateInput);
  } else if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (/^\d+$/.test(trimmed)) {
      d = new Date(parseInt(trimmed, 10));
    } else {
      d = new Date(trimmed.replace(' ', 'T'));
      if (isNaN(d.getTime())) {
        d = new Date(trimmed);
      }
    }
  } else {
    d = new Date();
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const YYYY = String(d.getFullYear());
  const YY = YYYY.slice(-2);
  const M = d.getMonth() + 1;
  const MM = String(M).padStart(2, '0');
  const D = d.getDate();
  const DD = String(D).padStart(2, '0');

  const fmt = pattern || 'YYYY-MM';

  return fmt
    .replace(/YYYY/g, YYYY)
    .replace(/YY/g, YY)
    .replace(/MM/g, MM)
    .replace(/DD/g, DD)
    .replace(/(?<!M)M(?!M)/g, String(M))
    .replace(/(?<!D)D(?!D)/g, String(D));
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
  let opts = activeOptions;
  let sn = serial;
  let prod = product;
  let devName = deviceName;
  let extraObj = (extra && typeof extra === 'object') ? { ...extra } : {};

  if (activeOptions && typeof activeOptions === 'object' && !Array.isArray(activeOptions)) {
    opts = activeOptions.options || activeOptions.opt || [];
    sn = activeOptions.serial || activeOptions.sn || serial;
    prod = activeOptions.product || activeOptions.prod || product;
    devName = activeOptions.deviceName || activeOptions.device_name || deviceName;
    extraObj = { ...activeOptions, ...extraObj };
  }

  const originVal = extraObj.origin || extraObj.order || '';
  const orderIdVal = extraObj.order_id || extraObj.orderId || extraObj.delivery_order || extraObj.dn || '';
  const categVal = extraObj.categ || devName || '';
  const rawDoneDate = extraObj.done_date || extraObj.doneDate || extraObj.date || '';

  // Replace placeholders. Preserve {{serial}} when no serial value is supplied
  // so downstream compilers can inject their own serial command (^C00 / ^F00).
  const snVal = (sn !== undefined && sn !== '') ? sn : '{{serial}}';

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
    device_name: devName || categVal || prod || '',
    devicename: devName || categVal || prod || '',
    product: prod || '',
    prod: prod || '',
    product_no: prod || '',
    productno: prod || '',
    item_no: prod || '',
    itemno: prod || '',
    done_date: rawDoneDate,
    donedate: rawDoneDate,
    date: rawDoneDate,
    options_text: Array.isArray(opts) ? opts.join(', ') : (opts || ''),
    optionstext: Array.isArray(opts) ? opts.join(', ') : (opts || ''),
    options: Array.isArray(opts) ? opts.join(', ') : (opts || ''),
    opt: Array.isArray(opts) ? opts.join(', ') : (opts || '')
  };

  if (extraObj) {
    const midVars = extraObj.midVariables || extraObj.mid_variables || extraObj.template?.midVariables || extraObj.activeTemplate?.midVariables;
    if (Array.isArray(midVars) && midVars.length > 0) {
      const evaluated = evaluateMidVariables(midVars, {
        prod,
        product: prod,
        opt: opts,
        options: opts,
        serial: snVal,
        ...extraObj
      });
      for (const [k, v] of Object.entries(evaluated)) {
        const cleanK = k.replace(/^\{+|\}+$/g, '').trim();
        varMap[cleanK.toLowerCase()] = String(v);
        varMap[cleanK] = String(v);
        varMap[k.toLowerCase()] = String(v);
        varMap[k] = String(v);
      }
    }

    const customVars = extraObj.customVariables || extraObj.customVars;
    if (customVars && typeof customVars === 'object') {
      for (const [k, v] of Object.entries(customVars)) {
        if (v !== undefined && v !== null) {
          const cleanK = k.replace(/^\{+|\}+$/g, '').trim();
          varMap[cleanK.toLowerCase()] = String(v);
          varMap[cleanK] = String(v);
          varMap[k.toLowerCase()] = String(v);
          varMap[k] = String(v);
        }
      }
    }

    for (const [k, v] of Object.entries(extraObj)) {
      if (v !== undefined && v !== null && typeof v !== 'object') {
        const cleanK = k.replace(/^\{+|\}+$/g, '').trim();
        varMap[cleanK.toLowerCase()] = String(v);
        varMap[cleanK] = String(v);
        varMap[k.toLowerCase()] = String(v);
        varMap[k] = String(v);
      }
    }
  }

  const replacePlaceholders = (text) => {
    if (!text || typeof text !== 'string') return text;
    const trimmed = text.trim();
    const cleanTrimmed = trimmed.replace(/^\{+|\}+$/g, '').trim();

    // If entire text itself is a variable name without {{}} (e.g. user typed "sensorName")
    if (!text.includes('{{')) {
      if (varMap[trimmed] !== undefined && varMap[trimmed] !== '') {
        return varMap[trimmed];
      }
      if (varMap[trimmed.toLowerCase()] !== undefined && varMap[trimmed.toLowerCase()] !== '') {
        return varMap[trimmed.toLowerCase()];
      }
      if (varMap[cleanTrimmed] !== undefined && varMap[cleanTrimmed] !== '') {
        return varMap[cleanTrimmed];
      }
      if (varMap[cleanTrimmed.toLowerCase()] !== undefined && varMap[cleanTrimmed.toLowerCase()] !== '') {
        return varMap[cleanTrimmed.toLowerCase()];
      }
      return text;
    }

    const placeholderRegex = /\{\{\s*([^}|]+?)(?:\s*\|\s*([^}]+))?\s*\}\}/g;
    return text.replace(placeholderRegex, (match, rawKey, filterStr) => {
      const key = rawKey.trim();
      const cleanKey = key.replace(/^\{+|\}+$/g, '').trim();
      let val = varMap[key] !== undefined ? varMap[key] : varMap[key.toLowerCase()];
      if (val === undefined) {
        val = varMap[cleanKey] !== undefined ? varMap[cleanKey] : varMap[cleanKey.toLowerCase()];
      }
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
  };

  // 1. SUTO Protocol QR Code Mode (supports {{sensorName}}, {{device_name}}, etc.)
  if (el.type === 'qrcode' && (el.qrMode === 'suto_protocol' || el.isSutoProtocol)) {
    let pType = el.sutoProductType !== undefined && el.sutoProductType !== '' ? el.sutoProductType : '{{device_name}}';
    pType = replacePlaceholders(pType).trim();
    if (varMap[pType] !== undefined && varMap[pType] !== '') {
      pType = varMap[pType];
    } else if (varMap[pType.toLowerCase()] !== undefined && varMap[pType.toLowerCase()] !== '') {
      pType = varMap[pType.toLowerCase()];
    }
    if (!pType || pType === '{{device_name}}' || pType === '{{product}}') {
      pType = categVal || devName || (prod ? prod.split(' ')[0] : 'S4C-APP');
    }
    const currentSn = (snVal !== undefined && snVal !== '' && snVal !== '{{serial}}') ? snVal : '12345678';
    let prefix = el.sutoPrefix || 'sensor';
    prefix = replacePlaceholders(prefix).trim();
    if (varMap[prefix] !== undefined && varMap[prefix] !== '') {
      prefix = varMap[prefix];
    } else if (varMap[prefix.toLowerCase()] !== undefined && varMap[prefix.toLowerCase()] !== '') {
      prefix = varMap[prefix.toLowerCase()];
    }
    return generateSensorQr(pType, currentSn, prefix);
  }

  let rawText = el.text || el.data || '';

  // 2. Product Type Mapping Mode
  if (!el.isPatched && (el.textType === 'product' || el.useProductMapping || el.isProductMode)) {
    const targetProd = String(prod || '').trim().toUpperCase();
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
    const codesList = Array.isArray(opts) 
      ? opts.map(c => String(c).trim().toUpperCase())
      : parseOptionCodes(opts);

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
  // 4. Date Mode (e.g. YYYY-MM, YYYY年MM月 from done_date payload)
  else if (!el.isPatched && (el.textType === 'date' || el.isDateMode)) {
    const dateVal = extraObj.done_date || extraObj.doneDate || extraObj.date || el.done_date || el.testDate || '';
    const pattern = el.dateFormat || el.text || 'YYYY-MM';
    rawText = dateVal ? formatDate(dateVal, pattern) : formatDate(new Date(), pattern);
  }

  return replacePlaceholders(rawText);
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
      case 'date':
      case 'format_date':
      case 'format': {
        const pattern = arg1 || 'YYYY-MM';
        str = formatDate(str, pattern);
        break;
      }
      default:
        break;
    }
  }
  return str;
}
