/**
 * Server-side EZPX generator module using the unified template compiler.
 */

async function generateStEzpxXml(product, serialNumbers = [], options = []) {
  // Dynamically import ES modules in Node.js
  const { compileEZPXRange } = await import('../src/utils/stEzpxCompiler.js');
  const { DEFAULT_ELEMENTS_EN } = await import('../src/utils/stTemplateManager.js');

  const serials = (Array.isArray(serialNumbers) && serialNumbers.length > 0)
    ? serialNumbers.map(s => String(s).trim())
    : ['12345678'];

  // Clone default 14-element ST label template
  const elements = JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_EN));

  const productName = String(product || 'S695 4120').trim();

  // Update Model Title element
  const elModel = elements.find(el => el.id === 'el_model');
  if (elModel) {
    elModel.text = `Model: ${productName}`;
  }

  // Update Item No. element
  const elItemNo = elements.find(el => el.id === 'el_item_no');
  if (elItemNo) {
    elItemNo.text = `Item No.: ${productName}`;
  }

  // Update Range / Options element
  const elRange = elements.find(el => el.id === 'el_range');
  if (elRange) {
    if (Array.isArray(options) && options.length > 0) {
      elRange.text = `Option: ${options.join(', ')}`;
    } else {
      elRange.text = 'Range: Standard';
    }
  }

  const canvasConfig = {
    widthMm: 35,
    heightMm: 22,
    dpi: 203
  };

  // Compile full 14-element EZPX XML using the exact same compiler as UI export
  return await compileEZPXRange(elements, canvasConfig, serials);
}

module.exports = {
  generateStEzpxXml
};
