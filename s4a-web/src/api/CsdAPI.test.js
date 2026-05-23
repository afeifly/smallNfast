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
    // rawSampleRate at offset 3024 of protocol header
    view.setInt32(protocolHeaderStart + 3024, 10, false);
    // startTime at 3032 (epoch timestamp)
    const startTimeMs = 1716380000000; // May 2024
    view.setBigInt64(protocolHeaderStart + 3032, BigInt(startTimeMs), false);
    // stopTime at 3040
    const stopTimeMs = startTimeMs + (numSamples / 10) * 1000;
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
});
