#!/bin/bash
# Rebuild the Dart-Wasm module.
# All outputs go to s4a-web/public/ — loaded at runtime, NOT bundled by Vite.
# CsdAPI.js loads csd_handler.mjs via  import(/* @vite-ignore */ '/csd_handler.mjs')
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_DIR="$SCRIPT_DIR/../../s4a-web/public"

mkdir -p "$PUBLIC_DIR"

echo "Building Dart Wasm module..."
cd "$SCRIPT_DIR"
dart compile wasm bin/main.dart -o "$PUBLIC_DIR/csd_handler.wasm"

echo "✅  Done."
echo "    $(ls -sh "$PUBLIC_DIR"/csd_handler.wasm)"
echo "    $(ls -sh "$PUBLIC_DIR"/csd_handler.mjs)"
