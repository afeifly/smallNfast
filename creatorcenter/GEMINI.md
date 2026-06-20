# GEMINI.md: Code Development & Logical Constraints (Creator Center)

This file sets the core performance and business requirements for the development phase of the `creatorcenter` project. Both developers and AI coding assistants **must** strictly enforce the following rules when writing or refactoring FastAPI (Python) or React (TypeScript) code.

---

## 1. Automatic Integration & Contract Adherence
- **Payload Naming Standard**: Frontend JSON request bodies and backend Pydantic models ([models.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/models.py)) **must strictly map properties using `snake_case` naming** (e.g., `project_id`, `source_lang`, `target_lang`, `translated_text`, `is_edited`, `is_translated`).
- **SQLite Configuration**:
  - The SQLite database engine ([database.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/database.py)) must be initialized with `check_same_thread=False` to support concurrent threads.
  - Foreign key constraints must be explicitly enabled for every connection using `PRAGMA foreign_keys = ON`.

---

## 2. Event Loop Optimization & DB Integrity (Main Loop & DB Guard)
> [!WARNING]
> **Heavy document rendering and file export operations must never block the main FastAPI request thread!**

- **Asynchronous Task Offloading**: PDF compilation using WeasyPrint ([pdf_export.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/pdf_export.py)) is CPU-bound and must run inside background threads using FastAPI `BackgroundTasks`.
- **SSE Progress Tracking**:
  - Progress updates for exporting jobs must be streamed to the client using Server-Sent Events (`text/event-stream`) via [export_progress](file:///Users/ex/project/smallNfast/creatorcenter/backend/router_export.py#L90).
  - The progress is tracked by logging interceptors capturing WeasyPrint's rendering steps (steps 1 through 7) and updating the job manager.
- **Relational Integrity & Shared Dictionary**:
  - Translations must be shared globally using the translation database (`translation_keys` and `translation_values` tables).
  - Updating a translation for a key must automatically propagate to all non-ignored matching segments in the same project under the same `key_id`.
  - Empty or whitespace-only source texts must not be cataloged in `translation_keys`.

---

## 3. Parsing & Formatting Constraints
- **DOCX Parser (`parse_docx`)**:
  - Leverages `python-docx` to extract text from body paragraphs, structured document tags (SDT), tables, headers, and footers.
  - Inline run formats (bold, italic, underline, superscript, strike, hyperlinks, custom colors, sizing) must be preserved.
  - Consecutive runs with matching formatting must be merged to form clean translation segments to avoid segment fragmentation.
- **Markdown Parser (`parse_markdown`)**:
  - Inline elements like bold, italic, and links must be parsed into segment objects while keeping block structures (fenced code blocks, math formatting) as untouchable code/HTML blocks.
  - Text segments must be replaced with placeholder markers `{{SEG_N}}` to produce a skeleton document for rebuilds.
  - Updating Markdown project content requires clearing all old segments first and re-parsing.

---

## 4. Asset Management & Image Normalization
- **Strict Upload Size Constraints**:
  - Document uploads: Default limit is `50MB` (validated in [router_projects.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/router_projects.py#L40)).
  - Image uploads: Default limit is `10MB` (validated in [router_images.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/router_images.py#L25)). Supported types are restricted to standard web image formats.
- **Image Normalization in PDF Generator**:
  - Relative URL pathways `/api/images/*` must be normalized to absolute filesystem paths (`file://...`) so WeasyPrint can access files from disk.
  - Legacy HTML presentational width/height attributes (e.g., `width="400"`) must be converted to modern inline CSS blocks.

---
*Ensure these core rules are loaded and obeyed before implementing code on the creatorcenter repository.*
