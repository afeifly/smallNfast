import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { classifyChannel } from '../analysis/LeakEngine.js';
import CsdAPI from './CsdAPI';

describe('CsdAPI Parser', () => {
  it('correctly parses CSD binary file headers and channel info', async () => {
    // 1. Construct mock CSD binary buffer
    const FILE_HEADER_LEN     = 34;
    const PROTOCOL_HEADER_LEN = 3552;
    const CHANNEL_HEADER_LEN  = 918;
    const RECORD_ID_LEN       = 4;
    const CHANNEL_VALUE_LEN   = 8;

    const numChannels = 2;
    const numSamples = 5;

    const protocolHeaderStart = FILE_HEADER_LEN;
    const channelHeadersStart = protocolHeaderStart + PROTOCOL_HEADER_LEN;
    const dataStart = channelHeadersStart + numChannels * CHANNEL_HEADER_LEN;
    const recordLen = RECORD_ID_LEN + numChannels * CHANNEL_VALUE_LEN;
    const totalSize = dataStart + numSamples * recordLen;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    // Write File Header
    view.setInt32(0, 1, false); // version
    // identifier 'SUTO CSD' (10 bytes) at offset 4
    const encoder = new TextEncoder();
    const idBytes = encoder.encode('SUTO CSD');
    for (let i = 0; i < idBytes.length; i++) {
      view.setUint8(4 + i, idBytes[i]);
    }

    // Write Protocol Header
    // rawNumChannels at offset 3016 of protocol header
    view.setInt32(protocolHeaderStart + 3016, numChannels, false);
    // rawNumSamples at offset 3020 of protocol header
    view.setInt32(protocolHeaderStart + 3020, numSamples, false);
    // rawSampleRate at offset 3024 of protocol header (1 second interval)
    view.setInt32(protocolHeaderStart + 3024, 1, false);
    // startTime at 3032 (epoch timestamp)
    const startTimeMs = 1716380000000; // May 2024
    view.setBigInt64(protocolHeaderStart + 3032, BigInt(startTimeMs), false);
    // stopTime at 3040
    const stopTimeMs = startTimeMs + numSamples * 1000;
    view.setBigInt64(protocolHeaderStart + 3040, BigInt(stopTimeMs), false);

    // Write Channel Headers
    for (let c = 0; c < numChannels; c++) {
      const chStart = channelHeadersStart + c * CHANNEL_HEADER_LEN;

      // pref at 0
      view.setBigInt64(chStart + 0, BigInt(100 + c), false);

      // channelDescLen at 8
      const descName = `Ch_${c}`;
      view.setInt16(chStart + 8, descName.length, false);
      const descBytes = encoder.encode(descName);
      for (let i = 0; i < descBytes.length; i++) {
        view.setUint8(chStart + 10 + i, descBytes[i]);
      }

      // statsBase is 848 (FP=788 + 60)
      const statsBase = 848;
      // resolution (int32) at statsBase
      view.setInt32(chStart + statsBase, 2 + c, false);
      // min (double) at statsBase + 4 = 852
      view.setFloat64(chStart + statsBase + 4, 1.5 * c, false);
      // max (double) at statsBase + 12 = 860
      view.setFloat64(chStart + statsBase + 12, 100.0 * (c + 1), false);
      // sensorId (int32) at statsBase + 28 = 876
      view.setInt32(chStart + statsBase + 28, 5000 + c, false);
    }

    // Write Data Records
    for (let s = 0; s < numSamples; s++) {
      const recStart = dataStart + s * recordLen;
      // Record ID (4 bytes)
      view.setInt32(recStart, s, false);
      // Channel 0 (double)
      view.setFloat64(recStart + 4, 10.0 + s, false);
      // Channel 1 (double)
      view.setFloat64(recStart + 12, 20.0 + s, false);
    }

    // 2. Mock FileSystemFileHandle
    const mockFile = {
      name: 'test.csd',
      size: totalSize,
      slice(start, end) {
        return {
          arrayBuffer: async () => buffer.slice(start, end)
        };
      }
    };

    const mockHandle = {
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => mockFile
    };

    // 3. Load via CsdAPI
    const success = await CsdAPI.loadFileFromHandle(mockHandle);
    expect(success).toBe(true);
    expect(CsdAPI.isFileLoaded()).toBe(true);

    const timeRange = CsdAPI.getFileTimeRange();
    expect(timeRange.start).toBe(startTimeMs);
    expect(timeRange.stop).toBe(stopTimeMs);

    // 4. Verify Channels
    let channelsResult = null;
    CsdAPI.getChannels(res => {
      channelsResult = res.logging_chs;
    });

    // Wait a brief moment for getChannels callback
    await new Promise(r => setTimeout(r, 60));

    expect(channelsResult).toHaveLength(numChannels);
    expect(channelsResult[0].logic_channel_description).toBe('Ch_0');
    expect(channelsResult[1].logic_channel_description).toBe('Ch_1');
    expect(channelsResult[0].sensor_id).toBe(5000);
    expect(channelsResult[1].sensor_id).toBe(5001);
    expect(channelsResult[0].resolution).toBe(2);
    expect(channelsResult[1].resolution).toBe(3);

    // 5. Verify Measurement Data
    let dataResult = null;
    // getMeasurementData(channelId, startTime, stopTime, tableInterval, getDataWay, callback)
    // qStart = startTime - 8 hours
    // qStop = stopTime - 8 hours
    // We add 8 hours in query to cancel it out:
    const qStart = startTimeMs + 3600000 * 8;
    const qStop = stopTimeMs + 3600000 * 8;

    CsdAPI.getMeasurementData('0', qStart, qStop, 1, 2, res => {
      dataResult = res;
    });

    await new Promise(r => setTimeout(r, 60));

    expect(dataResult).not.toBeNull();
    expect(dataResult[0].channel_id).toBe('0');
    expect(dataResult[0].measurementData[0]).toHaveLength(numSamples);
    expect(dataResult[0].measurementData[0][0]).toBe(10.0);
    expect(dataResult[0].measurementData[0][4]).toBe(14.0);
  });


  it('correctly exports data to CSV and Excel', async () => {
    const createdBlobs = [];
    const downloadedFiles = [];

    global.URL.createObjectURL = (blob) => {
      createdBlobs.push(blob);
      return 'mock-url';
    };
    global.URL.revokeObjectURL = () => {};
    
    const originalAppend = document.body.appendChild;
    const originalRemove = document.body.removeChild;
    
    document.body.appendChild = (el) => {
      if (el.tagName === 'A') {
        downloadedFiles.push({
          href: el.href,
          download: el.getAttribute('download')
        });
      }
      return originalAppend.call(document.body, el);
    };

    document.body.removeChild = (el) => {
      try {
        return originalRemove.call(document.body, el);
      } catch {
        return el;
      }
    };

    window.HTMLAnchorElement.prototype.click = function() {};

    // Trigger CSV export
    let csvProgress = [];
    await CsdAPI.exportAllChannelsToCsv((p) => csvProgress.push(p));
    
    expect(csvProgress).toContain(1);
    expect(createdBlobs).toHaveLength(1);
    expect(downloadedFiles).toHaveLength(1);
    expect(downloadedFiles[0].download).toBe('test_all_channels.csv');

    // Read Blob content to verify CSV structure
    const csvText = await createdBlobs[0].text();
    const csvLines = csvText.split('\n');
    expect(csvLines[0]).toBe('CSD Device Raw Data');
    expect(csvLines[2]).toContain('Start Date Time,');
    expect(csvLines[3]).toContain('End Date Time,');
    expect(csvLines[4]).toBe('Sample Rate(sec),1');
    expect(csvLines[5]).toBe('NO.Of Channels,2');
    expect(csvLines[6]).toBe('NO.Of Records,5');
    expect(csvLines[8]).toBe('No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point');
    expect(csvLines[9]).toBe('1,Ch_0,Ch_0,,0.01,Location 1/Ch_0');
    expect(csvLines[10]).toBe('2,Ch_1,Ch_1,,0.001,Location 1/Ch_1');
    expect(csvLines[12]).toBe('Date Time,Ch_0,Ch_1');
    expect(csvLines[13]).toContain('2024');

    // Trigger Excel export
    let excelProgress = [];
    await CsdAPI.exportAllChannelsToExcel((p) => excelProgress.push(p));

    expect(excelProgress).toContain(1);
    expect(createdBlobs).toHaveLength(2);
    expect(downloadedFiles).toHaveLength(2);
    expect(downloadedFiles[1].download).toBe('test_all_channels.xls');

    const excelText = await createdBlobs[1].text();
    expect(excelText).toContain('<?xml version="1.0"?>');
    expect(excelText).toContain('ss:Name="CSD Export"');
    expect(excelText).toContain('<Data ss:Type="String">S4A-Web</Data>');
    expect(excelText).toContain('<Data ss:Type="String">Start Time</Data>');
    expect(excelText).toContain('<Data ss:Type="String">End Time</Data>');
    expect(excelText).toContain('<Data ss:Type="String">Sample Rate (sec)</Data>');
    expect(excelText).toContain('ss:StyleID="sHeader"');
    expect(excelText).toContain('<Data ss:Type="String">TIME</Data>');
    expect(excelText).toContain('<Data ss:Type="Number">10</Data>');

    // Cleanup
    document.body.appendChild = originalAppend;
    document.body.removeChild = originalRemove;
  });

  it('correctly retrieves pages of rows via getTablePage', async () => {
    // 1. Construct mock CSD binary buffer with 3 channels and 5 samples
    const FILE_HEADER_LEN     = 34;
    const PROTOCOL_HEADER_LEN = 3552;
    const CHANNEL_HEADER_LEN  = 918;
    const RECORD_ID_LEN       = 4;
    const CHANNEL_VALUE_LEN   = 8;

    const numChannels = 3;
    const numSamples = 5;

    const protocolHeaderStart = FILE_HEADER_LEN;
    const channelHeadersStart = protocolHeaderStart + PROTOCOL_HEADER_LEN;
    const dataStart = channelHeadersStart + numChannels * CHANNEL_HEADER_LEN;
    const recordLen = RECORD_ID_LEN + numChannels * CHANNEL_VALUE_LEN;
    const totalSize = dataStart + numSamples * recordLen;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    // Write File Header
    view.setInt32(0, 1, false);
    const encoder = new TextEncoder();
    const idBytes = encoder.encode('SUTO CSD');
    for (let i = 0; i < idBytes.length; i++) {
      view.setUint8(4 + i, idBytes[i]);
    }

    // Write Protocol Header
    view.setInt32(protocolHeaderStart + 3016, numChannels, false);
    view.setInt32(protocolHeaderStart + 3020, numSamples, false);
    view.setInt32(protocolHeaderStart + 3024, 2, false); // 2 second interval
    const startTimeMs = 1716380000000;
    view.setBigInt64(protocolHeaderStart + 3032, BigInt(startTimeMs), false);
    const stopTimeMs = startTimeMs + numSamples * 2 * 1000;
    view.setBigInt64(protocolHeaderStart + 3040, BigInt(stopTimeMs), false);

    // Write Channel Headers
    for (let c = 0; c < numChannels; c++) {
      const chStart = channelHeadersStart + c * CHANNEL_HEADER_LEN;
      view.setBigInt64(chStart + 0, BigInt(100 + c), false);
      const descName = `Ch_${c}`;
      view.setInt16(chStart + 8, descName.length, false);
      const descBytes = encoder.encode(descName);
      for (let i = 0; i < descBytes.length; i++) {
        view.setUint8(chStart + 10 + i, descBytes[i]);
      }
      const statsBase = 848;
      view.setFloat64(chStart + statsBase + 4, 1.0 * c, false);
      view.setFloat64(chStart + statsBase + 12, 10.0 * (c + 1), false);
      view.setInt32(chStart + statsBase + 28, 5000 + c, false);
    }

    // Write Data Records
    for (let s = 0; s < numSamples; s++) {
      const recStart = dataStart + s * recordLen;
      view.setInt32(recStart, 100 + s, false); // Record ID
      view.setFloat64(recStart + 4, 10.0 + s, false);  // Ch 0
      view.setFloat64(recStart + 12, 20.0 + s, false); // Ch 1
      view.setFloat64(recStart + 20, 30.0 + s, false); // Ch 2
    }

    const mockFile = {
      name: 'test-table.csd',
      size: totalSize,
      slice(start, end) {
        return {
          arrayBuffer: async () => buffer.slice(start, end)
        };
      }
    };

    const mockHandle = {
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => mockFile
    };

    // Load file
    const success = await CsdAPI.loadFileFromHandle(mockHandle);
    expect(success).toBe(true);

    // Query Page 0 with pageSize=2, only requesting Ch 0 & Ch 2
    let page0Result = null;
    CsdAPI.getTablePage(0, 2, [0, 2], (res) => {
      page0Result = res;
    });

    await new Promise(r => setTimeout(r, 60));

    expect(page0Result).not.toBeNull();
    expect(page0Result.total).toBe(numSamples);
    expect(page0Result.rows).toHaveLength(2);
    
    // Row 0
    expect(page0Result.rows[0].index).toBe(0);
    expect(page0Result.rows[0].recordId).toBe(100);
    expect(page0Result.rows[0].timestampMs).toBe(startTimeMs);
    expect(page0Result.rows[0].values[0]).toBe(10.0);
    expect(page0Result.rows[0].values[1]).toBeUndefined(); // Filtered out
    expect(page0Result.rows[0].values[2]).toBe(30.0);

    // Row 1 (timestamp for 2s interval is +2000ms per sample)
    expect(page0Result.rows[1].index).toBe(1);
    expect(page0Result.rows[1].recordId).toBe(101);
    expect(page0Result.rows[1].timestampMs).toBe(startTimeMs + 2000);
    expect(page0Result.rows[1].values[0]).toBe(11.0);
    expect(page0Result.rows[1].values[2]).toBe(31.0);

    // Query Page 2 (samples 4, pageIndex=2, pageSize=2)
    let page2Result = null;
    CsdAPI.getTablePage(2, 2, [0, 1, 2], (res) => {
      page2Result = res;
    });

    await new Promise(r => setTimeout(r, 60));

    expect(page2Result).not.toBeNull();
    expect(page2Result.rows).toHaveLength(1); // Only 1 sample left (index 4)
    expect(page2Result.rows[0].index).toBe(4);
    expect(page2Result.rows[0].recordId).toBe(104);
    expect(page2Result.rows[0].timestampMs).toBe(startTimeMs + 8000);
    expect(page2Result.rows[0].values[0]).toBe(14.0);
    expect(page2Result.rows[0].values[1]).toBe(24.0);
    expect(page2Result.rows[0].values[2]).toBe(34.0);
  });

  it('correctly parses CSV file headers, metadata and data rows', async () => {
    const csvContent = `S332 Raw Data

Start Date Time,14.May 2026 10:14:00
End Date Time,15.May 2026 10:14:00
Sample Rate(sec),10
NO.Of Channels,2

No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point
1,CH1,Sensor 1,mV,0.01,Location 1/MP001
2,CH2,Sensor 2,mV,0.001,Location 2/MP001

No.,Date Time,CH1 - mV,CH2 - mV
1,14-05-2026 10:14:35,13.84,-88.11
2,14-05-2026 10:14:45,-32.92,-17.88
`;

    const mockFile = {
      name: 'test.csv',
      size: csvContent.length,
      slice(start, end) {
        const slicedContent = csvContent.slice(start, end);
        return {
          async text() {
            return slicedContent;
          },
          async arrayBuffer() {
            return new TextEncoder().encode(slicedContent).buffer;
          }
        };
      },
      async text() {
        return csvContent;
      }
    };

    const mockHandle = {
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => mockFile
    };

    // Load via CsdAPI (which delegates to CsvAPI)
    const success = await CsdAPI.loadFileFromHandle(mockHandle);
    expect(success).toBe(true);
    expect(CsdAPI.isFileLoaded()).toBe(true);

    const timeRange = CsdAPI.getFileTimeRange();
    // 14.May 2026 10:14:00 local time
    expect(timeRange.start).toBe(new Date(2026, 4, 14, 10, 14, 0).getTime());

    // Verify Channels
    let channelsResult = null;
    CsdAPI.getChannels(res => {
      channelsResult = res.logging_chs;
    });

    await new Promise(r => setTimeout(r, 60));
    expect(channelsResult).toHaveLength(2);
    expect(channelsResult[0].logic_channel_description).toBe('CH1');
    expect(channelsResult[0].resolution).toBe(2);
    expect(channelsResult[1].resolution).toBe(3);

    // Verify Measurement Data (first channel)
    let dataResult = null;
    const qStart = new Date(2026, 4, 14, 10, 14, 0).getTime() + 3600000 * 8;
    const qStop = new Date(2026, 4, 15, 10, 14, 0).getTime() + 3600000 * 8;

    CsdAPI.getMeasurementData('0', qStart, qStop, 10, 2, res => {
      dataResult = res;
    });

    await new Promise(r => setTimeout(r, 60));
    expect(dataResult).not.toBeNull();
    expect(dataResult[0].measurementData[0]).toHaveLength(2);
    expect(dataResult[0].measurementData[0][0]).toBe(13.84);
    expect(dataResult[0].measurementData[0][1]).toBe(-32.92);
  });

  it('correctly catches invalid CSV file headers during load', async () => {
    const invalidCsvContent = `S332 Raw Data
Start Date Time,14.May 2026 10:14:00
Sample Rate(sec),10
No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point
No.,Date Time,CH1 - mV,CH2 - mV
`;
    const mockFile = {
      name: 'invalid.csv',
      size: invalidCsvContent.length,
      slice(start, end) {
        const slicedContent = invalidCsvContent.slice(start, end);
        return {
          async text() { return slicedContent; },
          async arrayBuffer() { return new TextEncoder().encode(slicedContent).buffer; }
        };
      },
      async text() { return invalidCsvContent; }
    };
    const mockHandle = {
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => mockFile
    };
    const success = await CsdAPI.loadFileFromHandle(mockHandle);
    expect(success).toBe(false);
  });

  it('correctly analyzes gaps and exports to single/split CSD files with correct min/max', async () => {
    const csvContent = `S332 Raw Data

Start Date Time,14.May 2026 10:14:00
End Date Time,14.May 2026 10:15:20
Sample Rate(sec),10
NO.Of Channels,2

No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point
1,CH1,Sensor 1,mV,0.01,Location 1/MP001
2,CH2,Sensor 2,mV,0.001,Location 2/MP001

No.,Date Time,CH1 - mV,CH2 - mV
1,14-05-2026 10:14:00,10.0,20.0
2,14-05-2026 10:14:10,12.0,18.0
3,14-05-2026 10:14:20,13.0,19.0
4,14-05-2026 10:14:30,11.0,21.0
5,14-05-2026 10:15:20,15.0,25.0
`;

    const mockFile = {
      name: 'gap_test.csv',
      size: csvContent.length,
      slice(start, end) {
        const sliced = csvContent.slice(start, end);
        return {
          async text() { return sliced; },
          async arrayBuffer() { return new TextEncoder().encode(sliced).buffer; }
        };
      },
      async text() { return csvContent; }
    };

    const mockHandle = {
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => mockFile
    };

    // Load CSV
    const loadSuccess = await CsdAPI.loadFileFromHandle(mockHandle);
    expect(loadSuccess).toBe(true);

    // Verify Gap Summary
    const summary = CsdAPI.getGapSummary();
    expect(summary.gapCount).toBe(1);
    expect(summary.segments).toHaveLength(2);
    expect(summary.totalRealSamples).toBe(5);
    expect(summary.totalMissingSamples).toBe(4); // 10:14:40, 10:14:50, 10:15:00, 10:15:10
    expect(summary.totalCsdSamples).toBe(9);

    // Setup Blob and download capturing
    const createdBlobs = [];
    const downloadedFiles = [];

    const originalCreateURL = global.URL.createObjectURL;
    const originalRevokeURL = global.URL.revokeObjectURL;
    global.URL.createObjectURL = (blob) => {
      createdBlobs.push(blob);
      return 'mock-url';
    };
    global.URL.revokeObjectURL = () => {};

    const originalAppend = document.body.appendChild;
    const originalRemove = document.body.removeChild;

    document.body.appendChild = (el) => {
      if (el.tagName === 'A') {
        downloadedFiles.push({
          href: el.href,
          download: el.getAttribute('download')
        });
      }
      return originalAppend.call(document.body, el);
    };

    document.body.removeChild = (el) => {
      try { return originalRemove.call(document.body, el); } catch { return el; }
    };

    // 1. Export as Single CSD
    await CsdAPI.exportToCsd();
    expect(createdBlobs).toHaveLength(1);
    expect(downloadedFiles).toHaveLength(1);
    expect(downloadedFiles[0].download).toBe('gap_test.csd');

    // Parse Single CSD Buffer
    const singleBuffer = await createdBlobs[0].arrayBuffer();
    const singleDv = new DataView(singleBuffer);
    
    // Check single CSD sample count (9 samples)
    expect(singleDv.getInt32(34 + 3020, false)).toBe(9);
    // Check channel min/max (global min/max: CH1 has min 10 max 15, CH2 has min 18 max 25)
    // First channel min/max at 34 + 3552 + 848 + 4 / 12
    expect(singleDv.getFloat64(34 + 3552 + 848 + 4, false)).toBe(10.0);
    expect(singleDv.getFloat64(34 + 3552 + 848 + 12, false)).toBe(15.0);
    // Second channel min/max
    expect(singleDv.getFloat64(34 + 3552 + 918 + 848 + 4, false)).toBe(18.0);
    expect(singleDv.getFloat64(34 + 3552 + 918 + 848 + 12, false)).toBe(25.0);

    // 2. Export as Split CSD
    await CsdAPI.exportToCsdSplit();
    expect(createdBlobs).toHaveLength(3); // 1 single + 2 split
    expect(downloadedFiles).toHaveLength(3);
    expect(downloadedFiles[1].download).toBe('gap_test_part1.csd');
    expect(downloadedFiles[2].download).toBe('gap_test_part2.csd');

    // Parse Part 1 Buffer (should contain samples 10:14:00, 10:14:10, 10:14:20, 10:14:30)
    // CH1 has values: 10.0, 12.0, 13.0, 11.0 (min=10.0, max=13.0)
    // CH2 has values: 20.0, 18.0, 19.0, 21.0 (min=18.0, max=21.0)
    const part1Buffer = await createdBlobs[1].arrayBuffer();
    const part1Dv = new DataView(part1Buffer);
    expect(part1Dv.getInt32(34 + 3020, false)).toBe(4); // 4 samples
    // CH1 min/max in Part 1
    expect(part1Dv.getFloat64(34 + 3552 + 848 + 4, false)).toBe(10.0);
    expect(part1Dv.getFloat64(34 + 3552 + 848 + 12, false)).toBe(13.0);
    // CH2 min/max in Part 1
    expect(part1Dv.getFloat64(34 + 3552 + 918 + 848 + 4, false)).toBe(18.0);
    expect(part1Dv.getFloat64(34 + 3552 + 918 + 848 + 12, false)).toBe(21.0);

    // Parse Part 2 Buffer (should contain sample 10:15:20)
    // CH1 has value: 15.0 (min=15.0, max=15.0)
    // CH2 has value: 25.0 (min=25.0, max=25.0)
    const part2Buffer = await createdBlobs[2].arrayBuffer();
    const part2Dv = new DataView(part2Buffer);
    expect(part2Dv.getInt32(34 + 3020, false)).toBe(1); // 1 sample
    // CH1 min/max in Part 2
    expect(part2Dv.getFloat64(34 + 3552 + 848 + 4, false)).toBe(15.0);
    expect(part2Dv.getFloat64(34 + 3552 + 848 + 12, false)).toBe(15.0);
    // CH2 min/max in Part 2
    expect(part2Dv.getFloat64(34 + 3552 + 918 + 848 + 4, false)).toBe(25.0);
    expect(part2Dv.getFloat64(34 + 3552 + 918 + 848 + 12, false)).toBe(25.0);

    // Cleanup mocks
    global.URL.createObjectURL = originalCreateURL;
    global.URL.revokeObjectURL = originalRevokeURL;
    document.body.appendChild = originalAppend;
    document.body.removeChild = originalRemove;
  });

  it('repairs a bad header sample count and stop time from the file size', async () => {
    const FILE_HEADER_LEN     = 34;
    const PROTOCOL_HEADER_LEN = 3552;
    const CHANNEL_HEADER_LEN  = 918;
    const RECORD_ID_LEN       = 4;
    const CHANNEL_VALUE_LEN   = 8;

    const numChannels = 2;
    const numSamples = 5;

    const protocolHeaderStart = FILE_HEADER_LEN;
    const channelHeadersStart = protocolHeaderStart + PROTOCOL_HEADER_LEN;
    const dataStart = channelHeadersStart + numChannels * CHANNEL_HEADER_LEN;
    const recordLen = RECORD_ID_LEN + numChannels * CHANNEL_VALUE_LEN;
    const totalSize = dataStart + numSamples * recordLen;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const encoder = new TextEncoder();

    view.setInt32(0, 5, false);
    const idBytes = encoder.encode('SUTO CSD');
    for (let i = 0; i < idBytes.length; i++) view.setUint8(4 + i, idBytes[i]);

    const startTimeMs = 1716380000000;
    view.setInt32(protocolHeaderStart + 3016, numChannels, false);
    view.setInt32(protocolHeaderStart + 3020, 0, false);            // BAD: header says 0 samples
    view.setInt32(protocolHeaderStart + 3024, 1, false);
    view.setBigInt64(protocolHeaderStart + 3032, BigInt(startTimeMs), false);
    view.setBigInt64(protocolHeaderStart + 3040, BigInt(0), false);  // BAD: header stop time = 0

    for (let c = 0; c < numChannels; c++) {
      const chStart = channelHeadersStart + c * CHANNEL_HEADER_LEN;
      view.setBigInt64(chStart + 0, BigInt(100 + c), false);
      const descName = `Ch_${c}`;
      view.setInt16(chStart + 8, descName.length, false);
      const descBytes = encoder.encode(descName);
      for (let i = 0; i < descBytes.length; i++) view.setUint8(chStart + 10 + i, descBytes[i]);
      const statsBase = 848;
      view.setInt32(chStart + statsBase, 2, false);
      view.setFloat64(chStart + statsBase + 4, 1.5 * c, false);
      view.setFloat64(chStart + statsBase + 12, 100.0 * (c + 1), false);
      view.setInt32(chStart + statsBase + 28, 5000 + c, false);
    }

    for (let s = 0; s < numSamples; s++) {
      const recStart = dataStart + s * recordLen;
      view.setInt32(recStart, s, false);
      view.setFloat64(recStart + 4, 10.0 + s, false);
      view.setFloat64(recStart + 12, 20.0 + s, false);
    }

    const mockFile = {
      name: 'bad.csd',
      size: totalSize,
      slice(start, end) {
        return { arrayBuffer: async () => buffer.slice(start, end) };
      }
    };
    const mockHandle = {
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => mockFile
    };

    const success = await CsdAPI.loadFileFromHandle(mockHandle);
    expect(success).toBe(true);

    expect(CsdAPI.getNumOfSamples()).toBe(numSamples); // repaired from file size
    const range = CsdAPI.getFileTimeRange();
    expect(range.start).toBe(startTimeMs);
    expect(range.stop).toBe(startTimeMs + numSamples * 1000); // stop derived from repaired samples
  });

  it('clamps an overstated header sample count and garbage stop time', async () => {
    const numChannels = 2;
    const numSamples = 5;
    const protocolHeaderStart = 34;
    const channelHeadersStart = 3586;
    const recordLen = 4 + numChannels * 8;
    const dataStart = channelHeadersStart + numChannels * 918;
    const totalSize = dataStart + numSamples * recordLen;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const encoder = new TextEncoder();

    view.setInt32(0, 5, false);
    const idBytes = encoder.encode('SUTO CSD');
    for (let i = 0; i < idBytes.length; i++) view.setUint8(4 + i, idBytes[i]);

    const startTimeMs = 1716380000000;
    view.setInt32(protocolHeaderStart + 3016, numChannels, false);
    view.setInt32(protocolHeaderStart + 3020, 999999, false);          // BAD: far more than the file holds
    view.setInt32(protocolHeaderStart + 3024, 1, false);
    view.setBigInt64(protocolHeaderStart + 3032, BigInt(startTimeMs), false);
    view.setBigInt64(protocolHeaderStart + 3040, BigInt(8640000000000001), false); // BAD: out of range

    for (let c = 0; c < numChannels; c++) {
      const chStart = channelHeadersStart + c * 918;
      view.setBigInt64(chStart + 0, BigInt(100 + c), false);
      const descName = `Ch_${c}`;
      view.setInt16(chStart + 8, descName.length, false);
      const descBytes = encoder.encode(descName);
      for (let i = 0; i < descBytes.length; i++) view.setUint8(chStart + 10 + i, descBytes[i]);
      view.setInt32(chStart + 848, 2, false);
      view.setFloat64(chStart + 852, 1.5 * c, false);
      view.setFloat64(chStart + 860, 100.0 * (c + 1), false);
      view.setInt32(chStart + 876, 5000 + c, false);
    }

    for (let s = 0; s < numSamples; s++) {
      const recStart = dataStart + s * recordLen;
      view.setInt32(recStart, s, false);
      view.setFloat64(recStart + 4, 10.0 + s, false);
      view.setFloat64(recStart + 12, 20.0 + s, false);
    }

    const mockFile = {
      name: 'overstated.csd',
      size: totalSize,
      slice(start, end) { return { arrayBuffer: async () => buffer.slice(start, end) }; }
    };
    const mockHandle = {
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => mockFile
    };

    await CsdAPI.loadFileFromHandle(mockHandle);

    expect(CsdAPI.getNumOfSamples()).toBe(numSamples); // clamped to what the file actually holds
    const range = CsdAPI.getFileTimeRange();
    expect(range.stop).toBe(startTimeMs + numSamples * 1000); // garbage stop → derived from samples
  });

  it('appends a second CSD file into a merged multi-file session', async () => {
    const encoder = new TextEncoder();
    const startTimeMs = 1716380000000;
    const numSamples = 5;

    // Build a CSD buffer with `numChannels` channels whose channel c holds value base + i*100 + c
    function buildFile(name, numChannels, base, intervalSec = 1, thisStart = startTimeMs) {
      const protocolHeaderStart = 34;
      const channelHeadersStart = 3586;
      const recordLen = 4 + numChannels * 8;
      const dataStart = channelHeadersStart + numChannels * 918;
      const totalSize = dataStart + numSamples * recordLen;
      const buffer = new ArrayBuffer(totalSize);
      const view = new DataView(buffer);

      view.setInt32(0, 5, false);
      const idBytes = encoder.encode('SUTO CSD');
      for (let i = 0; i < idBytes.length; i++) view.setUint8(4 + i, idBytes[i]);

      view.setInt32(protocolHeaderStart + 3016, numChannels, false);
      view.setInt32(protocolHeaderStart + 3020, numSamples, false);
      view.setInt32(protocolHeaderStart + 3024, intervalSec, false);
      view.setBigInt64(protocolHeaderStart + 3032, BigInt(thisStart), false);
      view.setBigInt64(protocolHeaderStart + 3040, BigInt(thisStart + numSamples * intervalSec * 1000), false);

      for (let c = 0; c < numChannels; c++) {
        const chStart = channelHeadersStart + c * 918;
        view.setBigInt64(chStart + 0, BigInt(100 + c), false);
        const descName = `Ch_${c}`;
        view.setInt16(chStart + 8, descName.length, false);
        const descBytes = encoder.encode(descName);
        for (let i = 0; i < descBytes.length; i++) view.setUint8(chStart + 10 + i, descBytes[i]);
        view.setInt32(chStart + 848, 2, false);
        view.setFloat64(chStart + 852, 0, false);
        view.setFloat64(chStart + 860, 1000, false);
        view.setInt32(chStart + 876, 5000 + c, false);
      }

      for (let s = 0; s < numSamples; s++) {
        const recStart = dataStart + s * recordLen;
        view.setInt32(recStart, s, false);
        for (let c = 0; c < numChannels; c++) {
          view.setFloat64(recStart + 4 + c * 8, base + s * 100 + c, false);
        }
      }

      return {
        name,
        size: totalSize,
        slice(start, end) { return { arrayBuffer: async () => buffer.slice(start, end) }; }
      };
    }

    // File A: 2 channels, base 10 (10,20 / 110,120 / ...)
    const fileA = buildFile('A.csd', 2, 10);
    const handleA = { queryPermission: async () => 'granted', requestPermission: async () => 'granted', getFile: async () => fileA };
    await CsdAPI.loadFileFromHandle(handleA);

    expect(CsdAPI.getNumLoadedFiles()).toBe(1);
    expect(CsdAPI.getNumOfSamples()).toBe(numSamples);

    // Append file B: 2 channels, overlapping window, base 1000
    const fileB = buildFile('B.csd', 2, 1000);
    const resB = await CsdAPI.appendFile(fileB);
    expect(resB.ok).toBe(true);
    expect(resB.numFiles).toBe(2);
    expect(CsdAPI.getNumLoadedFiles()).toBe(2);
    expect(CsdAPI.getNumOfSamples()).toBe(numSamples); // same grid → same sample count

    let channels = null;
    CsdAPI.getChannels(res => { channels = res.logging_chs; });
    await new Promise(r => setTimeout(r, 60));
    expect(channels).toHaveLength(4);
    expect(channels[0].channel_id).toBe('0:0');
    expect(channels[2].channel_id).toBe('1:0');

    // getTablePage returns merged rows with values from both files
    let page = null;
    CsdAPI.getTablePage(0, 10, channels.map(c => c.channel_id), res => { page = res; });
    await new Promise(r => setTimeout(r, 60));
    expect(page.total).toBe(numSamples);
    expect(page.rows).toHaveLength(numSamples);
    expect(page.rows[0].values['0:0']).toBe(10);
    expect(page.rows[0].values['0:1']).toBe(11);
    expect(page.rows[0].values['1:0']).toBe(1000);
    expect(page.rows[1].values['0:0']).toBe(110);
    expect(page.rows[1].values['1:0']).toBe(1100);

    // Option B: Append a non-overlapping file (e.g. 24h later across data loss / gap) → accepted
    const fileC = buildFile('C.csd', 2, 5000, 1, startTimeMs + 86400000);
    const resC = await CsdAPI.appendFile(fileC);
    expect(resC.ok).toBe(true);
    expect(CsdAPI.getNumLoadedFiles()).toBe(3);
  });

  it('exports merged multi-file data to CSV', async () => {
    const encoder = new TextEncoder();
    const startTimeMs = 1716380000000;
    const numSamples = 5;

    function buildFile(name, numChannels, base, intervalSec = 1, thisStart = startTimeMs) {
      const protocolHeaderStart = 34;
      const channelHeadersStart = 3586;
      const recordLen = 4 + numChannels * 8;
      const dataStart = channelHeadersStart + numChannels * 918;
      const totalSize = dataStart + numSamples * recordLen;
      const buffer = new ArrayBuffer(totalSize);
      const view = new DataView(buffer);

      view.setInt32(0, 5, false);
      const idBytes = encoder.encode('SUTO CSD');
      for (let i = 0; i < idBytes.length; i++) view.setUint8(4 + i, idBytes[i]);

      view.setInt32(protocolHeaderStart + 3016, numChannels, false);
      view.setInt32(protocolHeaderStart + 3020, numSamples, false);
      view.setInt32(protocolHeaderStart + 3024, intervalSec, false);
      view.setBigInt64(protocolHeaderStart + 3032, BigInt(thisStart), false);
      view.setBigInt64(protocolHeaderStart + 3040, BigInt(thisStart + numSamples * intervalSec * 1000), false);

      for (let c = 0; c < numChannels; c++) {
        const chStart = channelHeadersStart + c * 918;
        view.setBigInt64(chStart + 0, BigInt(100 + c), false);
        const descName = `Ch_${c}`;
        view.setInt16(chStart + 8, descName.length, false);
        const descBytes = encoder.encode(descName);
        for (let i = 0; i < descBytes.length; i++) view.setUint8(chStart + 10 + i, descBytes[i]);
        view.setInt32(chStart + 848, 2, false);
        view.setFloat64(chStart + 852, 0, false);
        view.setFloat64(chStart + 860, 1000, false);
        view.setInt32(chStart + 876, 5000 + c, false);
      }

      for (let s = 0; s < numSamples; s++) {
        const recStart = dataStart + s * recordLen;
        view.setInt32(recStart, s, false);
        for (let c = 0; c < numChannels; c++) {
          view.setFloat64(recStart + 4 + c * 8, base + s * 100 + c, false);
        }
      }

      return {
        name,
        size: totalSize,
        slice(start, end) { return { arrayBuffer: async () => buffer.slice(start, end) }; }
      };
    }

    const fileA = buildFile('A.csd', 2, 10);
    const handleA = { queryPermission: async () => 'granted', requestPermission: async () => 'granted', getFile: async () => fileA };
    await CsdAPI.loadFileFromHandle(handleA);
    const resB = await CsdAPI.appendFile(buildFile('B.csd', 2, 1000));
    expect(resB.ok).toBe(true);

    const createdBlobs = [];
    const downloadedFiles = [];
    global.URL.createObjectURL = (blob) => { createdBlobs.push(blob); return 'mock-url'; };
    global.URL.revokeObjectURL = () => {};
    const origAppend = document.body.appendChild;
    const origRemove = document.body.removeChild;
    document.body.appendChild = (el) => {
      if (el.tagName === 'A') downloadedFiles.push({ download: el.getAttribute('download') });
      return origAppend.call(document.body, el);
    };
    document.body.removeChild = origRemove;

    await CsdAPI.exportAllChannelsToCsv(() => {});

    const csv = await createdBlobs[0].text();
    const lines = csv.split('\n');
    expect(lines[0]).toBe('CSD Device Raw Data');
    expect(lines[4]).toBe('Sample Rate(sec),1');
    expect(lines[5]).toBe('NO.Of Channels,4');
    expect(lines[14]).toBe('Date Time,Ch_0,Ch_1,Ch_0,Ch_1');
    expect(lines[15]).toContain(',10,11,1000,1001');
    expect(downloadedFiles[0].download).toContain('_combined');

    document.body.appendChild = origAppend;
    document.body.removeChild = origRemove;
  });

  it('does not read past a buffered file boundary when exporting a merged session', async () => {
    const encoder = new TextEncoder();
    const startTimeMs = 1716380000000;

    function buildFile(name, numChannels, numSamples, base) {
      const protocolHeaderStart = 34;
      const channelHeadersStart = 3586;
      const recordLen = 4 + numChannels * 8;
      const dataStart = channelHeadersStart + numChannels * 918;
      const totalSize = dataStart + numSamples * recordLen;
      const buffer = new ArrayBuffer(totalSize);
      const view = new DataView(buffer);

      view.setInt32(0, 5, false);
      const idBytes = encoder.encode('SUTO CSD');
      for (let i = 0; i < idBytes.length; i++) view.setUint8(4 + i, idBytes[i]);

      view.setInt32(protocolHeaderStart + 3016, numChannels, false);
      view.setInt32(protocolHeaderStart + 3020, numSamples, false);
      view.setInt32(protocolHeaderStart + 3024, 1, false);
      view.setBigInt64(protocolHeaderStart + 3032, BigInt(startTimeMs), false);
      view.setBigInt64(protocolHeaderStart + 3040, BigInt(startTimeMs + numSamples * 1000), false);

      for (let c = 0; c < numChannels; c++) {
        const chStart = channelHeadersStart + c * 918;
        view.setBigInt64(chStart + 0, BigInt(100 + c), false);
        const descName = `Ch_${c}`;
        view.setInt16(chStart + 8, descName.length, false);
        const descBytes = encoder.encode(descName);
        for (let i = 0; i < descBytes.length; i++) view.setUint8(chStart + 10 + i, descBytes[i]);
        view.setInt32(chStart + 848, 2, false);
        view.setFloat64(chStart + 852, 0, false);
        view.setFloat64(chStart + 860, 1000, false);
        view.setInt32(chStart + 876, 5000 + c, false);
      }

      for (let s = 0; s < numSamples; s++) {
        const recStart = dataStart + s * recordLen;
        view.setInt32(recStart, s, false);
        for (let c = 0; c < numChannels; c++) {
          view.setFloat64(recStart + 4 + c * 8, base + s * 100 + c, false);
        }
      }

      return {
        name,
        size: totalSize,
        async arrayBuffer() { return buffer; },
        slice(start, end) { return { arrayBuffer: async () => buffer.slice(start, end) }; }
      };
    }

    // File A is long (12k samples); file B overlaps only the first 10 samples.
    const fileA = buildFile('A.csd', 2, 12000, 10);
    const handleA = { queryPermission: async () => 'granted', requestPermission: async () => 'granted', getFile: async () => fileA };
    await CsdAPI.loadFileFromHandle(handleA);

    const fileB = buildFile('B.csd', 2, 10, 1000);
    const resB = await CsdAPI.appendFile(fileB);
    expect(resB.ok).toBe(true);

    // Page that starts far beyond B's data — must not read past B's buffer.
    const rows = await CsdAPI._readExportPage(5000, 5000);
    expect(rows).toHaveLength(5000);
    expect(rows[0].values['1:0']).toBe(null); // B has no data at that time
    expect(rows[0].values['0:0']).toBe(500010); // A continues normally
  });

  it('recognizes the flow channel unit (m³/min) in the real Demo file', async () => {
    const demoPath = path.join(process.cwd(), 'reference/Demo file.csd');
    if (!fs.existsSync(demoPath)) return; // skip when the file is not present

    const buffer = fs.readFileSync(demoPath);
    const mockFile = {
      name: 'Demo file.csd',
      size: buffer.length,
      async arrayBuffer() {
        const b = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        return b;
      },
      slice(start, end) {
        const b = buffer.subarray(start, end);
        return { arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
      }
    };
    const mockHandle = {
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => mockFile
    };

    const success = await CsdAPI.loadFileFromHandle(mockHandle);
    expect(success).toBe(true);

    let channels = null;
    CsdAPI.getChannels(res => { channels = res.logging_chs; });
    await new Promise(r => setTimeout(r, 60));

    expect(channels.length).toBe(12);
    const flowCh = channels.find(ch => ch.unit_in_ascii === 'm\u00B3/min');
    expect(flowCh).toBeTruthy();
    expect(flowCh.logic_channel_description).toBe('Flow');
    expect(classifyChannel(flowCh.unit_in_ascii)).toBe('flow');
    const flows = channels.filter(ch => classifyChannel(ch.unit_in_ascii) === 'flow');
    expect(flows.length).toBeGreaterThan(0);
  });

  it('appends a second CSV file into a merged session and isolates single-file open', async () => {
    const csvContent1 = `CSV Device

Description,Record File
Start Date Time,20-05-2024 10:00:00
End Date Time,20-05-2024 10:00:04
Sample Rate(sec),1

No.,Channel,Sensor,Unit,Resolution
1,Flow,SensorA,m3/h,2,0,100
2,Pressure,SensorB,bar,2,0,16

Date Time,Flow,Pressure
20-05-2024 10:00:00,10.5,6.0
20-05-2024 10:00:01,11.0,6.1
20-05-2024 10:00:02,11.5,6.2
20-05-2024 10:00:03,12.0,6.3
20-05-2024 10:00:04,12.5,6.4
`;

    const csvContent2 = `CSV Device

Description,Record File
Start Date Time,20-05-2024 12:00:00
End Date Time,20-05-2024 12:00:04
Sample Rate(sec),1

No.,Channel,Sensor,Unit,Resolution
1,Flow,SensorA,m3/h,2,0,100
2,Pressure,SensorB,bar,2,0,16

Date Time,Flow,Pressure
20-05-2024 12:00:00,20.0,7.0
20-05-2024 12:00:01,21.0,7.1
20-05-2024 12:00:02,22.0,7.2
20-05-2024 12:00:03,23.0,7.3
20-05-2024 12:00:04,24.0,7.4
`;

    const encoder = new TextEncoder();
    const buf1 = encoder.encode(csvContent1).buffer;
    const buf2 = encoder.encode(csvContent2).buffer;

    const mockCsv1 = {
      name: 'file1.csv',
      size: buf1.byteLength,
      slice(start, end) {
        const sliced = buf1.slice(start, end);
        return {
          arrayBuffer: async () => sliced,
          text: async () => new TextDecoder().decode(sliced)
        };
      }
    };

    const mockCsv2 = {
      name: 'file2.csv',
      size: buf2.byteLength,
      slice(start, end) {
        const sliced = buf2.slice(start, end);
        return {
          arrayBuffer: async () => sliced,
          text: async () => new TextDecoder().decode(sliced)
        };
      }
    };

    const handle1 = {
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => mockCsv1
    };

    // 1. Initial single-file load
    const loaded1 = await CsdAPI.loadFileFromHandle(handle1);
    expect(loaded1).toBe(true);
    expect(CsdAPI.isCsvMode()).toBe(true);
    expect(CsdAPI.getNumLoadedFiles()).toBe(1);
    expect(CsdAPI.getLoadedFileName()).toBe('file1.csv');
    expect(CsdAPI.getNumOfSamples()).toBe(5);

    // Single-file table query
    let page1 = null;
    CsdAPI.getTablePage(0, 10, [0, 1], res => { page1 = res; });
    await new Promise(r => setTimeout(r, 60));
    expect(page1.rows).toHaveLength(5);
    expect(page1.rows[0].values[0]).toBe(10.5);
    expect(page1.rows[4].values[0]).toBe(12.5);

    // 2. Append second CSV file (2 hours later gap)
    const appendRes = await CsdAPI.appendFile(mockCsv2);
    expect(appendRes.ok).toBe(true);
    expect(appendRes.numFiles).toBe(2);
    expect(CsdAPI.getNumLoadedFiles()).toBe(2);
    expect(CsdAPI.getLoadedFileName()).toBe('2 files');
    expect(CsdAPI.getNumOfSamples()).toBe(10);

    // Verify merged table page across both files
    let mergedPage = null;
    CsdAPI.getTablePage(0, 10, [0, 1], res => { mergedPage = res; });
    await new Promise(r => setTimeout(r, 60));
    expect(mergedPage.rows).toHaveLength(10);
    expect(mergedPage.rows[0].values[0]).toBe(10.5);
    expect(mergedPage.rows[4].values[0]).toBe(12.5);
    expect(mergedPage.rows[5].values[0]).toBe(20.0);
    expect(mergedPage.rows[9].values[0]).toBe(24.0);

    // Verify measurement data returns 2 segments for the 2 separated time blocks
    let measData = null;
    const tRange = CsdAPI.getFileTimeRange();
    CsdAPI.getMeasurementData('0', tRange.start + 3600000 * 8, tRange.stop + 3600000 * 8, 1, 2, res => { measData = res; });
    await new Promise(r => setTimeout(r, 80));
    expect(measData).not.toBeNull();
    expect(measData[0].measurementData.length).toBe(2);
    expect(measData[0].measurementData[0]).toEqual([10.5, 11.0, 11.5, 12.0, 12.5]);
    expect(measData[0].measurementData[1]).toEqual([20.0, 21.0, 22.0, 23.0, 24.0]);

    // 3. User opens a single file again: MUST reset to single-file mode with zero multi-file effect
    const reloaded = await CsdAPI.loadFileFromHandle(handle1);
    expect(reloaded).toBe(true);
    expect(CsdAPI.getNumLoadedFiles()).toBe(1);
    expect(CsdAPI.getLoadedFileName()).toBe('file1.csv');
    expect(CsdAPI.getNumOfSamples()).toBe(5);

    let singlePageAgain = null;
    CsdAPI.getTablePage(0, 10, [0, 1], res => { singlePageAgain = res; });
    await new Promise(r => setTimeout(r, 60));
    expect(singlePageAgain.rows).toHaveLength(5);
  });

  it('appends CSV files with different channel counts (e.g. 3 channels + 7 channels) into a merged multi-channel session', async () => {
    function buildMockCsv(name, numChannels, startHour, numRows) {
      let content = `Test Device\n\n`;
      content += `Description,Record File\n`;
      content += `Start Date Time,20-05-2024 ${String(startHour).padStart(2, '0')}:00:00\n`;
      content += `End Date Time,20-05-2024 ${String(startHour).padStart(2, '0')}:00:${String(numRows - 1).padStart(2, '0')}\n`;
      content += `Sample Rate(sec),1\n\n`;
      content += `No.,Channel,Sensor,Unit,Resolution\n`;
      for (let c = 0; c < numChannels; c++) {
        content += `${c + 1},Sensor_${c + 1},SensorType,Unit_${c + 1},2,0,100\n`;
      }
      content += `\nDate Time`;
      for (let c = 0; c < numChannels; c++) {
        content += `,Sensor_${c + 1}`;
      }
      content += `\n`;
      for (let r = 0; r < numRows; r++) {
        content += `20-05-2024 ${String(startHour).padStart(2, '0')}:00:${String(r).padStart(2, '0')}`;
        for (let c = 0; c < numChannels; c++) {
          content += `,${(startHour * 100) + (r * 10) + c}`;
        }
        content += `\n`;
      }
      return {
        name,
        size: content.length,
        slice(start, end) {
          const s = content.slice(start, end);
          return {
            arrayBuffer: async () => new TextEncoder().encode(s).buffer,
            text: async () => s
          };
        }
      };
    }

    const csv3Ch = buildMockCsv('base_3ch.csv', 3, 2, 4);
    const csv7Ch = buildMockCsv('appended_7ch.csv', 7, 3, 4);

    const handle = {
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => csv3Ch
    };

    // 1. Load base CSV with 3 channels
    const loaded = await CsdAPI.loadFileFromHandle(handle);
    expect(loaded).toBe(true);
    expect(CsdAPI.getNumLoadedFiles()).toBe(1);

    // 2. Append second CSV with 7 channels
    const appendRes = await CsdAPI.appendFile(csv7Ch);
    expect(appendRes.ok).toBe(true);
    expect(appendRes.numFiles).toBe(2);
    expect(CsdAPI.getNumLoadedFiles()).toBe(2);

    // 3. Verify smart channel unification:
    // Sensor_1, Sensor_2, Sensor_3 are unified across both files.
    // Sensor_4..Sensor_7 are added as new channels 3..6. Total channels = 7.
    let channels = null;
    CsdAPI.getChannels(res => { channels = res.logging_chs; });
    await new Promise(r => setTimeout(r, 60));
    expect(channels).toHaveLength(7);
    expect(channels[0].logic_channel_description).toBe('Sensor_1');
    expect(channels[2].logic_channel_description).toBe('Sensor_3');
    expect(channels[3].logic_channel_description).toBe('Sensor_4');
    expect(channels[6].logic_channel_description).toBe('Sensor_7');

    // 4. Verify table page contains values for both files:
    // Channel 0 ('Sensor_1') has values in BOTH File 0 and File 1.
    // Channel 3 ('Sensor_4') has null in File 0, and value 303 in File 1.
    let tablePage = null;
    CsdAPI.getTablePage(0, 10, [0, 3], res => { tablePage = res; });
    await new Promise(r => setTimeout(r, 60));
    expect(tablePage.total).toBe(8); // 4 rows + 4 rows
    expect(tablePage.rows[0].values[0]).toBe(200); // File 0, row 0, ch 0
    expect(tablePage.rows[0].values[3]).toBeNull(); // File 0 does not have Sensor_4
    expect(tablePage.rows[4].values[0]).toBe(300); // File 1, row 0, ch 0 (continued!)
    expect(tablePage.rows[4].values[3]).toBe(303); // File 1, row 0, ch 3 (Sensor_4)

    // 5. Verify getMeasurementData:
    // Query unified Channel 0: returns data for BOTH file segments!
    let measData0 = null;
    const tRange = CsdAPI.getFileTimeRange();
    CsdAPI.getMeasurementData('0', tRange.start + 3600000 * 8, tRange.stop + 3600000 * 8, 1, 2, res => { measData0 = res; });
    await new Promise(r => setTimeout(r, 80));
    expect(measData0).not.toBeNull();
    expect(measData0[0].measurementData.length).toBe(2); // 2 segments (File 0 + File 1)
    expect(measData0[0].measurementData[0]).toEqual([200, 210, 220, 230]);
    expect(measData0[0].measurementData[1]).toEqual([300, 310, 320, 330]);

    // Query newly added Channel 3 (Sensor_4): returns data only for File 1 segment!
    let measData3 = null;
    CsdAPI.getMeasurementData('3', tRange.start + 3600000 * 8, tRange.stop + 3600000 * 8, 1, 2, res => { measData3 = res; });
    await new Promise(r => setTimeout(r, 80));
    expect(measData3).not.toBeNull();
    expect(measData3[0].measurementData.length).toBe(1); // 1 segment (only File 1)
    expect(measData3[0].measurementData[0]).toEqual([303, 313, 323, 333]);
  });

  it('appends sequential CSD files with different channel counts into a unified session', async () => {
    const encoder = new TextEncoder();
    const startTimeMs = 1716380000000;
    const numSamples = 5;

    function buildCsd(name, numChannels, base, intervalSec = 1, thisStart = startTimeMs) {
      const protocolHeaderStart = 34;
      const channelHeadersStart = 3586;
      const recordLen = 4 + numChannels * 8;
      const dataStart = channelHeadersStart + numChannels * 918;
      const totalSize = dataStart + numSamples * recordLen;
      const buffer = new ArrayBuffer(totalSize);
      const view = new DataView(buffer);

      view.setInt32(0, 5, false);
      const idBytes = encoder.encode('SUTO CSD');
      for (let i = 0; i < idBytes.length; i++) view.setUint8(4 + i, idBytes[i]);

      view.setInt32(protocolHeaderStart + 3016, numChannels, false);
      view.setInt32(protocolHeaderStart + 3020, numSamples, false);
      view.setInt32(protocolHeaderStart + 3024, intervalSec, false);
      view.setBigInt64(protocolHeaderStart + 3032, BigInt(thisStart), false);
      view.setBigInt64(protocolHeaderStart + 3040, BigInt(thisStart + numSamples * intervalSec * 1000), false);

      for (let c = 0; c < numChannels; c++) {
        const chStart = channelHeadersStart + c * 918;
        view.setBigInt64(chStart + 0, BigInt(100 + c), false);
        const descName = `Ch_${c}`;
        view.setInt16(chStart + 8, descName.length, false);
        const descBytes = encoder.encode(descName);
        for (let i = 0; i < descBytes.length; i++) view.setUint8(chStart + 10 + i, descBytes[i]);
        view.setInt32(chStart + 848, 2, false);
        view.setFloat64(chStart + 852, 0, false);
        view.setFloat64(chStart + 860, 1000, false);
        view.setInt32(chStart + 876, 5000 + c, false);
      }

      for (let s = 0; s < numSamples; s++) {
        const recStart = dataStart + s * recordLen;
        view.setInt32(recStart, s, false);
        for (let c = 0; c < numChannels; c++) {
          view.setFloat64(recStart + 4 + c * 8, base + s * 10 + c, false);
        }
      }

      return {
        name,
        size: totalSize,
        slice(start, end) { return { arrayBuffer: async () => buffer.slice(start, end) }; }
      };
    }

    // File 1: 3 channels (Ch_0, Ch_1, Ch_2), base 100
    const file1 = buildCsd('file1.csd', 3, 100, 1, startTimeMs);
    const handle1 = { queryPermission: async () => 'granted', requestPermission: async () => 'granted', getFile: async () => file1 };
    await CsdAPI.loadFileFromHandle(handle1);

    let initialChs = null;
    CsdAPI.getChannels(res => { initialChs = res.logging_chs; });
    await new Promise(r => setTimeout(r, 60));
    expect(initialChs).toHaveLength(3);

    // File 2: 4 channels (Ch_0, Ch_1, Ch_2, Ch_3), base 500, recorded 1 hour later (non-overlapping)
    const file2 = buildCsd('file2.csd', 4, 500, 1, startTimeMs + 3600000);
    const resAppend = await CsdAPI.appendFile(file2);
    expect(resAppend.ok).toBe(true);

    // Verify smart channel unification:
    // 3 shared channels (Ch_0, Ch_1, Ch_2) unified + 1 newly added channel (Ch_3) => 4 total channels!
    let channels = null;
    CsdAPI.getChannels(res => { channels = res.logging_chs; });
    await new Promise(r => setTimeout(r, 60));
    expect(channels).toHaveLength(4);
    expect(channels.map(c => c.logic_channel_description)).toEqual(['Ch_0', 'Ch_1', 'Ch_2', 'Ch_3']);

    // Check bindings:
    expect(channels[0].bindings.length).toBe(2);
    expect(channels[1].bindings.length).toBe(2);
    expect(channels[2].bindings.length).toBe(2);
    expect(channels[3].bindings.length).toBe(1);

    // Verify getMeasurementData for unified channel (Ch_0):
    let meas0 = null;
    const tRange = CsdAPI.getFileTimeRange();
    CsdAPI.getMeasurementData('0', tRange.start + 3600000 * 8, tRange.stop + 3600000 * 8, 1, 2, res => { meas0 = res; });
    await new Promise(r => setTimeout(r, 80));
    expect(meas0).not.toBeNull();
    expect(meas0[0].measurementData.length).toBe(2); // 2 segments (File 1 and File 2)
    expect(meas0[0].measurementData[0]).toEqual([100, 110, 120, 130, 140]);
    expect(meas0[0].measurementData[1]).toEqual([500, 510, 520, 530, 540]);

    // Verify getMeasurementData for newly added channel (Ch_3):
    let meas3 = null;
    CsdAPI.getMeasurementData('3', tRange.start + 3600000 * 8, tRange.stop + 3600000 * 8, 1, 2, res => { meas3 = res; });
    await new Promise(r => setTimeout(r, 80));
    expect(meas3).not.toBeNull();
    expect(meas3[0].measurementData.length).toBe(1); // 1 segment (File 2 only)
    expect(meas3[0].measurementData[0]).toEqual([503, 513, 523, 533, 543]);
  });

});
