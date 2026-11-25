import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import initSqlJs from 'sql.js';
import StdbAPI from './StdbAPI';
import CsvAPI from './CsvAPI';
import { exportHeader, exportRows } from './stdb/Export.js';

vi.mock('./stdb/WorkerClient.js', async () => {
  const { default: factory } = await import('wa-sqlite/dist/wa-sqlite-async.mjs');
  const { default: StdbDatabase } = await import('./stdb/Database.js');
  const { exportHeader, exportRows, exportFooter } = await import('./stdb/Export.js');
  return {
    default: class {
      constructor(file) { this.file = file; }
      async request(type, payload) {
        if (type === 'open') {
          const module = await factory({ wasmBinary: fs.readFileSync('node_modules/wa-sqlite/dist/wa-sqlite-async.wasm') });
          this.database = await StdbDatabase.open(module, this.file);
          return this.database.sessions;
        }
        if (type === 'session') return this.database.selectSession(payload.id);
        if (type === 'details') return this.database.getSessionDetails(payload.id);
        if (type === 'page') return this.database.page(payload.pageIndex, payload.pageSize, payload.selected);
        if (type === 'measurement') return this.database.measurement(payload.channelId, payload.start, payload.stop);
        if (type === 'exportHeader') return new TextEncoder().encode(exportHeader(payload.format, this.database));
        if (type === 'exportPage') {
          const page = await this.database.exportPage(payload.cursor, payload.limit);
          return {
            bytes: new TextEncoder().encode(exportRows(payload.format, this.database.channels, page.rows)),
            count: page.rows.length,
            cursor: page.cursor
          };
        }
        if (type === 'exportFooter') return new TextEncoder().encode(exportFooter(payload.format));
        throw new Error(`Unexpected request: ${type}`);
      }
      close() {
        if (this.database) this.database.sqlite.close(this.database.db);
      }
    }
  };
});

describe('StdbAPI', () => {
  const stdbFilePath = path.join(process.cwd(), 'reference/Logger.stdb');
  let realBuffer;

  beforeEach(() => {
    StdbAPI.reset();
    realBuffer = fs.readFileSync(stdbFilePath);
  });

  afterEach(() => {
    StdbAPI.reset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects files without valid 64-byte S332DBOF header', async () => {
    // Normal sqlite file or bad header
    const fakeFile = {
      name: 'corrupt.stdb',
      size: 100,
      slice: () => ({
        arrayBuffer: async () => new Uint8Array(80).fill(0).buffer
      })
    };

    await expect(StdbAPI.loadFromFile(fakeFile)).rejects.toThrow(
      'Invalid data file: unsupported or corrupted STDB format.'
    );
  });

  it('rejects normal SQLite .db files lacking the 64-byte proprietary prefix', async () => {
    // Offset 0 has "SQLite format 3" instead of S332DBOF
    const rawSqliteHeader = new Uint8Array(100);
    const text = 'SQLite format 3\0';
    for (let i = 0; i < text.length; i++) {
      rawSqliteHeader[i] = text.charCodeAt(i);
    }
    const fakeDbFile = {
      name: 'normal.db',
      size: 100,
      slice: () => ({
        arrayBuffer: async () => rawSqliteHeader.buffer
      })
    };

    await expect(StdbAPI.loadFromFile(fakeDbFile)).rejects.toThrow(
      'Invalid data file: unsupported or corrupted STDB format.'
    );
  });

  function createMockFile(buffer, name = 'Logger.stdb') {
    return {
      name,
      size: buffer.length,
      slice: (start, end) => ({
        arrayBuffer: async () => {
          const s = start !== undefined ? start : 0;
          const e = end !== undefined ? end : buffer.length;
          const sub = buffer.subarray(s, e);
          const copy = new Uint8Array(sub.length);
          copy.set(sub);
          return copy.buffer;
        }
      })
    };
  }

  async function loadSample(file) {
    await StdbAPI.loadFromFile(file);
    await StdbAPI.loadSession(StdbAPI.getSessions()[0]);
  }

  it('offers the single recording for selection before loading it', async () => {
    const file = createMockFile(realBuffer);
    const listener = vi.fn();
    window.addEventListener('stdbSessionsAvailable', listener, { once: true });
    const res = await StdbAPI.loadFromFile(file);
    expect(res.ok).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].detail.sessions).toHaveLength(1);
    expect(StdbAPI.isFileLoaded()).toBe(false);
    await StdbAPI.loadSession(listener.mock.calls[0][0].detail.sessions[0]);
    expect(StdbAPI.isFileLoaded()).toBe(true);
    expect(StdbAPI.getLoadedFileName()).toBe('DL_G2_log');
    expect(StdbAPI.getNumOfSamples()).toBe(137);
    expect(StdbAPI.getSampleRate()).toBe(1);

    const timeRange = StdbAPI.getFileTimeRange();
    expect(timeRange.start).toBe(1795500972433);
    expect(timeRange.stop).toBe(1795501108352);
  });

  it('offers an empty session list without activating a recording', async () => {
    const SQL = await initSqlJs();
    const fixture = new SQL.Database();
    fixture.run('CREATE TABLE FileInformationTable (ID INTEGER, StartTimeStamp INTEGER)');
    const bytes = Buffer.concat([realBuffer.subarray(0, 64), Buffer.from(fixture.export())]);
    fixture.close();
    const listener = vi.fn();
    window.addEventListener('stdbSessionsAvailable', listener, { once: true });
    expect(await StdbAPI.loadFromFile(createMockFile(bytes))).toEqual({ ok: true });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].detail.sessions).toEqual([]);
    expect(StdbAPI.getSessions()).toEqual([]);
    expect(StdbAPI.isFileLoaded()).toBe(false);
    expect(StdbAPI.getActiveSession()).toBeNull();
  });

  it('provides 15 channels matching Logger.stdb schema', async () => {
    const file = createMockFile(realBuffer);
    await loadSample(file);

    const channelsRes = await new Promise(resolve => StdbAPI.getChannels(resolve));
    expect(channelsRes.logging_chs.length).toBe(15);
    expect(channelsRes.logging_chs[0].logic_channel_description).toBe('Temperature');
    expect(channelsRes.logging_chs[7].logic_channel_description).toBe('露点');
    expect(new Set(channelsRes.logging_chs.map(channel => channel.sensor_id)).size).toBe(4);
    expect(channelsRes.logging_chs[0].sensor_id).not.toBe(channelsRes.logging_chs[7].sensor_id);
    const locations = await new Promise(resolve => StdbAPI.getLocations(resolve));
    expect(locations.locations[0].location_id).toBe(channelsRes.logging_chs[0].location_id);
  });

  it('reads channel and sensor details before opening the recording', async () => {
    await StdbAPI.loadFromFile(createMockFile(realBuffer));
    const details = await StdbAPI.getSessionDetails(StdbAPI.getSessions()[0].ID);
    expect(details.channels).toHaveLength(15);
    expect(details.channels[0].sensor_description).toBe('S040');
    expect(details.channels[0].logic_channel_description).toBe('Temperature');
    expect(StdbAPI.isFileLoaded()).toBe(false);
    expect(StdbAPI.getActiveSession()).toBeNull();
    await StdbAPI.loadSession(details.session);
    expect(StdbAPI.getNumOfSamples()).toBe(137);
  });

  it('exports the active session to CSV and Excel without changing the source', async () => {
    const file = createMockFile(realBuffer);
    await loadSample(file);
    const blobs = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { blobs.push(blob); return 'blob:test'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const progress = vi.fn();

    await StdbAPI.exportAllChannelsToCsv(progress);
    await StdbAPI.exportAllChannelsToExcel(progress);

    const csv = await blobs[0].text();
    expect(csv).toContain('NO.Of Channels,15\nNO.Of Records,137');
    expect(csv).toContain('Date Time,Temperature - ℃');
    expect(csv).toContain('-9999.0');
    expect(csv).toContain('10.98');
    expect(csv).toMatch(/:\d{2}\.433/);
    expect(csv.trimEnd().split('\n')).toHaveLength(11 + 15 + 137);
    const excel = await blobs[1].text();
    expect(excel).toContain('ss:Name="CSD Export"');
    expect(excel).toContain('<Data ss:Type="Number">10.98</Data>');
    expect(excel).toContain('<Cell/>');
    expect((excel.match(/<Row>/g) || [])).toHaveLength(9 + 137);
    expect(progress).toHaveBeenLastCalledWith(1);
    const exportedFile = { name: 'export.csv', size: blobs[0].size, slice: (...args) => blobs[0].slice(...args) };
    expect(await CsvAPI.loadFromFile(exportedFile)).toBe(true);
    const firstPage = await new Promise(resolve => CsvAPI.getTablePage(0, 1, [7], resolve));
    expect(firstPage.rows[0].timestampMs).toBe(1795500972433);
    expect(firstPage.rows[0].values[7]).toBe(10.98);
    expect(fs.readFileSync(stdbFilePath)).toEqual(realBuffer);
  });

  it('streams exports to a separate file and refuses the original STDB name', async () => {
    await loadSample(createMockFile(realBuffer));
    const writable = { write: vi.fn(), close: vi.fn(), abort: vi.fn() };
    const handle = { name: 'result.csv', createWritable: vi.fn().mockResolvedValue(writable) };
    vi.stubGlobal('showSaveFilePicker', vi.fn().mockResolvedValue(handle));
    await StdbAPI.exportAllChannelsToCsv();
    expect(writable.write).toHaveBeenCalled();
    expect(writable.close).toHaveBeenCalledOnce();
    expect(writable.abort).not.toHaveBeenCalled();

    handle.name = 'Logger.stdb';
    handle.createWritable.mockClear();
    await expect(StdbAPI.exportAllChannelsToCsv()).rejects.toThrow('separate .csv file');
    expect(handle.createWritable).not.toHaveBeenCalled();
  });

  it('reopens exported CSV with quoted channel names and subsecond timestamps', async () => {
    const channel = { channel_id: 0, logic_channel_description: 'Flow, "A"', sensor_description: 'Sensor', unit_in_ascii: 'm/s' };
    const database = { channels: [channel], session: { LoggerFileName: 'Test' }, start: 1700000000123, stop: 1700000000123, interval: 1, numSamples: 1 };
    const text = exportHeader('csv', database) + exportRows('csv', database.channels, [
      { timestampMs: database.start, values: { 0: 42 } }
    ]);
    const blob = new Blob([text]);
    await CsvAPI.loadFromFile({ name: 'quoted.csv', size: blob.size, slice: (...args) => blob.slice(...args) });
    const channels = await new Promise(resolve => CsvAPI.getChannels(resolve));
    const page = await new Promise(resolve => CsvAPI.getTablePage(0, 1, [0], resolve));
    expect(channels.logging_chs[0].logic_channel_description).toBe('Flow, "A"');
    expect(page.rows[0].timestampMs).toBe(database.start);
    expect(page.rows[0].values[0]).toBe(42);
  });

  it('aborts a streaming export if writing fails', async () => {
    await loadSample(createMockFile(realBuffer));
    const writable = { write: vi.fn().mockRejectedValue(new Error('disk full')), close: vi.fn(), abort: vi.fn() };
    vi.stubGlobal('showSaveFilePicker', vi.fn().mockResolvedValue({
      name: 'result.csv', createWritable: vi.fn().mockResolvedValue(writable)
    }));
    await expect(StdbAPI.exportAllChannelsToCsv()).rejects.toThrow('disk full');
    expect(writable.abort).toHaveBeenCalledOnce();
    expect(writable.close).not.toHaveBeenCalled();
  });

  it('aborts a streaming export if the session changes while a write is pending', async () => {
    await loadSample(createMockFile(realBuffer));
    let finishWrite;
    const writable = {
      write: vi.fn(() => new Promise(resolve => { finishWrite = resolve; })),
      close: vi.fn(),
      abort: vi.fn()
    };
    vi.stubGlobal('showSaveFilePicker', vi.fn().mockResolvedValue({
      name: 'result.csv', createWritable: vi.fn().mockResolvedValue(writable)
    }));
    const exporting = StdbAPI.exportAllChannelsToCsv();
    await vi.waitFor(() => expect(writable.write).toHaveBeenCalledOnce());
    StdbAPI.reset();
    finishWrite();
    await expect(exporting).rejects.toThrow('session changed');
    expect(writable.abort).toHaveBeenCalledOnce();
    expect(writable.close).not.toHaveBeenCalled();
  });

  it('retrieves table page data correctly', async () => {
    const file = createMockFile(realBuffer);
    await loadSample(file);

    const pageRes = await new Promise(resolve => StdbAPI.getTablePage(0, 10, null, resolve));
    expect(pageRes.total).toBe(137);
    expect(pageRes.rows.length).toBe(10);
    // Channel 8 (0-indexed 7) is 露点 which has valid data
    expect(pageRes.rows[0].values[7]).toBe(10.98);
  });

  it('retrieves measurement data with +8h offset applied', async () => {
    const file = createMockFile(realBuffer);
    await loadSample(file);

    const startUI = 1795500972433 + 3600000 * 8;
    const stopUI = 1795501108352 + 3600000 * 8;

    const dataRes = await new Promise(resolve => {
      StdbAPI.getMeasurementData(7, startUI, stopUI, 1000, 'ALL', resolve);
    });

    expect(dataRes.length).toBe(1);
    expect(dataRes[0].measurementData[0].length).toBe(137);
    expect(dataRes[0].realStartTime[0]).toBe(startUI);
  });
});
