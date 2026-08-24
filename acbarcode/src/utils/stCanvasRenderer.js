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

export async function renderStCanvasDynamic(canvas, elements = [], config = {}, serial = '3726 0001', product = '', optionsText = '', deviceName = '', extra = {}) {
  if (!canvas) return;
  const dpi = config.dpi || PRINTER_DPI || 203;
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
      ctx.font = `${fontWeight} ${fontSizePx}px "Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", "Helvetica Neue", "Arial", "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

      const endX = el.endXMm !== undefined ? el.endXMm : el.x1Mm; // Support both endXMm and x1Mm
      if (endX && endX > el.xMm) {
        const maxWPx = mmToPx(endX - el.xMm);
        const lines = [];
        const paragraphs = String(textVal).split('\n');
        for (const para of paragraphs) {
          if (!para) {
            lines.push('');
            continue;
          }
          const tokens = para.match(/[\u4e00-\u9fa5\u3040-\u30ff\uff00-\uffef]|[^\s\u4e00-\u9fa5\u3040-\u30ff\uff00-\uffef]+|\s+/g) || [para];
          let currentLine = '';
          for (const token of tokens) {
            if (token.trim() === '' && currentLine === '') {
              continue;
            }
            const testLine = currentLine + token;
            if (ctx.measureText(testLine).width <= maxWPx) {
              currentLine = testLine;
            } else {
              if (currentLine) {
                lines.push(currentLine);
              }
              currentLine = token;
              if (ctx.measureText(currentLine).width > maxWPx) {
                if (currentLine.trim() === '') {
                  currentLine = '';
                  continue;
                }
                let word = currentLine;
                currentLine = '';
                for (let i = 0; i < word.length; i++) {
                  const char = word[i];
                  const testCharLine = currentLine + char;
                  if (ctx.measureText(testCharLine).width <= maxWPx) {
                    currentLine = testCharLine;
                  } else {
                    if (currentLine) {
                      lines.push(currentLine);
                    }
                    currentLine = char;
                  }
                }
              }
            }
          }
          if (currentLine) {
            lines.push(currentLine);
          }
        }

        const trimmedLines = lines.map(line => line.trimEnd());
        const lineHeightPx = Math.round(fontSizePx * 1.2);
        const xPx = mmToPx(el.xMm);
        const startYPx = mmToPx(el.yMm);
        for (let i = 0; i < trimmedLines.length; i++) {
          ctx.fillText(trimmedLines[i], xPx, startYPx + i * lineHeightPx);
        }
      } else {
        ctx.fillText(textVal, mmToPx(el.xMm), mmToPx(el.yMm));
      }
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
        const barHeightPx = mmToPx(el.heightMm || 10);

        // Render barcode bars ONLY (without embedded text) so text is not stretched by drawImage
        JsBarcode(offscreenCanvas, textVal, {
          format: 'CODE128',
          width: 2,
          height: barHeightPx,
          displayValue: false,
          margin: 0
        });

        const drawW = el.widthMm ? mmToPx(el.widthMm) : offscreenCanvas.width;
        const xPx = mmToPx(el.xMm || 0);
        const yPx = mmToPx(el.yMm || 0);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(offscreenCanvas, xPx, yPx, drawW, barHeightPx);

        let totalH = barHeightPx;

        // Render human-readable text directly on canvas with natural aspect ratio (un-stretched)
        if (el.readable !== false && textVal) {
          const fontPt = el.fontSize || 4.5;
          const fontSizePx = ptToPx(fontPt);
          // Medium / semi-bold (600) by default for great readability without blurriness, or 700 for full bold
          const fontWeight = el.bold === false ? '500' : (el.bold === true ? '700' : '600');
          ctx.font = `${fontWeight} ${fontSizePx}px "Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", "Arial", "Helvetica Neue", sans-serif`;
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const textX = xPx + (drawW / 2);
          const textY = yPx + barHeightPx + mmToPx(0.5);
          ctx.fillText(textVal, textX, textY);
          totalH += mmToPx(0.5) + fontSizePx;
        }

        // Draw border box around barcode if border option is enabled
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
        console.warn('Barcode render error:', e);
      }
    } else if (el.type === 'qrcode') {
      try {
        const offscreenCanvas = document.createElement('canvas');
        const qrWidthMm = el.widthMm || ((el.mul || 4) * 2.5);
        const qrSizePx = mmToPx(qrWidthMm);
        await QRCode.toCanvas(offscreenCanvas, textVal, {
          width: qrSizePx,
          margin: 0,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' }
        });
        ctx.drawImage(offscreenCanvas, mmToPx(el.xMm), mmToPx(el.yMm), qrSizePx, qrSizePx);
      } catch (e) {
        console.warn('QR render error:', e);
      }
    }
  }
}
