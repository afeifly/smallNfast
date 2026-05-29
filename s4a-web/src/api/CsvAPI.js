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
      
      // 3. Compute detected interval and gap report
      let detectedIntervalSec = _sampleIntervalSec;
      if (_rowTimestamps.length >= 2) {
        const deltas = [];
        for (let i = 1; i < _rowTimestamps.length; i++) {
          const d = _rowTimestamps[i] - _rowTimestamps[i - 1];
          if (d > 0) deltas.push(d);
        }
        if (deltas.length > 0) {
          deltas.sort((a, b) => a - b);
          const mid = Math.floor(deltas.length / 2);
          const medianMs = deltas.length % 2 === 0
            ? (deltas[mid - 1] + deltas[mid]) / 2
            : deltas[mid];
          detectedIntervalSec = medianMs / 1000;
        }
      }
      _detectedIntervalMs = detectedIntervalSec * 1000;
      
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
          
          const dateStr = new Date(_rowTimestamps[rowIdx]).toISOString();
          chunkXml += '   <Row>\n';
          chunkXml += `    <Cell><Data ss:Type="String">${dateStr}</Data></Cell>\n`;
          chunkXml += `    <Cell><Data ss:Type="Number">${_rowRecordIds[rowIdx]}</Data></Cell>\n`;
          
          for (let c = 0; c < _numChannels; c++) {
            const valStr = parts[valuesStartIndex + c];
            const v = (valStr === undefined || valStr === '') ? null : parseFloat(valStr);
            if (v === null || isNaN(v)) {
              chunkXml += '    <Cell><Data ss:Type="String"></Data></Cell>\n';
            } else {
              chunkXml += `    <Cell><Data ss:Type="Number">${v}</Data></Cell>\n`;
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

    link.setAttribute('download', `export_all_channels.xls`);
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
