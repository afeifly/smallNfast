/**
 * alarmDbUtils.js
 * Utilities to open, query, and update the Alarm.db SQLite file
 * stored as a binary entry inside the loaded .cfgf fileMap.
 *
 * Uses sql.js (SQLite compiled to WebAssembly).
 */

import initSqlJs from 'sql.js';

let _SQL = null;

/**
 * Lazily initialise the sql.js engine once.
 * The WASM binary is served from /public/sql-wasm.wasm.
 */
async function getSqlJs() {
  if (!_SQL) {
    _SQL = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm',
    });
  }
  return _SQL;
}

/**
 * Locate the Alarm.db key inside the fileMap (case-insensitive, any folder depth).
 */
function findAlarmDbKey(fileMap) {
  for (const key of fileMap.keys()) {
    if (key.toLowerCase().endsWith('alarm.db')) return key;
  }
  return null;
}

/**
 * Open Alarm.db from configData.fileMap and return a { db, key } object.
 * Caller is responsible for calling db.close() when finished.
 *
 * @param {Map<string, Uint8Array>} fileMap
 * @returns {Promise<{db: Database, key: string} | null>}
 */
export async function openAlarmDb(fileMap) {
  if (!fileMap) return null;
  const key = findAlarmDbKey(fileMap);
  if (!key) {
    console.warn('[alarmDbUtils] Alarm.db not found in fileMap');
    return null;
  }

  const SQL = await getSqlJs();
  const bytes = fileMap.get(key);
  const db = new SQL.Database(bytes);
  return { db, key };
}

/**
 * Read all alarm_config rows joined with sensor/channel info.
 * Returns an array of plain objects ready for the React state.
 *
 * @param {Database} db  An open sql.js Database instance
 * @returns {Array<Object>}
 */
export function readAlarmConfigs(db) {
  const sql = `
    SELECT
      ac.config_id,
      ac.sensor_identify_id,
      ac.channel_identify_id,
      ac.measurement_point,
      ac.location,
      ac.threshold,
      ac.hysteresis,
      ac.direction,
      ac.delay,
      ac.relay_id,
      ac.relay_flag,
      ac.is_relay_permanent_off,
      ac.is_deleted,
      ac.update_time,
      ac.relay_address,
      ac.relay_ch_id,
      s.sensor_desc   AS sensorName,
      c.channel_desc  AS channelName,
      c.channel_unit  AS channelUnit
    FROM alarm_config ac
    LEFT JOIN sensor  s ON s.sensor_identify_id  = ac.sensor_identify_id
    LEFT JOIN channel c ON c.channel_identify_id = ac.channel_identify_id
    WHERE (ac.is_deleted IS NULL OR ac.is_deleted = 0)
    ORDER BY ac.config_id ASC
  `;

  try {
    const stmt = db.prepare(sql);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } catch (e) {
    console.error('[alarmDbUtils] readAlarmConfigs error:', e);
    return [];
  }
}

/**
 * Insert a new alarm_config row.
 *
 * @param {Database} db
 * @param {Object} alarm  Fields: sensor_identify_id, channel_identify_id,
 *                        measurement_point, location, threshold, hysteresis,
 *                        direction, delay, relay_id, relay_flag
 */
export function insertAlarmConfig(db, alarm) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const sql = `
    INSERT INTO alarm_config
      (sensor_identify_id, channel_identify_id, measurement_point, location,
       threshold, hysteresis, direction, delay, relay_id, relay_flag,
       is_relay_permanent_off, is_deleted, update_time, relay_address, relay_ch_id)
    VALUES
      (:sensor_identify_id, :channel_identify_id, :measurement_point, :location,
       :threshold, :hysteresis, :direction, :delay, :relay_id, :relay_flag,
       0, 0, :update_time, 0, 0)
  `;
  db.run(sql, {
    ':sensor_identify_id':  alarm.sensor_identify_id,
    ':channel_identify_id': alarm.channel_identify_id,
    ':measurement_point':   alarm.measurement_point  ?? '',
    ':location':            alarm.location            ?? '',
    ':threshold':           alarm.threshold           ?? 0,
    ':hysteresis':          alarm.hysteresis          ?? 0,
    ':direction':           alarm.direction           ?? 'up',
    ':delay':               alarm.delay               ?? 0,
    ':relay_id':            alarm.relay_id            ?? 0,
    ':relay_flag':          alarm.relay_flag          ?? 1,
    ':update_time':         now,
  });
  // Return the new row id
  return db.exec('SELECT last_insert_rowid() AS id')[0]?.values?.[0]?.[0];
}

/**
 * Update an existing alarm_config row by config_id.
 *
 * @param {Database} db
 * @param {number}   configId
 * @param {Object}   fields  Any subset of alarm_config columns to update
 */
export function updateAlarmConfig(db, configId, fields) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const allowed = [
    'threshold', 'hysteresis', 'direction', 'delay',
    'relay_id', 'relay_flag', 'measurement_point', 'location',
    'is_relay_permanent_off',
  ];
  const sets = allowed
    .filter(k => k in fields)
    .map(k => `${k} = :${k}`)
    .join(', ');

  if (!sets) return;

  const params = { ':config_id': configId, ':update_time': now };
  allowed.filter(k => k in fields).forEach(k => { params[`:${k}`] = fields[k]; });

  db.run(
    `UPDATE alarm_config SET ${sets}, update_time = :update_time WHERE config_id = :config_id`,
    params
  );
}

/**
 * Soft-delete an alarm_config row by config_id.
 *
 * @param {Database} db
 * @param {number}   configId
 */
export function deleteAlarmConfig(db, configId) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  db.run(
    `UPDATE alarm_config SET is_deleted = 1, update_time = :now WHERE config_id = :id`,
    { ':now': now, ':id': configId }
  );
}

/**
 * Ensure a sensor row exists in the `sensor` table.
 * Inserts only if the sensor_identify_id is not already present.
 * This keeps the JOIN in readAlarmConfigs working for newly-added sensors.
 *
 * @param {Database} db
 * @param {string}   sensorId    sensor_identify_id (CreateTime from JSON)
 * @param {string}   sensorDesc  Human-readable sensor name
 */
export function ensureSensorExists(db, sensorId, sensorDesc, sensorDbId = 0) {
  const exists = db.exec(
    `SELECT 1 FROM sensor WHERE sensor_identify_id = '${sensorId}' LIMIT 1`
  );
  if (!exists.length || !exists[0].values.length) {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    try {
      db.run(
        `INSERT INTO sensor (sensor_desc, sensor_identify_id, create_time, sensor_id)
         VALUES (:desc, :id, :time, :sensor_id)`,
        { ':desc': sensorDesc, ':id': sensorId, ':time': now, ':sensor_id': sensorDbId }
      );
    } catch (e) {
      try {
        db.run(
          `INSERT INTO sensor (sensor_desc, sensor_identify_id, create_time)
           VALUES (:desc, :id, :time)`,
          { ':desc': sensorDesc, ':id': sensorId, ':time': now }
        );
      } catch (err) {
        console.error('[alarmDbUtils] ensureSensorExists failed:', err);
      }
    }
  }
}

/**
 * Ensure a channel row exists in the `channel` table.
 * Inserts only if the channel_identify_id is not already present.
 * This keeps the JOIN in readAlarmConfigs working for newly-added channels.
 *
 * @param {Database} db
 * @param {string}   channelId    channel_identify_id (CreateTime from JSON)
 * @param {string}   sensorId     sensor_identify_id it belongs to
 * @param {string}   channelDesc  Human-readable channel name
 * @param {string}   channelUnit  Unit string (e.g. "m3/h")
 */
export function ensureChannelExists(db, channelId, sensorId, channelDesc, channelUnit) {
  const exists = db.exec(
    `SELECT 1 FROM channel WHERE channel_identify_id = '${channelId}' LIMIT 1`
  );
  if (!exists.length || !exists[0].values.length) {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    db.run(
      `INSERT INTO channel
         (channel_identify_id, sensor_identify_id, channel_desc, channel_unit, create_time)
       VALUES (:chid, :sid, :desc, :unit, :time)`,
      {
        ':chid': channelId,
        ':sid':  sensorId,
        ':desc': channelDesc,
        ':unit': channelUnit,
        ':time': now,
      }
    );
  }
}

/**
 * Export the current in-memory database back to a Uint8Array and
 * write it into the fileMap under the original key.
 *
 * @param {Database}               db
 * @param {string}                 key      Original fileMap key for Alarm.db
 * @param {Map<string, Uint8Array>} fileMap  Reference to the live fileMap
 */
export function flushAlarmDb(db, key, fileMap) {
  const data = db.export();
  fileMap.set(key, data);
}

/**
 * Create a new empty Alarm.db database in-memory and return its Uint8Array export.
 * Contains empty tables: alarm_config, sensor, channel.
 *
 * @returns {Promise<Uint8Array>}
 */
export async function createEmptyAlarmDb() {
  const SQL = await getSqlJs();
  const db = new SQL.Database();
  
  db.run(`
    CREATE TABLE IF NOT EXISTS alarm_config (
      config_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      sensor_identify_id TEXT NOT NULL,
      channel_identify_id TEXT NOT NULL,
      measurement_point TEXT NOT NULL,
      location TEXT NOT NULL,
      threshold REAL NOT NULL,
      hysteresis REAL NOT NULL,
      direction TEXT NOT NULL,
      delay INTEGER DEFAULT 0 NULL,
      relay_id INTEGER DEFAULT 0 NULL,
      relay_flag INTEGER DEFAULT 1 NULL,
      relay_address INTEGER DEFAULT 0 NULL,
      relay_ch_id INTEGER DEFAULT 0 NULL,
      is_relay_permanent_off INTEGER DEFAULT 0 NULL,
      is_deleted INTEGER DEFAULT 0 NULL,
      update_time TEXT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sensor (
      sensor_id INTEGER NOT NULL,
      sensor_desc TEXT NOT NULL,
      sensor_identify_id TEXT PRIMARY KEY NOT NULL,
      create_time TEXT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS channel (
      "'channel_id'notnull" INTEGER NULL,
      channel_identify_id TEXT PRIMARY KEY NOT NULL,
      sensor_identify_id TEXT NOT NULL,
      channel_desc TEXT NOT NULL,
      channel_unit TEXT NOT NULL,
      create_time TEXT NULL
    );
  `);

  const binary = db.export();
  db.close();
  return binary;
}
