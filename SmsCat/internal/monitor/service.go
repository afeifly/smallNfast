package monitor

import (
	"fmt"
	"log"
	"sync"
	"time"

	"smallNfast/internal/db"
	"smallNfast/internal/serial"
)

type Service struct {
	DB          *db.DBConfig // active config
	Modem       *serial.GSMModem
	stopChan    chan struct{}
	wg          sync.WaitGroup
	LogFunc     func(string) // Callback for logging to UI
	PortName    string
	IsRunning   bool
	mu          sync.Mutex
}

func NewService(logFunc func(string)) *Service {
	return &Service{
		stopChan: make(chan struct{}),
		LogFunc:  logFunc,
	}
}

func (s *Service) Start() {
	s.mu.Lock()
	if s.IsRunning {
		s.mu.Unlock()
		return
	}
	s.IsRunning = true
	s.stopChan = make(chan struct{})
	s.mu.Unlock()

	s.wg.Add(1)
	go s.loop()
	s.log("Alarm Monitor Started")
	
	// Auto-detect port if not set
	if s.PortName == "" {
		port, err := serial.FindModemPort()
		if err != nil {
			s.log(fmt.Sprintf("Auto-detection failed: %v", err))
		} else {
			s.log(fmt.Sprintf("Auto-detected Modem at %s", port))
			s.SetModemPort(port)
		}
	}
}

func (s *Service) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.IsRunning {
		return
	}
	close(s.stopChan)
	s.wg.Wait()
	s.IsRunning = false
	s.log("Alarm Monitor Stopped")
}

func (s *Service) SetModemPort(port string) {
	// If modem is changing, we might need to re-init
	s.PortName = port
	s.Modem = serial.NewGSMModem(port)
	s.log(fmt.Sprintf("Modem port set to %s", port))
}

func (s *Service) log(msg string) {
	if s.LogFunc != nil {
		s.LogFunc(msg)
	} else {
		log.Println(msg)
	}
}

func (s *Service) loop() {
	defer s.wg.Done()
	
	ticker := time.NewTicker(5 * time.Second) // Poll every 5 seconds
	defer ticker.Stop()

	// Keep track of the last processed ID to avoid re-sending old alarms
	// In a real app, we might store this in a file or DB, or just start from "now"
	// For this requirement, we'll check for "new" records. 
	// A simple strategy: Get max ID at start, then query > maxID.
	var lastProcessedID int64
	
	// Init lastProcessedID
	var lastRecord db.AlarmHistorys
	if err := db.DB.Order("alarm_historys_id desc").First(&lastRecord).Error; err == nil {
		lastProcessedID = lastRecord.AlarmHistorysID
	}
	s.log(fmt.Sprintf("Starting monitoring from Alarm History ID: %d", lastProcessedID))

	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			s.checkAlarms(&lastProcessedID)
		}
	}
}

func (s *Service) checkAlarms(lastID *int64) {
	var newAlarms []db.AlarmHistorys
	// Fetch records strictly greater than lastID
	if err := db.DB.Where("alarm_historys_id > ?", *lastID).Order("alarm_historys_id asc").Find(&newAlarms).Error; err != nil {
		s.log(fmt.Sprintf("Error fetching alarms: %v", err))
		return
	}

	for _, alarm := range newAlarms {
		*lastID = alarm.AlarmHistorysID // Update cursor immediately
		
		// logic: check if alarm_setting is enable sms
		var setting db.AlarmSettings
		if err := db.DB.First(&setting, alarm.AlarmSettingID).Error; err != nil {
			s.log(fmt.Sprintf("Alarm %d found but setting %d missing", alarm.AlarmHistorysID, alarm.AlarmSettingID))
			continue
		}

		// check SMS enabled
		if setting.Sms != nil && *setting.Sms {
			s.handleSmsTrigger(alarm, setting)
		} else {
			s.log(fmt.Sprintf("Alarm %d ignored (SMS disabled in settings)", alarm.AlarmHistorysID))
		}
	}
}

func (s *Service) handleSmsTrigger(alarm db.AlarmHistorys, setting db.AlarmSettings) {
	// 1. Fetch Recipients
	recipients, err := db.FetchActiveRecipients()
	if err != nil {
		s.log(fmt.Sprintf("Failed to fetch recipients: %v", err))
		return
	}
	
	if len(recipients) == 0 {
		s.log("Alarm triggered but no active recipients found.")
		return
	}

	// 2. Compose Message
	msg := fmt.Sprintf("ALARM! ID:%d Time:%d Status:%d Val:%v", 
		alarm.AlarmHistorysID, alarm.AlarmTime, alarm.AlarmStatus, setting.Threshold)

	// 3. Send
	s.log(fmt.Sprintf("Sending SMS for Alarm %d to %d recipients...", alarm.AlarmHistorysID, len(recipients)))
	
	if s.Modem == nil {
		s.log("Error: No modem configured/initialized")
		return
	}

	for _, number := range recipients {
		// In a real scenario, we might retry or queue them
		err := s.Modem.SendSMS(number, msg)
		if err != nil {
			s.log(fmt.Sprintf("Failed to send to %s: %v", number, err))
		} else {
			s.log(fmt.Sprintf("Sent to %s", number))
		}
	}
}
