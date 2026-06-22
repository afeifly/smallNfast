# Product Requirements Document (PRD) - s4c-web Configuration Utility

## 1. Executive Summary & Core Goals

The `s4c-web` application is a client-side configuration management utility for SUTO devices. It is designed to run entirely within the web browser (utilizing LocalStorage, IndexedDB, WebAssembly SQL.js, and client-side cryptography) to allow users to standardise, inspect, edit, and create device configuration packages.

The core objectives are:
- Provide a simple interface to list, load, edit, delete, create, and export device configuration files.
- Ensure package integrity through verification of checksum hashes and password-protected container unpacking/packing.
- Provide domain interfaces to customize settings like alarms, RS485 communication, Modbus RTU/TCP master/slave protocols, screen layouts, sensor channels, and data analysis.

---

## 2. Configuration Package Specification (`.cfgf`)

The system works with encrypted `.cfgf` (Config File Format) packages. Under the hood, these are password-protected ZIP files.

### 2.1 Encryption & Password
- **Encryption Algorithm**: ZIP traditional encryption (ZipCrypto).
- **Password**: `SUTOXZCONFIG`

### 2.2 Package Structure
A valid `.cfgf` configuration package contains:
- `summary.yml` (Metadata: Config-Version, Config-Date, Device-Type, Description, hash checksum, path reflect mapping, and internal file versions).
- `config/`
  - `SUTO-SensorList.sutolist` (Lists active sensors, logging parameters, and alarm links).
  - `cfgLocation.json` (Location and placement mappings).
  - `cfgOptionBoard.json` (Option board setup details).
  - `cfgLayout.json` (Screen layout configurations).
  - `cfgGraphic.json` (Graphics/Chart representation configurations).
  - `cfglogger.json` (Data logging sample rate, parameters).
  - `Alarm.db` (SQLite database containing alarm thresholds, relay channels, limits, and hysteresis settings).
- `system/`
  - `backlight.json` (LCD backlight timeout, brightness, lock settings).
  - `cfgcommunicatport.json` (RS485 baud rates, parity, address details, and Modbus TCP protocols).
  - `system_info.json` (System language, service company metadata - address, website, email, telephone).

---

## 3. Core Features & Functional Requirements

### 3.1 Package Operations (Import, Create, Export)
- **Import Configuration**:
  - Drag-and-drop or file selector accepting `.cfgf` files.
  - Client-side extraction via `@zip.js/zip.js` with password `SUTOXZCONFIG` (see [configFileUtils.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/configFileUtils.js)).
  - Parse `summary.yml` via `js-yaml`.
  - Validate package integrity via MD5 checksum comparison.
  - Store extracted JSON structure in memory/state and store the binary payload in IndexedDB (see [fileMapStorage.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/fileMapStorage.js)).
- **Create New Configuration**:
  - Instantiates a baseline default configuration package structure.
  - Generates a fresh, empty SQLite `Alarm.db` file structure.
  - Populates default settings for communication ports, system info, backlight options, layout lists, and sensor lists.
- **Export Configuration**:
  - Compiles updated JSON configs from page editors.
  - Repackages and computes the two-level MD5 payload checksum.
  - Writes metadata and hash into a newly formatted `summary.yml` file.
  - Packages and encrypts the files into a ZIP blob, downloading it locally as a `.cfgf` file.
- **Delete Configuration**:
  - Removes configuration metadata from application state and local storage.
  - Clears corresponding binary file mapping from IndexedDB.

### 3.2 Integrity Validation (Two-Level MD5)
To ensure the payload is authentic and uncorrupted, a strict hash is calculated:
1. Extract all payload paths within the ZIP package (excluding `summary.yml` and files marked with `parser.`).
2. Sort the file paths alphabetically.
3. Compute the MD5 hash (hex string) for each file's binary content using `SparkMD5`.
4. Append each file's MD5 string in the sorted order.
5. Compute the final MD5 of the concatenated string to yield the package signature.

### 3.3 Configuration Editors
- **Sensors Configuration**:
  - Add, edit, or configure SUTO sensors (via pre-defined `.sutoch` files in `/src/sensordata/`) and third-party sensors.
  - Configure analog/digital inputs (current/voltage loops, channel names, units).
  - Configure virtual channels (virtual mathematical formulas, parameters, dependencies).
  - Customize screen layouts (sensor grids, display pages, ordering).
- **Communication Protocols**:
  - Edit RS485 settings for master/slave mode (baud rate, parity, response timeout, address).
  - Configure Modbus TCP connection settings.
  - Define Holding Register maps.
- **Alarm Management**:
  - Edit alarm rules, thresholds, and limits (low/high).
  - Select active channels, hysteresis settings, relay board channel actions, and delays.
  - Persistence: SQLite queries executed client-side on the loaded `Alarm.db` database using `sql.js` (see [alarmDbUtils.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/alarmDbUtils.js)).
- **System Settings**:
  - Backlight brightness (min/max) and screen auto-lock timeout.
  - System language configuration.
  - Service company name, address, telephone, email, and website.

---

## 4. UI/UX & Non-Functional Requirements

### 4.1 Interface Layout
- **Navigation Menu**: Layout wrapper sidebar linking to Home, Graphic, Logger, Config Manager, Sensors (SUTO, 3rd Party, Analog/Digital, Virtual, Layout), Communication (Modbus RTU Master/Slave, Modbus TCP, Holding Registers), Alarm, Analysis, and Support.
- **Config Table**: Config Manager view showing files, sizes, creation time, loading status, active indicator, and actions (Load, Export, Shift+Click to view raw JSON, Delete).
- **Active Highlight**: Dynamic background styling (`#F0FBF9`) indicating which config is currently active.

### 4.2 Storage and Browser Constraints
- Since `.cfgf` files contain sqlite databases and JSON documents, they must bypass the standard 5MB browser localStorage limits.
- Config listing metadata is stored in LocalStorage.
- Binary buffers of raw files inside config maps are loaded on startup from IndexedDB.
- Heavy cryptographical compression and hashing must run asynchronously to maintain 60fps UI responsiveness.
