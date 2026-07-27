# PRD - Device Channel Remarshaling & Firmware Synchronization

## 1. Feature Overview & Requirements
When configuration packages (`.cfgf`) are created or exported from `s4c-web`, internal configuration files (`SUTO-SensorList.sutolist`, `cfgOptionBoard.json`, `cfglogger.json`, `Alarm.db`) must be synchronized so physical SUTO C/C++ firmware devices can interpret logger and alarm settings.

## 2. Technical Specification (`remarshalAll`)
Centralized synchronization logic is implemented in [remarshalUtils.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/remarshalUtils.js):

### 2.1 Logger Flag & Timestamp Synchronization
- `"Logger": true / false`: Synchronized across every channel in `SUTO-SensorList.sutolist` and `cfgOptionBoard.json` based on `cfglogger.json::channelArray`.
- **10-Digit Starttime Seconds**: `starttime` in `cfglogger.json` must be stored as a **10-digit Unix timestamp in seconds** (`time_t`). 13-digit millisecond values cause integer overflow in embedded C firmware.

### 2.2 Alarm Flag & Threshold Synchronization
- `"EnableAlarm": true / false`: Physical devices check `"EnableAlarm"` on channel objects before querying `Alarm.db`.
- Synchronizes `Direction` (`0` = Above/UP, `1` = Below/DOWN), `MaxThreshold` / `MinThreshold`, `MaxHysteresis` / `MinHysteresis`, and `RelayIndex` (`relay_id`) onto sensor channels.

## 3. Automated Verification
Covered by unit test suites in [remarshalUtils.test.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/remarshalUtils.test.js) and [LoggerSettings.test.jsx](file:///Users/ex/project/smallNfast/s4c-web/src/pages/LoggerSettings.test.jsx).
