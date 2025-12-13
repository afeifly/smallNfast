package main

import (
	"context"
	"embed"
	"log"
	"net/http"
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

//go:embed SMSLogo.ico
var iconBytes []byte

var (
	kernel32         = windows.NewLazySystemDLL("kernel32.dll")
	procCreateMutexW = kernel32.NewProc("CreateMutexW")
	procCloseHandle  = kernel32.NewProc("CloseHandle")
	appMutex         uintptr // Keep mutex handle for app lifetime
)

func checkSingleInstance() bool {
	mutexName := "Global\\SMSCat_SingleInstance_Mutex"
	
	// Create mutex - the third return value from Call is the last error
	ret, _, lastErr := procCreateMutexW.Call(
		0,
		0,
		uintptr(unsafe.Pointer(windows.StringToUTF16Ptr(mutexName))),
	)
	
	if ret == 0 {
		// Failed to create mutex - allow it to run (better than blocking)
		return true
	}
	
	// Check if mutex already existed (another instance is running)
	// lastErr is the GetLastError() result from the syscall
	if lastErr != 0 && lastErr == uintptr(windows.ERROR_ALREADY_EXISTS) {
		// Close the mutex handle we just got
		procCloseHandle.Call(ret)
		// Show a message box to inform the user
		kernel32 := windows.NewLazySystemDLL("user32.dll")
		messageBox := kernel32.NewProc("MessageBoxW")
		title, _ := windows.UTF16PtrFromString("SMSCat")
		text, _ := windows.UTF16PtrFromString("SMSCat is already running!")
		messageBox.Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0x30) // MB_ICONWARNING
		return false // Another instance exists
	}
	
	// Keep mutex open for the lifetime of the app
	// It will be released when the process exits
	appMutex = ret
	return true // This is the first instance
}

func main() {
	// Check for single instance
	if !checkSingleInstance() {
		// Message already shown, just exit
		os.Exit(0)
	}
	// 1. Setup Logger
	logger, _ := zap.NewProduction()
	defer logger.Sync()
	sugar := logger.Sugar()

	sugar.Info("SMSCat Starting...")

	// 2. Setup Wails App Bridge first (so we can log to UI)
	monitorService := monitor.NewService(nil) 
	myApp := app.NewApp(monitorService)
	
	// Update monitor logger to forward to UI
	monitorService.LogFunc = func(msg string) {
		sugar.Info(msg)
		myApp.AddLog(msg)
	}

	// 3. Setup Database with retry logic
	// We look for database.properties in current dir
	go func() {
		retryCount := 0
		maxRetries := -1 // Infinite retries
		retryDelay := 10 * time.Second
		
		for {
			err := db.Connect("database.properties")
			if err != nil {
				retryCount++
				errMsg := fmt.Sprintf("Error: Cannot connect to database: %v. Retrying in %v...", err, retryDelay)
				sugar.Warn(errMsg)
				myApp.AddLog(errMsg)
				time.Sleep(retryDelay)
				if maxRetries > 0 && retryCount >= maxRetries {
					myApp.AddLog("Error: Database connection failed after max retries.")
					break
				}
			} else {
				successMsg := "Database connected successfully."
				sugar.Info(successMsg)
				myApp.AddLog(successMsg)
				break
			}
		}
	}()

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
	// Note: Window title bar icon comes from resource.syso (created by rsrc during build)
	// Make sure SMSLogo.ico exists and build.bat generates resource.syso
	err = wails.Run(&options.App{
		Title:  "SMSCat Monitor for S4M",
		Width:  1200,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets:  assets,
			Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Serve favicon
				if r.URL.Path == "/SMSLogo.ico" || r.URL.Path == "/favicon.ico" {
					w.Header().Set("Content-Type", "image/x-icon")
					w.Write(iconBytes)
					return
				}
				// Default asset server
				http.FileServer(http.FS(assets)).ServeHTTP(w, r)
			}),
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
