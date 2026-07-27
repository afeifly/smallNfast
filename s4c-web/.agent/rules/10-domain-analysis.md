# 10-domain-analysis.md - Domain Analysis Guidelines

This rule document defines the Bounded Contexts, Core Domain Abstractions, and Transactional Invariants that govern the `s4c-web` application. Any new feature, refactoring, or bug fix must respect these boundaries.

---

## 1. Bounded Contexts

The `s4c-web` application contains four primary Bounded Contexts with distinct performance, concurrency, and threading profiles:

### 1.1 Interactive UI / CRUD Configuration Context (UI Context)
* **Responsibility**: Rendering visual editors for system parameters, alarm views, communication settings, screen layouts, sensor channels, graphic layout tab management, holding register mapping, and support pages.
* **Execution Boundary**: Runs synchronously in the main browser thread.
* **State Management**:
  - Main configuration list metadata is managed via the React Context [ConfigContext.jsx](file:///Users/ex/project/smallNfast/s4c-web/src/context/ConfigContext.jsx) and persisted in `localStorage` under the key `s4c_config_manager_state`.
* **Design Standards & Aesthetics**:
  - Must use standard CSS variables.
  - Active configuration rows must highlight dynamically with the `.active-row` style: background `#F0FBF9`, border `#B2E5D9`.
  - UI must remain highly responsive (targeting 60 FPS). Heavy calculations must not run synchronously in this context.

### 1.2 Config Package Serialization & Cryptography Context (Processing Context)
* **Responsibility**: Encryption/decryption, ZIP processing, SQLite queries, IndexedDB interactions, cryptographic integrity verification, and device remarshaling (`remarshalAll`).
* **Execution Boundary**: Offloaded asynchronously via Promise wrappers, Web Workers, and WebAssembly to prevent locking the main thread.
* **Core Mechanisms**:
  - **ZIP Packaging**: Packages use the `.cfgf` extension. Compressed and decompressed using `@zip.js/zip.js` workers.
  - **Encryption**: Traditional ZIP encryption (ZipCrypto) using the fixed password `SUTOXZCONFIG`.
  - **Metadata Serialization**: Parsed/dumped in YAML format (`summary.yml`) using `js-yaml`.
  - **SQLite Database**: Executed client-side using `sql.js` (SQLite compiled to WebAssembly), loading `public/sql-wasm.wasm` at runtime.
  - **Storage**: Raw files map is stored in IndexedDB via [fileMapStorage.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/fileMapStorage.js) (store name: `filemaps`, DB name: `s4c_config_db_v2`).

### 1.3 OEM Multi-Tenant Branding Context
* **Responsibility**: Dynamic visual theming and navigation page visibility control.
* **Driven by Environment Profiles**: `.env` (default SUTO palette `#FFE000` / `#00AB84`) vs `.env.atlascopco` (Atlas Copco teal-blue `#1A7BA4`, custom logo, pill buttons `50px`).
* **Provider**: `ThemeContext.jsx` injects CSS custom properties on `document.documentElement`.
* **Feature Flags**: Evaluates `VITE_OEM_HIDE_FILE_VERIFICATION`, `VITE_OEM_HIDE_DATA_ANALYSIS`, and `VITE_OEM_HIDE_SUPPORT` to dynamically toggle sidebar navigation items.

### 1.4 Internationalization & Localization Context (i18n)
* **Responsibility**: Multi-language translation management via `react-i18next`.
* **Supported Locales**: English (`en.json`), Simplified Chinese (`cn.json`), German (`de.json`).
* **Persistence**: Synchronizes active language into `system/system_info.json` within `.cfgf` packages on export.

---

## 2. Core Domain Abstractions

### 2.1 ConfigPackage (Aggregate Root)
* **Identity**: Represents a complete device configuration package container loaded into the browser memory.
* **Attributes**: `id`, `fileName`, `fileSize`, `importTime`, `summary`, `configs`, `fileMap`.
* **Ownership**: Encapsulates all files and changes. Coordinates persisting updates to IndexedDB and running `remarshalAll()` prior to export.

### 2.2 SensorChannel & OptionBoardChannel (Entities)
* **Identity**: Defined inside `config/SUTO-SensorList.sutolist` and `config/cfgOptionBoard.json`.
* **Option Board Attributes**: Terminals X9–X16, signal types (Analog: 0-20mA, 4-20mA, 0.5-4.5V, 0-10V; Digital: Counter, Runtime, Status), unit types (Dew point, Pressure, Flow, etc.), resolution scales (-6 to +3), and relative channel mode.
* **Domain Rules**: Must map to a valid physical configuration port, Modbus register address, or mathematical virtual formula. A channel cannot be deleted if referenced in `Alarm.db`.

### 2.3 AlarmRule (Entity)
* **Identity**: Managed inside the `Alarm.db` SQLite database. Represented by rows in the `alarm_config` table.
* **Attributes**: `config_id`, `sensor_identify_id`, `channel_identify_id`, `threshold`, `direction` (0 = Above/UP, 1 = Below/DOWN), `hysteresis`, `delay`, `relay_id`, `relay_flag`.
* **Domain Rules**: Database updates must be executed using helper patterns in [alarmDbUtils.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/alarmDbUtils.js).

### 2.4 HoldingRegisterMap & GraphicConfig (Value Objects)
* **HoldingRegisterMap**: Maps physical channels to Modbus holding register addresses. Exportable to `.xlsx` spreadsheets via `HoldingRegister.jsx`.
* **GraphicConfig**: Controls multi-chart graphics representation (`cfgGraphic.json`).

---

## 3. Transactional Boundaries & Invariants

All modifications to configuration files or SQLite tables must enforce the following business invariants:

1. **Device Remarshaling & Firmware Synchronization Invariants (`remarshalAll`)**:
   - Every channel in `SUTO-SensorList.sutolist` and `cfgOptionBoard.json` must have `"Logger": true/false` synchronized with `cfglogger.json::channelArray`.
   - `starttime` in `cfglogger.json` must be stored as a 10-digit Unix timestamp in seconds (not 13-digit milliseconds).
   - Channel objects must have `"EnableAlarm": true/false`, `Direction`, thresholds, hysteresis, and `RelayIndex` synchronized with active rules in `Alarm.db`.
2. **Sensor Channel Deletion Restriction**:
   - Cannot delete a channel from the sensor list if an active alarm rule in `Alarm.db` references its identity (`channel_identify_id` / `CreateTime`).
3. **Defensive Config Patching**:
   - Legacy imported `.cfgf` packages lacking certain fields must be populated with safe fallbacks during load to prevent runtime exceptions.
4. **IndexedDB Isolation**:
   - Binary content maps (`fileMap`) must be stored under keys matching `ConfigPackage.id` in `filemaps` store of `s4c_config_db_v2`.
5. **Checksum Package Signature**:
   - The checksum in `summary.yml` is an absolute signature computed from alphabetically sorted ZIP file MD5 hashes using `SparkMD5`. If signature validation fails on import, package loading must be rejected.
