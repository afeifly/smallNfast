package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// FileLogger handles daily log file rotation
type FileLogger struct {
	logDir      string
	currentDate string
	currentFile *os.File
	mu          sync.Mutex
}

var globalFileLogger *FileLogger
var globalFileLoggerMu sync.Mutex

// InitFileLogger initializes the global file logger
func InitFileLogger(logDir string) error {
	globalFileLoggerMu.Lock()
	defer globalFileLoggerMu.Unlock()

	// Create logs directory if it doesn't exist
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return fmt.Errorf("failed to create logs directory: %w", err)
	}

	fl := &FileLogger{
		logDir: logDir,
	}
	globalFileLogger = fl
	return nil
}

// Write writes a log message to the current day's log file
func Write(msg string) {
	globalFileLoggerMu.Lock()
	fl := globalFileLogger
	globalFileLoggerMu.Unlock()

	if fl == nil {
		return // Logger not initialized
	}

	fl.mu.Lock()
	defer fl.mu.Unlock()

	// Get current date
	today := time.Now().Format("2006-01-02")

	// Rotate file if date changed
	if fl.currentDate != today {
		if fl.currentFile != nil {
			fl.currentFile.Close()
			fl.currentFile = nil
		}
		fl.currentDate = today
	}

	// Open file if not open
	if fl.currentFile == nil {
		logFileName := filepath.Join(fl.logDir, today+".log")
		file, err := os.OpenFile(logFileName, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			// Silently fail - don't break the app if logging fails
			return
		}
		fl.currentFile = file
	}

	// Write log with timestamp
	timestamp := time.Now().Format("2006-01-02 15:04:05")
	logLine := fmt.Sprintf("[%s] %s\n", timestamp, msg)
	fl.currentFile.WriteString(logLine)
	fl.currentFile.Sync() // Ensure it's written to disk
}

// Close closes the current log file
func Close() {
	globalFileLoggerMu.Lock()
	fl := globalFileLogger
	globalFileLoggerMu.Unlock()

	if fl == nil {
		return
	}

	fl.mu.Lock()
	defer fl.mu.Unlock()

	if fl.currentFile != nil {
		fl.currentFile.Close()
		fl.currentFile = nil
	}
}

