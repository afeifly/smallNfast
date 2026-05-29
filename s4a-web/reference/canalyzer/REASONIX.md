# reference/canalyzer — Reasonix working knowledge

## What it is

A **Java Swing desktop application** — "Compressed Air Analyzer" (CAA) v2.10.16 — that reads CSD binary files, visualizes time-series data, and generates statistics/reports for compressed air systems. Developed by CS Instruments around 2007–2014 (`@author msu`, `@author wolf`).

The web app in `src/` is the **browser-based successor** — `CsdAPI.js` is the pure-JS replacement for the Java desktop parser's CSD reading logic.

## Stack

- **Java** — language, targets J2SE. No build file present (no `pom.xml` / `build.xml` in this checkout).
- **Swing** — UI framework (`javax.swing.*`), hand-laid-out forms (`.form` files from the NetBeans GUI builder coexist alongside manual layout).
- **HSQLDB / CSMDF** — embedded database layer (`com.cs.database.*`), stores parsed CSD data and intermediate analysis results. Contains upgrade path from HSQLDB to CSMDF.
- **iText (com.lowagie.text)** — PDF export (statistics reports, graphic export).
- **JavaHelp** (`javax.help.*`) — context-sensitive HTML help system with multi-language help sets (`main_en_US.hs`, `main_zh.hs`, `main_ja.hs`).
- **install4j** — Windows-registry integration (`com.install4j.api.windows.WinRegistry`) for locating CSSoft databases and license storage.

## Architecture

```
com.cs.canalyzer
  Main.java                      — entry point; shows startup screen, checks license
  CAATexts*.properties           — i18n (en, zh, ja, ko, de, fr) — 1179 keys
  gui/
    Base.java                    — main JFrame (2240 lines); owns all UI orchestration
    GraphicPanel.java            — time-series chart widget (5004 lines), Java2D
    GUIConst.java                — constants: colors, fonts, version, file paths
    PropertyUtil.java            — reads canalyzer.cfg config file
    CustomizedSettings.java      — customer-specific branding/URL overrides
    dialog/                      — 12+ modal dialogs (settings, about, time period, etc.)
  structs/
    CommonValue.java             — central state: holds protocol headers, channel headers, view options
    Compressor.java              — compressor analysis: load hours, energy, cost
    LeakStatistics.java          — leak detection and quantification (2842 lines)
    MeasurementUnit.java         — unit conversion (flow rate, pressure, current, etc.)
    VFConst.java                 — variable-frequency drive compressor power tables
    ViewOptions.java             — graphic view configuration
    ViewChannel.java             — channel selection/filtering
    BasicSetting.java            — basic setting persistence
    DatabaseInformation.java     — auto-discovers CSSoft/IRSoft databases on local machine
    Texts.java                   — axis labels, legends, user-defined text overrides
    ReportFile.java              — serializable report document model
  export/
    ExportAction.java            — orchestrates JPEG/PDF export of graphic + table views
    JPEGExportAction.java        — graphic view → JPEG
    PDFExportAction.java         — graphic view → PDF (iText)
    JTable2PdfExportAction.java  — table view → PDF
    StatisticsPDFFrame.java      — statistics report → PDF
    file/export/                 — CSD data re-export to CSV/text dialogs
  print/printing/
    PrintManager.java            — print orchestration
    ReportPrinter.java           — interface for printable reports
    StatisticsRenderer.java      — renders statistical table for print
    CoverPageForm.java           — cover page for printed reports
    TablePrinter.java            — generic table printing
    CellPrinter.java / NumberCellPrinter.java — cell-level formatting
  license/
    CAALicense.java              — CAA-specific license management
    PostInstallLicenseAction.java — first-run license setup
  help/
    HelpConst.java               — locale-aware JavaHelp .hs file path resolution
    CAA Help-{zh,jp}/            — localized help content (HTML + images)
Test.java                        — hardcoded dewpoint calibration data (7072 lines)
```

## Commands

No build file is present in this checkout. Historically built with NetBeans / Ant.

## Conventions

- **NetBeans GUI Builder** — `.form` XML files accompany most dialogs; both the `.form` and generated `.java` are checked in.
- **i18n** — All user-facing strings come from `CAATexts.properties` (and locale variants) via `ResourceBundle.getBundle("com/cs/canalyzer/CAATexts")`. Keys are sentence-case identifiers like `Please_wait_while_program_starting_up_..._`.
- **Serialization** — Report data structures (`ReportFile`, `Compressor`, `LeakStatistics`) implement `Serializable` for save/load.
- **PropertyChangeListener** — `CommonValue` broadcasts state changes; `Base` and `GraphicPanel` subscribe.
- **Version constant** — single source at `GUIConst.VERSION_NUMBER = "2.10.16"`.

## Relationship to the web app

This Java desktop app and the React web app (`src/`) both read the **same CSD binary format**. `CsdAPI.js` in the web app is the pure-JavaScript reimplementation of the CSD parsing that this Java code does via `com.cs.database.CSMDF`. The web app's charts (d3) replace `GraphicPanel` (Java2D), and the web app's table view replaces `JTablePanel`. The web app **does not** yet implement the compressor/leak statistics engine that lives in `structs/Compressor.java` and `structs/LeakStatistics.java`.
