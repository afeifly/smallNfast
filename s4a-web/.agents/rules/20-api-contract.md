# Rule 20-api-contract.md - API Contract Standards

All agents must follow these guidelines when creating, modifying, or testing API models, types, schemas, and serialization functions.

---

## 1. Naming Conventions & Serialization
* **Mandatory Naming Scheme:** All data transfers, request payloads, response structures, Web Worker messages, and exported files (CSV/Excel headers) must use **`snake_case`** for object properties and JSON fields.
* **Exceptions:** Internal React state structures, component variables, and d3 charting helpers may use `camelCase`, but must map to `snake_case` immediately when communicating with storage, workers, or API layers.

---

## 2. API Contract File Warning Header
Every API endpoint helper file, typescript interface (if added), or schema mapping file must contain the following strict warning header at the very top:

```javascript
/**
 * @file API Contract
 * WARNING: This is a strict contract file generated according to .agents/rules/20-api-contract.md.
 * DO NOT modify manually without aligning both UI and Worker architectures.
 */
```

---

## 3. Web Worker Communication Payloads
When structuring communication payloads between the Lightweight UI Thread and Heavy-Duty Processing Workers, use a structured event object schema:

* **UI to Worker Message (Request):**
  ```json
  {
    "type": "PARSE_FILE" | "EXPORT_FILE" | "CANCEL_OPERATION",
    "payload": {
      "file_handle": {},
      "options": {
        "split_gaps": true
      }
    }
  }
  ```
* **Worker to UI Message (Response / Progress):**
  ```json
  {
    "type": "PROGRESS" | "SUCCESS" | "ERROR",
    "progress": 0.45,
    "error_message": null,
    "payload": {
      "channel_id": 1,
      "measurements": []
    }
  }
  ```

---

## 4. REST API Endpoint Structures
If editing or creating files that call the backend server:
* Path endpoints must be plural, lowercased, and semantic (e.g., `/users`, `/backup_setting`, `/report_consumption_settings`).
* Query parameters must use url-encoded operators:
  - Equality filters: `?username%5Beq%5D=admin` (representing `username[eq]=admin`).
  - Order parameters: `?%24orderby=createddate%20asc`.
  - Expand parameters: `?%24expand=role`.
* Response data arrays must carry a consistent payload mapping to avoid UI rendering exceptions.
