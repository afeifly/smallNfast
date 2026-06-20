# Rule 10-domain-analysis.md: Demand Analysis & Business Context Guidelines (Timesheet Lite)

This rule guides the AI during the initial project scoping phase to perform Bounded Context decomposition and Domain-Driven Design (DDD) on product requirements located in the `docs/prd/` directory. This ensures a unified consensus on project scope and design granularity across teams.

## 1. Trigger Scenario & Goal
- **Trigger**: When analyzing any raw requirement document, feature specifications, or user stories in the `docs/prd/` directory.
- **Core Objective**: Automatically structure and identify domain boundaries and business invariants, providing a standardized model skeleton for API contract design and backend services.

---

## 2. Domain Modeling & Entity Design Guidelines
When processing requirements, the AI **must** strictly apply Domain-Driven Design principles using the following classifications:

### A. Domain Model Classifications
- **Core Entities**:
  - **User**: Identity details, user account settings, permission roles (`admin`, `team_leader`, `employee`), and soft-deletion flags (`is_deleted`).
  - **Project**: Project status (`RUN`, `CLOSE`, `NOT_START`), project-to-user links, and soft-deletion status (`is_deleted`).
  - **Timesheet**: Work hours logged (`hours`) by a specific user for a specific project on a given date, along with the approval verification status (`verify`).
  - **WorkDay**: Exception calendar day exceptions (`WORK`/`OFF`/`HALF_OFF`), used to dynamically override the day's maximum hours capacity.
  - **ActivityLog**: Audit entries capturing state transitions and administrative actions.
- **Value Objects**:
  - **Role**: `admin`, `team_leader`, `employee`.
  - **WorkDayType**: `work` (8h capacity), `off` (0h capacity), `half_off` (4h capacity).
  - **ProjectStatus**: `RUN`, `CLOSE`, `NOT START`.

### B. Bounded Context Classifications
The AI must classify business subdomains into one of two contexts:
1. **Heavy-Duty & Background Processes Context**:
   - **Reporting & Export Context**: Summary calculations, weekly/monthly hours aggregations, and generating Excel files (`xlsx`/`exceljs` or openpyxl).
   - **Scheduler & Mail Compliance Context**: Background cron jobs (such as Monday 10:00 AM compliance checking for missing timesheets or pending approvals) and SMTP reminder dispatching.
   - **System Operations Context**: Database hot backups (`VACUUM INTO`), old backup cleanups, database restoration, and authorization security verification.
2. **Lightweight User Interaction Context**:
   - **Timesheet Logging Context**: Weekly log grid loading, daily hours adjustments (via sliders from 0 to 8h), and dynamic weekly hours limit validation.
   - **Verification Context**: Team Leaders reviewing, editing, and verifying employee timesheet states.
   - **Metadata CRUD Context**: Administrators managing user accounts, project configurations, workday exceptions, and applying `is_deleted` filters.

---

## 3. Standard Analysis Output Skeleton
When responding to analysis tasks, the AI **must** output its findings using the following Markdown template:

```markdown
# Domain-Driven Design (DDD) Analysis Report

## 1. Bounded Contexts & Classifications
*Provide context names, responsibilities, and classification (Heavy-Duty / Lightweight).*

## 2. Core Domain Entities & Attributes
- **[Entity Name]**:
  - Attributes: *Attribute list and data types*
  - Business Rules & Ownership: *e.g., Employees read/write own logs only, Team Leaders verify assigned employees, etc.*

## 3. Business Invariants & Work Hour Constraints
- **Hours Validation Exception Calendar**: Maps WorkDayType to capacity limits (WORK=8h, HALF_OFF=4h, OFF=0h).
- **Edit Window Cutoffs**: Timeframes allowed for logging edits (e.g., 2 weeks for single log adjustments, 30 days for batch uploads).

## 4. Execution & Offloading Strategy
- Identify which endpoints must run asynchronously via `BackgroundTasks` or background jobs rather than blocking the main FastAPI event loop.
```
