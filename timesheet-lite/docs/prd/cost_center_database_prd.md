# Product Requirements Document - Database-Backed Cost Centers

## Metadata
* **Creation Date:** 2026-06-21
* **Author:** Antigravity AI
* **Version:** 1.0.0
* **Status:** Draft

---

## 1. Objective

### Problem Statement
Currently, cost centers are stored in a flat JSON file at `backend/backend/data/cost_centers.json`. This approach lacks transactional consistency, prevents proper database-level referential integrity (foreign keys), and is hard to manage concurrently.

### Solution
Migrate cost centers to a real table in the SQLite database, enforce a foreign key constraint from the `User` table, and update the backend and frontend to load and manage cost centers from the database.

---

## 2. User Stories

### Admin
1. *As an Admin*, I want cost center options to be stored in the database, so that updates are transactional and safe.
2. *As an Admin*, I want to manage (add/delete) cost centers through the existing management dialog in `Employees.vue`.
3. *As an Admin*, I want to be prevented from deleting a cost center that is currently assigned to one or more active employees.

---

## 3. Functional Requirements

### 3.1 Database Model
* Create a new `CostCenter` table in the database:
  - `id`: Integer primary key, auto-increment.
  - `name`: Unique, indexed string.
* Add a foreign key constraint on `User.cost_center` referencing `costcenter.name` to maintain referential integrity.

### 3.2 Backend API Refactoring
* Migrate endpoints in `backend/app/api/cost_centers.py`:
  - `GET /cost-centers/`: Query the `CostCenter` table and return a list of names.
  - `POST /cost-centers/`: Insert a new `CostCenter` row, preventing duplicates.
  - `DELETE /cost-centers/{name}`: Delete the `CostCenter` row with the matching name. If any active user references it, reject the deletion with a foreign key violation or validation error.
* Populate default cost centers (`R&D-SZ`, `R&D-XA`) during startup if the table is empty.

### 3.3 Frontend Integration
* Ensure `Employees.vue` fetches the list of cost centers from `/cost-centers/` and binds them to the employee creation/edit forms.

---

## 4. Technical & Security Constraints
* **Referential Integrity:** Ensure foreign key support is active in SQLite (`PRAGMA foreign_keys = ON;`), preventing deletion of cost centers that are in use.
* **Backward Compatibility:** Keep API response format for `/cost-centers/` as a list of strings (`List[str]`) or handle mapping gracefully to prevent breaking existing components in the application.
