package monitor

import (
	"fmt"
	"log"
	"sync"
	"time"

	"smallNfast/internal/db"
	"smallNfast/internal/serial"
)

// SmsTask represents a queued SMS to be sent
type SmsTask struct {
	Recipient string
	Message   string
}

type Service struct {
	DB        *db.DBConfig // active config
	Modem     *serial.GSMModem
	stopChan  chan struct{}
	wg        sync.WaitGroup
	LogFunc   func(string) // Callback for logging to UI
	PortName  string
	IsRunning bool
	mu        sync.Mutex
	smsQueue  chan SmsTask
}

func NewService(logFunc func(string)) *Service {
	return &Service{
		stopChan: make(chan struct{}),
		LogFunc:  logFunc,
		smsQueue: make(chan SmsTask, 100), // Buffer of 100 SMS
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

	s.wg.Add(1)
	go s.processSmsQueue() // Start SMS worker

	s.log("Alarm Monitor Started")

	// Auto-detect port if not set (in background to avoid blocking)
	go func() {
		if s.PortName == "" {
			port, err := serial.FindModemPort()
			if err != nil {
				s.log(fmt.Sprintf("Auto-detection failed: %v", err))
			} else {
				s.log(fmt.Sprintf("Auto-detected Modem at %s", port))
				s.SetModemPort(port)
			}
		}
	}()
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
	if s.Modem != nil {
		s.Modem.Close()
	}
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

	ticker := time.NewTicker(3 * time.Second) // Poll every 3 seconds
	defer ticker.Stop()

	// Initialize tracking time
	var lastCheckedTime time.Time
	startT, err := db.GetMaxCreatedDate()
	if err != nil {
		s.log(fmt.Sprintf("Error getting start time: %v, using NOW", err))
		lastCheckedTime = time.Now()
	} else {
		lastCheckedTime = startT
		s.log(fmt.Sprintf("Starting monitoring from Created Date: %v", lastCheckedTime))
	}

	heartbeatCount := 0

	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			s.checkDetailedAlarms(&lastCheckedTime)

			// Heartbeat every 10 ticks (30 seconds)
			heartbeatCount++
			if heartbeatCount >= 10 {
				s.log("Monitor Heartbeat: Running detailed scan...")
				heartbeatCount = 0
			}
		}
	}
}

func (s *Service) checkDetailedAlarms(lastTime *time.Time) {
	var results []db.AlarmDetailDTO

	// Complex query as requested
	// SELECT ... FROM ... WHERE ah.createddate > ? AND as_tab.sms = 1
	// ALIAS 'description' -> '..._description' to match DTO
	query := `
		SELECT
			ah.createddate,
			ah.alarm_status,
			as_tab.threshold, as_tab.hysteresis, as_tab.direction,
			c.channel_description, c.unit_index, c.unit_in_ascii,
			c.measurement_value,
			s.description AS sensor_description,
			l.description AS location_description
		FROM alarm_historys ah
		JOIN alarm_settings as_tab ON ah.alarm_setting_id = as_tab.alarm_setting_id
		JOIN channels c ON as_tab.channel_id = c.channel_id
		JOIN sensors s ON c.logic_sensor_id = s.sensor_id
		JOIN locations l ON s.location_id = l.location_id
		WHERE ah.createddate > ? AND as_tab.sms = 1
		ORDER BY ah.createddate ASC
	`

	if err := db.DB.Raw(query, *lastTime).Scan(&results).Error; err != nil {
		s.log(fmt.Sprintf("Error checking detailed alarms: %v", err))
		return
	}

	for _, r := range results {
		// Update cursor
		if r.CreatedDate.After(*lastTime) {
			*lastTime = r.CreatedDate
		}

		s.handleDetailedSms(r)
	}
}

func (s *Service) handleDetailedSms(details db.AlarmDetailDTO) {
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

	// 2. Compose Message per requirements
	// Direction: [Up or Down]
	dirStr := "Down"
	if details.Direction == 1 {
		dirStr = "Up"
	} else if details.Direction != 0 {
		// Just in case it's something else
		dirStr = fmt.Sprintf("%d", details.Direction)
	}

	msg := fmt.Sprintf(
		"Alarm triggered!\n"+
			"Time: %s\n"+
			"Location: %s\n"+
			"Sensor: %s\n"+
			"Channel: %s\n"+
			"Unit: %s\n"+
			"Threshold: %v\n"+
			"Hysteresis: %v\n"+
			"Direction: %s\n"+
			"Current_value: %v",
		details.CreatedDate.Format("2006-01-02 15:04:05"),
		details.LocationDescription,
		details.SensorDescription,
		details.ChannelDescription,
		details.UnitInAscii,
		details.Threshold,
		details.Hysteresis,
		dirStr,
		details.MeasurementValue,
	)

	// 3. Queue Send
	s.log(fmt.Sprintf("Queueing SMS for %d recipients...", len(recipients)))

	for _, number := range recipients {
		// Non-blocking send or drop if full (though buffer 100 is large)
		select {
		case s.smsQueue <- SmsTask{Recipient: number, Message: msg}:
		default:
			s.log("Error: SMS Queue Full! Dropping message.")
		}
	}
}

func (s *Service) processSmsQueue() {
	defer s.wg.Done()
	s.log("SMS Queue Worker Started")

	for {
		select {
		case <-s.stopChan:
			s.log("SMS Queue Worker Stopped")
			return

		case task := <-s.smsQueue:
			if s.Modem == nil {
				s.log("Error: No modem configured, skipping queued SMS")
				continue
			}

			s.log(fmt.Sprintf("Processing SMS for %s...", task.Recipient))
			err := s.Modem.SendSMS(task.Recipient, task.Message)
			if err != nil {
				s.log(fmt.Sprintf("Failed to send to %s: %v", task.Recipient, err))
			} else {
				s.log(fmt.Sprintf("Sent to %s", task.Recipient))
			}

			// Optional: Small delay between messages to be polite to the modem/network
			time.Sleep(2 * time.Second)
		}
	}
}
