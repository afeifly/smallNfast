package main

import (
	"context"
	"embed"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
	"unsafe"

	"smallNfast/internal/app"
	"smallNfast/internal/db"
	filelogger "smallNfast/internal/logger"
	"smallNfast/internal/monitor"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
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
	ret, _, err := procCreateMutexW.Call(
		0, // lpMutexAttributes (NULL)
		0, // bInitialOwner (FALSE)
		uintptr(unsafe.Pointer(windows.StringToUTF16Ptr(mutexName))),
	)
	
	if ret == 0 {
		// Failed to create mutex - allow it to run (better than blocking)
		return true
	}
	
	// Check if mutex already existed
	if err == windows.ERROR_ALREADY_EXISTS {
		// Close the mutex handle we just got
		procCloseHandle.Call(ret)
		// Show a message box to inform the user
		user32 := windows.NewLazySystemDLL("user32.dll")
		messageBox := user32.NewProc("MessageBoxW")
		title, _ := windows.UTF16PtrFromString("SMSCat")
		text, _ := windows.UTF16PtrFromString("SMSCat is already running!")
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
		os.Exit(0)
	}
	
	// Setup Logger
	logger, _ := zap.NewProduction()
	defer logger.Sync()
	sugar := logger.Sugar()

	sugar.Info("SMSCat Starting...")

	// Setup File Logger (logs/YYYY-MM-DD.log)
	if err := filelogger.InitFileLogger("logs"); err != nil {
		sugar.Warnf("Failed to initialize file logger: %v", err)
	}
	defer filelogger.Close()

	// Setup Wails App Bridge
	monitorService := monitor.NewService(nil) 
	myApp := app.NewApp(monitorService)
	
	// Log startup message to file
	myApp.AddLog("SMSCat Starting...")
	
	// Update monitor logger to forward to UI and file
	monitorService.LogFunc = func(msg string) {
		sugar.Info(msg)
		myApp.AddLog(msg)
	}

	// Setup Database with retry logic (in background)
	go func() {
		retryCount := 0
		retryDelay := 10 * time.Second
		
		for {
			dbErr := db.Connect("database.properties")
			if dbErr != nil {
				retryCount++
				errMsg := fmt.Sprintf("Error: Cannot connect to database: %v. Retrying in %v...", dbErr, retryDelay)
				sugar.Warn(errMsg)
				myApp.AddLog(errMsg)
				time.Sleep(retryDelay)
			} else {
				successMsg := "Database connected successfully."
				sugar.Info(successMsg)
				myApp.AddLog(successMsg)
				
				// Auto-Start Monitor (Only after DB is connected)
				myApp.AddLog("Starting monitor service...")
				monitorService.Start()
				myApp.AddLog("Monitor service started")
				filelogger.Write("DEBUG: Monitor service started")
				
				break
			}
		}
	}()

	// Run Wails App
	myApp.AddLog("Initializing Wails application...")
	filelogger.Write("DEBUG: About to call wails.Run")
	sugar.Info("About to call wails.Run")
	
	err := wails.Run(&options.App{
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
			filelogger.Write("DEBUG: OnStartup callback called")
			myApp.AddLog("OnStartup: Window opened successfully")
			myApp.Startup(ctx)
		},
		OnDomReady: func(ctx context.Context) {
			filelogger.Write("DEBUG: OnDomReady callback called")
			myApp.AddLog("OnDomReady: UI ready")
		},
		Bind: []interface{}{
			myApp,
		},
	})
	
	if err != nil {
		errMsg := fmt.Sprintf("FATAL: Wails failed to start: %v", err)
		myApp.AddLog(errMsg)
		sugar.Fatal(errMsg)
		log.Fatal("Error:", err)
	}
	
	myApp.AddLog("Application exited")
}
