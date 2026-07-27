# DDD Analysis Report - Alarm Channel Deletion Invariant

## 1. Domain Invariant Definition
- **Aggregate Entity Boundary**: `SensorChannel` in `SUTO-SensorList.sutolist` <-> `AlarmRule` in `Alarm.db`.
- **Invariant**: An aggregate root `ConfigPackage` must not contain dangling `AlarmRule` references pointing to deleted `SensorChannel` identities.

## 2. Validation Flow

```mermaid
flowchart TD
    A[User requests Channel Deletion] --> B[Query Alarm.db via alarmDbUtils.js]
    B -- channel_identify_id found --> C[Block Deletion & Show Warning Modal]
    B -- No matching alarm --> D[Execute Channel Deletion]
```
