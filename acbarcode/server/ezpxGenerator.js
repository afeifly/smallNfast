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

  let elements;
  let canvasConfig = { widthMm: 35, heightMm: 22, dpi: 203 };
  const productName = String(product || 'S695 4120').trim();

  // 1. If EZPX XML text content was posted directly
  if (templateXml && typeof templateXml === 'string' && templateXml.trim()) {
    try {
      const parsed = parseEzpxXmlToTemplate(templateXml.trim(), 'Posted EZPX Template');
      if (parsed && Array.isArray(parsed.elements_en) && parsed.elements_en.length > 0) {
        elements = parsed.elements_en;
        if (parsed.config) canvasConfig = parsed.config;
      }
    } catch (e) {
      console.warn('Failed to parse posted templateXml:', e);
    }
  }

  // 2. If no direct templateXml was provided, try matching product against stored templates (SQLite)
  if (!elements || elements.length === 0) {
    const storedTemplates = templateStore.getAllTemplates();
    const matched = matchTemplateByItemNo(storedTemplates, productName);
    if (matched) {
      elements = JSON.parse(JSON.stringify(matched.elements_en || matched.elements || []));
      if (matched.config) canvasConfig = matched.config;
    }
  }

  // 3. If still no elements, no posted template nor a stored template matched the product.
  //    Error out instead of silently using the hardcoded default template.
  if (!elements || elements.length === 0) {
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
  // ^C00 serial counter, matching the frontend export workflow.
  const ezpxXml = await compileEZPXRange(elements, canvasConfig, serials, {
    product: productName,
    optionsText: optionsStr,
    csvDatabase: true
  });
  const csvContent = buildSerialCsv(serials);

  return { ezpxXml, csvContent };
}

module.exports = {
  generateStEzpxXml
};
