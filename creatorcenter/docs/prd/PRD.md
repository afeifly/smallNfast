# Product Requirement Document (PRD) - Creator Center

Creator Center is a web-based document translation and generation workspace. It allows users to upload, segment, translate, edit, and export DOCX and Markdown documents with support for shared database key/value localization, image asset management, and PDF/DOCX exporting.

---

## 1. Objectives & Target Audience
- **Target Audience**: Translators, localization managers, and content creators looking to translate DOCX or Markdown documents while maintaining identical layout/formatting.
- **Key Objectives**:
  - Provide a segment-by-segment document translation workspace.
  - Share translations globally using a unified Translation Database to minimize duplicate work.
  - Re-inject translations into original document layouts for seamless export to DOCX or Markdown.
  - Render documents into professional, print-ready, styled PDF formats using a headless HTML/CSS renderer (WeasyPrint).
  - Manage linked media assets (images) dynamically.

---

## 2. System Architecture & Data Model

The database is built on SQLite. The schema details projects, individual segments, and a global translation dictionary.

### Database Schema ([database.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/database.py#L7-L63))

```mermaid
erDiagram
    PROJECTS ||--o{ SEGMENTS : "contains"
    TRANSLATION-KEYS ||--o{ SEGMENTS : "assigned to"
    TRANSLATION-KEYS ||--o{ TRANSLATION-VALUES : "has localized values"

    PROJECTS {
        int id PK
        string name
        string content_type "docx / markdown"
        string original_file
        string markdown_content
        string placeholder_md
        string source_lang "Default: EN"
        string target_lang
        string status "uploaded/parsed/translating/translated/reviewed/exported/error"
        datetime created_at
        datetime updated_at
    }

    SEGMENTS {
        int id PK
        int project_id FK
        int sequence
        int paragraph_index
        int container_paragraph_index
        int run_index
        int run_count
        string source_text
        string formatting_json
        string paragraph_formatting_json
        string container_type "paragraph / table_cell / header / footer"
        int container_index
        int table_row
        int table_col
        int section_index
        int key_id FK
        string translated_text
        boolean is_translated
        boolean ignored
    }

    TRANSLATION-KEYS {
        int id PK
        string source_text UQ
    }

    TRANSLATION-VALUES {
        int id PK
        int key_id FK
        string target_lang
        string translated_text
        boolean is_edited
        datetime created_at
    }
```

---

## 3. Functional Modules

### 3.1 Document Upload & Parsing
- **Project Intake**:
  - Users can upload `.docx` files or import/create `.md` documents via [HomePage.tsx](file:///Users/ex/project/smallNfast/creatorcenter/frontend/src/pages/HomePage.tsx).
  - Limits: File size must not exceed the config limit (default `50MB` specified in [config.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/config.py#L14-L15)).
- **DOCX Parser ([docx_parser.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/docx_parser.py#L137))**:
  - Leverages `python-docx` to extract text from body paragraphs, structured document tags (SDT), tables, headers, and footers.
  - Extracts paragraph-level and run-level styles (bold, italic, underline, superscript, strike, hyperlinks, custom colors, sizing).
  - Merges consecutive runs with matching formatting to form clean translation segments.
- **Markdown Parser ([markdown_parser.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/markdown_parser.py#L6))**:
  - Tokenizes markdown headings, paragraphs, lists, blockquotes, and tables cell-by-cell.
  - Inline elements like bold, italic, and links are parsed into segment objects while keeping block structures (fenced code blocks, math formatting) as untouchable code/HTML blocks.
  - Replaces text segments with matching placeholder markers `{{SEG_N}}` to produce a skeleton document for rebuilds.

### 3.2 Workspace & Segment Editor
- **Interactive Markdown Editor ([MarkdownProject.tsx](file:///Users/ex/project/smallNfast/creatorcenter/frontend/src/pages/MarkdownProject.tsx))**:
  - Provides a side-by-side editing interface (Raw MD + live HTML Preview).
  - Allows live content updates which trigger segment re-parsing on the backend.
- **Translation Editor ([ReviewPage.tsx](file:///Users/ex/project/smallNfast/creatorcenter/frontend/src/pages/ReviewPage.tsx))**:
  - Allows users to review individual translation pairs, indicating edited states (`is_edited`) and occurrences.
  - Editing a segment's translation propagates it automatically to all matching non-ignored segments in the same project utilizing `key_id` linkages.

### 3.3 Automatic Machine Translation
- **Translation Engine ([router_translations.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/router_translations.py#L100))**:
  - Integrates with OpenL Translation API and MiniMax API.
  - Processes translation triggers in batches:
    - **OpenL**: Max batch size of `3` (tailored for Free API tier constraints), with a 2-second rate-limiting delay between requests.
    - **MiniMax**: Max batch size of `25` (tailored for custom LLM context windows).
  - If identical source text exists in the global `translation_values` database for the target language, Creator Center skips external API calls and directly propagates the cached translation.

### 3.4 Image Asset Management
- **Asset Uploads ([router_images.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/router_images.py#L15))**:
  - Restricts image uploads to supported MIME types (`image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`).
  - Limits image file size to `10MB`.
  - Generates safe UUID-based filenames and returns URLs in format `/api/images/{filename}`.
- **Inline Rendering**:
  - Injected images are stored in the server's uploads folder and served dynamically via file responses.

### 3.5 PDF & Document Export
- **DOCX Rebuilding**: Re-injects translated segments back into the original `.docx` file, preserving all formatting, headers, footers, and table columns.
- **PDF Export via WeasyPrint ([pdf_export.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/pdf_export.py))**:
  - Builds premium PDF reports by compiling markdown or segmented DOCX structures into styled HTML/CSS.
  - **CSS Rendering Engine**: WeasyPrint implements native CSS3 Paged Media (`@page`), headers, footers, custom page counters (`Page X of Y`), and page breaks (`---newpage---`).
  - **Image Resolution**: Normalizes image pathways by rewriting relative URLs `/api/images/*` to absolute filesystem coordinates (`file:///...`) for WeasyPrint's local access. Converts HTML presentation attributes (e.g. `width="400"`) into modern inline CSS blocks.
  - **Font Fallbacks**: Employs font fallbacks to handle Latin/Sans-serif (`Arial`) and CJK scripts (`Noto Sans CJK` / `Arial Unicode`) automatically based on target language indicators.
  - **Progress Worker ([router_export.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/router_export.py#L90))**:
    - Spawns background export jobs tracked by unique UUIDs.
    - Hooks into the WeasyPrint logging pipeline to read layout steps (1 through 7) and stream rendering progress to the frontend client using Server-Sent Events (`text/event-stream`).

---

## 4. Tech Stack & Dependencies

### Backend
- **Framework**: FastAPI (python 3.12+)
- **Server**: Uvicorn
- **DB Engine**: SQLite3
- **Doc Parsers**: python-docx, markdown
- **PDF Compiler**: WeasyPrint

### Frontend
- **Framework**: React 19, TypeScript
- **Bundler**: Vite
- **Styling**: Tailwind CSS v4
- **State Management**: TanStack React Query
- **Editor**: React MD Editor

---

## 5. Non-Functional & Structural Constraints
- **Database Threading**: SQLite is initialized with `check_same_thread=False` and enforces foreign key integrity via `PRAGMA foreign_keys = ON`.
- **Image Size Limits**: Enforced strictly at the router layer (max 10MB).
- **Export Sandbox**: Built outputs and uploaded files are separated into `/backend/uploads` and `/backend/outputs` directories (automatically created during lifecycle startup).
