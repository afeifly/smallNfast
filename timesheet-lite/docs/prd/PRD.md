# Product Requirements Document (PRD) - Timesheet Lite Baseline

## Metadata
* **Creation Date:** 2026-06-21
* **Author:** Antigravity AI
* **Version:** 1.0.0
* **Status:** Approved

---

## 1. Objective

### Problem Statement
Organizations need a lightweight, low-overhead system for logging and tracking timesheets. Standard enterprise tools are often overly complex, slow, and expensive. Team leaders need simple tools to verify hours worked, and admins need standard interfaces to manage settings, users, and backups.

### Target Audience
* **Employees:** General staff who log hours worked on assigned and default projects.
* **Team Leaders:** Managers who oversee specific employees, verify timesheets, and view team productivity reports.
* **Admins:** System administrators who configure system preferences (SMTP, default values), manage cost centers, projects, work days (holiday exceptions), and maintain backups.

### Business Goals
* Provide a clean, fast timesheet submission interface.
* Prevent logging of excessive hours through dynamic weekly limits and holiday checks.
* Streamline the validation/approval flow via Team Leader verification.
* Ensure data safety with automated and manual database backups.

---

## 2. User Stories

### Employee
1. *As an Employee*, I want to log my daily hours against my assigned projects or default projects, so that my work is tracked.
2. *As an Employee*, I want to submit batch timesheets for an entire week, so that I don't have to submit them day-by-day.
3. *As an Employee*, I need to be prevented from logging hours on designated off-days (holidays/vacations) or exceeding the weekly hours limit.
4. *As an Employee*, I should not be allowed to modify my timesheets if they are older than 2 weeks (single entry) or 30 days (batch entry), or if they have already been verified by my Team Leader.

### Team Leader
1. *As a Team Leader*, I want to view my team members' logged hours, so that I can monitor their workload.
2. *As a Team Leader*, I want to verify (approve) timesheet entries for my assigned team members, so that finance/HR can process them.
3. *As a Team Leader*, I want to view dynamic reporting dashboards showing project hour distributions.

### Admin
1. *As an Admin*, I want to manage users, roles, cost centers, and project registrations, so that the organization's structure is up to date.
2. *As an Admin*, I want to configure workday exceptions (e.g. marking a weekday as a holiday or weekend as a make-up day), so that weekly limits are dynamically updated.
3. *As an Admin*, I want to setup SMTPSettings for reminders and check the activity logs of all users.
4. *As an Admin*, I want to impersonate employees/team leaders to troubleshoot bugs or check specific configurations.
5. *As an Admin*, I want to perform manually triggered database backups and restores, so that system data can be easily recovered.

---

## 3. Functional Requirements

### 3.1 Authentication & Impersonation
* JWT-based token generation and authentication.
* Admin impersonation flow allows the admin to log in as any user ID directly to verify frontend display and resolve user issues.

### 3.2 Projects & Cost Centers
* Projects can have statuses: `NOT START`, `RUN`, `CLOSE`.
* Default projects (e.g., "Research", "Maintenance") are automatically visible to all users. Non-default projects must be linked to users via a many-to-many relationship (`UserProjectLink`).
* Projects and Users support a soft-delete mechanism via `is_deleted` flags to preserve historical timesheet associations.

### 3.3 Timesheet Logging & Limits
* **Weekly Limit Calculation:** Dynamic calculations based on Monday-Sunday ISO weeks. Standard days log 8 hours. Workday exceptions adjust this: `WORK` adds 8h, `HALF_OFF` adds 4h, `OFF` adds 0h.
* **Off-day Enforcement:** Any date defined as `OFF` rejects inputs greater than 0 hours.
* **Edit Windows:** Employees cannot modify timesheets older than 14 days (single entry) or 30 days (batch entry) unless they are admins or team leaders.
* **Deduplication:** Multiple entries for the same user, project, and date are resolved. Batch submissions overwrite existing entries for matching keys. Zero-hour submissions delete the entry.

### 3.4 Verification & Approvals
* Team leaders can execute `/timesheets/verify` to approve an employee's work hours on a specific date.
* Once verified (`verify = True`), employees cannot modify the timesheet.
* Team leaders cannot verify hours exceeding 8 hours per day for a single employee.

### 3.5 Automation & Backups
* **Email Reminders:** Automated reminder emails sent every Monday at 10:00 AM using configured SMTP credentials to notify users of missing timesheets and team leaders of pending verifications.
* **Backups:** SQLite backups are executed using SQL's `VACUUM INTO` command to ensure database consistency in WAL mode. Automated daily backup at 3:00 AM and cleanup of files older than retention policy at 3:30 AM.

---

## 4. Technical & Security Constraints

* **Database Constraint:** SQLite WAL mode requires active database connections to execute transactions quickly to prevent table locking.
* **Input Sanitation:** All batch and single inputs must validate datetime constraints, date formats, and numerical values.
* **Access Control:** Role-based access is strictly enforced on all routers. Custom dependencies (`get_current_admin_user`, `get_current_user`) evaluate JWT payload parameters.
