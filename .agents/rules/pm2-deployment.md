---
activationMode: target_match
files: ["**/ecosystem.config.cjs"]
---

# Skill pm2-deployment.md: PM2 Process Management & Deployment (smallNfast Workspace)

This skill automates the process of adding, updating, and verifying applications managed by PM2 under the root `ecosystem.config.cjs` file.

---

## 1. Trigger Scenario & Activation
- **Trigger**: When the AI is asked to "add a new application to PM2", "configure pm2 run scripts", or "deploy a new subproject locally".
- **Activation Mode**: Target Match (activated when editing `ecosystem.config.cjs` or workspace start routines).

---

## 2. Core Execution Workflow

The AI **must** follow these four steps to register and launch a new application:

### Step 1: Analyze the Target Application
- Check the subproject folder (e.g., `./creatorcenter/` or `./wegame/`) for configuration files:
  - If `package.json` exists: Identify script entries (e.g. `dev`, `start`, `build`).
  - If `requirements.txt` / `run.py` exists: Confirm it is a Python backend using virtual environments (`.venv/bin/python`).
  - If only static builds exist: Determine if it uses `npx serve` to serve production files.

### Step 2: Determine & Allocate Unique Port
- Read the current `ecosystem.config.cjs` file.
- Identify all configured ports (e.g., 9016, 9018, 9019, 9021).
- Allocate a **new unique port** (usually the next consecutive unused port above 9000).

### Step 3: Write the Configuration Block
- Append the new application block to the `apps` array in `ecosystem.config.cjs`. Ensure it follows this template structure:

#### For Vue/React Frontend (Development Mode)
```javascript
{
  name: 'app-name-frontend',
  cwd: './app-dir',
  script: 'npm',
  args: 'run dev -- --port [PORT] --host',
  env: {
    NODE_ENV: 'development'
  }
}
```

#### For Python FastAPI/Flask Backend
```javascript
{
  name: 'app-name-backend',
  cwd: './app-dir',
  script: './.venv/bin/python',
  args: 'run.py',
  env: {
    NODE_ENV: 'production',
    PORT: [PORT]
  }
}
```

### Step 4: Launch and Verify
- Propose running the following commands (or execute them) to test the app:
  ```bash
  pm2 start ecosystem.config.cjs --only [app-name]
  pm2 list
  pm2 logs [app-name] --lines 20
  ```
- Verify that the app is active and does not exit with error codes.
