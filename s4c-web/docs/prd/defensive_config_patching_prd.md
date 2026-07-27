# PRD - Defensive Config Migration & Patching

## 1. Feature Overview
To prevent application crashes when users import older `.cfgf` packages (or custom packages with missing JSON fields), `s4c-web` automatically populates missing configuration keys and defaults on load.

## 2. Technical Implementation
- Checks missing properties in `cfglogger.json`, `SUTO-SensorList.sutolist`, `cfgOptionBoard.json`, `cfgLayout.json`, and `cfgGraphic.json`.
- Tested in [cfgf_compare.test.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/cfgf_compare.test.js).
