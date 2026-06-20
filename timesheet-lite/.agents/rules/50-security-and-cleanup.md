# Rule 50-security-and-cleanup.md: Code Security & Database Integrity (Timesheet Lite)

This rule governs code safety, credentials management, and database query security. AI and developers **must** strictly adhere to these guidelines to prevent credential leaks, SQL injection, and database locking issues.

---

## 1. Trigger Scenario & Activation
- **Trigger**: When editing sensitive configurations, backend route validators, database models, or authentication handlers.
- **Activation Mode**: Always On (acts as a global guardrail for all code generation).

---

## 2. Credentials & Environment Variable Safety
- **No Hardcoded Secrets**: Under no circumstances should passwords, SMTP credentials, JWT secret keys, or security tokens be hardcoded in the codebase.
- **Environment Management**: Secrets must be loaded dynamically using environment variables or a `.env` file (utilizing Pydantic `BaseSettings` or `os.getenv`).
- **Git Safety Check**: Ensure that `.gitignore` contains exclusions for `.env`, `*.local`, `venv/`, and `.venv/` to prevent committing configuration secrets.

---

## 3. Database Security & Injection Prevention (SQLModel)
- **Use parameter bindings**: Always query database tables using SQLModel ORM statements (`select(Model).where(Model.attribute == value)`).
- **No String Concatenation in Queries**: Never use raw string formatting or f-strings to concatenate inputs directly into database queries (e.g., `text(f"SELECT * FROM user WHERE username = '{username}'")`), as this exposes the system to SQL Injection attacks.
- **Safe Raw Executions**: If raw SQL execution is required, parameterize the inputs:
  ```python
  # Safe SQL Parameter Binding
  session.exec(text("SELECT * FROM user WHERE username = :name"), {"name": username})
  ```

---

## 4. Connection Disposal & Backup Restores
- **Engine Disposal**: When executing low-level sqlite operations (such as restoring database files or truncating files), you must first dispose of the SQLAlchemy engine (`engine.dispose()`) to close all open socket connections. This prevents file locking errors on SQLite.
- **WAL Invariant**: After replacing/restoring database files under WAL (Write-Ahead Logging) mode, you must explicitly search for and remove any associated `.db-wal` or `.db-shm` files to prevent SQLite from applying stale logs to the newly restored file.

---

## 5. Passwords & Tokens Validation
- **Secure Password Hashing**: Passwords must be hashed using a strong hashing algorithm (Argon2 or bcrypt). Plain text comparisons are strictly prohibited.
- **JWT Verification**: JWT verification endpoints must check token expiration (`exp` claim), verify signature integrity using the configured environment secret, and confirm the subject claims before authorizing requests.
