package main

import (
	"context"
	"embed"
	"log"
	"os"
	"unsafe"

	"smallNfast/internal/app"
	"smallNfast/internal/db"
	"smallNfast/internal/monitor"

	"github.com/getlantern/systray"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.uber.org/zap"
	"golang.org/x/sys/windows"
)

//go:embed frontend/*
var assets embed.FS

var (
	kernel32         = windows.NewLazySystemDLL("kernel32.dll")
	procCreateMutexW = kernel32.NewProc("CreateMutexW")
	procCloseHandle  = kernel32.NewProc("CloseHandle")
)

func createMutex(name string) (uintptr, error) {
	ret, _, err := procCreateMutexW.Call(
		0,
		0,
		uintptr(unsafe.Pointer(windows.StringToUTF16Ptr(name))),
	)
	if ret == 0 {
		return 0, err
	}
	return ret, nil
}

func checkSingleInstance() bool {
	mutexName := "Global\\SMSCat_SingleInstance_Mutex"
	mutex, err := createMutex(mutexName)
	if err != nil {
		return false
	}
	
	// Check if mutex already exists (another instance is running)
	lastErr := windows.GetLastError()
	if lastErr == windows.ERROR_ALREADY_EXISTS {
		// Close the mutex handle we just got
		if mutex != 0 {
			procCloseHandle.Call(mutex)
		}
		return false // Another instance exists
	}
	
	// Keep mutex open for the lifetime of the app
	// It will be released when the process exits
	return true // This is the first instance
}

func main() {
	// Check for single instance
	if !checkSingleInstance() {
		log.Println("SMSCat is already running. Exiting...")
		os.Exit(0)
	}
	// 1. Setup Logger
	logger, _ := zap.NewProduction()
	defer logger.Sync()
	sugar := logger.Sugar()

	sugar.Info("SMSCat Starting...")

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

	// 5. Auto-Start Monitor
	monitorService.Start()

	// 6. Setup System Tray (run in goroutine)
	var wailsCtx context.Context
	
		go func() {
			systray.Run(func() {
				// Set icon from ICO file
				if icoData, err := os.ReadFile("SMSLogo.ico"); err == nil && len(icoData) > 0 {
					systray.SetIcon(icoData)
				}
				
				systray.SetTitle("SMSCat")
				systray.SetTooltip("SMSCat - GSM Alarm Monitor")
				
				// Add title menu item (disabled, acts as header)
				titleItem := systray.AddMenuItem("SMSCat", "")
				titleItem.Disable()
				systray.AddSeparator()
				
				showWindow := systray.AddMenuItem("Show Window", "Show main window")
				showWindow.Enable()
				systray.AddSeparator()
				quitItem := systray.AddMenuItem("Quit", "Exit SMSCat")
			
			go func() {
				for {
					select {
					case <-showWindow.ClickedCh:
						// Show window via runtime if available
						if wailsCtx != nil {
							runtime.WindowShow(wailsCtx)
						}
					case <-quitItem.ClickedCh:
						// Quit application
						if wailsCtx != nil {
							runtime.Quit(wailsCtx)
						}
						systray.Quit()
						os.Exit(0)
						return
					}
				}
			}()
		}, nil)
	}()

	// 7. Run Wails App (v2 API)
	err = wails.Run(&options.App{
		Title:  "SMSCat Monitor",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup: func(ctx context.Context) {
			wailsCtx = ctx
			myApp.Startup(ctx)
		},
		OnBeforeClose: func(ctx context.Context) (prevent bool) {
			// Prevent window close - hide instead
			// Only allow exit via system tray
			runtime.WindowHide(ctx)
			return true // Prevent close
		},
		Bind: []interface{}{
			myApp,
		},
	})
	
	if err != nil {
		log.Fatal("Error:", err)
	}
}
