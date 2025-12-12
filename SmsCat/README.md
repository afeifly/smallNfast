# SMSCat

SMSCat is a Windows application written in **Go (Golang)** using **Wails** for the GUI. It monitors a MySQL database for alarm trigger records and sends SMS alerts via a connected GSM Modem (specifically Quectel modems).

## Features
- **GSM Control**: Sends SMS using AT commands.
- **Auto-Detection**: Automatically finds Quectel Modems (`VID_2C7C&PID_6002`) in the Windows Registry to determine the COM port.
- **Background Service**: polls the database for new alarms.
- **System Tray**: Runs in the background with a system tray icon.
- **Auto-Start**: Configurable option to start automatically with Windows.
- **Modern UI**: Web-based UI (HTML/JS) for viewing logs and managing recipients.

## Prerequisites
1.  **Go 1.21+**: [Download Go](https://go.dev/dl/)
2.  **GCC Compiler**: Required for CGO. Install [TDM-GCC](https://jmeubank.github.io/tdm-gcc/) or MinGW.
3.  **MySQL Database**: A running MySQL instance.

## Installation & Setup

1.  **Clone/Open** this repository.
2.  **Install Dependencies**:
    ```bash
    go mod tidy
    ```

3.  **Database Setup**:
    Execute the following SQL script to create the required tables:

    ```sql
    CREATE DATABASE IF NOT EXISTS csm;
    USE csm;

    CREATE TABLE IF NOT EXISTS `smsmodel` (
      `sms_id` BIGINT(20) NOT NULL AUTO_INCREMENT,
      `port_name` VARCHAR(255) NULL COMMENT 'Name/Description',
      `recipient` VARCHAR(255) NULL COMMENT 'Phone Numbers separated by &',
      `actived` TINYINT(1) NULL DEFAULT '0',
      PRIMARY KEY (`sms_id`)
    );

    CREATE TABLE IF NOT EXISTS `alarm_settings` (
      `alarm_setting_id` BIGINT(20) NOT NULL AUTO_INCREMENT,
      `channel_id` BIGINT(20) NOT NULL,
      `status` INT(11) NULL,
      `direction` INT(11) NULL,
      `threshold` DOUBLE NULL,
      `hysteresis` DOUBLE NULL,
      `alarm_time` BIGINT(20) NULL,
      `alarm_status` INT(11) NULL,
      `relay_id` BIGINT(20) NULL,
      `sms` TINYINT(1) NULL,
      PRIMARY KEY (`alarm_setting_id`)
    );

    CREATE TABLE IF NOT EXISTS `alarm_historys` (
      `alarm_historys_id` BIGINT(20) NOT NULL AUTO_INCREMENT,
      `alarm_setting_id` BIGINT(20) NULL,
      `alarm_time` BIGINT(20) NULL,
      `alarm_status` INT(11) NULL,
      PRIMARY KEY (`alarm_historys_id`)
    );
    ```

4.  **Configuration**:
    Ensure a `database.properties` file exists next to the EXE with your DB credentials:
    ```properties
    hostname=127.0.0.1
    port=3306
    database=csm
    username=root
    password=csm2g
    ```

## Building

### Quick Build (without icon)

To build the executable for Windows:

```bash
go build -tags desktop,production -ldflags "-s -w -H windowsgui" -o SMSCat.exe
```

### Build with Icon

To build with a custom exe icon:

1. **Use the build script** (recommended):
   ```bash
   build.bat
   ```

2. **Or manually:**
   - Install rsrc: `go install github.com/akavel/rsrc@latest`
   - Convert PNG to ICO (if needed): Use ImageMagick or online converter
   - Generate resource: `rsrc -ico SMSLogo.ico -o resource.syso`
   - Build: `go build -tags desktop,production -ldflags "-s -w -H windowsgui" -o SMSCat.exe`

*Note: Ensure the `frontend/` directory exists when building, as assets are embedded.*

## Running

1.  Run `SMSCat.exe`.
2.  The app will attempt to **auto-detect** the modem port.
3.  If successful, it starts monitoring.
4.  Open the UI via the System Tray icon or it will open on launch.
5.  Use the "Auto-Start" checkbox in the UI to toggle starting with Windows.

## Troubleshooting

- **"Auto-detection failed"**: Ensure drivers for Quectel USB Modem are installed and the device is plugged in.
- **Database errors**: Check `database.properties` and firewall settings.
