# smallNfast

This repository contains two small, fast utility projects for specialized hardware interactions.

## Projects

### 1. jsutousbIo (Java)

A **gRPC Server** that wraps native USB I/O functionality.

*   **Technology**: Java, Maven, gRPC, Protobuf.
*   **Purpose**: It exposes a USB device interface (specifically using the Thesycon `UsbIoJava` driver) over a gRPC network service. This allows other applications (even those not running on the JVM) to communicate with USB devices by sending gRPC requests.
*   **Key Components**:
    *   `src/main/proto/usb_service.proto`: Defines the gRPC service and messages.
    *   `lib/UsbIoJava.jar`: Local library interfacing with the USB driver.
    *   `pom.xml`: Maven build configuration (generates protobuf code and builds a shaded JAR).

**Build**:
```bash
cd jsutousbIo
mvn clean package
```

### 2. SMSCat (Go)

A **Windows Desktop Application** for automated SMS alerts.

*   **Technology**: Go (Golang), Wails (for GUI), MySQL.
*   **Purpose**: It monitors a MySQL database for alarm trigger records and automatically sends SMS alerts via a connected Quectel GSM Modem.
*   **Features**:
    *   **Auto-Detection**: Automatically finds Quectel Modems in the Windows Registry.
    *   **Background Service**: Polls the database for pending alarms.
    *   **System Tray**: Runs unobtrusively in the system tray.
    *   **Web UI**: A Wails-based frontend to view logs and configuration.
*   **Requirements**: MySQL database, Quectel USB Modem.

**Build (Windows)**:
```bash
cd SmsCat
# Build via script
build.bat
# Or using Go directly
go build -tags desktop,production -ldflags "-s -w -H windowsgui" -o SMSCat.exe
```

See [SmsCat/README.md](SmsCat/README.md) for detailed installation and database setup instructions.
