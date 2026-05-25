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
