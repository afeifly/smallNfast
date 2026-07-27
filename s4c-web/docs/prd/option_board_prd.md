# PRD - Option Board (Analog/Digital Input) Configuration

## 1. Feature Overview & Requirements
The Option Board subsystem handles physical extension terminals (X9 through X16) on SUTO devices, permitting analog current/voltage input loops and digital pulse/counter inputs.

## 2. Technical Hardware Specifications
Defined in [optionBoardConstants.js](file:///Users/ex/project/smallNfast/s4c-web/src/pages/sensorconfiguration/optionBoardConstants.js) and configured in `config/cfgOptionBoard.json`:
- **Terminal Assignment Mapping**:
  - `X9` (value 4), `X10` (value 3), `X11` (value 2), `X12` (value 1) -> Board Address 2
  - `X13` (value 8), `X14` (value 7), `X15` (value 6), `X16` (value 5) -> Board Address 3
- **Signal Types**:
  - Analog: `0...20mA` (0), `4...20mA` (1), `0.5...4.5V` (2), `0...10V` (3)
  - Digital: `Counter` (0), `Runtime` (1), `Status` (2)
- **Unit Taxonomies (13 categories)**:
  - Custom, Dew point, Humidity, Temperature, Pressure, Velocity, Concentration, Flow, Volume, Mass, Voltage, Power, Energy.
- **Resolution Scale Range**:
  - `1000` (-3), `10` (-1), `1` (0), `0.1` (1), `0.01` (2), `0.001` (3), `0.0001` (4), `0.00001` (5), `0.000001` (6).
- **Relative Channel Mode**:
  - When enabled, terminal limit fields are visually grayed out while retaining configured values.

## 3. UI Component Integration
Managed via `AnalogDigitalInput.jsx` and `AnalogDigitalModal.jsx`.
