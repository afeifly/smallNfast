# DDD Analysis Report - Holding Register Map Subdomain

## 1. Bounded Context Classification
- **Name**: Modbus Communication Subdomain
- **Classification**: Supporting Subdomain
- **Responsibility**: Register layout specification, address offset calculations, and binary/spreadsheet export formatting.

## 2. Value Objects
- **HoldingRegisterItem (Value Object)**:
  - `registerAddress` (integer)
  - `channelId` (string)
  - `dataType` (string: float32, uint32, int16, etc.)
  - `accessMode` (string: Read/Write)

## 3. Rules
1. Register addresses must not overlap.
2. Data types requiring 2 registers (e.g. 32-bit float) must allocate 2 consecutive register addresses.
