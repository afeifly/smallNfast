# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Backend
cd backend && source .venv/bin/activate && python run.py          # Start API server on :8003

# Frontend
cd frontend && npm run dev                                          # Start Vite dev server on :5173
npm run build                                                       # Production build
```

No test suite, linter, or type-checker is configured.

## Architecture

**Permissions model**: three roles — `admin`, `team_leader`, `employee`. Admins manage projects/users/settings but cannot log time. Team Leaders manage and verify their assigned employees' timesheets. Employees log their own time only. Each employee has a `team_leader_id` FK to a TL user.

**Backend** (FastAPI + SQLModel + SQLite WAL mode)
- `backend/app/main.py` — app creation, CORS, router registration (`/auth`, `/projects`, `/timesheets`, `/reports`, `/users`, `/settings`, `/cost-centers`, `/workdays`, `/backups`), startup event that seeds default projects + admin user and starts the scheduler.
- `backend/app/models.py` — all SQLModel tables: `User`, `Project`, `Timesheet`, `WorkDay`, `ActivityLog`, `SMTPSettings`, `UserProjectLink`. Users↔Projects is a many-to-many via `UserProjectLink`.
- `backend/app/database.py` — SQLite engine, WAL pragmas, session dependency generator.
- `backend/app/core/security.py` — JWT creation, Argon2 password hashing with bcrypt fallback for legacy hashes.
- `backend/app/core/scheduler.py` — APScheduler background jobs: Monday 10am compliance emails (timesheet missing + approval pending), daily 3am DB backup, daily 3:30am old-backup cleanup.
- `backend/app/api/deps.py` — JWT-based `get_current_user` and `get_current_admin_user` FastAPI dependencies.
- `backend/app/api/auth.py` — `/token` (OAuth2 password flow), `/login-as/{user_id}` (admin impersonation).
- `backend/app/api/timesheets.py` — core business logic: single and batch upsert with weekly hour limits (dynamic based on WorkDay exceptions: WORK=8h, HALF_OFF=4h, OFF=0h), off-day enforcement, 2-week (single) / 30-day (batch) edit windows for employees, TL day-verification endpoint.
- `backend/app/services/email_service.py` — SMTP-based compliance/approval reminder emails (BCC to users).
- `backend/app/services/backup_service.py` — SQLite `VACUUM INTO` backups, restore with super-code auth (base64-encoded password+today's date), WAL file cleanup on restore.

**Frontend** (Vue 3 + Vite + Element Plus + Pinia)
- `frontend/vite.config.js` — proxies `/api` → `http://127.0.0.1:8003` (strips `/api` prefix).
- `frontend/src/api/axios.js` — Axios instance with auth token injection and 401→login redirect.
- `frontend/src/stores/auth.js` — Pinia store: JWT stored in localStorage, decoded client-side for role/user info.
- `frontend/src/router/index.js` — role-based route guards: `requiresAuth`, `requiresAdmin`, `requiresTeamLeader`. Admin-only routes: `/logs`, `/email-settings`, `/backups`, `/workdays`. TL-only: `/team-timesheets`. Lazy-loaded views for non-core pages.

**Timesheet upsert logic**: POST to `/timesheets/` uses `upsert_timesheet_logic` — if a record for (user, project, date) exists, it updates; otherwise creates. Batch endpoint iterates per-week, validates limits across the simulated week state, deletes zero-hour records, and handles deduplication.

**Soft-delete pattern**: `User.is_deleted` and `Project.is_deleted` flags; queries filter `is_deleted == False`.

**State changes are logged**: every create/update/delete writes an `ActivityLog` row with user, action, and details.
