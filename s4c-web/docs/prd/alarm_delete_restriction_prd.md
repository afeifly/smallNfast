# PRD - Alarm Channel Deletion Restriction

## 1. Feature Overview & Goal
Enforces data integrity by preventing users from deleting a sensor channel from `SUTO-SensorList.sutolist` if an active alarm rule in `Alarm.db` relies on that channel.

## 2. Rule & UI Interaction
- Before deleting a channel, `s4c-web` checks `channel_identify_id` in `Alarm.db` against the target channel's `CreateTime`.
- If a matching alarm exists, deletion is blocked and a "Delete Restricted" warning dialog is displayed (`2ebf780`).
