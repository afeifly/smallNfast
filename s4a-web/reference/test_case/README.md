# Test Cases for CSD & CSV File Appending

This directory contains curated real-data test suites (2 hours per file, 7,200 samples @ 1 Hz) designed to test all edge cases of single-file opening and multi-file appending in `s4a-web`.

---

## Directory Overview

| Test Case Directory | Type | Key Scenario | Expected Behavior |
| :--- | :--- | :--- | :--- |
| **`csd_append_case_samechannels`** | CSD | Sequential 2-hour files with identical channels (`Flow`, `Pressure`, `Temperature`). | Unifies into 3 continuous channels across 4 hours without duplicate labels or `[F1]` prefixes. |
| **`csd_append_case_different_channels`** | CSD | File 1 has 3 channels; File 2 adds a 4th channel (`Humidity`). | Unifies the 3 shared channels and appends the 4th channel. In table view, Channel 4 displays `null` during File 1's window. |
| **`csd_append_case_repeat_timeperiod`** | CSD | Overlapping / concurrent logging (both files recorded from 08:00 to 10:00). | Option A parallel logger mode activates. Keeps channels separate (`0:0`, `1:0`) to prevent timestamp collisions. |
| **`csd_append_case_gap_missing_time`** | CSD | Sequential files with a 2-hour gap between them (10:00 to 12:00). | Appends seamlessly; gap report identifies the 2-hour outage gap without crashing or freezing. |
| **`csv_append_case_samechannels`** | CSV | Sequential 2-hour files with matching SUTO headers (`Flow`, `Pressure`, `Temperature`). | Unifies into 3 channels, concatenates 14,400 samples, and renders a continuous curve across both files. |
| **`csv_append_case_repeat_timeperiod`** | CSV | Two CSV files covering the exact same 08:00–10:00 time period. | Tests handling and concatenation of repeating timestamps. |
| **`csv_append_case_different_channels`** | CSV | File 1 has 3 channels; File 2 has 5 channels (`Flow`, `Pressure`, `Temperature`, `Humidity`, `Power`). | Unifies matching channels and dynamically adds new channels into a 5-channel session. |
| **`csv_append_case_gap_missing_time`** | CSV | File 1 (08:00–10:00), File 2 (12:00–14:00) with a 2-hour missing window. | Gap detector computes missing 7,200 seconds; chart accurately reflects the gap. |

---

## Test Data Characteristics

- **Duration per file**: 2 hours (08:00:00 → 10:00:00, 10:00:00 → 12:00:00, or 12:00:00 → 14:00:00).
- **Sample Rate**: 1.0 Hz (1 second interval).
- **Sample Count**: 7,200 data points per file (14,400 points total per 2-file merged session).
- **Signals Simulated**:
  - `Flow` (m³/min): Sine wave oscillation between 10.5 and 19.5 m³/min with Gaussian jitter.
  - `Pressure` (bar): Typical pneumatic compressed air network oscillation around 6.8 bar.
  - `Temperature` (°C): Gradual thermal cycling between 21°C and 27°C.
  - `Humidity` (%RH): Ambient relative humidity fluctuation around 48 %RH.
  - `Power` (kW): Active electrical power consumption around 38 kW.
  - `DewPoint` (°Ctd): Compressed air dew point around -35 °Ctd.
