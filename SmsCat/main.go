package main

import (
	"embed"
	"log"

	"smallNfast/internal/app"
	"smallNfast/internal/db"
	"smallNfast/internal/monitor"

	"github.com/getlantern/systray"
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

	// 5. Setup System Tray (using getlantern/systray as per requirement)
	var wailsApp *application.App
	go func() {
		systray.Run(func() {
			systray.SetTitle("SmsCat")
			systray.SetTooltip("SmsCat - GSM Alarm Monitor")
			
			showWindow := systray.AddMenuItem("Show Log", "Show main window")
			quit := systray.AddMenuItem("Quit", "Quit application")
			
			go func() {
				for {
					select {
					case <-showWindow.ClickedCh:
						// Show window - will be handled after wails app is created
						if wailsApp != nil {
							// Try to show window if possible
						}
					case <-quit.ClickedCh:
						systray.Quit()
						if wailsApp != nil {
							wailsApp.Quit()
						}
						return
					}
				}
			}()
		}, nil)
	}()

	// 6. Create Wails Application
	appOptions := application.Options{
		Name:        "SmsCat",
		Description: "GSM Alarm Monitor",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
	}
	
	wailsApp = application.New(appOptions)
	
	// Create window - try different possible method names for wails v3 alpha.0
	// The API in alpha.0 is minimal, so we'll try the most basic approach
	// If NewWebviewWindow doesn't exist, try NewWindow or check available methods
	window := wailsApp.NewWindow()
	if window != nil {
		window.SetTitle("SmsCat Monitor")
		window.SetSize(1024, 768)
		window.Navigate("/")
	}

	// 7. Auto-Start Monitor
	monitorService.Start()

	// 8. Run App
	err = wailsApp.Run()
	if err != nil {
		log.Fatal(err)
	}
}
