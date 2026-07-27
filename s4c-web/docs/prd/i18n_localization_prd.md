# PRD - Multi-Language Subsystem (i18n)

## 1. Feature Overview & Requirements
The `s4c-web` application serves global users and embedded device technicians in English, Simplified Chinese, and German. The i18n subsystem enables instant language switching at runtime and synchronizes the active language selection into device configuration packages.

## 2. Supported Languages & Locales
- **English**: [src/locales/en.json](file:///Users/ex/project/smallNfast/s4c-web/src/locales/en.json) (Default reference locale)
- **Simplified Chinese**: [src/locales/cn.json](file:///Users/ex/project/smallNfast/s4c-web/src/locales/cn.json)
- **German**: [src/locales/de.json](file:///Users/ex/project/smallNfast/s4c-web/src/locales/de.json)

## 3. Domain Terminology Alignment
Standardized domain terminology across all 3 locales:
- Direction: `"Trigger Direction"` (EN) / `"触发方向"` (CN) / `"Triggerrich"` (DE)
- UP: `"Above"` (EN) / `"高于"` (CN) / `"Höher"` (DE)
- Down: `"Below"` (EN) / `"低于"` (CN) / `"Niedriger"` (DE)
- Relay Active: `"Pending"` (EN) / `"抑制"` (CN) / `"Ausstehend"` (DE)

## 4. Package Synchronization
When exporting a `.cfgf` package, the active language code is stored in `system/system_info.json` under `language`, ensuring SUTO physical devices display the user's preferred language upon loading the package.
