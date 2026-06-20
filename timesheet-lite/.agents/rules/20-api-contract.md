# Rule 20-api-contract.md: API Design & Contract Guidelines (Timesheet Lite)

This rule governs the API design phase, ensuring that generated network request/response structures, database models, and client API configurations remain strictly aligned between the FastAPI backend and Vue 3 frontend, preventing serialization mismatches.

## 1. Trigger Scenario & Goal
- **Trigger**: When the AI writes FastAPI route endpoints, SQLModel database definitions, or client-side HTTP request/response interfaces (Axios clients, Pinia stores).
- **Core Objective**: Enforce a strict naming and serialization interface, keeping integrations secure, and matching performance and validation constraints at the interface level.

---

## 2. API Design Guidelines

### A. Mandatory Snake Case Naming (`snake_case`)
- **Strict Convention**: To match Python and SQLModel standards, all JSON request and response payloads **must strictly utilize `snake_case` naming** for attributes and keys. Camel case (`camelCase`) is prohibited in API payloads.
- **Example Keys**: `user_id`, `project_id`, `day_type`, `team_leader_id`, `is_deleted`, `access_token`, `sender_email`.

*Axios Client Payload Example*:
```javascript
// Axios request payload must map backend's expected snake_case properties
const payload = {
  user_id: authStore.user.id,
  project_id: row.id,
  date: currentDate,
  hours: parseFloat(hours)
};
```

### B. Element Plus Tag State Mapping
All status or validation properties returned in API models should map directly to semantic type properties (`success` / `warning` / `danger` / `info`) used in Element Plus UI components (tags, progress alerts):
- **Verified / Compliant (Verified / Limit Ok)**: Returns status values mapped to Element Plus tag type `success` (green color indicator).
- **Pending Verification / Partial Exemptions (Pending / Half Off)**: Returns status values mapped to Element Plus tag type `warning` (yellow color indicator, e.g. `half_off` workdays).
- **Unverified / Non-Working Exceptions (Unverified / Off Day)**: Returns status values mapped to Element Plus tag type `danger` (red color indicator, e.g. `off` weekends/holidays).

*SQLModel Enums Mapping Example*:
```python
# FastAPI Pydantic/SQLModel definition
class WorkDayType(str, Enum):
    WORK = "work"       # Maps to default UI label
    OFF = "off"         # Maps to Element Plus tag type 'danger'
    HALF_OFF = "half_off" # Maps to Element Plus tag type 'warning'
```

### C. Asynchronous Background Task Contracts
- **Large Dataset Transactions**: Weekly timesheet reports, monthly summaries, and mass data exports must support page-based offset query parameters or date-range parameters to minimize JSON payload sizes.
- **Asynchronous Execution**: Heavy administrative endpoints (such as database VACUUM backups, backup restorations, and weekly compliance email checking) **must be designed as asynchronous, non-blocking APIs**.
  - Route handlers must return early status confirmations (e.g., `{"status": "PROCESSING", "task_id": "job_01"}`) and delegate tasks to FastAPI `BackgroundTasks` or the background scheduler (`APScheduler`).

### D. RESTful Conventions
- API endpoints must use lowercase path routing ending with a trailing slash (`/`), e.g., `/timesheets/`, `/projects/`, `/users/`.
- Apply standard HTTP Methods: `GET` (query), `POST` (create / batch updates), `PUT`/`PATCH` (edit), `DELETE` (delete / soft-delete).
- Deletion requests must execute a **soft-delete** workflow: update `is_deleted = True` and record action in the `ActivityLog` table. Databases records should not be physically deleted.

---

## 3. Warning Header in Contract Files
When generating TypeScript definitions or backend API schemas, the AI must append the following header at the top of the file:
```javascript
/**
 * @file API Contract
 * WARNING: This is a strict contract file generated according to .agents/rules/20-api-contract.md.
 * DO NOT modify manually without aligning both UI and Worker architectures.
 */
```
