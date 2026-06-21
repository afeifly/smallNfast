# Workspace Password Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a global password protection layer for Creator Center, forcing unauthenticated visitors to enter a password loaded from `.env` before accessing the React frontend or backend APIs.

**Architecture:** A FastAPI auth router processes logins and sets a signed JWT inside an HTTP-only secure cookie. A custom dependency validates this cookie globally across all projects/segments routers, while a React Layout router guard intercepts UI rendering to display a beautiful glassmorphic login form.

**Tech Stack:** FastAPI, PyJWT (python-jose), React 19, Axios, Tailwind CSS v4, Lucide React

## Global Constraints
- Payload Naming Standard: Frontend JSON request bodies and backend Pydantic models must strictly map properties using `snake_case` naming.
- Security Constraints: Password must NOT be stored in a database; must load from server environment variables (.env).
- Visual Aesthetics: Use premium dark mesh gradients, glassmorphism UI overlays, and micro-animations to wow the user.

---

### Task 1: Backend Auth Route and Config Setup

**Files:**
- Modify: `backend/config.py`
- Create: `backend/router_auth.py`
- Modify: `requirements.txt`

**Interfaces:**
- Produces: `verify_session(request: Request)` dependency function.
- Produces: `router` instance for auth endpoints `/login`, `/logout`, `/status`.

- [ ] **Step 1: Update requirements.txt to include PyJWT**
  Add `PyJWT>=2.8.0` to [requirements.txt](file:///Users/ex/project/smallNfast/creatorcenter/requirements.txt).
  
- [ ] **Step 2: Add APP_PASSWORD and JWT_SECRET to config.py**
  Add the following lines to the end of [config.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/config.py):
  ```python
  APP_PASSWORD = os.getenv("APP_PASSWORD", "admin123")
  JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-change-me")
  ```

- [ ] **Step 3: Implement auth router and session verification**
  Create the file [router_auth.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/router_auth.py) with the following content:
  ```python
  import time
  import jwt
  from fastapi import APIRouter, Response, Request, HTTPException, Depends
  from pydantic import BaseModel
  from backend.config import APP_PASSWORD, JWT_SECRET

  router = APIRouter(prefix="/auth", tags=["auth"])

  class LoginRequest(BaseModel):
      password: str

  def verify_session(request: Request):
      token = request.cookies.get("session_token")
      if not token:
          raise HTTPException(status_code=401, detail="Unauthorized: No session token found")
      try:
          payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
          # Verify expiration if set, or just validity
          if payload.get("expires", 0) < time.time():
              raise HTTPException(status_code=401, detail="Unauthorized: Session expired")
          return payload
      except jwt.PyJWTError:
          raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")

  @router.post("/login")
  def login(req: LoginRequest, response: Response):
      if req.password != APP_PASSWORD:
          raise HTTPException(status_code=401, detail="Invalid password")
      
      # Issue a JWT session token valid for 7 days
      payload = {
          "authenticated": True,
          "expires": time.time() + (7 * 24 * 60 * 60)
      }
      token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
      
      response.set_cookie(
          key="session_token",
          value=token,
          httponly=True,
          max_age=7 * 24 * 60 * 60,
          expires=7 * 24 * 60 * 60,
          samesite="lax",
          secure=False,  # Set to True in production with HTTPS
      )
      return {"status": "success"}

  @router.post("/logout")
  def logout(response: Response):
      response.delete_cookie("session_token", httponly=True, samesite="lax")
      return {"status": "success"}

  @router.get("/status")
  def status(request: Request):
      token = request.cookies.get("session_token")
      if not token:
          return {"authenticated": False}
      try:
          payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
          if payload.get("expires", 0) < time.time():
              return {"authenticated": False}
          return {"authenticated": True}
      except jwt.PyJWTError:
          return {"authenticated": False}
  ```

- [ ] **Step 4: Commit task 1**
  ```bash
  git add requirements.txt backend/config.py backend/router_auth.py
  git commit -m "feat: add backend auth routes, configuration, and verification dependency"
  ```

---

### Task 2: Backend Global Endpoint Protection

**Files:**
- Modify: `backend/main.py`

**Interfaces:**
- Consumes: `verify_session` dependency from `backend.router_auth`
- Consumes: `router` as `auth_router` from `backend.router_auth`

- [ ] **Step 1: Include auth router and apply verify_session dependency to existing endpoints**
  Edit [main.py](file:///Users/ex/project/smallNfast/creatorcenter/backend/main.py) to import the verification dependency and apply it to projects, segments, translations, keys, export, and images routers.
  
  Replace lines 34-39 in `backend/main.py`:
  ```python
  app.include_router(projects_router, prefix="/api")
  app.include_router(segments_router, prefix="/api")
  app.include_router(translations_router, prefix="/api")
  app.include_router(export_router, prefix="/api")
  app.include_router(keys_router, prefix="/api")
  app.include_router(images_router, prefix="/api")
  ```
  with:
  ```python
  from fastapi import Depends
  from backend.router_auth import router as auth_router, verify_session

  app.include_router(auth_router, prefix="/api")
  app.include_router(projects_router, prefix="/api", dependencies=[Depends(verify_session)])
  app.include_router(segments_router, prefix="/api", dependencies=[Depends(verify_session)])
  app.include_router(translations_router, prefix="/api", dependencies=[Depends(verify_session)])
  app.include_router(export_router, prefix="/api", dependencies=[Depends(verify_session)])
  app.include_router(keys_router, prefix="/api", dependencies=[Depends(verify_session)])
  app.include_router(images_router, prefix="/api", dependencies=[Depends(verify_session)])
  ```

- [ ] **Step 2: Commit task 2**
  ```bash
  git add backend/main.py
  git commit -m "feat: apply verify_session dependency globally to protect workspace APIs"
  ```

---

### Task 3: Frontend API Auth Functions

**Files:**
- Modify: `frontend/src/api/client.ts`

**Interfaces:**
- Produces: `login(password: string): Promise<void>`
- Produces: `logout(): Promise<void>`
- Produces: `checkAuthStatus(): Promise<{ authenticated: boolean }>`

- [ ] **Step 1: Append authentication functions in Axios client**
  Add these functions to the bottom of [client.ts](file:///Users/ex/project/smallNfast/creatorcenter/frontend/src/api/client.ts):
  ```typescript
  export async function login(password: string): Promise<void> {
    await api.post("/auth/login", { password });
  }

  export async function logout(): Promise<void> {
    await api.post("/auth/logout");
  }

  export async function checkAuthStatus(): Promise<{ authenticated: boolean }> {
    const res = await api.get("/auth/status");
    return res.data;
  }
  ```

- [ ] **Step 2: Commit task 3**
  ```bash
  git add frontend/src/api/client.ts
  git commit -m "feat: add login, logout, and auth status verification functions to API client"
  ```

---

### Task 4: Frontend Layout Guard & Login Component

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Interfaces:**
- Consumes: `checkAuthStatus`, `login`, `logout` from `../api/client`

- [ ] **Step 1: Update layout routing guard and implement premium glassmorphic UI overlay**
  Modify [Layout.tsx](file:///Users/ex/project/smallNfast/creatorcenter/frontend/src/components/Layout.tsx) to intercept page rendering and display a sleek dark login box if the visitor is unauthenticated.
  
  Replace the entire content of `frontend/src/components/Layout.tsx` with:
  ```tsx
  import { useState, useEffect } from "react";
  import { Link, Outlet, useLocation } from "react-router-dom";
  import { FileText, FolderOpen, Key, Lock, LogOut } from "lucide-react";
  import * as api from "../api/client";

  export default function Layout() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    
    const location = useLocation();
    const isProjects = location.pathname === "/" || location.pathname.startsWith("/projects");
    const isKeys = location.pathname.startsWith("/keys");

    useEffect(() => {
      api.checkAuthStatus()
        .then((res) => setIsAuthenticated(res.authenticated))
        .catch(() => setIsAuthenticated(false));
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password.trim()) return;
      setError("");
      setSubmitting(true);
      try {
        await api.login(password.trim());
        setIsAuthenticated(true);
      } catch (err: any) {
        setError(err.response?.data?.detail || "Invalid password");
      } finally {
        setSubmitting(false);
      }
    };

    const handleLogout = async () => {
      try {
        await api.logout();
        setIsAuthenticated(false);
        setPassword("");
        setError("");
      } catch {
        // silent
      }
    };

    if (isAuthenticated === null) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-gray-400 font-medium">
          Checking session...
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
          <div className="relative backdrop-blur-md bg-white/10 border border-white/10 rounded-2xl shadow-2xl p-8 max-w-sm w-full transition-all duration-300 hover:border-white/20">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg border border-white/10">
              <Lock className="w-10 h-10 text-white" />
            </div>
            
            <div className="mt-8 flex flex-col items-center text-center space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-wide">Creator Center</h2>
              <p className="text-xs text-gray-400">Please enter password to unlock workspace.</p>
            </div>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-center"
                autoFocus
              />
              {error && <p className="text-xs text-red-400 text-center font-medium animate-shake">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 duration-200"
              >
                {submitting ? "Unlocking..." : "Unlock"}
              </button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-semibold text-lg hover:opacity-80">
              <FileText className="w-5 h-5 text-blue-600" />
              Creator Center
            </Link>
            <nav className="flex items-center gap-2">
              <Link
                to="/"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${isProjects ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}
              >
                <FolderOpen className="w-4 h-4" />
                Projects
              </Link>
              <Link
                to="/keys"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${isKeys ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}
              >
                <Key className="w-4 h-4" />
                Translation Keys
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                title="Logout from workspace"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </nav>
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit task 4**
  ```bash
  git add frontend/src/components/Layout.tsx
  git commit -m "feat: implement Layout authentication guard and visual login screen"
  ```
