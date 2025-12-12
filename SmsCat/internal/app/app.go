package app

import (
	"context"
	"fmt"
	"smallNfast/internal/config"
	"smallNfast/internal/db"
	"smallNfast/internal/monitor"
	"smallNfast/internal/serial"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// App struct
type App struct {
	ctx      context.Context
	Monitor  *monitor.Service
	LogStore []string
	logMu    sync.Mutex
}

// NewApp creates a new App application struct
func NewApp(monitor *monitor.Service) *App {
	return &App{
		Monitor: monitor,
		LogStore: make([]string, 0),
	}
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
	
	// Keep last 1000 logs
	if len(a.LogStore) > 1000 {
		a.LogStore = a.LogStore[1:]
	}
	a.LogStore = append(a.LogStore, msg)
	
	// Emit event to frontend if context is ready
	// Note: In Wails v3, event emission might differ slightly, assuming standard Emit
	if a.ctx != nil {
		application.EmitAndReturn(a.ctx, "log", msg)
	}
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
	var recipients []db.SmsModel
	if err := db.DB.Find(&recipients).Error; err != nil {
		return nil, err
	}
	return recipients, nil
}

func (a *App) AddRecipient(name, number string) error {
	rec := db.SmsModel{
		PortName:  name, // Reusing column 'port_name' for Name/Description as per user implication or just putting port_name
		Recipient: number,
		Actived:   true,
	}
	return db.DB.Create(&rec).Error
}

func (a *App) DeleteRecipient(id int64) error {
	return db.DB.Delete(&db.SmsModel{}, id).Error
}

func (a *App) CheckPorts() []string {
	return serial.CheckAvailablePorts()
}

func (a *App) GetStatus() map[string]interface{} {
	if a.Monitor == nil {
		return map[string]interface{}{
			"running": false,
			"port":    "",
		}
	}
	return map[string]interface{}{
		"running": a.Monitor.IsRunning,
		"port":    a.Monitor.PortName,
	}
}

func (a *App) SetAutoStart(enable bool) error {
	if enable {
		return config.EnableAutoStart()
	}
	return config.DisableAutoStart()
}

func (a *App) GetAutoStart() bool {
	return config.IsAutoStartEnabled()
}
