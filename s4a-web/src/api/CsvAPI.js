/**
 * CsvAPI.js
 *
 * Implements standard s4a-web API surface for parsing and rendering CSV files
 * matching the format of `eg_format.csv` or exported files.
 *
 * Designed with a high-performance stream-indexed lazy-loader to handle large
 * files (1.3GB to 10GB+) with extremely low memory footprint (<250MB RAM).
 */

// ── State variables ───────────────────────────────────────────────────────────
let _fileLoaded = false;
let _file = null;               // Kept open for lazy slice-based reading
let _rowOffsets = null;         // Float64Array of starting byte positions for rows
let _rowTimestamps = null;      // Float64Array of timestamps (ms) for rows
let _rowRecordIds = null;       // Int32Array of record numbers for rows

let _deviceName = 'CSV Device';
let _startTimeMs = 0;
let _stopTimeMs = 0;
let _sampleIntervalSec = 1;
let _sampleRate = 1;
let _detectedIntervalMs = 1000; // computed from actual row deltas
let _numChannels = 0;
let _numSamples = 0;
let _channels = [];

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

function validateCsvHeader(lines) {
  let hasStartDateTime = false;
  let hasEndDateTime = false;
  let hasSampleRate = false;
  let hasMetadataTable = false;
  let hasDataHeader = false;
  let channelCount = 0;
  
  let startVal = null;
  let endVal = null;
  let sampleRateVal = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('Start Date Time,')) {
      hasStartDateTime = true;
      startVal = line.slice('Start Date Time,'.length).trim();
    } else if (line.startsWith('End Date Time,')) {
      hasEndDateTime = true;
      endVal = line.slice('End Date Time,'.length).trim();
    } else if (line.startsWith('Sample Rate(sec),')) {
      hasSampleRate = true;
      sampleRateVal = line.slice('Sample Rate(sec),'.length).trim();
    } else if (line.startsWith('No.,Channel,Sensor,Unit,Resolution')) {
      hasMetadataTable = true;
      // Count channels right after the header
      let idx = i + 1;
      while (idx < lines.length) {
        const chanLine = lines[idx].trim();
        if (!chanLine) break; // empty line terminates channels section
        const parts = parseCsvLine(chanLine);
        if (parts.length >= 5) {
          channelCount++;
        }
        idx++;
      }
    } else if (line.startsWith('Date Time,') || line.startsWith('No.,Date Time,')) {
      hasDataHeader = true;
    }
  }

  if (!hasStartDateTime) throw new Error("Missing required metadata 'Start Date Time'");
  if (!hasEndDateTime) throw new Error("Missing required metadata 'End Date Time'");
  if (!hasSampleRate) throw new Error("Missing required metadata 'Sample Rate(sec)'");
  if (!hasMetadataTable) throw new Error("Missing channel metadata table header ('No.,Channel,Sensor,Unit,Resolution')");
  if (!hasDataHeader) throw new Error("Missing data header line (starting with 'Date Time,' or 'No.,Date Time,')");
  
  if (channelCount === 0) {
    throw new Error("No channels found in the metadata table");
  }

  const startMs = parseDateTimeString(startVal);
  if (isNaN(startMs) || startMs <= 0) {
    throw new Error(`Invalid 'Start Date Time' value: "${startVal}"`);
  }

  const endMs = parseDateTimeString(endVal);
  if (isNaN(endMs) || endMs <= 0) {
    throw new Error(`Invalid 'End Date Time' value: "${endVal}"`);
  }

  if (endMs < startMs) {
    throw new Error(`'End Date Time' (${endVal}) cannot be earlier than 'Start Date Time' (${startVal})`);
  }

  const sampleRate = parseFloat(sampleRateVal);
  if (isNaN(sampleRate) || sampleRate <= 0) {
    throw new Error(`Invalid 'Sample Rate(sec)' value: "${sampleRateVal}". Must be a positive number.`);
  }

  return true;
}

// ── CsvAPI Interface Implementation ───────────────────────────────────────────

const CsvAPI = {
  isFileLoaded() {
    return _fileLoaded;
  },

  async loadFromFile(file) {
    try {
      _fileLoaded = false;
      _file = file;
      
      // 1. Initial 150KB read to parse metadata
      const slice = file.slice(0, 150 * 1024);
      const text = await slice.text();
      const lines = text.split(/\r?\n/);

      // Verify header format and metadata
      validateCsvHeader(lines);
      
      let deviceName = 'CSV Device';
      let startTimeMs = 0;
      let stopTimeMs = 0;
      let sampleIntervalSec = 1;
      let channels = [];
      
      let dataHeaderLineIdx = -1;
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
        
        // Metadata Table
        if (line.startsWith('No.,Channel,Sensor,Unit,Resolution')) {
          lineIdx++;
          while (lineIdx < lines.length) {
            const chanLine = lines[lineIdx].trim();
            if (!chanLine) {
              lineIdx++;
              break;
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
                if (!isNaN(parsedRes)) resolution = parsedRes;
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
        
        // Key-value metadata
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
        
        // Data row header check
        if (line.startsWith('Date Time,') || line.startsWith('No.,Date Time,')) {
          dataHeaderLineIdx = lineIdx;
          break;
        }
        
        lineIdx++;
      }
      
      if (dataHeaderLineIdx === -1) {
        throw new Error("Could not find CSV data header start line");
      }
      
      // Check for UTF-8 BOM
      const bomSlice = await file.slice(0, 3).arrayBuffer();
      const bomBytes = new Uint8Array(bomSlice);
      const hasBOM = bomBytes[0] === 0xEF && bomBytes[1] === 0xBB && bomBytes[2] === 0xBF;
      const bomOffset = hasBOM ? 3 : 0;

      // Calculate data rows byte offset start (foolproof for both LF and CRLF)
      const headerLine = lines[dataHeaderLineIdx];
      const headerStrIdx = text.indexOf(headerLine);
      if (headerStrIdx === -1) {
        throw new Error("Could not locate data header string in file text");
      }
      const nextNewlineIdx = text.indexOf('\n', headerStrIdx);
      const headerEndCharIdx = nextNewlineIdx !== -1 ? nextNewlineIdx + 1 : headerStrIdx + headerLine.length + 1;
      
      // Convert character index to exact byte offset in the UTF-8 file (adding BOM if present)
      const dataStartByte = new TextEncoder().encode(text.slice(0, headerEndCharIdx)).length + bomOffset;
      
      // 2. High-speed Streaming Indexer
      const fileSize = file.size;
      const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks
      let currentByteOffset = dataStartByte;
      
      const tempOffsets = [];
      const tempTimestamps = [];
      const tempRecordIds = [];
      
      const chMin = Array(channels.length).fill(Infinity);
      const chMax = Array(channels.length).fill(-Infinity);
      
      while (currentByteOffset < fileSize) {
        const endByte = Math.min(currentByteOffset + CHUNK_SIZE, fileSize);
        const slice = file.slice(currentByteOffset, endByte);
        const chunkText = await slice.text();
        
        let searchIdx = 0;
        while (searchIdx < chunkText.length) {
          const newlineIdx = chunkText.indexOf('\n', searchIdx);
          if (newlineIdx === -1) {
            break; // end of chunk
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
                
                // On-the-fly min/max
                for (let c = 0; c < channels.length; c++) {
                  const valStr = parts[valuesStartIndex + c];
                  if (valStr !== undefined && valStr !== '') {
                    const v = parseFloat(valStr);
                    if (!isNaN(v)) {
                      if (v < chMin[c]) chMin[c] = v;
                      if (v > chMax[c]) chMax[c] = v;
                    }
                  }
                }
              }
            }
          }
          searchIdx = newlineIdx + 1;
        }
        
        currentByteOffset += searchIdx;
        
        const progress = currentByteOffset / fileSize;
        window.dispatchEvent(new CustomEvent('fileLoadProgress', { 
          detail: { progress: 0.1 + progress * 0.7, filename: file.name } 
        }));
        
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      // Finalize Float64/Int32 arrays
      window.dispatchEvent(new CustomEvent('fileLoadProgress', { 
        detail: { progress: 0.82, filename: file.name } 
      }));
      await new Promise(resolve => setTimeout(resolve, 0));

      _rowOffsets = new Float64Array(tempOffsets);
      _rowTimestamps = new Float64Array(tempTimestamps);
      _rowRecordIds = new Int32Array(tempRecordIds);
      
      _deviceName = deviceName;
      _startTimeMs = startTimeMs || (_rowTimestamps.length > 0 ? _rowTimestamps[0] : 0);
      _stopTimeMs = stopTimeMs || (_rowTimestamps.length > 0 ? _rowTimestamps[_rowTimestamps.length - 1] : _startTimeMs);
      _sampleIntervalSec = sampleIntervalSec;
      _sampleRate = 1 / _sampleIntervalSec;
      _numChannels = channels.length;
      _numSamples = _rowOffsets.length;
      
      // Set computed min/max
      channels.forEach((ch, idx) => {
        ch._min = isFinite(chMin[idx]) ? chMin[idx] : 0;
        ch._max = isFinite(chMax[idx]) ? chMax[idx] : 100;
      });
      _channels = channels;
      
      // DIAGNOSTIC LOG FOR LARGE FILES & SHIFTS
      if (_rowOffsets.length > 0) {
        file.slice(_rowOffsets[0], _rowOffsets[0] + 300).text().then(slicedText => {
          console.log("[CsvAPI Debug] First Row Indexing:", {
            totalSamples: _numSamples,
            firstOffset: _rowOffsets[0],
            firstTimestamp: new Date(_rowTimestamps[0]).toISOString(),
            firstRecordId: _rowRecordIds[0],
            slicedText
          });
        }).catch(err => {
          console.error("[CsvAPI Debug] Slicing error:", err);
        });
      }
      
      // 3. Compute detected interval using sampled median (avoids O(n log n) sort on large files)
      window.dispatchEvent(new CustomEvent('fileLoadProgress', { 
        detail: { progress: 0.88, filename: file.name } 
      }));
      await new Promise(resolve => setTimeout(resolve, 0));

      let detectedIntervalSec = _sampleIntervalSec;
      if (_rowTimestamps.length >= 2) {
        // Sample up to 2000 evenly-spaced deltas instead of computing all N-1 deltas
        const SAMPLE_COUNT = 2000;
        const step = Math.max(1, Math.floor((_rowTimestamps.length - 1) / SAMPLE_COUNT));
        const sampledDeltas = [];
        for (let i = step; i < _rowTimestamps.length; i += step) {
          const d = _rowTimestamps[i] - _rowTimestamps[i - 1];
          if (d > 0) sampledDeltas.push(d);
        }
        if (sampledDeltas.length > 0) {
          // Sort only the small sample array
          sampledDeltas.sort((a, b) => a - b);
          const mid = Math.floor(sampledDeltas.length / 2);
          const medianMs = sampledDeltas.length % 2 === 0
            ? (sampledDeltas[mid - 1] + sampledDeltas[mid]) / 2
            : sampledDeltas[mid];
          detectedIntervalSec = medianMs / 1000;
        }
      }
      _detectedIntervalMs = detectedIntervalSec * 1000;
      
      window.dispatchEvent(new CustomEvent('fileLoadProgress', { 
        detail: { progress: 0.93, filename: file.name } 
      }));
      await new Promise(resolve => setTimeout(resolve, 0));

      const gapThresholdMs = GAP_THRESHOLD_FACTOR * _detectedIntervalMs;
      const gaps = [];
      for (let i = 1; i < _rowTimestamps.length; i++) {
        const delta = _rowTimestamps[i] - _rowTimestamps[i - 1];
        if (delta > gapThresholdMs) {
          gaps.push({
            from: _rowTimestamps[i - 1],
            to: _rowTimestamps[i],
            missingSec: Math.round((delta - _detectedIntervalMs) / 1000)
          });
        }
      }
      
      if (gaps.length === 0) {
        console.log(`[CsvAPI] Gap report: no gaps detected. Detected interval: ${detectedIntervalSec.toFixed(2)} sec`);
      } else {
        console.warn(`[CsvAPI] Gap report: ${gaps.length} gap(s) in "${file.name}" (detected interval: ${detectedIntervalSec.toFixed(2)} sec)`);
        gaps.forEach((g, idx) => {
          const from = new Date(g.from).toISOString();
          const to = new Date(g.to).toISOString();
          console.warn(`  Gap ${idx + 1}: ${from} → ${to}  (~${g.missingSec} sec missing)`);
        });
      }
      
      _fileLoaded = true;
      console.log(`[CsvAPI] Lazily loaded & indexed ${_numChannels} channels, ${_numSamples} samples from CSV file "${file.name}"`);
      return true;
    } catch (e) {
      console.error('[CsvAPI] Load file failed:', e);
      throw e;
    }
  },

  getFileTimeRange() {
    return { start: _startTimeMs, stop: _stopTimeMs };
  },

  getLoadedFileName() {
    return _file ? _file.name : '';
  },

  getNumOfSamples() {
    return _numSamples;
  },

  getSampleRate() {
    return _sampleRate;
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
    
    const startByte = _rowOffsets[startSample];
    const endByte = (endSample + 1 < _numSamples) ? _rowOffsets[endSample + 1] : _file.size;
    
    // Read only the slice for this page
    const slice = _file.slice(startByte, endByte);
    slice.text().then(text => {
      const lines = text.split(/\r?\n/);
      const pageRows = [];
      let parsedCount = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = parseCsvLine(line);
        if (parts.length > 0) {
          const rowIdx = startSample + parsedCount;
          if (rowIdx > endSample) break;
          
          let valuesStartIndex = 1;
          if (!isNaN(parseInt(parts[0], 10)) && !parts[0].includes('-') && !parts[0].includes('/') && !parts[0].includes('.')) {
            valuesStartIndex = 2;
          }
          
          const values = {};
          for (let c = 0; c < _channels.length; c++) {
            if (selectedChannelIds && !selectedChannelIds.includes(c)) continue;
            const valStr = parts[valuesStartIndex + c];
            const v = (valStr === undefined || valStr === '') ? null : parseFloat(valStr);
            values[c] = (v === null || isNaN(v)) ? null : v;
          }
          
          pageRows.push({
            index: rowIdx,
            recordId: _rowRecordIds[rowIdx],
            timestampMs: _rowTimestamps[rowIdx],
            values
          });
          parsedCount++;
        }
      }
      
      callback({
        total: _numSamples,
        sampleRate: _sampleRate,
        startTimeMs: _startTimeMs,
        stopTimeMs: _stopTimeMs,
        rows: pageRows
      });
    }).catch(e => {
      console.error("[CsvAPI] Failed to fetch table page:", e);
      callback({ total: _numSamples, rows: [] });
    });
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

    // Find row index range within the time query
    let startIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < _numSamples; i++) {
      const ts = _rowTimestamps[i];
      if (ts >= qStart && ts <= qStop) {
        if (startIdx === -1) startIdx = i;
        endIdx = i;
      }
    }

    if (startIdx === -1) {
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

    const totalFiltered = endIdx - startIdx + 1;
    const step = Math.max(1, Math.floor(totalFiltered / MAX_DISPLAY_SAMPLES));
    const pointIntervalMs = step * _detectedIntervalMs;
    const gapThresholdMs  = GAP_THRESHOLD_FACTOR * _detectedIntervalMs;

    // Identify segments separated by time-loss gaps
    const segments = [];
    let currentSegStart = startIdx;
    for (let i = startIdx + 1; i <= endIdx; i++) {
      const delta = _rowTimestamps[i] - _rowTimestamps[i - 1];
      if (delta > gapThresholdMs) {
        segments.push({ start: currentSegStart, end: i - 1 });
        currentSegStart = i;
      }
    }
    segments.push({ start: currentSegStart, end: endIdx });

    // Load, parse and downsample only specific segment slices in small batches
    const loadSegmentsData = async () => {
      const measurementData = [];
      const realStartTime   = [];
      const pointInterval   = [];

      const batchSize = 5000;
      for (const seg of segments) {
        const segValues = [];
        
        for (let batchStart = seg.start; batchStart <= seg.end; batchStart += batchSize) {
          const batchEnd = Math.min(batchStart + batchSize - 1, seg.end);
          const startByte = _rowOffsets[batchStart];
          const endByte = (batchEnd + 1 < _numSamples) ? _rowOffsets[batchEnd + 1] : _file.size;
          
          const slice = _file.slice(startByte, endByte);
          const text = await slice.text();
          const lines = text.split(/\r?\n/);
          
          let lineIdx = 0;
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const rowIdx = batchStart + lineIdx;
            if (rowIdx > batchEnd) break;
            
            // Check if this row matches downsampling interval
            if ((rowIdx - seg.start) % step === 0) {
              const parts = parseCsvLine(line);
              if (parts.length > 0) {
                let valuesStartIndex = 1;
                if (!isNaN(parseInt(parts[0], 10)) && !parts[0].includes('-') && !parts[0].includes('/') && !parts[0].includes('.')) {
                  valuesStartIndex = 2;
                }
                const valStr = parts[valuesStartIndex + chIdx];
                const v = (valStr === undefined || valStr === '') ? null : parseFloat(valStr);
                segValues.push((v === null || isNaN(v)) ? null : v);
              } else {
                segValues.push(null);
              }
            }
            lineIdx++;
          }
        }

        if (segValues.length > 0) {
          measurementData.push(segValues);
          realStartTime.push(_rowTimestamps[seg.start] + 3600000 * 8);
          pointInterval.push(pointIntervalMs);
        }
      }

      return { measurementData, realStartTime, pointInterval };
    };

    loadSegmentsData().then(res => {
      callback([{
        channel_id: channelId,
        measurementData: res.measurementData,
        realStartTime: res.realStartTime,
        pointInterval: res.pointInterval,
        min: ch._min,
        max: ch._max,
      }]);
    }).catch(e => {
      console.error("[CsvAPI] Failed to get measurement data:", e);
      callback([]);
    });
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

    const COLORS = ['#00ac86', '#FF5630', '#36B37E', '#6554C0', '#FF8B00',
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

    const escXml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const formatDateTime = (ms) => {
      const d = new Date(ms);
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    };

    const xmlHeader = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Font ss:Size="11"/></Style>
  <Style ss:ID="sTitle"><Font ss:Size="14" ss:Bold="1"/></Style>
  <Style ss:ID="sLabel"><Font ss:Size="11" ss:Bold="1"/></Style>
  <Style ss:ID="sHeader"><Font ss:Size="11" ss:Bold="1"/><Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="CSD Export">
  <Table>`;

    const xmlFooter = `  </Table>
 </Worksheet>
</Workbook>`;

    // ── Metadata header rows ──────────────────────────────────────────────────
    let metaXml = '';

    // Row 1: Title "S4A-Web V2"
    metaXml += '   <Row>\n';
    metaXml += '    <Cell ss:StyleID="sTitle"><Data ss:Type="String">S4A-Web</Data></Cell>\n';
    metaXml += '    <Cell ss:StyleID="sTitle"><Data ss:Type="String">V2</Data></Cell>\n';
    metaXml += '   </Row>\n';

    // Row 2: empty
    metaXml += '   <Row></Row>\n';

    // Row 3: Description / Record File
    metaXml += '   <Row>\n';
    metaXml += '    <Cell ss:StyleID="sLabel"><Data ss:Type="String">Description</Data></Cell>\n';
    metaXml += `    <Cell><Data ss:Type="String">Record File</Data></Cell>\n`;
    metaXml += '   </Row>\n';

    // Row 4: Start Time
    metaXml += '   <Row>\n';
    metaXml += '    <Cell ss:StyleID="sLabel"><Data ss:Type="String">Start Time</Data></Cell>\n';
    metaXml += `    <Cell><Data ss:Type="String">${formatDateTime(_startTimeMs)}</Data></Cell>\n`;
    metaXml += '   </Row>\n';

    // Row 5: End Time
    metaXml += '   <Row>\n';
    metaXml += '    <Cell ss:StyleID="sLabel"><Data ss:Type="String">End Time</Data></Cell>\n';
    metaXml += `    <Cell><Data ss:Type="String">${formatDateTime(_stopTimeMs)}</Data></Cell>\n`;
    metaXml += '   </Row>\n';

    // Row 6: Sample Rate (sec)
    metaXml += '   <Row>\n';
    metaXml += '    <Cell ss:StyleID="sLabel"><Data ss:Type="String">Sample Rate (sec)</Data></Cell>\n';
    metaXml += `    <Cell><Data ss:Type="Number">${_sampleIntervalSec}</Data></Cell>\n`;
    metaXml += '   </Row>\n';

    // Row 7: empty
    metaXml += '   <Row></Row>\n';

    // Row 8: empty
    metaXml += '   <Row></Row>\n';

    // Row 9: Column headers — TIME + channel descriptions with unit
    metaXml += '   <Row>\n';
    metaXml += '    <Cell ss:StyleID="sHeader"><Data ss:Type="String">TIME</Data></Cell>\n';
    _channels.forEach(ch => {
      const desc = ch.logic_channel_description || `Channel ${ch.channel_id}`;
      const unit = ch.unit_in_ascii ? ` (${ch.unit_in_ascii})` : '';
      metaXml += `    <Cell ss:StyleID="sHeader"><Data ss:Type="String">${escXml(desc + unit)}</Data></Cell>\n`;
    });
    metaXml += '   </Row>\n';

    const xmlChunks = [xmlHeader, metaXml];

    const chunkSize = 5000;
    for (let start = 0; start < _numSamples; start += chunkSize) {
      const end = Math.min(start + chunkSize, _numSamples);
      const startByte = _rowOffsets[start];
      const endByte = (end < _numSamples) ? _rowOffsets[end] : _file.size;
      
      const slice = _file.slice(startByte, endByte);
      const text = await slice.text();
      const lines = text.split(/\r?\n/);
      
      let chunkXml = '';
      let lineIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const rowIdx = start + lineIdx;
        if (rowIdx >= end) break;
        
        const parts = parseCsvLine(line);
        if (parts.length > 0) {
          let valuesStartIndex = 1;
          if (!isNaN(parseInt(parts[0], 10)) && !parts[0].includes('-') && !parts[0].includes('/') && !parts[0].includes('.')) {
            valuesStartIndex = 2;
          }
          
          const dateStr = formatDateTime(_rowTimestamps[rowIdx]);
          chunkXml += '   <Row>\n';
          chunkXml += `    <Cell><Data ss:Type="String">${dateStr}</Data></Cell>\n`;
          
          for (let c = 0; c < _numChannels; c++) {
            const valStr = parts[valuesStartIndex + c];
            if (valStr === undefined || valStr === '') {
              chunkXml += '    <Cell><Data ss:Type="String"></Data></Cell>\n';
            } else {
              chunkXml += `    <Cell><Data ss:Type="Number">${parseFloat(valStr)}</Data></Cell>\n`;
            }
          }
          chunkXml += '   </Row>\n';
        }
        lineIdx++;
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

    const baseName = _file.name ? _file.name.replace(/\.[^/.]+$/, "") : "export";
    link.setAttribute('download', `${baseName}_all_channels.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  async exportAllChannelsToCsv(onProgress) {
    if (!_fileLoaded || !_file) {
      throw new Error("No CSV file loaded");
    }
    
    // Direct, zero-heap binary download of the original file
    const url = URL.createObjectURL(_file);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', _file.name || `export_all_channels.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    if (onProgress) {
      onProgress(1.0);
    }
  },

  /**
   * Returns a summary of timestamp gaps and continuous segments in the loaded CSV.
   * Used for the pre-export confirmation dialog.
   */
  getGapSummary() {
    if (!_fileLoaded || _numSamples === 0) {
      return {
        gapCount: 0, gaps: [], segments: [],
        totalMissingSamples: 0, totalRealSamples: 0,
        totalCsdSamples: 0, naPercent: 0,
        detectedIntervalSec: 0, startTimeMs: 0, stopTimeMs: 0,
      };
    }

    const intervalMs     = _detectedIntervalMs > 0 ? _detectedIntervalMs : (_sampleIntervalSec * 1000);
    const gapThresholdMs = GAP_THRESHOLD_FACTOR * intervalMs;
    const gaps    = [];
    const segments = [];

    // Walk timestamps once, collecting gaps + segment boundaries simultaneously
    let segStartRow = 0;
    for (let i = 1; i < _numSamples; i++) {
      const delta = _rowTimestamps[i] - _rowTimestamps[i - 1];
      if (delta > gapThresholdMs) {
        const missingSamples = Math.round((delta - intervalMs) / intervalMs);

        // Close the current segment
        segments.push({
          startRow:    segStartRow,
          endRow:      i - 1,
          startTimeMs: _rowTimestamps[segStartRow],
          stopTimeMs:  _rowTimestamps[i - 1],
          rowCount:    i - segStartRow,
        });

        gaps.push({
          from:          _rowTimestamps[i - 1],
          to:            _rowTimestamps[i],
          deltaMs:       delta,
          missingSamples,
          missingMs:     delta - intervalMs,
          beforeRow:     i - 1,
          afterRow:      i,
        });

        segStartRow = i;
      }
    }
    // Final segment
    segments.push({
      startRow:    segStartRow,
      endRow:      _numSamples - 1,
      startTimeMs: _rowTimestamps[segStartRow],
      stopTimeMs:  _rowTimestamps[_numSamples - 1],
      rowCount:    _numSamples - segStartRow,
    });

    const totalMissingSamples = gaps.reduce((acc, g) => acc + g.missingSamples, 0);
    const totalCsdSamples     = Math.max(1, Math.round((_stopTimeMs - _startTimeMs) / intervalMs) + 1);
    const naPercent           = totalCsdSamples > 0 ? (totalMissingSamples / totalCsdSamples) * 100 : 0;

    return {
      gapCount:           gaps.length,
      gaps,
      segments,
      totalRealSamples:   _numSamples,
      totalMissingSamples,
      totalCsdSamples,
      naPercent,
      detectedIntervalSec: intervalMs / 1000,
      startTimeMs:         _startTimeMs,
      stopTimeMs:          _stopTimeMs,
    };
  },


  /**
   * Export the currently loaded CSV as a binary CSD file.
   * 
   * Gap handling: CSV files may have non-continuous timestamps (power-loss gaps).
   * We fill all missing sample slots between startTime and stopTime with DATA_INVALID
   * (-9999.0) so the output CSD file has a perfectly uniform sample grid.
   * 
   * Min/Max: Already computed during loadFromFile() scan and stored in ch._min / ch._max.
   */
  async exportToCsd(onProgress) {
    if (!_fileLoaded || !_file) {
      throw new Error('No CSV file loaded');
    }

    // ── CSD format constants ──────────────────────────────────────────────────
    const FILE_HEADER_LEN    = 34;
    const PROTOCOL_HEADER_LEN = 3552;
    const CHANNEL_HEADER_LEN  = 918;
    const RECORD_ID_LEN       = 4;
    const CHANNEL_VALUE_LEN   = 8;   // float64
    const DATA_INVALID        = -9999.0;

    const intervalMs  = _detectedIntervalMs > 0 ? _detectedIntervalMs : (_sampleIntervalSec * 1000);
    const intervalSec = intervalMs / 1000;

    // Total CSD records = every slot from startTime to stopTime at the detected interval
    const totalSamples = Math.max(1, Math.round((_stopTimeMs - _startTimeMs) / intervalMs) + 1);

    // ── Helper: write null-padded UTF-8 string into a DataView ───────────────
    function writeStr(dv, offset, str, maxLen) {
      const enc = new TextEncoder().encode(str || '');
      const len = Math.min(enc.length, maxLen - 1);
      for (let i = 0; i < len; i++) dv.setUint8(offset + i, enc[i]);
      for (let i = len; i < maxLen; i++) dv.setUint8(offset + i, 0);
    }

    // ── 1. File Info Header (34 bytes) ────────────────────────────────────────
    const fileHeader = new ArrayBuffer(FILE_HEADER_LEN);
    const fhDv = new DataView(fileHeader);
    fhDv.setInt32(0, 1, false);                    // version = 1
    writeStr(fhDv, 4, 'SUTO CSD', 10);            // identifier (10 bytes)
    // remaining bytes default to 0

    // ── 2. Protocol Header (3552 bytes) ───────────────────────────────────────
    const protoHeader = new ArrayBuffer(PROTOCOL_HEADER_LEN);
    const phDv = new DataView(protoHeader);
    writeStr(phDv, 506, _deviceName || 'CSV Device', 32);  // device name
    phDv.setInt32(3016, _numChannels, false);               // channel count
    phDv.setInt32(3020, totalSamples,  false);              // sample count
    phDv.setInt32(3024, Math.round(intervalSec), false);    // sample interval (sec)
    phDv.setBigInt64(3032, BigInt(_startTimeMs), false);    // start time ms
    phDv.setBigInt64(3040, BigInt(_stopTimeMs),  false);    // stop time ms

    // ── 3. Channel Headers (918 bytes × numChannels) ──────────────────────────
    const chHeadersBuf = new ArrayBuffer(CHANNEL_HEADER_LEN * _numChannels);
    const chDv = new DataView(chHeadersBuf);

    _channels.forEach((ch, idx) => {
      const base = idx * CHANNEL_HEADER_LEN;

      // pref (int64) at offset 0 — use 0
      chDv.setBigInt64(base + 0, BigInt(0), false);

      // Channel desc: int16 length + chars at +10
      const desc = ch.logic_channel_description || `CH${idx + 1}`;
      const descEnc = new TextEncoder().encode(desc);
      const descLen = Math.min(descEnc.length, 126);
      chDv.setInt16(base + 8, descLen, false);
      for (let i = 0; i < descLen; i++) chDv.setUint8(base + 10 + i, descEnc[i]);

      // Sub-device desc length at +138 (empty)
      chDv.setInt16(base + 138, 0, false);

      // Device desc length at +268 (empty)
      chDv.setInt16(base + 268, 0, false);

      // Sensor desc length at +289, text at +291
      const senDesc = ch.sensor_description || desc;
      const senEnc = new TextEncoder().encode(senDesc);
      const senLen = Math.min(senEnc.length, 17);
      chDv.setInt16(base + 289, senLen, false);
      for (let i = 0; i < senLen; i++) chDv.setUint8(base + 291 + i, senEnc[i]);

      // Unit text at field position FP = 780+4+4 = 788
      const FP = 788;
      const unitEnc = new TextEncoder().encode(ch.unit_in_ascii || '');
      const unitLen = Math.min(unitEnc.length, 56);
      chDv.setInt16(base + FP, unitLen, false);
      for (let i = 0; i < unitLen; i++) chDv.setUint8(base + FP + 2 + i, unitEnc[i]);

      // Stats at statsBase = FP + 60 = 848
      // resolution(int32, 4) + min(float64, 8) + max(float64, 8)
      const statsBase = FP + 60; // = 848
      const resolution = ch.resolution !== undefined ? ch.resolution : 2;
      chDv.setInt32(base + statsBase,      resolution, false);     // resolution
      chDv.setFloat64(base + statsBase + 4,  ch._min,  false);     // min
      chDv.setFloat64(base + statsBase + 12, ch._max,  false);     // max

      // sensor_id at statsBase+28
      chDv.setInt32(base + statsBase + 28, ch.sensor_id || idx, false);
    });

    // ── 4. Build a timestamp → row-index lookup map ───────────────────────────
    // Key = rounded timestamp slot index = Math.round((ts - startTime) / intervalMs)
    // For each CSD slot, look up the CSV row closest to that slot time.
    const slotToRow = new Map();
    for (let r = 0; r < _numSamples; r++) {
      const ts = _rowTimestamps[r];
      const slotIdx = Math.round((ts - _startTimeMs) / intervalMs);
      if (!slotToRow.has(slotIdx)) {
        slotToRow.set(slotIdx, r);
      }
    }

    // ── 5. Write data records ─────────────────────────────────────────────────
    const recordLen = RECORD_ID_LEN + _numChannels * CHANNEL_VALUE_LEN;
    const dataSize  = totalSamples * recordLen;

    // Use streaming save if File System Access API is available (for large exports)
    const useStreaming = 'showSaveFilePicker' in window;
    const baseName = (_file.name || 'export').replace(/\.[^/.]+$/, '');

    if (useStreaming) {
      let fileHandle;
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: `${baseName}.csd`,
          types: [{ description: 'CSD Files', accept: { 'application/octet-stream': ['.csd'] } }],
        });
      } catch (err) {
        // User cancelled
        console.log('[CsvAPI] CSD export cancelled:', err);
        return;
      }

      const writable = await fileHandle.createWritable();
      const writer   = writable.getWriter();

      try {
        // Write headers
        await writer.write(fileHeader);
        await writer.write(protoHeader);
        await writer.write(chHeadersBuf);

        // Write data in chunks of 5000 records
        const CHUNK = 5000;
        const chunkBuf = new ArrayBuffer(CHUNK * recordLen);
        const chunkDv  = new DataView(chunkBuf);

        for (let slotBase = 0; slotBase < totalSamples; slotBase += CHUNK) {
          const chunkEnd = Math.min(slotBase + CHUNK, totalSamples);
          const count    = chunkEnd - slotBase;

          // Collect which CSV rows we need for this chunk
          const neededRows = [];
          for (let s = 0; s < count; s++) {
            const slotIdx = slotBase + s;
            const rowIdx  = slotToRow.has(slotIdx) ? slotToRow.get(slotIdx) : -1;
            neededRows.push(rowIdx);
          }

          // Batch-read unique CSV rows for this chunk
          const rowData = new Map(); // rowIdx → Float64Array of channel values
          const uniqueRows = [...new Set(neededRows.filter(r => r >= 0))].sort((a, b) => a - b);

          if (uniqueRows.length > 0) {
            // Read file slices in contiguous batches
            const csvBatchSize = 2000;
            for (let bi = 0; bi < uniqueRows.length; bi += csvBatchSize) {
              const batchRows = uniqueRows.slice(bi, bi + csvBatchSize);
              const startByte = _rowOffsets[batchRows[0]];
              const lastRow   = batchRows[batchRows.length - 1];
              const endByte   = (lastRow + 1 < _numSamples) ? _rowOffsets[lastRow + 1] : _file.size;

              const slice = _file.slice(startByte, endByte);
              const text  = await slice.text();
              const lines = text.split(/\r?\n/);

              let lineIdx = 0;
              let batchRowIdx = 0;

              for (let li = 0; li < lines.length && batchRowIdx < batchRows.length; li++) {
                const line = lines[li].trim();
                if (!line) continue;

                const csvRowIdx = batchRows[batchRowIdx];
                // Verify this is the right row by checking offset alignment
                // We walk linearly through rows in the slice
                const parts = parseCsvLine(line);
                if (parts.length > 0) {
                  let valStart = 1;
                  if (!isNaN(parseInt(parts[0], 10)) && !parts[0].includes('-') && !parts[0].includes('/') && !parts[0].includes('.')) {
                    valStart = 2;
                  }
                  const vals = new Float64Array(_numChannels);
                  for (let c = 0; c < _numChannels; c++) {
                    const vs = parts[valStart + c];
                    const v  = (!vs || vs === '') ? DATA_INVALID : parseFloat(vs);
                    vals[c]  = isNaN(v) ? DATA_INVALID : v;
                  }
                  rowData.set(csvRowIdx, vals);
                  batchRowIdx++;
                }
                lineIdx++;
              }
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }

          // Fill chunk buffer
          for (let s = 0; s < count; s++) {
            const offset  = s * recordLen;
            const slotIdx = slotBase + s;
            chunkDv.setInt32(offset, slotIdx + 1, false);  // record ID

            const rowIdx = neededRows[s];
            const vals   = rowIdx >= 0 ? rowData.get(rowIdx) : null;

            for (let c = 0; c < _numChannels; c++) {
              const v = (vals && vals[c] !== undefined) ? vals[c] : DATA_INVALID;
              chunkDv.setFloat64(offset + RECORD_ID_LEN + c * CHANNEL_VALUE_LEN, v, false);
            }
          }

          await writer.write(chunkBuf.slice(0, count * recordLen));

          if (onProgress) onProgress(chunkEnd / totalSamples);
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } finally {
        await writer.close();
      }

    } else {
      // In-memory fallback (for browsers without File System Access API)
      const parts = [fileHeader, protoHeader, chHeadersBuf];
      const dataBuf = new ArrayBuffer(dataSize);
      const dataDv  = new DataView(dataBuf);

      const CHUNK = 5000;

      for (let slotBase = 0; slotBase < totalSamples; slotBase += CHUNK) {
        const chunkEnd = Math.min(slotBase + CHUNK, totalSamples);

        // Collect needed CSV rows
        const neededRows = [];
        for (let s = slotBase; s < chunkEnd; s++) {
          neededRows.push(slotToRow.has(s) ? slotToRow.get(s) : -1);
        }
        const uniqueRows = [...new Set(neededRows.filter(r => r >= 0))].sort((a, b) => a - b);

        const rowData = new Map();
        if (uniqueRows.length > 0) {
          const startByte = _rowOffsets[uniqueRows[0]];
          const lastRow   = uniqueRows[uniqueRows.length - 1];
          const endByte   = (lastRow + 1 < _numSamples) ? _rowOffsets[lastRow + 1] : _file.size;

          const slice = _file.slice(startByte, endByte);
          const text  = await slice.text();
          const lines = text.split(/\r?\n/);

          let batchRowIdx = 0;
          for (let li = 0; li < lines.length && batchRowIdx < uniqueRows.length; li++) {
            const line = lines[li].trim();
            if (!line) continue;
            const csvRowIdx = uniqueRows[batchRowIdx];
            const csvParts  = parseCsvLine(line);
            if (csvParts.length > 0) {
              let valStart = 1;
              if (!isNaN(parseInt(csvParts[0], 10)) && !csvParts[0].includes('-') && !csvParts[0].includes('/') && !csvParts[0].includes('.')) {
                valStart = 2;
              }
              const vals = new Float64Array(_numChannels);
              for (let c = 0; c < _numChannels; c++) {
                const vs = csvParts[valStart + c];
                const v  = (!vs || vs === '') ? DATA_INVALID : parseFloat(vs);
                vals[c]  = isNaN(v) ? DATA_INVALID : v;
              }
              rowData.set(csvRowIdx, vals);
              batchRowIdx++;
            }
          }
        }

        for (let s = slotBase; s < chunkEnd; s++) {
          const offset  = s * recordLen;
          dataDv.setInt32(offset, s + 1, false);
          const rowIdx = neededRows[s - slotBase];
          const vals   = rowIdx >= 0 ? rowData.get(rowIdx) : null;
          for (let c = 0; c < _numChannels; c++) {
            const v = (vals && vals[c] !== undefined) ? vals[c] : DATA_INVALID;
            dataDv.setFloat64(offset + RECORD_ID_LEN + c * CHANNEL_VALUE_LEN, v, false);
          }
        }

        if (onProgress) onProgress(chunkEnd / totalSamples);
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      parts.push(dataBuf);
      const blob = new Blob(parts, { type: 'application/octet-stream' });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `${baseName}.csd`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  },

  /**
   * Export each continuous time segment as its own independent CSD file.
   * No N/A padding — each file contains only real data for its period.
   * Files are named: baseName_part01.csd, baseName_part02.csd, …
   */
  async exportToCsdSplit(onProgress) {
    if (!_fileLoaded || !_file) {
      throw new Error('No CSV file loaded');
    }

    const summary  = this.getGapSummary();
    const segments = summary.segments;
    if (!segments || segments.length === 0) {
      throw new Error('No segments found for split export');
    }

    const FILE_HEADER_LEN     = 34;
    const PROTOCOL_HEADER_LEN = 3552;
    const CHANNEL_HEADER_LEN  = 918;
    const RECORD_ID_LEN       = 4;
    const CHANNEL_VALUE_LEN   = 8;
    const DATA_INVALID        = -9999.0;

    const intervalMs  = _detectedIntervalMs > 0 ? _detectedIntervalMs : (_sampleIntervalSec * 1000);
    const intervalSec = intervalMs / 1000;
    const baseName    = (_file.name || 'export').replace(/\.[^/.]+$/, '');
    const padLen      = String(segments.length).length;

    // ── Shared header builders ────────────────────────────────────────────────
    function writeStr(dv, offset, str, maxLen) {
      const enc = new TextEncoder().encode(str || '');
      const len = Math.min(enc.length, maxLen - 1);
      for (let i = 0; i < len; i++) dv.setUint8(offset + i, enc[i]);
      for (let i = len; i < maxLen; i++) dv.setUint8(offset + i, 0);
    }

    function buildFileHeader() {
      const buf = new ArrayBuffer(FILE_HEADER_LEN);
      const dv  = new DataView(buf);
      dv.setInt32(0, 1, false);
      writeStr(dv, 4, 'SUTO CSD', 10);
      return buf;
    }

    function buildProtoHeader(segStartMs, segStopMs, segSamples) {
      const buf = new ArrayBuffer(PROTOCOL_HEADER_LEN);
      const dv  = new DataView(buf);
      writeStr(dv, 506, _deviceName || 'CSV Device', 32);
      dv.setInt32(3016, _numChannels, false);
      dv.setInt32(3020, segSamples,   false);
      dv.setInt32(3024, Math.round(intervalSec), false);
      dv.setBigInt64(3032, BigInt(segStartMs), false);
      dv.setBigInt64(3040, BigInt(segStopMs),  false);
      return buf;
    }

    function buildChannelHeaders(segMin, segMax) {
      const buf = new ArrayBuffer(CHANNEL_HEADER_LEN * _numChannels);
      const dv  = new DataView(buf);
      _channels.forEach((ch, idx) => {
        const base = idx * CHANNEL_HEADER_LEN;
        dv.setBigInt64(base, BigInt(0), false);
        const desc    = ch.logic_channel_description || `CH${idx + 1}`;
        const descEnc = new TextEncoder().encode(desc);
        const descLen = Math.min(descEnc.length, 126);
        dv.setInt16(base + 8, descLen, false);
        for (let i = 0; i < descLen; i++) dv.setUint8(base + 10 + i, descEnc[i]);
        dv.setInt16(base + 138, 0, false);
        dv.setInt16(base + 268, 0, false);
        const senDesc = ch.sensor_description || desc;
        const senEnc  = new TextEncoder().encode(senDesc);
        const senLen  = Math.min(senEnc.length, 17);
        dv.setInt16(base + 289, senLen, false);
        for (let i = 0; i < senLen; i++) dv.setUint8(base + 291 + i, senEnc[i]);
        const FP      = 788;
        const unitEnc = new TextEncoder().encode(ch.unit_in_ascii || '');
        const unitLen = Math.min(unitEnc.length, 56);
        dv.setInt16(base + FP, unitLen, false);
        for (let i = 0; i < unitLen; i++) dv.setUint8(base + FP + 2 + i, unitEnc[i]);
        const statsBase  = FP + 60;
        const resolution = ch.resolution !== undefined ? ch.resolution : 2;
        dv.setInt32(base + statsBase,      resolution, false);
        dv.setFloat64(base + statsBase + 4,  segMin[idx],  false);
        dv.setFloat64(base + statsBase + 12, segMax[idx],  false);
        dv.setInt32(base + statsBase + 28, ch.sensor_id || idx, false);
      });
      return buf;
    }

    // ── Per-segment export ────────────────────────────────────────────────────
    for (let si = 0; si < segments.length; si++) {
      const seg          = segments[si];
      const segStartMs   = seg.startTimeMs;
      const segStopMs    = seg.stopTimeMs;
      const totalSamples = Math.max(1, Math.round((segStopMs - segStartMs) / intervalMs) + 1);

      const segMin = Array(_numChannels).fill(Infinity);
      const segMax = Array(_numChannels).fill(-Infinity);

      // Build slot → row map for this segment
      const slotToRow = new Map();
      for (let r = seg.startRow; r <= seg.endRow; r++) {
        const slotIdx = Math.round((_rowTimestamps[r] - segStartMs) / intervalMs);
        if (!slotToRow.has(slotIdx)) slotToRow.set(slotIdx, r);
      }

      const recordLen = RECORD_ID_LEN + _numChannels * CHANNEL_VALUE_LEN;
      const dataBuf   = new ArrayBuffer(totalSamples * recordLen);
      const dataDv    = new DataView(dataBuf);
      const CHUNK     = 5000;

      for (let slotBase = 0; slotBase < totalSamples; slotBase += CHUNK) {
        const chunkEnd   = Math.min(slotBase + CHUNK, totalSamples);
        const neededRows = [];
        for (let s = slotBase; s < chunkEnd; s++) {
          neededRows.push(slotToRow.has(s) ? slotToRow.get(s) : -1);
        }

        // Batch-read CSV rows needed by this chunk
        const uniqueRows = [...new Set(neededRows.filter(r => r >= 0))].sort((a, b) => a - b);
        const rowData    = new Map();
        if (uniqueRows.length > 0) {
          const startByte = _rowOffsets[uniqueRows[0]];
          const lastRow   = uniqueRows[uniqueRows.length - 1];
          const endByte   = (lastRow + 1 < _numSamples) ? _rowOffsets[lastRow + 1] : _file.size;
          const text      = await _file.slice(startByte, endByte).text();
          const lines     = text.split(/\r?\n/);
          let   bri       = 0;
          for (let li = 0; li < lines.length && bri < uniqueRows.length; li++) {
            const line = lines[li].trim();
            if (!line) continue;
            const csvParts = parseCsvLine(line);
            if (csvParts.length > 0) {
              let vs = 1;
              if (!isNaN(parseInt(csvParts[0], 10)) && !csvParts[0].includes('-') && !csvParts[0].includes('/') && !csvParts[0].includes('.')) vs = 2;
              const vals = new Float64Array(_numChannels);
              for (let c = 0; c < _numChannels; c++) {
                const v = (!csvParts[vs + c] || csvParts[vs + c] === '') ? DATA_INVALID : parseFloat(csvParts[vs + c]);
                vals[c] = isNaN(v) ? DATA_INVALID : v;
              }
              rowData.set(uniqueRows[bri], vals);
              bri++;
            }
          }
        }

        // Write records into dataBuf
        for (let s = slotBase; s < chunkEnd; s++) {
          const off    = s * recordLen;
          dataDv.setInt32(off, s + 1, false);
          const vals   = (() => { const r = neededRows[s - slotBase]; return r >= 0 ? rowData.get(r) : null; })();
          for (let c = 0; c < _numChannels; c++) {
            const v = (vals && vals[c] !== undefined) ? vals[c] : DATA_INVALID;
            dataDv.setFloat64(off + RECORD_ID_LEN + c * CHANNEL_VALUE_LEN, v, false);
            if (v !== DATA_INVALID && !isNaN(v)) {
              if (v < segMin[c]) segMin[c] = v;
              if (v > segMax[c]) segMax[c] = v;
            }
          }
        }

        if (onProgress) onProgress((si + (chunkEnd / totalSamples)) / segments.length);
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // Sanitize segment-specific min/max values
      for (let c = 0; c < _numChannels; c++) {
        if (segMin[c] === Infinity) segMin[c] = 0;
        if (segMax[c] === -Infinity) segMax[c] = 100;
      }
      const chHeadersBuf = buildChannelHeaders(segMin, segMax);

      // Download this segment's CSD file
      const blob = new Blob(
        [buildFileHeader(), buildProtoHeader(segStartMs, segStopMs, totalSamples), chHeadersBuf, dataBuf],
        { type: 'application/octet-stream' }
      );
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href  = url;
      const num  = String(si + 1).padStart(padLen, '0');
      link.setAttribute('download', `${baseName}_part${num}.csd`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Brief pause between downloads so browsers don't block them
      if (si < segments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }
  },

  async getConsumptionData(onProgress) {

    if (!_fileLoaded) {
      return [];
    }
    
    const allRows = [];
    const chunkSize = 10000;
    
    for (let start = 0; start < _numSamples; start += chunkSize) {
      const end = Math.min(start + chunkSize, _numSamples);
      const startByte = _rowOffsets[start];
      const endByte = (end < _numSamples) ? _rowOffsets[end] : _file.size;
      
      const slice = _file.slice(startByte, endByte);
      const text = await slice.text();
      const lines = text.split(/\r?\n/);
      
      let lineIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const rowIdx = start + lineIdx;
        if (rowIdx >= end) break;
        
        const parts = parseCsvLine(line);
        if (parts.length > 0) {
          let valuesStartIndex = 1;
          if (!isNaN(parseInt(parts[0], 10)) && !parts[0].includes('-') && !parts[0].includes('/') && !parts[0].includes('.')) {
            valuesStartIndex = 2;
          }
          
          const values = {};
          for (let c = 0; c < _numChannels; c++) {
            const valStr = parts[valuesStartIndex + c];
            const v = (valStr === undefined || valStr === '') ? null : parseFloat(valStr);
            values[c] = (v === null || isNaN(v)) ? null : v;
          }
          
          allRows.push({
            timestampMs: _rowTimestamps[rowIdx],
            values
          });
        }
        lineIdx++;
      }
      
      if (onProgress) {
        onProgress(end / _numSamples);
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    return allRows;
  }
};

export default CsvAPI;
