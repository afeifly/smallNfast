# 10-domain-analysis.md - Domain Analysis Guidelines

This rule document defines the Bounded Contexts, Core Domain Abstractions, and Transactional Invariants that govern the `s4c-web` application. Any new feature, refactoring, or bug fix must respect these boundaries.

---

## 1. Bounded Contexts

The `s4c-web` application contains two primary Bounded Contexts with distinct performance, concurrency, and threading profiles:

### 1.1 Interactive UI / CRUD Configuration Context (UI Context)
* **Responsibility**: Rendering visual editors for system parameters, alarm views, communication settings, screen layouts, sensor channels, and support pages.
* **Execution Boundary**: Runs synchronously in the main browser thread.
* **State Management**:
  - Main configuration list metadata is managed via the React Context [ConfigContext.jsx](file:///Users/ex/project/smallNfast/s4c-web/src/context/ConfigContext.jsx) and persisted in `localStorage` under the key `s4c_config_manager_state`.
* **Design Standards & Aesthetics**:
  - Must use standard CSS variables.
  - Active configuration rows must highlight dynamically with the `.active-row` style: background `#F0FBF9`, border `#B2E5D9`.
  - UI must remain highly responsive (targeting 60 FPS). Heavy calculations must not run synchronously in this context.

### 1.2 Config Package Serialization & Cryptography Context (Processing Context)
* **Responsibility**: Encryption/decryption, ZIP processing, SQLite queries, IndexedDB interactions, and cryptographic integrity verification.
* **Execution Boundary**: Offloaded asynchronously via Promise wrappers, Web Workers, and WebAssembly to prevent locking the main thread.
* **Core Mechanisms**:
  - **ZIP Packaging**: Packages use the `.cfgf` extension. Compressed and decompressed using `@zip.js/zip.js` workers.
  - **Encryption**: Traditional ZIP encryption (ZipCrypto) using the fixed password `SUTOXZCONFIG`.
  - **Metadata Serialization**: Parsed/dumped in YAML format (`summary.yml`) using `js-yaml`.
  - **SQLite Database**: Executed client-side using `sql.js` (SQLite compiled to WebAssembly), loading `public/sql-wasm.wasm` at runtime.
  - **Storage**: Raw files map is stored in IndexedDB via [fileMapStorage.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/fileMapStorage.js) (store name: `filemaps`, DB name: `s4c_config_db_v2`).

---

## 2. Core Domain Abstractions

### 2.1 ConfigPackage (Aggregate Root)
* **Identity**: Represents a complete device configuration package container loaded into the browser memory.
* **Attributes**:
  - `id` (string): Generated unique package ID (`cfg-[timestamp]`).
  - `fileName` (string): User-facing imported package name.
  - `fileSize` (string): Calculated readable size.
  - `importTime` (string): Timestamp of when the package was loaded.
  - `summary` (object): Parsed YAML attributes containing metadata like device type, description, and hash checksum.
  - `configs` (object): Key-value store of JSON configuration files (e.g., `cfglogger.json`, `cfgLayout.json`).
  - `fileMap` (Map<string, Uint8Array>): In-memory map of file paths to raw binary buffer contents.
* **Ownership**: Encapsulates all files and changes. It coordinates persisting updates back to IndexedDB.

### 2.2 SensorChannel (Entity)
* **Identity**: Defined inside `config/SUTO-SensorList.sutolist`.
* **Attributes**: `id`, `name`, `type` (SUTO, Third Party, Virtual), `unit`, and `formula` (for virtual channels).
* **Domain Rules**: Must map to a valid physical configuration port, Modbus register address, or mathematical virtual formula.

### 2.3 AlarmRule (Entity)
* **Identity**: Managed inside the `Alarm.db` SQLite database. Represented by rows in the `alarm_config` table.
* **Attributes**: `config_id` (Primary Key), `sensor_identify_id`, `channel_identify_id`, `threshold`, `direction` (UP/DOWN), `hysteresis`, `delay`, `relay_id`, and `relay_flag`.
* **Domain Rules**: Queries and updates must be executed using transaction-safe helper patterns in [alarmDbUtils.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/alarmDbUtils.js).

### 2.4 ModbusSettings (Value Object)
* **Attributes**: RS485 communication port parameters including `baudrate`, `parityFrameIndex`, `responseTimeout`, and `address`. Immutable.
* **Domain Rules**: Defined inside `system/cfgcommunicatport.json`.

### 2.5 ServiceCompanyInfo (Value Object)
* **Attributes**: Support metadata including `companyName`, `address`, `telephone`, `email`, and `website`. Immutable.
* **Domain Rules**: Saved inside `system/system_info.json`.

---

## 3. Transactional Boundaries & Invariants

All modifications to configuration files or SQLite tables must enforce the following business invariants:

1. **IndexedDB Isolation**: Binary content maps (`fileMap`) must be stored under keys matching the `ConfigPackage` aggregate root ID to avoid cross-package data leakage.
2. **SQLite Integrity**: Modifying alarm rules requires initiating an in-memory SQL database transaction, applying changes, exporting the database back to a `Uint8Array`, and updating the `ConfigPackage.fileMap` under the original DB key path.
3. **Checksum Package Signature**: The checksum in `summary.yml` is an absolute signature. It is calculated by:
   - Filtering and sorting ZIP relative paths alphabetically (ignoring `summary.yml` and `parser.*` prefix files).
   - Fetching MD5 hash of each file's binary content using `SparkMD5`.
   - Concatenating all individual MD5 hex strings in alphabetical order.
   - Hashing the concatenated string to generate the final checksum.
   - If the calculated hash does not match `summary.hash` on import, loading must be rejected.
