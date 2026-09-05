const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DUMP_FILE = process.argv[2] || path.join(__dirname, '..', 'backup_20260905.sql');
const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'easylicense.db');
const TABLES = [
    'calibrationlicenses',
    'device_usage_state',
    'events',
    'licenses',
    's332licenses',
    's4a_remote_serialnumber',
    's4cus_serialnumber',
    's520licenses',
    'serialnumbers',
    'sn_cust_properties',
    'sn_properties_define',
    'software_products',
    'users'
];

if (!fs.existsSync(DUMP_FILE)) {
    console.error('Dump file not found:', DUMP_FILE);
    process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec('PRAGMA foreign_keys = OFF');

for (const t of TABLES) {
    db.exec(`DROP TABLE IF EXISTS ${t}`);
}

const content = fs.readFileSync(DUMP_FILE, 'utf8');

const createRe = /CREATE TABLE `?(\w+)`? \(([\s\S]*?)\)\s*ENGINE[^;]*;/gi;
let createMatch;
let created = [];
while ((createMatch = createRe.exec(content)) !== null) {
    const table = createMatch[1];
    const def = createMatch[2];
    if (!TABLES.includes(table)) continue;

    const cols = [];
    for (const lineRaw of def.split('\n')) {
        const line = lineRaw.trim().replace(/,\s*$/, '');
        if (!line || /^PRIMARY KEY|^KEY |^UNIQUE KEY |^CONSTRAINT |^FULLTEXT/.test(line)) continue;
        const m = line.match(/^`?(\w+)`?\s+([^ ]+)/);
        if (!m) continue;
        const name = m[1];
        const type = m[2].toUpperCase();
        let sqliteType;
        if (/^(INT|TINYINT|SMALLINT|MEDIUMINT|BIGINT)/.test(type)) sqliteType = 'INTEGER';
        else if (/^(VARCHAR|CHAR|TEXT|DATETIME|TIMESTAMP|DATE|TIME|BLOB|ENUM)/.test(type)) sqliteType = 'TEXT';
        else sqliteType = 'TEXT';

        const notNull = /NOT NULL/.test(line) ? ' NOT NULL' : '';
        const dflt = /DEFAULT\s+'([^']*)'/.exec(line) || /DEFAULT\s+(\d+)/.exec(line) || /DEFAULT\s+NULL/.exec(line);
        let defClause = '';
        if (dflt && /DEFAULT CURRENT_TIMESTAMP/.test(line) === false) {
            const dv = dflt[1] === 'NULL' ? 'NULL' : `'${dflt[1]}'`;
            defClause = ` DEFAULT ${dv}`;
        }
        const autoInc = /AUTO_INCREMENT/.test(line);
        let colDef = `  \`${name}\` ${sqliteType}`;
        if (autoInc) {
            colDef += ' PRIMARY KEY AUTOINCREMENT';
        } else {
            colDef += `${defClause}${notNull}`;
        }
        cols.push(colDef);
    }
    if (!cols.some(c => c.includes('PRIMARY KEY AUTOINCREMENT'))) {
        cols.push('  `id` INTEGER PRIMARY KEY AUTOINCREMENT');
    }
    db.exec(`CREATE TABLE ${table} (${cols.join(',\n')})`);
    created.push(table);
    console.log('created table', table);
}

const insertRe = /INSERT INTO `?(\w+)`?\s*VALUES\s*(\([^;]*?\));/gi;
let insertMatch;
const insertCounts = {};
while ((insertMatch = insertRe.exec(content)) !== null) {
    const table = insertMatch[1];
    if (!TABLES.includes(table)) continue;
    const rowsRaw = insertMatch[2];
    const rows = parseRows(rowsRaw);
    insertCounts[table] = (insertCounts[table] || 0) + rows.length;

    const stmt = db.prepare(`INSERT INTO ${table} VALUES (${rows[0].map(() => '?').join(',')})`);
    const tx = db.transaction((items) => {
        for (const r of items) stmt.run(...r);
    });
    tx(rows);
}

function parseRows(raw) {
    const rows = [];
    let i = 0;
    const n = raw.length;
    while (i < n) {
        while (i < n && (raw[i] === ' ' || raw[i] === '\n' || raw[i] === ',')) i++;
        if (i >= n || raw[i] !== '(') break;
        let depth = 0;
        let j = i;
        let inStr = false;
        let quote = '';
        while (j < n) {
            const c = raw[j];
            if (inStr) {
                if (c === '\\') { j += 2; continue; }
                if (c === quote) {
                    if (raw[j + 1] === quote) { j += 2; continue; }
                    inStr = false;
                }
            } else {
                if (c === "'" || c === '"') { inStr = true; quote = c; }
                else if (c === '(') depth++;
                else if (c === ')') { depth--; if (depth === 0) { j++; break; } }
            }
            j++;
        }
        const rowStr = raw.slice(i + 1, j - 1);
        rows.push(parseRow(rowStr));
        i = j;
    }
    return rows;
}

function parseRow(rowStr) {
    const vals = [];
    let i = 0;
    const n = rowStr.length;
    while (i < n) {
        while (i < n && rowStr[i] === ' ') i++;
        if (i >= n) break;
        if (rowStr[i] === "'" || rowStr[i] === '"') {
            const q = rowStr[i];
            let s = '';
            i++;
            while (i < n) {
                if (rowStr[i] === '\\' && i + 1 < n) { s += rowStr[i + 1]; i += 2; continue; }
                if (rowStr[i] === q) {
                    if (rowStr[i + 1] === q) { s += q; i += 2; continue; }
                    i++;
                    break;
                }
                s += rowStr[i];
                i++;
            }
            vals.push(s);
        } else if (rowStr[i] === '(' || rowStr[i] === ')') {
            i++;
        } else {
            let s = '';
            while (i < n && rowStr[i] !== ',' && rowStr[i] !== ' ') { s += rowStr[i]; i++; }
            if (s === 'NULL') vals.push(null);
            else vals.push(s);
        }
        while (i < n && (rowStr[i] === ',' || rowStr[i] === ' ')) i++;
    }
    return vals;
}

console.log('Table counts:', JSON.stringify(insertCounts, null, 2));

for (const t of TABLES) {
    const { c } = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get();
    if (!insertCounts[t] && c === 0) console.log('WARN: empty table', t);
}

db.close();
console.log('Migration done ->', DB_PATH);