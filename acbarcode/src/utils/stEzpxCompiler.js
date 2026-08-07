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

export async function compileEZPX(elements = [], config = {}, serial = '3726 0001') {
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
        <ItemInfoList>
          <Item>
            <ItemSymbol>1</ItemSymbol>
            <ItemData>${escapedText}</ItemData>
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
      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);
      const heightDots = mmToDots(el.heightMm || 10);
      const readable = el.readable ? "Bottom" : "None";

      qlabelShapes += `
      <GraphicShape xsi:type="Barcode" Style="Cross" IsPrint="true" PageAlignment="None" Locked="false" bStroke="true" bFill="true" Direction="Angle0" X="${x}" Y="${y}" Alignment="Left" AlignPointX="${x}" AlignPointY="${y}" BarcodeType="Code128" Height="${heightDots}" Narrow="2" Wide="5" Readable="${readable}" DisplayText="${escapedText}">
        <qHitOnCircumferance>false</qHitOnCircumferance>
        <Selected>false</Selected>
        <iBackground_color>4294967295</iBackground_color>
        <Id>${index}</Id>
        <ItemLabel>${escapeXml(el.name || `Barcode_${index}`)}</ItemLabel>
        <ObjectDrawMode>FW</ObjectDrawMode>
        <Data>${escapedText}</Data>
        <DispData>${escapedText}</DispData>
      </GraphicShape>`;
    } else if (el.type === 'qrcode') {
      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);
      const mul = el.mul || 4;

      qlabelShapes += `
      <GraphicShape xsi:type="QRCode" Style="Cross" IsPrint="true" PageAlignment="None" Locked="false" bStroke="true" bFill="true" Direction="Angle0" X="${x}" Y="${y}" Alignment="Left" AlignPointX="${x}" AlignPointY="${y}" Mode="Auto" Type="M" Multiplier="${mul}">
        <qHitOnCircumferance>false</qHitOnCircumferance>
        <Selected>false</Selected>
        <iBackground_color>4294967295</iBackground_color>
        <Id>${index}</Id>
        <ItemLabel>${escapeXml(el.name || `QRCode_${index}`)}</ItemLabel>
        <ObjectDrawMode>FW</ObjectDrawMode>
        <Data>${escapedText}</Data>
        <DispData>${escapedText}</DispData>
      </GraphicShape>`;
    }
  }

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
      ${nullString100}
    </SerialFormat>
    <SerialLeadingCode>
      ${zeroInt100}
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
