import { renderStCanvasDynamic } from './stCanvasRenderer.js';

/**
 * Converts an HTML5 Canvas into a standard Windows 1-bit Monochrome BMP file byte array.
 * @param {HTMLCanvasElement} canvas
 * @param {number} threshold - Luminance threshold (0-255) where < threshold is black (dot)
 * @returns {Uint8Array} Binary BMP file data
 */
export function canvasToMonochromeBmp(canvas, threshold = 128) {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, width, height).data;

  // In BMP, each row must be padded to a 4-byte (32-bit) boundary
  const rowBytes = Math.floor((width + 31) / 32) * 4;
  const imageSize = rowBytes * height;
  const fileSize = 62 + imageSize; // 14 (FileHeader) + 40 (InfoHeader) + 8 (Palette) = 62

  const buffer = new Uint8Array(fileSize);
  const view = new DataView(buffer.buffer);

  // 1. BITMAPFILEHEADER (14 bytes)
  buffer[0] = 0x42; // 'B'
  buffer[1] = 0x4D; // 'M'
  view.setUint32(2, fileSize, true); // Total file size
  view.setUint16(6, 0, true);        // Reserved 1
  view.setUint16(8, 0, true);        // Reserved 2
  view.setUint32(10, 62, true);      // Offset to pixel data (14 + 40 + 8)

  // 2. BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true);      // biSize = 40
  view.setInt32(18, width, true);    // biWidth
  view.setInt32(22, height, true);   // biHeight (positive = bottom-up row order)
  view.setUint16(26, 1, true);       // biPlanes = 1
  view.setUint16(28, 1, true);       // biBitCount = 1 (monochrome)
  view.setUint32(30, 0, true);       // biCompression = 0 (BI_RGB, uncompressed)
  view.setUint32(34, imageSize, true);// biSizeImage
  view.setInt32(38, 11811, true);    // biXPelsPerMeter (~300 DPI)
  view.setInt32(42, 11811, true);    // biYPelsPerMeter (~300 DPI)
  view.setUint32(46, 2, true);       // biClrUsed = 2 (Black, White)
  view.setUint32(50, 2, true);       // biClrImportant = 2

  // 3. COLOR PALETTE (8 bytes: 2 entries * 4 bytes RGBA)
  // Index 0: Black (R=0, G=0, B=0, Reserved=0) -> ink dot
  buffer[54] = 0; buffer[55] = 0; buffer[56] = 0; buffer[57] = 0;
  // Index 1: White (R=255, G=255, B=255, Reserved=0) -> blank
  buffer[58] = 255; buffer[59] = 255; buffer[60] = 255; buffer[61] = 0;

  // 4. PIXEL DATA (Bottom-up: scan from y = height - 1 down to 0)
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

      // Palette 0 = Black (< threshold), Palette 1 = White (>= threshold)
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
 * Converts a fully-rendered HTML5 Canvas into a Godex EZPL graphic stream
 * using the official ~EB (Download BMP) + Y (Print Graphic) commands.
 *
 * @param {HTMLCanvasElement} canvas - A fully rendered label canvas
 * @param {Object} config            - { widthMm, heightMm, dpi }
 * @param {Object} [opts]
 * @param {string} [opts.name='STLBL']  - Graphic name in printer memory
 * @param {number} [opts.speed=4]       - Printer speed (^S command)
 * @param {number} [opts.gapMm=3]       - Gap length in mm (^Q second param)
 * @param {number} [opts.darkness=10]   - Print darkness (^H command)
 * @returns {Uint8Array} Binary EZPL stream
 */
export function compileCanvasToGraphicEZPL(canvas, config = {}, opts = {}) {
  const {
    name      = 'STLBL',
    speed     = 4,
    gapMm     = 3,
    darkness  = 10,
    threshold = 128
  } = opts;

  const w = config.widthMm  || 35;
  const h = config.heightMm || 22;

  // 1. Generate real 1-bit BMP byte array
  const bmpBytes = canvasToMonochromeBmp(canvas, threshold);

  // 2. Official Godex EZPL Graphic Commands:
  // ~MDELG,name\r\n -> Delete old graphic from memory first (prevents DUPLICATE NAME error)
  // ~EB,name,length\r\n -> Download BMP of exact byte size
  // ^L\r\nY0,0,name\r\nE\r\n~P1\r\n -> Print placed graphic
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

  // Concatenate: [~MDELG + ~EB Header] + [Raw BMP Binary Bytes] + [Label Print Commands]
  const totalLen = headerBytes.length + bmpBytes.length + footerBytes.length;
  const result = new Uint8Array(totalLen);

  result.set(headerBytes, 0);
  result.set(bmpBytes, headerBytes.length);
  result.set(footerBytes, headerBytes.length + bmpBytes.length);

  return result;
}

/**
 * High-level helper: renders the label canvas for every serial in `serials`,
 * converts each frame to an EZPL ~EB graphic block, and returns a binary Blob.
 *
 * @param {Array}  elements    - Label element definitions
 * @param {Object} config      - { widthMm, heightMm, dpi }
 * @param {Array}  serials     - Array of serial number strings
 * @param {Object} [ctx]       - { product, optionsText, deviceName }
 * @param {Object} [opts]
 * @returns {Promise<Blob>}
 */
export async function compileGraphicEZPLRange(elements, config, serials, ctx = {}, opts = {}) {
  const { product = '', optionsText = '', deviceName = '' } = ctx;

  const effectiveConfig = {
    widthMm: config?.widthMm || 35,
    heightMm: config?.heightMm || 22,
    dpi: config?.dpi || 300
  };

  const offscreen = document.createElement('canvas');
  const parts = [];

  for (let i = 0; i < serials.length; i++) {
    const sn = serials[i];
    await renderStCanvasDynamic(offscreen, elements, effectiveConfig, sn, product, optionsText, deviceName);
    const graphicName = `LBL${i % 99}`;
    parts.push(compileCanvasToGraphicEZPL(offscreen, effectiveConfig, { ...opts, name: graphicName }));
  }

  return new Blob(parts, { type: 'application/octet-stream' });
}
