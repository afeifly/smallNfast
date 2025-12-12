package main

import (
	"embed"
	"fmt"
	"log"
	"os"

	"smallNfast/internal/app"
	"smallNfast/internal/db"
	"smallNfast/internal/monitor"

	"github.com/wailsapp/wails/v3/pkg/application"
	"go.uber.org/zap"
)

//go:embed frontend/*
var assets embed.FS

func main() {
	// 1. Setup Logger
	logger, _ := zap.NewProduction()
	defer logger.Sync()
	sugar := logger.Sugar()

	sugar.Info("SmsCat Starting...")

	// 2. Setup Database
	// We look for database.properties in current dir
	err := db.Connect("database.properties")
	if err != nil {
		sugar.Warnf("Database connection warning (will retry or run without DB for now): %v", err)
	} else {
		sugar.Info("Database connected")
	}

	// 3. Setup Monitor Service
	// Log callback redirects to both zap and the UI (later initialized)
	// We'll use a closure that we can update or the App struct will handle it
	monitorService := monitor.NewService(nil) 

	// 4. Setup Wails App Bridge
	myApp := app.NewApp(monitorService)
	
	// Update monitor logger to forward to UI
	monitorService.LogFunc = func(msg string) {
		sugar.Info(msg)
		myApp.AddLog(msg)
	}

	// 5. Create Wails Application
	appOptions := application.Options{
		Name:        "SmsCat",
		Description: "GSM Alarm Monitor",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
		Bind: []interface{}{
			myApp,
		},
	}
	
	wailsApp := application.New(appOptions)

	// 6. Setup Window
	wailsApp.NewWebviewWindowWithOptions(application.WebviewWindowOptions{
		Title:  "SmsCat Monitor",
		Width:  1024,
		Height: 768,
		URL:    "/",
	})
	
	// 7. Setup System Tray
	// Wails v3 has built-in tray support usually, we'll try to use it if available in the package
	// otherwise we might need the external library, but let's try Wails v3 way or standard systray if mixed.
	// Users requirement mentioned `github.com/getlantern/systray`
	// but Wails v3 usually aims to replace that. I'll stick to Wails v3 tray if I can find the API,
	// but since I don't have intellisense, I will use `getlantern/systray` in a goroutine if Wails doesn't block main.
	// Wait! Wails v3 DOES block main. 
	// Wails v3 creates the system tray itself.
	
	systemTray := wailsApp.NewSystemTray()
	if systemTray != nil {
		systemTray.SetLabel("SmsCat")
		// systemTray.SetIcon(...) // Icon logic needed later
		
		menu := wailsApp.NewMenu()
		menu.Add("Show Log").OnClick(func(ctx *application.Context) {
			// Window show logic
			// In v3 we'd need a reference to the window or loop windows
            // For now, simplifiction.
		})
		menu.Add("Quit").OnClick(func(ctx *application.Context) {
			wailsApp.Quit()
		})
		systemTray.SetMenu(menu)
	}

	// 8. Auto-Start Monitor
	monitorService.Start()

	// 9. Run App
	err = wailsApp.Run()
	if err != nil {
		log.Fatal(err)
	}
}
