export function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
        return { data: buf.toString('base64'), width: 100, height: 100 };
      }
    } catch (e) {
      console.warn('Node.js getImageBase64 file read failed:', e);
    }
    if (src.startsWith('data:')) {
      return { data: src.split(',')[1] || '', width: 100, height: 100 };
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
  // SerialFormat: slot 0 = counter def when range; rest = empty <string />
  // SerialLeadingCode: slot 0 = 1 (leading-zero flag); rest = 0
  const serialFormatXml = Array.from({ length: 100 }, (_, i) =>
    (i === 0 && hasSerialRange)
      ? `<string>${escapeXml(serialFormatStr)}</string>`
      : '<string />'
  ).join('\n      ');

  const serialLeadingXml = Array.from({ length: 100 }, (_, i) =>
    (i === 0 && hasSerialRange) ? '<int>1</int>' : '<int>0</int>'
  ).join('\n      ');

  const nullString100 = Array(100).fill('<string xsi:nil="true" />').join('\n      ');
  const falseBool100  = Array(100).fill('<boolean>false</boolean>').join('\n      ');

  // ── Build qlabel shapes ───────────────────────────────────────────────
  let qlabelShapes = '';
  const productVal = (options && typeof options === 'object' && options.product) ? options.product : '';
  const optionsVal = (options && typeof options === 'object' && options.optionsText) ? options.optionsText : '';

  for (let index = 0; index < elements.length; index++) {
    const el = elements[index];
    if (el.type === 'folder') continue;
    let rawTemplate = el.text || el.data || '';
    if (productVal) {
      rawTemplate = rawTemplate
        .replace(/\{\{product\}\}/g, productVal)
        .replace(/\{\{product_no\}\}/g, productVal);
    }
    if (optionsVal) {
      rawTemplate = rawTemplate.replace(/\{\{options\}\}/g, optionsVal);
    }

    // DispData: always the rendered first SN (for GoLabel preview)
    const dispVal     = rawTemplate.replace(/\{\{serial\}\}/g, firstSN);
    const escapedDisp = escapeXml(dispVal);

    // elUsesSerial: only true when range > 1 AND element references {{serial}}
    const elUsesSerial = hasSerialRange && usesSerial(el);

    // Data / ItemData: use ^C00 counter cmd for serial elements
    const dataVal     = elUsesSerial
      ? rawTemplate.replace(/\{\{serial\}\}/g, counterStr)
      : dispVal;
    const escapedData = escapeXml(dataVal);

    // ItemSymbol: 1 = literal text, 2 = serial counter reference
    const itemSymbol = elUsesSerial ? 2 : 1;

    if (el.type === 'text') {
      const fontPt      = el.fontSize || 4;
      const fontCmdStr  = el.bold ? `Arial,${fontPt},B\r\n` : `Arial,${fontPt}\r\n`;
      const fontHeightPx = Math.round((fontPt / 72) * ezpxDpi * 1.2);
      const rectH = Math.max(12, fontHeightPx);
      const rectW = measureTextWidthDots(dispVal, fontPt, ezpxDpi);
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
      const readable   = el.readable ? 'Bottom' : 'None';
      let narrow = 2;
      if (el.widthMm) {
        const totalModules = (escapedData.length * 11) + 35;
        narrow = Math.max(1, Math.round(mmToDots(el.widthMm) / totalModules));
      }
      const wide = Math.max(narrow + 1, Math.round(narrow * 2.5));

      qlabelShapes += `
      <GraphicShape xsi:type="Barcode" Style="Cross" IsPrint="true" PageAlignment="None" Locked="false" bStroke="true" bFill="true" Direction="Angle0" X="${x}" Y="${y}" Alignment="Left" AlignPointX="${x}" AlignPointY="${y}" BarcodeType="Code128" Height="${heightDots}" Narrow="${narrow}" Wide="${wide}" Readable="${readable}" DisplayText="${escapedDisp}">
        <qHitOnCircumferance>false</qHitOnCircumferance>
        <Selected>false</Selected>
        <iBackground_color>4294967295</iBackground_color>
        <Id>${index}</Id>
        <ItemLabel>${escapeXml(el.name || `Barcode_${index}`)}</ItemLabel>
        <ObjectDrawMode>FW</ObjectDrawMode>
        <DataField>None</DataField>
        <Prompt>None</Prompt>
        <DispData>${escapedDisp}</DispData>
        <bRemovePreZeroAndEmpty>false</bRemovePreZeroAndEmpty>
        <Data>${escapedData}</Data>
        <ItemInfoList>
          <Item>
            <ItemSymbol>${itemSymbol}</ItemSymbol>
            <ItemData>${escapedData}</ItemData>
          </Item>
        </ItemInfoList>
      </GraphicShape>`;

    } else if (el.type === 'qrcode') {
      const x   = mmToDots(el.xMm || 0);
      const y   = mmToDots(el.yMm || 0);
      const mul = el.mul || 4;

      qlabelShapes += `
      <GraphicShape xsi:type="QRCode" Style="Cross" IsPrint="true" PageAlignment="None" Locked="false" bStroke="true" bFill="true" Direction="Angle0" X="${x}" Y="${y}" Alignment="Left" AlignPointX="${x}" AlignPointY="${y}" Mode="Auto" Type="M" Multiplier="${mul}">
        <qHitOnCircumferance>false</qHitOnCircumferance>
        <Selected>false</Selected>
        <iBackground_color>4294967295</iBackground_color>
        <Id>${index}</Id>
        <ItemLabel>${escapeXml(el.name || `QRCode_${index}`)}</ItemLabel>
        <ObjectDrawMode>FW</ObjectDrawMode>
        <DataField>None</DataField>
        <Prompt>None</Prompt>
        <DispData>${escapedDisp}</DispData>
        <bRemovePreZeroAndEmpty>false</bRemovePreZeroAndEmpty>
        <Data>${escapedData}</Data>
        <ItemInfoList>
          <Item>
            <ItemSymbol>${itemSymbol}</ItemSymbol>
            <ItemData>${escapedData}</ItemData>
          </Item>
        </ItemInfoList>
      </GraphicShape>`;
    }
  }

  // ── Final XML output ──────────────────────────────────────────────────
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
  <Setup bInfinityPrint="false" LabelLength="${h}" LabelWidth="${w}" LeftMargin="0" TopMargin="0" LabelType="0" GapLength="3" FeedLength="0" ZSign="45" BlackMark="3" Position="0" Speed="4" Copy="1" bCopyDataBase="false" CopyField="None" Stripper="0" LabelsPerCut="${labelsPerCut}" DoubleCut_Enable="false" DoubleCut_OffsetLen="0" DoubleCut_FirstCutMode="1" Rotate180="255" Stop="18" Darkness="8" Number="${totalCount}" bCutDataBase="false" bBatchCut="false" bPartialCut="false" bFullCutLast="false" bFullCutEachRecord="false" bNumberDataBase="false" NumberField="None" PageDirection="Portrait" PrintMode="1" bUsePrinterRFIDCfg="false" PowerRFID="0" LengthRFID="-1" RetryRFID="1" DrawMode="0">
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
