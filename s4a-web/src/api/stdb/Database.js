import * as SQLite from 'wa-sqlite';
import ReadOnlyVFS from './ReadOnlyVFS.js';

const DISPLAY_POINTS = 3000;
const OFFSET_MS = 8 * 60 * 60 * 1000;

function tableSuffix(session) {
  let name = '';
  if (session.SpecialID) {
    const special = JSON.parse(session.SpecialID);
    name = special.file_name || '';
  }
  name = name.replace(/[^a-zA-Z0-9_]/g, '');
  return name || 'default';
}

function identifier(value) {
  return `"${value.replace(/"/g, '""')}"`;
}

function cleanValue(value) {
  return value == null || value === -9999 ? null : value;
}

export default class StdbDatabase {
  constructor(sqlite, db, vfs) {
    this.sqlite = sqlite;
    this.db = db;
    this.vfs = vfs;
  }

  static async open(module, file) {
    const sqlite = SQLite.Factory(module);
    const vfs = new ReadOnlyVFS(file);
    sqlite.vfs_register(vfs, false);
    const db = await sqlite.open_v2('file:stdb?immutable=1',
      SQLite.SQLITE_OPEN_READONLY | SQLite.SQLITE_OPEN_URI, vfs.name);
    const database = new StdbDatabase(sqlite, db, vfs);
    try {
      database.sessions = await database.query('SELECT * FROM FileInformationTable ORDER BY StartTimeStamp DESC, ID DESC');
      return database;
    } catch (error) {
      await sqlite.close(db);
      throw error;
    }
  }

  async query(sql, params = []) {
    const result = [];
    try {
      for await (const stmt of this.sqlite.statements(this.db, sql)) {
        this.sqlite.bind_collection(stmt, params);
        const columns = this.sqlite.column_names(stmt);
        while (await this.sqlite.step(stmt) === SQLite.SQLITE_ROW) {
          result.push(Object.fromEntries(columns.map((name, i) => [name, this.sqlite.column(stmt, i)])));
        }
      }
    } catch (error) {
      if (this.vfs.error) throw this.vfs.error;
      throw error;
    }
    return result;
  }

  async readSessionHeader(id) {
    const session = this.sessions.find(item => item.ID === id);
    if (!session) throw new Error('Session not found in STDB file.');
    const suffix = tableSuffix(session);
    const header = identifier(`ChannelHeader_${suffix}`);
    const table = identifier(`ChannelData_${suffix}`);
    const rows = await this.query(`SELECT * FROM ${header} ORDER BY Item`);
    const columns = await this.query(`PRAGMA table_info(${table})`);
    const columnNames = new Set(columns.map(column => column.name));
    const sensors = new Map();
    const channels = rows.map((row, index) => {
      if (!Number.isSafeInteger(row.Item) || row.Item < 1 || !columnNames.has(`C${row.Item}`)) {
        throw new Error(`Missing data column for channel ${row.Item}.`);
      }
      const sensorDescription = row.SensorDescription || row.DeviceDescription || '';
      const sensorKey = JSON.stringify([row.SensorID ?? 0, sensorDescription]);
      if (!sensors.has(sensorKey)) sensors.set(sensorKey, sensors.size);
      return {
        channel_id: index,
        columnName: `C${row.Item}`,
        location_id: 0,
        sensor_id: sensors.get(sensorKey),
        logic_channel_description: row.ChannelDescription,
        physical_channel_description: row.ChannelDescription,
        sensor_description: sensorDescription,
        unit_in_ascii: row.Unit || '',
        resolution: row.Resolution,
        min: row.Min,
        max: row.Max,
        identity: {
          device: row.DeviceID,
          sensor: row.SensorID,
          channel: row.ChannelID,
          name: row.ChannelDescription,
          sensorName: sensorDescription,
          unit: row.Unit
        }
      };
    });
    return { session, table, channels };
  }

  async getSessionDetails(id) {
    const { session, channels } = await this.readSessionHeader(id);
    return { session, channels };
  }

  async selectSession(id) {
    const { session, table, channels } = await this.readSessionHeader(id);
    const [range] = await this.query(`SELECT COUNT(*) AS count, MIN(TimeStamp) AS start, MAX(TimeStamp) AS stop FROM ${table}`);
    const interval = Number(session.SampleRate);
    if (!Number.isFinite(interval) || interval <= 0) throw new Error('Invalid sample interval in STDB session.');
    this.session = session;
    this.table = table;
    this.channels = channels;
    this.numSamples = range.count;
    this.start = Number(session.StartTimeStamp) || range.start || 0;
    this.stop = Number(session.EndTimeStamp) || range.stop || 0;
    this.interval = interval;
    return {
      session, channels, numSamples: this.numSamples, start: this.start, stop: this.stop, interval,
      sampleStart: range.start, sampleStop: range.stop
    };
  }

  async page(pageIndex, pageSize, selected) {
    if (!Number.isSafeInteger(pageIndex) || pageIndex < 0 || !Number.isSafeInteger(pageSize) || pageSize < 1) {
      throw new Error('Invalid table page.');
    }
    const rows = await this.rowsAtOffset(pageIndex * pageSize, pageSize, selected);
    return {
      total: this.numSamples,
      sampleRate: 1 / this.interval,
      startTimeMs: this.start,
      stopTimeMs: this.stop,
      rows: rows.map((row, i) => ({ ...row, index: pageIndex * pageSize + i }))
    };
  }

  async rowsAtOffset(offset, limit, selected) {
    const channels = this.channels.filter(ch => !selected || selected.includes(ch.channel_id));
    const fields = channels.map(ch => identifier(ch.columnName)).join(', ');
    const rows = await this.query(`SELECT ID, TimeStamp${fields ? `, ${fields}` : ''} FROM ${this.table} ORDER BY TimeStamp, ID LIMIT ? OFFSET ?`, [limit, offset]);
    return rows.map(row => ({
      recordId: row.ID,
      timestampMs: row.TimeStamp,
      values: Object.fromEntries(channels.map(ch => [ch.channel_id, cleanValue(row[ch.columnName])]))
    }));
  }

  async countBefore(timestamp, inclusive = false) {
    const [result] = await this.query(`SELECT COUNT(*) AS count FROM ${this.table} WHERE TimeStamp ${inclusive ? '<=' : '<'} ?`, [timestamp]);
    return result.count;
  }

  async exportPage(cursor, limit) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000 ||
        (cursor && (!Number.isFinite(cursor.timestamp) || !Number.isSafeInteger(cursor.id)))) {
      throw new Error('Invalid export page.');
    }
    const fields = this.channels.map(ch => identifier(ch.columnName)).join(', ');
    const where = cursor ? 'WHERE TimeStamp > ? OR (TimeStamp = ? AND ID > ?)' : '';
    const params = cursor ? [cursor.timestamp, cursor.timestamp, cursor.id, limit] : [limit];
    const rows = await this.query(`SELECT ID, TimeStamp${fields ? `, ${fields}` : ''} FROM ${this.table} ${where} ORDER BY TimeStamp, ID LIMIT ?`, params);
    return {
      rows: rows.map(row => ({
        recordId: row.ID,
        timestampMs: row.TimeStamp,
        values: Object.fromEntries(this.channels.map(ch => [ch.channel_id, cleanValue(row[ch.columnName])]))
      })),
      cursor: rows.length ? { timestamp: rows[rows.length - 1].TimeStamp, id: rows[rows.length - 1].ID } : null
    };
  }

  async measurement(channelId, start, stop, maxPoints = DISPLAY_POINTS) {
    const channel = this.channels.find(ch => ch.channel_id === Number(channelId));
    if (!channel || !Number.isFinite(start) || !Number.isFinite(stop) || stop < start) {
      throw new Error('Invalid measurement request.');
    }
    const params = [start - OFFSET_MS, stop - OFFSET_MS];
    const where = 'TimeStamp >= ? AND TimeStamp <= ?';
    const [{ count }] = await this.query(`SELECT COUNT(*) AS count FROM ${this.table} WHERE ${where}`, params);
    const step = Math.max(1, Math.ceil(count / (maxPoints / 3)));
    const data = [];
    const times = [];
    const sql = `SELECT TimeStamp, ${identifier(channel.columnName)} FROM ${this.table} WHERE ${where} ORDER BY TimeStamp, ID`;
    let bucket = { count: 0, min: null, max: null, gap: null };
    let previousTime = null;
    const flush = () => {
      if (!bucket.count) return;
      const points = [bucket.min, bucket.max, bucket.gap].filter((point, index, list) =>
        point && list.indexOf(point) === index
      ).sort((a, b) => a.time - b.time);
      for (const point of points) {
        data.push(point.value);
        times.push(point.time + OFFSET_MS);
      }
      bucket = { count: 0, min: null, max: null, gap: null };
    };
    for await (const stmt of this.sqlite.statements(this.db, sql)) {
      this.sqlite.bind_collection(stmt, params);
      while (await this.sqlite.step(stmt) === SQLite.SQLITE_ROW) {
        const time = this.sqlite.column(stmt, 0);
        const value = cleanValue(this.sqlite.column(stmt, 1));
        if (previousTime !== null && time - previousTime > this.interval * 2000) {
          bucket.gap ||= { time: previousTime + this.interval * 1000, value: null };
        }
        if (value === null) {
          bucket.gap ||= { time, value };
        } else {
          const point = { time, value };
          if (!bucket.min || value < bucket.min.value) bucket.min = point;
          if (!bucket.max || value > bucket.max.value) bucket.max = point;
        }
        bucket.count++;
        if (bucket.count >= step) flush();
        previousTime = time;
      }
    }
    return [{
      channel_id: channelId,
      measurementData: data.length ? [data] : [],
      realStartTime: times.length ? [times[0]] : [],
      pointInterval: data.length ? [this.interval * 1000] : [],
      times: times.length ? [times] : [],
      min: channel.min,
      max: channel.max
    }];
  }
}
