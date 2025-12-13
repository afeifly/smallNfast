package main

import (
	"context"
	"embed"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
	"unsafe"

	"smallNfast/internal/app"
	"smallNfast/internal/db"
	filelogger "smallNfast/internal/logger"
	"smallNfast/internal/monitor"

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
	procGetLastError = kernel32.NewProc("GetLastError")
	appMutex         uintptr // Keep mutex handle for app lifetime
)

func checkSingleInstance() bool {
	lockFile := filepath.Join(os.TempDir(), "SMSCat.lock")
	
	// First, use Windows mutex as primary check (most reliable)
	mutexName := "Global\\SMSCat_SingleInstance_Mutex"
	ret, _, _ := procCreateMutexW.Call(
		0, // lpMutexAttributes (NULL)
		0, // bInitialOwner (FALSE)
		uintptr(unsafe.Pointer(windows.StringToUTF16Ptr(mutexName))),
	)
	
	if ret == 0 {
		// Failed to create mutex - allow it to run (better than blocking)
		return true
	}
	
	// Check GetLastError to see if mutex already existed
	errCode, _, _ := procGetLastError.Call()
	
	// ERROR_ALREADY_EXISTS = 183
	if errCode == 183 {
		// Close the mutex handle we just got
		procCloseHandle.Call(ret)
		// Show a message box to inform the user
		user32 := windows.NewLazySystemDLL("user32.dll")
		messageBox := user32.NewProc("MessageBoxW")
		title, _ := windows.UTF16PtrFromString("SMSCat")
		text, _ := windows.UTF16PtrFromString("SMSCat is already running!\n\nPlease check the system tray or use 'Show Window' from the tray menu.")
		messageBox.Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0x30) // MB_ICONWARNING
		return false
	}
	
	// Mutex created successfully - this is the first instance
	// Keep mutex open for the lifetime of the app
	appMutex = ret
	
	// Clean up any stale lock file
	os.Remove(lockFile)
	
	// Create new lock file with current PID
	file, err := os.OpenFile(lockFile, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
	if err == nil {
		fmt.Fprintf(file, "%d", os.Getpid())
		file.Close()
	}
	// If lock file creation fails, it's not critical - mutex is the primary check
	
	return true
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

	// 1.5. Setup File Logger (logs/YYYY-MM-DD.log)
	if err := filelogger.InitFileLogger("logs"); err != nil {
		sugar.Warnf("Failed to initialize file logger: %v", err)
	} else {
		sugar.Info("File logger initialized: logs/YYYY-MM-DD.log")
	}
	defer filelogger.Close()

	// 2. Setup Wails App Bridge first (so we can log to UI)
	monitorService := monitor.NewService(nil) 
	myApp := app.NewApp(monitorService)
	
	// Log startup message to file
	myApp.AddLog("SMSCat Starting...")
	
	// Update monitor logger to forward to UI and file
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
			dbErr := db.Connect("database.properties")
			if dbErr != nil {
				retryCount++
				errMsg := fmt.Sprintf("Error: Cannot connect to database: %v. Retrying in %v...", dbErr, retryDelay)
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
	myApp.AddLog("About to start monitor service...")
	sugar.Info("About to start monitor service...")
	monitorService.Start()
	myApp.AddLog("Monitor service started, continuing...")
	sugar.Info("Monitor service started, continuing...")
	filelogger.Write("DEBUG: After monitor service start")

	// 6. Setup System Tray (run in background, don't block main thread)
	// var wailsCtx context.Context
	// var wailsCtxMu sync.Mutex
	
	myApp.AddLog("Starting system tray setup...")
	sugar.Info("Starting system tray setup...")
	filelogger.Write("DEBUG: About to start system tray")
	
	// TEMPORARILY DISABLED SYSTEM TRAY FOR TESTING
	myApp.AddLog("System tray temporarily disabled for testing")
	
	/*
	go func() {
		defer func() {
			if r := recover(); r != nil {
				myApp.AddLog(fmt.Sprintf("System tray panic recovered: %v", r))
			}
		}()
		
		systray.Run(func() {
			myApp.AddLog("System tray initialized")
			// Set icon from ICO file
			if icoData, err := os.ReadFile("SMSLogo.ico"); err == nil && len(icoData) > 0 {
				systray.SetIcon(icoData)
			} else {
				// Log error if icon not found
				myApp.AddLog(fmt.Sprintf("Warning: Could not load SMSLogo.ico: %v", err))
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
						wailsCtxMu.Lock()
						ctx := wailsCtx
						wailsCtxMu.Unlock()
						if ctx != nil {
							runtime.WindowShow(ctx)
							runtime.WindowCenter(ctx)
							myApp.AddLog("Window shown via system tray")
						} else {
							myApp.AddLog("Warning: Window context not ready yet")
						}
					case <-quitItem.ClickedCh:
						// Quit application
						myApp.AddLog("Exiting via system tray...")
						wailsCtxMu.Lock()
						ctx := wailsCtx
						wailsCtxMu.Unlock()
						if ctx != nil {
							runtime.Quit(ctx)
						}
						systray.Quit()
						os.Exit(0)
						return
					}
				}
			}()
		}, nil)
	}()
	
	// Give systray a moment to initialize
	time.Sleep(200 * time.Millisecond)
	*/
	myApp.AddLog("Proceeding to Wails initialization...")

	// 7. Run Wails App (v2 API)
	// Note: Window title bar icon comes from resource.syso (created by rsrc during build)
	// Make sure SMSLogo.ico exists and build.bat generates resource.syso
	myApp.AddLog("Initializing Wails application...")
	sugar.Info("Starting Wails window...")
	
	wailsErr := wails.Run(&options.App{
		Title:  "SMSCat Monitor for S4M",
		Width:  1200,
		Height: 800,
		MinWidth:  800,
		MinHeight: 600,
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
			myApp.AddLog("OnStartup callback triggered")
			// wailsCtxMu.Lock()
			// wailsCtx = ctx
			// wailsCtxMu.Unlock()
			myApp.Startup(ctx)
			myApp.AddLog("Showing window...")
			// Ensure window is shown, focused, and brought to front on startup
			runtime.WindowShow(ctx)
			runtime.WindowCenter(ctx)
			// Bring window to front
			runtime.WindowUnminimise(ctx)
			myApp.AddLog("Window opened successfully")
		},
		OnBeforeClose: func(ctx context.Context) (prevent bool) {
			// Allow window to close normally - user can use Exit button or system tray
			// Only prevent if we want to hide to tray (commented out for now)
			// runtime.WindowHide(ctx)
			// return true // Prevent close
			return false // Allow close
		},
		OnDomReady: func(ctx context.Context) {
			myApp.AddLog("OnDomReady callback triggered")
			// Window is ready - make sure it's visible and in front
			runtime.WindowShow(ctx)
			runtime.WindowUnminimise(ctx)
			myApp.AddLog("Window should be visible now")
		},
		Bind: []interface{}{
			myApp,
		},
	})
	
	if wailsErr != nil {
		errMsg := fmt.Sprintf("FATAL: Wails failed to start: %v", wailsErr)
		myApp.AddLog(errMsg)
		sugar.Fatal(errMsg)
		
		// Show error message box
		user32 := windows.NewLazySystemDLL("user32.dll")
		messageBox := user32.NewProc("MessageBoxW")
		title, _ := windows.UTF16PtrFromString("SMSCat - Fatal Error")
		text, _ := windows.UTF16PtrFromString(fmt.Sprintf("Failed to start SMSCat:\n\n%v\n\nCheck logs for details.", wailsErr))
		messageBox.Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0x10) // MB_ICONERROR
		log.Fatal("Error:", wailsErr)
	}
	
	myApp.AddLog("Wails app exited normally")
}
