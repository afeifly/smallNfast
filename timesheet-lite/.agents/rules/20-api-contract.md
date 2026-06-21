# Rule: API Contract Guidelines

All agents must adhere to the following API contract rules when designing endpoints or messaging protocols.

---

## 1. Naming & Case Convention
* **Payload Serialization:** All request bodies, query params, URL routes, and response payloads MUST use `snake_case`.
* **Database Models:** Python SQLModel class attributes must map clearly to the `snake_case` API contract, though standard ORM variables may follow Python PEP8 guidelines.

---

## 2. API Path Structure
* REST endpoints must follow standard plural resource routing:
  - `GET /resources` (list resources, optional query parameters)
  - `POST /resources` (create resource)
  - `GET /resources/{id}` (fetch specific resource)
  - `PUT /resources/{id}` or `POST /resources/{id}` (update resource)
  - `DELETE /resources/{id}` (delete/soft-delete resource)
* Bulk operations must explicitly declare `/batch` prefix (e.g., `POST /timesheets/batch`).

---

## 3. Web Worker Communication Schema
* When offloading processing tasks to workers (e.g. data exports, Excel generation), message payload structures must use standard event wrappers:
  ```json
  {
    "action": "start_processing",
    "payload": {
      "user_id": 123,
      "parameters": {}
    }
  }
  ```
* Responses from the worker must contain progress or completion statuses:
  ```json
  {
    "status": "progress" | "completed" | "error",
    "progress_percent": 45,
    "result": {}
  }
  ```

---

## 4. Mandatory Warning Header
When designing or updating type definition files, API contract definition files, or interface models, you **MUST** insert the following strict header comment at the top of the file:
```typescript
/**
 * @file API Contract
 * WARNING: This is a strict contract file generated according to .agents/rules/20-api-contract.md.
 * DO NOT modify manually without aligning both UI and Worker architectures.
 */
```
For Python schemas or contracts, use:
```python
# -*- coding: utf-8 -*-
# API Contract
# WARNING: This is a strict contract file generated according to .agents/rules/20-api-contract.md.
# DO NOT modify manually without aligning both UI and Worker architectures.
```
