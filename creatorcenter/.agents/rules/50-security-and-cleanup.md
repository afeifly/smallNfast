# Rule 50-security-and-cleanup.md: Code Security & Database Integrity (Creator Center)

This rule governs code safety, credentials management, and database query security. AI and developers **must** strictly adhere to these guidelines to prevent credential leaks, SQL injection, and path traversal vulnerabilities.

## 1. Trigger Scenario & Activation
- **Trigger**: When editing sensitive configurations, third-party translation providers, document parsing workflows, or database models.
- **Activation Mode**: Always On (acts as a global guardrail for all code generation).

---

## 2. Credentials & Environment Variable Safety
- **No Hardcoded Secrets**: Under no circumstances should translation provider API keys (`TRANSLATION_API_KEY`, `MINIMAX_API_KEY`) or system secrets be hardcoded in the codebase.
- **Environment Management**: Secrets must be loaded dynamically using environment variables or a `.env` file (utilizing `python-dotenv` as configured in [config.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/config.py)).
- **Git Safety Check**: Ensure that `.gitignore` contains exclusions for `.env`, `*.db` (such as `transt.db`), `uploads/`, `outputs/`, `node_modules/`, and `.venv/` to prevent committing configuration secrets and user assets.

---

## 3. Database Security & Injection Prevention
- **Use parameterized bindings**: Always query database tables using parameter binding to prevent SQL injection:
  ```python
  # Safe SQL Parameter Binding
  db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
  ```
- **No String Concatenation in Queries**: Never use raw string formatting or f-strings to concatenate user-supplied inputs directly into SQL queries.

---

## 4. File Upload Safety & Directory Traversal
- **Filename Sanitization**: Uploaded files (both documents and images) must have their names sanitized. The server must prepend or replace filenames with unique hashes/UUIDs (e.g., using `uuid.uuid4().hex`) to prevent directory traversal attacks (such as uploading files containing `../` sequences).
- **MIME Type Validation**:
  - Restrict image uploads strictly to standard web image formats: `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`.
  - Restrict document uploads strictly to `.docx` or `.md` formats.
- **Size Limits**:
  - Document uploads must not exceed `50MB`.
  - Image uploads must not exceed `10MB`.
  Enforce these constraints explicitly at the FastAPI router layers prior to writing file contents to disk.
