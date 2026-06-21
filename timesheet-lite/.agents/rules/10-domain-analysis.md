# Rule: Domain Analysis Guidelines

All agents working on this project must follow these Domain-Driven Design (DDD) domain analysis guidelines.

---

## 1. Domain Classification
* **Lightweight Contexts:** UI rendering, basic form validations, state tracking, and local navigation. Minimize business logic duplication here.
* **Heavy-Duty/Transactional Contexts:** Backend routers, service layers, and database logic. These handle transactional consistency, invariants checking, permissions enforcement, and state serialization.
* **Asynchronous/Offloading Contexts:** Heavy calculations, batch imports/exports, reporting engines, and cron tasks. These must be offloaded to background threads or queues.

---

## 2. DDD Boundary Definitions
When adding features or refactoring:
* **Aggregate Roots:** Identify which entities control lifecycle and access (e.g., `User`, `Project`). Child entities should only be accessed or modified through their parent aggregate roots.
* **Domain Entities:** Objects with a distinct, persistent identity (e.g., `Timesheet`).
* **Value Objects:** Immutable objects defined solely by their attributes (e.g., dates, SMTP configurations, workday types).
* **Transactional Boundaries:** Keep transaction windows as short as possible, especially under SQLite WAL mode to avoid write locks.

---

## 3. Mandatory DDD Analysis Trigger

> [!IMPORTANT]
> If a user request starts with or contains the keyword `ddd` (case-insensitive), you **MUST** pause code modification, perform a thorough Domain-Driven Design analysis, and output a new or updated **DDD Analysis Report** to `docs/report/ddd_[feature_name]_prd_report.md` before writing any codebase implementation or API endpoints.
