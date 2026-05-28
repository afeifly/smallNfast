/**
 * CsvAPI.js
 *
 * Implements standard s4a-web API surface for parsing and rendering CSV files
 * matching the format of `eg_format.csv` or exported files.
 */

// ── State variables ───────────────────────────────────────────────────────────
let _fileLoaded = false;
let _deviceName = 'CSV Device';
let _startTimeMs = 0;
let _stopTimeMs = 0;
let _sampleIntervalSec = 1;
let _sampleRate = 1;
let _detectedIntervalMs = 1000; // computed from actual row deltas
let _numChannels = 0;
let _numSamples = 0;
let _channels = [];
let _dataRows = [];

const MAX_DISPLAY_SAMPLES = 3000;

/**
 * A gap is any interval between consecutive rows that exceeds this multiple
 * of the detected sample interval. 2× means any pause longer than two normal
 * sample periods is treated as a power-loss gap.
 */
const GAP_THRESHOLD_FACTOR = 2.0;

// ── Parser Helpers ────────────────────────────────────────────────────────────

/** Split CSV line respecting quoted values containing commas. */
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

/** Parses date strings into timestamps (supports both hyphen and dot notations). */
function parseDateTimeString(str) {
  if (!str) return 0;
  const parts = str.trim().split(/\s+/);
  if (parts.length < 2) return 0;
  
  const dateStr = parts[0];
  let day = 1, month = 0, year = 2026;
  
  if (dateStr.includes('-')) {
    // format: DD-MM-YYYY
    const dParts = dateStr.split('-');
    day = parseInt(dParts[0], 10) || 1;
    month = (parseInt(dParts[1], 10) || 1) - 1;
    year = parseInt(dParts[2], 10) || 2026;
  } else if (dateStr.includes('.')) {
    // format: DD.MonthName.YYYY or DD.MonthName YYYY
    const dParts = dateStr.split('.');
    day = parseInt(dParts[0], 10) || 1;
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = dParts[1];
    month = months.indexOf(monthName);
    if (month === -1) month = 0;
    
    year = parseInt(parts[1] && !parts[1].includes(':') ? parts[1] : dParts[2], 10) || 2026;
  }
  
  const tParts = parts[parts.length - 1].split(':');
  const hour = parseInt(tParts[0], 10) || 0;
  const min = parseInt(tParts[1], 10) || 0;
  const sec = parseInt(tParts[2], 10) || 0;
  
  return new Date(year, month, day, hour, min, sec).getTime();
}

/**
 * Computes the median of all consecutive row-to-row time deltas.
 * Using the median makes the estimate robust against large gap outliers.
 * Returns the result in seconds.
 */
function computeMedianIntervalSec(dataRows) {
  if (dataRows.length < 2) return 1;
  const deltas = [];
  for (let i = 1; i < dataRows.length; i++) {
    const d = dataRows[i].timestampMs - dataRows[i - 1].timestampMs;
    if (d > 0) deltas.push(d);
  }
  if (deltas.length === 0) return 1;
  deltas.sort((a, b) => a - b);
  const mid = Math.floor(deltas.length / 2);
  const medianMs = deltas.length % 2 === 0
    ? (deltas[mid - 1] + deltas[mid]) / 2
    : deltas[mid];
  return medianMs / 1000;
}

/** Parses the CSV text. */
function parseCsvText(text) {
  const lines = text.split(/\r?\n/);
  
  let deviceName = 'CSV Device';
  let startTimeMs = 0;
  let stopTimeMs = 0;
  let sampleIntervalSec = 1;
  
  let channels = [];
  let dataRows = [];
  
  let lineIdx = 0;
  if (lines[0]) {
    deviceName = lines[0].trim();
  }
  
  lineIdx = 2; // skip empty line
  
  while (lineIdx < lines.length) {
    const line = lines[lineIdx].trim();
    if (!line) {
      lineIdx++;
      continue;
    }
    
    // Check if we hit the metadata table header
    if (line.startsWith('No.,Channel,Sensor,Unit,Resolution')) {
      lineIdx++;
      while (lineIdx < lines.length) {
        const chanLine = lines[lineIdx].trim();
        if (!chanLine) {
          lineIdx++;
          break; // end of metadata table
        }
        
        const parts = parseCsvLine(chanLine);
        if (parts.length >= 6) {
          const idx = parseInt(parts[0], 10) - 1;
          const name = parts[1];
          const sensor = parts[2];
          const unit = parts[3];
          
          const resStr = parts[4];
          let resolution = 2;
          if (resStr.includes('.')) {
            resolution = resStr.split('.')[1].length;
          } else if (resStr === '1') {
            resolution = 0;
          } else {
            const parsedRes = parseInt(resStr, 10);
            if (!isNaN(parsedRes)) {
              resolution = parsedRes;
            }
          }
          
          channels.push({
            channel_id: idx,
            location_id: 1,
            sensor_id: idx,
            logic_channel_description: name,
            physical_channel_description: name,
            sensor_description: sensor,
            unit_in_ascii: unit,
            resolution: resolution,
            _min: 0,
            _max: 100,
          });
        }
        lineIdx++;
      }
      continue;
    }
    
    // Parse individual metadata fields
    const commaIdx = line.indexOf(',');
    if (commaIdx !== -1) {
      const key = line.slice(0, commaIdx).trim();
      const val = line.slice(commaIdx + 1).trim();
      
      if (key === 'Start Date Time') {
        startTimeMs = parseDateTimeString(val);
      } else if (key === 'End Date Time') {
        stopTimeMs = parseDateTimeString(val);
      } else if (key === 'Sample Rate(sec)') {
        sampleIntervalSec = parseFloat(val) || 1;
      }
    }
    
    // Check if we hit the data header row
    if (line.startsWith('Date Time,') || line.startsWith('No.,Date Time,')) {
      lineIdx++;
      while (lineIdx < lines.length) {
        const dataLine = lines[lineIdx].trim();
        if (!dataLine) {
          lineIdx++;
          continue;
        }
        
        const parts = parseCsvLine(dataLine);
        if (parts.length > 0) {
          let dateStr = parts[0];
          let valuesStartIndex = 1;
          let recordId = 0;
          
          // Check if the first column is a sequential record No.
          if (!isNaN(parseInt(parts[0], 10)) && parts[0].indexOf('-') === -1 && parts[0].indexOf('/') === -1 && parts[0].indexOf('.') === -1) {
            recordId = parseInt(parts[0], 10);
            dateStr = parts[1];
            valuesStartIndex = 2;
          }
          
          const timestampMs = parseDateTimeString(dateStr);
          
          const values = {};
          for (let c = 0; c < channels.length; c++) {
            const valStr = parts[valuesStartIndex + c];
            const v = (valStr === undefined || valStr === '') ? null : parseFloat(valStr);
            values[c] = (v === null || isNaN(v)) ? null : v;
          }
          
          dataRows.push({
            index: dataRows.length,
            recordId: recordId || dataRows.length + 1,
            timestampMs,
            values
          });
        }
        lineIdx++;
      }
      break;
    }
    
    lineIdx++;
  }
  
  // Fill min/max stats for channels
  channels.forEach(ch => {
    let min = Infinity;
    let max = -Infinity;
    dataRows.forEach(row => {
      const v = row.values[ch.channel_id];
      if (v !== null && v !== undefined) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    });
    ch._min = isFinite(min) ? min : 0;
    ch._max = isFinite(max) ? max : 100;
  });
  
  const detectedIntervalSec = computeMedianIntervalSec(dataRows);

  return {
    deviceName,
    startTimeMs,
    stopTimeMs: stopTimeMs || startTimeMs + dataRows.length * sampleIntervalSec * 1000,
    sampleIntervalSec,
    detectedIntervalSec,
    numChannels: channels.length,
    numSamples: dataRows.length,
    channels,
    dataRows,
  };
}

// ── CsvAPI Interface Implementation ───────────────────────────────────────────

const CsvAPI = {
  isFileLoaded() {
    return _fileLoaded;
  },

  async loadFromFile(file) {
    try {
      _fileLoaded = false;
      const text = await file.text();
      const parsed = parseCsvText(text);
      
      _deviceName = parsed.deviceName;
      _startTimeMs = parsed.startTimeMs;
      _stopTimeMs = parsed.stopTimeMs;
      _sampleIntervalSec = parsed.sampleIntervalSec;
      _sampleRate = 1 / _sampleIntervalSec;
      _detectedIntervalMs = parsed.detectedIntervalSec * 1000;
      _numChannels = parsed.numChannels;
      _numSamples = parsed.numSamples;
      _channels = parsed.channels;
      _dataRows = parsed.dataRows;

      // ── Gap report ─────────────────────────────────────────────────────────
      const gapThresholdMs = GAP_THRESHOLD_FACTOR * _detectedIntervalMs;
      const gaps = [];
      for (let i = 1; i < _dataRows.length; i++) {
        const delta = _dataRows[i].timestampMs - _dataRows[i - 1].timestampMs;
        if (delta > gapThresholdMs) {
          gaps.push({
            from: _dataRows[i - 1].timestampMs,
            to: _dataRows[i].timestampMs,
            missingSec: Math.round((delta - _detectedIntervalMs) / 1000),
          });
        }
      }
      if (gaps.length === 0) {
        console.log(`[CsvAPI] Gap report: no gaps detected. Detected interval: ${parsed.detectedIntervalSec.toFixed(2)} sec`);
      } else {
        console.warn(`[CsvAPI] Gap report: ${gaps.length} gap(s) in "${file.name}" (detected interval: ${parsed.detectedIntervalSec.toFixed(2)} sec)`);
        gaps.forEach((g, idx) => {
          const from = new Date(g.from).toISOString();
          const to = new Date(g.to).toISOString();
          console.warn(`  Gap ${idx + 1}: ${from} → ${to}  (~${g.missingSec} sec missing)`);
        });
      }
      // ───────────────────────────────────────────────────────────────────────

      _fileLoaded = true;
      console.log(`[CsvAPI] Parsed ${_numChannels} channels, ${_numSamples} samples from CSV file "${file.name}"`);
      return true;
    } catch (e) {
      console.error('[CsvAPI] Load file failed:', e);
      return false;
    }
  },

  getFileTimeRange() {
    return { start: _startTimeMs, stop: _stopTimeMs };
  },

  getChannels(callback) {
    if (!_fileLoaded) {
      setTimeout(() => callback({ logging_chs: [] }), 50);
      return;
    }
    setTimeout(() => callback({
      logging_chs: _channels.map(ch => ({
        channel_id: ch.channel_id,
        location_id: ch.location_id,
        sensor_id: ch.sensor_id,
        logic_channel_description: ch.logic_channel_description,
        physical_channel_description: ch.physical_channel_description,
        sensor_description: ch.sensor_description,
        unit_in_ascii: ch.unit_in_ascii,
        resolution: ch.resolution,
      }))
    }), 50);
  },

  getTablePage(pageIndex, pageSize, selectedChannelIds, callback) {
    if (!_fileLoaded) {
      setTimeout(() => callback({ total: 0, rows: [] }), 50);
      return;
    }
    
    const startSample = pageIndex * pageSize;
    const endSample = Math.min(startSample + pageSize - 1, _numSamples - 1);
    const count = endSample - startSample + 1;
    
    if (count <= 0) {
      setTimeout(() => callback({ total: _numSamples, rows: [] }), 50);
      return;
    }
    
    const pageRows = [];
    for (let i = startSample; i <= endSample; i++) {
      const row = _dataRows[i];
      const values = {};
      for (let c = 0; c < _channels.length; c++) {
        if (selectedChannelIds && !selectedChannelIds.includes(c)) continue;
        values[c] = row.values[c];
      }
      pageRows.push({
        index: row.index,
        recordId: row.recordId,
        timestampMs: row.timestampMs,
        values
      });
    }
    
    setTimeout(() => callback({
      total: _numSamples,
      sampleRate: _sampleRate,
      startTimeMs: _startTimeMs,
      stopTimeMs: _stopTimeMs,
      rows: pageRows
    }), 50);
  },

  getMeasurementData(channelId, startTime, stopTime, tableInterval, getDataWay, callback) {
    if (!_fileLoaded) {
      setTimeout(() => callback([]), 50);
      return;
    }

    const chIdx = parseInt(channelId, 10);
    if (isNaN(chIdx) || chIdx < 0 || chIdx >= _channels.length) {
      setTimeout(() => callback([]), 50);
      return;
    }

    const ch = _channels[chIdx];

    // Adjust for the +8 h the UI adds before calling us
    const qStart = startTime - 3600000 * 8;
    const qStop  = stopTime  - 3600000 * 8;

    // Filter rows in time range
    const filteredRows = _dataRows.filter(r => r.timestampMs >= qStart && r.timestampMs <= qStop);

    if (filteredRows.length === 0) {
      setTimeout(() => callback([{
        channel_id: channelId,
        measurementData: [],
        realStartTime: [],
        pointInterval: [],
        min: ch._min,
        max: ch._max,
      }]), 50);
      return;
    }

    // Uniform downsample step across all filtered rows
    const step = Math.max(1, Math.floor(filteredRows.length / MAX_DISPLAY_SAMPLES));
    // Each downsampled point represents `step` real samples spaced _detectedIntervalMs apart
    const pointIntervalMs = step * _detectedIntervalMs;
    const gapThresholdMs  = GAP_THRESHOLD_FACTOR * _detectedIntervalMs;

    // ── Split filteredRows into contiguous (gap-free) segments ────────────────
    // We scan the raw (un-downsampled) rows so we don't miss gaps that fall
    // between two downsampled indices.
    const rawSegments = [];
    let currentSeg = [filteredRows[0]];
    for (let i = 1; i < filteredRows.length; i++) {
      const delta = filteredRows[i].timestampMs - filteredRows[i - 1].timestampMs;
      if (delta > gapThresholdMs) {
        rawSegments.push(currentSeg);
        currentSeg = [];
      }
      currentSeg.push(filteredRows[i]);
    }
    rawSegments.push(currentSeg);
    // ─────────────────────────────────────────────────────────────────────────

    // Downsample each segment independently and build result arrays.
    // DataUtil.handleMeasurementData already appends a null sentinel after
    // each segment, which causes D3 to draw a visible line break at each gap.
    const measurementData = [];
    const realStartTime   = [];
    const pointInterval   = [];

    for (const seg of rawSegments) {
      const segValues = [];
      for (let i = 0; i < seg.length; i += step) {
        segValues.push(seg[i].values[chIdx]);
      }
      if (segValues.length > 0) {
        measurementData.push(segValues);
        realStartTime.push(seg[0].timestampMs + 3600000 * 8);
        pointInterval.push(pointIntervalMs);
      }
    }

    setTimeout(() => callback([{
      channel_id: channelId,
      measurementData,
      realStartTime,
      pointInterval,
      min: ch._min,
      max: ch._max,
    }]), 50);
  },

  getMutilMeasurementData(channelIds, startTime, tableInterval, getDataWay, callback) {
    if (!channelIds || channelIds.length === 0) { callback([]); return; }
    const stopTime = _stopTimeMs > _startTimeMs
      ? (_stopTimeMs + 3600000 * 8)
      : startTime + 3600000 * 24;
    this.getMeasurementData(channelIds[0], startTime, stopTime, tableInterval, getDataWay, callback);
  },

  getUserSettings(username, callback) {
    if (!_fileLoaded) {
      setTimeout(() => callback([]), 50);
      return;
    }

    const flowPriority = _channels.filter(ch => {
      const u = (ch.unit_in_ascii || '').toLowerCase();
      const d = (ch.logic_channel_description || '').toLowerCase();
      return u.includes('m') || u.includes('flow') || d.includes('m³') || d.includes('m3') || d.includes('flow');
    });
    const sorted = [...flowPriority, ..._channels.filter(ch => !flowPriority.includes(ch))];
    const defaults = sorted.slice(0, 2);

    const COLORS = ['#00B8D9', '#FF5630', '#36B37E', '#6554C0', '#FF8B00',
      '#0052CC', '#00875A', '#FF4081', '#FFC107', '#7B1FA2'];

    const displayChannelOption = defaults.map((ch, idx) => ({
      channel_id: {
        channel_id: ch.channel_id,
        logic_channel_description: ch.logic_channel_description,
        physical_channel_description: ch.physical_channel_description,
        sensor_id: ch.sensor_id,
      },
      color: COLORS[idx % COLORS.length],
      display_channel_option_id: 1000 + ch.channel_id,
    }));

    setTimeout(() => callback([{
      alias_name: username || 'CSV',
      createddate: _startTimeMs,
      display_channel_option: displayChannelOption,
      username: username || 'csv',
    }]), 50);
  },

  async exportAllChannelsToExcel(onProgress) {
    if (!_fileLoaded) {
      throw new Error("No CSV file loaded");
    }

    const xmlHeader = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="CSD Export">
  <Table>`;

    const xmlFooter = `  </Table>
 </Worksheet>
</Workbook>`;

    let headerRow = '   <Row>\n';
    headerRow += '    <Cell><Data ss:Type="String">Timestamp</Data></Cell>\n';
    headerRow += '    <Cell><Data ss:Type="String">Record ID</Data></Cell>\n';
    _channels.forEach(ch => {
      const desc = ch.logic_channel_description || `Channel ${ch.channel_id}`;
      const unit = ch.unit_in_ascii ? ` (${ch.unit_in_ascii})` : '';
      const escaped = `${desc}${unit}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      headerRow += `    <Cell><Data ss:Type="String">${escaped}</Data></Cell>\n`;
    });
    headerRow += '   </Row>\n';

    const xmlChunks = [xmlHeader, headerRow];

    const chunkSize = 5000;
    for (let start = 0; start < _numSamples; start += chunkSize) {
      const end = Math.min(start + chunkSize, _numSamples);
      let chunkXml = '';
      for (let i = start; i < end; i++) {
        const row = _dataRows[i];
        const dateStr = new Date(row.timestampMs).toISOString();

        chunkXml += '   <Row>\n';
        chunkXml += `    <Cell><Data ss:Type="String">${dateStr}</Data></Cell>\n`;
        chunkXml += `    <Cell><Data ss:Type="Number">${row.recordId}</Data></Cell>\n`;

        for (let c = 0; c < _numChannels; c++) {
          const v = row.values[c];
          if (v === null || v === undefined) {
            chunkXml += '    <Cell><Data ss:Type="String"></Data></Cell>\n';
          } else {
            chunkXml += `    <Cell><Data ss:Type="Number">${v}</Data></Cell>\n`;
          }
        }
        chunkXml += '   </Row>\n';
      }
      xmlChunks.push(chunkXml);

      if (onProgress) {
        onProgress(end / _numSamples);
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    xmlChunks.push(xmlFooter);

    const blob = new Blob(xmlChunks, { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    link.setAttribute('download', `export_all_channels.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  async exportAllChannelsToCsv(onProgress) {
    if (!_fileLoaded) {
      throw new Error("No CSV file loaded");
    }
    const csvContentRows = [];
    csvContentRows.push(`${_deviceName} Raw Data`);
    csvContentRows.push('');
    csvContentRows.push(`Start Date Time,${new Date(_startTimeMs).toISOString()}`);
    csvContentRows.push(`End Date Time,${new Date(_stopTimeMs).toISOString()}`);
    csvContentRows.push(`Sample Rate(sec),${_sampleIntervalSec}`);
    csvContentRows.push(`NO.Of Channels,${_numChannels}`);
    csvContentRows.push(`NO.Of Records,${_numSamples}`);
    csvContentRows.push('');
    csvContentRows.push('No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point');
    _channels.forEach((ch, idx) => {
      const resStr = (1 / Math.pow(10, ch.resolution)).toFixed(ch.resolution);
      csvContentRows.push(`${idx + 1},${ch.logic_channel_description},${ch.sensor_description},${ch.unit_in_ascii},${resStr},Location ${ch.location_id}/${ch.logic_channel_description}`);
    });
    csvContentRows.push('');
    
    const dataHeaders = ['Date Time'];
    _channels.forEach(ch => {
      const u = ch.unit_in_ascii ? ` - ${ch.unit_in_ascii}` : '';
      dataHeaders.push(`${ch.logic_channel_description}${u}`);
    });
    csvContentRows.push(dataHeaders.join(','));

    for (let i = 0; i < _numSamples; i++) {
      const row = _dataRows[i];
      const dateStr = new Date(row.timestampMs).toISOString();
      const rowValues = [dateStr];
      for (let c = 0; c < _numChannels; c++) {
        const v = row.values[c];
        rowValues.push(v === null || v === undefined ? '' : v);
      }
      csvContentRows.push(rowValues.join(','));
    }

    const csvString = csvContentRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `export_all_channels.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  getConsumptionData() {
    return _dataRows;
  }
};

export default CsvAPI;
