# smallNfast

This repository contains a collection of small, fast utility projects and full-stack applications for specialized hardware interactions, data visualization, and configuration management.

## Projects

### 1. jsutousbIo (Java)
A **gRPC Server** that wraps native USB I/O functionality.
*   **Technology**: Java, Maven, gRPC, Protobuf.
*   **Purpose**: Exposes a USB device interface (using Thesycon `UsbIoJava` driver) over gRPC, allowing non-JVM applications to communicate with USB hardware.
*   **Location**: `jsutousbIo/`

### 2. SMSCat (Go)
A **Windows Desktop Application** for automated SMS alerts.
*   **Technology**: Go (Golang), Wails (for GUI), MySQL.
*   **Purpose**: Monitors a database for alarm triggers and sends SMS alerts via Quectel GSM Modems. Features auto-detection and a system tray interface.
*   **Location**: `SmsCat/`

### 3. Third-Party Lab Sensor Calibration Server
A **Full-stack solution** for managing sensor calibrations in a lab environment.
*   **Technology**: Node.js (Express, Prisma/SQLite) & Vue 3 (Vite, Pinia).
*   **Features**: Admin dashboard, company user management, device-bound passcodes, and complex sensor data ingestion.
*   **Location**: `thirdcali-server/`

### 4. Barcode Label Maker
A **Static Web Tool** to generate production-ready product labels.
*   **Technology**: Vue 3, Vite.
*   **Features**: CODE128 barcode generation, PDF export optimized for 100x60mm labels, and search-enabled product dropdowns.
*   **Location**: `acbarcode/`

### 5. SUTO Web Configurator (s4c-web)
A **Browser-Based Configuration Manager** for device settings.
*   **Technology**: React, Vite, sql.js, zip.js.
*   **Purpose**: Allows users to import, modify, and export device configuration files (`.cfgf`) directly in the browser with ZIP encryption and MD5 validation.
*   **Location**: `s4c-web/`

### 6. S4A Web (s4a-web)
A **Data Visualization & Analysis Web App** for sensor log files.
*   **Technology**: React, D3.js, Material UI, Vite.
*   **Features**:
    *   High-performance D3 Graphic View of history and realtime sensor log data.
    *   Memory-efficient Table View with chunk-based lazy loading, allowing browsing of large files (up to 10 GB+) with minimal RAM footprint.
    *   Timeline navigation slider, datetime picker, and column toggling.
    *   Pure-JavaScript CSD parser (replacing old Dart/Wasm bridge) for zero-configuration builds.
*   **Location**: `s4a-web/`

### 7. Flutter Graphic View Wrapper
A **Flutter Implementation** of the graphic visualization components.
*   **Technology**: Flutter/Dart.
*   **Purpose**: Provides a native mobile wrapper or port of the graphic view components for cross-platform use.
*   **Location**: `flutter_graphicview_wrapper/`

### 8. Tools
Miscellaneous scripts and utilities.
*   **s332dbview.py**: A Python CLI tool to inspect and query SQLite logger databases (`Logger.db`). Supports time-range filtering and database indexing for performance.
*   **Location**: `tools/`

## PM2 Deployment

Both web applications (`s4c-web` and `s4a-web`) are configured to run under PM2.

- **s4c-web**: Runs in production mode serving the static build folder.
- **s4a-web**: Runs in development CSD mode (`npm run dev:csd`) using the Vite dev server to dynamically load and parse `.csd` binary files.

### Ports Configured
- **s4c-web**: `http://localhost:9017` (production static build)
- **s4a-web**: `http://localhost:9018` (CSD development server)

### Prerequisites
Make sure `s4c-web` is built:
```bash
# Build s4c-web
cd s4c-web && npm run build && cd ..
```
Note: `s4a-web` runs Vite's development server, so you do not need to build it beforehand.

### Managing via PM2
You can start, stop, or manage both apps simultaneously using the root-level `ecosystem.config.cjs` from the workspace root:

```bash
# Start both apps
pm2 start ecosystem.config.cjs

# Check status
pm2 status

# Stop both apps
pm2 stop ecosystem.config.cjs

# Restart both apps
pm2 restart ecosystem.config.cjs

# View logs
pm2 logs
```

For individual application management:
```bash
# Standalone s4c-web (serves built dist)
cd s4c-web && pm2 start ecosystem.config.cjs

# Standalone s4a-web (runs dev:csd server)
cd s4a-web && pm2 start ecosystem.config.cjs
```

