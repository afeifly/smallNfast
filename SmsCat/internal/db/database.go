package db

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

var DB *gorm.DB

type DBConfig struct {
	Hostname string
	Port     string
	Database string
	Username string
	Password string
}

// Models based on requirement.md

type SmsModel struct {
	SmsID     int64  `gorm:"primaryKey;column:sms_id"`
	PortName  string `gorm:"column:port_name"`
	Recipient string `gorm:"column:recipient"`
	Actived   bool   `gorm:"column:actived"`
}

func (SmsModel) TableName() string {
	return "smsmodel"
}

type AlarmSettings struct {
	AlarmSettingID int64   `gorm:"primaryKey;column:alarm_setting_id"`
	ChannelID      int64   `gorm:"column:channel_id"`
	Status         *int    `gorm:"column:status"`
	Direction      *int    `gorm:"column:direction"`
	Threshold      *float64 `gorm:"column:threshold"`
	Hysteresis     *float64 `gorm:"column:hysteresis"`
	AlarmTime      *int64  `gorm:"column:alarm_time"`
	AlarmStatus    *int    `gorm:"column:alarm_status"`
	RelayID        *int64  `gorm:"column:relay_id"`
	Sms            *bool   `gorm:"column:sms"`
}

func (AlarmSettings) TableName() string {
	return "alarm_settings"
}

type AlarmHistorys struct {
	AlarmHistorysID int64 `gorm:"primaryKey;column:alarm_historys_id"`
	AlarmSettingID  int64 `gorm:"column:alarm_setting_id"`
	AlarmTime       int64 `gorm:"column:alarm_time"`
	AlarmStatus     int   `gorm:"column:alarm_status"`
}

func (AlarmHistorys) TableName() string {
	return "alarm_historys"
}

func LoadConfig(path string) (*DBConfig, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	config := &DBConfig{}
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])

		switch key {
		case "hostname":
			config.Hostname = val
		case "port":
			config.Port = val
		case "database":
			config.Database = val
		case "username":
			config.Username = val
		case "password":
			config.Password = val
		}
	}
	return config, scanner.Err()
}

func Connect(path string) error {
	config, err := LoadConfig(path)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		config.Username, config.Password, config.Hostname, config.Port, config.Database)

	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}
	
	return nil
}

// FetchActiveRecipients returns a list of phone numbers from active SmsRecord
// requirement: recipient format '18900001111&13311112222'
func FetchActiveRecipients() ([]string, error) {
	var records []SmsModel
	if err := DB.Where("actived = ?", 1).Find(&records).Error; err != nil {
		return nil, err
	}

	var phones []string
	for _, r := range records {
		if r.Recipient != "" {
			parts := strings.Split(r.Recipient, "&")
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if p != "" {
					phones = append(phones, p)
				}
			}
		}
	}
	// unique
	seen := make(map[string]bool)
	var uniq []string
	for _, p := range phones {
		if !seen[p] {
			seen[p] = true
			uniq = append(uniq, p)
		}
	}
	return uniq, nil
}
