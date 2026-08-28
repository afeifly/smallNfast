import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { resolveElementText } from './stOptionResolver.js';

export function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Read image pixel dimensions from a raw buffer by parsing the file header.
 * Supports PNG, JPEG, GIF and BMP. Returns { width, height } or a 1:1 fallback.
 */
export function parseImageSize(buf) {
  const fallback = { width: 100, height: 100 };
  try {
    if (!buf || buf.length < 16) return fallback;
    // PNG: 8-byte sig + IHDR (width @16, height @20, big-endian)
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0) return { width, height };
      return fallback;
    }
    // JPEG: walk markers until SOF (height @i+5, width @i+7, big-endian)
    if (buf[0] === 0xFF && buf[1] === 0xD8) {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xFF) { i++; continue; }
        const marker = buf[i + 1];
        if (marker === 0xD8 || marker === 0x01) { i += 2; continue; }
        if (marker >= 0xD0 && marker <= 0xD7) { i += 2; continue; }
        if (marker === 0xD9 || marker === 0xDA) break;
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
          const height = buf.readUInt16BE(i + 5);
          const width = buf.readUInt16BE(i + 7);
          if (width > 0 && height > 0) return { width, height };
          return fallback;
        }
        i += 2 + len;
      }
      return fallback;
    }
    // GIF: "GIF87a"/"GIF89a", width @6, height @8, little-endian
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
      const width = buf.readUInt16LE(6);
      const height = buf.readUInt16LE(8);
      if (width > 0 && height > 0) return { width, height };
      return fallback;
    }
    // BMP: "BM", width @18 (signed), height @22 (signed, may be negative)
    if (buf[0] === 0x42 && buf[1] === 0x4D) {
      const width = buf.readInt32LE(18);
      const height = Math.abs(buf.readInt32LE(22));
      if (width > 0 && height > 0) return { width, height };
      return fallback;
    }
  } catch (e) {
    console.warn('parseImageSize failed:', e);
  }
  return fallback;
}

export function measureTextWidthDots(text, pt = 4, dpi = 203) {
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = `${pt}pt "Microsoft Sans Serif", "Arial", "Helvetica", sans-serif`;
    const px = ctx.measureText(text).width;
    return Math.max(1, Math.ceil(px * (dpi / 96)));
  } catch (e) {
    return Math.ceil(text.length * pt * (dpi / 72) * 0.55);
  }
}

export async function getQrCodeBase64(text, mul = 4) {
  if (!text) return { data: '' };
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      margin: 1,
      scale: Math.max(2, Math.min(10, mul || 4)),
      errorCorrectionLevel: 'M'
    });
    const b64 = dataUrl.split(',')[1] || '';
    return { data: b64 };
  } catch (e) {
    console.warn('QRCode generation failed for text:', text, e);
    return { data: '' };
  }
}

export async function getBarcodeBase64(text, heightDots = 40, readable = true) {
  if (!text) return { data: '', width: 0, height: 0 };
  if (typeof window !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, text, {
        format: 'CODE128',
        width: 2,
        height: Math.max(10, heightDots),
        displayValue: !!readable,
        font: 'Arial',
        fontOptions: 'bold',
        fontSize: 14,
        textMargin: 3,
        margin: 2
      });
      const dataUrl = canvas.toDataURL('image/png');
      return {
        data: dataUrl.split(',')[1] || '',
        width: canvas.width,
        height: canvas.height
      };
    } catch (e) {
      console.warn('Browser barcode generation failed:', e);
      return { data: '', width: 0, height: 0 };
    }
  }

  // Node.js environment: pure JS PNG generation from Code128 bit pattern
  try {
    const zlib = (await import('zlib')).default || (await import('zlib'));
    const CODE128 = JsBarcode.getModule('CODE128');
    const encoder = new CODE128(text, { format: 'CODE128' });
    const encoded = encoder.encode();
    const bits = encoded.data;
    const moduleWidth = 2;
    const quietZone = 10;
    const totalModules = bits.length + (quietZone * 2);
    const width = totalModules * moduleWidth;
    const height = Math.max(20, heightDots);

    const crc32 = (buf) => {
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];
        for (let j = 0; j < 8; j++) {
          crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
        }
      }
      return (crc ^ 0xFFFFFFFF) >>> 0;
    };

    const makeChunk = (type, data) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length, 0);
      const typeBuf = Buffer.from(type, 'ascii');
      const body = Buffer.concat([typeBuf, data]);
      const crcBuf = Buffer.alloc(4);
      crcBuf.writeUInt32BE(crc32(body), 0);
      return Buffer.concat([len, body, crcBuf]);
    };

    const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 0;
    ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const ihdrChunk = makeChunk('IHDR', ihdr);

    const rowLen = 1 + width;
    const raw = Buffer.alloc(rowLen * height);
    for (let y = 0; y < height; y++) {
      raw[y * rowLen] = 0;
      for (let x = 0; x < width; x++) {
        const mod = Math.floor(x / moduleWidth) - quietZone;
        raw[y * rowLen + 1 + x] = (mod >= 0 && mod < bits.length && bits[mod] === '1') ? 0 : 255;
      }
    }

    const idatChunk = makeChunk('IDAT', zlib.deflateSync(raw));
    const iendChunk = makeChunk('IEND', Buffer.alloc(0));
    const pngBuf = Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);

    return {
      data: pngBuf.toString('base64'),
      width,
      height
    };
  } catch (e) {
    console.warn('Node.js barcode generation failed:', e);
    return { data: '', width: 0, height: 0 };
  }
}

export async function getImageBase64(src) {
  if (!src) return { data: '', width: 0, height: 0 };

  // Node.js environment check
  if (typeof window === 'undefined') {
    try {
      const fs = await import('fs');
      const path = await import('path');
      let localPath = src;
      if (src.startsWith('/')) {
        localPath = path.join(process.cwd(), 'public', src);
      }
      if (fs.existsSync(localPath)) {
        const buf = fs.readFileSync(localPath);
        const size = parseImageSize(buf);
        return { data: buf.toString('base64'), width: size.width, height: size.height };
      }
    } catch (e) {
      console.warn('Node.js getImageBase64 file read failed:', e);
    }
    if (src.startsWith('data:')) {
      const b64 = src.split(',')[1] || '';
      const size = parseImageSize(Buffer.from(b64, 'base64'));
      return { data: b64, width: size.width, height: size.height };
    }
    return { data: '', width: 0, height: 0 };
  }

  // Browser environment
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width || 100;
        const h = img.naturalHeight || img.height || 100;
        let b64;
        if (src.startsWith('data:')) {
          b64 = src.split(',')[1] || '';
        } else {
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = c.toDataURL('image/png');
          b64 = dataUrl.split(',')[1] || '';
        }
        resolve({ data: b64, width: w, height: h });
      } catch (e) {
        console.warn('Canvas toDataURL failed for image:', src, e);
        resolve({ data: '', width: 0, height: 0 });
      }
    };
    img.onerror = (err) => {
      console.warn('Image load error for src:', src, err);
      resolve({ data: '', width: 0, height: 0 });
    };
    if (src.startsWith('/')) {
      img.src = window.location.origin + src;
    } else {
      img.src = src;
    }
  });
}

/**
 * Compile EZPX for a single serial (original single-label mode).
 * For multi-label serial range with auto-increment, call compileEZPXRange.
 */
export async function compileEZPX(elements = [], config = {}, serial = '3726 0001') {
  return compileEZPXRange(elements, config, [serial], { labelsPerCut: 0 });
}


/**
 * Compile EZPX with GoLabel serial auto-increment (^C00 counter command).
 *
 * How GoLabel serial counter works (discovered from a real GoLabel EZPX file):
 *   - SerialFormat[0] = "startNum,+step,Prompt,currentNum,nextNum"  (CSV string)
 *   - SerialLeadingCode[0] = 1  (preserve leading zeros)
 *   - Elements using serial: Data = prefix + "^C00"  (counter command reference)
 *                            DispData = rendered first SN (for preview)
 *                            DataField = "None"  (NOT "Serial")
 *                            ItemSymbol = 2, ItemData = prefix + "^C00"
 *   - Setup Number = totalCount  (GoLabel auto-increments ^C00 for each label)
 *
 * @param {Array}    elements    - Label elements
 * @param {Object}   config      - { widthMm, heightMm, dpi }
 * @param {string[]} serialRange - All serial strings e.g. ['12345678','12345679','12345680']
 * @param {Object}   options     - { labelsPerCut: 0 = no cut }
 */
export async function compileEZPXRange(elements = [], config = {}, serialRange = ['3726 0001'], options = {}) {
  const firstSN    = serialRange[0] || '3726 0001';
  const totalCount = serialRange.length;
  const labelsPerCut = options.labelsPerCut ?? 0;
  // csvDatabase: generate a CSV-database EZPX (SNs loaded from data.csv, one label per row)
  // instead of the GoLabel ^C00 serial counter.
  const csvDatabase = !!options.csvDatabase;
  const extraObj = (options && typeof options === 'object' && options.extra && typeof options.extra === 'object')
    ? options.extra
    : {};

  const w = config.widthMm  || 35;
  const h = config.heightMm || 22;
  const ezpxDpi = config.dpi || 203;
  let printerModel = 'G500';
  if (ezpxDpi === 300)      printerModel = 'EZ-1300+';
  else if (ezpxDpi === 600) printerModel = 'RT863i+';
  const mmToDots = (mm) => Math.round((mm / 25.4) * ezpxDpi);

  // ── Parse serial to extract prefix, numeric start/pad, step, and end ──
  const parseTrail = (s) => {
    const m = String(s).replace(/\s+/g, ' ').match(/^(.*?)(\d+)$/);
    return m ? { prefix: m[1], digits: m[2], val: parseInt(m[2], 10) } : null;
  };

  const lastSN = serialRange[totalCount - 1] || firstSN;

  let serialPrefix   = '';
  let serialStartStr = firstSN;
  let serialStartNum = 0;
  let serialEndStr   = firstSN;
  let serialStep     = 1;
  const hasSerialRange = totalCount > 1;

  if (hasSerialRange) {
    const p0   = parseTrail(firstSN);
    const p1   = parseTrail(serialRange[1] || firstSN);
    const pEnd = parseTrail(lastSN);
    if (p0 && p1) {
      serialPrefix   = p0.prefix;
      serialStartStr = p0.digits;          // e.g. "0001" or "12345678"
      serialStartNum = p0.val;
      serialEndStr   = pEnd ? pEnd.digits : p0.digits; // e.g. "0003" or "12345680"
      serialStep     = p1.val - p0.val;
      if (serialStep < 1) serialStep = 1;
    }
  }

  // GoLabel SerialFormat string: "StartVal,+Step,PromptMode,LowVal,HighVal"
  const serialFormatStr = `${serialStartStr},+${serialStep},Prompt,${serialStartStr},${serialEndStr}`;

  // Counter command reference for elements: e.g. "3726 ^C00" or just "^C00"
  const counterStr = serialPrefix + '^C00';

  // ── Helper ─────────────────────────────────────────────────────────────
  const usesSerial = (el) => /\{\{serial\}\}/.test(el.text || el.data || '');

  // ── 100-slot XML arrays ────────────────────────────────────────────────
  // SerialFormat: slot 0 = counter def when counter mode; rest = empty <string />
  // SerialLeadingCode: slot 0 = 1 (leading-zero flag); rest = 0
  const useCounter = !csvDatabase && hasSerialRange;

  const serialFormatXml = Array.from({ length: 100 }, (_, i) =>
    (i === 0 && useCounter)
      ? `<string>${escapeXml(serialFormatStr)}</string>`
      : '<string />'
  ).join('\n      ');

  const serialLeadingXml = Array.from({ length: 100 }, (_, i) =>
    (i === 0 && useCounter) ? '<int>1</int>' : '<int>0</int>'
  ).join('\n      ');

  const nullString100 = Array(100).fill('<string xsi:nil="true" />').join('\n      ');
  const falseBool100  = Array(100).fill('<boolean>false</boolean>').join('\n      ');

  // ── Build qlabel shapes ───────────────────────────────────────────────
  let qlabelShapes = '';
  const productVal = (options && typeof options === 'object' && options.product) ? options.product : '';
  const optionsVal = (options && typeof options === 'object' && options.optionsText) ? options.optionsText : '';
  const deviceNameVal = (options && typeof options === 'object' && options.deviceName) ? options.deviceName : '';

  for (let index = 0; index < elements.length; index++) {
    const el = elements[index];
    if (el.type === 'folder') continue;

    const resolvedText = resolveElementText(el, optionsVal, '', productVal, deviceNameVal, extraObj);
    // DispData: always the rendered first SN (for GoLabel preview)
    const dispVal     = resolvedText.replace(/\{\{serial\}\}/g, firstSN);
    const escapedDisp = escapeXml(dispVal);

    // elUsesSerial: element references {{serial}}; in CSV-DB mode always (field ^F00),
    // otherwise only when range > 1 (GoLabel ^C00 counter)
    const elUsesSerial = csvDatabase ? usesSerial(el) : (hasSerialRange && usesSerial(el));

    // Data / ItemData: DB field ref ^F00 in CSV mode, ^C00 counter otherwise
    const serialRef  = csvDatabase ? '^F00' : counterStr;
    const dataVal    = elUsesSerial
      ? resolvedText.replace(/\{\{serial\}\}/g, serialRef)
      : dispVal;
    const escapedData = escapeXml(dataVal);

    // Skip text/barcode/QR elements whose resolved value is empty (e.g. an
    // option-mapped field with no matching code) so nothing prints instead of
    // a GoLabel "<Empty>" placeholder.
    if ((el.type === 'text' || el.type === 'barcode' || el.type === 'qrcode') && !dataVal.trim()) {
      continue;
    }

    // ItemSymbol: 1 = literal text, 2 = serial counter, 5 = DB field reference
    const itemSymbol = elUsesSerial ? (csvDatabase ? 5 : 2) : 1;

    if (el.type === 'text') {
      const fontPt      = el.fontSize || 4;
      const fontCmdStr  = el.bold ? `Arial,${fontPt},B\r\n` : `Arial,${fontPt}\r\n`;
      const fontHeightPx = Math.round((fontPt / 72) * ezpxDpi * 1.2);
      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);

      const endX = el.endXMm !== undefined ? el.endXMm : el.x1Mm;
      let rectW, rectH;
      if (endX && endX > el.xMm) {
        const maxWDots = mmToDots(endX - el.xMm);
        rectW = maxWDots;
        const rawW = measureTextWidthDots(dispVal, fontPt, ezpxDpi);
        const estimatedLines = Math.max(1, Math.ceil(rawW / maxWDots));
        rectH = Math.max(12, fontHeightPx * estimatedLines);
      } else {
        rectW = measureTextWidthDots(dispVal, fontPt, ezpxDpi);
        rectH = Math.max(12, fontHeightPx);
      }

      qlabelShapes += `
      <GraphicShape xsi:type="WindowText" Style="Cross" IsPrint="true" PageAlignment="None" Locked="false" bStroke="false" bFill="true" Direction="Angle0" X="${x}" Y="${y}" Alignment="Left" AlignPointX="${x}" AlignPointY="${y}" FontScript="Default" FontCmd="${escapeXml(fontCmdStr)}" FontHeight="1000" FontWidth="1000" TextSpace="0" bSpaceCropping="false">
        <qHitOnCircumferance>false</qHitOnCircumferance>
        <Selected>false</Selected>
        <iBackground_color>4294967295</iBackground_color>
        <Id>${index}</Id>
        <ItemLabel>${escapeXml(el.name || `WindowText_${index}`)}</ItemLabel>
        <ObjectDrawMode>FW</ObjectDrawMode>
        <Name>W</Name>
        <GroupID>0</GroupID>
        <GroupSelected>false</GroupSelected>
        <CharTruncateRule>
          <TrimLeft>false</TrimLeft>
          <TrimRight>false</TrimRight>
          <RemoveCharLeft>false</RemoveCharLeft>
          <RemoveCharLeftNo>0</RemoveCharLeftNo>
          <RemoveCharRight>false</RemoveCharRight>
          <RemoveCharRightNo>0</RemoveCharRightNo>
          <KeepCharLeft>false</KeepCharLeft>
          <KeepCharLeftNo>6</KeepCharLeftNo>
          <KeepCharRight>false</KeepCharRight>
          <KeepCharRightNo>6</KeepCharRightNo>
          <RemoveDotZero>false</RemoveDotZero>
        </CharTruncateRule>
        <bReplaceSpecialCharFromDB>false</bReplaceSpecialCharFromDB>
        <ScriptCode_Base64 />
        <CharFilterRule>None</CharFilterRule>
        <LinkMode>OriginalData</LinkMode>
        <GraphicMode>false</GraphicMode>
        <ReplaceInfoItems />
        <FormatType>None</FormatType>
        <P1 />
        <P2 />
        <P3 />
        <P4 />
        <Culture>zh-CN</Culture>
        <calendar>GregorianCalendar</calendar>
        <GetAiFromDigitalLink>false</GetAiFromDigitalLink>
        <DataField>None</DataField>
        <Prompt>None</Prompt>
        <BoundRectWidth>${rectW}</BoundRectWidth>
        <DispData>${escapedDisp}</DispData>
        <bRemovePreZeroAndEmpty>false</bRemovePreZeroAndEmpty>
        <Data>${escapedData}</Data>
        <ItemInfoList>
          <Item>
            <ItemSymbol>${itemSymbol}</ItemSymbol>
            <ItemData>${escapedData}</ItemData>
          </Item>
        </ItemInfoList>
        <BoundRectHeight>${rectH}</BoundRectHeight>
        <BoundRect>
          <Location>
            <X>${x}</X>
            <Y>${y}</Y>
          </Location>
          <Size>
            <Width>${rectW}</Width>
            <Height>${rectH}</Height>
          </Size>
          <X>${x}</X>
          <Y>${y}</Y>
          <Width>${rectW}</Width>
          <Height>${rectH}</Height>
        </BoundRect>
        <BTrueType>true</BTrueType>
        <Angle>0</Angle>
        <IsInverse>false</IsInverse>
        <bVerticalRedirection>false</bVerticalRedirection>
        <VerticalKerningOffset>0</VerticalKerningOffset>
        <CharacterSpacingRate>0</CharacterSpacingRate>
      </GraphicShape>`;

    } else if (el.type === 'hline' || el.type === 'vline') {
      const isVertical = el.lineShape === 'VLine' || el.type === 'vline' || (el.x1Mm !== undefined && el.x1Mm === el.xMm);
      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);
      let lineShapeStr, wVal, hVal;
      if (isVertical) {
        lineShapeStr = 'VLine';
        wVal = el.thicknessDots || 5;
        const endY = el.y1Mm !== undefined ? el.y1Mm : (el.yMm + (el.heightMm || 3.0));
        hVal = Math.max(1, mmToDots(endY - el.yMm));
      } else {
        lineShapeStr = 'HLine';
        const endX = el.x1Mm !== undefined ? el.x1Mm : w;
        wVal = Math.max(1, mmToDots(endX - el.xMm));
        hVal = el.thicknessDots || 5;
      }
      qlabelShapes += `
      <GraphicShape xsi:type="Line" Style="Cross" IsPrint="true" PageAlignment="None" Locked="false" bStroke="true" bFill="true" Direction="Angle0" X="${x}" Y="${y}" Alignment="Left" AlignPointX="${x}" AlignPointY="${y}">
        <qHitOnCircumferance>false</qHitOnCircumferance>
        <Selected>false</Selected>
        <iBackground_color>4294967295</iBackground_color>
        <Id>${index}</Id>
        <ItemLabel>${escapeXml(el.name || `Line_${index}`)}</ItemLabel>
        <ObjectDrawMode>FW</ObjectDrawMode>
        <Name>L</Name>
        <GroupID>0</GroupID>
        <GroupSelected>false</GroupSelected>
        <lineShape>${lineShapeStr}</lineShape>
        <Height>${hVal}</Height>
        <Operation>111</Operation>
        <Width>${wVal}</Width>
      </GraphicShape>`;

    } else if (el.type === 'image') {
      const imgInfo    = await getImageBase64(el.src);
      const base64Data = imgInfo.data;
      const widthMm    = el.widthMm || 10;
      let heightMm;
      if (el.heightMm)             heightMm = el.heightMm;
      else if (imgInfo.width > 0)  heightMm = widthMm * (imgInfo.height / imgInfo.width);
      else                         heightMm = widthMm * 0.45;

      let xMm = el.xMm || 0, yMm = el.yMm || 0;
      if (el.autoBottomRight) { xMm = w - widthMm - 1; yMm = h - heightMm - 1; }

      const x     = mmToDots(xMm);
      const y     = mmToDots(yMm);
      const wDots = mmToDots(widthMm);
      const hDots = mmToDots(heightMm);
      const graphicName = (el.storedName || el.name || `Graphic_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');

      qlabelShapes += `
      <GraphicShape xsi:type="Image" Style="Cross" IsPrint="true" PageAlignment="None" Locked="false" bStroke="true" bFill="true" Direction="Angle0" X="${x}" Y="${y}" Alignment="Left" AlignPointX="${x}" AlignPointY="${y}" FontScript="Default" FixedRatio="false">
        <qHitOnCircumferance>false</qHitOnCircumferance>
        <Selected>false</Selected>
        <iBackground_color>4294967295</iBackground_color>
        <Id>${index}</Id>
        <ItemLabel>${escapeXml(el.name || `Image_${index}`)}</ItemLabel>
        <ObjectDrawMode>FW</ObjectDrawMode>
        <Name>Y</Name>
        <GroupID>0</GroupID>
        <GroupSelected>false</GroupSelected>
        <CharTruncateRule>
          <TrimLeft>false</TrimLeft>
          <TrimRight>false</TrimRight>
          <RemoveCharLeft>false</RemoveCharLeft>
          <RemoveCharLeftNo>0</RemoveCharLeftNo>
          <RemoveCharRight>false</RemoveCharRight>
          <RemoveCharRightNo>0</RemoveCharRightNo>
          <KeepCharLeft>false</KeepCharLeft>
          <KeepCharLeftNo>6</KeepCharLeftNo>
          <KeepCharRight>false</KeepCharRight>
          <KeepCharRightNo>6</KeepCharRightNo>
          <RemoveDotZero>false</RemoveDotZero>
        </CharTruncateRule>
        <bReplaceSpecialCharFromDB>false</bReplaceSpecialCharFromDB>
        <ScriptCode_Base64 />
        <CharFilterRule>None</CharFilterRule>
        <LinkMode>OriginalData</LinkMode>
        <GraphicMode>false</GraphicMode>
        <ReplaceInfoItems />
        <FormatType>None</FormatType>
        <P1 />
        <P2 />
        <P3 />
        <P4 />
        <Culture>zh-CN</Culture>
        <calendar>GregorianCalendar</calendar>
        <GetAiFromDigitalLink>false</GetAiFromDigitalLink>
        <DataField>None</DataField>
        <Prompt>None</Prompt>
        <BoundRectWidth>${wDots}</BoundRectWidth>
        <DispData />
        <bRemovePreZeroAndEmpty>false</bRemovePreZeroAndEmpty>
        <Data />
        <ItemInfoList />
        <BoundRectHeight>${hDots}</BoundRectHeight>
        <BoundRect>
          <Location><X>${x}</X><Y>${y}</Y></Location>
          <Size><Width>${wDots}</Width><Height>${hDots}</Height></Size>
          <X>${x}</X><Y>${y}</Y><Width>${wDots}</Width><Height>${hDots}</Height>
        </BoundRect>
        <BitmapCmd>${base64Data}</BitmapCmd>
        <FixedAspectRatio>false</FixedAspectRatio>
        <LoadToDevice>false</LoadToDevice>
        <FileName>${escapeXml(graphicName)}</FileName>
        <Identifier />
        <DitherType>Default</DitherType>
        <RotationFlip>RotateNoneFlipNone</RotationFlip>
        <Angle>0</Angle>
        <Binverse>false</Binverse>
      </GraphicShape>`;

    } else if (el.type === 'barcode') {
      const x          = mmToDots(el.xMm || 0);
      const y          = mmToDots(el.yMm || 0);
      const heightDots = mmToDots(el.heightMm || 10);
      const readable   = el.readable !== false;
      const captionAlign = readable ? 'BottomAndLeft' : 'None';
      let narrow = 3;
      if (el.widthMm) {
        const totalModules = (escapedData.length * 11) + 35;
        narrow = Math.max(1, Math.round(mmToDots(el.widthMm) / totalModules));
      }
      const totalModules = (escapedData.length * 11) + 35;
      const wDots = el.widthMm ? mmToDots(el.widthMm) : (totalModules * narrow);
      const hDots = heightDots + (readable ? 36 : 0);
      const barcodeFontPt = Math.max(8, Math.round((el.fontSize || 5) * 1.8));
      const barcodeFontCmd = `Arial,${barcodeFontPt},B\r\n`;

      qlabelShapes += `
      <GraphicShape xsi:type="BarCode" Style="Cross" IsPrint="true" PageAlignment="None" Locked="false" bStroke="true" bFill="true" Direction="Angle0" X="${x}" Y="${y}" Alignment="Left" AlignPointX="${x}" AlignPointY="${y}" FontScript="Default" FontCmd="${escapeXml(barcodeFontCmd)}" Symbology="Code128Auto" CaptionAlignment="${captionAlign}" Height="${heightDots}" Width="8" Narrow="${narrow}" BearerBarStyle="3" BearerBarWidth="5" QuietZoneWidth="9" BoxThickness="3" Offset="1" bDisplayChecksum="false" bDisplayStartStopChar="false" bBuiltinFont="false" bSetBuiltinFontSize="false" Code128Subset="Auto">
        <qHitOnCircumferance>false</qHitOnCircumferance>
        <Selected>false</Selected>
        <iBackground_color>4294967295</iBackground_color>
        <Id>${index}</Id>
        <ItemLabel>${escapeXml(el.name || `BarCode_${index}`)}</ItemLabel>
        <ObjectDrawMode>FW</ObjectDrawMode>
        <Name>B</Name>
        <GroupID>0</GroupID>
        <GroupSelected>false</GroupSelected>
        <CharTruncateRule>
          <TrimLeft>false</TrimLeft>
          <TrimRight>false</TrimRight>
          <RemoveCharLeft>false</RemoveCharLeft>
          <RemoveCharLeftNo>0</RemoveCharLeftNo>
          <RemoveCharRight>false</RemoveCharRight>
          <RemoveCharRightNo>0</RemoveCharRightNo>
          <KeepCharLeft>false</KeepCharLeft>
          <KeepCharLeftNo>6</KeepCharLeftNo>
          <KeepCharRight>false</KeepCharRight>
          <KeepCharRightNo>6</KeepCharRightNo>
          <RemoveDotZero>false</RemoveDotZero>
        </CharTruncateRule>
        <bReplaceSpecialCharFromDB>false</bReplaceSpecialCharFromDB>
        <ScriptCode_Base64 />
        <CharFilterRule>None</CharFilterRule>
        <LinkMode>OriginalData</LinkMode>
        <GraphicMode>false</GraphicMode>
        <ReplaceInfoItems />
        <FormatType>None</FormatType>
        <P1 />
        <P2 />
        <P3 />
        <P4 />
        <Culture>zh-CN</Culture>
        <calendar>GregorianCalendar</calendar>
        <GetAiFromDigitalLink>false</GetAiFromDigitalLink>
        <DataField>None</DataField>
        <Prompt>None</Prompt>
        <BoundRectWidth>${wDots}</BoundRectWidth>
        <DispData>${escapedDisp}</DispData>
        <bRemovePreZeroAndEmpty>false</bRemovePreZeroAndEmpty>
        <Data>${escapedData}</Data>
        <ItemInfoList>
          <Item>
            <ItemSymbol>${itemSymbol}</ItemSymbol>
            <ItemData>${escapedData}</ItemData>
          </Item>
        </ItemInfoList>
        <BoundRectHeight>${hDots}</BoundRectHeight>
        <BoundRect>
          <Location>
            <X>${x}</X>
            <Y>${y}</Y>
          </Location>
          <Size>
            <Width>${wDots}</Width>
            <Height>${hDots}</Height>
          </Size>
          <X>${x}</X>
          <Y>${y}</Y>
          <Width>${wDots}</Width>
          <Height>${hDots}</Height>
        </BoundRect>
        <CheckDigitType>MOD_43</CheckDigitType>
        <Use_ITF_T2>true</Use_ITF_T2>
        <CustomizeGuardBar>false</CustomizeGuardBar>
        <GuardBarHeight>0</GuardBarHeight>
        <ISBT_AutoCheckSum>true</ISBT_AutoCheckSum>
        <UPC_SplitCodeText>true</UPC_SplitCodeText>
        <UPC_ShrinkSplitText>false</UPC_ShrinkSplitText>
        <UPC_HideCheckDigit>false</UPC_HideCheckDigit>
      </GraphicShape>`;

    } else if (el.type === 'qrcode') {
      const x   = mmToDots(el.xMm || 0);
      const y   = mmToDots(el.yMm || 0);
      const rawMul = Number(el.mul) || 4;
      const goLabelMultiple = Math.max(1, rawMul - 1);
      const sizeMm = el.widthMm || (rawMul * 2.5) || 10;
      const wDots = mmToDots(sizeMm);
      const hDots = mmToDots(sizeMm);

      const isSuto = csvDatabase && (el.qrMode === 'suto_protocol' || el.isSutoProtocol);
      const qrDataVal = isSuto ? '^F01' : escapedData;
      const qrItemSymbol = isSuto ? 5 : itemSymbol;
      const qrDataField = isSuto ? 'qr_code' : 'None';

      qlabelShapes += `
      <GraphicShape xsi:type="QRCode" Style="Cross" IsPrint="true" PageAlignment="None" Locked="false" bStroke="true" bFill="true" Direction="Angle0" X="${x}" Y="${y}" Alignment="Center" AlignPointX="${x}" AlignPointY="${y}" FontScript="Default" bSingleLine="false" CaptionWidth="150" bGS1="false" DigitalLink="false" CaptionAlignment="None" FontCmd="Arial,12&#xD;&#xA;" Mode="Auto" Type="2" ErrorCorrectionLevel="77" QrcodeVersion="0" Mask="8" Multiple="${goLabelMultiple}" IsUTF8="true" CodePage="65001">
        <qHitOnCircumferance>false</qHitOnCircumferance>
        <Selected>false</Selected>
        <iBackground_color>4294967295</iBackground_color>
        <Id>${index}</Id>
        <ItemLabel>${escapeXml(el.name || `QRCode_${index}`)}</ItemLabel>
        <ObjectDrawMode>FW</ObjectDrawMode>
        <Name>W</Name>
        <GroupID>0</GroupID>
        <GroupSelected>false</GroupSelected>
        <CharTruncateRule>
          <TrimLeft>false</TrimLeft>
          <TrimRight>false</TrimRight>
          <RemoveCharLeft>false</RemoveCharLeft>
          <RemoveCharLeftNo>0</RemoveCharLeftNo>
          <RemoveCharRight>false</RemoveCharRight>
          <RemoveCharRightNo>0</RemoveCharRightNo>
          <KeepCharLeft>false</KeepCharLeft>
          <KeepCharLeftNo>6</KeepCharLeftNo>
          <KeepCharRight>false</KeepCharRight>
          <KeepCharRightNo>6</KeepCharRightNo>
          <RemoveDotZero>false</RemoveDotZero>
        </CharTruncateRule>
        <bReplaceSpecialCharFromDB>false</bReplaceSpecialCharFromDB>
        <ScriptCode_Base64 />
        <CharFilterRule>None</CharFilterRule>
        <LinkMode>OriginalData</LinkMode>
        <GraphicMode>false</GraphicMode>
        <ReplaceInfoItems />
        <FormatType>None</FormatType>
        <P1 />
        <P2 />
        <P3 />
        <P4 />
        <Culture>zh-CN</Culture>
        <calendar>GregorianCalendar</calendar>
        <GetAiFromDigitalLink>false</GetAiFromDigitalLink>
        <DataField>${qrDataField}</DataField>
        <Prompt>None</Prompt>
        <BoundRectWidth>${wDots}</BoundRectWidth>
        <DispData>${escapedDisp}</DispData>
        <bRemovePreZeroAndEmpty>false</bRemovePreZeroAndEmpty>
        <Data>${qrDataVal}</Data>
        <ItemInfoList>
          <Item>
            <ItemSymbol>${qrItemSymbol}</ItemSymbol>
            <ItemData>${qrDataVal}</ItemData>
          </Item>
        </ItemInfoList>
        <BoundRectHeight>${hDots}</BoundRectHeight>
        <BoundRect>
          <Location>
            <X>${x}</X>
            <Y>${y}</Y>
          </Location>
          <Size>
            <Width>${wDots}</Width>
            <Height>${hDots}</Height>
          </Size>
          <X>${x}</X>
          <Y>${y}</Y>
          <Width>${wDots}</Width>
          <Height>${hDots}</Height>
        </BoundRect>
        <BLegacy>true</BLegacy>
        <MultiLineCaption Style="Cross" IsPrint="true" PageAlignment="None" Locked="false" bStroke="true" bFill="true" Direction="Angle0" Alignment="Left" AlignPointX="0" AlignPointY="0" FontScript="Default" FontCmd="Microsoft Sans Serif,24&#xD;&#xA;" LineSpacing="Single" LineHeight="0" Multiple="10" DotBeforePara="0" DotAfterPara="0" FontWidth="24" BTrueType="true">
          <qHitOnCircumferance>false</qHitOnCircumferance>
          <Selected>false</Selected>
          <iBackground_color>4294967295</iBackground_color>
          <Id>${index}</Id>
          <ItemLabel>W${index}</ItemLabel>
          <ObjectDrawMode>FW</ObjectDrawMode>
          <Name>W</Name>
          <GroupID>0</GroupID>
          <GroupSelected>false</GroupSelected>
          <CharTruncateRule>
            <TrimLeft>false</TrimLeft>
            <TrimRight>false</TrimRight>
            <RemoveCharLeft>false</RemoveCharLeft>
            <RemoveCharLeftNo>0</RemoveCharLeftNo>
            <RemoveCharRight>false</RemoveCharRight>
            <RemoveCharRightNo>0</RemoveCharRightNo>
            <KeepCharLeft>false</KeepCharLeft>
            <KeepCharLeftNo>6</KeepCharLeftNo>
            <KeepCharRight>false</KeepCharRight>
            <KeepCharRightNo>6</KeepCharRightNo>
            <RemoveDotZero>false</RemoveDotZero>
          </CharTruncateRule>
          <bReplaceSpecialCharFromDB>false</bReplaceSpecialCharFromDB>
          <CharFilterRule>None</CharFilterRule>
          <LinkMode>OriginalData</LinkMode>
          <GraphicMode>false</GraphicMode>
          <ReplaceInfoItems />
          <FormatType>None</FormatType>
          <P1 />
          <P2 />
          <P3 />
          <P4 />
          <Culture>zh-CN</Culture>
          <calendar>GregorianCalendar</calendar>
          <GetAiFromDigitalLink>false</GetAiFromDigitalLink>
          <DataField>None</DataField>
          <Prompt>None</Prompt>
          <BoundRectWidth>${wDots}</BoundRectWidth>
          <DispData>${escapedDisp}</DispData>
          <bRemovePreZeroAndEmpty>false</bRemovePreZeroAndEmpty>
          <Data>${qrDataVal}</Data>
          <ItemInfoList />
          <BoundRectHeight>${hDots}</BoundRectHeight>
          <BoundRect>
            <Location>
              <X>0</X>
              <Y>0</Y>
            </Location>
            <Size>
              <Width>${wDots}</Width>
              <Height>${hDots}</Height>
            </Size>
            <X>0</X>
            <Y>0</Y>
            <Width>${wDots}</Width>
            <Height>${hDots}</Height>
          </BoundRect>
          <WrapMode>WordWrap</WrapMode>
          <SplitDataByAI>false</SplitDataByAI>
          <TextSpace>0</TextSpace>
        </MultiLineCaption>
        <bWrapBarCodeWidth>false</bWrapBarCodeWidth>
      </GraphicShape>`;
    }
  }

  // ── Final XML output ──────────────────────────────────────────────────
  const dbConfigXml = csvDatabase
    ? `<DataBaseFormat>Text_CommaDelimited</DataBaseFormat>
    <DataBaseFilePath>data.csv</DataBaseFilePath>
    <DataBaseSelection>SELECT  * from \`data#csv\` ;</DataBaseSelection>
    <Delimiter>Delimited(,)</Delimiter>
    <CharacterSet>1252</CharacterSet>
    <UserID />`
    : `<DataBaseFormat>None</DataBaseFormat>
    <DataBaseFilePath />
    <DataBaseSelection />
    <UserID />`;

  return `<?xml version="1.0" encoding="utf-8"?>
<PrintJob xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <FileEncryptPwd />
  <GraphicMode>false</GraphicMode>
  <FormatVersion>1</FormatVersion>
  <QLabelSDKVersion>1.5.9708.17906</QLabelSDKVersion>
  <GoLabelZoomFactor>0.5</GoLabelZoomFactor>
  <Label>
    <Scale>
      <ComName>COM1</ComName>
      <Baudrate>9600</Baudrate>
      <Parity>N</Parity>
      <DataBit>8</DataBit>
      <StopBit>1</StopBit>
      <TCPServerPort>23</TCPServerPort>
      <TCPClientPort>23</TCPClientPort>
    </Scale>
    <SerialFormat>
      ${serialFormatXml}
    </SerialFormat>
    <SerialLeadingCode>
      ${serialLeadingXml}
    </SerialLeadingCode>
    <SerialCustomSequence>
      ${nullString100}
    </SerialCustomSequence>
    <bSerialSpecialCarry>
      ${falseBool100}
    </bSerialSpecialCarry>
    <VariableFormat>
      ${nullString100}
    </VariableFormat>
    <VariableDisplayName>
      ${nullString100}
    </VariableDisplayName>
    <UnitPriceType>None</UnitPriceType>
    <UnitPrice>0</UnitPrice>
    <PricePromptMode>Always</PricePromptMode>
    <TaraType>None</TaraType>
    <Tara>0</Tara>
    <TaraPromptMode>Always</TaraPromptMode>
    <qlabel>${qlabelShapes}
    </qlabel>
    <VariableOpFormat />
    <VariableOption />
    <DateFormat>y2-me-dd</DateFormat>
    <TimeFormat>h:m:s</TimeFormat>
    ${dbConfigXml}
    <Password>zhsTbm6nT9o+RQurpwH5Hw==</Password>
    <EncryptPwd>true</EncryptPwd>
    <DatabaseNoHeader>false</DatabaseNoHeader>
    <IntegratedSecurity>false</IntegratedSecurity>
    <RowIndex>0</RowIndex>
  </Label>
  <Setup bInfinityPrint="false" LabelLength="${h}" LabelWidth="${w}" LeftMargin="0" TopMargin="0" LabelType="0" GapLength="3" FeedLength="0" ZSign="45" BlackMark="3" Position="0" Speed="4" Copy="1" bCopyDataBase="false" CopyField="None" Stripper="0" LabelsPerCut="${labelsPerCut}" DoubleCut_Enable="false" DoubleCut_OffsetLen="0" DoubleCut_FirstCutMode="1" Rotate180="255" Stop="18" Darkness="8" Number="${csvDatabase ? 1 : totalCount}" bCutDataBase="false" bBatchCut="false" bPartialCut="false" bFullCutLast="false" bFullCutEachRecord="false" bNumberDataBase="false" NumberField="None" PageDirection="Portrait" PrintMode="1" bUsePrinterRFIDCfg="false" PowerRFID="0" LengthRFID="-1" RetryRFID="1" DrawMode="0">
    <Layout Shape="0" AcrossType="Copied" PageDirection="Portrait" HorAcross="1" VerAcross="1" HorGap="0" VerGap="0" HorAcrossMode1="1" VerAcrossMode1="1" LabelMode="0" HorGapMode1="0" VerGapMode1="0" BottomMargin="0" RightMargin="0" />
    <Description>Lang:(en-US) OS:Microsoft Windows NT 10.0.26200.0(Win32NT)</Description>
    <UnitType>Mm</UnitType>
    <Dpi>${ezpxDpi}</Dpi>
  </Setup>
  <ProtectAction Darkness="true" Speed="true" Peeler="true" PrintMode="true" StopPosition="true" PageDirection="true" DrawMode="true" Rotate180="true" />
  <DriverName />
  <BLE_MAC />
  <BLE_Address>0</BLE_Address>
  <BLE_AutoMTU>true</BLE_AutoMTU>
  <BLE_MTU>20</BLE_MTU>
  <PrinterModel>${printerModel}</PrinterModel>
  <PrinterLanguage>EZPL</PrinterLanguage>
  <USBName>00000000</USBName>
  <COMName />
  <CommunicationType>USB</CommunicationType>
  <NetworkIPAddress>0</NetworkIPAddress>
  <NetworkPort>9100</NetworkPort>
  <BaudRate>9600</BaudRate>
  <ComSettings>N81</ComSettings>
  <StandaloneDbSearchKey />
  <StandaloneDbEnable>false</StandaloneDbEnable>
  <StandaloneDbMode>PrintByFieldInput</StandaloneDbMode>
</PrintJob>`;
}

/**
 * Build the data.csv content for CSV-database mode.
 * Generates serial number column "sn" (^F00) and SUTO Protocol QR code column "qr_code" (^F01) if present.
 */
export function buildSerialCsv(serialRange = ['3726 0001'], options = {}) {
  const rows = (Array.isArray(serialRange) && serialRange.length > 0) ? serialRange : ['3726 0001'];
  const product = options.product || '';
  const deviceName = options.deviceName || '';
  const optionsText = options.optionsText || '';
  const extraObj = (options && typeof options === 'object' && options.extra && typeof options.extra === 'object')
    ? options.extra
    : {};

  // Collect all elements across main template + sub-templates
  let allElements = [];
  if (Array.isArray(options.defs)) {
    allElements = options.defs.flatMap(d => d.elements || []);
  } else if (Array.isArray(options.allElements)) {
    allElements = options.allElements;
  } else if (Array.isArray(options.elements)) {
    allElements = options.elements;
  }

  // Find if any element across main or sub-templates is a SUTO Protocol QR code
  const sutoQrEl = allElements.find(el =>
    el && el.type === 'qrcode' && (
      el.qrMode === 'suto_protocol' ||
      el.isSutoProtocol ||
      (!el.qrMode && (el.sutoProductType || (el.data && (el.data.includes('sensor') || el.data.includes('{{serial}}') || el.data.includes('{{device_name}}')))))
    )
  );

  const lines = [sutoQrEl ? 'sn,qr_code' : 'sn'];
  rows.forEach(sn => {
    const snVal = String(sn).trim();
    const escSn = /[",\r\n]/.test(snVal) ? `"${snVal.replace(/"/g, '""')}"` : snVal;
    if (sutoQrEl) {
      const qrVal = resolveElementText(sutoQrEl, optionsText, snVal, product, deviceName, extraObj);
      const escQr = /[",\r\n]/.test(qrVal) ? `"${qrVal.replace(/"/g, '""')}"` : qrVal;
      lines.push(`${escSn},${escQr}`);
    } else {
      lines.push(escSn);
    }
  });
  return lines.join('\r\n') + '\r\n';
}
