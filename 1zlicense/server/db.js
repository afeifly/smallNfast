const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'easylicense.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS calibrationlicenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sn TEXT NOT NULL DEFAULT '',
  localid TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL,
  note TEXT NOT NULL,
  state INTEGER NOT NULL DEFAULT 0,
  createdatetime TEXT
);
CREATE TABLE IF NOT EXISTS device_usage_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL DEFAULT '',
  product_id INTEGER NOT NULL DEFAULT 0,
  firsttime INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL,
  action INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  note TEXT NOT NULL,
  createdatetime TEXT
);
CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sn TEXT NOT NULL DEFAULT '',
  localid TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  user TEXT NOT NULL,
  addr TEXT NOT NULL,
  createdatetime TEXT
);
CREATE TABLE IF NOT EXISTS s332licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_code TEXT,
  note TEXT,
  license TEXT,
  createdatetime TEXT,
  create_by TEXT
);
CREATE TABLE IF NOT EXISTS s4a_remote_serialnumber (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sn TEXT NOT NULL DEFAULT '',
  state INTEGER NOT NULL DEFAULT 0,
  cn INTEGER NOT NULL DEFAULT 0,
  hk INTEGER NOT NULL DEFAULT 0,
  eu INTEGER NOT NULL DEFAULT 0,
  op0 INTEGER NOT NULL DEFAULT 0,
  op1 INTEGER NOT NULL DEFAULT 0,
  op2 INTEGER NOT NULL DEFAULT 0,
  op3 INTEGER NOT NULL DEFAULT 0,
  op4 INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL,
  createdatetime TEXT
);
CREATE TABLE IF NOT EXISTS s4cus_serialnumber (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sn TEXT NOT NULL DEFAULT '',
  sntype INTEGER NOT NULL,
  state INTEGER NOT NULL DEFAULT 0,
  deviceid TEXT DEFAULT '',
  company TEXT NOT NULL,
  note TEXT NOT NULL,
  createdatetime TEXT
);
CREATE TABLE IF NOT EXISTS s520licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sn TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL,
  license TEXT NOT NULL,
  createdatetime TEXT
);
CREATE TABLE IF NOT EXISTS serialnumbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  products_id INTEGER NOT NULL,
  sn TEXT NOT NULL DEFAULT '',
  max INTEGER NOT NULL,
  used INTEGER DEFAULT 0,
  note TEXT,
  createdatetime TEXT NOT NULL,
  registerdatetime TEXT,
  trial INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sn_cust_properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_define_id INTEGER NOT NULL,
  sn_id INTEGER NOT NULL,
  property_value INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sn_properties_define (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  property_name TEXT NOT NULL DEFAULT '',
  display_name TEXT,
  property_type INTEGER NOT NULL,
  scaling_min INTEGER DEFAULT 0,
  scaling_max INTEGER DEFAULT 100,
  default_value INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS software_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT DEFAULT '',
  canbereset INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL DEFAULT '',
  password TEXT NOT NULL DEFAULT '',
  role INTEGER DEFAULT 0,
  createdatetime TEXT
);
`;

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(SCHEMA);

let inTransaction = false;

function pad(n) {
    return n < 10 ? '0' + n : String(n);
}

function formatDate(d) {
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
        + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
}

function normalizeParam(v) {
    if (v instanceof Date) return formatDate(v);
    if (v === undefined) return null;
    return v;
}

function normalizeParams(params) {
    return params.map(normalizeParam);
}

function translateSql(sql) {
    let out = String(sql)
        .replace(/`/g, '')
        .replace(/\bnow\(\)/gi, "datetime('now')")
        .replace(/"([^"]*)"/g, "'$1'");
    return out;
}

function isBulkInsert(sql, params) {
    return /values\s*\?\s*$/i.test(sql)
        && params.length === 1
        && Array.isArray(params[0])
        && params[0].length > 0
        && Array.isArray(params[0][0]);
}

function isSingleRowInsert(sql, params) {
    return /values\s*\(\s*\?\s*\)\s*$/i.test(sql)
        && params.length === 1
        && Array.isArray(params[0])
        && params[0].length > 0
        && !Array.isArray(params[0][0]);
}

function runQuery(sql, params, cb) {
    let translated = translateSql(sql);
    params = normalizeParams(params);
    try {
        if (isBulkInsert(translated, params)) {
            const rows = params[0];
            const colCount = rows[0].length;
            const placeholders = rows.map(() => '(' + Array(colCount).fill('?').join(',') + ')').join(',');
            translated = translated.replace(/\?\s*$/, placeholders);
            const flat = [];
            for (const row of rows) {
                for (const v of row) flat.push(normalizeParam(v));
            }
            const info = db.prepare(translated).run(...flat);
            cb(null, { insertId: info.lastInsertRowid, affectedRows: info.changes });
            return;
        }

        if (isSingleRowInsert(translated, params)) {
            const row = params[0];
            const placeholders = Array(row.length).fill('?').join(',');
            translated = translated.replace(/\(\s*\?\s*\)\s*$/, '(' + placeholders + ')');
            const flat = row.map(normalizeParam);
            const info = db.prepare(translated).run(...flat);
            cb(null, { insertId: info.lastInsertRowid, affectedRows: info.changes });
            return;
        }

        const stmt = db.prepare(translated);
        if (/^\s*insert/i.test(translated)) {
            const info = stmt.run(...params);
            cb(null, { insertId: info.lastInsertRowid, affectedRows: info.changes });
        } else if (/^\s*(update|delete|replace)/i.test(translated)) {
            const info = stmt.run(...params);
            cb(null, { affectedRows: info.changes });
        } else {
            cb(null, stmt.all(...params));
        }
    } catch (e) {
        cb(e);
    }
}

function makeConnection() {
    return {
        query: function (sql, params, cb) {
            if (typeof params === 'function') {
                cb = params;
                params = [];
            }
            params = params || [];
            runQuery(sql, params, cb);
        },
        beginTransaction: function (cb) {
            if (inTransaction) return cb(new Error("Transaction already in progress"));
            inTransaction = true;
            try {
                db.exec('BEGIN');
                cb(null);
            } catch (e) {
                inTransaction = false;
                cb(e);
            }
        },
        commit: function (cb) {
            try {
                db.exec('COMMIT');
                inTransaction = false;
                if (cb) cb(null);
            } catch (e) {
                if (cb) cb(e);
            }
        },
        rollback: function (cb) {
            try {
                db.exec('ROLLBACK');
                inTransaction = false;
                if (cb) cb(null);
            } catch (e) {
                if (cb) cb(e);
            }
        },
        release: function () { },
        escape: function (val) {
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return String(val);
            return "'" + String(val).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
        },
        insertId: undefined
    };
}

const pool = {
    getConnection: function (cb) {
        cb(null, makeConnection());
    },
    escape: function (val) {
        return makeConnection().escape(val);
    }
};

module.exports = pool;
module.exports.__db = db;
module.exports.__makeConnection = makeConnection;