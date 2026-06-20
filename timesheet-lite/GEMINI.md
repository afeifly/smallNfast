# GEMINI.md: Code Development & Logical Constraints (Timesheet Lite)

This file sets the core performance and business requirements for the development phase of the `timesheet-lite` project. Both developers and AI coding assistants **must** strictly enforce the following rules when writing or refactoring FastAPI (Python) or Vue 3 (Element Plus) code.

---

## 1. Automatic Integration & Contract Adherence
- **Payload Naming Standard**: Prior to generating logic, the AI must check the endpoint definitions. Frontend JSON requests and backend SQLModel serializers **must strictly map properties using `snake_case` naming** (e.g., `user_id`, `project_id`, `day_type`, `team_leader_id`, `is_deleted`).
- **Role-Based Guards**:
  - `admin`: Performs project, account, workday exception setup, and manages database configurations. **Strictly prohibited** from logging work hours.
  - `team_leader`: Review, edit, and verify work logs of assigned employees only.
  - `employee`: Logs, views, and edits own logs only.
  - Core controller dependencies must verify user session JWT credentials and role restrictions.

---

## 2. Event Loop Optimization & DB Integrity (Main Loop & DB Guard)
> [!WARNING]
> **Heavy administrative background operations (backups, restores, notifications) must never block the main FastAPI request thread!**

- **Asynchronous Task Offloading**: Data operations such as SQLite `VACUUM INTO` backups, DB restorations, and weekly compliance checks must execute inside FastAPI `BackgroundTasks` or cron jobs (via `APScheduler`) so the API response remains non-blocking.
- **Soft-Delete Invariants**:
  - Any removal commands for `User` or `Project` must map to soft deletes (setting `is_deleted = True`).
  - Active search queries on these tables must include the condition `is_deleted == False` to exclude deleted records.
- **Audit Logging**:
  - Every create, edit, or delete event targeting `Timesheet`, `User`, or `Project` **must** insert a record in the `ActivityLog` table capturing the initiating user, timestamp, action type, and details.

---

## 3. Frontend Work Logs Validation & Interface Rules (LogWork Logic)
- **Workday Overrides (`WorkDayException`)**:
  - Timesheet submission limits must correlate with exceptions defined in `WorkDay`. AI must compute the daily hour capacity dynamically:
    - `work`: Maximum capacity is 8 hours.
    - `half_off`: Maximum capacity is 4 hours.
    - `off`: Maximum capacity is 0 hours (slider inputs disabled, input fields set to read-only).
- **Edit Window Enforcement**:
  - Regular employees (`employee`) must not edit logs outside of validation windows: single timesheet changes are limited to **2 weeks** in the past; batch inputs are limited to **30 days** in the past. Older changes must be rejected by the backend.
- **Verification Lock**:
  - If a daily entry is verified by a Team Leader (`verify = True`), all input controls (sliders and buttons) associated with that day must be set to **disabled**.
- **Weekly Hour Limits Warning**:
  - The frontend must evaluate the weekly hours total against the calculated weekly limit. If the total exceeds the limit, display an Element Plus `el-alert` warning (`type="error"`) and disable the save button.
- **Table Paging Optimization**:
  - Large tabular reports on the client side must use Element Plus pagination or virtual scroller techniques to prevent UI thread freezes.

---
*Ensure these core rules are loaded and obeyed before implementing code on the timesheet-lite repository.*
