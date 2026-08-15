import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

export function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function measureTextWidthDots(text, fontPt = 4, dpi = 203) {
  if (!text) return 20;
  const avgCharWidthPt = fontPt * 0.55;
  const totalWidthPt = text.length * avgCharWidthPt;
  const dots = Math.round((totalWidthPt / 72) * dpi);
  return Math.max(15, dots);
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
        fontSize: 12,
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

  // Node.js environment
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

const imageCache = new Map();

export function getImageBase64(src) {
  if (!src) return Promise.resolve({ data: '', width: 0, height: 0 });
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src));
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1] || '';
      const res = { data: base64, width: img.naturalWidth, height: img.naturalHeight };
      imageCache.set(src, res);
      resolve(res);
    };
    img.onerror = () => resolve({ data: '', width: 0, height: 0 });
    img.src = src;
  });
}

export function compileEZPL(elements, config, serial = '3726 0001') {
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
    const textVal = (el.text || el.data || '').replace(/\{\{serial\}\}/g, serial);

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
      ezpl += `${fontCmd},${x},${y},${mul},${mul},0,0,${textVal}\n`;
      if (el.bold) {
        ezpl += `${fontCmd},${x + 1},${y},${mul},${mul},0,0,${textVal}\n`;
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
      ezpl += `BQ,${x},${y},2,5,${heightDots},0,${readable},${textVal}\n`;
    } else if (el.type === 'qrcode') {
      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);
      const mul = el.mul || 4;
      const len = textVal.length;
      ezpl += `W${x},${y},2,2,M,8,${mul},${len},0\n`;
      ezpl += `${textVal}\n`;
    }
  });

  ezpl += `E\n~P1\n`;
  return ezpl;
}

export async function compileEZPX(elements, config, serial = '3726 0001') {
  const w = config.widthMm || 35;
  const h = config.heightMm || 22;
  const ezpxDpi = config.dpi || 203;
  let printerModel = 'G500';
  if (ezpxDpi === 300) {
    printerModel = 'EZ-1300+';
  } else if (ezpxDpi === 600) {
    printerModel = 'RT863i+';
  }
  const mmToDots = (mm) => Math.round((mm / 25.4) * ezpxDpi);

  const nullString100 = Array(100).fill('<string xsi:nil="true" />').join('\n      ');
  const zeroInt100 = Array(100).fill('<int>0</int>').join('\n      ');
  const falseBool100 = Array(100).fill('<boolean>false</boolean>').join('\n      ');

  let qlabelShapes = '';

  for (let index = 0; index < elements.length; index++) {
    const el = elements[index];
    const textVal = (el.text || el.data || '').replace(/\{\{serial\}\}/g, serial);
    const escapedText = escapeXml(textVal);

    if (el.type === 'text') {
      const fontPt = el.fontSize || 4;
      const fontCmdStr = el.bold ? `Arial,${fontPt},B\r\n` : `Arial,${fontPt}\r\n`;

      const fontHeightPx = Math.round((fontPt / 72) * ezpxDpi * 1.2);
      const rectH = Math.max(12, fontHeightPx);
      const rectW = measureTextWidthDots(textVal, fontPt, ezpxDpi);

      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);

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
        <DispData>${escapedText}</DispData>
        <bRemovePreZeroAndEmpty>false</bRemovePreZeroAndEmpty>
        <Data>${escapedText}</Data>
        <ItemInfoList />
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
      const imgInfo = await getImageBase64(el.src);
      const base64Data = imgInfo.data;

      const widthMm = el.widthMm || 10;
      let heightMm;
      if (el.heightMm) {
        heightMm = el.heightMm;
      } else if (imgInfo.width > 0) {
        heightMm = widthMm * (imgInfo.height / imgInfo.width);
      } else {
        heightMm = widthMm * 0.45;
      }

      let xMm = el.xMm || 0;
      let yMm = el.yMm || 0;
      if (el.autoBottomRight) {
        xMm = w - widthMm - 1;
        yMm = h - heightMm - 1;
      }

      const x = mmToDots(xMm);
      const y = mmToDots(yMm);
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
        const totalModules = (escapedText.length * 11) + 35;
        narrow = Math.max(1, Math.round(mmToDots(el.widthMm) / totalModules));
      }
      const totalModules = (escapedText.length * 11) + 35;
      const wDots = el.widthMm ? mmToDots(el.widthMm) : (totalModules * narrow);
      const hDots = heightDots + (readable ? 36 : 0);

      qlabelShapes += `
      <GraphicShape xsi:type="BarCode" Style="Cross" IsPrint="true" PageAlignment="None" Locked="false" bStroke="true" bFill="true" Direction="Angle0" X="${x}" Y="${y}" Alignment="Left" AlignPointX="${x}" AlignPointY="${y}" FontScript="Default" FontCmd="Arial,12&#xD;&#xA;" Symbology="Code128Auto" CaptionAlignment="${captionAlign}" Height="${heightDots}" Width="8" Narrow="${narrow}" BearerBarStyle="3" BearerBarWidth="5" QuietZoneWidth="9" BoxThickness="3" Offset="1" bDisplayChecksum="false" bDisplayStartStopChar="false" bBuiltinFont="true" bSetBuiltinFontSize="false" Code128Subset="Auto">
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
        <DispData>${escapedText}</DispData>
        <bRemovePreZeroAndEmpty>false</bRemovePreZeroAndEmpty>
        <Data>${escapedText}</Data>
        <ItemInfoList>
          <Item>
            <ItemSymbol>1</ItemSymbol>
            <ItemData>${escapedText}</ItemData>
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
        <DataField>None</DataField>
        <Prompt>None</Prompt>
        <BoundRectWidth>${wDots}</BoundRectWidth>
        <DispData>${escapedText}</DispData>
        <bRemovePreZeroAndEmpty>false</bRemovePreZeroAndEmpty>
        <Data>${escapedText}</Data>
        <ItemInfoList>
          <Item>
            <ItemSymbol>1</ItemSymbol>
            <ItemData>${escapedText}</ItemData>
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
          <DispData>${escapedText}</DispData>
          <bRemovePreZeroAndEmpty>false</bRemovePreZeroAndEmpty>
          <Data>${escapedText}</Data>
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

  return `<?xml version="1.0" encoding="utf-8"?>
<PrintJob xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Label>
    <PaperType>0</PaperType>
    <FullCut>0</FullCut>
    <FullCut_Batch>0</FullCut_Batch>
    <ItemLabelList>
      ${nullString100}
    </ItemLabelList>
    <PromptList>
      ${nullString100}
    </PromptList>
    <VariableValueList>
      ${nullString100}
    </VariableValueList>
    <VariableList>
      ${nullString100}
    </VariableList>
    <PromptModeList>
      ${nullString100}
    </PromptModeList>
    <VariableLengthList>
      ${zeroInt100}
    </VariableLengthList>
    <VariableJustifyList>
      ${nullString100}
    </VariableJustifyList>
    <VariableFillCharList>
      ${nullString100}
    </VariableFillCharList>
    <VariableIncDecList>
      ${nullString100}
    </VariableIncDecList>
    <VariableIncDecStepList>
      ${nullString100}
    </VariableIncDecStepList>
    <VariableMaskList>
      ${nullString100}
    </VariableMaskList>

    <VariableSpecialCarryList>
      ${nullString100}
    </VariableSpecialCarryList>
    <VariableSpecialCarryValueList>
      ${nullString100}
    </VariableSpecialCarryValueList>

    <VariablePromptMsgList>
      ${nullString100}
    </VariablePromptMsgList>
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
    <DataBaseFormat>None</DataBaseFormat>
    <DataBaseFilePath />
    <DataBaseSelection />
    <UserID />
    <Password>zhsTbm6nT9o+RQurpwH5Hw==</Password>
    <EncryptPwd>true</EncryptPwd>
    <DatabaseNoHeader>false</DatabaseNoHeader>
    <IntegratedSecurity>false</IntegratedSecurity>
    <RowIndex>0</RowIndex>
  </Label>
  <Setup bInfinityPrint="false" LabelLength="${h}" LabelWidth="${w}" LeftMargin="0" TopMargin="0" LabelType="0" GapLength="3" FeedLength="0" ZSign="45" BlackMark="3" Position="0" Speed="4" Copy="1" bCopyDataBase="false" CopyField="None" Stripper="0" LabelsPerCut="0" DoubleCut_Enable="false" DoubleCut_OffsetLen="0" DoubleCut_FirstCutMode="1" Rotate180="255" Stop="18" Darkness="8" Number="1" bCutDataBase="false" bBatchCut="false" bPartialCut="false" bFullCutLast="false" bFullCutEachRecord="false" bNumberDataBase="false" NumberField="None" PageDirection="Portrait" PrintMode="1" bUsePrinterRFIDCfg="false" PowerRFID="0" LengthRFID="-1" RetryRFID="1" DrawMode="0">
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
