# Rule: Testing Standards

All agents must follow these testing standards.

---

## 1. Testing Stack & Environment
* **Backend:** Use `pytest` and `httpx` (`AsyncClient`/`TestClient`) for integration testing of FastAPI routers. Database instances in tests must be mocked or run on in-memory sqlite engine.
* **Frontend:** Use `Vitest` and `@vue/test-utils` for unit testing. End-to-end (E2E) testing should use `Playwright` or `Cypress` if needed.
* **Target Coverage:** Maintain a minimum of **80% code coverage** for core domains (e.g., timesheet limit checking services, password hashing logic, and helper functions).

---

## 2. Test File Naming
* **Backend:** Name test files with `test_` prefix (e.g. `tests/test_timesheets.py`).
* **Frontend:** Name test files with `.spec.js` or `.test.js` extension matching component names (e.g. `components/__tests__/TimesheetTable.spec.js`).

---

## 3. Mock Configurations
* **Web Workers:** Mock worker message exchanges using fake event emitters (`postMessage`, `onmessage`).
* **External Services:** Always mock HTTP requests to external email services or SMTPSettings connections to guarantee tests can run completely offline.
* **Databases:** Implement database fixtures with auto-rollback transactions to isolate test execution states.

---

## 4. Verification Steps
Before considering a feature complete, run the verification scripts:
- **Backend:** `pytest`
- **Frontend:** `npm run test:unit`
Verify that no errors or warning diagnostics are thrown.
