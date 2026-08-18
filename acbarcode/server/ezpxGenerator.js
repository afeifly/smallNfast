/**
 * Server-side EZPX generator module supporting product itemNumber template matching & placeholders.
 */

const templateStore = require('./templateStore');

async function generateStEzpxXml(product, serialNumbers = [], options = [], templateXml = null) {
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
      if (parsed && Array.isArray(parsed.elements_en) && parsed.elements_en.length > 0) {
        const mainBase = sanitize(parsed.name || productName, 'template');
        defs.push({
          filename: `${mainBase}_main_label.ezpx.tmp`,
          elements: parsed.elements_en,
          config: parsed.config || { widthMm: 35, heightMm: 22, dpi: 203 }
        });
      }
    } catch (e) {
      console.warn('Failed to parse posted templateXml:', e);
    }
  }

  // 2. Otherwise match product against stored templates (SQLite), including sub-templates
  let matchedDeviceName = '';
  if (defs.length === 0) {
    const storedTemplates = templateStore.getAllTemplates();
    const matched = matchTemplateByItemNo(storedTemplates, productName);
    if (matched) {
      matchedDeviceName = matched.deviceName || '';
      const usedFilenames = new Set();
      const mainBase = sanitize(matched.name, 'template');
      const mainFilename = `${mainBase}_main_label.ezpx.tmp`;
      usedFilenames.add(mainFilename);

      defs.push({
        filename: mainFilename,
        elements: JSON.parse(JSON.stringify(matched.elements_en || matched.elements || [])),
        config: matched.config || { widthMm: 35, heightMm: 22, dpi: 203 }
      });
      (matched.subTemplates || []).forEach((sub, i) => {
        const subBase = sanitize(sub.name, `sub${i + 1}`);
        let fname = `${subBase}_label.ezpx.tmp`;
        if (usedFilenames.has(fname)) {
          fname = `${subBase}_${i + 1}_label.ezpx.tmp`;
        }
        usedFilenames.add(fname);
        defs.push({
          filename: fname,
          elements: JSON.parse(JSON.stringify(sub.elements_en || [])),
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

module.exports = {
  generateStEzpxXml
};
