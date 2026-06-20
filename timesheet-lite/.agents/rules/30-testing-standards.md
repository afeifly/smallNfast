# Rule 30-testing-standards.md: Automated Testing Guidelines (Timesheet Lite)

This rule governs the automated testing phase. When writing unit, integration, or store tests for either the FastAPI backend or the Vue 3 frontend, the AI **must** adhere to these testing configurations.

---

## 1. Trigger Scenario & Activation
- **Trigger**: When the AI is asked to write, refactor, or debug test suites, or create new test files (e.g., files matching `test_*.py`, `*.spec.js`, `*.test.js` or located under `tests/` directories).
- **Activation Mode**: Target Match (triggered dynamically for test contexts).

---

## 2. Backend Testing Guidelines (Python / FastAPI / SQLModel)

- **Test Runner**: Use `pytest`.
- **Database Isolations**:
  - Test suites must use a clean, isolated SQLite test database (in-memory or distinct test file) separate from development database (`database.db`).
  - **Transaction Rollback Pattern**: Implement a pytest fixture that initiates a transaction block, provides a session, and rolls back the transaction (`session.rollback()`) after each test runs. This guarantees test isolation and prevents pollution between test cases.
- **FastAPI Endpoint Testing**:
  - Utilize `fastapi.testclient.TestClient` for API integration testing.
  - Mock authenticated sessions by overriding dependencies (e.g., `get_current_user`, `get_current_admin_user`) using `app.dependency_overrides`.

### Backend Test Structure Example:
```python
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from app.main import app
from app.database import get_session

# Setup isolated database engine
@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session
    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
```

---

## 3. Frontend Testing Guidelines (Vue 3 / Vitest / Pinia)

- **Test Runner**: Use `vitest` for fast Unit testing.
- **Component Testing**:
  - Use `@vue/test-utils` to mount Vue components.
  - Stub Element Plus UI elements if necessary, or verify state properties using props, triggers, and events.
- **Store Testing (Pinia)**:
  - When testing Pinia stores (like `auth` store), always invoke `setActivePinia(createPinia())` before each test to ensure state isolation.
  - Test action triggers such as authentication storage, token decoding, and role matching.

### Frontend Test Structure Example:
```javascript
import { setActivePinia, createPinia } from 'pinia'
import { describe, beforeEach, it, expect, vi } from 'vitest'
import { useAuthStore } from '../stores/auth'

describe('Auth Store Test', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('updates token and decodes user role upon login', async () => {
    const store = useAuthStore()
    // Mock Axios client API post request
    // Verify store states update accordingly
  })
})
```
