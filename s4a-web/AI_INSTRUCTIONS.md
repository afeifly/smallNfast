# AI_INSTRUCTIONS.md

## 1. Project Context
- **Platform Type:** Modern Web Application.
- **Core Feature:** Local large file analysis. The application must process GB-level files locally within the client (browser). 
- **Core Principle:** Extreme performance first. Any code that blocks the main thread causing UI lag, or causes a browser Out-Of-Memory (OOM) crash, is absolutely unacceptable.

## 2. Core Business Constraints: Large File Processing
When you (the AI) are asked to write or refactor code related to file reading, parsing, or analysis, you must obey these ironclad rules:
- **No One-Time Loading:** Strictly prohibit using `FileReader.readAsText()` or `readAsArrayBuffer()` to load an entire large file into memory at once.
- **Mandatory Chunking & Streaming:** You must use `File.slice()` for chunking, combined with `ReadableStream` or asynchronous iterators to read and process files progressively.
- **Offload from the Main Thread:** All time-consuming file parsing, regex matching, data aggregation, and cryptographic calculations **must** be executed inside a Web Worker. The main thread is strictly for communicating with the Worker and updating the UI/progress bar.
- **Memory Management:** When processing file streams and creating `Blob`/`ArrayBuffer` objects, you must account for Garbage Collection (GC) and explicitly dereference large objects promptly.

## 3. Design System & UI Guidelines
When generating component structures and CSS styles, you must strictly apply the project's predefined design system:
- **Primary Color:** `#00ac86` (Teal/Mint). Used for active states, active tab indicators, primary call-to-action buttons (`.btn-primary`), primary SVG icons/strokes, and active indicators.
- **Secondary/Brand Color:** `#ffe000` (Company Signature Yellow). Used for the main application header background (`.app-header`).
- **Neutral Palette:** Use Slate colors for text and layout details:
  - Slate 900 (`#0f172a`): Titles, headers, high-contrast text on yellow background.
  - Slate 600/700 (`#475569` / `#334155`): Body text, secondary details, and descriptors.
  - Slate 400 (`#94a3b8`): Low-priority info, icons, and delete buttons.
  - Slate 50/100 (`#f8fafc` / `#f1f5f9`): Main page backgrounds, item hover states, and badge backgrounds.
- **Color Implementation:** Keep styling aligned with these hexadecimal values. Do not hardcode random bright colors (e.g., pure red/blue/green); use specific soft or primary-branded colors.
- **Loading State Awareness:** Because large file processing is time-consuming, all UI interactions involving file analysis must be accompanied by explicit loading indicators (e.g., spinners, progress bars, estimated time remaining).

## 4. Web Frontend Standards
- **Styling Architecture (Vanilla CSS):**
  - **No Tailwind CSS:** The project does not use Tailwind or CSS-in-JS. Implement all custom UI styles via scoped Vanilla CSS files (e.g., `import './MyComponent.css'`).
  - **CSS Classes & Semantic HTML:** Bind styles using clean class names (e.g., `.dashboard-card`, `.property-item`) and semantic elements (`article`, `section`, `table`, `thead`, `tbody`, `tr`, `td`).
- **Interactive Component Library (Material UI):**
  - Use Material UI (MUI) components from `@mui/material` and `@mui/icons-material` for standard widgets (e.g., `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions`, `Menu`, `MenuItem`, `Tooltip`, `Button`, `IconButton`, `List`, `ListItem`).
  - Customize MUI components using local overrides in the `style` prop, component-specific configuration props (e.g., `PaperProps`), or global class overrides in `App.css` (e.g., `.MuiButton-containedPrimary`).
- **Responsive Layout & Grid:**
  - Standard page layout relies on Flexbox (`display: flex; flex-direction: column;`) or CSS Grid (`display: grid`).
  - Implement responsive adjustments with media queries (e.g., `@media (max-width: 1024px)`) to stack multi-column grid dashboards into a single-column layout.
- **Premium Micro-Animations:**
  - Always add smooth entry and transition animations to make the UI feel responsive and alive:
    - **Page fade-ins:** A `@keyframes fadeIn` animation (moving up slightly from `translateY(10px)`) applied to new container entries.
    - **Hover scaling & shifts:** Transition scaling on hover (e.g. `transform: scale(1.05)` or rotating/scaling icons like `transform: rotate(15deg) scale(1.1)`), and horizontal shifts on list items (e.g. `transform: translateX(2px)`).
- **Metadata Badges & Typography:**
  - Use badge components (with colored backgrounds and bold text) for format type indicators (`.format-tag`, `.tag-csv`, `.tag-csd`) or unit metrics (`.unit-badge-tag`).
  - Format file paths, names, and scientific details using code/monospace typography (e.g., `font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace`).
- **Type Safety & Native APIs:**
  - When writing logic, prioritize modern ES6+ standards, `async/await`, `Promise`, and native browser APIs (such as `fetch`, `ResizeObserver`, etc.). Avoid heavy external formatting utility libraries (e.g., use the browser native `Intl` API instead of Moment.js).
  - Component view logic and heavy data processing/Web Worker communication must remain decoupled.

## 5. Error Handling & User Feedback
- **Crash Prevention:** Large file parsing is prone to exceptions (e.g., format errors, unexpected EOF). All internal Worker threads must include top-level `try-catch` blocks and pass specific error payloads back to the main thread via `postMessage`.
- **Friendly Prompts:** When an error is caught or the user operates incorrectly, the generated code should trigger the project's existing Toast/Notification components to provide user-friendly feedback, rather than silently failing or solely printing to the Console.

## 6. Interaction Protocol
When you (the developer) propose a new requirement to me (the AI), please try to specify the following in your prompt:
- **[Data Format]**: What is the format of the large file being parsed (CSV, JSON, plain text log, binary stream)?
- **[Analysis Goal]**: What features need to be extracted or what calculations need to be performed?
- **[UI Interaction]**: How should the analysis result be visually presented to the user utilizing `#00ac86` and `#ffe000`?
