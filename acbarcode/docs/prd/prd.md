# Product Requirements Document (PRD) — acbarcode / Barcode Label Maker

> Baseline PRD, retroactively reconstructed from the current codebase.
> Status: DRAFT · Last updated: 2026-08-14

## 1. Objective

### 1.1 Problem
Industrial equipment manufacturers (Atlas Copco / Pneumatech lines, SUTO-iTEC
thermal-mass-flow instruments) must produce scannable, physically sized product
labels for nameplates. The previous workflow used a C++ Odoo interface
(`ref/OdooInterface 2.cpp`) and ad-hoc Python scripts (`ref/genlabel.py`,
`ref/generatecode.py`), which are hard to operate, extend, and print.

### 1.2 Solution
A web-based label generator that lets operators pick a product, enter serial
numbers, preview labels, and export them as:
- **PDF** for quick printing / proofing,
- **EZPL** printer command stream (GoDEX/Zebra-class thermal printers),
- **GoLabel EZPX** print file + `data.csv` + Windows `print_labels.bat` helper
  for batch thermal printing.

### 1.3 Target Audience
- **Operators / production staff** (user role): generate and print labels.
- **Engineers / admins** (admin role): manage the product catalog, design and
  version label templates, and configure Odoo integration.

### 1.4 Business / Product Goals
- Replace the C++/Python toolchain with a browser-based, zero-install tool.
- Ensure labels are always physically correct (mm-accurate at 203/300/600 DPI).
- Support batch serial ranges with zero-padding and prefixes.
- Provide template reusability (main + sub-templates, EN/CN layouts).
- Integrate with Odoo to resolve a serial number to MO records.

## 2. User Stories

### AC Label Maker (Atlas Copco / Pneumatech)
1. As a **user**, I can log in with a password and access the label generator.
2. As a **user**, I can search and select a product by item number or name, which
   auto-fills the product name and brand logo.
3. As a **user**, I can enter up to 10 serial numbers (one per line) and generate
   a CODE128 barcode (prefixed `NS`) for each.
4. As a **user**, I can preview each label card and download a single label or all
   labels as a 100×60mm landscape PDF.
5. As an **admin**, I can add / edit / delete products (item number, name, brand band).
6. As an **admin**, I can switch between the Atlas Copco and SUTO-iTEC subsystems.

### ST Label Designer (SUTO-iTEC)
7. As an **admin**, I can manage label templates (create, duplicate, delete, reset,
   import/export JSON, paste EZPX to create a template).
8. As an **admin**, I can design a label with folders, text, images, lines,
   barcodes, and QR codes positioned in millimetres, in EN and CN layouts.
9. As an **admin**, I can define sub-templates (multiple label designs per product).
10. As an **admin**, I can enter a serial start/end and options (e.g. `A1410`),
    preview the live canvas, and page through the serial range.
11. As an **admin**, I can export the current design as EZPL text, as a GoLabel
    `.ezpx` ZIP (main + sub templates + `data.csv` + batch helper), as a PDF, or as
    template JSON.
12. As an **admin**, I can configure an Odoo server and test-search a serial number
    to retrieve the corresponding MO / product info.

### Integration / Automation
13. As a **system integrator**, I can call `POST /st_label` (per `ref/webapi.md`)
    with `product`, `serial_numbers`, `options`, and optional `template_xml` to
    receive a `label_all.zip` for unattended label generation.
14. As a **production operator**, I can run `print_labels.bat` on Windows to open
    the label in GoLabel with the CSV database connected and print all labels.

## 3. Functional Requirements

### FR-1 Authentication & RBAC
- Password gate on load (`LoginPage.vue`). Passwords: user `SUTOuser1234`,
  admin `SUTOadmin1234` (hardcoded today).
- Session persisted in `sessionStorage` (`acbarcode_auth`, `acbarcode_role`).
- Admin-only: product management, ST template manager/designer, Odoo config.
- Server write endpoints (`/api/products`, `/api/templates`) require
  `x-admin-password` header.

### FR-2 Product Catalog (AC)
- `GET /api/products` returns the product list (backed by `server/data/products.json`).
- `POST /api/products`, `PUT /api/products/:item`, `DELETE /api/products/:item`
  (admin) manage catalog entries: `{ item, name, band }`.
- Frontend dropdown with search, chips, auto-fill of name + band + logo + website.

### FR-3 AC Label Generation
- Input: item number, up to 10 serial numbers.
- Renders CODE128 (`NS<serial>`) via JsBarcode; preview cards; PDF export
  (100×60mm landscape) with product name, item no., serial, barcode, website, logo.

### FR-4 Template Store (SQLite)
- `server/templateStore.js` persists templates in `templates.db` (WAL).
- Schema: `{ id, name, itemNumbers, config{widthMm,heightMm,dpi}, elements_en,
  elements_cn, subTemplates[] }`.
- CRUD API at `/api/templates` (GET/PUT replace-all/POST/PUT one/DELETE), admin auth.
- Invariant: at least one template must remain.
- Debounced auto-save (800ms) from frontend store (`src/stores/templateStore.js`).

### FR-5 Template Designer
- Element types: `folder`, `text`, `image`, `hline`, `vline`, `barcode`, `qrcode`.
- Per-element editing: position (mm), size, font size/bold, image src/width,
  barcode readable/height, QR multiplier, option-mapping rules.
- EN/CN locale tabs with "Copy from EN".
- Sub-template management (name, size, dpi, EN/CN elements).
- Live canvas preview rendered at 203 DPI using `stCanvasRenderer.js`.

### FR-6 Serial Range & Options
- `stSerialRange.js`: start/end → expanded list; prefix + zero-pad; cap 1000.
- `stOptionResolver.js`: normalize option codes; resolve `optionMappings` and
  `{{product}}`, `{{serial}}`, `{{options}}` placeholders.

### FR-7 Compilation / Export
- **EZPL** (`stEzplCompiler.js`): font mapping by pt size, bold overprint,
  lines, stored-image refs, Code128, QR.
- **EZPX** (`stEzpxCompiler.js`): GoLabel XML; two serial modes —
  `^C00` counter (range) or `^F00` CSV-database (`csvDatabase`); builds
  `serialFormat`, 100-slot arrays, printer model by DPI; packages `.ezpx` +
  `data.csv` + `print_labels.bat` into a ZIP.
- **EZPX import** (`stEzpxParser.js`): parse GoLabel XML back into a Template.
- **PDF**: single- or multi-page jsPDF (35×22mm ST, 100×60mm AC).
- **Server**: `GET/POST /api/st-label` (ST PDF) and `POST /st_label` +
  `POST /api/st_label` (EZPX ZIP) per `ref/webapi.md`.

### FR-8 Odoo Integration
- `GET/POST /api/odoo/config` stores `{url, db, username, password}` in
  `server/data/odoo_config.json`.
- `POST /api/odoo/test-search`: XML-RPC authenticate → search `stock.lot` by
  serial (raw + `NNNN NNNN` formatted) → search `mrp.production` by `serial_ids`
  → read MO fields; returns logs + records. Auth UID cached in-memory and
  re-authenticated on failure / config change.

## 4. Technical & Resource Constraints

### Frontend
- Vue 3 + Vite 4 SPA; no router — tab-driven (`maker` | `st`).
- Libraries: `jsbarcode`, `jspdf`, `jszip`, `qrcode`, `html2canvas` (declared),
  `vue`.
- Serial range capped at **1000 labels** to prevent browser lockup.
- AC batch capped at **10 serials** per generation.
- Preview/PDF canvas uses **203 DPI** rendering.

### Backend
- Express 4 + Node ≥ 22 (relies on built-in `node:sqlite`).
- Ports: dev `5005` (Vite proxy), production `9016` (PM2 `ecosystem.config.cjs`).
- Request body limit: **10mb** (json + xml/text).
- Templates in SQLite WAL; products in `products.json`; Odoo config in `odoo_config.json`.
- Odoo keep-alive agents: maxSockets 50; in-memory auth UID cache.

### Printing / Physical Constraints
- Label sizes: AC 100×60mm landscape; ST 35×22mm landscape (default, configurable).
- DPIs: 203 / 300 / 600 → printer models G500 / EZ-1300+ / RT863i+.
- ST serials of 8 digits render as `NNNN NNNN`.
- `print_labels.bat` rewrites `<DataBaseFilePath>` to the absolute `data.csv`
  path on the Windows client and ensures `schema.ini`.

### Compatibility
- GoLabel EZPX v1.5.x (`QLabelSDKVersion 1.5.9708.17906`), EZPL printer language.
- Browser: modern Chrome/Edge/Firefox; Windows client for GoLabel batch printing.
