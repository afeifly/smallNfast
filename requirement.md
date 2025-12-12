## Requirement
I want create a new Go project in current folder. 
There was an old project in J2EE,a monitor system for sensor data,
now I want my app can control GSM/SMS modem (AT commands) to send SMS to user when there is an alarm.
The app will run on Windows. 

It need to have the following features: 
- Control GSM/SMS modem (AT commands)
- Windows tray icon (background running)
- MySQL database queries (poll alarms → send SMS)
- Logging window (status + runtime logs)
- Auto-start with Windows
- Single EXE file, stable, lightweight

## Go Tech Stack 
- Tray Icon
github.com/getlantern/systray
Most stable tray library on Windows
Used by commercial apps (Lantern/VPN tools)

- Serial Port & AT Commands
github.com/tarm/serial
Perfect for GSM modems
Simple send/receive operations
Supports port scanning

- UI Window for Logs & Status
Wails v3
HTML/CSS/JS frontend
Native Windows EXE
Lightweight compared to Electron
Great for showing logs & device status

- MySQL Database
Two options:
gorm.io/gorm + gorm.io/driver/mysql (ORM, easier)
github.com/go-sql-driver/mysql (faster, lightweight)

- Windows Auto-Start
golang.org/x/sys/windows/registry
write to 'HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run'

- Logging
Recommend:
zap (Uber’s high-performance logger)
Or logrus
Logs can go to:
File (logs/app.log)
UI window (via Wails events)

- Single EXE Build
go build -ldflags "-s -w" -o SmsCat.exe

## Old project structure
a database.properties config file in the exe's folder.
it has the config of database

```properties
hostname=127.0.0.1
port=3306
database=csm
username=root
password=csm2g
```

use it to access my database

the sms config table will like 
```sql
CREATE TABLE `smsmodel` (
`sms_id` BIGINT(20) NOT NULL AUTO_INCREMENT,
`port_name` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8_bin',
`recipient` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8_bin',
`actived` TINYINT(1) NULL DEFAULT '0',
 -- ... ignore more columns 
PRIMARY KEY (`sms_id`)
)
```

we will only focus port_name and recipient
but maybe let GO code to check avaiable ports (if it's possiable, maybe need to know hardware ID), then it will no need input or select by user.

try use that recipient to save the phone number for people we want to send the sms, keep like '18900001111&13311112222&13100001111' 
I want our UI can manager that, add more recipients and can remove. 

Now the alarm setting relative

```sql
CREATE TABLE `alarm_settings` (
`alarm_setting_id` BIGINT(20) NOT NULL AUTO_INCREMENT,
`channel_id` BIGINT(20) NOT NULL,
`status` INT(11) NULL DEFAULT NULL,
`direction` INT(11) NULL DEFAULT NULL,
`threshold` DOUBLE NULL DEFAULT NULL,
`hysteresis` DOUBLE NULL DEFAULT NULL,
`alarm_time` BIGINT(20) NULL DEFAULT NULL,
`alarm_status` INT(11) NULL DEFAULT NULL,
`relay_id` BIGINT(20) NULL DEFAULT NULL,
`sms` TINYINT(1) NULL DEFAULT NULL,
 -- ... ignore more columns 
PRIMARY KEY (`alarm_setting_id`),
)
```

```sql
CREATE TABLE `alarm_historys` (
`alarm_historys_id` BIGINT(20) NOT NULL AUTO_INCREMENT,
`alarm_setting_id` BIGINT(20) NULL DEFAULT NULL,
`alarm_time` BIGINT(20) NULL DEFAULT NULL,
`alarm_status` INT(11) NULL DEFAULT NULL,
 -- ... ignore more columns 
PRIMARY KEY (`alarm_historys_id`),
)
```

if a new alarm history record coming ,check if alarm_setting is enable sms.
if it's enable, try send SMS to all recipients (fetch all recipients again, encase it's changed) 

in App UI, we will log the runtime information (send an alarm message to Somebody)
and show the runtime logs


