/**
 * Server-side EZPX generator module supporting product itemNumber template matching & placeholders.
 */

const templateStore = require('./templateStore');

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

async function generateStEzpxXml(product, serialNumbers = [], options = [], templateXml = null, lang = 'en', targetTemplate = null) {
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
        config: matched.config || { widthMm: 35, heightMm: 22, dpi: 203 }
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
          config: sub.config || { widthMm: 35, heightMm: 22, dpi: 203 }
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

  // CSV-database mode: the EZPX references data.csv (one label per row) instead of the
  // ^C00 serial counter, matching the frontend export workflow. Each label definition
  // (main + subs) becomes its own .ezpx sharing the same data.csv.
  const files = [];
  for (const def of defs) {
    const xml = await compileEZPXRange(def.elements, def.config, serials, {
      product: productName,
      optionsText: optionsStr,
      deviceName: matchedDeviceName,
      csvDatabase: true
    });
    files.push({ filename: def.filename, xml });
  }
  const csvContent = buildSerialCsv(serials, {
    defs: defs,
    product: productName,
    deviceName: matchedDeviceName,
    optionsText: optionsStr
  });

  return { files, csvContent };
}

async function generateStEzplJson(product, serialNumbers = [], options = [], templateXml = null, lang = 'en', targetTemplate = null) {
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
        config: matched.config || { widthMm: 35, heightMm: 22, dpi: 300 }
      });
      (matched.subTemplates || []).forEach((sub, i) => {
        const subElements = getTemplateElements(sub, lang);
        defs.push({
          id: `sub_${sub.id || i + 1}`,
          name: sub.name,
          type: 'sub',
          elements: JSON.parse(JSON.stringify(subElements)),
          config: sub.config || { widthMm: 35, heightMm: 22, dpi: 300 }
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

  const { generateGraphicEZPLForSerials } = require('./serverGraphicCompiler');

  const templatesResult = [];
  for (const def of defs) {
    const graphicResult = await generateGraphicEZPLForSerials(
      def.elements,
      def.config,
      serials,
      { product: productName, optionsText: optionsStr, deviceName: matchedDeviceName }
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
    total_serials: serials.length,
    templates: templatesResult
  };
}

/**
 * Generates multi-product EZPL JSON for delivery orders with top-level origin and product array.
 */
async function generateStDeliveryMultiProductEzplJson({ origin = '', products = [], lang = 'en', templateXml = null }) {
  const { parseEzpxXmlToTemplate } = await import('../src/utils/stEzpxParser.js');
  const normalizedLang = (typeof lang === 'string' && (lang.toLowerCase() === 'cn' || lang.toLowerCase().startsWith('zh'))) ? 'cn' : 'en';

  const defs = [];

  // 1. If templateXml was provided
  if (templateXml && typeof templateXml === 'string' && templateXml.trim()) {
    try {
      const parsed = parseEzpxXmlToTemplate(templateXml.trim(), 'Posted Delivery Template');
      const parsedElements = getTemplateElements(parsed, normalizedLang);
      if (parsed && parsedElements.length > 0) {
        defs.push({
          id: 'main',
          name: parsed.name || 'Delivery Template',
          type: 'main',
          elements: parsedElements,
          config: parsed.config || { widthMm: 35, heightMm: 22, dpi: 300 }
        });
      }
    } catch (e) {
      console.warn('Failed to parse posted templateXml:', e);
    }
  }

  // 2. Otherwise load the stored special Delivery Template
  if (defs.length === 0) {
    const deliveryTemplate = templateStore.getDeliveryTemplate();
    if (deliveryTemplate) {
      const mainElements = getTemplateElements(deliveryTemplate, normalizedLang);
      defs.push({
        id: 'main',
        name: deliveryTemplate.name || 'Delivery Template',
        type: 'main',
        elements: JSON.parse(JSON.stringify(mainElements)),
        config: deliveryTemplate.config || { widthMm: 35, heightMm: 22, dpi: 300 }
      });
      (deliveryTemplate.subTemplates || []).forEach((sub, i) => {
        const subElements = getTemplateElements(sub, normalizedLang);
        defs.push({
          id: `sub_${sub.id || i + 1}`,
          name: sub.name,
          type: 'sub',
          elements: JSON.parse(JSON.stringify(subElements)),
          config: sub.config || { widthMm: 35, heightMm: 22, dpi: 300 }
        });
      });
    }
  }

  if (defs.length === 0) {
    const err = new Error('Delivery template not found in system.');
    err.status = 404;
    throw err;
  }

  // Flatten all serials across products
  const flatItems = [];
  for (const p of products) {
    const categ = String(p.categ || p.category || p.device_name || p.deviceName || '').trim();
    const product = String(p.product || p.item_number || p.item_no || '').trim();
    const optionsText = p.options_text || p.optionsText || p.options || '';
    
    let rawSerials = p.serial_numbers || p.serials;
    if (!rawSerials || !Array.isArray(rawSerials) || rawSerials.length === 0) {
      rawSerials = ['12345678'];
    }

    for (const sn of rawSerials) {
      flatItems.push({
        origin: String(origin || '').trim(),
        categ,
        product,
        serial: String(sn).trim(),
        options_text: optionsText
      });
    }
  }

  if (flatItems.length === 0) {
    flatItems.push({
      origin: String(origin || '').trim(),
      categ: '',
      product: 'Delivery',
      serial: '12345678',
      options_text: ''
    });
  }

  const { generateGraphicEZPLForSerials } = require('./serverGraphicCompiler');

  const templatesResult = [];
  for (const def of defs) {
    const graphicResult = await generateGraphicEZPLForSerials(
      def.elements,
      def.config,
      flatItems,
      { origin: String(origin || '').trim() }
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
    lang: normalizedLang,
    total_products: products.length,
    total_labels: flatItems.length,
    templates: templatesResult
  };
}

module.exports = {
  generateStEzpxXml,
  generateStEzplJson,
  generateStDeliveryMultiProductEzplJson,
  getTemplateElements
};

