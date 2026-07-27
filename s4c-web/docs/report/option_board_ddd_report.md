# DDD Analysis Report - Option Board Subdomain

## 1. Bounded Context Classification
- **Name**: Option Board Extension Subdomain
- **Classification**: Core Domain Subdomain
- **Responsibility**: Hardware terminal mapping, electrical signal conversion options, physical unit type categorization, and signal resolution mapping.

## 2. Entities & Value Objects
- **OptionBoardChannel (Entity)**:
  - `terminal` (integer: X9-X16)
  - `optionBoardType` (0 = Analog, 1 = Digital)
  - `signalType` (integer enum)
  - `unitType` (integer enum: 0-12)
  - `resolution` (integer offset: -3 to 6)
  - `isRelative` (boolean)

## 3. Invariants & Rules
1. Terminal assignments must map strictly to valid Option Board addresses (Address 2 for X9-X12, Address 3 for X13-X16).
2. Units selected must belong to the mapped `unitType` category taxonomy defined in `optionBoardConstants.js`.
