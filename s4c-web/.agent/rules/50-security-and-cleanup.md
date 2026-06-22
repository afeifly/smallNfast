# 50-security-and-cleanup.md - Security & Resource Cleanup Rules

This document specifies security rules, input sanitization workflows, and resource/memory management requirements for `s4c-web`.

---

## 1. Secrets & Credentials

To ensure that credentials are not leaked:

* **Hardcoded Secrets Ban**: Do not hardcode API tokens, service credentials, development URLs, or private keys inside the codebase.
* **Standard Packaging Password Exception**: The password `SUTOXZCONFIG` is standard across SUTO devices to decrypt the configuration package container. This is a protocol-mandated shared key, not a user credential, and is permitted to exist in the frontend codebase as a constant.

---

## 2. Input Sanitization

### 2.1 ZIP Path Traversal Prevention
When parsing configuration packages using `@zip.js/zip.js` workers, ensure the relative paths inside the archive do not contain directory traversal sequences (such as `..` or leading `/`). Any archive entry attempting to access parent paths must be rejected immediately to prevent cross-origin cache reading or invalid writes.

Example safeguard:
```javascript
for (const entry of entries) {
  if (entry.filename.includes('..') || entry.filename.startsWith('/')) {
    throw new Error(`Security Violation: Invalid file path in package: ${entry.filename}`);
  }
}
```

### 2.2 Range and Type Checking
* **SQL Parameters**: All variables bound to SQL statements inside [alarmDbUtils.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/alarmDbUtils.js) must use named binding parameters (e.g. `:threshold`, `:delay`) to prevent SQL injection attempts, even though execution runs client-side.
* **Numeric Boundaries**: Sanitize user inputs for alarm thresholds and delays to ensure they match valid physical bounds before inserting them into SQLite database columns or writing to configuration JSONs.

---

## 3. Strict Resource Cleanup

Because `s4c-web` runs entirely client-side, memory leaks in SQLite WASM engine allocations or ZIP file handle caches can quickly degrade the browser tab's performance.

### 3.1 WebAssembly SQLite Cleanup (`sql.js`)
Whenever a WebAssembly database instance is opened, it allocates memory inside the WASM heap. The caller must strictly close the database instance and free compiled statements to prevent memory leaks:

1. **Closing Database Connections**: Always invoke `db.close()` inside a `finally` block or when a database operation has completed.
2. **Freeing Statements**: Always call `stmt.free()` after stepping through prepared SQL statements:
   ```javascript
   const stmt = db.prepare("SELECT * FROM alarm_config WHERE is_deleted = 0");
   try {
     while (stmt.step()) {
       const row = stmt.getAsObject();
       // process row
     }
   } finally {
     stmt.free();
     db.close();
   }
   ```

### 3.2 ZIP Stream Closure
When using `@zip.js/zip.js` `ZipReader` or `ZipWriter`, always invoke `await reader.close()` or `await writer.close()` after completing read/write sequences to close standard file system references and workers.

### 3.3 Event Listeners & State Subscriptions
- Tear down all DOM/React event listeners, timeout hooks, and subscription states inside React `useEffect` cleanups to prevent DOM node leaks.
- Properly close IndexedDB transactions using `tx.oncomplete` and `tx.onerror` hooks.
