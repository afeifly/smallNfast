# GEMINI.md - Project Rules & Context (s4c-web)

Welcome to the `s4c-web` repository. This document serves as the single source of truth for engineering alignment, codebase patterns, and design constraints. AI agents and developers must adhere strictly to these guidelines.

---

## 1. Technical Stack & Core Libraries

- **Core Framework**: React (v18+) with Vite (v5+) as the build tool and development server.
- **Routing**: React Router DOM (v7+) for client-side page routing.
- **State Management**:
  - React Context (`ConfigContext.jsx`) manages the loaded configuration metadata state.
  - Metadata is persisted in `localStorage` (`s4c_config_manager_state`).
  - Large binary/text files within configuration packages (ZIP files, databases) are stored in IndexedDB via `src/util/fileMapStorage.js` (to bypass the 5MB size limit of localStorage).
- **Styling**: Vanilla CSS. Styling parameters, color tokens, and custom designs are specified in standard `.css` files mapped to pages and components.
- **Configuration Cryptography & Packaging**:
  - **ZIP Packaging**: Packages use the `.cfgf` extension and are compressed/decompressed using `@zip.js/zip.js`.
  - **Encryption**: Packages are encrypted with a standard password: `SUTOXZCONFIG`.
  - **YAML Serialization**: `summary.yml` stores metadata and is parsed/dumped using `js-yaml`.
  - **Integrity Validation**: Checksums are validated using `spark-md5`. The algorithm calculates the MD5 of individual files in alphabetical order of their ZIP paths, concatenates the resulting MD5 hex strings, and hashes the composite string to produce a final package checksum.
- **Database Engine**: Client-side SQLite via WebAssembly (`sql.js`). The runtime loads `public/sql-wasm.wasm` to perform in-browser query execution, database schema generation, and updates on the `Alarm.db` database.

---

## 2. Directory Layout & Architecture

```
s4c-web/
├── .agent/              # AI Agent guidelines and workflow skills
├── dist/                # Production build output
├── docs/                # Product requirements, tech specifications, and sample files
├── public/              # Static assets, including the sql-wasm.wasm bundle
├── src/
│   ├── assets/          # Icons, images, and styles
│   ├── components/      # Common UI components (Layout, CustomDialog, etc.)
│   ├── context/         # ConfigContext (configuration state and persistence)
│   ├── pages/           # Pages grouped by domain (Alarm, ConfigManager, LoggerSettings)
│   │   ├── communication/       # ModbusRTU / ModbusTCP / HoldingRegister configs
│   │   ├── sensorconfiguration/ # SUTO, Third-party, Analog/Digital, and Layout configs
│   │   └── system/              # System settings and Support page
│   ├── sensordata/      # Pre-defined SUTO sensor channel specs (.sutoch)
│   ├── util/            # Helpers for config package zip/unzip, hashing, DB operations
│   └── main.jsx         # App entry point
└── package.json         # Dependencies and scripts
```

---

## 3. Design Aesthetics & Styling Guidelines

- **Vanilla CSS**: Standardized class names and properties are preferred. Use existing styles found in matching page folders (e.g. `SUTOSensor.css`, `Graphic.css`).
- **Interactive Micro-animations**: Focus on premium interactions for buttons, hover transitions, and table actions.
- **Tables and Lists**: Rows corresponding to the currently active loaded config must highlight dynamically (e.g., using `.active-row` styled with `#F0FBF9` background and `#B2E5D9` border colors).

---

## 4. Operational Guidelines for AI Agents

- **No Placeholders**: All code written must be complete and production-ready.
- **Database Interactions**: Modifying sqlite configurations or schema inside `Alarm.db` must be executed using `sql.js` helpers in `src/util/alarmDbUtils.js`.
- **Port Allocation**: In production, the application is deployed under PM2 on port `9017` using `npx serve -s dist`. Make sure this is respected in deployment setups.
- **Test Integrity**: Unit tests run using `vitest`. Tests should be kept up to date in `src/test/` or alongside utility/component files as `*.test.js` or `*.test.jsx`.
