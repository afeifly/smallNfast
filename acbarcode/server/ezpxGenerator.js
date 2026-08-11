/**
 * Server-side EZPX generator module supporting product itemNumber template matching & placeholders.
 */

async function generateStEzpxXml(product, serialNumbers = [], options = [], templateXml = null) {
  const { compileEZPXRange } = await import('../src/utils/stEzpxCompiler.js');
  const { parseEzpxXmlToTemplate } = await import('../src/utils/stEzpxParser.js');
  const { DEFAULT_ELEMENTS_EN, matchTemplateByItemNo, createInitialDefaultTemplates } = await import('../src/utils/stTemplateManager.js');

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

  // 2. If no direct templateXml was provided, try matching product against stored templates
  if (!elements || elements.length === 0) {
    const defaultTemplates = createInitialDefaultTemplates();
    const matched = matchTemplateByItemNo(defaultTemplates, productName);
    if (matched) {
      elements = JSON.parse(JSON.stringify(matched.elements_en || matched.elements || []));
      if (matched.config) canvasConfig = matched.config;
    }
  }

  // 3. Fallback to default 14-element ST label template if still no elements
  if (!elements || elements.length === 0) {
    elements = JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_EN));
  }

  const optionsStr = Array.isArray(options) && options.length > 0
    ? options.join(', ')
    : 'Standard';

  // 4. Update elements with product & options
  elements = elements.map(el => {
    const updated = { ...el };
    if (updated.type === 'text' || updated.type === 'barcode') {
      let val = updated.text || updated.data || '';

      // Replace {{product}} or {{product_no}}
      if (val.includes('{{product}}') || val.includes('{{product_no}}')) {
        val = val.replace(/\{\{product\}\}/g, productName).replace(/\{\{product_no\}\}/g, productName);
      } else if (updated.id === 'el_item_no' || /item\s*no/i.test(updated.name || '')) {
        val = `Item No.: ${productName}`;
      } else if (updated.id === 'el_model' || /model/i.test(updated.name || '')) {
        val = `Model: ${productName}`;
      }

      // Replace {{options}} or {{option}}
      if (val.includes('{{options}}') || val.includes('{{option}}')) {
        val = val.replace(/\{\{options\}\}/g, optionsStr).replace(/\{\{option\}\}/g, optionsStr);
      } else if (updated.id === 'el_range' || /range|option/i.test(updated.name || '')) {
        val = Array.isArray(options) && options.length > 0 ? `Option: ${optionsStr}` : val;
      }

      if (updated.type === 'text') updated.text = val;
      if (updated.type === 'barcode') updated.data = val;
    }
    return updated;
  });

  return await compileEZPXRange(elements, canvasConfig, serials, { product: productName, optionsText: optionsStr });
}

module.exports = {
  generateStEzpxXml
};
