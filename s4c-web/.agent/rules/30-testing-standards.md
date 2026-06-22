# 30-testing-standards.md - Testing Standards

This document specifies the testing methodologies, frameworks, mocking protocols, and verification environments required for the `s4c-web` project.

---

## 1. Testing Stack

* **Runner**: [Vitest](https://vitest.dev/) (v4+) is the runner and compiler for unit and integration testing.
* **UI Testing**: [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) with `@testing-library/jest-dom` and `@testing-library/user-event` for interaction tests.
* **Component Testing**: Configured to run within a JSDOM simulation environment.

---

## 2. Target Environment

Tests must execute in a headless node environment simulating browser features:
- **Environment config**: Specify `environment: 'jsdom'` in `vite.config.js` or standard configurations for components.
- **WASM Mocking**: Since `sql.js` loads a binary WebAssembly payload (`sql-wasm.wasm`), tests must mock out the WASM layer rather than attempting to load WASM binaries directly. This prevents runtime environment initialization errors in headless environments.

---

## 3. Mocking & Isolation Guidelines

To test business logic independently of underlying storage or cryptography drivers:

### 3.1 Mocking `sql.js` (SQLite WASM)
Do not attempt to load `public/sql-wasm.wasm` during test execution. Mock the database connection structure using `vi.mock` as seen in [alarmDbUtils.test.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/alarmDbUtils.test.js):

```javascript
import { describe, it, expect, vi } from 'vitest';

const mockDb = {
  prepare: vi.fn(),
  exec: vi.fn(),
  run: vi.fn(),
  close: vi.fn(),
  export: vi.fn(),
};

const mockSQL = {
  Database: vi.fn(function() { return mockDb; }),
};

vi.mock('sql.js', () => ({
  default: vi.fn(() => Promise.resolve(mockSQL)),
}));
```

### 3.2 Mocking ZIP Compression (`@zip.js/zip.js`)
When testing export/import package pipelines, mock the stream writer/reader or use mock blob inputs rather than running real filesystem zip encryption to speed up unit test execution.

---

## 4. Execution Commands

Keep testing suites clean and executable. Ensure all tests pass before making any Git commits:

* **Run all tests once**:
  ```bash
  npm run test
  ```
* **Interactive watch mode**:
  ```bash
  npm run test:watch
  ```
* **Verify code style and constraints**:
  ```bash
  npm run lint
  ```
* **Check test coverage**:
  ```bash
  npx vitest run --coverage
  ```
