const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DUMP_FILE = process.argv[2] || path.join(__dirname, '..', 'backup', 'cpms_backup.sql');
const config = require('../server/config/db.config.js');
const models = require('../server/models');

const STORAGE = config.storage || './cpms.sqlite';

if (!fs.existsSync(DUMP_FILE)) {
    console.error('Dump file not found:', DUMP_FILE);
    process.exit(1);
}

async function main() {
    await models.sequelize.sync();
    console.log('Model schema ensured (missing tables created)');

    const db = new Database(STORAGE);
    db.pragma('foreign_keys = OFF');

    const content = fs.readFileSync(DUMP_FILE, 'utf8');

    const createRe = /CREATE TABLE `?(\w+)`?\s*\(([\s\S]*?)\)\s*ENGINE[^;]*;/gi;
    const tableDefs = {};
    let m;
    while ((m = createRe.exec(content)) !== null) {
        tableDefs[m[1]] = parseCreate(m[1], m[2]);
    }

    for (const [table, def] of Object.entries(tableDefs)) {
        db.exec(`DROP TABLE IF EXISTS ${table}`);
        db.exec(def.sql);
        console.log('created table', table);
    }

    const insertRe = /INSERT INTO `?(\w+)`?\s*VALUES\s*(\([^;]*?\));/gi;
    const insertCounts = {};
    let im;
    while ((im = insertRe.exec(content)) !== null) {
        const table = im[1];
        const rows = parseRows(im[2]);
        const cols = tableDefs[table] && tableDefs[table].cols;
        if (!cols) continue;
        const placeholders = cols.map(() => '?').join(',');
        const stmt = db.prepare(`INSERT INTO ${table} (${cols.map(c => '`' + c + '`').join(',')}) VALUES (${placeholders})`);
        for (const r of rows) stmt.run(...padRow(r, cols.length));
        insertCounts[table] = (insertCounts[table] || 0) + rows.length;
        console.log('imported', rows.length, 'rows into', table);
    }

    for (const [table, def] of Object.entries(tableDefs)) {
        if (!def.autoIncrement) continue;
        const maxId = db.prepare(`SELECT MAX(id) AS m FROM ${table}`).get();
        if (maxId && maxId.m !== null && /^\d+$/.test(String(maxId.m))) {
            db.prepare('INSERT OR REPLACE INTO sqlite_sequence(name, seq) VALUES (?, ?)').run(table, Number(maxId.m));
        }
    }

    console.log('Table counts:', JSON.stringify(insertCounts));
    db.close();
    await models.sequelize.close();
    console.log('Migration done ->', path.resolve(STORAGE));
}

main().catch(e => { console.error('Migration failed:', e.message); process.exit(1); });

function parseCreate(tableName, def) {
    const colLines = [];
    const pkClause = [];
    for (const lineRaw of def.split('\n')) {
        const line = lineRaw.trim().replace(/,\s*$/, '');
        if (!line) continue;
        if (/^(PRIMARY KEY|UNIQUE KEY|KEY |CONSTRAINT |FULLTEXT|INDEX)/.test(line)) {
            const pk = /^PRIMARY KEY\s*\(([^)]*)\)/.exec(line);
            if (pk) pkClause.push(...pk[1].split(',').map(s => s.trim().replace(/`/g, '')));
            continue;
        }
        const cm = line.match(/^`?(\w+)`?\s+([^ ]+)/);
        if (!cm) continue;
        colLines.push({
            name: cm[1],
            type: cm[2].toUpperCase().replace(/\(.*\)/, ''),
            autoInc: /AUTO_INCREMENT/.test(line),
            line
        });
    }

    const cols = colLines.map(c => c.name);
    const autoIncCol = colLines.find(c => c.autoInc);

    let sql = `CREATE TABLE \`${tableName}\` (\n` + colLines.map(c => {
        if (c.autoInc && (pkClause.length === 0 || pkClause.includes(c.name))) {
            return '  `' + c.name + '` INTEGER PRIMARY KEY AUTOINCREMENT';
        }
        let t = '  `' + c.name + '` ' + sqliteType(c.type);
        if (/NOT NULL/.test(c.line)) t += ' NOT NULL';
        const dflt = /DEFAULT\s+'([^']*)'/.exec(c.line) || /DEFAULT\s+(\d+)/.exec(c.line) || /DEFAULT\s+NULL/.exec(c.line);
        if (dflt && !/DEFAULT CURRENT_TIMESTAMP/.test(c.line)) {
            t += ` DEFAULT ${dflt[1] === 'NULL' ? 'NULL' : `'${dflt[1]}'`}`;
        }
        return t;
    }).join(',\n');

    const pkNames = pkClause.length ? pkClause : (autoIncCol ? [autoIncCol.name] : []);
    if (pkNames.length && !(autoIncCol && pkNames.length === 1 && pkNames[0] === autoIncCol.name)) {
        sql += ',\n  PRIMARY KEY (' + pkNames.map(p => '`' + p + '`').join(', ') + ')';
    }
    sql += '\n)';

    return { sql, cols, autoIncrement: !!autoIncCol };
}

function sqliteType(mysqlType) {
    if (/^(INT|TINYINT|SMALLINT|MEDIUMINT|BIGINT)/.test(mysqlType)) return 'INTEGER';
    if (/^(DECIMAL|FLOAT|DOUBLE|REAL)/.test(mysqlType)) return 'REAL';
    return 'TEXT';
}

function padRow(row, n) {
    while (row.length < n) row.push(null);
    return row.slice(0, n);
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
        rows.push(parseRow(raw.slice(i + 1, j - 1)));
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