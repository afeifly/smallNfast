package config

import (
	"golang.org/x/sys/windows/registry"
	"os"
)

const (
	registryPath = `Software\Microsoft\Windows\CurrentVersion\Run`
	appName      = "SmsCat"
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

	return k.SetStringValue(appName, exePath)
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
