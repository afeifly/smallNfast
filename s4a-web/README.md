# s4a-web

A React + Vite web application for visualising time-series data from CSD binary files or a live device API.

---

## Getting Started

```bash
npm install

# Mock mode — uses built-in fake data (no device / no file needed)
npm run dev

# CSD mode — reads real .csd binary files via pure JavaScript parser
npm run dev:csd

# Real API mode — connects to a live device server
VITE_API_HOST=http://192.168.1.1 npm run dev
```

---

## Modes

| Mode | Env flag | Data source |
|---|---|---|
| **Mock** | `VITE_USE_MOCK=true` | `MockAPI.js` — hardcoded fake data |
| **CSD** | `VITE_USE_CSD=true` | `CsdAPI.js` — Pure JavaScript parser reads a `.csd` file the user picks |
| **Real** | _(neither)_ | `RealAPI` — HTTP calls to a live device |

In **CSD mode** an **Open CSD File** prompt is shown (or folder icon in the top header). Click it to open a `.csd` file. The application auto-refreshes once the file is parsed.

---

## Device Simulator (S331)

`scripts/s331-simulator.mjs` emulates a SUTO S331 display / data-logger over Ethernet TCP (SUTO CS-Bus protocol), so the desktop app can be exercised end-to-end without real hardware.

| Simulated | Details |
|---|---|
| Discovery & system info | S331 (id 0x1065, fw 1.80), serial number **12344321** |
| Online values | 5 live channels — Flow, Velocity, Consumption, Temperature, Pressure |
| Logger | 2 sessions × 7 days @ 60 s interval, 5 channels each |
| Screenshots | 3 virtual BMP images (list / preview / download) |

```bash
npm run sim:s331                  # listen on port 502 (the app's default)
npm run sim:s331 -- --port 1502   # alternative unprivileged port
npm run sim:s331:test             # 45-check protocol selftest
```

In the app: Connect → **Ethernet TCP** → host `127.0.0.1` (or the simulator machine's LAN IP from other computers), port as above. macOS 10.14+ and Windows can bind port 502 directly; on Linux use the sudo command the script prints on startup.

Full documentation — protocol command table, signal models, tests (`cargo test --test s331_simulator` drives the real Rust engine against it), and troubleshooting: [scripts/s331-simulator.md](scripts/s331-simulator.md).

---

## Performance & Memory Optimization

- **Pure JavaScript CSD Parser**: Written in vanilla JS (`CsdAPI.js`), it uses lazy slice-based reading. Only the header and active data windows are loaded into memory, keeping the RAM footprint minimal (typically under 10 KB of RAM at rest, even for files up to 10 GB+).
- **Chunk-Based Table Pagination**: The Table View requests only 15–500 rows at a time via `getTablePage(pageIndex, pageSize, selectedChannelIds)`. It reads bytes on-demand, preventing browser tab crashes due to out-of-memory errors on large CSD logs.

---

## Architecture

```
src/
├── api/
│   ├── TestAPI.js        ← Single entry point — selects Mock / CSD / Real based on env flags
│   ├── MockAPI.js        ← Hard-coded fake data
│   ├── CsdAPI.js         ← Pure-JS parser (lazy slice-based reads); exposes same interface as MockAPI
│   └── RealAPI (inline in TestAPI.js)
├── modules/
│   ├── graphicview/
│   │   ├── index.jsx     ← Graphic View page: calls API, owns ChartController
│   │   ├── ChartController.js  ← Time period, selected channels, Y-axis state
│   │   ├── LineChart.jsx ← D3 SVG chart
│   │   └── YAxisSetting.jsx
│   ├── tableview/
│   │   ├── TableView.jsx ← Table View page: paginated grid view of CSD data records
│   │   └── TableView.css
│   └── channel/
│       └── ChannelList.jsx  ← Sidebar: loads locations + channels, handles selection
└── util/
    └── DataUtil.js       ← Converts raw API response → [{time, value}] chart points
```

---

## API Data Flow

Every data source (Mock, CSD, Real) must implement the same 4-method interface:

```
App starts
  │
  ①  getUserSettings(username)      which channels to pre-select + their colours
  │
  └─ ChannelList.getData()
        │
        ②  getLocations()           sidebar location groups
        │
        └─ ③  getChannels()         full channel list
                  │
                  └─ ④  getMeasurementData(...)   actual sample values
```

---

### ① `getUserSettings(username, callback)`

Determines which channels are **pre-selected** on startup and what colour they use.

```json
// callback receives:
[
  {
    "alias_name": "Admin",
    "username": "admin",
    "createddate": 1748870400000,
    "display_channel_option": [
      {
        "channel_id": {
          "channel_id": 0,
          "logic_channel_description": "Flow Rate",
          "physical_channel_description": "Flow Rate",
          "sensor_id": 0
        },
        "color": "#00B8D9",
        "display_channel_option_id": 1000
      }
    ]
  }
]
```

- `channel_id.channel_id` must match a `channel_id` in `getChannels()`.
- If `display_channel_option` is `[]`, no channels are pre-selected (chart shows placeholder).
- If the whole array is `[]`, `getChannels()` is still called — the user can select manually.

---

### ② `getLocations(callback)`

Provides location groups shown in the channel list sidebar header.

```json
// callback receives:
{
  "locations": [
    {
      "location_id": 1,
      "description": "CSD File",
      "location_index": 0,
      "background_img": "",
      "sensors": []
    }
  ]
}
```

`getChannels()` is called automatically right after this.

---

### ③ `getChannels(callback)`

Full list of all available channels shown in the sidebar.

```json
// callback receives:
{
  "logging_chs": [
    {
      "channel_id": 0,
      "location_id": 1,
      "sensor_id": 0,
      "logic_channel_description": "Flow Rate",
      "physical_channel_description": "Flow Rate",
      "sensor_description": "Sensor A",
      "unit_in_ascii": "m³/h"
    },
    {
      "channel_id": 1,
      "location_id": 1,
      "sensor_id": 0,
      "logic_channel_description": "Pressure",
      "physical_channel_description": "Pressure",
      "sensor_description": "Sensor A",
      "unit_in_ascii": "kPa"
    }
  ]
}
```

**Key rules:**
- `channel_id` is the unique key used everywhere.
- Channels with the **same `unit_in_ascii`** share one Y-axis (e.g. two `m³/h` channels → one axis).
- `sensor_id` groups channels under a sensor row in the sidebar.
- `location_id` must match a `location_id` from `getLocations()`.

---

### ④ `getMeasurementData(channelId, startTime, stopTime, tableInterval, getDataWay, callback)`

Returns the actual time-series samples for one channel.

#### Parameters

| Param | Type | Notes |
|---|---|---|
| `channelId` | number | Same `channel_id` as in `getChannels()` |
| `startTime` | ms epoch | **Already has +8 h applied** by the caller |
| `stopTime` | ms epoch | **Already has +8 h applied** by the caller |
| `tableInterval` | seconds | Downsampling hint; see table below |
| `getDataWay` | number | Always `2` (history mode) |

#### `tableInterval` values

| Time window | Interval |
|---|---|
| < 10 hours | `1` (every sample) |
| 10 h – 2.5 days | `10` |
| 2.5 – 25 days | `60` |
| 25 – 150 days | `600` |
| > 150 days | `3600` |

#### Response format

```json
// callback receives:
[
  {
    "channel_id": 0,
    "measurementData": [
      [25.3, 25.8, 26.1, 25.9, null, 26.4, 26.7]
    ],
    "realStartTime": [
      1748870400000
    ],
    "pointInterval": [
      1000
    ],
    "min": 20.0,
    "max": 35.0
  }
]
```

| Field | Type | Description |
|---|---|---|
| `measurementData` | `number\|null[][]` | **Array of segments.** Each segment is an array of sample values. `null` = missing/invalid sample (creates a gap in the line). |
| `realStartTime` | `number[]` | Start timestamp (ms epoch) for each segment. Length must match `measurementData`. |
| `pointInterval` | `number[]` | Milliseconds between consecutive samples in each segment. |
| `min` / `max` | `number` | Y-axis range hint (used if no override is set). |

#### Multiple segments (data with a gap)

```json
{
  "measurementData": [
    [25.3, 25.8, 26.1],
    [27.0, 27.4, 27.9]
  ],
  "realStartTime": [1748870400000, 1748873000000],
  "pointInterval": [1000, 1000]
}
```

Segment 1 runs from t₀ for 3 × 1 s.  
Segment 2 starts 2600 s later — the gap produces a line break in the chart.

#### Timestamp note

`DataUtil.handleMeasurementData` applies `-8 h` when creating chart points:

```js
point = { time: new Date(time - 3600000 * 8), value: v }
```

The caller adds `+8 h` before calling and `DataUtil` subtracts it back, so **CSD timestamps should be raw UTC milliseconds** — the round-trip cancels out.

---

## Debug Checklist

| Symptom | Likely cause |
|---|---|
| Chart shows "no channels" placeholder | `display_channel_option: []` from `getUserSettings` |
| Channel list empty / no sidebar items | `logging_chs: []` from `getChannels` |
| Channels show but chart is blank | `channel_id` mismatch between `getUserSettings` and `getChannels` |
| "No measuring data" toast | `getMeasurementData` returned all-`null` values or empty array |
| Line is invisible but no error | Timestamps land outside the current chart time window |

---

## Version Management (Unified Across Web, Desktop & Android)

The application uses `package.json` (`"version"`) as the **Single Source of Truth (SSOT)** for all platforms:

- **Web App**: Vite injects the version into the frontend at build time; shown at the homepage top-right badge (`v0.1.0`).
- **Desktop App (Tauri)**: Uses the exact same web UI + matches `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`.
- **Android App (APK)**: Tauri sets `versionName` in Android Gradle from the config, and the webview displays the matching version.

### Synchronizing Versions

To bump the version across all configuration files simultaneously:

```bash
# Update version across package.json, tauri.conf.json, and Cargo.toml:
node scripts/sync-version.mjs 0.2.0

# Or sync existing package.json version:
npm run sync:version

# Package all built outputs into dist-packages/ with unified versioned names:
npm run package:artifacts
```

*(Version sync is also triggered automatically before `npm run tauri:build` and `npm run tauri:android:build`)*.

---

## Building macOS Desktop App

S4A runs natively on macOS (Apple Silicon M1/M2/M3/M4 & Intel x86_64) via Tauri, supporting:
- **Direct USB Communication**: Native `rusb` (IOKit user-space bulk endpoints `0x03` OUT / `0x81` IN for SUTO `VID: 0x16C0`).
- **Bluetooth Low Energy (BLE)**: `btleplug` / CoreBluetooth with system permission support.
- **Ethernet TCP**: Direct SUTO CS-Bus socket communication.
- **Local CSD & CSV Analysis**: Client-side lazy-chunking parser for instant charting.

### 1. Prerequisites

- **Node.js** (v18+) & **npm**
- **Rust Toolchain**: `rustup default stable`
- **Xcode Command Line Tools**:
  ```bash
  xcode-select --install
  ```

### 2. Build Commands

```bash
# Build Production macOS App (.app) & DMG installer (.dmg):
npm run tauri:build

# Run in Development mode (with Hot Module Replacement):
npm run tauri:dev

# Dev mode with local CSD parser enabled:
npm run tauri:dev:csd
```

### 3. Output Package Locations

When `npm run tauri:build` completes, the bundles are generated in `src-tauri/target/release/bundle/`:
- **macOS Disk Image (`.dmg` installer)**:
  `src-tauri/target/release/bundle/dmg/s4a-app_0.1.0_aarch64.dmg`
- **macOS Application (`.app`)**:
  `src-tauri/target/release/bundle/macos/s4a-app.app`

### 4. Mounting & Installing

Open and mount the DMG installer directly:
```bash
open src-tauri/target/release/bundle/dmg/s4a-app_0.1.0_aarch64.dmg
```
Or launch the `.app` directly:
```bash
open src-tauri/target/release/bundle/macos/s4a-app.app
```

---

## Building Android APK

S4A runs natively on Android via Tauri Mobile, featuring full **Bluetooth Low Energy (BLE)** and **USB OTG Host** hardware communications.

### 1. Prerequisites

1. **Android SDK & NDK**:
   - Install Android Studio or Android SDK Command-line Tools (API level 34+ recommended).
   - Install Android NDK (e.g. version `28.2.13676358`).
2. **Java / JDK**:
   - JDK 17 or 21 (required by Gradle 8+).
3. **Rust Android Target**:
   ```bash
   rustup target add aarch64-linux-android
   # Optional emulator target:
   # rustup target add x86_64-linux-android
   ```

### 2. Set Environment Variables

Add the following to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export ANDROID_HOME=$HOME/Android/sdk       # macOS default is ~/Library/Android/sdk or your custom path
export NDK_HOME=$ANDROID_HOME/ndk/28.2.13676358
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### 3. Build Commands

```bash
# Build Release APK (aarch64 / ARM64 devices):
npm run tauri:android:build

# Build Debug APK (faster build with debug symbols):
npm run tauri:android:build:debug

# Live Development on a connected Android phone or emulator:
npm run tauri:android:dev
```

### 4. Output APK Location

Once built, the APKs are located at:
- **Debug APK**:
  `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`
  *(or `src-tauri/gen/android/app/build/outputs/apk/arm64-v8a/debug/app-arm64-v8a-debug.apk`)*
- **Release APK**:
  `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`

### 5. Installing onto a Device

Enable **Developer Options** and **USB Debugging** on your Android device, connect via USB, and run:

```bash
adb devices
adb install -r src-tauri/gen/android/app/build/outputs/apk/arm64-v8a/debug/app-arm64-v8a-debug.apk
```
