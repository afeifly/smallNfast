# Product Requirements Document (PRD) - Document Publishing & Sharing

## Metadata
* **Date**: 2026-06-22
* **Author**: Antigravity
* **Version**: 1.0.0
* **Status**: Draft

---

## 1. Objective
Enable users of Creator Center to publish their translated documents (both DOCX and Markdown formats) to a publicly accessible, read-only webpage. 
This webpage will:
1. Be accessible via a short link containing a unique 6-character random alphanumeric code (e.g., `https://creatorcenter.com/share/abc123`).
2. Require no password protection or session authentication to view.
3. Restrict navigation to prevent visitors from accessing any editing features, list views, or other projects (except for navigating back to the Home landing page).

---

## 2. User Stories
* **US1 (Publishing)**: As an logged-in user viewing a project's detail page, I want to click a "Publish" button to make the project public and generate a shareable short URL.
* **US2 (Unpublishing)**: As a logged-in user, I want to be able to "Unpublish" a project at any time, instantly revoking public access to the shared link.
* **US3 (Public Viewing)**: As a visitor/reader with the share link, I want to open the URL and see a beautifully formatted, read-only version of the translated document in its target language.
* **US4 (Restricted Navigation)**: As a visitor/reader on the share page, I want the header/layout to exclude links to project listings, translation keys, or edit controls, only allowing me to go to the main landing page (which asks for a password to protect the workspace).

---

## 3. Functional Requirements

### 3.1 Project Details - Publish Settings
* Add a "Publish" card/section or button on the [ProjectDetailPage](file:///Users/ex/project/smallNfast/creatorcenter/frontend/src/pages/ProjectDetailPage.tsx).
* When clicked:
  * Generates a 6-character random alphanumeric code (using a cryptographically secure random generator or standard robust random sampling of `[a-zA-Z0-9]`).
  * Persists the `share_code` and sets `is_published = 1` in the database.
  * Displays the share link (e.g. `http://localhost:5173/share/{share_code}`) with a "Copy to Clipboard" helper.
* If the project is already published:
  * Show a badge indicating "Published".
  * Show the share link.
  * Provide an "Unpublish" button that resets `is_published = 0`.

### 3.2 Public Share Page (`/share/:code`)
* A dedicated public page mapped to `/share/:code` in the React frontend.
* Excluded from the global `<Layout>` authentication checks.
* Renders the fully translated document:
  * **For Markdown Projects**: Rebuilds and displays the translated markdown content.
  * **For DOCX Projects**: Displays a clean, scrollable segment-by-segment read-only preview of the translated text (excluding ignored segments).
* Includes a minimal header showing the project name, the translation target language, and a single "Home" navigation link pointing back to `/`.

### 3.3 Public API Endpoint (`/api/share/:code`)
* A public route on the FastAPI backend: `GET /api/share/{code}`.
* Excluded from the `verify_session` dependency.
* Checks if a project matching `share_code` exists and has `is_published = 1`. If not, raises a `404 Not Found` exception.
* Returns:
  * Project metadata (name, content_type, source_lang, target_lang).
  * Rebuilt content (for markdown, the reconstructed markdown string; for docx, the sequential list of translated text segments).

---

## 4. Technical & Security Constraints
* **Random Share Code**: Must be exactly 6 characters containing `[a-zA-Z0-9]`. Database constraint must enforce uniqueness of `share_code`.
* **Zero-Auth Reading**: The API endpoint `/api/share/{code}` must NOT run JWT/session verification checks.
* **Database Updates**: Add `share_code TEXT UNIQUE` and `is_published INTEGER NOT NULL DEFAULT 0` columns to the `projects` table. Enforce SQLite schema migration.
* **Snake Case Naming**: Ensure all backend Pydantic models and frontend response bodies match standard `snake_case` keys (e.g. `share_code`, `is_published`).
