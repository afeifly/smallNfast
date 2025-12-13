package main

import (
	"smallNfast/internal/app"

	"github.com/getlantern/systray"
)

// Global reference to app for tray callbacks
var trayApp *app.App

func onReady() {
	systray.SetIcon(iconBytes)
	systray.SetTitle("SMSCat")
	systray.SetTooltip("SMSCat Monitor for S4M")

	mTitle := systray.AddMenuItem("SMSCat Monitor", "Application Name")
	mTitle.Disable() // Just a label

	systray.AddSeparator()

	mShow := systray.AddMenuItem("Show Window", "Show the main window")
	mHide := systray.AddMenuItem("Hide Window", "Hide the main window")
	
	systray.AddSeparator()
	
	mExit := systray.AddMenuItem("Exit", "Quit the application")

	go func() {
		for {
			select {
			case <-mShow.ClickedCh:
				if trayApp != nil {
					trayApp.Show()
				}
			case <-mHide.ClickedCh:
				if trayApp != nil {
					trayApp.Hide()
				}
			case <-mExit.ClickedCh:
				if trayApp != nil {
					trayApp.ExitApp()
				} else {
					systray.Quit()
				}
			}
		}
	}()
}

func onExit() {
	// clean up if needed
}
