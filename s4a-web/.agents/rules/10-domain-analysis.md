# Rule 10-domain-analysis.md - Domain Analysis Guidelines

All agents must follow these guidelines when analyzing the business domain, modifying domain behaviors, or adding new features to the `s4a-web` codebase.

---

## 1. Bounded Context Classification
Every feature or operation in `s4a-web` must be classified into one of two bounded contexts:

1. **Lightweight User Interaction Context (UI Thread):**
   - **Target Environment:** Browser main thread.
   - **Operations:** Component rendering, routing, state changes, mouse/touch event handling, styling animations, and interactive SVG plot updates (d3).
   - **Constraint:** Must not block the UI for more than 16ms (60 FPS rendering ceiling). Heavy computations must not run here.
2. **Heavy-Duty Processing Context (Ingestion/Parser):**
   - **Target Environment:** Data utilities, parser classes, or Web Workers.
   - **Operations:** Stream read chunks, parsing CSV text or CSD binary buffers, metadata extraction, gap identification, downsampling computations, and IndexedDB read/write.
   - **Constraint:** Must use asynchronous chunk yielding or Web Worker threads to allow UI thread context rendering.

---

## 2. Core Domain Model Abstractions

Any design of new APIs or state modules should adhere to the established domain models:

* **MeasurementFile (Aggregate Root):**
  - Manages the identity, life cycle, and reading operations of a single loaded telemetry log.
  - Controls access to contained `Channel` lists and provides querying/lazy-loading methods.
* **Channel (Entity):**
  - Represents a single sensor data source tracking physical measurements.
  - Carries unique ID, descriptive labels, and statistical values (min/max/resolution).
* **Segment (Entity):**
  - Represents a continuous block of telemetry records without any power-loss or recording gaps.
* **DataRecord (Value Object):**
  - Represents a single point measurement entry containing a timestamp and mapping values. Value objects are immutable; any change requires creating a new instance.
* **GapDetail (Value Object):**
  - Immutable descriptor representing missing data bounds and estimated duration.

---

## 3. Transactional Boundaries & Invariants
* **IndexedDB Consistency:** File handle records saved to IndexedDB must match the metadata in `localStorage` ('recentCsdFiles'). If a handle is deleted, both systems must be updated atomically.
* **Downsampling Invariant:** Raw measurements returned for plotting must never exceed 3000 points. Strided sampling logic must be applied at the data layer, not the rendering layer.
* **Gap Threshold Invariant:** A chronological delta exceeding `2.0 * sample_interval` between rows must be treated as a gap. No flatline or interpolation should cross this threshold without user consent.
* **CSV Size Boundary:** Files larger than 800MB are forbidden from direct synchronous memory loads. They must trigger a conversion/warning dialog.
