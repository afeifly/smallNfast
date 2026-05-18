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

### 6. Web Graphic View
A **Data Visualization Library** for sensor data charts.
*   **Technology**: React, D3.js, Material UI.
*   **Purpose**: Specialized charting components for rendering high-performance graphic views of sensor log data.
*   **Location**: `web_graphicview/`

### 7. Flutter Graphic View Wrapper
A **Flutter Implementation** of the graphic visualization components.
*   **Technology**: Flutter/Dart.
*   **Purpose**: Provides a native mobile wrapper or port of the graphic view components for cross-platform use.
*   **Location**: `flutter_graphicview_wrapper/`

### 8. Tools
Miscellaneous scripts and utilities.
*   **s332dbview.py**: A Python CLI tool to inspect and query SQLite logger databases (`Logger.db`). Supports time-range filtering and database indexing for performance.
*   **Location**: `tools/`
