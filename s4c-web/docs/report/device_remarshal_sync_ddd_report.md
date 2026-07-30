# DDD Analysis Report - Device Remarshaling & Synchronization Bounded Context

## 1. Bounded Context Classification
- **Name**: Device Remarshaling & Firmware Synchronization Context
- **Classification**: Core Domain Subdomain
- **Responsibility**: Enforcing state consistency between SQLite database files (`Alarm.db`), high-level JSON logger files (`cfglogger.json`), and physical channel descriptor lists (`SUTO-SensorList.sutolist`, `cfgOptionBoard.json`).

## 2. Context Interaction Flow

```mermaid
sequenceDiagram
    participant Editor as UI Editor (Alarm / Logger)
    participant Remarshal as remarshalUtils.js
    participant SensorList as SUTO-SensorList.sutolist
    participant OptionBoard as cfgOptionBoard.json
    participant Logger as cfglogger.json

    Editor->>Remarshal: remarshalAll(configData, activeAlarms)
    Remarshal->>Logger: Keep starttime in milliseconds (13-digit)
    Remarshal->>SensorList: Sync "Logger": true/false
    Remarshal->>OptionBoard: Sync "Logger": true/false
    Remarshal->>SensorList: Sync "EnableAlarm", Direction, Thresholds, RelayIndex
    Remarshal->>OptionBoard: Sync "EnableAlarm", Direction, Thresholds, RelayIndex
    Remarshal-->>Editor: Updated ConfigPackage ready for ZIP export
```

## 3. Domain Invariants
1. **Timestamp Invariant**: `starttime` is stored as a 13-digit Unix timestamp in milliseconds. Legacy 10-digit second timestamps are converted to milliseconds.
2. **Channel Flag Invariant**: Every active channel in `Alarm.db` must have `"EnableAlarm": true` in `SUTO-SensorList.sutolist`. Channels without active alarm rules must have `"EnableAlarm": false`.
3. **Logger Flag Invariant**: Channels present in `cfglogger.json::channelArray` must have `"Logger": true`.
