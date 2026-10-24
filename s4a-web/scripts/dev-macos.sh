#!/usr/bin/env bash
#
# macOS dev runner for the Tauri desktop app.
#
# Why this exists: since macOS 26, privacy permissions (Bluetooth, camera,
# microphone, ...) are keyed by the (code signature, *responsible process*)
# pair. `tauri dev` / `cargo tauri dev` execs the bare binary, so the terminal
# that started it becomes the responsible process for TCC. When the app touches
# CoreBluetooth, TCC checks the terminal's Info.plist (which has no
# NSBluetoothAlwaysUsageDescription) and SIGABRTs the app with
# "Namespace TCC" -- even though the app's own Info.plist declares the key.
#
# macOS only grants the permission when the app is launched through
# LaunchServices as its own process, i.e. from inside a `.app` bundle. This
# script builds the normal dev binary, wraps it in a throwaway `.app` bundle
# with the required usage descriptions, and opens it with `open`.
#
# Usage: npm run tauri:dev:macos   (or: bash scripts/dev-macos.sh)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/src-tauri"
APP="$SRC/target/debug/s4a-web Dev.app"
BIN="$SRC/target/debug/app"
DEV_URL="http://localhost:5173"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "scripts/dev-macos.sh is macOS-only; use 'npm run tauri:dev' instead." >&2
  exit 1
fi

VITE_PID=""

cleanup() {
  if [[ -n "$VITE_PID" ]]; then
    kill "$VITE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# 1. Frontend dev server (reuse if already running).
if curl -s -o /dev/null "$DEV_URL"; then
  echo ">> using existing dev server at $DEV_URL"
else
  echo ">> starting Vite dev server..."
  ( cd "$ROOT" && npm run dev ) &
  VITE_PID=$!
  for _ in $(seq 1 120); do
    curl -s -o /dev/null "$DEV_URL" && break
    sleep 0.5
  done
  if ! curl -s -o /dev/null "$DEV_URL"; then
    echo "!! dev server did not come up at $DEV_URL" >&2
    exit 1
  fi
fi

# 2. Build the dev-mode Rust binary (debug => loads devUrl).
echo ">> building Rust app (dev profile)..."
( cd "$SRC" && cargo build )

# 3. Wrap the binary in a minimal .app bundle.
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp "$BIN" "$APP/Contents/MacOS/s4a-web"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleExecutable</key>
	<string>s4a-web</string>
	<key>CFBundleIdentifier</key>
	<string>com.s4a.app</string>
	<key>CFBundleName</key>
	<string>s4a-web</string>
	<key>CFBundleDisplayName</key>
	<string>S4A Data Studio</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>0.1.0</string>
	<key>CFBundleVersion</key>
	<string>0.1.0</string>
	<key>NSBluetoothAlwaysUsageDescription</key>
	<string>S4A Data Studio uses Bluetooth to connect to SUTO BLE sensors and loggers.</string>
	<key>NSBluetoothPeripheralUsageDescription</key>
	<string>S4A Data Studio uses Bluetooth to connect to SUTO BLE sensors and loggers.</string>
	<key>NSLocalNetworkUsageDescription</key>
	<string>S4A Data Studio connects to SUTO devices over the local network.</string>
	<key>NSBonjourServices</key>
	<array/>
</dict>
</plist>
PLIST

# 4. Ad-hoc sign so the bundle has a stable TCC identity.
codesign --force --sign - "$APP" >/dev/null 2>&1 || true

# 5. Launch through LaunchServices (makes the .app its own responsible process).
echo ">> launching $APP"
open -W -n "$APP"
