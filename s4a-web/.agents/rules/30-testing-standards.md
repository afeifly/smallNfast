# Rule 30-testing-standards.md - Testing Standards

All agents must follow these guidelines when writing, running, or configuring tests in the `s4a-web` codebase.

---

## 1. Testing Stack & Environment
* **Test Runner:** Vitest.
* **Environment:** jsdom (configured for Node environment simulating a browser).
* **Location Convention:** All tests **must** be colocated beside their target source files. Do not create separate `/tests` or `/test` root directories.
  - Example: `src/api/CsdAPI.test.js` colocated next to `src/api/CsdAPI.js`.
  - Filename naming rule: `[filename].test.js` or `[filename].test.jsx`.

---

## 2. Mocking File System / Stream APIs
Because file ingestion deals with client-side large file slices, tests must mock file slices, arrays, and stream buffers safely:
* **Mock File/Blob Slice:** Mock the slice interface to slice byte buffers synchronously or asynchronously.
  ```javascript
  const mockFile = {
    name: 'test_file.csd',
    size: buffer.byteLength,
    slice(start, end) {
      const sliced = buffer.slice(start, end);
      return {
        async arrayBuffer() { return sliced; },
        async text() { return new TextDecoder().decode(sliced); }
      };
    }
  };
  ```
* **Mock Web Workers:** Ensure tests do not run real browser workers (which are unsupported in jsdom). Mock worker instantiation and override `postMessage` handlers globally in test setups.

---

## 3. Test Coverage & Conventions
* **Target Coverage:** Maintain or exceed 80% coverage for newly added data parsers or analytical helpers.
* **Descriptive Descriptions:** Use `describe` and `it`/`test` blocks with clear, behavioral sentences:
  - Good: `it('should slice and read the binary header fields correctly', async () => { ... })`
  - Bad: `test('CsdAPI', () => { ... })`

---

## 4. Execution Commands
* **Run Tests (Once):** `npm test -- --run`
* **Watch Mode:** `npm test`
