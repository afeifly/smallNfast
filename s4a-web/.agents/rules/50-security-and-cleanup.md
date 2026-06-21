# Rule 50-security-and-cleanup.md - Security and Memory Cleanup

All developers and automated agents must adhere to these safety policies to ensure user data security and runtime client efficiency.

---

## 1. Secrets & Credentials Security
* **No Hardcoded Secrets:** Strictly forbid committing passwords, API keys, private keys, token strings, or access codes in any JavaScript, HTML, CSS, or JSON config files.
* **Environment Variable Rules:** Configurations (e.g., API hosts, development flags) must rely on `.env` files or system environment variables. Access variables inside the app using Vite's type-safe `import.meta.env` system.

---

## 2. Input Validation & Path Sanitation
Since `s4a-web` loads local paths (in Node/Electron fallback) or file handles, security against directory traversal is essential:
* **Sanitize Inputs:** Path handling helpers must resolve relative or directory inputs to absolute, verified paths within the scope of permitted folders.
* **Prevent Traversal:** Strictly forbid passing unchecked paths containing relative components (e.g., `..`, `/etc/`, root inputs) directly to file reading helpers. Use path sanitizers (`path.basename()` or regex checks) before executing `fs.openSync` or similar filesystem methods.
* **Validate Extensions:** Only process files matching the `.csd` or `.csv` extensions. Deny other formats early to avoid executing potential scripting exploits or buffer injections.

---

## 3. Strict Runtime Memory Cleanup
To avoid memory leaks and browser crash loops during large-scale operations:
* **Dereferencing Blobs & Buffers:** Once a file ingestion chunk has been parsed, clear references to its binary array buffers or sliced Blob segments promptly by setting variables to `null` or letting them exit scope.
* **Event Listeners Housekeeping:** Always tear down event listeners inside React components' unmount callback in `useEffect`:
  ```javascript
  useEffect(() => {
    window.addEventListener('fileLoadProgress', handleProgress);
    return () => {
      window.removeEventListener('fileLoadProgress', handleProgress);
    };
  }, []);
  ```
* **Terminating Web Workers:** Always call `worker.terminate()` when a file indexing operation is cancelled or when components managing worker state are unmounted.
* **IndexedDB Store Cleaning:** Ensure IndexedDB database connections are closed correctly, and stale or deleted file handle records are fully deleted from the stores to prevent storage bloat.
