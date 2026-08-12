import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { resolveElementText } from './stOptionResolver.js';

const imageCache = new Map();
const PRINTER_DPI = 203;

export function getCachedImage(src) {
  if (!src) return Promise.resolve(null);
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src));
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function renderStCanvasDynamic(canvas, elements = [], config = {}, serial = '3726 0001', product = '', optionsText = '') {
  if (!canvas) return;
  const dpi = PRINTER_DPI;
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
    const textVal = resolveElementText(el, optionsText, serial, product || 'S695 4035 (Air)');

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
      const img = await getCachedImage(el.src);
      if (img && img.naturalWidth > 0) {
        const imgW = mmToPx(el.widthMm || 10);
        const imgH = Math.round(img.height * (imgW / img.width));
        let x = mmToPx(el.xMm || 0);
        let y = mmToPx(el.yMm || 0);
        if (el.autoBottomRight) {
          x = W - imgW - mmToPx(1);
          y = H - imgH - mmToPx(1);
        }
        ctx.drawImage(img, x, y, imgW, imgH);
      }
    } else if (el.type === 'barcode') {
      try {
        const offscreenCanvas = document.createElement('canvas');
        JsBarcode(offscreenCanvas, textVal, {
          format: 'CODE128',
          width: 2,
          height: mmToPx(el.heightMm || 10),
          displayValue: el.readable !== false,
          fontSize: ptToPx(4),
          margin: 0
        });
        const drawW = el.widthMm ? mmToPx(el.widthMm) : offscreenCanvas.width;
        const drawH = offscreenCanvas.height;
        ctx.drawImage(offscreenCanvas, mmToPx(el.xMm), mmToPx(el.yMm), drawW, drawH);
      } catch (e) {
        console.warn('Barcode render error:', e);
      }
    } else if (el.type === 'qrcode') {
      try {
        const offscreenCanvas = document.createElement('canvas');
        await QRCode.toCanvas(offscreenCanvas, textVal, {
          width: mmToPx((el.mul || 4) * 2.5),
          margin: 0
        });
        ctx.drawImage(offscreenCanvas, mmToPx(el.xMm), mmToPx(el.yMm));
      } catch (e) {
        console.warn('QR render error:', e);
      }
    }
  }
}
