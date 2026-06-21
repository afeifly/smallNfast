# GEMINI.md - Timesheet Lite Project Rules & Context

This document is the single source of truth for developer and agent alignment on patterns, architectures, and guidelines for the Timesheet Lite codebase.

---

## 1. Project Context

Timesheet Lite is a lightweight timesheet management web application structured with a decoupled frontend and backend:
* **Frontend:** Vue 3, Vite, Pinia (State Management), Element Plus (UI Component Library), Axios (HTTP client).
  - Target URL: `http://localhost:5173` (development) proxied via `/api` to the backend.
* **Backend:** FastAPI, SQLModel (ORM integrating SQLAlchemy & Pydantic), SQLite (with WAL mode enabled), APScheduler (for cron-like background jobs).
  - Target URL: `http://127.0.0.1:8003` (development).
* **Database & Storage:** Single local SQLite database, using `VACUUM INTO` for backup scheduling.

---

## 2. Core Business & Concurrency Constraints

* **Database Engine:** SQLite in WAL (Write-Ahead Logging) mode. All writes should be quick to prevent locking issues.
* **Role-Based Authorization:**
  - `admin`: Manages settings, users, workdays, backups, SMTP settings, view activity logs. *Cannot log time.*
  - `team_leader`: Manages and verifies assigned employees' timesheets. Can view team reports.
  - `employee`: Logs their own timesheet entries. Has weekly hour limit checks.
* **Timesheet Constraints:**
  - **Dynamic Weekly Limits:** Calculated dynamically based on `WorkDayType` exceptions (`WORK` = 8h, `HALF_OFF` = 4h, `OFF` = 0h). Default is 40h per week (Mon-Fri 8h/day).
  - **Off-Day Enforcement:** Cannot log time on a day explicitly marked as `OFF` (holiday/vacation).
  - **Edit Windows:** Employees can modify individual entries up to the previous 2 weeks, and batch entries up to the previous 30 days. No modifications allowed on verified timesheets by employees.
* **Background Jobs (APScheduler):**
  - **Compliance Emails:** Scheduled for Monday at 10:00 AM (reminds users with missing timesheets or pending approvals).
  - **Backup Schedule:** Scheduled daily at 3:00 AM.
  - **Backup Cleanup:** Scheduled daily at 3:30 AM (deletes old backups).

---

## 3. Design System & UI Guidelines

* **Theme:** Light/Dark responsive design using curated slate colors and deep primary tints.
* **Palette:**
  - Primary: Deep violet/blue (#6366f1) and Indigo gradients.
  - Secondary/Success: Emerald green (#10b981).
  - Warning: Amber (#f59e0b).
  - Danger/Error: Rose red (#f43f5e).
  - Neutral Dark: Slate (#0f172a / #1e293b).
  - Neutral Light: Cool gray (#f8fafc / #f1f5f9).
* **Typography:** Modern sans-serif (e.g., Inter, system font fallback) instead of browser defaults.
* **Component Library:** Use Element Plus for structures (buttons, forms, modals, tables, calendars, tooltips). Apply custom CSS overrides for premium styling, subtle drop shadows, and rounded borders.
* **Animations:** 
  - Smooth 150ms transitions on hover (`transform: translateY(-1px)`, opacity changes).
  - Glassmorphic accents on navigation and dashboard panels (`backdrop-filter: blur(12px)`).
  - Micro-animations for button presses and load states.

---

## 4. Frontend/Backend Standards

### Backend (Python/FastAPI)
* **Code Structure:** Separate routes into APIRouter submodules in `backend/app/api/`. Keep database models in `backend/app/models.py`.
* **API Contracts:** Use `snake_case` naming conventions for all request/response JSON fields.
* **Dependency Injection:** Inject active database sessions via FastAPI's `Depends(get_session)` and current user via `Depends(get_current_user)`.

### Frontend (Vue 3 + Vite)
* **Framework:** Vue 3 using the Composition API (`<script setup>` syntax) and CSS variables for styling.
* **State Management:** Use Pinia stores for authentication, app state, and configurations.
* **Routing:** Use Vue Router with route meta guards (`requiresAuth`, `requiresAdmin`, `requiresTeamLeader`) to protect views.

---

## 5. Error Handling & Feedback Protocols

* **Backend Error Format:** Raise `HTTPException` with appropriate status code and `detail` payload string.
* **Frontend Error Handlers:**
  - Axios interceptors must trap `401 Unauthorized` and redirect to `/login`.
  - Display business validation errors or request failures using Element Plus `ElMessage.error()` or `ElNotification`.
* **Feedback States:** Ensure all asynchronous API submits have loading states (`v-loading` or local reactive flags) to prevent duplicate submissions.

---

## 6. Developer & Agent Interaction Protocol

When proposing a new feature or modification:
1. **Analyze existing contexts** to verify where domain logic lives (do not duplicate logic in both frontend and backend).
2. **Strictly adhere to the rules in `.agents/rules/`**.
3. **Template for proposed changes:**
   - File modification path
   - Purpose & Business logic justification
   - Dependency / side effects mapping
