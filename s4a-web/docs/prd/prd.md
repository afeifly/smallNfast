# Product Requirements Document - s4a-web Baseline

## Metadata
* **Creation Date:** 2026-06-21
* **Author:** Antigravity (Google DeepMind)
* **Version:** 1.0.0
* **Status:** Approved (Retroactive Baseline)

---

## 1. Objective
* **User Problem:** Industrial and field engineers collect large quantities of sensor measurements (such as flow rates, pressure, power, etc.) from logging devices. These logs are often stored in either proprietary binary formats (CSD) or text files (CSV) and can range from megabytes to gigabytes in size. Standard spreadsheet tools or cloud-based visualizers either crash on large files or require uploading confidential raw data to external servers, creating performance issues and security concerns.
* **Target Audience:** Field engineers, facility managers, and energy auditors analyzing compressed air or gas systems using sensor telemetry.
* **Business/Product Goal:** Provide an extremely fast, secure, and fully client-side (in-browser) visual dashboard to ingest, index, inspect, and analyze sensor logging files of any size without blocking the UI thread or triggering browser Out-Of-Memory (OOM) errors.

---

## 2. User Stories

### File Ingestion & Persistence
* **As a user**, I want to open CSD and CSV files from my local system so that I can analyze the recorded sensor measurements.
* **As a user in Chrome/Edge**, I want to reload my recently opened files with a single click (using stored file handles in IndexedDB) without having to find them in the OS file picker again.
* **As a user in Safari/Firefox**, I want a graceful fallback to a standard file input selector so that I can still utilize the visualizer.
* **As a user loading a very large CSV (e.g., >800MB)**, I want to see a warning dialog recommending conversion to binary CSD, but still have the option to open the raw CSV or cancel.

### Visual Analysis & Reporting
* **As a user**, I want to see detailed file metadata (start/stop times, channel list, units) in a **File Info** tab so I can verify the context of the logging run.
* **As a user**, I want to view a time-series chart in a **Graphic View** tab where I can toggle channel visibility, zoom, and scroll through dense plots without the UI lagging.
* **As a user**, I want to examine raw records in a paginated **Table View** that lazy-loads only the visible page so that memory usage remains tiny regardless of file length.
* **As a user**, I want a **Consumption Report** that shows energy costs, power usage, and flow statistics to audit system performance.
* **As a user**, I want to perform a specialized **Compressor Analyze (Beta)** to assess mechanical behavior of the air compressor system.

### Data Export & Operations
* **As a user**, I want to export CSV files to binary CSD files so that subsequent loads are near-instantaneous.
* **As a user**, I want to be notified of gaps (power loss / logging interruptions) in the data stream when converting, and choose to export a single file with gaps or split the export into separate continuous CSD segments.
* **As a user**, I want to export the loaded channel values to standard CSV or Excel files.

---

## 3. Functional Requirements

### 3.1. Landing & File Picker Module
* **Initial State:** Display a clean landing card with the brand logo and a "Open File" Call to Action (CTA).
* **Recent Files Section:** List up to 5 recently opened files with their name, size, path, and last opened date. Clicking a file should trigger immediate load (with permission query). Clicking the "Delete" icon should remove the file handle from IndexedDB and the metadata from local storage.
* **Fallback Behavior:** If File System Access API is not supported (Firefox, Safari), fallback to standard `<input type="file" accept=".csd,.csv">`.

### 3.2. File Ingestion Loader Overlay
* **Visual State:** Show a full-screen loading spinner with a progress bar and the filename currently being indexed.
* **CSV Indexer Behavior:** Stream-read the CSV in chunks (e.g., 8MB), dynamically parsing and storing row byte-offsets, record IDs, and timestamps. Calculate on-the-fly min/max values per channel.
* **Large CSV Warning Dialog:** If the selected CSV is larger than 800MB, show a customized warning dialog with three choices:
  1. **Convert to CSD (Primary):** Parse CSV and automatically trigger CSD export.
  2. **Open as CSV Anyway:** Load raw CSV using stream-indexing.
  3. **Cancel:** Abort loading.

### 3.3. Main Visual Dashboard Layout
Once a file is loaded, show a header containing the project logo, title (`S4A-Web`), the name of the loaded file, and a horizontal navigation bar with five tabs:
1. **File Info View:** Shows device name, start/stop timestamps, calculated sample rate, sample count, and a list of channels with their IDs, sensors, physical descriptions, and units.
2. **Graphic View:** Renders an interactive D3 time-series plot. Includes a sidebar to toggle channel checkboxes (allowing up to 10 distinct channels). Channels are styled with distinct line colors. Handles downsampled data arrays dynamically to fit the maximum display limit (3000 points) to prevent SVG rendering bottlenecks.
3. **Table View:** Displays a paginated table of raw records. Features page navigation (page number, rows-per-page selector). Asynchronously queries the active API for only the active page size (e.g., 50 rows) to ensure low footprint.
4. **Consumption Report:** Renders consumption summaries, average and peak power, flow stats, and currency analysis.
5. **Compressor Analyze (Beta):** Beta tool for analyzing compressor states and duty cycles.

### 3.4. Export & Operations Menu
Available via a "Share" icon in the header:
* **Export CSV to CSD:** Available only in CSV mode. Triggers gap detection.
  - If time-loss gaps (pauses > 2.0 × sample interval) are found, show a **Gap Confirmation Dialog** showing the number of gaps and segments.
  - Options: **Export Combined** (single CSD with gaps) or **Export Split** (multiple CSD files, one per segment).
* **Export all to CSV:** Exports loaded file channels.
* **Export all to Excel:** Exports loaded data to Excel file formats.

---

## 4. Technical & Security Constraints
* **Pure Client-Side execution:** No server-side storage or database holds raw sensor files. The application runs entirely within the user's browser runtime.
* **Browser Compatibility:** Support Chrome, Edge, Firefox, and Safari. FSA (File System Access) operations are exclusive to Chromium-based browsers; others fallback cleanly.
* **Memory Limits:** Must not exceed 250MB RAM usage during indexing and visualization of large files (up to 10GB).
* **Dependency Limitations:** Limit dependencies to Vite 8, React 19, MUI 6, and D3 7. Do not include heavy date wrappers like Moment.js or styling utilities like Tailwind CSS.
