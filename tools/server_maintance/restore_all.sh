#!/usr/bin/env bash
#
# restore_all.sh
#
# Restores application-level data (databases, .env secrets, uploaded files,
# generated output, JSON data stores) that were saved by backup_all.sh back
# into the freshly-upgraded project tree.
#
# Usage:
#   ./restore_all.sh [BACKUP_ROOT]
#
#   BACKUP_ROOT   The directory created by backup_all.sh (the one containing
#                 MANIFEST.txt). If omitted, the most recent
#                 ~/backups/upgrade-* is used.
#
# Notes:
#   - Run from the repository root (/Users/ex/project/smallNfast) on the NEW
#     Ubuntu 24.04 after you have re-cloned/re-checked-out the code.
#   - Run this AFTER completing the environment rebuild steps in
#     upgrade_plan.md (Step 2 recreate .venv, Step 3 npm install), so that
#     database files are restored into the fresh environment.
#   - Wegame is NOT restored (abandoned project).
#   - Databases are copied back (including WAL/SHM). Start PM2 only after all
#     restores finish.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# Pick backup dir: explicit arg, else most recent upgrade-* in ~/backups
BK="${1:-}"
if [ -z "$BK" ]; then
  BK="$(ls -1dt "$HOME"/backups/upgrade-* 2>/dev/null | head -n1 || true)"
fi
if [ -z "$BK" ] || [ ! -d "$BK" ]; then
  echo "!! No backup directory found. Pass it explicitly:"
  echo "   ./restore_all.sh /path/to/backup/dir"
  exit 1
fi

echo "==> Repo root:      $REPO_ROOT"
echo "==> Restoring from: $BK"
echo ""

[ -f "$BK/MANIFEST.txt" ] && { echo "==> Backup manifest:"; sed 's/^/    /' "$BK/MANIFEST.txt"; echo ""; }

# Helper: restore a SQLite DB (main + WAL + SHM) from backup dir
restore_sqlite() {
  local backup_dir="$1" src_name="$2" dest_path="$3"
  if [ -f "$backup_dir/$src_name" ]; then
    mkdir -p "$(dirname "$dest_path")"
    cp -f "$backup_dir/$src_name" "$dest_path"
    [ -f "$backup_dir/$src_name-wal" ] && cp -f "$backup_dir/$src_name-wal" "$dest_path-wal"
    [ -f "$backup_dir/$src_name-shm" ] && cp -f "$backup_dir/$src_name-shm" "$dest_path-shm"
    echo "    db   : $dest_path"
  else
    echo "    skip : $src_name (not in backup)"
  fi
}

echo "==> s4c-web / s4c-web-ac"
[ -d "$BK/s4c-web/dist" ]    && mkdir -p s4c-web && cp -r "$BK/s4c-web/dist" s4c-web/dist    && echo "    dist restored"
[ -d "$BK/s4c-web/dist-ac" ] && mkdir -p s4c-web && cp -r "$BK/s4c-web/dist-ac" s4c-web/dist-ac && echo "    dist-ac restored"
[ -f "$BK/s4c-web/.env" ]         && cp "$BK/s4c-web/.env" s4c-web/.env         && echo "    .env restored"
[ -f "$BK/s4c-web/.env.atlascopco" ] && cp "$BK/s4c-web/.env.atlascopco" s4c-web/.env.atlascopco && echo "    .env.atlascopco restored"

echo ""
echo "==> acbarcode"
[ -f "$BK/acbarcode/products.json" ]    && mkdir -p acbarcode/server/data && cp "$BK/acbarcode/products.json" acbarcode/server/data/products.json && echo "    products.json restored"
[ -f "$BK/acbarcode/odoo_config.json" ] && cp "$BK/acbarcode/odoo_config.json" acbarcode/server/data/odoo_config.json && echo "    odoo_config.json restored"
restore_sqlite "$BK/acbarcode" "templates.db" "acbarcode/server/data/templates.db"

echo ""
echo "==> timesheet-lite (single app serving API + frontend)"
restore_sqlite "$BK/timesheet-lite" "database.db" "timesheet-lite/backend/database.db"
[ -d "$BK/timesheet-lite/backups" ] && cp -r "$BK/timesheet-lite/backups" timesheet-lite/backend/backups && echo "    backups/ restored"

echo ""
echo "==> creatorcenter"
restore_sqlite "$BK/creatorcenter" "transt.db" "creatorcenter/backend/transt.db"
[ -f "$BK/creatorcenter/.env" ]       && cp "$BK/creatorcenter/.env" creatorcenter/.env && echo "    .env restored"
[ -d "$BK/creatorcenter/uploads" ]    && mkdir -p creatorcenter/backend && cp -r "$BK/creatorcenter/uploads" creatorcenter/backend/uploads && echo "    uploads/ restored"
[ -d "$BK/creatorcenter/outputs" ]    && cp -r "$BK/creatorcenter/outputs" creatorcenter/backend/outputs && echo "    outputs/ restored"
[ -d "$BK/creatorcenter/translation" ] && cp -r "$BK/creatorcenter/translation" creatorcenter/backend/translation && echo "    translation/ restored"

echo ""
echo "==> s4c-lab"
restore_sqlite "$BK/s4c-lab" "dev.db" "s4c-lab-server/server/prisma/dev.db"
[ -f "$BK/s4c-lab/.env" ] && cp "$BK/s4c-lab/.env" s4c-lab-server/server/.env && echo "    .env restored"

echo ""
echo "==> projshow"
restore_sqlite "$BK/projshow" "projshow.db" "projshow/server/data/projshow.db"
[ -d "$BK/projshow/uploads" ] && mkdir -p projshow/server/data && cp -r "$BK/projshow/uploads" projshow/server/data/uploads && echo "    uploads/ restored"
[ -f "$BK/projshow/seed.json" ] && cp "$BK/projshow/seed.json" projshow/server/data/seed.json && echo "    seed.json restored"

echo ""
echo "==> voiceover"
[ -f "$BK/voiceover/.env" ] && mkdir -p voiceover && cp "$BK/voiceover/.env" voiceover/.env && echo "    .env restored"

echo ""
echo "==> SmsCat"
[ -f "$BK/SmsCat/.env" ] && mkdir -p SmsCat && cp "$BK/SmsCat/.env" SmsCat/.env && echo "    .env restored"

echo ""
echo "==> wegame — SKIPPED (abandoned project)"

echo ""
echo "==> Restore complete."
echo "    Next: start PM2 and verify per the 'Post-Upgrade Verification' section"
echo "    of upgrade_plan.md:"
echo "        pm2 start ecosystem.config.cjs"
echo "        pm2 status"
echo "        pm2 logs --lines 20"
