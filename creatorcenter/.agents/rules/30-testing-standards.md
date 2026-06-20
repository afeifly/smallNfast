# Rule 30-testing-standards.md: Automated Testing Guidelines (Creator Center)

This rule governs the automated testing phase. When writing unit or integration tests for either the FastAPI backend or the React frontend, the AI **must** adhere to these testing configurations.

## 1. Trigger Scenario & Activation
- **Trigger**: When the AI is asked to write, refactor, or debug test suites, or create new test files (e.g., files matching `test_*.py` or located under test folders).
- **Activation Mode**: Target Match (triggered dynamically for test contexts).

---

## 2. Backend Testing Guidelines (Python / FastAPI)

- **Test Runner**: Use `pytest`.
- **Database Isolations**:
  - Test suites must use a clean, isolated SQLite test database (in-memory or distinct test file) separate from the development database (`transt.db`).
  - **Transaction Isolation Pattern**: Implement pytest fixtures to set up the schema and tables on a temporary database connection, providing clean states for each test.
- **FastAPI Endpoint Testing**:
  - Utilize `fastapi.testclient.TestClient` for API integration testing.
  - Mock third-party translation providers (OpenL, MiniMax) using mock wrappers to prevent sending external requests during unit tests.

### Backend Test Structure Example:
```python
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db

@pytest.fixture(name="db_session")
def db_session_fixture():
    # Setup temporary SQLite database
    import sqlite3
    from backend.database import SCHEMA
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.commit()
    try:
        yield conn
    finally:
        conn.close()

@pytest.fixture(name="client")
def client_fixture(db_session):
    def get_db_override():
        return db_session
    app.dependency_overrides[get_db] = get_db_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
```

---

## 3. Frontend Testing Guidelines (React / Vitest)

- **Test Runner**: Use `vitest` or Jest for fast Unit testing.
- **Component Testing**:
  - Use React Testing Library (`@testing-library/react`) to mount React components.
  - Wrap components in a `QueryClientProvider` from TanStack React Query to allow querying mock API client endpoints.
- **API Mocking**:
  - Mock the Axios API client (`backend/src/api/client`) to return mock lists of projects, translation keys, and image assets.
