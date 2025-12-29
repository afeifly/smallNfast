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
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.uber.org/zap"
	"golang.org/x/sys/windows"

	"github.com/getlantern/systray"
)

//go:embed frontend/*
var assets embed.FS

//go:embed SMSLogo.ico
var iconBytes []byte

//go:embed SMSLogo.png
var windowIcon []byte

var (
	kernel32         = windows.NewLazySystemDLL("kernel32.dll")
	user32           = windows.NewLazySystemDLL("user32.dll")
	procCreateMutexW = kernel32.NewProc("CreateMutexW")
	procCloseHandle  = kernel32.NewProc("CloseHandle")
	procGetLastError = kernel32.NewProc("GetLastError")

	// Icon Procs
	procCreateIconFromResourceEx = user32.NewProc("CreateIconFromResourceEx")
	procFindWindowW              = user32.NewProc("FindWindowW")
	procSendMessageW             = user32.NewProc("SendMessageW")

	appMutex uintptr // Keep mutex handle for app lifetime
)

const (
	WM_SETICON      = 0x0080
	ICON_SMALL      = 0
	ICON_BIG        = 1
	LR_DEFAULTCOLOR = 0x00000000
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

	// Fix Working Directory (Critical for Auto-Start)
	// Windows Auto-Start runs from System32, breaking relative paths
	exePath, errExe := os.Executable()
	if errExe == nil {
		exeDir := filepath.Dir(exePath)
		os.Chdir(exeDir)
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

	// Link App to Systray
	trayApp = myApp
	go systray.Run(onReady, onExit)

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

				// Cleanup Test Number
				if err := db.RemoveRecipientByNumber("18922803837"); err != nil {
					sugar.Warnf("Failed to cleanup test number: %v", err)
				} else {
					sugar.Info("Test number 18922803837 cleaned up successfully")
				}

				break
			}
		}
	}()

	// Run Wails App
	myApp.AddLog("Initializing Wails application...")
	filelogger.Write("DEBUG: About to call wails.Run")
	sugar.Info("About to call wails.Run")

	err := wails.Run(&options.App{
		Title:     "SMSCat Monitor for S4M",
		Width:     1200,
		Height:    800,
		MinWidth:  800,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			Assets: assets,
			Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Serve favicon
				if r.URL.Path == "/SMSLogo.ico" || r.URL.Path == "/favicon.ico" {
					w.Header().Set("Content-Type", "image/x-icon")
					w.Write(iconBytes)
					return
				}
				if r.URL.Path == "/SMSLogo.png" {
					w.Header().Set("Content-Type", "image/png")
					w.Write(windowIcon)
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

			// Attempt to set icon at runtime via Win32
			go func() {
				// Wait for window to actually be created and titled
				time.Sleep(500 * time.Millisecond)
				setRuntimeIcon()
			}()
		},
		OnDomReady: func(ctx context.Context) {
			filelogger.Write("DEBUG: OnDomReady callback called")
			myApp.AddLog("OnDomReady: UI ready")
		},
		OnBeforeClose: func(ctx context.Context) (prevent bool) {
			// If explicitly quitting (via Tray or UI Exit button), allow close
			if myApp.IsQuitting {
				return false
			}

			// Prepare Dialog Message
			msg := "Just hide window, you can find it in system tray area."
			if myApp.Monitor != nil && myApp.Monitor.Language == "cn" {
				// Use Chinese if language is set to 'cn'
				msg = "窗口仅隐藏，您可以在系统托盘区域找到它。"
			}

			// Show Info Dialog
			_, _ = runtime.MessageDialog(ctx, runtime.MessageDialogOptions{
				Type:          runtime.InfoDialog,
				Title:         "SMSCat",
				Message:       msg,
				Buttons:       []string{"OK"},
				DefaultButton: "OK",
			})

			// Otherwise, just hide the window (minimize to tray)
			runtime.WindowHide(ctx)
			return true
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

func setRuntimeIcon() {
	if len(windowIcon) == 0 {
		return
	}

	// 1. Create HICON from PNG bytes
	// offset 0, version 0x00030000, 0x00000000 flags
	hIcon, _, _ := procCreateIconFromResourceEx.Call(
		uintptr(unsafe.Pointer(&windowIcon[0])),
		uintptr(len(windowIcon)),
		1,          // TRUE for Icon
		0x00030000, // Version
		0, 0,       // Desired Width/Height (0 = default)
		LR_DEFAULTCOLOR,
	)

	if hIcon == 0 {
		fmt.Println("Failed to create HICON from bytes")
		return
	}

	// 2. Find the Window
	// ClassName nil, WindowName = Title
	titlePtr, _ := windows.UTF16PtrFromString("SMSCat Monitor for S4M")
	hWnd, _, _ := procFindWindowW.Call(
		0,
		uintptr(unsafe.Pointer(titlePtr)),
	)

	if hWnd == 0 {
		fmt.Println("Failed to find window 'SMSCat Monitor for S4M'")
		return
	}

	// 3. Set Icon (Small and Big)
	procSendMessageW.Call(hWnd, WM_SETICON, ICON_SMALL, hIcon)
	procSendMessageW.Call(hWnd, WM_SETICON, ICON_BIG, hIcon)
}
