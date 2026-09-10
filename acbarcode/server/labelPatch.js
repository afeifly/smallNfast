/**
 * labelPatch.js
 *
 * Utilities for the "label patch" feature.
 *
 * A patch is defined directly on an element object in a template:
 *   element.patchName = "addr"   ← designer sets this in the design UI
 *
 * Patches are GLOBAL – a single name like "addr" can appear on any template.
 * When a designer assigns a patchName to a text element, that element becomes
 * patchable: the operator can supply a new text value that replaces the
 * element's resolved text at generation time.
 *
 * API surface
 * ───────────
 *  extractAvailablePatches(elements)  – returns the patch list for a template
 *  applyPatchesToElements(elements, patches)  – returns patched element copies
 *  validatePatchPayload(req)  – validates an incoming POST /st_label_patch body
 */

/**
 * Walk a (possibly nested) elements array and collect every element that
 * carries a non-empty `patchName` string.  Returns a deduplicated list:
 *   [{ patchName: "addr", title: "addr" }, ...]
 *
 * Deduplication is by patchName – if two elements share the same patchName
 * the patch appears only once in the list.
 *
 * @param {Array} elements - Flat or nested element array from a template.
 * @returns {Array<{ patchName: string, title: string }>}
 */
function extractAvailablePatches(elements) {
  if (!Array.isArray(elements)) return [];

  const seen = new Set();
  const patches = [];

  function walk(elems) {
    for (const el of elems) {
      if (!el || typeof el !== 'object') continue;

      const name = (el.patchName && typeof el.patchName === 'string')
        ? el.patchName.trim()
        : '';
      if (name && !seen.has(name)) {
        seen.add(name);
        patches.push({
          patchName: name,
          title: el.patchTitle || name   // designer can also set a human-readable title
        });
      }

      // Recurse into children / sub-elements if they exist
      if (Array.isArray(el.children)) walk(el.children);
      if (Array.isArray(el.elements)) walk(el.elements);
    }
  }

  walk(elements);
  return patches;
}

/**
 * Return a deep copy of `elements` with patch overrides applied.
 *
 * For every element whose `patchName` appears in the `patches` map the
 * element's text property is replaced with the supplied value, and the
 * element's textType / special modes are cleared so the override is not
 * re-processed by resolveElementText.
 *
 * @param {Array}  elements - Original element array (not mutated).
 * @param {Object} patches  - Map of { [patchName]: newValue }.
 * @returns {Array} Patched copies of the elements.
 */
function applyPatchesToElements(elements, patches) {
  if (!Array.isArray(elements) || !patches || typeof patches !== 'object') {
    return elements;
  }

  return elements.map(el => {
    if (!el || typeof el !== 'object') return el;

    const copy = { ...el };

    // Apply patch override if this element has a patchName in the patches map
    const name = (copy.patchName && typeof copy.patchName === 'string')
      ? copy.patchName.trim()
      : '';

    if (name && Object.prototype.hasOwnProperty.call(patches, name)) {
      const newValue = String(patches[name]);
      copy.text = newValue;
      copy.data = newValue;
      copy.defaultText = newValue;

      // Disable special resolution modes so the patch text is used as-is
      copy.textType = 'normal';
      copy.useProductMapping = false;
      copy.isProductMode = false;
      copy.useOptionMapping = false;
      copy.isOptionMode = false;
      copy.useDefaultText = true;
      copy.optionMappings = [];
      copy.productMappings = [];
      copy.isPatched = true;
    }

    // Recurse into children
    if (Array.isArray(copy.children)) {
      copy.children = applyPatchesToElements(copy.children, patches);
    }
    if (Array.isArray(copy.elements)) {
      copy.elements = applyPatchesToElements(copy.elements, patches);
    }

    return copy;
  });
}

/**
 * Validate an incoming POST /st_label_patch request body.
 *
 * Expected shape:
 *   {
 *     serial:  string   (required, single SN)
 *     product: string   (required, used to look up the template)
 *     patches: object   (required, { [patchName]: newValue }, at least one key)
 *     options?: string | string[]
 *     lang?:   string
 *   }
 *
 * Returns { valid: true } or { valid: false, error: string }.
 */
function validatePatchPayload(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }

  const { serial, product, patches } = body;

  if (!serial || typeof serial !== 'string' || !serial.trim()) {
    return { valid: false, error: 'Missing required field: serial (single serial number string).' };
  }

  if (!product || typeof product !== 'string' || !product.trim()) {
    return { valid: false, error: 'Missing required field: product.' };
  }

  if (!patches || typeof patches !== 'object' || Array.isArray(patches)) {
    return { valid: false, error: 'Missing required field: patches (must be an object { patchName: newValue }).' };
  }

  if (Object.keys(patches).length === 0) {
    return { valid: false, error: 'patches object must contain at least one entry.' };
  }

  // Ensure every value is a string (or coerceable)
  for (const [k, v] of Object.entries(patches)) {
    if (v === null || v === undefined || typeof v === 'object') {
      return { valid: false, error: `Patch value for "${k}" must be a string.` };
    }
  }

  return { valid: true };
}

module.exports = {
  extractAvailablePatches,
  applyPatchesToElements,
  validatePatchPayload
};
