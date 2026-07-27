# DDD Analysis Report - Graphic Data Visualization Subdomain

## 1. Bounded Context Classification
- **Name**: Graphical Visualization Subdomain
- **Classification**: Supporting Subdomain
- **Responsibility**: Chart list management, channel-to-line assignments, axis range calculations.

## 2. Value Objects
- **GraphicChartConfig (Value Object)**:
  - `chartId` (string)
  - `chartName` (string)
  - `assignedChannels` (array of channel IDs)
  - `axisLimits` (min/max object)
