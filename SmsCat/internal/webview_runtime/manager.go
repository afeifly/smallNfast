package webview_runtime

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
)

var loopLogger func(string, ...interface{})

func SetLogger(l func(string, ...interface{})) {
	loopLogger = l
}

func logInfo(format string, args ...interface{}) {
	if loopLogger != nil {
		loopLogger(format, args...)
	} else {
		log.Printf(format, args...)
	}
}

// ensureRuntime extracts the embedded runtime if available and returns the path.
// It returns an empty string if no embedded runtime is found.
func ensureRuntime() (string, error) {
	// 1. Check if we have an embedded runtime
	if localEmbeddedFS == nil {
		logInfo("[WebView2] No embedded runtime (FS is nil).")
		return "", nil
	}

	// 2. Read the zip file content
	// We expect the file to be named "WebView2.zip" inside the embedded FS
	zipData, err := localEmbeddedFS.ReadFile("WebView2.zip")
	if err != nil {
		logInfo("[WebView2] WebView2.zip not found in embedded FS: %v", err)
		return "", nil
	}

	// 3. Define target extraction path
	// We use %AppData%/SMSCat/WebView2Fixed
	appData, err := os.UserConfigDir()
	if err != nil {
		appData = os.TempDir()
	}
	targetDir := filepath.Join(appData, "Keynes", "SMSCat", "WebView2Fixed")

	// 4. Check if already extracted
	if info, err := os.Stat(targetDir); err == nil && info.IsDir() {
		// Basic check: if directory exists and is not empty, assume it's good.
		entries, _ := os.ReadDir(targetDir)
		if len(entries) > 0 {
			if root := findRuntimeRoot(targetDir); root != "" {
				return root, nil
			}
			// If not valid runtime, maybe partial unzip? fall through to re-extract
		}
	}

	logInfo("[WebView2] Extracting embedded runtime to %s...", targetDir)

	// 5. Extract
	zipReader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return "", fmt.Errorf("failed to create zip reader: %v", err)
	}

	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create target dir: %v", err)
	}

	for _, f := range zipReader.File {
		// Sanitize path to prevent Zip Slip
		fpath := filepath.Join(targetDir, f.Name)
		if !strings.HasPrefix(fpath, filepath.Clean(targetDir)+string(os.PathSeparator)) {
			// skip illegal paths
			continue
		}

		if f.FileInfo().IsDir() {
			os.MkdirAll(fpath, os.ModePerm)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(fpath), os.ModePerm); err != nil {
			return "", err
		}

		outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return "", err
		}

		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			return "", err
		}

		_, err = io.Copy(outFile, rc)

		outFile.Close()
		rc.Close()

		if err != nil {
			return "", err
		}
	}

	logInfo("[WebView2] Extraction complete.")

	root := findRuntimeRoot(targetDir)
	if root != "" {
		return root, nil
	}
	return targetDir, nil
}

// EnsureAndGetPath checks for a fixed WebView2 runtime and returns the path if found.
// It also sets the environment variable as a fallback.
func EnsureAndGetPath() string {
	path, err := ensureRuntime()
	if err != nil {
		logInfo("[WebView2] Setup warning: %v", err)
		return ""
	}
	if path != "" {
		logInfo("[WebView2] Using fixed runtime at: %s", path)
		os.Setenv("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", path)
		return path
	}
	logInfo("[WebView2] No fixed runtime setup performed.")
	return ""
}

// Setup calls EnsureAndGetPath but discards the return value (legacy compatibility)
func Setup() {
	EnsureAndGetPath()
}

func findRuntimeRoot(root string) string {
	// Helper to check if a dir looks like the runtime root
	isRuntime := func(dir string) bool {
		// Look for msedgewebview2.exe which is the core correct binary for fixed runtime
		// Same check as before
		if _, err := os.Stat(filepath.Join(dir, "msedgewebview2.exe")); err == nil {
			return true
		}
		return false
	}

	if isRuntime(root) {
		return root
	}

	// Search 1 level deep (folders like "Microsoft.WebView2.FixedVersionRuntime.x.y.z.x64")
	entries, _ := os.ReadDir(root)
	for _, e := range entries {
		if e.IsDir() {
			sub := filepath.Join(root, e.Name())
			if isRuntime(sub) {
				return sub
			}
		}
	}

	return ""
}
