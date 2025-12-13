package config

import (
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

const (
	registryPath = `Software\Microsoft\Windows\CurrentVersion\Run`
	appName      = "SMSCat"
)

var lastError error

func EnableAutoStart() error {
	k, err := registry.OpenKey(registry.CURRENT_USER, registryPath, registry.QUERY_VALUE|registry.SET_VALUE)
	if err != nil {
		lastError = fmt.Errorf("failed to open registry key: %w", err)
		return lastError
	}
	defer k.Close()

	exePath, err := os.Executable()
	if err != nil {
		lastError = fmt.Errorf("failed to get executable path: %w", err)
		return lastError
	}

	// Get absolute path to ensure it works correctly
	absPath, err := filepath.Abs(exePath)
	if err != nil {
		lastError = fmt.Errorf("failed to get absolute path: %w", err)
		return lastError
	}

	// Windows Run registry requires quotes around path if it contains spaces
	// Also ensure the path is properly formatted
	regValue := `"` + absPath + `"`

	// Set the registry value with the full absolute path (quoted)
	err = k.SetStringValue(appName, regValue)
	if err != nil {
		lastError = fmt.Errorf("failed to set registry value '%s' to '%s': %w", appName, regValue, err)
		return lastError
	}
	
	lastError = nil
	return nil
}

func DisableAutoStart() error {
	k, err := registry.OpenKey(registry.CURRENT_USER, registryPath, registry.SET_VALUE)
	if err != nil {
		lastError = fmt.Errorf("failed to open registry key: %w", err)
		return lastError
	}
	defer k.Close()

	err = k.DeleteValue(appName)
	if err != nil && err != registry.ErrNotExist {
		lastError = fmt.Errorf("failed to delete registry value: %w", err)
		return lastError
	}
	
	lastError = nil
	return nil
}

func IsAutoStartEnabled() bool {
	k, err := registry.OpenKey(registry.CURRENT_USER, registryPath, registry.QUERY_VALUE)
	if err != nil {
		lastError = fmt.Errorf("failed to open registry key: %w", err)
		return false
	}
	defer k.Close()

	value, _, err := k.GetStringValue(appName)
	if err != nil {
		if err == registry.ErrNotExist {
			lastError = nil
		} else {
			lastError = fmt.Errorf("failed to read registry value: %w", err)
		}
		return false
	}
	
	// Also check if the path matches current executable
	exePath, _ := os.Executable()
	if exePath != "" {
		absPath, _ := filepath.Abs(exePath)
		quotedPath := `"` + absPath + `"`
		if value != quotedPath && value != absPath {
			// Registry value exists but doesn't match current exe
			lastError = fmt.Errorf("registry value exists but points to different executable: %s (expected: %s)", value, quotedPath)
			return false
		}
	}
	
	lastError = nil
	return true
}

// GetLastError returns the last error encountered
func GetLastError() error {
	return lastError
}
