#!/usr/bin/env bash
#
# backup_all.sh
#
# Backs up application-level data (databases, .env secrets, uploaded files,
# generated output, JSON data stores) for every PM2-managed project so that
# they survive an Ubuntu 20.04 -> 24.04 OS upgrade.
#
# Usage:
#   ./backup_all.sh [BACKUP_ROOT]
#
#   BACKUP_ROOT   (optional) destination directory. Defaults to
#                 ~/backups/upgrade-YYYYMMDD-HHMMSS
#
# Notes:
#   - Stops PM2 (pm2 stop ecosystem.config.cjs) to get consistent DB copies.
#   - Wegame is intentionally EXCLUDED (project abandoned).
#   - Run from the repository root (/Users/ex/project/smallNfast).
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

TS="$(date +%Y%m%d-%H%M%S)"
BK="${1:-$HOME/backups/upgrade-$TS}"
mkdir -p "$BK"

echo "==> Repo root:      $REPO_ROOT"
echo "==> Backup dir:     $BK"
echo ""

need() { command -v "$1" >/dev/null 2>&1 || { echo "!! missing command: $1"; return 1; }; }

# Stop PM2 to get consistent copies (ignore error if PM2 is not running)
if need pm2; then
  echo "==> Stopping PM2 managed processes..."
  pm2 stop ecosystem.config.cjs || echo "    (pm2 stop returned non-zero; continuing)"
fi

# Helper: copy a SQLite DB (with WAL/SHM) into dest dir
copy_sqlite() {
  local src="$1" dest="$2"
  if [ -f "$src" ]; then
    mkdir -p "$dest"
    cp -f "$src" "$dest/"
    [ -f "$src-wal" ] && cp -f "$src-wal" "$dest/"
    [ -f "$src-shm" ] && cp -f "$src-shm" "$dest/"
    echo "    db   : $src"
  else
    echo "    skip : $src (not found)"
  fi
}

# ---------------------------------------------------------------------------
echo ""
echo "==> s4c-web / s4c-web-ac"
mkdir -p "$BK/s4c-web"
[ -d s4c-web/dist ]         && cp -r s4c-web/dist "$BK/s4c-web/dist"         && echo "    dist copied"
[ -d s4c-web/dist-ac ]      && cp -r s4c-web/dist-ac "$BK/s4c-web/dist-ac"  && echo "    dist-ac copied"
[ -f s4c-web/.env ]         && cp s4c-web/.env "$BK/s4c-web/.env"            && echo "    .env copied"
[ -f s4c-web/.env.atlascopco ] && cp s4c-web/.env.atlascopco "$BK/s4c-web/.env.atlascopco" && echo "    .env.atlascopco copied"

echo ""
echo "==> s4a-web (vite dev; nothing persistent)"

echo ""
echo "==> acbarcode"
mkdir -p "$BK/acbarcode"
[ -f acbarcode/server/data/products.json ]    && cp acbarcode/server/data/products.json "$BK/acbarcode/"    && echo "    products.json copied"
[ -f acbarcode/server/data/odoo_config.json ] && cp acbarcode/server/data/odoo_config.json "$BK/acbarcode/" && echo "    odoo_config.json copied"
copy_sqlite "acbarcode/server/data/templates.db" "$BK/acbarcode"

echo ""
echo "==> timesheet-lite (single app serving API + frontend)"
mkdir -p "$BK/timesheet-lite"
copy_sqlite "timesheet-lite/backend/database.db" "$BK/timesheet-lite"
[ -d timesheet-lite/backend/backups ] && cp -r timesheet-lite/backend/backups "$BK/timesheet-lite/backups" && echo "    backups/ copied"

echo ""
echo "==> timesheet-lite-frontend — merged into timesheet-lite app (dist is rebuilt; nothing persistent)"

echo ""
echo "==> creatorcenter"
mkdir -p "$BK/creatorcenter"
copy_sqlite "creatorcenter/backend/transt.db" "$BK/creatorcenter"
[ -f creatorcenter/.env ]                      && cp creatorcenter/.env "$BK/creatorcenter/.env" && echo "    .env copied"
[ -d creatorcenter/backend/uploads ]           && cp -r creatorcenter/backend/uploads "$BK/creatorcenter/uploads" && echo "    uploads/ copied"
[ -d creatorcenter/backend/outputs ]           && cp -r creatorcenter/backend/outputs "$BK/creatorcenter/outputs" && echo "    outputs/ copied"
[ -d creatorcenter/backend/translation ]       && cp -r creatorcenter/backend/translation "$BK/creatorcenter/translation" && echo "    translation/ copied"

echo ""
echo "==> s4c-lab"
mkdir -p "$BK/s4c-lab"
copy_sqlite "s4c-lab-server/server/prisma/dev.db" "$BK/s4c-lab"
[ -f s4c-lab-server/server/.env ] && cp s4c-lab-server/server/.env "$BK/s4c-lab/.env" && echo "    .env copied"

echo ""
echo "==> projshow"
mkdir -p "$BK/projshow"
copy_sqlite "projshow/server/data/projshow.db" "$BK/projshow"
[ -d projshow/server/data/uploads ] && cp -r projshow/server/data/uploads "$BK/projshow/uploads" && echo "    uploads/ copied"
[ -f projshow/server/data/seed.json ] && cp projshow/server/data/seed.json "$BK/projshow/" && echo "    seed.json copied"

echo ""
echo "==> voiceover"
mkdir -p "$BK/voiceover"
[ -f voiceover/.env ] && cp voiceover/.env "$BK/voiceover/.env" && echo "    .env copied"

echo ""
echo "==> SmsCat (not PM2-managed)"
mkdir -p "$BK/SmsCat"
[ -f SmsCat/.env ] && cp SmsCat/.env "$BK/SmsCat/.env" && echo "    .env copied"

echo ""
echo "==> wegame — SKIPPED (abandoned project, per user request)"

# ---------------------------------------------------------------------------
echo ""
echo "==> Writing manifest..."
MANIFEST="$BK/MANIFEST.txt"
{
  echo "Upgrade backup created: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "Source repo root:       $REPO_ROOT"
  echo "Target OS upgrade:      Ubuntu 20.04 -> 24.04 (Python 3.8 -> 3.12)"
  echo ""
  echo "Projects backed up:"
echo "  s4c-web, s4c-web-ac, acbarcode, timesheet-lite,"
echo "  creatorcenter, s4c-lab, projshow, voiceover, SmsCat"
  echo "Excluded: wegame (abandoned)"
  echo ""
  echo "JWT secret for s4c-lab is defined in ecosystem.config.cjs"
  echo "  (s4c-lab-server/server/prisma/dev.db is the DB)."
} > "$MANIFEST"
echo "    $MANIFEST"

echo ""
echo "==> Verification: file sizes"
du -sh "$BK" 2>/dev/null
find "$BK" -type f -size 0 -print 2>/dev/null | sed 's/^/    EMPTY: /' || true
echo ""
echo "==> Backup complete: $BK"
echo "    Keep this directory until after the upgrade and verification."
