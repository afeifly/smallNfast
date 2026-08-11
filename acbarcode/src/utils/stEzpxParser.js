/**
 * EZPX XML Parser Utility for AC Barcode / ST Label Maker.
 * Parses GoLabel .ezpx XML files into application Template objects.
 */

export function parseEzpxXmlToTemplate(xmlStr, filename = 'Imported EZPX Template') {
  const widthMatch = xmlStr.match(/LabelWidth=["']?(\d+(?:\.\d+)?)["']?/i);
  const heightMatch = xmlStr.match(/LabelLength=["']?(\d+(?:\.\d+)?)["']?/i);
  const dpiMatch = xmlStr.match(/<Dpi>(\d+)<\/Dpi>/i);

  const widthMm = widthMatch ? parseFloat(widthMatch[1]) : 35;
  const heightMm = heightMatch ? parseFloat(heightMatch[1]) : 22;
  const dpi = dpiMatch ? parseInt(dpiMatch[1], 10) : 203;

  const dotsToMm = (dots) => Math.round((parseFloat(dots || 0) / dpi) * 25.4 * 10) / 10;

  const shapeRegex = /<GraphicShape([\s\S]*?)>([\s\S]*?)<\/GraphicShape>/gi;
  const elements = [];
  let match;
  let idx = 0;
  const foundItemNumbers = new Set();

  while ((match = shapeRegex.exec(xmlStr)) !== null) {
    idx++;
    const attrsStr = match[1];
    const bodyStr = match[2];

    const getAttr = (name) => {
      const re = new RegExp(name + '=["\']?([^"\'\\s>]+)["\']?', 'i');
      const m = attrsStr.match(re);
      return m ? m[1] : '';
    };

    const getTag = (name) => {
      const re = new RegExp('<' + name + '>(.*?)</' + name + '>', 'is');
      const m = bodyStr.match(re);
      return m ? m[1].trim() : '';
    };

    const typeAttr = getAttr('xsi:type');
    const x = dotsToMm(getAttr('X') || 0);
    const y = dotsToMm(getAttr('Y') || 0);
    const itemLabel = getTag('ItemLabel') || `Element_${idx}`;
    let rawData = getTag('Data') || getTag('DispData');

    // Replace ^C00 counter with {{serial}} placeholder
    if (rawData === '^C00' || rawData.includes('^C00')) {
      rawData = rawData.replace(/\^C00/g, '{{serial}}');
    }

    // Try to extract Item Numbers from text content like "Item No.: S695 4035"
    if (rawData) {
      const itemMatch = rawData.match(/Item\s*No\.?\s*:\s*([A-Za-z0-9\s]+)/i);
      if (itemMatch && itemMatch[1]) {
        foundItemNumbers.add(itemMatch[1].trim());
      }
    }

    const typeLower = typeAttr.toLowerCase();

    if (typeLower.includes('text')) {
      const fontCmd = getAttr('FontCmd');
      const fontParts = fontCmd.split(',');
      const fontSize = fontParts[1] ? parseFloat(fontParts[1]) : 4;
      const isBold = fontCmd.includes(',B');

      elements.push({
        id: `el_ezpx_${idx}`,
        type: 'text',
        name: itemLabel,
        text: rawData,
        xMm: x,
        yMm: y,
        fontSize,
        bold: isBold,
        expanded: false
      });
    } else if (typeLower.includes('barcode')) {
      elements.push({
        id: `el_ezpx_${idx}`,
        type: 'barcode',
        name: itemLabel,
        data: rawData || '{{serial}}',
        xMm: x,
        yMm: y,
        heightMm: dotsToMm(getAttr('Height') || 40),
        readable: getAttr('Readable') === 'Bottom',
        expanded: false
      });
    } else if (typeLower.includes('qrcode')) {
      elements.push({
        id: `el_ezpx_${idx}`,
        type: 'qrcode',
        name: itemLabel,
        data: rawData || '{{serial}}',
        xMm: x,
        yMm: y,
        mul: parseInt(getAttr('Multiplier') || '4', 10),
        expanded: false
      });
    } else if (typeLower.includes('image')) {
      const b64 = getTag('BitmapCmd');
      const widthMmVal = dotsToMm(getTag('BoundRectWidth') || 50);
      elements.push({
        id: `el_ezpx_${idx}`,
        type: 'image',
        name: itemLabel,
        src: b64 ? `data:image/png;base64,${b64}` : '/t_logo.jpg',
        xMm: x,
        yMm: y,
        widthMm: widthMmVal > 0 ? widthMmVal : 10,
        storedName: itemLabel.replace(/[^a-zA-Z0-9_-]/g, '_'),
        expanded: false
      });
    } else if (typeLower.includes('line')) {
      const lineShape = getTag('lineShape') || 'HLine';
      const isVLine = lineShape === 'VLine';
      elements.push({
        id: `el_ezpx_${idx}`,
        type: isVLine ? 'vline' : 'hline',
        name: itemLabel,
        xMm: x,
        yMm: y,
        lineShape,
        thicknessDots: parseInt(getTag(isVLine ? 'Width' : 'Height') || '5', 10),
        expanded: false
      });
    }
  }

  const cleanName = filename.replace(/\.ezpx$/i, '').replace(/_/g, ' ');

  return {
    id: `tpl_ezpx_${Date.now()}`,
    name: cleanName || 'Imported EZPX Template',
    itemNumbers: Array.from(foundItemNumbers),
    config: {
      widthMm,
      heightMm,
      dpi
    },
    elements_en: elements,
    elements_cn: JSON.parse(JSON.stringify(elements))
  };
}
