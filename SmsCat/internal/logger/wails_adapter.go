package logger

import "github.com/wailsapp/wails/v2/pkg/logger"

// WailsLoggerAdapter satisfies the Wails Logger interface and writes to our filelogger.
type WailsLoggerAdapter struct{}

func NewWailsLoggerAdapter() logger.Logger {
	return &WailsLoggerAdapter{}
}

func (l *WailsLoggerAdapter) Print(message string) {
	Write("WAILS INFO: " + message)
}

func (l *WailsLoggerAdapter) Trace(message string) {
	Write("WAILS TRACE: " + message)
}

func (l *WailsLoggerAdapter) Debug(message string) {
	Write("WAILS DEBUG: " + message)
}

func (l *WailsLoggerAdapter) Info(message string) {
	Write("WAILS INFO: " + message)
}

func (l *WailsLoggerAdapter) Warning(message string) {
	Write("WAILS WARN: " + message)
}

func (l *WailsLoggerAdapter) Error(message string) {
	Write("WAILS ERROR: " + message)
}

func (l *WailsLoggerAdapter) Fatal(message string) {
	Write("WAILS FATAL: " + message)
}
