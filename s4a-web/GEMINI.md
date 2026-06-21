# GEMINI.md - Project Context, Rules & Guidelines

This document serves as the single source of truth for developer and agent alignment on the `s4a-web` codebase patterns, architectures, performance constraints, and user interface styles.

---

## 1. Project Context
* **Platform Type:** Modern Web Application for client-side large log file processing and time-series charting.
* **Core Tech Stack:**
  - **Frontend Framework:** React 19 (JSX in `.jsx` files, views, modules).
  - **Bundler & Dev Server:** Vite 8.
  - **Component Library:** MUI 6 (`@mui/material`, `@mui/icons-material`, `@mui/lab`).
  - **Visualization:** d3 7 (for time-series charting and SVG rendering).
  - **I18n:** `react-intl-universal` (locales stored at `src/locales/en-US.js` with `SCREAMING_SNAKE_CASE` keys).
  - **Testing Stack:** Vitest + jsdom (runs in Node, no browser environment).
* **Environments & Build Modes:**
  - `dev:mock` - Runs local server with `VITE_USE_MOCK=true` using `MockAPI.js`.
  - `dev:csd` - Runs local server with `VITE_USE_CSD=true` using `CsdAPI.js` (legacy WASM-free JS CSD parsing).
  - `build` - Production bundle. Single-file build (`vite-plugin-singlefile`) is active in mock/real modes, but disabled in CSD mode to serve `.wasm` assets properly (if any).

---

## 2. Core Business & Concurrency Constraints
Extreme client-side performance is the highest priority for `s4a-web`. Any block on the main thread causing UI lag or browser Out-Of-Memory (OOM) crash is unacceptable.
* **No One-Time Loading for Large Files:** Strictly prohibit using `FileReader.readAsText()` or `readAsArrayBuffer()` to load an entire large file (>50MB) into memory at once.
* **Mandatory Chunking & Streaming:** Always use `File.slice()` combined with `ReadableStream` or asynchronous iterators to process files progressively.
* **Offload Heavy Ingest / Calculations:** All intensive tasks (e.g., parsing, regex matches, statistical aggregations, and cryptographic checks) should be offloaded to Web Workers. The main thread is reserved for UI updates and worker message communication.
* **IndexedDB Handle Persistence:** Utilize Chrome/Edge File System Access API (where supported) to persist file handles in IndexedDB (`CsdFilesDB` / `fileHandles`) so users do not have to select the file again upon page reload.
* **Memory Management:** Promptly release references to large chunks, blobs, and buffers once they are processed. Explicitly clear Web Workers and clean up DOM listeners to prevent leaks.

---

## 3. Design System & UI Guidelines
Ensure all user interfaces look premium, matching the brand guidelines. Avoid using generic or unstyled components.
* **Color Palette:**
  - **Primary/Action Color:** `#00ac86` (Teal/Mint) - Used for active states, tab indicators, primary action buttons (`.btn-primary`), active icons, and active UI states.
  - **Secondary/Brand Color:** `#ffe000` (Signature Yellow) - Used for the main header background (`.app-header`).
  - **Neutral Colors (Slate):**
    - Slate 900 (`#0f172a`): Titles, main headers, high-contrast text on yellow background.
    - Slate 600/700 (`#475569` / `#334155`): Body text, secondary details, descriptors.
    - Slate 400 (`#94a3b8`): Low-priority info, icons, and delete buttons.
    - Slate 50/100 (`#f8fafc` / `#f1f5f9`): Backgrounds, item hover states, and badge backgrounds.
* **Typography:** Modern sans-serif text (e.g., Inter, Roboto). For file names, paths, variables, and numbers, use code/monospace typography (e.g., `font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace`).
* **Vanilla CSS Styling:** No Tailwind CSS or CSS-in-JS. Implement custom UI styles via scoped Vanilla CSS files co-located in component folders (e.g., `import './css/style.css'`). Use clean, semantic HTML tag styling.
* **MUI Customization:** Customize MUI components using local overrides in the `style` prop, component configurations, or class overrides in `App.css` (e.g., `.MuiButton-containedPrimary`). Import MUI components line-by-line (e.g., `import Button from '@mui/material/Button'`).
* **Premium Micro-Animations:**
  - **Page Fade-ins:** A `@keyframes fadeIn` (moving up from `translateY(10px)` with opacity transition) for new containers.
  - **Hover Scale & Shifts:** Scale interactive elements on hover (e.g., `transform: scale(1.05)`) and slightly shift list items (e.g., `transform: translateX(2px)`).
* **Progress Awareness:** All file ingestion and export tasks must have progress bars, estimated remaining times, or spinner overlays to inform the user of background actions.

---

## 4. Error Handling & Feedback Protocols
* **Top-Level Try-Catch in Workers:** Avoid letting workers crash silently. Catch errors, serialize them, and notify the main thread via `postMessage`.
* **User-Friendly Toast/Notification System:** Always use the application's built-in premium Toast/Notification dialogs rather than default browser alerts or console-only logging. Use `window.showAppNotification(title, message, type)` to trigger them.
* **Large File Prompts:** If a CSV exceeds 800MB, show a warning prompting the user to convert it to the binary CSD format to ensure smooth visualization and prevent crash loops.

---

## 5. Developer Interaction Protocol
When requesting feature additions or changes, specify the following details:
1. **[Data Format]**: File format details (CSV, CSD, binary layouts, structures).
2. **[Analysis Goal]**: Specific computations, aggregations, or rendering criteria needed.
3. **[UI Interaction]**: Flow for the user interface, incorporating `#00ac86` primary teal and `#ffe000` brand yellow elements.
