import { resolveElementText } from './stOptionResolver.js';

/**
 * Compiles label elements and canvas configuration into EZPL printer command string.
 * @param {Array} elements - Label elements array
 * @param {Object} config - Canvas configuration { widthMm, heightMm, dpi }
 * @param {string} serial - Serial number string to substitute for {{serial}}
 * @param {string} product - Product name
 * @param {string} optionsText - Options text
 * @param {string} deviceName - Device name for SUTO QR code / {{device_name}}
 * @returns {string} Compiled EZPL command stream
 */
export function compileEZPL(elements = [], config = {}, serial = '3726 0001', product = '', optionsText = '', deviceName = '') {
  const w = config.widthMm || 35;
  const h = config.heightMm || 22;
  const dpi = config.dpi || 203;
  const mmToDots = (mm) => Math.round((mm / 25.4) * dpi);

  let ezpl = '';
  ezpl += `^Q${h},3\n`;
  ezpl += `^W${w}\n`;
  ezpl += `^H10\n`;
  ezpl += `^S4\n`;
  ezpl += `^L\n`;

  elements.forEach((el, index) => {
    if (el.type === 'folder') return;
    const textVal = resolveElementText(el, optionsText, serial, product, deviceName);

    if (el.type === 'text') {
      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);
      const size = el.fontSize || 4;
      let fontCmd = 'AC';
      let mul = 1;
      if (size <= 3.5) {
        fontCmd = 'AB';
      } else if (size <= 4.5) {
        fontCmd = 'AC';
      } else if (size <= 5.5) {
        fontCmd = 'AD';
      } else {
        fontCmd = 'AE';
        mul = Math.max(1, Math.round(size / 6));
      }

      const endX = el.endXMm !== undefined ? el.endXMm : el.x1Mm;
      if (endX && endX > el.xMm) {
        const maxW = endX - el.xMm;
        const charW = size * 0.3; // approximate character width in mm
        const charsPerLine = Math.max(1, Math.floor(maxW / charW));
        const lines = [];
        const words = textVal.split(' ');
        let currentLine = '';
        for (const word of words) {
          if (currentLine.length + word.length + 1 > charsPerLine) {
            if (currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              lines.push(word);
              currentLine = '';
            }
          } else {
            currentLine = currentLine ? (currentLine + ' ' + word) : word;
          }
        }
        if (currentLine) {
          lines.push(currentLine);
        }

        const lineHeightDots = mmToDots(size * 0.45);
        const ezplRot = Math.round(((el.rotation || 0) % 360) / 90) % 4;
        for (let i = 0; i < lines.length; i++) {
          const lineY = y + i * lineHeightDots;
          ezpl += `${fontCmd},${x},${lineY},${mul},${mul},0,${ezplRot},${lines[i]}\n`;
          if (el.bold) {
            ezpl += `${fontCmd},${x + 1},${lineY},${mul},${mul},0,${ezplRot},${lines[i]}\n`;
          }
        }
      } else {
        const ezplRot = Math.round(((el.rotation || 0) % 360) / 90) % 4;
        ezpl += `${fontCmd},${x},${y},${mul},${mul},0,${ezplRot},${textVal}\n`;
        if (el.bold) {
          ezpl += `${fontCmd},${x + 1},${y},${mul},${mul},0,${ezplRot},${textVal}\n`;
        }
      }
    } else if (el.type === 'hline' || el.type === 'vline') {
      const isVertical = el.lineShape === 'VLine' || el.type === 'vline' || (el.x1Mm !== undefined && el.x1Mm === el.xMm);
      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);
      const thickness = el.thicknessDots || 3;
      if (isVertical) {
        const endY = mmToDots(el.y1Mm !== undefined ? el.y1Mm : (el.yMm + (el.heightMm || 3.0)));
        ezpl += `Lo,${x},${y},${x + thickness},${endY}\n`;
      } else {
        const endX = mmToDots(el.x1Mm !== undefined ? el.x1Mm : w);
        ezpl += `Lo,${x},${y},${endX},${y + thickness}\n`;
      }
    } else if (el.type === 'table') {
      const x0 = mmToDots(el.xMm || 0);
      const y0 = mmToDots(el.yMm || 0);
      const totalW = mmToDots(el.widthMm !== undefined ? el.widthMm : 30);
      const totalH = mmToDots(el.heightMm !== undefined ? el.heightMm : 10);
      const numRows = Math.max(1, parseInt(el.rows) || 2);
      const numCols = Math.max(1, parseInt(el.cols) || 2);
      const thickness = Math.max(1, el.thicknessDots || el.lineWidth || 2);

      // Outer box 4 borders
      ezpl += `Lo,${x0},${y0},${x0 + totalW},${y0 + thickness}\n`;
      ezpl += `Lo,${x0},${y0 + totalH - thickness},${x0 + totalW},${y0 + totalH}\n`;
      ezpl += `Lo,${x0},${y0},${x0 + thickness},${y0 + totalH}\n`;
      ezpl += `Lo,${x0 + totalW - thickness},${y0},${x0 + totalW},${y0 + totalH}\n`;

      // Horizontal dividers
      if (el.rowHeights) {
        const customHeights = String(el.rowHeights).split(/[,;]+/).map(v => mmToDots(parseFloat(v.trim()))).filter(v => !isNaN(v) && v > 0);
        let currY = y0;
        for (let r = 0; r < customHeights.length && currY + customHeights[r] < y0 + totalH; r++) {
          currY += customHeights[r];
          ezpl += `Lo,${x0},${currY},${x0 + totalW},${currY + thickness}\n`;
        }
      } else {
        for (let r = 1; r < numRows; r++) {
          const currY = y0 + Math.round((totalH * r) / numRows);
          ezpl += `Lo,${x0},${currY},${x0 + totalW},${currY + thickness}\n`;
        }
      }

      // Vertical dividers
      if (el.colWidths) {
        const customWidths = String(el.colWidths).split(/[,;]+/).map(v => mmToDots(parseFloat(v.trim()))).filter(v => !isNaN(v) && v > 0);
        let currX = x0;
        for (let c = 0; c < customWidths.length && currX + customWidths[c] < x0 + totalW; c++) {
          currX += customWidths[c];
          ezpl += `Lo,${currX},${y0},${currX + thickness},${y0 + totalH}\n`;
        }
      } else {
        for (let c = 1; c < numCols; c++) {
          const currX = x0 + Math.round((totalW * c) / numCols);
          ezpl += `Lo,${currX},${y0},${currX + thickness},${y0 + totalH}\n`;
        }
      }
    } else if (el.type === 'image') {
      const widthMm = el.widthMm || 10;
      const heightMm = el.heightMm || 3.8;
      const xMm = el.autoBottomRight ? Math.max(0, w - widthMm - 1) : (el.xMm || 0);
      const yMm = el.autoBottomRight ? Math.max(0, h - heightMm - 1) : (el.yMm || 0);
      const x = mmToDots(xMm);
      const y = mmToDots(yMm);
      const graphicName = (el.storedName || el.name || `IMG_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      ezpl += `; --- Graphic: ${el.name || 'Image'} ---\n`;
      ezpl += `Y${x},${y},${graphicName}\n`;
    } else if (el.type === 'barcode') {
      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);
      const heightDots = mmToDots(el.heightMm || 10);
      const readable = el.readable ? 1 : 0;
      const ezplRot = Math.round(((el.rotation || 0) % 360) / 90) % 4;
      let narrow = 2;
      if (el.widthMm) {
        const totalModules = (textVal.length * 11) + 35;
        narrow = Math.max(1, Math.round(mmToDots(el.widthMm) / totalModules));
      }
      const wide = Math.max(narrow + 1, Math.round(narrow * 2.5));
      ezpl += `BQ,${x},${y},${narrow},${wide},${heightDots},${ezplRot},${readable},${textVal}\n`;
    } else if (el.type === 'qrcode') {
      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);
      const ezplRot = Math.round(((el.rotation || 0) % 360) / 90) % 4;
      const rawMul = Number(el.mul) || 4;
      const mul = Math.max(1, rawMul - 1);
      const len = textVal.length;
      ezpl += `W${x},${y},2,2,M,8,${mul},${len},${ezplRot}\n`;
      ezpl += `${textVal}\n`;
    }
  });

  ezpl += `E\n`;
  return ezpl;
}
