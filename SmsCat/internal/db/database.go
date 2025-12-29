package db

import (
	"bufio"
	"database/sql"
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
	AlarmSettingID int64    `gorm:"primaryKey;column:alarm_setting_id"`
	ChannelID      int64    `gorm:"column:channel_id"`
	Status         *int     `gorm:"column:status"`
	Direction      *int     `gorm:"column:direction"`
	Threshold      *float64 `gorm:"column:threshold"`
	Hysteresis     *float64 `gorm:"column:hysteresis"`
	AlarmTime      *int64   `gorm:"column:alarm_time"`
	AlarmStatus    *int     `gorm:"column:alarm_status"`
	RelayID        *int64   `gorm:"column:relay_id"`
	Sms            *bool    `gorm:"column:sms"`
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
	// Close existing connection if active (re-connect scenario)
	if DB != nil {
		sqlDB, err := DB.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	}

	config, err := LoadConfig(path)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		config.Username, config.Password, config.Hostname, config.Port, config.Database)

	newDB, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}

	// Connection Pool Optimization
	sqlDB, err := newDB.DB()
	if err != nil {
		return fmt.Errorf("failed to get sql.DB: %w", err)
	}

	// SetMaxIdleConns sets the maximum number of connections in the idle connection pool.
	// Low traffic app: 2 idle connections is sufficient for the 3s pinger.
	sqlDB.SetMaxIdleConns(2)

	// SetMaxOpenConns sets the maximum number of open connections to the database.
	// Cap at 5 to minimize impact on the main system.
	sqlDB.SetMaxOpenConns(5)

	// SetConnMaxLifetime sets the maximum amount of time a connection may be reused.
	sqlDB.SetConnMaxLifetime(time.Hour)

	DB = newDB
	return nil
}

// AlarmDetailDTO holds the result of the complex join query for SMS details
type AlarmDetailDTO struct {
	CreatedDate         time.Time `gorm:"column:createddate"`
	AlarmStatus         int       `gorm:"column:alarm_status"`
	Threshold           float64   `gorm:"column:threshold"`
	Hysteresis          float64   `gorm:"column:hysteresis"`
	Direction           int       `gorm:"column:direction"`
	ChannelDescription  string    `gorm:"column:channel_description"`
	UnitIndex           int       `gorm:"column:unit_index"`
	UnitInAscii         string    `gorm:"column:unit_in_ascii"`
	MeasurementValue    float64   `gorm:"column:measurement_value"`
	Resolution          int       `gorm:"column:resolution"`
	SensorDescription   string    `gorm:"column:sensor_description"`
	LocationDescription string    `gorm:"column:location_description"`
}

// GetMaxCreatedDate returns the max createddate or NOW() if empty
func GetMaxCreatedDate() (time.Time, error) {
	var result sql.NullTime
	// SELECT MAX(createddate) FROM alarm_historys
	// Using sql.NullTime handles the NULL return (when table is empty) gracefully
	err := DB.Model(&AlarmHistorys{}).Select("MAX(createddate)").Scan(&result).Error
	if err != nil {
		return time.Now(), err
	}
	if !result.Valid {
		return time.Now(), nil
	}
	return result.Time, nil
}

// FetchActiveRecipients returns a list of phone numbers from active SmsRecord
// requirement: recipient format '18900001111&13311112222'
func FetchActiveRecipients() ([]string, error) {
	var recipients []string
	// Only fetch active recipients
	err := DB.Model(&SmsModel{}).Where("actived = ?", true).Pluck("recipient", &recipients).Error
	return recipients, err
}

// GetRecipients returns all recipients from the database
func GetRecipients() ([]SmsModel, error) {
	var recipients []SmsModel
	result := DB.Find(&recipients)
	return recipients, result.Error
}

// AddRecipient adds a new recipient to the database
func AddRecipient(sms SmsModel) error {
	return DB.Create(&sms).Error
}

// DeleteRecipient removes a recipient by ID
func DeleteRecipient(id int64) error {
	return DB.Delete(&SmsModel{}, id).Error
}

// RemoveRecipientByNumber removes a recipient by their phone number
// Used for cleanup of test numbers
func RemoveRecipientByNumber(number string) error {
	return DB.Where("recipient = ?", number).Delete(&SmsModel{}).Error
}
