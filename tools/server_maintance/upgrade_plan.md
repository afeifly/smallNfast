# Ubuntu 20.04 → Ubuntu 24.04 LTS Upgrade Guide & Impact Assessment

This document provides a comprehensive migration guide and impact assessment for all sub-projects managed by PM2 via `ecosystem.config.cjs`.

> **Note on the upgrade path**: Ubuntu 20.04 supports an LTS upgrade **directly to Ubuntu 22.04**, then from 22.04 a **second** `do-release-upgrade` takes you to **24.04**. The final target of this guide is **Ubuntu 24.04 / Python 3.12** — run `do-release-upgrade` twice. (22.04 ships Python 3.10 as an intermediate stop, but we do not stop there.)

---

## 📌 Executive Summary

Upgrading from **Ubuntu 20.04 LTS** to **Ubuntu 24.04 LTS** will **NOT work seamlessly out of the box** without post-upgrade maintenance.

Several services will fail immediately upon server reboot due to:

1. **Python Version Shift (3.8 → 3.12)**: Virtual environments (`.venv`) break completely because Python 3.8 binaries and shared libraries are removed. **This happens even if your app code uses "the latest Python"** — see the FAQ below.
2. **OpenSSL & GLIBC Upgrade (OpenSSL 1.1 → 3.0 / GLIBC 2.31 → 2.39)**: Native C++/Rust Node.js addons (`better-sqlite3`, `@napi-rs/canvas`) and Prisma binary engines fail ABI linking.
3. **Missing / Upgraded System Packages**: C-libraries required by PDF renderers (`WeasyPrint`) require updated Ubuntu 24.04 system dependencies.

---

## ❓ FAQ: "I already use the latest Python — won't the upgrade affect me?"

**No — the upgrade WILL still break your venvs, even if you're on the "latest" Python.**

The reason is that a Python virtual environment (`.venv`) is **bound to the exact interpreter it was created with**. Inside `./.venv/bin/` there are symlinks like:

```
.venv/bin/python  ->  /usr/bin/python3.8
.venv/bin/python3 -> /usr/bin/python3.8
```

When Ubuntu 24.04 removes Python 3.8, those symlinks become **broken** (`No such file or directory`). Your PM2 config launches the backend with `./.venv/bin/python`, so the app simply won't start — regardless of whether your `requirements.txt` asks for the newest packages.

Additionally:
- **Pre-compiled binary wheels** (`bcrypt`, `argon2-cffi`, `cryptography`, etc.) were compiled against the **CPython 3.8 ABI**. The `.so` files in the venv will fail to import on 3.12 even after you fix the symlink, because the Python C-API changed.
- **`python-jose[cryptography]`** / `cryptography` wheels are tied to the OpenSSL build too.

**Conclusion**: You MUST recreate every `.venv` from scratch with the new system Python (Step 2). Code changes are usually NOT needed — this is an environment rebuild, not a code migration.

The same ABI argument applies to **Node native modules** (`better-sqlite3`, `@napi-rs/canvas`, Prisma engines): they were compiled against GLIBC 2.31 / OpenSSL 1.1. Even though Node.js itself can be "latest", the compiled `.node` binaries and Prisma engines will throw `GLIBC_2.34 not found` or OpenSSL symbol errors. These must be **rebuilt/reinstalled** (Step 3).

---

## 📊 Project Compatibility Matrix

| PM2 App Name | Working Directory | Stack / Dependencies | Direct Reboot Status | Required Recovery Action |
| :--- | :--- | :--- | :---: | :--- |
| **`s4c-web`** | `./s4c-web` | Node.js (`npx serve`) | ✅ OK | None (Verify Node.js LTS) |
| **`s4c-web-ac`** | `./s4c-web` | Node.js (`npx serve`) | ✅ OK | None (Verify Node.js LTS) |
| **`s4a-web`** | `./s4a-web` | Node.js (`vite dev`) | ✅ OK | None |
| **`acbarcode`** | `./acbarcode` | Node (`Express`, `@napi-rs/canvas`) | ⚠️ Risk | Rebuild native modules (`npm rebuild`) |
| **`timesheet-lite`** | `./timesheet-lite/backend` | Python (`FastAPI`, `SQLModel`, `.venv`) serving API + built frontend | ❌ CRASH | Recreate `.venv` with Python 3.12 (rebuild frontend `dist` if needed) |
| **`creatorcenter`** | `./creatorcenter` | Python (`FastAPI`, `WeasyPrint`, `.venv`) | ❌ CRASH | Install apt libs + Recreate `.venv` |
| **`s4c-lab`** | `./s4c-lab-server/server` | Node (`Express`, `Prisma`, `SQLite`) | ❌ CRASH | Reinstall `node_modules` & `prisma generate` |
| **`projshow`** | `./projshow/server` | Node (`Express`, `better-sqlite3`) | ❌ CRASH | Reinstall `node_modules` (C++ rebuild) |
| **`voiceover`** | `./voiceover/server` | Node (`Express`) | ✅ OK | None (Backup `.env`) |

---

## ⚠️ Core Technical Risks & Root Causes

### 1. Python Virtual Environment Destruction 🔴
- **Cause**: Ubuntu 20.04 defaults to `python3.8`. Ubuntu 24.04 upgrades system Python to `python3.12` and removes 3.8.
- **Consequence**: Python symlinks inside `./.venv/bin/python` break (`No such file or directory`). Pre-compiled `.so` binary packages (e.g., `bcrypt`, `argon2-cffi`, `cryptography`) break due to Python CPython ABI changes.
- **Affected Projects**: `timesheet-lite`, `creatorcenter`.

### 2. Node Native C++/Rust Addons & Prisma Engine ABI Mismatch 🔴
- **Cause**: Ubuntu 20.04 uses **GLIBC 2.31** and **OpenSSL 1.1.1**. Ubuntu 24.04 uses **GLIBC 2.39** and **OpenSSL 3.0+**.
- **Consequence**: Existing Node native modules will throw `GLIBC_2.34 not found` or OpenSSL symbol errors. Prisma engines downloaded for Debian/Ubuntu 20.04 will crash on startup.
- **Affected Projects**: `projshow` (`better-sqlite3`), `s4c-lab` (`@prisma/client`), `acbarcode` (`@napi-rs/canvas`).

### 3. Missing System Shared Libraries for WeasyPrint 🟠
- **Cause**: `creatorcenter` uses `WeasyPrint` to convert HTML/CSS to documents, which relies on `Pango`, `Cairo`, `GdkPixbuf`, and `libffi`.
- **Consequence**: Package names and shared library versions shift in the Ubuntu 24.04 apt repositories.
- **Affected Projects**: `creatorcenter`.

---

## 📦 What Must Be Backed Up (Per Project)

> **One-time generic rule**: `git` history + all committed code survive the upgrade. What is **NOT** in git and WILL be touched/removed during recovery is: **databases, `.env` secrets, uploaded files, generated output, and JSON data stores**. Copy ALL of these to a safe location **outside the repo** (e.g. `~/backups/upgrade-<date>/`) BEFORE upgrading.

Create the backup root first:

```bash
mkdir -p ~/backups/upgrade-$(date +%Y%m%d)
BK=~/backups/upgrade-$(date +%Y%m%d)
```

### `s4c-web` & `s4c-web-ac`
No database. Only built static assets (`dist/`, `dist-ac/`) which are regenerated. Backup optional, but safe to include:

```bash
cp -r s4c-web/dist  $BK/s4c-web-dist 2>/dev/null
cp -r s4c-web/dist-ac $BK/s4c-web-dist-ac 2>/dev/null
cp s4c-web/.env $BK/s4c-web.env 2>/dev/null
cp s4c-web/.env.atlascopco $BK/s4c-web.env.atlascopco 2>/dev/null
```

### `s4a-web`
No database. Vite dev server serves source directly; nothing persistent to back up.

### `acbarcode`
**Data to back up** (under `acbarcode/server/data/`):
- `products.json` — product database
- `odoo_config.json` — Odoo connection config
- `templates.db`, `templates.db-wal`, `templates.db-shm` — template store (SQLite, WAL mode — copy the `-wal` file too!)

```bash
mkdir -p $BK/acbarcode
cp acbarcode/server/data/products.json   $BK/acbarcode/
cp acbarcode/server/data/odoo_config.json $BK/acbarcode/
cp acbarcode/server/data/templates.db    $BK/acbarcode/
cp acbarcode/server/data/templates.db-wal $BK/acbarcode/ 2>/dev/null
cp acbarcode/server/data/templates.db-shm $BK/acbarcode/ 2>/dev/null
```

### `timesheet-lite` (single app: backend + frontend)
**Data to back up**:
- `timesheet-lite/backend/database.db` — main SQLite DB (WAL mode)
- `timesheet-lite/backend/database.db-wal`, `database.db-shm` (if present)
- `timesheet-lite/backend/backups/` — if the app keeps its own DB dumps, grab them too

```bash
mkdir -p $BK/timesheet-lite
cp timesheet-lite/backend/database.db      $BK/timesheet-lite/
cp timesheet-lite/backend/database.db-wal  $BK/timesheet-lite/ 2>/dev/null
cp timesheet-lite/backend/database.db-shm  $BK/timesheet-lite/ 2>/dev/null
cp -r timesheet-lite/backend/backups       $BK/timesheet-lite/backups 2>/dev/null
```

The frontend is a static build (`timesheet-lite/frontend/dist/`) served by the backend — it is regenerated with `npm run build`, so it does not need backup (rebuilt after upgrade if stale).

### `creatorcenter`
**Data to back up**:
- `creatorcenter/backend/transt.db` — main SQLite DB
- `creatorcenter/.env` — secrets (APP_PASSWORD, JWT_SECRET, API keys)
- `creatorcenter/backend/uploads/` — uploaded source documents & images
- `creatorcenter/backend/outputs/` — generated PDF/docx outputs
- `creatorcenter/backend/translation/` — translation state (if it stores provider/API config)

```bash
mkdir -p $BK/creatorcenter
cp creatorcenter/backend/transt.db   $BK/creatorcenter/
cp creatorcenter/.env                $BK/creatorcenter/
cp -r creatorcenter/backend/uploads  $BK/creatorcenter/uploads
cp -r creatorcenter/backend/outputs  $BK/creatorcenter/outputs
cp -r creatorcenter/backend/translation $BK/creatorcenter/translation 2>/dev/null
```

### `s4c-lab`
**Data to back up**:
- `s4c-lab-server/server/prisma/dev.db` — SQLite DB
- `s4c-lab-server/server/prisma/dev.db-wal`, `dev.db-shm` (if present)
- `.env` — the real one is gitignored; the app reads `DATABASE_URL` from `ecosystem.config.cjs`, but back up `.env` if it exists
- JWT secret is embedded in `ecosystem.config.cjs` (`JWT_SECRET`) — note it in the backup notes

```bash
mkdir -p $BK/s4c-lab
cp s4c-lab-server/server/prisma/dev.db     $BK/s4c-lab/
cp s4c-lab-server/server/prisma/dev.db-wal $BK/s4c-lab/ 2>/dev/null
cp s4c-lab-server/server/prisma/dev.db-shm $BK/s4c-lab/ 2>/dev/null
cp s4c-lab-server/server/.env              $BK/s4c-lab/ 2>/dev/null
```

### `projshow`
**Data to back up**:
- `projshow/server/data/projshow.db` — SQLite DB (WAL mode)
- `projshow/server/data/projshow.db-wal`, `projshow.db-shm`
- `projshow/server/data/uploads/` — uploaded project files
- `projshow/server/data/seed.json` — seed data

```bash
mkdir -p $BK/projshow
cp projshow/server/data/projshow.db      $BK/projshow/
cp projshow/server/data/projshow.db-wal  $BK/projshow/ 2>/dev/null
cp projshow/server/data/projshow.db-shm  $BK/projshow/ 2>/dev/null
cp -r projshow/server/data/uploads       $BK/projshow/uploads
cp projshow/server/data/seed.json        $BK/projshow/
```

### `voiceover`
**Data to back up**:
- `voiceover/.env` — **critical**: contains `MINIMAX_GROUP_ID` and `MINIMAX_API_KEY`. This is gitignored and would be lost.

```bash
mkdir -p $BK/voiceover
cp voiceover/.env $BK/voiceover/
```

### `SmsCat`, `wegame`
Present in the repo but **not** in `ecosystem.config.cjs`, so PM2 does not manage them. Back up their `.env`/data if they run as separate services:

```bash
cp SmsCat/.env $BK/ 2>/dev/null
```

---

## 🔒 Safe Shutdown & Clean Backup (Run Before Upgrade)

> **Important**: Copy databases while the app is **stopped** (or use a consistent snapshot). SQLite WAL files only hold un-checkpointed data; copying the live `-wal` alongside the main DB is the correct manual method. For a guaranteed-consistent copy, prefer stopping PM2 first.

```bash
# 1. Stop all PM2 managed processes
pm2 stop ecosystem.config.cjs

# 2. (Optional but recommended) run a clean VACUUM snapshot of each DB
#    so the backup is a single consistent file without -wal/-shm.
#    Example for each SQLite DB (substitute the real path):
sqlite3 acbarcode/server/data/templates.db \
  "VACUUM INTO '$BK/acbarcode/templates_clean.db'"
sqlite3 timesheet-lite/backend/database.db \
  "VACUUM INTO '$BK/timesheet-lite/database_clean.db'"
sqlite3 creatorcenter/backend/transt.db \
  "VACUUM INTO '$BK/creatorcenter/transt_clean.db'"
sqlite3 s4c-lab-server/server/prisma/dev.db \
  "VACUUM INTO '$BK/s4c-lab/dev_clean.db'"
sqlite3 projshow/server/data/projshow.db \
  "VACUUM INTO '$BK/projshow/projshow_clean.db'"

# 3. Copy the data (see per-project commands above), then:
#    verify the backups look sane (file sizes > 0)
ls -lahR $BK

# 4. Save PM2 configuration
pm2 save
```

---

## 🛠️ Post-Upgrade Recovery Steps (Execute on new Ubuntu)

Run the following commands in order after completing the `do-release-upgrade`:

### Step 1: Install Ubuntu Base & System Libraries
```bash
sudo apt update
sudo apt install -y build-essential python3-dev python3-pip python3-venv \
    libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 libffi-dev shared-mime-info fonts-liberation
```

### Step 2: Re-create Python Virtual Environments

#### 🔹 `timesheet-lite` (single app: backend + frontend)
```bash
cd timesheet-lite/backend
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
deactivate
cd ../..

# Rebuild the frontend bundle that the backend serves (only if stale)
cd timesheet-lite/frontend
rm -rf node_modules package-lock.json
npm install
npm run build
cd ../..
```

#### 🔹 `creatorcenter`
```bash
cd creatorcenter
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
deactivate
cd ..
```

### Step 3: Rebuild Node Native Modules & Prisma Engines

#### 🔹 `projshow` (`better-sqlite3`)
```bash
cd projshow/server
rm -rf node_modules package-lock.json
npm install
cd ../..
```

#### 🔹 `s4c-lab` (`@prisma/client` & `SQLite`)
```bash
cd s4c-lab-server/server
rm -rf node_modules package-lock.json
npm install
npx prisma generate
cd ../..
```

#### 🔹 `acbarcode` (`@napi-rs/canvas`)
```bash
cd acbarcode
npm rebuild
cd ..
```

### Step 4: Restart PM2 & Re-bind Systemd Startup Hook

```bash
# Restart all PM2 managed processes
pm2 restart ecosystem.config.cjs

# Update PM2 systemd startup hook for the new Ubuntu paths
pm2 unstartup
pm2 startup systemd
pm2 save
```

---

## ✅ Post-Upgrade Verification Checklist

Verify all ports and applications are healthy:

```bash
# 1. Check PM2 Status (All apps should show 'online')
pm2 status

# 2. Check PM2 Logs for errors
pm2 logs --lines 20

# 3. Test API Ports
curl -I http://127.0.0.1:9018  # s4c-web
curl -I http://127.0.0.1:9024  # s4c-web-ac
curl -I http://127.0.0.1:9019  # s4a-web
curl -I http://127.0.0.1:9016  # acbarcode
curl -I http://127.0.0.1:9021  # timesheet-lite (API + frontend)
curl -I http://127.0.0.1:9022  # creatorcenter
curl -I http://127.0.0.1:9017  # s4c-lab
curl -I http://127.0.0.1:9023  # projshow
curl -I http://127.0.0.1:9025  # voiceover

# 4. Data sanity checks (rows still present in each DB)
sqlite3 timesheet-lite/backend/database.db "SELECT COUNT(*) FROM user;"
sqlite3 creatorcenter/backend/transt.db "SELECT COUNT(*) FROM projects;"
sqlite3 s4c-lab-server/server/prisma/dev.db "SELECT COUNT(*) FROM User;"
sqlite3 projshow/server/data/projshow.db "SELECT COUNT(*) FROM projects;" 2>/dev/null
sqlite3 acbarcode/server/data/templates.db "SELECT COUNT(*) FROM templates;" 2>/dev/null

# 5. Restore test: after confirming all good, keep the backup dir for a few days,
#    then clean it up:
#    rm -rf ~/backups/upgrade-<date>
```

---

## 🧯 Rollback Plan (If Upgrade Fails)

Ubuntu `do-release-upgrade` keeps the previous OS available for rollback, but after a major upgrade the safest rollback is **restoring from a full disk/image snapshot** (e.g. provider snapshot, `rsync` of `/etc`, `/home`, `/srv`, and `/var/www`). The per-project backups above (databases + `.env` + uploads) are the application-level safety net — they let you re-provision a fresh Ubuntu 24.04 box and restore all data into a clean install.
