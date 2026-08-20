const { createCanvas, Image, loadImage } = require('@napi-rs/canvas');
const QRCode = require('qrcode');
const JsBarcode = require('jsbarcode');
const path = require('path');
const fs = require('fs');

const PRINTER_DPI = 300;

// In-memory image cache for server
const serverImageCache = new Map();

async function getCachedServerImage(src) {
  if (!src) return null;
  if (serverImageCache.has(src)) {
    return serverImageCache.get(src);
  }

  try {
    let img;
    if (src.startsWith('data:')) {
      img = await loadImage(src);
    } else if (src.startsWith('/') || src.startsWith('./') || !src.includes('://')) {
      // Local file in public/
      const cleanPath = src.replace(/^\/+/, '');
      const localPath = path.join(__dirname, '..', 'public', cleanPath);
      if (fs.existsSync(localPath)) {
        img = await loadImage(localPath);
      } else {
        img = await loadImage(src);
      }
    } else {
      img = await loadImage(src);
    }
    if (img) {
      serverImageCache.set(src, img);
    }
    return img;
  } catch (err) {
    console.warn('Could not load image on server:', src, err.message);
    return null;
  }
}

/**
 * Server-side canvas renderer using @napi-rs/canvas
 */
async function renderNodeCanvas(canvas, elements = [], config = {}, serial = '3726 0001', product = '', optionsText = '', deviceName = '', extra = {}) {
  const { resolveElementText } = await import('../src/utils/stOptionResolver.js');

  const dpi = config.dpi || PRINTER_DPI;
  const mmToPx = (mm) => Math.round((mm / 25.4) * dpi);
  const ptToPx = (pt) => Math.round((pt / 72) * dpi);

  const W = mmToPx(config.widthMm || 35);
  const H = mmToPx(config.heightMm || 22);

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  for (const el of elements) {
    if (el.type === 'folder') continue;
    const textVal = resolveElementText(el, optionsText, serial, product || 'S695 4035 (Air)', deviceName, extra);

    if (el.type === 'text') {
      const fontSizePx = ptToPx(el.fontSize || 4);
      const fontWeight = el.bold ? 'bold' : 'normal';
      ctx.font = `${fontWeight} ${fontSizePx}px "Arial", "Helvetica", sans-serif`;
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(textVal, mmToPx(el.xMm), mmToPx(el.yMm));
    } else if (el.type === 'hline' || el.type === 'vline') {
      const isVertical = el.lineShape === 'VLine' || el.type === 'vline' || (el.x1Mm !== undefined && el.x1Mm === el.xMm);
      ctx.beginPath();
      ctx.moveTo(mmToPx(el.xMm), mmToPx(el.yMm));
      if (isVertical) {
        const endY = el.y1Mm !== undefined ? el.y1Mm : (el.yMm + (el.heightMm || 3.0));
        ctx.lineTo(mmToPx(el.xMm), mmToPx(endY));
      } else {
        const endX = el.x1Mm !== undefined ? el.x1Mm : config.widthMm;
        ctx.lineTo(mmToPx(endX), mmToPx(el.yMm));
      }
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = el.thicknessDots || 3;
      ctx.stroke();
    } else if (el.type === 'image' && el.src) {
      const img = await getCachedServerImage(el.src);
      if (img && (img.width > 0 || img.naturalWidth > 0)) {
        const natW = img.naturalWidth || img.width;
        const natH = img.naturalHeight || img.height;
        const imgW = mmToPx(el.widthMm || 10);
        const imgH = Math.round(natH * (imgW / natW));
        let x = mmToPx(el.xMm || 0);
        let y = mmToPx(el.yMm || 0);
        if (el.autoBottomRight) {
          x = W - imgW - mmToPx(1);
          y = H - imgH - mmToPx(0.5);
        }
        ctx.drawImage(img, x, y, imgW, imgH);
      }
    } else if (el.type === 'barcode') {
      try {
        const barHeightPx = mmToPx(el.heightMm || 10);
        const barcodeCanvas = createCanvas(100, barHeightPx);
        JsBarcode(barcodeCanvas, textVal, {
          format: 'CODE128',
          width: 2,
          height: barHeightPx,
          displayValue: false,
          margin: 0
        });
        const drawW = el.widthMm ? mmToPx(el.widthMm) : barcodeCanvas.width;
        const xPx = mmToPx(el.xMm || 0);
        const yPx = mmToPx(el.yMm || 0);
        ctx.drawImage(barcodeCanvas, xPx, yPx, drawW, barHeightPx);

        let totalH = barHeightPx;
        if (el.readable !== false && textVal) {
          const fontPt = el.fontSize || 4.5;
          const fontSizePx = ptToPx(fontPt);
          const fontWeight = el.bold === false ? '500' : (el.bold === true ? '700' : '600');
          ctx.font = `${fontWeight} ${fontSizePx}px "Segoe UI", Arial, sans-serif`;
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const textX = xPx + (drawW / 2);
          const textY = yPx + barHeightPx + mmToPx(0.5);
          ctx.fillText(textVal, textX, textY);
          totalH += mmToPx(0.5) + fontSizePx;
        }

        if (el.border) {
          const padPx = mmToPx(0.6);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = el.borderThickness || 1;
          ctx.strokeRect(
            xPx - padPx,
            yPx - padPx,
            drawW + (padPx * 2),
            totalH + (padPx * 2)
          );
        }
      } catch (e) {
        console.warn('Barcode render error on server:', e.message);
      }
    } else if (el.type === 'qrcode') {
      try {
        const qrSize = mmToPx((el.mul || 4) * 2.5);
        const qrCanvas = createCanvas(qrSize, qrSize);
        await QRCode.toCanvas(qrCanvas, textVal, {
          width: qrSize,
          margin: 0
        });
        ctx.drawImage(qrCanvas, mmToPx(el.xMm), mmToPx(el.yMm));
      } catch (e) {
        console.warn('QR render error on server:', e.message);
      }
    }
  }
}

/**
 * Converts a Canvas into 1-bit Monochrome BMP buffer
 */
function canvasToMonochromeBmp(canvas, threshold = 128) {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, width, height).data;

  const rowBytes = Math.floor((width + 31) / 32) * 4;
  const imageSize = rowBytes * height;
  const fileSize = 62 + imageSize;

  const buffer = new Uint8Array(fileSize);
  const view = new DataView(buffer.buffer);

  // BITMAPFILEHEADER (14 bytes)
  buffer[0] = 0x42; // 'B'
  buffer[1] = 0x4D; // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint32(10, 62, true);

  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 1, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, imageSize, true);
  view.setInt32(38, 11811, true);
  view.setInt32(42, 11811, true);
  view.setUint32(46, 2, true);
  view.setUint32(50, 2, true);

  // Palette: 0=Black, 1=White
  buffer[54] = 0; buffer[55] = 0; buffer[56] = 0; buffer[57] = 0;
  buffer[58] = 255; buffer[59] = 255; buffer[60] = 255; buffer[61] = 0;

  for (let y = height - 1; y >= 0; y--) {
    const rowOffset = 62 + (height - 1 - y) * rowBytes;
    let byteVal = 0;
    let bitPos = 7;
    let outCol = 0;

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;

      const bit = brightness < threshold ? 0 : 1;
      if (bit === 1) {
        byteVal |= (1 << bitPos);
      }

      bitPos--;
      if (bitPos < 0) {
        buffer[rowOffset + outCol] = byteVal;
        outCol++;
        byteVal = 0;
        bitPos = 7;
      }
    }

    if (bitPos < 7) {
      buffer[rowOffset + outCol] = byteVal;
    }
  }

  return buffer;
}

/**
 * Compiles a server canvas to a binary Graphic EZPL buffer
 */
function compileCanvasToGraphicBuffer(canvas, config = {}, opts = {}) {
  const {
    name = 'STLBL',
    speed = 4,
    gapMm = 3,
    darkness = 10,
    threshold = 128
  } = opts;

  const w = config.widthMm || 35;
  const h = config.heightMm || 22;

  const bmpBytes = canvasToMonochromeBmp(canvas, threshold);

  const headerText =
    `~MDELG,${name}\r\n` +
    `~EB,${name},${bmpBytes.length}\r\n`;

  const footerText =
    `^Q${h},${gapMm}\r\n` +
    `^W${w}\r\n` +
    `^H${darkness}\r\n` +
    `^S${speed}\r\n` +
    `^L\r\n` +
    `Y0,0,${name}\r\n` +
    `E\r\n`;

  const enc = new TextEncoder();
  const headerBytes = enc.encode(headerText);
  const footerBytes = enc.encode(footerText);

  const totalLen = headerBytes.length + bmpBytes.length + footerBytes.length;
  const result = new Uint8Array(totalLen);

  result.set(headerBytes, 0);
  result.set(bmpBytes, headerBytes.length);
  result.set(footerBytes, headerBytes.length + bmpBytes.length);

  return result;
}

/**
 * Server-side Graphic EZPL Generator
 */
async function generateGraphicEZPLForSerials(elements, config, serials, ctx = {}, opts = {}) {
  const globalProduct = ctx.product || '';
  const globalOptionsText = ctx.optionsText || '';
  const globalDeviceName = ctx.deviceName || ctx.categ || '';
  const globalOrigin = ctx.origin || '';

  const effectiveConfig = {
    widthMm: config?.widthMm || 35,
    heightMm: config?.heightMm || 22,
    dpi: config?.dpi || 300
  };

  const W = Math.round((effectiveConfig.widthMm / 25.4) * effectiveConfig.dpi);
  const H = Math.round((effectiveConfig.heightMm / 25.4) * effectiveConfig.dpi);

  const canvas = createCanvas(W, H);
  const items = [];
  const allBuffers = [];

  for (let i = 0; i < serials.length; i++) {
    const item = serials[i];
    const isObj = (typeof item === 'object' && item !== null);
    const sn = isObj ? String(item.serial || item.serial_number || '').trim() : String(item).trim();
    const itemProduct = (isObj && item.product !== undefined) ? item.product : globalProduct;
    const itemOptions = (isObj && (item.options_text !== undefined || item.optionsText !== undefined || item.options !== undefined))
      ? (item.options_text || item.optionsText || item.options)
      : globalOptionsText;
    const itemDevice = (isObj && (item.categ !== undefined || item.deviceName !== undefined || item.device_name !== undefined))
      ? (item.categ || item.deviceName || item.device_name)
      : globalDeviceName;
    const itemOrigin = (isObj && item.origin !== undefined) ? item.origin : globalOrigin;

    const extra = {
      origin: itemOrigin,
      categ: itemDevice,
      order: itemOrigin,
      ...(isObj ? item : {})
    };

    await renderNodeCanvas(canvas, elements, effectiveConfig, sn, itemProduct, itemOptions, itemDevice, extra);
    const graphicName = `LBL${i % 99}`;
    const buf = compileCanvasToGraphicBuffer(canvas, effectiveConfig, { ...opts, name: graphicName });
    
    // Store as Buffer in Node
    const nodeBuf = Buffer.from(buf);
    allBuffers.push(nodeBuf);

    const outItem = {
      serial: sn,
      ezpl_base64: nodeBuf.toString('base64'),
      ezpl: nodeBuf.toString('latin1')
    };
    if (itemOrigin) outItem.origin = itemOrigin;
    if (itemDevice) outItem.categ = itemDevice;
    if (itemProduct) outItem.product = itemProduct;
    if (itemOptions) outItem.options = Array.isArray(itemOptions) ? itemOptions.join(', ') : itemOptions;

    items.push(outItem);
  }

  const combinedBuffer = Buffer.concat(allBuffers);

  return {
    items,
    all_ezpl_base64: combinedBuffer.toString('base64'),
    all_ezpl: combinedBuffer.toString('latin1')
  };
}

module.exports = {
  renderNodeCanvas,
  canvasToMonochromeBmp,
  compileCanvasToGraphicBuffer,
  generateGraphicEZPLForSerials
};
