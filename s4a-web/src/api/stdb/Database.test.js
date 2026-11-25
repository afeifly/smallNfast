import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import factory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
import initSqlJs from 'sql.js';
import StdbDatabase from './Database.js';
import CombinedDatabase from './CombinedDatabase.js';
import { exportHeader, exportRows, exportFooter } from './Export.js';

describe('STDB SQLite reader', () => {
  let database;
  let largestRead = 0;

  beforeAll(async () => {
    const bytes = readFileSync('reference/Logger.stdb');
    const file = {
      size: bytes.length,
      slice(start, end) {
        largestRead = Math.max(largestRead, end - start);
        const slice = bytes.subarray(start, end);
        return { arrayBuffer: async () => Uint8Array.from(slice).buffer };
      }
    };
    const module = await factory({
      wasmBinary: readFileSync('node_modules/wa-sqlite/dist/wa-sqlite-async.wasm')
    });
    database = await StdbDatabase.open(module, file);
    await database.selectSession(database.sessions[0].ID);
  });

  afterAll(async () => {
    if (database) await database.sqlite.close(database.db);
  });

  it('reads session metadata and selected channel pages without loading the file', async () => {
    expect(database.sessions).toHaveLength(1);
    expect(database.channels).toHaveLength(15);
    const page = await database.page(0, 10, [7]);
    expect(page.total).toBe(137);
    expect(page.rows[0].values).toEqual({ 7: 10.98 });
    expect(largestRead).toBeLessThan(44 * 1024);
  });

  it('exports every row in stable timestamp order across keyset pages', async () => {
    let cursor = null;
    const rows = [];
    do {
      const page = await database.exportPage(cursor, 10);
      rows.push(...page.rows);
      cursor = page.cursor;
    } while (cursor);
    expect(rows).toHaveLength(137);
    expect(rows[0].values[7]).toBe(10.98);
    expect(rows[0].values[0]).toBeNull();
    expect(rows.map(row => row.timestampMs)).toEqual([...rows.map(row => row.timestampMs)].sort((a, b) => a - b));
  });

  it('reads chart values with actual timestamps and preserves missing values', async () => {
    const offset = 8 * 60 * 60 * 1000;
    const [measurement] = await database.measurement('7', database.start + offset, database.stop + offset);
    expect(measurement.measurementData[0]).toHaveLength(137);
    expect(measurement.times[0][0]).toBe(database.start + offset);
    const [missing] = await database.measurement(0, database.start + offset, database.stop + offset);
    expect(missing.measurementData[0][0]).toBeNull();
  });

  it('rejects writes to the original database', async () => {
    await expect(database.query('CREATE TABLE unexpected (id INTEGER)')).rejects.toThrow();
  });

  it('combines sessions without losing or interleaving samples incorrectly', async () => {
    const SQL = await initSqlJs();
    const fixture = new SQL.Database();
    fixture.run('CREATE TABLE FileInformationTable (ID INTEGER, LoggerFileName TEXT, SpecialID TEXT, StartTimeStamp INTEGER, EndTimeStamp INTEGER, SampleRate INTEGER)');
    const sources = [
      [1, 'a', 1000, 2000, 1],
      [2, 'b', 4000, 5000, 1],
      [3, 'c', 2000, 4000, 1],
      [4, 'd', 7000, 7000, 2]
    ];
    for (const [id, suffix, start, stop, interval] of sources) {
      fixture.run('INSERT INTO FileInformationTable VALUES (?, ?, ?, ?, ?, ?)',
        [id, suffix, JSON.stringify({ file_name: suffix }), start, stop, interval]);
      fixture.run(`CREATE TABLE ChannelHeader_${suffix} (Item INTEGER, ChannelDescription TEXT, SensorDescription TEXT, Unit TEXT, Resolution INTEGER, Min REAL, Max REAL, ChannelID INTEGER, DeviceID INTEGER, SensorID INTEGER)`);
      fixture.run(`INSERT INTO ChannelHeader_${suffix} VALUES (1, 'Temperature', 'Sensor', 'C', 1, 1, 5, 1, 2, 3)`);
      fixture.run(`CREATE TABLE ChannelData_${suffix} (ID INTEGER PRIMARY KEY, TimeStamp INTEGER, C1 REAL)`);
      fixture.run(`INSERT INTO ChannelData_${suffix} VALUES (1, ?, ?), (2, ?, ?)`, [start, id * 10, stop, id * 10 + 1]);
    }
    const bytes = fixture.export();
    fixture.close();
    const file = new Blob([new Uint8Array(64), bytes]);
    const opened = [];
    try {
      for (const [id] of sources) {
        const module = await factory({ wasmBinary: readFileSync('node_modules/wa-sqlite/dist/wa-sqlite-async.wasm') });
        const db = await StdbDatabase.open(module, file);
        opened.push({ database: db, result: await db.selectSession(id) });
      }
      const combined = new CombinedDatabase(opened.slice(0, 3));
      expect(combined.channels).toHaveLength(2);
      expect(combined.channels[0].logic_channel_description).not.toBe(combined.channels[1].logic_channel_description);
      expect(combined.numSamples).toBe(6);
      const first = await combined.page(0, 3, null);
      const second = await combined.page(1, 3, null);
      expect([...first.rows, ...second.rows].map(row => row.timestampMs)).toEqual([1000, 2000, 2000, 4000, 4000, 5000]);
      expect(first.rows.map(row => row.values)).toEqual([{ 0: 10 }, { 0: 11 }, { 1: 30 }]);
      expect(second.rows.map(row => row.values)).toEqual([{ 0: 20 }, { 1: 31 }, { 0: 21 }]);
      const page1 = await combined.exportPage(null, 3);
      const page2 = await combined.exportPage(page1.cursor, 3);
      expect([...page1.rows, ...page2.rows].map(row => row.timestampMs)).toEqual([1000, 2000, 2000, 4000, 4000, 5000]);
      expect((await combined.exportPage(page2.cursor, 3)).rows).toEqual([]);
      const sequential = new CombinedDatabase(opened.slice(0, 2));
      expect(sequential.channels).toHaveLength(1);
      expect((await sequential.page(0, 3, [0])).rows.map(row => row.values[0])).toEqual([10, 11, 20]);
      expect((await sequential.page(1, 3, [0])).rows.map(row => row.values[0])).toEqual([21]);
      const [chart] = await sequential.measurement(0, 1000 + 8 * 3600000, 5000 + 8 * 3600000);
      expect(chart.measurementData[0]).toEqual([10, 11, null, 20, 21]);
      const missingIdentity = {
        ...opened[1],
        result: { ...opened[1].result, channels: opened[1].result.channels.map(channel => ({ ...channel, identity: { ...channel.identity, device: null } })) }
      };
      expect(new CombinedDatabase([opened[0], missingIdentity]).channels).toHaveLength(2);
      expect(() => new CombinedDatabase(opened)).toThrow('same sample interval');
      expect(opened[0].database.session.ID).toBe(1);
    } finally {
      for (const source of opened) await source.database.sqlite.close(source.database.db);
    }
  });

  it('bounds chart output while retaining peaks and missing samples', async () => {
    const SQL = await initSqlJs();
    const fixture = new SQL.Database();
    fixture.run('CREATE TABLE FileInformationTable (ID INTEGER, SpecialID TEXT, StartTimeStamp INTEGER, EndTimeStamp INTEGER, SampleRate INTEGER)');
    fixture.run(`INSERT INTO FileInformationTable VALUES (1, '{"file_name":"test"}', 100000, 4099000, 1)`);
    fixture.run(`INSERT INTO FileInformationTable VALUES (2, '{"file_name":"old"}', 50000, 60000, 1), (3, '{"file_name":"new"}', 5000000, 6000000, 1), (4, '{"file_name":"new2"}', 5000000, 6000000, 1)`);
    fixture.run('CREATE TABLE ChannelHeader_test (Item INTEGER, ChannelDescription TEXT)');
    fixture.run("INSERT INTO ChannelHeader_test VALUES (1, 'Sensor')");
    fixture.run('CREATE TABLE ChannelHeader_old (Item INTEGER, ChannelDescription TEXT, SensorDescription TEXT)');
    fixture.run("INSERT INTO ChannelHeader_old VALUES (1, 'Old channel', 'Old sensor')");
    fixture.run('CREATE TABLE ChannelData_old (ID INTEGER, TimeStamp INTEGER, C1 REAL)');
    fixture.run('CREATE TABLE ChannelData_test (ID INTEGER, TimeStamp INTEGER, C1 REAL)');
    fixture.run('BEGIN');
    const insert = fixture.prepare('INSERT INTO ChannelData_test VALUES (?, ?, ?)');
    for (let i = 0; i < 4000; i++) {
      insert.run([i + 1, 100000 + (i === 124 ? 123 : i) * 1000, i === 123 ? 999 : (i === 124 ? -9999 : 1)]);
    }
    insert.free();
    fixture.run('COMMIT');
    const bytes = fixture.export();
    fixture.close();
    const file = new Blob([new Uint8Array(64), bytes]);
    const module = await factory({
      wasmBinary: readFileSync('node_modules/wa-sqlite/dist/wa-sqlite-async.wasm')
    });
    const large = await StdbDatabase.open(module, file);
    try {
      expect(large.sessions.map(session => session.ID)).toEqual([4, 3, 1, 2]);
      const query = vi.spyOn(large, 'query');
      const details = await large.getSessionDetails(2);
      expect(details.channels[0].sensor_description).toBe('Old sensor');
      expect(large.session).toBeUndefined();
      expect(query.mock.calls.some(([sql]) => sql.includes('COUNT('))).toBe(false);
      await large.selectSession(1);
      await large.getSessionDetails(2);
      expect(large.session.ID).toBe(1);
      expect((await large.page(0, 1, [0])).rows[0].values[0]).toBe(1);
      const offset = 8 * 60 * 60 * 1000;
      const [result] = await large.measurement(0, large.start + offset, large.stop + offset);
      expect(result.measurementData[0].length).toBeLessThanOrEqual(3000);
      expect(result.measurementData[0]).toContain(999);
      expect(result.measurementData[0]).toContain(null);
      let cursor = null;
      const exported = [];
      do {
        const page = await large.exportPage(cursor, 124);
        exported.push(...page.rows);
        cursor = page.cursor;
      } while (cursor);
      expect(exported).toHaveLength(4000);
      expect(exported[123].values[0]).toBe(999);
      expect(exported[124].values[0]).toBeNull();
    } finally {
      await large.sqlite.close(large.db);
    }
  });

  it('escapes channel metadata in CSV and Excel exports', () => {
    const channel = { channel_id: 0, logic_channel_description: 'Flow, "A" & B', sensor_description: 'S<1', unit_in_ascii: 'm/s' };
    const database = { channels: [channel], session: { LoggerFileName: 'Test' }, start: 0, stop: 0, interval: 1, numSamples: 1 };
    const csv = exportHeader('csv', database) + exportRows('csv', database.channels, [{ timestampMs: 0, values: { 0: 12 } }]);
    expect(csv).toContain('"Flow, ""A"" & B"');
    const excel = exportHeader('excel', database) + exportRows('excel', database.channels, [{ timestampMs: 0, values: { 0: 12 } }]) + exportFooter('excel');
    const doc = new DOMParser().parseFromString(excel, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.textContent).toContain('Flow, "A" & B (m/s)');
  });
});
