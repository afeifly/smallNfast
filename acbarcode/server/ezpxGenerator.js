/**
 * Server-side EZPX generator module supporting product itemNumber template matching & placeholders.
 */

const templateStore = require('./templateStore');
const { extractAvailablePatches, applyPatchesToElements } = require('./labelPatch');

/**
 * Returns elements array for the requested language ('cn' or 'en'), with fallback.
 */
function getTemplateElements(tpl, lang = 'en') {
  if (!tpl) return [];
  const normalizedLang = (typeof lang === 'string' && (lang.toLowerCase() === 'cn' || lang.toLowerCase().startsWith('zh'))) ? 'cn' : 'en';

  if (normalizedLang === 'cn') {
    if (Array.isArray(tpl.elements_cn) && tpl.elements_cn.length > 0) {
      return tpl.elements_cn;
    }
    if (Array.isArray(tpl.elements_en) && tpl.elements_en.length > 0) {
      return tpl.elements_en;
    }
  } else {
    // Default 'en'
    if (Array.isArray(tpl.elements_en) && tpl.elements_en.length > 0) {
      return tpl.elements_en;
    }
    if (Array.isArray(tpl.elements_cn) && tpl.elements_cn.length > 0) {
      return tpl.elements_cn;
    }
  }

  if (Array.isArray(tpl.elements) && tpl.elements.length > 0) {
    return tpl.elements;
  }
  return [];
}

function getTemplateConfig(tpl, lang = 'en') {
  const base = (tpl && tpl.config && typeof tpl.config === 'object')
    ? tpl.config
    : { widthMm: 35, heightMm: 22, dpi: 300 };
  const isCn = typeof lang === 'string' && (lang.toLowerCase() === 'cn' || lang.toLowerCase().startsWith('zh'));
  const effectiveDpi = isCn
    ? (base.dpi_cn || base.dpi || 300)
    : (base.dpi_en || base.dpi || 300);
  return { ...base, dpi: effectiveDpi };
}

async function generateStEzpxXml(product, serialNumbers = [], options = [], templateXml = null, lang = 'en', targetTemplate = null, origin = '', order_id = '', done_date = '') {
  const { compileEZPXRange, buildSerialCsv } = await import('../src/utils/stEzpxCompiler.js');
  const { parseEzpxXmlToTemplate } = await import('../src/utils/stEzpxParser.js');
  const { matchTemplateByItemNo } = await import('../src/utils/stTemplateManager.js');

  const serials = (Array.isArray(serialNumbers) && serialNumbers.length > 0)
    ? serialNumbers.map(s => String(s).trim())
    : ['12345678'];

  const productName = String(product || 'S695 4120').trim();

  // Build label definitions: { filename, elements, config }.
  // A posted template_xml produces a single label; a matched stored template
  // produces the main label plus one label per sub-template (all sharing the
  // same product / options / serial data, different designs & sizes).
  const defs = [];

  const sanitize = (str, fallback) => {
    const s = String(str || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    return s || fallback;
  };

  // 1. If EZPX XML text content was posted directly
  if (templateXml && typeof templateXml === 'string' && templateXml.trim()) {
    try {
      const parsed = parseEzpxXmlToTemplate(templateXml.trim(), 'Posted EZPX Template');
      const parsedElements = getTemplateElements(parsed, lang);
      if (parsed && parsedElements.length > 0) {
        const mainBase = sanitize(parsed.name || productName, 'template');
        defs.push({
          filename: `${mainBase}_main_label.ezpx.tmp`,
          elements: parsedElements,
          config: parsed.config || { widthMm: 35, heightMm: 22, dpi: 203 }
        });
      }
    } catch (e) {
      console.warn('Failed to parse posted templateXml:', e);
    }
  }

  // 2. Otherwise match product against stored templates (SQLite) or use provided targetTemplate
  let matchedDeviceName = '';
  if (defs.length === 0) {
    let matched = targetTemplate;
    if (!matched) {
      const storedTemplates = templateStore.getAllTemplates();
      matched = matchTemplateByItemNo(storedTemplates, productName);
    }
    if (matched) {
      matchedDeviceName = matched.deviceName || '';
      const usedFilenames = new Set();
      const mainBase = sanitize(matched.name, 'template');
      const mainFilename = `${mainBase}_main_label.ezpx.tmp`;
      usedFilenames.add(mainFilename);

      const mainElements = getTemplateElements(matched, lang);
      defs.push({
        filename: mainFilename,
        elements: JSON.parse(JSON.stringify(mainElements)),
        config: getTemplateConfig(matched, lang),
        midVariables: matched.midVariables || []
      });
      (matched.subTemplates || []).forEach((sub, i) => {
        const subBase = sanitize(sub.name, `sub${i + 1}`);
        let fname = `${subBase}_label.ezpx.tmp`;
        if (usedFilenames.has(fname)) {
          fname = `${subBase}_${i + 1}_label.ezpx.tmp`;
        }
        usedFilenames.add(fname);
        const subElements = getTemplateElements(sub, lang);
        defs.push({
          filename: fname,
          elements: JSON.parse(JSON.stringify(subElements)),
          config: getTemplateConfig(sub, lang),
          midVariables: matched.midVariables || []
        });
      });
    }
  }

  // 3. If still no label definitions, no posted template nor a stored template matched
  //    the product. Error out instead of silently using the hardcoded default template.
  if (defs.length === 0) {
    const err = new Error(`No template found for product "${productName}". Make sure the product matches a template's item numbers, or post template_xml.`);
    err.status = 404;
    throw err;
  }

  // Options are passed to compileEZPXRange, which resolves {{product}} / {{options}}
  // placeholders AND optionMappings via resolveElementText — identical to the
  // frontend export. No manual replacement here (it would skip the mappings).
  const optionsStr = Array.isArray(options) && options.length > 0
    ? options.join(', ')
    : 'Standard';

  const extra = {
    origin: origin || '',
    order_id: order_id || '',
    done_date: done_date || '',
    doneDate: done_date || '',
    date: done_date || ''
  };

  // CSV-database mode: the EZPX references data.csv (one label per row) instead of the
  // ^C00 serial counter, matching the frontend export workflow. Each label definition
  // (main + subs) becomes its own .ezpx sharing the same data.csv.
  const files = [];
  for (const def of defs) {
    const xml = await compileEZPXRange(def.elements, def.config, serials, {
      product: productName,
      optionsText: optionsStr,
      deviceName: matchedDeviceName,
      csvDatabase: true,
      extra: { ...extra, midVariables: def.midVariables || [] }
    });
    files.push({ filename: def.filename, xml });
  }
  const csvContent = buildSerialCsv(serials, {
    defs: defs,
    product: productName,
    deviceName: matchedDeviceName,
    optionsText: optionsStr,
    extra: { ...extra, midVariables: (defs[0] && defs[0].midVariables) || [] }
  });

  return { files, csvContent };
}

/**
 * @param {Object|null} patches  Optional patch map { [patchName]: newTextValue }.
 *                               When supplied, any element in the template that has
 *                               a matching `patchName` will have its text replaced
 *                               with the supplied value before EZPL/preview generation.
 */
async function generateStEzplJson(product, serialNumbers = [], options = [], templateXml = null, lang = 'en', targetTemplate = null, origin = '', order_id = '', preview = true, patches = null, done_date = '', extra = {}) {
  const { compileEZPL } = await import('../src/utils/stEzplCompiler.js');
  const { parseEzpxXmlToTemplate } = await import('../src/utils/stEzpxParser.js');
  const { matchTemplateByItemNo } = await import('../src/utils/stTemplateManager.js');

  const serials = (Array.isArray(serialNumbers) && serialNumbers.length > 0)
    ? serialNumbers.map(s => String(s).trim())
    : ['12345678'];

  const productName = String(product || 'S695 4120').trim();
  const defs = [];

  // 1. If EZPX XML text content was posted directly
  if (templateXml && typeof templateXml === 'string' && templateXml.trim()) {
    try {
      const parsed = parseEzpxXmlToTemplate(templateXml.trim(), 'Posted EZPX Template');
      const parsedElements = getTemplateElements(parsed, lang);
      if (parsed && parsedElements.length > 0) {
        defs.push({
          id: 'main',
          name: parsed.name || productName,
          type: 'main',
          elements: parsedElements,
          config: parsed.config || { widthMm: 35, heightMm: 22, dpi: 300 }
        });
      }
    } catch (e) {
      console.warn('Failed to parse posted templateXml:', e);
    }
  }

  // 2. Otherwise match product against stored templates (SQLite) or use provided targetTemplate
  let matchedDeviceName = '';
  if (defs.length === 0) {
    let matched = targetTemplate;
    if (!matched) {
      const storedTemplates = templateStore.getAllTemplates();
      matched = matchTemplateByItemNo(storedTemplates, productName);
    }
    if (matched) {
      matchedDeviceName = matched.deviceName || '';
      const mainElements = getTemplateElements(matched, lang);
      defs.push({
        id: 'main',
        name: matched.name,
        type: 'main',
        elements: JSON.parse(JSON.stringify(mainElements)),
        config: getTemplateConfig(matched, lang),
        midVariables: matched.midVariables || []
      });
      (matched.subTemplates || []).forEach((sub, i) => {
        const subElements = getTemplateElements(sub, lang);
        defs.push({
          id: `sub_${sub.id || i + 1}`,
          name: sub.name,
          type: 'sub',
          elements: JSON.parse(JSON.stringify(subElements)),
          config: getTemplateConfig(sub, lang),
          midVariables: matched.midVariables || []
        });
      });
    }
  }

  if (defs.length === 0) {
    const err = new Error(`No template found for product "${productName}". Make sure the product matches a template's item numbers, or post template_xml.`);
    err.status = 404;
    throw err;
  }

  const optionsStr = Array.isArray(options) && options.length > 0
    ? options.join(', ')
    : 'Standard';

  // Collect all patchable elements from every def (main + subs) for the response.
  // Deduplication is by patchName across all defs.
  const patchSeen = new Set();
  const availablePatches = [];
  for (const def of defs) {
    for (const p of extractAvailablePatches(def.elements)) {
      if (!patchSeen.has(p.patchName)) {
        patchSeen.add(p.patchName);
        availablePatches.push(p);
      }
    }
  }

  // Apply patch overrides to element copies (original defs are not mutated).
  const hasPatch = patches && typeof patches === 'object' && Object.keys(patches).length > 0;

  const { generateGraphicEZPLForSerials } = require('./serverGraphicCompiler');

  const templatesResult = [];
  for (const def of defs) {
    const effectiveElements = hasPatch
      ? applyPatchesToElements(def.elements, patches)
      : def.elements;

    const graphicResult = await generateGraphicEZPLForSerials(
      effectiveElements,
      def.config,
      serials,
      {
        product: productName,
        optionsText: optionsStr,
        deviceName: matchedDeviceName,
        origin: origin || '',
        order_id: order_id || '',
        done_date: done_date || '',
        doneDate: done_date || '',
        date: done_date || '',
        preview: preview !== false,
        midVariables: def.midVariables || [],
        ...(extra || {})
      }
    );

    templatesResult.push({
      id: def.id,
      name: def.name,
      type: def.type,
      config: def.config,
      total_labels: graphicResult.items.length,
      items: graphicResult.items,
      all_ezpl_base64: graphicResult.all_ezpl_base64,
      all_ezpl: graphicResult.all_ezpl
    });
  }

  return {
    product: productName,
    lang: (typeof lang === 'string' && (lang.toLowerCase() === 'cn' || lang.toLowerCase().startsWith('zh'))) ? 'cn' : 'en',
    options: optionsStr,
    device_name: matchedDeviceName,
    origin: origin || '',
    order_id: order_id || '',
    done_date: done_date || '',
    total_serials: serials.length,
    available_patches: availablePatches,
    templates: templatesResult
  };
}

/**
 * Generates multi-product EZPL JSON for delivery orders with top-level origin and product array.
 */
async function generateStDeliveryMultiProductEzplJson(params = {}) {
  return generateStSpecialMultiProductEzplJson({ ...params, templateType: 'delivery' });
}

async function generateStInternalMultiProductEzplJson(params = {}) {
  return generateStSpecialMultiProductEzplJson({ ...params, templateType: 'internal' });
}

async function generateStSpecialMultiProductEzplJson({
  origin = '',
  order_id = '',
  products = [],
  lang = 'en',
  templateXml = null,
  preview = true,
  done_date = '',
  templateType = 'delivery'
} = {}) {
  const { parseEzpxXmlToTemplate } = await import('../src/utils/stEzpxParser.js');
  const normalizedLang = (typeof lang === 'string' && (lang.toLowerCase() === 'cn' || lang.toLowerCase().startsWith('zh'))) ? 'cn' : 'en';
  const isInternal = templateType === 'internal';
  const defaultTemplateName = isInternal ? 'Internal Template' : 'Delivery Template';

  const defs = [];

  // 1. If templateXml was provided
  if (templateXml && typeof templateXml === 'string' && templateXml.trim()) {
    try {
      const parsed = parseEzpxXmlToTemplate(templateXml.trim(), `Posted ${defaultTemplateName}`);
      const parsedElements = getTemplateElements(parsed, normalizedLang);
      if (parsed && parsedElements.length > 0) {
        defs.push({
          id: 'main',
          name: parsed.name || defaultTemplateName,
          type: 'main',
          elements: parsedElements,
          config: parsed.config || { widthMm: 35, heightMm: 22, dpi: 300 }
        });
      }
    } catch (e) {
      console.warn('Failed to parse posted templateXml:', e);
    }
  }

  // 2. Otherwise load the stored special template (Delivery or Internal)
  if (defs.length === 0) {
    const specialTemplate = isInternal ? templateStore.getInternalTemplate() : templateStore.getDeliveryTemplate();
    if (specialTemplate) {
      const mainElements = getTemplateElements(specialTemplate, normalizedLang);
      defs.push({
        id: 'main',
        name: specialTemplate.name || defaultTemplateName,
        type: 'main',
        elements: JSON.parse(JSON.stringify(mainElements)),
        config: getTemplateConfig(specialTemplate, normalizedLang),
        midVariables: specialTemplate.midVariables || []
      });
      (specialTemplate.subTemplates || []).forEach((sub, i) => {
        const subElements = getTemplateElements(sub, normalizedLang);
        defs.push({
          id: `sub_${sub.id || i + 1}`,
          name: sub.name,
          type: 'sub',
          elements: JSON.parse(JSON.stringify(subElements)),
          config: getTemplateConfig(sub, normalizedLang),
          midVariables: specialTemplate.midVariables || []
        });
      });
    }
  }

  if (defs.length === 0) {
    const err = new Error(`${defaultTemplateName} not found in system.`);
    err.status = 404;
    throw err;
  }

  // Extract any top-level custom variables from extraParams
  const globalReservedKeys = new Set(['origin', 'order', 'order_id', 'orderId', 'delivery_order', 'dn', 'lang', 'language', 'preview', 'format', 'template_xml', 'template', 'products']);
  const globalOptions = {};
  for (const [k, v] of Object.entries(extraParams || {})) {
    if (!globalReservedKeys.has(k) && v !== undefined && v !== null) {
      globalOptions[k] = String(v);
      globalOptions[k.toLowerCase()] = String(v);
    }
  }

  // Flatten all serials across products
  const productReservedKeys = new Set(['categ', 'category', 'device_name', 'deviceName', 'product', 'item_number', 'item_no', 'serial_numbers', 'serials', 'options_text', 'optionsText', 'options', 'done_date', 'doneDate', 'date']);
  const flatItems = [];
  for (const p of products) {
    const categ = String(p.categ || p.category || p.device_name || p.deviceName || '').trim();
    const product = String(p.product || p.item_number || p.item_no || '').trim();
    const optionsText = p.options_text || p.optionsText || p.options || '';
    const itemDoneDate = p.done_date || p.doneDate || p.date || done_date || '';

    // Capture any custom parameters (including option_xxx, optioxx, or any custom key) from product item
    const itemCustomOptions = { ...globalOptions };
    if (p && typeof p === 'object') {
      for (const [k, v] of Object.entries(p)) {
        if (!productReservedKeys.has(k) && v !== undefined && v !== null) {
          itemCustomOptions[k] = String(v);
          itemCustomOptions[k.toLowerCase()] = String(v);
        }
      }
    }
    
    let rawSerials = p.serial_numbers || p.serials;
    if (!rawSerials || !Array.isArray(rawSerials) || rawSerials.length === 0) {
      rawSerials = ['12345678'];
    }

    for (const sn of rawSerials) {
      flatItems.push({
        ...itemCustomOptions,
        origin: String(origin || '').trim(),
        order_id: String(order_id || '').trim(),
        categ,
        product,
        serial: String(sn).trim(),
        options_text: optionsText,
        done_date: itemDoneDate,
        doneDate: itemDoneDate,
        date: itemDoneDate
      });
    }
  }

  if (flatItems.length === 0) {
    flatItems.push({
      origin: String(origin || '').trim(),
      order_id: String(order_id || '').trim(),
      categ: '',
      product: isInternal ? 'Internal' : 'Delivery',
      serial: '12345678',
      options_text: '',
      done_date: done_date || '',
      doneDate: done_date || '',
      date: done_date || ''
    });
  }

  const { generateGraphicEZPLForSerials } = require('./serverGraphicCompiler');

  const templatesResult = [];
  for (const def of defs) {
    const graphicResult = await generateGraphicEZPLForSerials(
      def.elements,
      def.config,
      flatItems,
      {
        origin: String(origin || '').trim(),
        order_id: String(order_id || '').trim(),
        done_date: done_date || '',
        doneDate: done_date || '',
        date: done_date || '',
        preview: preview !== false,
        midVariables: def.midVariables || []
      }
    );

    templatesResult.push({
      id: def.id,
      name: def.name,
      type: def.type,
      config: def.config,
      total_labels: graphicResult.items.length,
      items: graphicResult.items,
      all_ezpl_base64: graphicResult.all_ezpl_base64,
      all_ezpl: graphicResult.all_ezpl
    });
  }

  return {
    origin: String(origin || '').trim(),
    order_id: String(order_id || '').trim(),
    lang: normalizedLang,
    done_date: done_date || '',
    total_products: products.length,
    total_labels: flatItems.length,
    templates: templatesResult
  };
}

module.exports = {
  generateStEzpxXml,
  generateStEzplJson,
  generateStDeliveryMultiProductEzplJson,
  generateStInternalMultiProductEzplJson,
  generateStSpecialMultiProductEzplJson,
  getTemplateElements
};

