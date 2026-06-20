# Product Requirement Document (PRD) - Timesheet Lite

Timesheet Lite is a lightweight, role-based timesheet management application designed to track employee work hours on assigned projects, enforce labor compliance rules, facilitate approvals, and manage data backups.

---

## 1. Objectives & Target Audience
- **Target Audience**: Internal teams consisting of administrators, team leaders, and employees logging hourly activities.
- **Key Objectives**:
  - Provide a simple grid and slider interface for employees to log work hours.
  - Dynamically calculate weekly hour limits and enforce workday overrides (holiday/half-day exemptions).
  - Implement a verification workflow (approvals) managed by Team Leaders.
  - Automate administrative tasks such as compliance checking, mailing, and database backups.

---

## 2. User Roles & Permission Model
The system enforces three distinct user roles:

| Role | Timesheet Logging | Approvals / Verification | System Settings & Backups | View Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Employee** | Allowed (own logs only) | Not allowed | Not allowed | Can view own timesheets, stats, and assigned projects. |
| **Team Leader** | Allowed (own logs only) | Allowed for assigned employees | Not allowed | Can view and verify timesheets of assigned employees (`team_leader_id` link). |
| **Admin** | **Strictly Prohibited** | Not allowed | Full access (Users, Projects, Exceptions, SMTP, Backups) | Global view of system metrics, activity logs, and settings. |

### Access & Impersonation (Admin Only)
- Admins have access to a "Login As" feature, allowing them to impersonate any user for troubleshooting purposes without knowing their password.

---

## 3. Functional Modules

### 3.1 Timesheet Logging & Grid (`LogWork`)
- **Project Selection**:
  - The UI automatically loads projects that are marked as **Default** (`is_default = true`) OR are explicitly **Assigned** to the employee (via `UserProjectLink`).
  - Sorted to show Assigned projects first, followed by Default projects.
- **Weekly Calendar Grid**:
  - Displays days from Monday to Sunday for the selected week.
  - Uses an interactive slider (`el-slider`) for hour inputs (0 to 8 hours).
  - Automatically disables sliders on **Off Days** (`off` day-type exceptions or weekends).
  - Automatically restricts the maximum selectable hours on a slider based on hours logged on other projects for that day (daily limit constraint).
- **Edit Window Constraints**:
  - Single-day edits: Allowed only for the current week and the previous **2 weeks** for standard employees.
  - Batch edits: Cutoff date is **30 days** in the past.
- **Approval Lockout**:
  - If a day is approved (`verify = true`), all input elements (sliders and save button) for that day are disabled.
  - Week Approval state: A week is considered approved if all days are verified or marked as off days.
- **Auto-Cleanup**:
  - Timesheet entries with `hours = 0` are automatically removed from the database during save actions to optimize space and prevent incomplete verification checks.

### 3.2 Team Verification (`TeamTimesheets`)
- **TL View**:
  - Allows Team Leaders to select from their assigned employees and navigate through calendar weeks.
  - Displays daily totals and project breakdowns.
- **Verify Logic**:
  - A Team Leader can mark a specific day as "Verified" (`verify = true`).
  - **Constraint**: Cannot verify a day if total logged hours exceed 8 hours.
  - Once verified, the employee's edit permissions are locked.

### 3.3 Dashboard & Reports
- **Dashboard Stats**:
  - **Admin**: Shows global counts of active users and custom projects.
  - **Employee/TL**: Shows total verified hours, custom project counts, and a breakdown chart (hours per project and percentages).
- **Weekly Reports**:
  - Admin/TL can generate weekly reports for a specific date range.
  - Displays users as rows and projects as columns, listing accumulated hours.
  - **Excel Export**: Enables downloading the weekly report grid in `.xlsx` format (using `exceljs` or `xlsx` client-side).

### 3.4 Administration & Metadata Management (Admin Only)
- **User Management**:
  - CRUD operations for accounts.
  - Attributes: Username, Email, Full Name, Cost Center, Active Date Range, Password (stored as Argon2/bcrypt hash), Role, and Team Leader assignment.
  - Employs **Soft-Delete** (`is_deleted = true`); deleted users are filtered out from all regular queries.
- **Project Management**:
  - CRUD operations for projects.
  - Attributes: Name, Full Name, Chinese Name, Custom ID, Status (`RUN`, `CLOSE`, `NOT START`), Active Date Range, Description, Default flag, and Remark.
  - Employs **Soft-Delete** (`is_deleted = true`).
- **Workday Exception Management**:
  - Defines overrides for specific dates (e.g., public holidays, weekend makeup workdays).
  - Types: `work` (8 hours capacity), `off` (0 hours capacity), `half_off` (4 hours capacity).
- **Email Settings (SMTP)**:
  - Settings for SMTP Server, SMTP Port, SMTP Username/Password, Sender Email, and a checking service toggle.
- **Backup & Restore Manager**:
  - **Backup Action**: Creates database snapshots using SQLite `VACUUM INTO` command to ensure transactional integrity of the backup file.
  - **Cleanup Action**: Automatically deletes backups older than 30 days.
  - **Restore Action**: Overwrites the active `database.db` file.
    - **Security requirement**: Must provide a "Super Code" to authorize restoration.
    - **Super Code verification**: The token must be a Base64-encoded string containing the admin password concatenated with today's date in `YYYY-MM-DD` format (e.g., `Base64("password2026-06-19")`).
    - **Restore execution**: Disposes the active database engine connections, replaces the DB file, and explicitly deletes stale `-wal` and `-shm` transaction files to prevent data corruption.

---

## 4. Automated Background Tasks (Scheduler)
An active background scheduler (such as `BackgroundScheduler` in FastAPI) executes tasks automatically:
1. **Compliance Email Reminder (Mondays at 10:00 AM)**:
   - Evaluates timesheet logging compliance for the prior week: dispatches warning emails to users with incomplete logs.
   - Evaluates approval compliance: dispatches reminder emails to Team Leaders with pending timesheets.
2. **Automated Database Backup (Daily at 3:00 AM)**:
   - Initiates database backup via `VACUUM INTO`.
3. **Automated Backup Cleanup (Daily at 3:30 AM)**:
   - Searches and deletes backup files older than 30 days.

---

## 5. Non-Functional & Structural Constraints
- **Database System**: SQLite running in WAL (Write-Ahead Logging) mode.
- **Auditing**: Every create, update, or delete action regarding Timesheets, Projects, or Users must append a record in the `ActivityLog` table.
- **Case Convention**:
  - Python/FastAPI backend and SQLModel fields utilize `snake_case`.
  - Frontend Vue 3 / Axios payloads must match the `snake_case` properties exactly during network communication to ensure accurate serialization.
