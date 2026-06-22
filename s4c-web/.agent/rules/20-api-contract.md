# 20-api-contract.md - API Contract and Serialization Standards

This document establishes standard naming conventions, serialization protocols, schema definitions, and contract integrity rules for all configuration files, database tables, and API interfaces within `s4c-web`.

---

## 1. Strict Warning Header

Every contract, parser interface, database schema utility, or schema description file must start with the following warning comment block exactly:

```javascript
/**
 * WARNING: STRICT API / CONFIGURATION CONTRACT
 * This file defines or manipulates the binary/schema format of the SUTO .cfgf configuration packages.
 * Any change to naming conventions, key casing, password encryption, hashing algorithms, or database
 * schemas MUST be thoroughly tested. Mismatches will corrupt or reject configuration files on SUTO devices.
 */
```

For YAML files (such as schema templates), use the standard comment equivalent:

```yaml
# WARNING: STRICT API / CONFIGURATION CONTRACT
# This file defines or manipulates the binary/schema format of the SUTO .cfgf configuration packages.
# Any change to naming conventions, key casing, password encryption, hashing algorithms, or database
# schemas MUST be thoroughly tested. Mismatches will corrupt or reject configuration files on SUTO devices.
```

---

## 2. Naming & Case Conventions

To prevent data corruption on SUTO physical devices, case matching must be strictly maintained:

1. **Configuration JSON Files**: All keys in JSON documents under `config/` and `system/` directories must use `camelCase` (e.g. `isRelayPermanentOff`, `baudRate`, `serviceAddress`).
2. **Database Schema (Alarm.db)**: All SQLite tables, column names, and indices must use `snake_case` (e.g. `alarm_config`, `sensor_identify_id`, `is_relay_permanent_off`).
3. **YAML Metadata (summary.yml)**: Standard keys must use title case or specific hyphenated casing (e.g. `Config-Version`, `Config-Date`, `Device-Type`, `Description`, `hash`).

---

## 3. Serialization Protocols

All configuration management workflows must adhere to these protocol standards:

* **ZIP Cryptography**: Packages are compressed into encrypted ZIP archives with standard ZipCrypto encryption using password `SUTOXZCONFIG`. Compressed streams are processed using `@zip.js/zip.js` workers.
* **YAML Metadata**: `summary.yml` represents the manifest entry for the configuration package. It must be read and written using `js-yaml` serialization tools.
* **JSON Files**: JSON configuration files must be formatted with 2-space indentation when written back into the ZIP file system.
* **SQLite WASM**: The database `Alarm.db` is stored as raw binary bytes within the ZIP container. It is loaded in memory via WebAssembly `sql.js`.

---

## 4. Payload Schemas

### 4.1 summary.yml Manifest Schema
```yaml
Config-Version: "1.0.0"          # Package version string
Config-Date: "2026-06-22T15:15:00.000Z" # Generation ISO timestamp
Device-Type: "SUTO S401"        # Target physical device profile
Description: "Production configuration setup"
hash: "a1b2c3d4e5f67890abcdef1234567890" # Two-level MD5 payload signature
files:                          # List of files packed inside the container
  - path: "config/SUTO-SensorList.sutolist"
    version: 1
  - path: "config/Alarm.db"
    version: 1
```

### 4.2 SQLite Alarm.db Schema
The database contains three main tables defined below:

#### alarm_config Table
```sql
CREATE TABLE alarm_config (
  config_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  sensor_identify_id TEXT NOT NULL,
  channel_identify_id TEXT NOT NULL,
  measurement_point TEXT NOT NULL,
  location TEXT NOT NULL,
  threshold REAL NOT NULL,
  hysteresis REAL NOT NULL,
  direction TEXT NOT NULL, -- "up" or "down"
  delay INTEGER DEFAULT 0 NULL,
  relay_id INTEGER DEFAULT 0 NULL,
  relay_flag INTEGER DEFAULT 1 NULL,
  relay_address INTEGER DEFAULT 0 NULL,
  relay_ch_id INTEGER DEFAULT 0 NULL,
  is_relay_permanent_off INTEGER DEFAULT 0 NULL, -- 0 = active, 1 = disabled
  is_deleted INTEGER DEFAULT 0 NULL, -- 0 = active, 1 = deleted
  update_time TEXT NULL -- "YYYY-MM-DD HH:MM:SS" format
);
```

#### sensor Table
```sql
CREATE TABLE sensor (
  sensor_id INTEGER NOT NULL,
  sensor_desc TEXT NOT NULL,
  sensor_identify_id TEXT PRIMARY KEY NOT NULL,
  create_time TEXT NULL
);
```

#### channel Table
```sql
CREATE TABLE channel (
  channel_id INTEGER NULL,
  channel_identify_id TEXT PRIMARY KEY NOT NULL,
  sensor_identify_id TEXT NOT NULL,
  channel_desc TEXT NOT NULL,
  channel_unit TEXT NOT NULL,
  create_time TEXT NULL
);
```
