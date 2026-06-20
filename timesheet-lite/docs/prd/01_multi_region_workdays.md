# Feature Requirement: Multi-Region Holiday & Workday Customization

## 1. Background & Context
Our workforce is globally distributed across multiple countries and regions. Currently, the `WorkDay` exception calendar applies globally to all employees. When a public holiday is set as an `off` day in the system, it blocks everyone from logging hours, even if it is a normal working day in their local region. Similarly, when a weekend is designated as a makeup `work` day, employees in regions without that makeup day are forced to log hours.

---

## 2. Problem Statement
1. **Global Block on Off-Days**: When an administrator designates a global day off (`WorkDayType.OFF`), employees in regions where that date is a standard working day cannot log their hours.
2. **Global Enforced Clock-In on Weekends**: When a weekend is rescheduled as a global working day (`WorkDayType.WORK`), all employees are required to log hours, regardless of their local calendar.
3. **Requirement**: The system must support region-specific or individual-specific workday exceptions so that limits and capacity calculations match local labor regulations.

---

## 3. Business Requirements & Rules

### BR-01: Exception Scoping (User/Regional Customization)
- Workday exceptions (`WorkDay`) must support scoping:
  - **Global Scope**: Applies to all users (default behavior).
  - **User-Specific Scope**: Applies only to a designated user (or list of users).
- *Alternatively, introducing a `Region` concept where Users are mapped to a Region (e.g., CN, US, DE) and `WorkDay` exceptions are mapped to Regions.*

### BR-02: Dynamic Hour Capacity Logic
When calculating the daily and weekly hour limits for a specific employee:
1. Check if there is a **User-Specific** exception for that date. If yes, apply it.
2. If no user-specific exception exists, check if there is a **Global** exception. If yes, apply it.
3. If no exceptions exist, fall back to the default calendar rules (Monday–Friday = 8h, Saturday–Sunday = 0h).

### BR-03: Holiday Logging Permission
- If a global holiday (`off`) is set, but a user-specific exception overrides it as `work` (or no exception exists locally for them), they **must be allowed** to drag the slider and log up to 8 hours.
- Conversely, if a weekend is designated as a global makeup day (`work`), but the user-specific calendar overrides it as `off`, the employee **must not be required** to log hours (weekly progress alert is not triggered).

---

## 4. User Interface Requirements

### 4.1 Admin Workday Exception Management
- Expand the Workday Management form to include a **Scope selector**:
  - Dropdown options: `Global` or `User-Specific`.
  - If `User-Specific` is selected, display a multi-select user search dropdown (linked to active accounts) to bind the exception to specific employees.

### 4.2 Employee Log Work Screen
- The weekly grid and sliders must automatically adapt to the user's customized exceptions.
- For example, if Monday is a public holiday in User A's region, User A sees a disabled slider (0h limit) on Monday. If it is a normal workday for User B, User B sees an active slider (8h limit).

---

## 5. Use Case Scenarios

| Scenario | Employee Local Calendar | Global Calendar Exception | Expected Behavior |
| :--- | :--- | :--- | :--- |
| **A. Statutory Holiday** | Local Holiday (`off` exception applied to User A) | None (Normal Workday) | User A's slider for the day is disabled (0h). Weekly limit decreases by 8h. Other users log hours normally. |
| **B. Global Holiday Exception** | Local Workday (User B overrides global exception) | Global Holiday (`off` exception) | User B can log up to 8 hours. Other users are blocked (0h). |
| **C. Rescheduled Weekend** | Local Weekend (User C overrides global makeup) | Global Makeup Day (`work` exception) | User C is not required to log work (0h limit). Other users are required to log hours (8h limit). |
