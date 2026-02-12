#!/bin/bash
# Cross-compile script to build Windows EXE on macOS

OUTPUT_NAME="SMSCat.exe"
WEBVIEW_ZIP="internal/webview_runtime/WebView2.zip"

# Parse arguments
BUILD_MODE="normal"
if [ "$1" == "win7" ]; then
    BUILD_MODE="win7"
fi

echo "Building $OUTPUT_NAME on macOS..."

# 1. Install dependencies
echo "Installing dependencies..."
go mod tidy
if [ $? -ne 0 ]; then
    echo "Failed to install dependencies"
    exit 1
fi

# 2. Check/Install rsrc for icon embedding
if ! command -v rsrc &> /dev/null; then
    echo "rsrc tool not found. Installing..."
    go install github.com/akavel/rsrc@latest
fi

# 3. Generate resource.syso if rsrc and ico exist
if [ -f "SMSLogo.ico" ] && command -v rsrc &> /dev/null; then
    echo "Generating resource file for icon..."
    rm -f resource.syso
    if [ -f "app.manifest" ]; then
        rsrc -manifest app.manifest -ico SMSLogo.ico -o resource.syso
    else
        rsrc -ico SMSLogo.ico -o resource.syso
    fi
fi

# 4. Configure Build Tags
BUILD_TAGS="desktop,production"

if [ "$BUILD_MODE" == "win7" ]; then
    if [ -f "$WEBVIEW_ZIP" ]; then
        echo "Build Mode: Windows 7 Support (Embedded WebView2)"
        BUILD_TAGS="$BUILD_TAGS,embed_webview"
    else
        echo "Error: Win7 build requested but $WEBVIEW_ZIP not found!"
        echo "Please download the fixed version runtime (109.0.1518.78) and place it there."
        exit 1
    fi
else
    echo "Build Mode: Standard (System WebView2)"
fi

# 5. Build
echo "Compiling for Windows (amd64)..."

MINGW_CC=""
if command -v x86_64-w64-mingw32-gcc &> /dev/null; then
    MINGW_CC="x86_64-w64-mingw32-gcc"
fi

if [ -n "$MINGW_CC" ]; then
    CGO_ENABLED=1 CC=$MINGW_CC GOOS=windows GOARCH=amd64 go build -tags "$BUILD_TAGS" -ldflags "-s -w -H windowsgui" -o "$OUTPUT_NAME"
else
    echo "MinGW compiler not found. Attempting build with CGO_ENABLED=0..."
    CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -tags "$BUILD_TAGS" -ldflags "-s -w -H windowsgui" -o "$OUTPUT_NAME"
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "Build successful! $OUTPUT_NAME created."
    if [ "$BUILD_MODE" == "win7" ]; then
        echo "NOTE: This build contains the embedded WebView2 runtime (~150MB+)."
    else
        echo "NOTE: This build requires WebView2 Runtime installed on the target machine."
    fi
else
    echo ""
    echo "Build failed."
    exit 1
fi
