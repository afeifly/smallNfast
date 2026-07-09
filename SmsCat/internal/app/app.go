package app

import (
	"context"
	"fmt"
	"os"
	"strings"
	"smallNfast/internal/config"
	"smallNfast/internal/db"
	"smallNfast/internal/logger"
	"smallNfast/internal/monitor"
	"smallNfast/internal/serial"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx        context.Context
	Monitor    *monitor.Service
	LogStore   []string
	logMu      sync.Mutex
	IsQuitting bool // Flag to distinguish between Window Close and App Exit
	Version    string
}

// NewApp creates a new App application struct
func NewApp(monitor *monitor.Service, version string) *App {
	return &App{
		Monitor:  monitor,
		LogStore: make([]string, 0),
		Version:  version,
	}
}

// GetVersion returns the application version.
// It first attempts to read a local .env file in the working directory (so editing .env at runtime works),
// and falls back to the embedded version.
func (a *App) GetVersion() string {
	if data, err := os.ReadFile(".env"); err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "VERSION=") {
				ver := strings.Trim(strings.TrimPrefix(line, "VERSION="), `"'`)
				if ver != "" {
					return ver
				}
			}
		}
	}
	return a.Version
}

// Startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}

// AddLog appends a log message and emits an event to frontend
func (a *App) AddLog(msg string) {
	a.logMu.Lock()
	defer a.logMu.Unlock()

	// Keep last 300 logs (per user request)
	if len(a.LogStore) > 300 {
		a.LogStore = a.LogStore[1:]
	}
	a.LogStore = append(a.LogStore, msg)

	// Write to file logger
	logger.Write(msg)

	// Emit event to frontend if context is ready
	// Note: In Wails v3, event emission API may differ - commenting out for now
	// Events can be handled via polling GetLogs() from frontend if needed
	// if a.ctx != nil {
	// 	application.Emit(a.ctx, "log", msg)
	// }
}

// --- Exposed Methods ---

func (a *App) GetLogs() []string {
	a.logMu.Lock()
	defer a.logMu.Unlock()
	// Return copy
	logs := make([]string, len(a.LogStore))
	copy(logs, a.LogStore)
	return logs
}

func (a *App) GetRecipients() ([]db.SmsModel, error) {
	return db.GetRecipients()
}

func (a *App) AddRecipient(name, number string) error {
	// Map name to PortName, number to Recipient
	// Default Actived to true
	sms := db.SmsModel{
		PortName:  name,
		Recipient: number,
		Actived:   true,
	}
	return db.AddRecipient(sms)
}

func (a *App) DeleteRecipient(id int64) error {
	return db.DeleteRecipient(id)
}

func (a *App) CheckPorts() []string {
	return serial.CheckAvailablePorts()
}

func (a *App) GetStatus() map[string]interface{} {
	if a.Monitor == nil {
		return map[string]interface{}{
			"state": "stopped",
			"port":  "",
		}
	}
	return map[string]interface{}{
		"state": a.Monitor.State, // "stopped", "initializing", "running", "error"
		"port":  a.Monitor.PortName,
	}
}

func (a *App) SetAutoStart(enable bool) error {
	var err error
	if enable {
		err = config.EnableAutoStart()
		if err != nil {
			a.AddLog(fmt.Sprintf("ERROR: Failed to enable auto-start: %v", err))
			return err
		}
		a.AddLog("Auto-start enabled successfully - SMSCat will start with Windows")
	} else {
		err = config.DisableAutoStart()
		if err != nil {
			a.AddLog(fmt.Sprintf("ERROR: Failed to disable auto-start: %v", err))
			return err
		}
		a.AddLog("Auto-start disabled successfully - SMSCat will not start with Windows")
	}
	return nil
}

func (a *App) GetAutoStart() bool {
	return config.IsAutoStartEnabled()
}

func (a *App) Show() {
	if a.ctx != nil {
		runtime.WindowShow(a.ctx)
	}
}

func (a *App) Hide() {
	if a.ctx != nil {
		runtime.WindowHide(a.ctx)
	}
}

func (a *App) RestartService() error {
	a.AddLog("Restarting Service requested...")

	if a.Monitor != nil {
		a.Monitor.Stop()
		// Clear port to force re-detection
		a.Monitor.SetModemPort("")
	}

	// Reconnect Database
	a.AddLog("Reconnecting Database...")
	err := db.Connect("database.properties")
	if err != nil {
		errMsg := fmt.Sprintf("DB Reconnect Failed: %v", err)
		a.AddLog(errMsg)
		return fmt.Errorf(errMsg)
	}
	a.AddLog("Database Connected.")

	if a.Monitor != nil {
		a.Monitor.Start()
	}

	return nil
}

func (a *App) SetLanguage(lang string) string {
	if a.Monitor != nil {
		a.Monitor.SetLanguage(lang)
		return "OK"
	}
	return "Monitor not ready"
}

// SendTestSMS sends a one-off test SMS to the given number.
// Returns "" on success, or an error message string on failure.
func (a *App) SendTestSMS(number string, text string) string {
	number = strings.TrimSpace(number)
	text = strings.TrimSpace(text)
	if number == "" || text == "" {
		return "Number and message must not be empty"
	}

	a.AddLog(fmt.Sprintf("Test SMS → %s : \"%s\"", number, text))

	// Use the monitor's active modem if available
	if a.Monitor != nil && a.Monitor.Modem != nil {
		err := a.Monitor.Modem.SendSMS(number, text)
		if err != nil {
			a.AddLog(fmt.Sprintf("Test SMS FAILED: %v", err))
			return fmt.Sprintf("Failed: %v", err)
		}
		a.AddLog("Test SMS sent successfully.")
		return ""
	}

	// Modem not initialised yet — try a quick one-shot connect
	a.AddLog("Modem not running. Attempting one-shot connect for test SMS...")
	port, err := serial.FindModemPort()
	if err != nil {
		msg := fmt.Sprintf("No modem found: %v", err)
		a.AddLog("Test SMS FAILED: " + msg)
		return msg
	}

	modem := serial.NewGSMModem(port, func(msg string, _ bool) { a.AddLog(msg) })
	if err := modem.Connect(); err != nil {
		msg := fmt.Sprintf("Modem connect failed: %v", err)
		a.AddLog("Test SMS FAILED: " + msg)
		return msg
	}
	defer modem.Close()

	if err := modem.SendSMS(number, text); err != nil {
		msg := fmt.Sprintf("Send failed: %v", err)
		a.AddLog("Test SMS FAILED: " + msg)
		return msg
	}

	a.AddLog("Test SMS sent successfully.")
	return ""
}

func (a *App) ExitApp() {
	a.AddLog("Exiting SMSCat...")
	a.IsQuitting = true // Set flag to allow actual exit
	// Quit the Wails application properly
	if a.ctx != nil {
		runtime.Quit(a.ctx)
	} else {
		// Fallback if context not available
		os.Exit(0)
	}
}

