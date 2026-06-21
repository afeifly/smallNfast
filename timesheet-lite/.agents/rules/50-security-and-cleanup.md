# Rule: Security Policies & Memory Cleanup

All code, configurations, and scripts must follow these security and cleanup guidelines.

---

## 1. Secrets Management
* **No Hardcoded Credentials:** Never store SMTP passwords, database keys, session secrets, or JWT secret keys directly in the codebase.
* **Environment Variables:** Access all secret and dynamic configurations through environment variables or backend configuration layers (e.g. `pydantic-settings` or `os.getenv`). Keep template files (`.env.example`) updated.

---

## 2. Input Sanitation & Path Security
* **Sanitize Inputs:** Validate user-supplied names, comments, and IDs to prevent injection attacks (SQL injection, XSS). Use parametrized SQL queries via SQLModel.
* **Prevent Directory Traversal:** When handling backup file exports or manual database restore paths, check that the paths stay strictly within the designated backup folder. Do not allow users to specify absolute system paths or path traversal syntax (`../`).

---

## 3. Concurrency & Worker Cleanup
* **Worker Termination:** In the frontend, always terminate active Web Workers (`worker.terminate()`) when their lifecycle is complete or when the initiating Vue components are unmounted.
* **Tear Down Listeners:** Clean up global event listeners, scroll listeners, and timers (`clearInterval`, `clearTimeout`) in the Vue `onBeforeUnmount` lifecycle hooks to avoid memory leaks.
* **Scheduler Shutdown:** In the backend, ensure the APScheduler background thread-pool is cleanly stopped when the FastAPI server receives a shutdown signal.
