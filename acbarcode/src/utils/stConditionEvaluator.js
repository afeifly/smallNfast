/**
 * stConditionEvaluator.js
 * Evaluates enable/display conditions for label elements and folders.
 * 
 * Supports syntax such as:
 *   - if {{Product Type}} == 'S695 4120'
 *   - {{product}} == 'S695 4120'
 *   - {{Product Type}} in 'S695 4120', 'S695 4121'
 *   - {{Product Type}} in ('S695 4120', 'S695 4121')
 *   - {{Product Type}} not in 'S695 4120', 'S695 4121'
 *   - {{options}} contains 'A1410'
 *   - {{options}} has 'A1410'
 *   - {{options}} matches 'A13*'
 *   - Compound: {{Product Type}} == 'S695 4120' AND {{options}} contains 'A1410'
 */

/**
 * Normalizes context keys and aliases to lower-case, un-spaced keys.
 */
export function buildNormalizedContext(context = {}) {
  const norm = {};
  if (!context || typeof context !== 'object') return norm;

  for (const [key, val] of Object.entries(context)) {
    if (val === undefined || val === null) continue;
    const cleanKey = String(key).trim().toLowerCase().replace(/[\s_-]+/g, '');
    norm[cleanKey] = val;
  }

  // Common aliases
  const productVal = norm['product'] || norm['producttype'] || norm['itemno'] || norm['productno'] || '';
  norm['product'] = productVal;
  norm['producttype'] = productVal;
  norm['itemno'] = productVal;
  norm['productno'] = productVal;

  const optionsVal = norm['options'] || norm['optionstext'] || norm['option'] || '';
  norm['options'] = optionsVal;
  norm['optionstext'] = optionsVal;

  const serialVal = norm['serial'] || norm['sn'] || '';
  norm['serial'] = serialVal;
  norm['sn'] = serialVal;

  const devVal = norm['devicename'] || norm['device'] || '';
  norm['devicename'] = devVal;
  norm['device'] = devVal;

  return norm;
}

/**
 * Extracts the variable name from {{varName}} or plain varName.
 */
function extractVarName(token) {
  const m = token.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  return m ? m[1].trim() : token.trim();
}

/**
 * Strips quotes around strings.
 */
function unquote(str) {
  const s = String(str || '').trim();
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Parses comma-separated items (e.g. "'S695 4120', 'S695 4121'" or "('A', 'B')")
 */
function parseListValues(rawListStr) {
  let cleaned = String(rawListStr || '').trim();
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = cleaned.slice(1, -1);
  } else if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    cleaned = cleaned.slice(1, -1);
  }

  return cleaned
    .split(',')
    .map(s => unquote(s.trim()))
    .filter(s => s.length > 0);
}

/**
 * Resolves value of a token (either a literal or a {{variable}} reference from normContext).
 */
function resolveTokenValue(token, normContext) {
  const trimmed = String(token || '').trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return unquote(trimmed);
  }

  const varName = extractVarName(trimmed);
  const cleanKey = varName.toLowerCase().replace(/[\s_-]+/g, '');
  if (normContext && cleanKey in normContext) {
    return normContext[cleanKey];
  }

  // If not in context and wasn't wrapped in {{}}, check if numeric
  if (!trimmed.startsWith('{{') && !isNaN(trimmed) && trimmed !== '') {
    return Number(trimmed);
  }

  return trimmed;
}

/**
 * Checks wildcard match (e.g. "A13*" or "S695*")
 */
function matchesWildcard(pattern, target) {
  if (!pattern || !target) return false;
  const p = String(pattern).trim().toUpperCase();
  const t = String(target).trim().toUpperCase();
  if (p === t) return true;

  if (p.includes('*') || p.includes('?')) {
    const regexStr = '^' + p
      .replace(/[-[\]{}()+.,\\^$|#\s]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.') + '$';
    try {
      return new RegExp(regexStr).test(t);
    } catch (e) {
      return false;
    }
  }
  return false;
}

/**
 * Evaluates a single comparison clause, e.g.
 * "{{Product Type}} == 'S695 4120'"
 * "{{Product Type}} in 'S695 4120', 'S695 4121'"
 * "{{options}} contains 'A1410'"
 */
function evaluateSingleClause(clause, normContext) {
  let str = String(clause || '').trim();
  if (!str) return true;

  // Strip leading 'if ' if user typed 'if {{Product Type}} == ...'
  if (str.toLowerCase().startsWith('if ')) {
    str = str.slice(3).trim();
  }

  // 1. NOT IN
  const notInIdx = str.search(/\bnot\s+in\b/i);
  if (notInIdx !== -1) {
    const leftToken = str.slice(0, notInIdx).trim();
    const rightToken = str.slice(notInIdx + 6).trim();
    const leftVal = String(resolveTokenValue(leftToken, normContext) || '').trim().toLowerCase();
    const list = parseListValues(rightToken).map(s => s.toLowerCase());
    return !list.includes(leftVal);
  }

  // 2. IN
  const inIdx = str.search(/\bin\b/i);
  if (inIdx !== -1) {
    const leftToken = str.slice(0, inIdx).trim();
    const rightToken = str.slice(inIdx + 2).trim();
    const leftVal = String(resolveTokenValue(leftToken, normContext) || '').trim().toLowerCase();
    const list = parseListValues(rightToken).map(s => s.toLowerCase());
    return list.includes(leftVal);
  }

  // 3. CONTAINS / HAS
  const containsMatch = str.match(/\b(contains|has)\b/i);
  if (containsMatch) {
    const opIdx = containsMatch.index;
    const opLen = containsMatch[0].length;
    const leftToken = str.slice(0, opIdx).trim();
    const rightToken = str.slice(opIdx + opLen).trim();
    const leftVal = resolveTokenValue(leftToken, normContext);
    const targetVal = unquote(rightToken).trim().toUpperCase();

    if (Array.isArray(leftVal)) {
      return leftVal.map(s => String(s).trim().toUpperCase()).includes(targetVal);
    }
    const leftStr = String(leftVal || '').toUpperCase();
    // Split by comma/space or check inclusion
    const codes = leftStr.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    if (codes.includes(targetVal)) return true;
    return leftStr.includes(targetVal);
  }

  // 4. MATCHES / LIKE
  const matchesMatch = str.match(/\b(matches|like)\b/i);
  if (matchesMatch) {
    const opIdx = matchesMatch.index;
    const opLen = matchesMatch[0].length;
    const leftToken = str.slice(0, opIdx).trim();
    const rightToken = str.slice(opIdx + opLen).trim();
    const leftVal = String(resolveTokenValue(leftToken, normContext) || '');
    const pattern = unquote(rightToken);
    return matchesWildcard(pattern, leftVal);
  }

  // 5. != or <>
  let opIdx = -1;
  let op = '';
  if (str.includes('!=')) {
    op = '!=';
    opIdx = str.indexOf('!=');
  } else if (str.includes('<>')) {
    op = '<>';
    opIdx = str.indexOf('<>');
  } else if (str.includes('==')) {
    op = '==';
    opIdx = str.indexOf('==');
  } else if (str.includes('=')) {
    op = '=';
    opIdx = str.indexOf('=');
  }

  if (opIdx !== -1) {
    const leftToken = str.slice(0, opIdx).trim();
    const rightToken = str.slice(opIdx + op.length).trim();
    const leftVal = String(resolveTokenValue(leftToken, normContext) || '').trim().toLowerCase();
    const rightVal = String(resolveTokenValue(rightToken, normContext) || '').trim().toLowerCase();

    if (op === '!=' || op === '<>') {
      return leftVal !== rightVal;
    }
    return leftVal === rightVal;
  }

  // If clause is just a boolean or variable name (e.g. {{is_sample}})
  const val = resolveTokenValue(str, normContext);
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s !== '' && s !== 'false' && s !== '0' && s !== 'null' && s !== 'undefined';
  }
  return Boolean(val);
}

/**
 * Evaluates a condition string against a given context.
 * Supports:
 *   - Empty/blank condition -> true (always enabled)
 *   - AND / OR combinations (AND takes higher precedence)
 * 
 * @param {string} conditionStr - Expression string, e.g. "{{Product Type}} in 'S695 4120', 'S695 4121'"
 * @param {Object} context - Execution context { product, options, serial, deviceName, ...extra }
 * @returns {boolean}
 */
export function evaluateCondition(conditionStr, context = {}) {
  if (!conditionStr || typeof conditionStr !== 'string') {
    return true;
  }

  const raw = conditionStr.trim();
  if (!raw) return true;

  const normContext = buildNormalizedContext(context);

  // Split by OR / || first
  const orClauses = raw.split(/\bOR\b|\|\|/i);

  return orClauses.some(orPart => {
    // Within each OR group, split by AND / &&
    const andClauses = orPart.split(/\bAND\b|&&/i);
    return andClauses.every(andPart => evaluateSingleClause(andPart, normContext));
  });
}

/**
 * Checks if a specific element is enabled, taking into account:
 * 1. Element's own `enableCondition`
 * 2. Parent folder's `enableCondition` (if inside a folder)
 * 
 * @param {Object} el - Element definition
 * @param {Object} context - Context containing { product, options, serial, deviceName, extra }
 * @param {Array} [allElements] - Full list of elements to lookup parent folder if el.folderId is set
 * @returns {boolean}
 */
export function isElementEnabled(el, context = {}, allElements = []) {
  if (!el) return true;

  // 1. Check element's own condition
  if (el.enableCondition) {
    const enabled = evaluateCondition(el.enableCondition, context);
    if (!enabled) return false;
  }

  // 2. Check parent folder condition
  if (el.folderId && Array.isArray(allElements)) {
    const folder = allElements.find(f => f.id === el.folderId && f.type === 'folder');
    if (folder && folder.enableCondition) {
      const folderEnabled = evaluateCondition(folder.enableCondition, context);
      if (!folderEnabled) return false;
    }
  }

  return true;
}
