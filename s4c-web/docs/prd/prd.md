# Product Requirements Document (PRD) - s4c-web Configuration Utility

## 1. Executive Summary & Core Goals

The `s4c-web` application is a client-side configuration management utility for SUTO devices. It runs entirely within the web browser (utilizing LocalStorage, IndexedDB, WebAssembly SQL.js, and client-side cryptography) to allow users to standardize, inspect, edit, create, and verify device configuration packages (`.cfgf`).

The core objectives are:
- Provide an interface to list, load, edit, delete, create, verify, and export device configuration files.
- Enforce package integrity through verification of two-level MD5 checksum hashes and password-protected container unpacking/packing.
- Support multi-tenant OEM white-label branding (e.g. SUTO original vs. Atlas Copco customization) driven by environment variables and feature flags.
- Provide domain interfaces to customize settings including Alarms, RS485 communication, Modbus RTU/TCP master/slave protocols, Holding Register maps (with XLSX export), screen layouts, Option Board channel mapping, sensor channels, virtual formulas, data logger parameters, data graphics, and system support.

---

## Modular Domain PRD Documents
For detailed sub-system product requirements, refer to the individual PRD documents:
- 🎨 [OEM Multi-Tenant Branding PRD](file:///Users/ex/project/smallNfast/s4c-web/docs/prd/oem_theming_prd.md)
- 🌐 [Multi-Language (i18n) Subsystem PRD](file:///Users/ex/project/smallNfast/s4c-web/docs/prd/i18n_localization_prd.md)
- 🔄 [Device Remarshaling & Firmware Sync PRD](file:///Users/ex/project/smallNfast/s4c-web/docs/prd/device_remarshal_sync_prd.md)
- 🔌 [Option Board (Analog/Digital Input) PRD](file:///Users/ex/project/smallNfast/s4c-web/docs/prd/option_board_prd.md)
- 📊 [Holding Register Map & XLSX Export PRD](file:///Users/ex/project/smallNfast/s4c-web/docs/prd/holding_register_xlsx_prd.md)
- 🛡️ [File Verification Page PRD](file:///Users/ex/project/smallNfast/s4c-web/docs/prd/file_verification_prd.md)
- 🩹 [Defensive Config Migration & Patching PRD](file:///Users/ex/project/smallNfast/s4c-web/docs/prd/defensive_config_patching_prd.md)
- 🚫 [Alarm Channel Delete Restriction PRD](file:///Users/ex/project/smallNfast/s4c-web/docs/prd/alarm_delete_restriction_prd.md)
- 📈 [Graphic Data Visualization PRD](file:///Users/ex/project/smallNfast/s4c-web/docs/prd/graphic_visualization_prd.md)
- 🧪 [Automated Testing & CI/CD Pipeline PRD](file:///Users/ex/project/smallNfast/s4c-web/docs/prd/ci_cd_testing_prd.md)

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
  - `SUTO-SensorList.sutolist` (Lists active sensors, channel attributes, logging parameters `"Logger": true/false`, and alarm synchronization flags `"EnableAlarm"`).
  - `cfgLocation.json` (Location and placement mappings).
  - `cfgOptionBoard.json` (Option board setup details, terminal assignments X9–X16, signal types, unit types, and resolution scales).
  - `cfgLayout.json` (Screen layout configurations).
  - `cfgGraphic.json` (Graphics/Chart representation configurations, chart lists, channel assignments).
  - `cfglogger.json` (Data logging sample rate, 10-digit Unix starttime timestamp in seconds, channelArray).
  - `Alarm.db` (SQLite database containing alarm thresholds, relay channels, limits, hysteresis, and delay settings).
- `system/`
  - `backlight.json` (LCD backlight timeout, brightness, lock settings).
  - `cfgcommunicatport.json` (RS485 baud rates, parity, address details, and Modbus TCP protocols).
  - `system_info.json` (System language, service company metadata - address, website, email, telephone).

---

## 3. Core Features & Functional Requirements

### 3.1 Package Operations (Import, Create, Export, Delete, Verification)
- **Import Configuration**:
  - Drag-and-drop or file selector accepting `.cfgf` files.
  - Client-side extraction via `@zip.js/zip.js` with password `SUTOXZCONFIG` (see [configFileUtils.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/configFileUtils.js)).
  - Parse `summary.yml` via `js-yaml`.
  - Validate package integrity via MD5 checksum comparison.
  - Apply **Defensive Config Patching**: If an imported package lacks certain properties or sections from older versions, safe fallbacks are automatically populated to maintain backward compatibility (see [cfgf_compare.test.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/cfgf_compare.test.js)).
  - Store extracted JSON structure in memory/state and store the binary payload in IndexedDB (see [fileMapStorage.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/fileMapStorage.js)).
- **Create New Configuration**:
  - Instantiates a baseline default configuration package structure.
  - Generates a fresh, empty SQLite `Alarm.db` file structure.
  - Populates default settings for communication ports, system info, backlight options, layout lists, graphic configurations, and sensor lists.
- **Export Configuration & Device Remarshaling**:
  - Automatically runs `remarshalAll()` (see [remarshalUtils.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/remarshalUtils.js)) prior to export:
    1. **Logger Synchronization**: Updates `"Logger": true/false` on all channel objects in `SUTO-SensorList.sutolist` and `cfgOptionBoard.json` matching `cfglogger.json`. Converts `starttime` to a 10-digit Unix timestamp in seconds (preventing C firmware overflow).
    2. **Alarm Synchronization**: Updates `"EnableAlarm": true/false`, `Direction` (`0` for UP/Above, `1` for DOWN/Below), `MaxThreshold`/`MinThreshold`, `MaxHysteresis`/`MinHysteresis`, and `RelayIndex` on channel objects based on active `Alarm.db` rules.
  - Repackages and computes the two-level MD5 payload checksum.
  - Writes metadata and hash into a newly formatted `summary.yml` file.
  - Packages and encrypts the files into a ZIP blob, downloading it locally as a `.cfgf` file.
- **File Verification Page**:
  - Standalone verification interface (`FileVerification.jsx`) enabling users to execute explicit checksum validation and inspect file-by-file MD5 verification results.
- **Delete Configuration**:
  - Removes configuration metadata from application state and local storage.
  - Clears corresponding binary file mapping from IndexedDB.

### 3.2 Integrity Validation (Two-Level MD5)
To ensure the payload is authentic and uncorrupted:
1. Extract all payload paths within the ZIP package (excluding `summary.yml` and files marked with `parser.`).
2. Sort the file paths alphabetically.
3. Compute the MD5 hash (hex string) for each file's binary content using `SparkMD5`.
4. Append each file's MD5 string in the sorted order.
5. Compute the final MD5 of the concatenated string to yield the package signature.

### 3.3 Configuration Editors & Domain Modules
- **Sensors Configuration & Deletion Restriction**:
  - **SUTO Sensors**: Configure pre-defined SUTO sensors (via `.sutoch` files in `/src/sensordata/`).
  - **3rd-Party Sensors**: Add and edit custom third-party sensor parameters.
  - **Option Board (Analog/Digital Inputs)**:
    - Support terminal mappings: X9, X10, X11, X12, X13, X14, X15, X16.
    - Signal Types: Analog (`0...20mA`, `4...20mA`, `0.5...4.5V`, `0...10V`) vs Digital (`Counter`, `Runtime`, `Status`).
    - Unit Taxonomies: Custom, Dew point, Humidity, Temperature, Pressure, Velocity, Concentration, Flow, Volume, Mass, Voltage, Power, Energy.
    - Resolution Scale: Range from `0.000001` (-6) to `1000` (+3).
    - Relative Channel Mode: Terminal limits grayed out when operating in relative mode.
  - **Virtual Channels**: Define mathematical formulas, parameters, and input channel dependencies via `FormulaEditorModal.jsx`.
  - **Layout Setting**: Customize screen layouts, display pages, and sensor ordering.
  - **Delete Restriction Invariant**: A sensor channel cannot be deleted if an active alarm rule in `Alarm.db` references its identity (`channel_identify_id` / `CreateTime`). The UI displays a "Delete Restricted" warning modal (`2ebf780`).
- **Communication Protocols & Holding Register Export**:
  - Edit RS485 settings for master/slave mode (baud rate, parity, response timeout, address).
  - Configure Modbus TCP connection settings.
  - **Holding Register Mapping**: Configure register offset maps (`HoldingRegister.jsx`) and export maps to Excel spreadsheets (`.xlsx`) via `xlsx` library (`90217fc`).
- **Alarm Management**:
  - Edit alarm rules, thresholds, and limits (Above/UP vs Below/DOWN).
  - Select active channels, hysteresis settings, relay board channel actions, and delays.
  - Persistence: SQLite queries executed client-side on the loaded `Alarm.db` database using `sql.js` (see [alarmDbUtils.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/alarmDbUtils.js)).
  - Automatic synchronization of `"EnableAlarm"` and thresholds to sensor list JSON files via `remarshalAll()`.
- **Graphic Data Visualization**:
  - Configure chart representation (`Graphic.jsx`) controlled by `cfgGraphic.json`.
  - Add, edit, reorder, and remove multi-channel graphics view tabs.
- **System & Support**:
  - Backlight brightness (min/max) and screen auto-lock timeout.
  - System language configuration.
  - Service company metadata (name, address, telephone, email, website) stored in `system_info.json`.

---

## 4. Multi-Tenant OEM Architecture & Internationalization (i18n)

### 4.1 OEM Multi-Tenant Theming & Branding
The application supports white-label OEM customization via build environment files (`.env`, `.env.atlascopco`):
- **Theme Provider**: `ThemeContext.jsx` injects CSS custom variables onto `document.documentElement` dynamically (`--primary-color`, `--accent-color`, `--sidebar-bg`, `--nav-active-bg`, `--btn-radius`, etc.).
- **OEM Profiles**:
  - **SUTO Default**: Standard yellow/emerald palette (`#FFE000` / `#00AB84`), square/rounded buttons (`4px`).
  - **Atlas Copco Profile**: Teal-blue palette (`#1A7BA4`), customized logo, pill buttons (`50px`).
- **Feature Flags**: Environment flags dynamically toggle navigation items in `Sidebar.jsx`:
  - `VITE_OEM_HIDE_FILE_VERIFICATION`: Hides File Verification page when set to `true`.
  - `VITE_OEM_HIDE_DATA_ANALYSIS`: Hides Data Analysis page when set to `true`.
  - `VITE_OEM_HIDE_SUPPORT`: Hides Support page when set to `true`.

### 4.2 Multi-Language Subsystem (i18n)
- **Engine**: Powered by `i18next` and `react-i18next`.
- **Locales**: Standardized across English (`en.json`), Simplified Chinese (`cn.json`), and German (`de.json`).
- **Persisted State**: Language preference is synchronized into `system_info.json` within the config package upon export.
- **Domain Terminology Alignment**:
  - Direction: `"Trigger Direction"` / `"触发方向"` / `"Triggerrich"`
  - UP: `"Above"` / `"高于"` / `"Höher"`
  - Down: `"Below"` / `"低于"` / `"Niedriger"`
  - Relay Active: `"Pending"` / `"抑制"` / `"Ausstehend"`

---

## 5. Non-Functional & Storage Requirements

### 5.1 Interface & Performance
- **Active Row Highlighting**: Configuration table active rows highlight dynamically (`#F0FBF9` background, `#B2E5D9` border).
- **60 FPS Responsiveness**: Heavy processing (ZIP decryption, MD5 hash calculation, SQLite WASM compilation) is executed asynchronously to prevent thread blocking.

### 5.2 Storage Strategy
- `.cfgf` metadata stored in `localStorage` (`s4c_config_manager_state`).
- Large binary maps stored in IndexedDB (`s4c_config_db_v2`, store `filemaps`) to bypass 5MB browser localStorage limits.

---

## 6. Automated Testing & Quality Assurance

- **Test Framework**: `vitest` with `jsdom` environment.
- **CI/CD Pipeline**: GitHub Actions workflow (`.github/workflows/ci.yml`) automatically executes `npm test` on all pushes and pull requests under Node 22 with `--pool=forks`.
- **Test Coverage Requirements**: Unit test suites cover critical utilities ([configFileUtils.test.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/configFileUtils.test.js), [alarmDbUtils.test.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/alarmDbUtils.test.js), [remarshalUtils.test.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/remarshalUtils.test.js), [cfgf_compare.test.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/cfgf_compare.test.js)) and UI page components.
