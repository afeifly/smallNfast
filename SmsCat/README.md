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

### 1. Windows Build (on Windows)
Run the `build.bat` script. It will prompt you to choose the build mode:
- **Standard Build**: Small executable, requires WebView2 Runtime installed on the target machine (Windows 10/11 default).
- **Windows 7 Build**: Embeds a fixed version of WebView2 Runtime into the executable for standalone deployment on Windows 7.

```cmd
build.bat
```

### 2. Cross-Compile for Windows (on macOS/Linux)
Run the `build_windows_on_mac.sh` script:

**Standard Build:**
```bash
./build_windows_on_mac.sh
```

**Windows 7 Build (Embedded Runtime):**
```bash
./build_windows_on_mac.sh win7
```

### 3. macOS Build (for testing on Mac)
```bash
./build_macos.sh
```

---

## Windows 7 Support & WebView2 Embedding

To support Windows 7, you **MUST** embed a specific "Fixed Version" of the WebView2 Runtime, because:
1.  Windows 7 does not have WebView2 installed by default.
2.  Modern WebView2 versions (110+) do **NOT** support Windows 7.

**Steps to prepare for Windows 7 Build:**

1.  **Download the Runtime**:
    You need the **Fixed Version Runtime x64** for version **109.0.1518.78**. This is the last version supporting Windows 7.
    - Official Source: [Microsoft Edge WebView2 Download](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section) (Select "Fixed Version", Version "109.0.1518.78", Architecture "x64").
    - Archive Mirror: [WebView2RuntimeArchive (109.0.1518.78)](https://github.com/westinyang/WebView2RuntimeArchive/releases/tag/109.0.1518.78)

2.  **Prepare the Zip**:
    - Extract the downloaded file. you should see a folder named `Microsoft.WebView2.FixedVersionRuntime.109.0.1518.78.x64` or similar.
    - **Zip the contents** of this folder (or the folder itself) into a file named `WebView2.zip`.
    - Ensure the zip structure is flat or has the version folder at the root. The app will search for `msedgewebview2.exe` inside.

3.  **Place the File**:
    Put the `WebView2.zip` file in:
    `internal/webview_runtime/WebView2.zip`

4.  **Build**:
    Run `build.bat` (select Y) or `./build_windows_on_mac.sh win7`.

## Troubleshooting

- **"Auto-detection failed"**: Ensure drivers for Quectel USB Modem are installed and the device is plugged in.
- **Database errors**: Check `database.properties` and firewall settings.
- **Windows 7 Crashes**:
    - Ensure you are using WebView2 Runtime **v109.x**. Newer versions will crash.
    - Ensure `KB2533623` or newer updates are installed on Windows 7.
    - The app is configured with `--disable-gpu` and `--no-sandbox` for maximum compatibility on older hardware.
