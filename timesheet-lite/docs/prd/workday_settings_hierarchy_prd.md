# Product Requirements Document - Hierarchical Workday Settings

## Metadata
* **Creation Date:** 2026-06-21
* **Author:** Antigravity AI
* **Version:** 1.0.0
* **Status:** Draft

---

## 1. Objective

### Problem Statement
Currently, holiday and workday exceptions are global. If a holiday exception (e.g. an off-day) is set, it applies to all users. However, different teams (cost centers) may follow different calendars or work schedules. We need a two-layered workday setting system where exceptions can be scoped to specific profiles, and teams are assigned to these profiles.

### Solution
1. Introduce a `WorkDaySetting` profile table.
2. Link workday exceptions (`WorkDay`) to a specific `WorkDaySetting` profile.
3. Link cost centers (`CostCenter`) to a `WorkDaySetting` profile (defaulting to the global "Default" profile).
4. Allow Admins to manage profiles, assign edit/modify rights to specific users (e.g. team leaders) for a profile, and assign cost centers to profiles.
5. Filter workday limit checks for timesheet submissions by the user's cost center profile.

---

## 2. User Stories

### Admin
1. *As an Admin*, I want to create workday settings profiles (e.g., "Default", "Shenzhen Office", "Xi'an Office").
2. *As an Admin*, I want to designate specific users (e.g. Team Leaders) who can manage workday exceptions for a given profile.
3. *As an Admin*, I want to map each cost center to a specific workday setting profile.

### Manager / Authorized User
1. *As a Team Leader with modify rights*, I want to edit workday exceptions (mark days ON/OFF) for my assigned workday setting profile, so that I can configure my team's calendar.

### Employee
1. *As an Employee*, my timesheet submissions must evaluate workday limits based on the workday setting profile linked to my cost center.

---

## 3. Functional Requirements

### 3.1 Domain Models
* **WorkDaySetting (Profile)**:
  - `id`: Unique integer ID (PK)
  - `name`: Unique profile name
  - `description`: Optional text
  - `is_default`: Boolean (default False; one seeded "Default" profile has True)
* **WorkDaySettingUserLink (Modify Rights)**:
  - `setting_id`: Foreign key to `WorkDaySetting`
  - `user_id`: Foreign key to `User`
* **CostCenter (Update)**:
  - Add `workday_setting_id`: Nullable foreign key to `WorkDaySetting` (if Null, falls back to the Default profile)
* **WorkDay (Update)**:
  - Add `setting_id`: Foreign key to `WorkDaySetting` (forms composite PK with `date`)

### 3.2 Backend API Changes
* **Settings Management (`/workdays/settings`)**:
  - `GET /workdays/settings`: Returns list of settings profiles. Includes a `can_edit` flag for the current user.
  - `POST /workdays/settings`: Creates/updates a profile. (Admin-only).
  - `DELETE /workdays/settings/{id}`: Deletes a profile. (Admin-only, cannot delete Default).
  - `GET /workdays/settings/{id}/users`: Lists users with modify rights.
  - `POST /workdays/settings/{id}/users`: Grant modify rights to a user (Admin-only).
  - `DELETE /workdays/settings/{id}/users/{user_id}`: Revoke modify rights (Admin-only).
* **Workday Exception Management (`/workdays`)**:
  - `GET /workdays/`: Accepts `setting_id` param.
  - `POST /workdays/`: Accepts `setting_id` in body. Validates modify rights.
  - `DELETE /workdays/{setting_id}/{date_str}`: Deletes exception. Validates modify rights.
* **Cost Center Mapping**:
  - Update `GET /cost-centers/` to return list of full `CostCenter` objects.
  - Add `PUT /cost-centers/{name}/setting` to map a cost center to a workday setting profile (Admin-only).

### 3.3 Frontend Updates (`WorkDayManagement.vue`)
* Add a select dropdown at the top of the calendar to select the active workday setting profile.
* Load/display calendar exceptions based on the selected profile.
* If user has edit rights for the profile (or is Admin), allow clicking calendar cells to toggle exceptions.
* Add a "Manage Workday Profiles" button for Admins opening a dialog:
  - Tab 1: Manage Profiles (Create, delete profiles).
  - Tab 2: Modify Rights (Link users to profiles).
  - Tab 3: Team Mapping (Link cost centers to profiles).

---

## 4. Technical Constraints
* **SQLite Table Re-creation:** Since `WorkDay` primary key is changing to composite `(setting_id, date)`, automatically drop the old table at startup if the `setting_id` column is missing, then recreate it.
* **Fallback Logic:** If `User.cost_center` is empty or cost center mapping is unassigned, fall back to the `Default` profile (ID 1).
