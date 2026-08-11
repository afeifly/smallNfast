/**
 * Server-side EZPX generator module supporting template_xml text content parameter.
 */

async function generateStEzpxXml(product, serialNumbers = [], options = [], templateXml = null) {
  const { compileEZPXRange } = await import('../src/utils/stEzpxCompiler.js');
  const { parseEzpxXmlToTemplate } = await import('../src/utils/stEzpxParser.js');
  const { DEFAULT_ELEMENTS_EN } = await import('../src/utils/stTemplateManager.js');

  const serials = (Array.isArray(serialNumbers) && serialNumbers.length > 0)
    ? serialNumbers.map(s => String(s).trim())
    : ['12345678'];

  let elements;
  let canvasConfig = { widthMm: 35, heightMm: 22, dpi: 203 };

  // If EZPX XML text content was posted, parse it into template elements & config
  if (templateXml && typeof templateXml === 'string' && templateXml.trim()) {
    try {
      const parsed = parseEzpxXmlToTemplate(templateXml.trim(), 'Posted EZPX Template');
      if (parsed && Array.isArray(parsed.elements_en) && parsed.elements_en.length > 0) {
        elements = parsed.elements_en;
        if (parsed.config) {
          canvasConfig = parsed.config;
        }
      }
    } catch (e) {
      console.warn('Failed to parse posted templateXml, using default template:', e);
    }
  }

  // Fallback to default 14-element ST label template if no templateXml or parsing yielded no elements
  if (!elements || elements.length === 0) {
    elements = JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_EN));
  }

  const productName = String(product || 'S695 4120').trim();

  // Update Model Title element if present
  const elModel = elements.find(el => el.id === 'el_model' || /model/i.test(el.name || ''));
  if (elModel && elModel.type === 'text') {
    elModel.text = `Model: ${productName}`;
  }

  // Update Item No. element if present
  const elItemNo = elements.find(el => el.id === 'el_item_no' || /item\s*no/i.test(el.name || ''));
  if (elItemNo && elItemNo.type === 'text') {
    elItemNo.text = `Item No.: ${productName}`;
  }

  // Update Range / Options element if present
  const elRange = elements.find(el => el.id === 'el_range' || /range|option/i.test(el.name || ''));
  if (elRange && elRange.type === 'text') {
    if (Array.isArray(options) && options.length > 0) {
      elRange.text = `Option: ${options.join(', ')}`;
    } else if (!elRange.text) {
      elRange.text = 'Range: Standard';
    }
  }

  return await compileEZPXRange(elements, canvasConfig, serials);
}

module.exports = {
  generateStEzpxXml
};
