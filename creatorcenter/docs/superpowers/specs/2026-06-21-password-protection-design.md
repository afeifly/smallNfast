# Design Specification - Global Password Protection

## 1. Objective
Add a lightweight, environment-variable-configured global password protection check to the entire Creator Center application. Visitors must enter a valid password to access any page or query any document/translation API endpoint.

---

## 2. Requirements & Constraints
- **Zero Database Dependency:** The password must be loaded directly from the server's `.env` configuration file.
- **Unified Security:** Both the React frontend UI and the FastAPI backend router endpoints must be protected.
- **Premium User Experience:** Unauthenticated visitors must see a polished, modern, glassmorphic login screen, while authenticated users must have a logout control in the app header.

---

## 3. Technical Design

### 3.1 Backend Configuration & Security

#### Environment Variables (`.env`)
Two configuration values will be added:
- `APP_PASSWORD`: The plaintext password used to unlock the workspace (default: `admin123`).
- `JWT_SECRET`: A signature key for signing session tokens.

#### Authentication Router (`backend/router_auth.py` [NEW])
Exposes three endpoints under `/api/auth`:
1. `POST /login`: Accepts `{"password": "..."}`. Verifies the password. On success, encodes a JWT `{"authenticated": True}` signed with `JWT_SECRET` and stores it in an HTTP-only secure cookie named `session_token`.
2. `POST /logout`: Clears the `session_token` cookie.
3. `GET /status`: Reads the `session_token` cookie. Returns `{"authenticated": true}` if valid, otherwise `{"authenticated": false}`.

#### Global Protection Dependency (`backend/main.py`)
- Define a dependency function `verify_session(request: Request)` inside `router_auth.py` that decodes and validates the `session_token` cookie. If invalid/missing, it raises `HTTPException(401, "Unauthorized")`.
- Pass this dependency globally in `main.py` when including all data-handling routers (projects, segments, translations, keys, export, images).

---

### 3.2 Frontend Layout Guard & Login Interface

#### Authentication Client Actions (`frontend/src/api/client.ts`)
Add helper operations to request login, logout, and verify status.

#### Layout Interceptor (`frontend/src/components/Layout.tsx`)
- On mount, query the backend session status `/api/auth/status`.
- If the status is not authenticated, block the standard layout (header and outlet) and show a sleek glassmorphic password overlay instead.
- If authenticated:
  - Render the standard page layout normally.
  - Append a "Logout" button next to the navigation bar in the header, allowing users to clear their session.

#### Visual Design
- **Theme:** Vibrant Mesh dark gradient background (`bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900`).
- **Form Card:** Semi-transparent glassmorphic container with backdrop-blur, subtle white border, and deep drop-shadow.
- **Inputs & Button:** Fluid animations, focus halos, and active hover transformations.

---

## 4. Verification Plan
1. **Unauthenticated API Gate check:** Attempt to curl `/api/projects` without a cookie. Ensure it returns `401 Unauthorized`.
2. **Frontend Interceptor verification:** Navigate to the root site. Verify that a login dialog is displayed instead of the projects page.
3. **Invalid login validation:** Submit a wrong password. Ensure a clear error message is shown.
4. **Successful session validation:** Enter the correct password. Verify that the login card disappears and the app contents load seamlessly.
5. **Logout validation:** Click the logout button in the header. Verify that the application locks immediately and presents the login card again.
