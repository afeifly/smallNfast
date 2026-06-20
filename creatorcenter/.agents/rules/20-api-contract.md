# Rule 20-api-contract.md: API Design & Contract Guidelines (Creator Center)

This rule governs the API design phase, ensuring that generated network request/response structures, database models, and client API configurations remain strictly aligned between the FastAPI backend and React frontend, preventing serialization mismatches.

## 1. Trigger Scenario & Goal
- **Trigger**: When the AI writes FastAPI route endpoints, database schema mappings, or client-side React Axios configurations.
- **Core Objective**: Enforce a strict naming and serialization interface, keeping integrations secure, and matching performance and validation constraints at the interface level.

---

## 2. API Design Guidelines

### A. Mandatory Snake Case Naming (`snake_case`)
- **Strict Convention**: To match Python and Pydantic standards, all JSON request and response payloads **must strictly utilize `snake_case` naming** for attributes and keys. Camel case (`camelCase`) is prohibited in API payloads.
- **Example Keys**: `project_id`, `source_lang`, `target_lang`, `translated_text`, `is_edited`, `is_translated`, `segment_count`, `original_file`.

*Axios Client Payload Example*:
```typescript
// Axios request payload must map backend's expected snake_case properties
const payload = {
  target_lang: targetLang,
  provider: "openl"
};
```

### B. Project Status Color Mapping
All status properties returned in API models should map directly to semantic type properties used in React / Tailwind frontend component styling:
- **`uploaded`**: Yellow status badge, indicating raw document is uploaded but not processed.
- **`parsed` / `translating`**: Blue/purple status indicators, representing text extraction and active translation jobs.
- **`translated` / `reviewed`**: Green/teal status tags, marking document readiness.
- **`exported`**: Gray/neutral status tag, indicating final output compilation is complete.
- **`error`**: Red status tag, highlighting extraction/translation failures.

### C. Asynchronous Background Task Contracts
- **Large Document Processing**: Document queries (such as listing segments) must support query parameters (`page`, `page_size`) to prevent massive payload transmissions and UI rendering lags.
- **Asynchronous Execution**: Heavy administrative and rendering endpoints (such as WeasyPrint PDF export) **must be designed as asynchronous, non-blocking APIs**.
  - Route handlers must initiate a background job, return a job identifier confirmation (e.g., `{"job_id": "job_uuid_hash"}`), and offload the task to FastAPI `BackgroundTasks`.
  - The client queries progress via Server-Sent Events (SSE) `/api/projects/{project_id}/export/progress/{job_id}`, receiving structured JSON updates regarding the job status.

### D. RESTful Conventions
- API endpoints must use lowercase path routing without trailing slash, e.g., `/api/projects`, `/api/projects/{project_id}/keys`, `/api/images/upload`.
- Apply standard HTTP Methods: `GET` (query), `POST` (create / action), `PUT`/`PATCH` (update), `DELETE` (clean up and deletion).
- Deletion requests (such as deleting a project) must physically remove the original file from the server uploads directory and delete cascading rows in the database.

---

## 3. Warning Header in Contract Files
When generating TypeScript definitions or backend API schemas, the AI must append the following header at the top of the file:
```typescript
/**
 * @file API Contract
 * WARNING: This is a strict contract file generated according to .agents/rules/20-api-contract.md.
 * DO NOT modify manually without aligning both UI and Worker architectures.
 */
```
