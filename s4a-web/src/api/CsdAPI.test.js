import { describe, it, expect } from 'vitest';
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
    expect(excelText).toContain('<Cell><Data ss:Type="String">Timestamp</Data></Cell>');
    expect(excelText).toContain('<Cell><Data ss:Type="Number">10</Data></Cell>');

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
});
