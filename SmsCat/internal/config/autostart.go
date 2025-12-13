package config

import (
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

const (
	registryPath = `Software\Microsoft\Windows\CurrentVersion\Run`
	appName      = "SMSCat"
)

func EnableAutoStart() error {
	k, err := registry.OpenKey(registry.CURRENT_USER, registryPath, registry.QUERY_VALUE|registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()

	exePath, err := os.Executable()
	if err != nil {
		return err
	}

	// Get absolute path to ensure it works correctly
	absPath, err := filepath.Abs(exePath)
	if err != nil {
		return err
	}

	// Windows Run registry requires quotes around path if it contains spaces
	// Also ensure the path is properly formatted
	regValue := absPath
	if absPath != "" {
		// Add quotes to handle paths with spaces
		regValue = `"` + absPath + `"`
	}

	// Set the registry value with the full absolute path (quoted)
	return k.SetStringValue(appName, regValue)
}

func DisableAutoStart() error {
	k, err := registry.OpenKey(registry.CURRENT_USER, registryPath, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()

	return k.DeleteValue(appName)
}

func IsAutoStartEnabled() bool {
	k, err := registry.OpenKey(registry.CURRENT_USER, registryPath, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer k.Close()

	_, _, err = k.GetStringValue(appName)
	return err == nil
}
