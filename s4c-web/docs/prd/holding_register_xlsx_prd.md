# PRD - Holding Register Map & XLSX Export

## 1. Feature Overview
The Holding Register feature enables users to view, configure, and export Modbus Holding Register address mappings. This map dictates how SUTO devices expose sensor measurement channels over Modbus RTU/TCP to external SCADA or PLC systems.

## 2. Functional Requirements
- Display Modbus register table with address offsets, channel assignments, data types, and register counts.
- **Excel Spreadsheet Export**: Render and trigger browser download of a formatted `.xlsx` register document using `xlsx` (SheetJS) library.

## 3. UI Component Location
Implemented in [HoldingRegister.jsx](file:///Users/ex/project/smallNfast/s4c-web/src/pages/communication/HoldingRegister.jsx).
