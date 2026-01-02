package monitor

import (
	"fmt"
	"log"
	"sync"
	"time"

	"smallNfast/internal/db"
	"smallNfast/internal/logger"
	"smallNfast/internal/serial"
)

// SmsTask represents a queued SMS to be sent
type SmsTask struct {
	Recipient string
	Message   string
}

type Service struct {
	DB       *db.DBConfig // active config
	Modem    *serial.GSMModem
	stopChan chan struct{}
	wg       sync.WaitGroup
	LogFunc  func(string) // Callback for logging to UI
	PortName string
	State    string // "stopped", "initializing", "running", "error"
	mu       sync.Mutex
	smsQueue chan SmsTask
	Language string
}

func NewService(logFunc func(string)) *Service {
	return &Service{
		stopChan: make(chan struct{}),
		LogFunc:  logFunc,
		smsQueue: make(chan SmsTask, 100), // Buffer of 100 SMS
		Language: "en",
		State:    "stopped",
	}
}

func (s *Service) Start() {
	s.mu.Lock()
	if s.State == "running" || s.State == "initializing" {
		s.mu.Unlock()
		return
	}
	s.State = "initializing"
	s.stopChan = make(chan struct{})
	s.mu.Unlock()

	s.wg.Add(1)
	go s.loop()

	s.wg.Add(1)
	go s.processSmsQueue() // Start SMS worker

	s.log("Alarm Monitor Started", false)

	// Auto-detect port if not set (in background to avoid blocking)
	go func() {
		if s.PortName == "" {
			port, err := serial.FindModemPort()
			if err != nil {
				s.log(fmt.Sprintf("Auto-detection failed: %v", err), false)
				s.mu.Lock()
				s.State = "error" // Failed to detect
				s.mu.Unlock()
			} else {
				s.log(fmt.Sprintf("Auto-detected Modem at %s", port), false)
				s.SetModemPort(port)
				// SetModemPort will set state to running if success
			}
		} else {
			// Port already set manually or previous config
			s.mu.Lock()
			s.State = "running"
			s.mu.Unlock()
		}
	}()
}

func (s *Service) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.State == "stopped" {
		return
	}
	close(s.stopChan)
	s.wg.Wait()
	s.State = "stopped"
	s.log("Alarm Monitor Stopped", false)
}

func (s *Service) SetModemPort(port string) {
	// If modem is changing, we might need to re-init
	if s.Modem != nil {
		s.Modem.Close()
	}
	s.PortName = port
	s.Modem = serial.NewGSMModem(port, s.log)
	s.log(fmt.Sprintf("Modem port set to %s", port), false)

	// Update state to running if we were initializing
	s.mu.Lock()
	if s.State == "initializing" || s.State == "error" {
		s.State = "running"
	}
	s.mu.Unlock()
}

func (s *Service) SetLanguage(lang string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Language = lang
	s.log(fmt.Sprintf("Language set to %s", lang), false)
}

func (s *Service) log(msg string, verbose bool) {
	if verbose {
		// Verbose logs only go to File Logger, NOT UI
		logger.Write(msg)
	} else {
		// Non-verbose logs go to UI (which implies File Logger too usually via App.AddLog)
		if s.LogFunc != nil {
			s.LogFunc(msg)
		} else {
			log.Println(msg)
		}
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
		s.log(fmt.Sprintf("Error getting start time: %v, using NOW", err), false)
		lastCheckedTime = time.Now()
	} else {
		lastCheckedTime = startT
		s.log(fmt.Sprintf("Starting monitoring from Created Date: %v", lastCheckedTime), false)
	}

	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			s.checkDetailedAlarms(&lastCheckedTime)
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
			c.measurement_value, c.resolution,
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
		s.log(fmt.Sprintf("Error checking detailed alarms: %v", err), false)
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
		s.log(fmt.Sprintf("Failed to fetch recipients: %v", err), false)
		return
	}

	if len(recipients) == 0 {
		s.log("Alarm triggered but no active recipients found.", false)
		return
	}

	// 2. Prepare Data
	s.mu.Lock()
	lang := s.Language
	s.mu.Unlock()

	// Format Value based on resolution
	valStr := s.formatValue(details.MeasurementValue, details.Resolution)

	var msg string
	if lang == "cn" {
		// Chinese Template
		statusStr := "报警触发"
		if details.AlarmStatus == 0 {
			statusStr = "报警恢复"
		}

		dirStr := "下降"
		if details.Direction == 0 {
			dirStr = "上升"
		} else if details.Direction != 1 {
			dirStr = fmt.Sprintf("%d", details.Direction)
		}

		msg = fmt.Sprintf(
			"%s!\n"+
				"时间: %s\n"+
				"位置: %s\n"+
				"传感器: %s\n"+
				"通道: %s\n"+
				"单位: %s\n"+
				"阈值: %s\n"+ // Format threshold same as value? User didn't specify, assumes default or same resolution? Let's use flexible %v for now or apply same res logic if needed. User only said 'if resolution is 1... value should be like 23.8'.
				"回差: %v\n"+
				"方向: %s\n"+
				"当前值: %s",
			statusStr,
			details.CreatedDate.Format("2006-01-02 15:04:05"),
			details.LocationDescription,
			details.SensorDescription,
			details.ChannelDescription,
			details.UnitInAscii,
			s.formatValue(details.Threshold, details.Resolution), // Apply formatting to threshold too for consistency
			details.Hysteresis,
			dirStr,
			valStr,
		)
	} else {
		// English Template (Default)
		statusStr := "Alarm triggered"
		if details.AlarmStatus == 0 {
			statusStr = "Alarm resumed"
		}

		dirStr := "Down"
		if details.Direction == 0 {
			dirStr = "Up"
		} else if details.Direction != 1 {
			dirStr = fmt.Sprintf("%d", details.Direction)
		}

		msg = fmt.Sprintf(
			"%s!\n"+
				"Time: %s\n"+
				"Location: %s\n"+
				"Sensor: %s\n"+
				"Channel: %s\n"+
				"Unit: %s\n"+
				"Threshold: %s\n"+
				"Hysteresis: %v\n"+
				"Direction: %s\n"+
				"Current value: %s",
			statusStr,
			details.CreatedDate.Format("2006-01-02 15:04:05"),
			details.LocationDescription,
			details.SensorDescription,
			details.ChannelDescription,
			details.UnitInAscii,
			s.formatValue(details.Threshold, details.Resolution),
			details.Hysteresis,
			dirStr,
			valStr,
		)
	}

	// 3. Queue Send
	s.log(fmt.Sprintf("Queueing SMS for %d recipients...", len(recipients)), false)

	for _, number := range recipients {
		select {
		case s.smsQueue <- SmsTask{Recipient: number, Message: msg}:
		default:
			s.log("Error: SMS Queue Full! Dropping message.", false)
		}
	}
}

func (s *Service) formatValue(val float64, res int) string {
	switch res {
	case 0:
		return fmt.Sprintf("%.0f", val)
	case 1:
		return fmt.Sprintf("%.1f", val)
	case 2:
		return fmt.Sprintf("%.2f", val)
	case 3:
		return fmt.Sprintf("%.3f", val)
	case 4:
		return fmt.Sprintf("%.4f", val)
	default:
		// Default to 2 decimal places if unknown
		return fmt.Sprintf("%.2f", val)
	}
}

func (s *Service) processSmsQueue() {
	defer s.wg.Done()
	s.log("SMS Queue Worker Started", false)

	for {
		select {
		case <-s.stopChan:
			s.log("SMS Queue Worker Stopped", false)
			return

		case task := <-s.smsQueue:
			if s.Modem == nil {
				s.log("Error: No modem configured, skipping queued SMS", false)
				continue
			}

			s.log(fmt.Sprintf("Processing SMS for %s...", task.Recipient), false)
			err := s.Modem.SendSMS(task.Recipient, task.Message)
			if err != nil {
				s.log(fmt.Sprintf("Failed to send to %s: %v", task.Recipient, err), false)
			} else {
				s.log(fmt.Sprintf("Sent to %s", task.Recipient), false)
			}

			// Optional: Small delay between messages to be polite to the modem/network
			time.Sleep(2 * time.Second)
		}
	}
}
