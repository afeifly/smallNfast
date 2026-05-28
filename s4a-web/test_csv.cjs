const fs = require('fs');
const path = require('path');

// Mirror CsvAPI helpers
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDateTimeString(str) {
  if (!str) return 0;
  const parts = str.trim().split(/\s+/);
  if (parts.length < 2) return 0;
  
  const dateStr = parts[0];
  let day = 1, month = 0, year = 2026;
  let hasValidDate = false;
  
  if (dateStr.includes('-')) {
    // format: DD-MM-YYYY or YYYY-MM-DD
    const dParts = dateStr.split('-');
    if (dParts.length >= 3) {
      if (dParts[0].length === 4) {
        year = parseInt(dParts[0], 10);
        month = parseInt(dParts[1], 10) - 1;
        day = parseInt(dParts[2], 10);
      } else {
        day = parseInt(dParts[0], 10);
        month = parseInt(dParts[1], 10) - 1;
        year = parseInt(dParts[2], 10);
      }
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        hasValidDate = true;
      }
    }
  } else if (dateStr.includes('.')) {
    // format: DD.MonthName.YYYY or DD.MonthName YYYY
    const dParts = dateStr.split('.');
    if (dParts.length >= 2) {
      day = parseInt(dParts[0], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = dParts[1];
      month = months.indexOf(monthName);
      if (month !== -1 && !isNaN(day)) {
        year = parseInt(parts[1] && !parts[1].includes(':') ? parts[1] : dParts[2], 10);
        if (!isNaN(year)) {
          hasValidDate = true;
        }
      }
    }
  } else if (dateStr.includes('/')) {
    // format: DD/MM/YYYY or YYYY/MM/DD
    const dParts = dateStr.split('/');
    if (dParts.length >= 3) {
      if (dParts[0].length === 4) {
        year = parseInt(dParts[0], 10);
        month = parseInt(dParts[1], 10) - 1;
        day = parseInt(dParts[2], 10);
      } else {
        day = parseInt(dParts[0], 10);
        month = parseInt(dParts[1], 10) - 1;
        year = parseInt(dParts[2], 10);
      }
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        hasValidDate = true;
      }
    }
  }
  
  if (!hasValidDate) return 0;
  
  const tParts = parts[parts.length - 1].split(':');
  if (tParts.length < 2) return 0;
  
  const hour = parseInt(tParts[0], 10);
  const min = parseInt(tParts[1], 10);
  const sec = parseInt(tParts[2], 10) || 0;
  
  if (isNaN(hour) || isNaN(min) || isNaN(sec)) return 0;
  
  return new Date(year, month, day, hour, min, sec).getTime();
}

async function testIndex() {
  const filePath = path.join(__dirname, 'reference/eg_format.csv');
  const fileBuffer = fs.readFileSync(filePath);
  
  // Standard ASCII file
  const text = fileBuffer.toString('utf-8');
  const lines = text.split(/\r?\n/);
  
  let dataHeaderLineIdx = -1;
  let lineIdx = 0;
  
  while (lineIdx < lines.length) {
    const line = lines[lineIdx].trim();
    if (line.startsWith('Date Time,') || line.startsWith('No.,Date Time,')) {
      dataHeaderLineIdx = lineIdx;
      break;
    }
    lineIdx++;
  }
  
  console.log(`[Test] dataHeaderLineIdx found: ${dataHeaderLineIdx}`);
  console.log(`[Test] headerLine text: "${lines[dataHeaderLineIdx]}"`);
  
  const headerLine = lines[dataHeaderLineIdx];
  const headerStrIdx = text.indexOf(headerLine);
  console.log(`[Test] headerStrIdx: ${headerStrIdx}`);
  
  const nextNewlineIdx = text.indexOf('\n', headerStrIdx);
  console.log(`[Test] nextNewlineIdx: ${nextNewlineIdx}`);
  
  const headerEndCharIdx = nextNewlineIdx !== -1 ? nextNewlineIdx + 1 : headerStrIdx + headerLine.length + 1;
  
  // Check for UTF-8 BOM
  const bomBytes = new Uint8Array(fileBuffer.slice(0, 3));
  const hasBOM = bomBytes[0] === 0xEF && bomBytes[1] === 0xBB && bomBytes[2] === 0xBF;
  const bomOffset = hasBOM ? 3 : 0;
  
  const dataStartByte = new TextEncoder().encode(text.slice(0, headerEndCharIdx)).length + bomOffset;
  console.log(`[Test] dataStartByte: ${dataStartByte}`);
  
  // High-speed Streaming Indexer simulation
  let currentByteOffset = dataStartByte;
  const fileSize = fileBuffer.length;
  const CHUNK_SIZE = 8 * 1024 * 1024;
  
  const tempOffsets = [];
  const tempTimestamps = [];
  const tempRecordIds = [];
  
  while (currentByteOffset < fileSize) {
    const endByte = Math.min(currentByteOffset + CHUNK_SIZE, fileSize);
    const chunkText = fileBuffer.toString('utf-8', currentByteOffset, endByte);
    
    let searchIdx = 0;
    while (searchIdx < chunkText.length) {
      const newlineIdx = chunkText.indexOf('\n', searchIdx);
      if (newlineIdx === -1) {
        break;
      }
      
      const lineStartByte = currentByteOffset + searchIdx;
      const line = chunkText.slice(searchIdx, newlineIdx).trim();
      
      if (line) {
        const parts = parseCsvLine(line);
        if (parts.length > 0) {
          let dateStr = parts[0];
          let valuesStartIndex = 1;
          let recordId = 0;
          
          if (!isNaN(parseInt(parts[0], 10)) && !parts[0].includes('-') && !parts[0].includes('/') && !parts[0].includes('.')) {
            recordId = parseInt(parts[0], 10);
            dateStr = parts[1];
            valuesStartIndex = 2;
          }
          
          const timestampMs = parseDateTimeString(dateStr);
          if (timestampMs > 0) {
            tempOffsets.push(lineStartByte);
            tempTimestamps.push(timestampMs);
            tempRecordIds.push(recordId || (tempRecordIds.length + 1));
          }
        }
      }
      searchIdx = newlineIdx + 1;
    }
    currentByteOffset += searchIdx;
  }
  
  console.log(`[Test] Total indexed samples: ${tempOffsets.length}`);
  if (tempOffsets.length > 0) {
    console.log(`[Test] First indexed offset: ${tempOffsets[0]}`);
    console.log(`[Test] First timestamp ms: ${tempTimestamps[0]}`);
    console.log(`[Test] First timestamp formatted: ${new Date(tempTimestamps[0]).toISOString()}`);
    console.log(`[Test] Sliced text of first indexed row:`);
    console.log(`"${text.slice(tempOffsets[0], tempOffsets[0] + 150)}"`);
  }
}

testIndex();
