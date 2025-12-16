package serial

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/tarm/serial"
	"golang.org/x/sys/windows/registry"
)

const (
	QuectelVIDPID = "VID_2C7C&PID_6002"
)

type GSMModem struct {
	PortName string
	BaudRate int
	port     *serial.Port
	mu       sync.Mutex
	LogFunc  func(string)
}

func NewGSMModem(port string, logFunc func(string)) *GSMModem {
	return &GSMModem{
		PortName: port,
		BaudRate: 115200,
		LogFunc:  logFunc,
	}
}

func (g *GSMModem) log(msg string) {
	if g.LogFunc != nil {
		g.LogFunc(msg)
	} else {
		log.Println(msg)
	}
}

// Connect opens the serial port and initializes the modem
func (g *GSMModem) Connect() error {
	// If already open, do nothing
	if g.port != nil {
		return nil
	}

	g.log(fmt.Sprintf("Connecting to port %s...", g.PortName))
	c := &serial.Config{Name: g.PortName, Baud: g.BaudRate, ReadTimeout: time.Second * 3}
	s, err := serial.OpenPort(c)
	if err != nil {
		g.log(fmt.Sprintf("Failed to open port: %v", err))
		return fmt.Errorf("failed to open port %s: %w", g.PortName, err)
	}
	g.port = s
	g.log("Port opened successfully.")

	// Initialize commands
	if err := g.sendCommand("AT", "OK"); err != nil {
		g.Close()
		return fmt.Errorf("modem check failed: %w", err)
	}
	if err := g.sendCommand("AT+CMGF=1", "OK"); err != nil {
		g.Close()
		return fmt.Errorf("failed to set text mode: %w", err)
	}

	return nil
}

// Close closes the serial port
func (g *GSMModem) Close() {
	if g.port != nil {
		g.log("Closing modem port.")
		g.port.Close()
		g.port = nil
	}
}

// sendCommand helper (internal) - assumes port is open
func (g *GSMModem) sendCommand(cmd string, expect string) error {
	if g.port == nil {
		return fmt.Errorf("port not open")
	}

	g.log(fmt.Sprintf("CMD: %s", cmd))
	_, err := g.port.Write([]byte(cmd + "\r"))
	if err != nil {
		g.log(fmt.Sprintf("Write Error: %v", err))
		return err
	}
	time.Sleep(200 * time.Millisecond) // Give modem time to process

	buf := make([]byte, 128)
	n, err := g.port.Read(buf)
	if err != nil {
		g.log(fmt.Sprintf("Read Error: %v", err))
		return err
	}
	response := string(buf[:n])
	// Clean up newlines for log
	logResp := strings.ReplaceAll(response, "\r", "")
	logResp = strings.ReplaceAll(logResp, "\n", " ")
	g.log(fmt.Sprintf("RESP: %s", logResp))

	if !strings.Contains(response, expect) {
		return fmt.Errorf("unexpected response for %s: %s", cmd, response)
	}
	return nil
}

// SendSMS sends a text message to the specified number
func (g *GSMModem) SendSMS(encodedNumber string, text string) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	// Ensure connected
	if g.port == nil {
		if err := g.Connect(); err != nil {
			return err
		}
	}

	// Helper to handle failure: close port so next retry reconnects
	fail := func(err error) error {
		g.log(fmt.Sprintf("SMS Error: %v", err))
		g.Close()
		return err
	}

	// 1. Send Message Command
	cmd := fmt.Sprintf("AT+CMGS=\"%s\"", encodedNumber)
	g.log(fmt.Sprintf("CMD: %s", cmd))
	_, err := g.port.Write([]byte(cmd + "\r"))
	if err != nil {
		return fail(fmt.Errorf("failed to write CMGS: %w", err))
	}
	time.Sleep(500 * time.Millisecond)

	// Wait for prompt '> '
	buf := make([]byte, 128)
	n, err := g.port.Read(buf)
	if err != nil {
		g.log(fmt.Sprintf("Read Prompt Error: %v", err))
	} else {
		prompt := string(buf[:n])
		g.log(fmt.Sprintf("PROMPT: %s", strings.ReplaceAll(prompt, "\n", " ")))
	}

	// 2. Send Content + Ctrl+Z (ASCII 26)
	g.log("Sending SMS Body...")
	_, err = g.port.Write([]byte(text + string(26)))
	if err != nil {
		return fail(fmt.Errorf("failed to write content: %w", err))
	}

	// 3. Wait for sending confirmation (can take seconds)
	time.Sleep(3 * time.Second)

	// Try to read final response
	buf = make([]byte, 128)
	n, err = g.port.Read(buf)
	if err == nil {
		finalResp := string(buf[:n])
		logResp := strings.ReplaceAll(finalResp, "\r", "")
		logResp = strings.ReplaceAll(logResp, "\n", " ")
		g.log(fmt.Sprintf("FINAL RESP: %s", logResp))
	}

	return nil
}

// CheckAvailablePorts scans COM1-COM20 to find available serial ports
// Note: This is a basic scanner.
func CheckAvailablePorts() []string {
	var available []string
	for i := 1; i <= 20; i++ {
		port := fmt.Sprintf("COM%d", i)
		// Try to open
		c := &serial.Config{Name: port, Baud: 115200, ReadTimeout: time.Millisecond * 100}
		s, err := serial.OpenPort(c)
		if err == nil {
			available = append(available, port)
			s.Close()
		}
	}
	return available
}

// FindModemPort attempts to locate the Quectel modem in the Windows Registry
// looking for USB\VID_2C7C&PID_6002... and extracting the PortName.
func FindModemPort() (string, error) {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Enum\USB`, registry.ENUMERATE_SUB_KEYS|registry.READ)
	if err != nil {
		return "", fmt.Errorf("failed to open USB enum key: %w", err)
	}
	defer k.Close()

	// 1. List all USB devices (looking for our VID/PID)
	devices, err := k.ReadSubKeyNames(-1)
	if err != nil {
		return "", err
	}

	for _, device := range devices {
		// Check for our VID/PID
		if strings.Contains(strings.ToUpper(device), QuectelVIDPID) {

			// Filter for MI_03 interface (AT command interface)
			// The "MI_03" part is in the Device ID (Key Name), NOT the Instance ID.
			// e.g. "VID_2C7C&PID_6002&MI_03"
			if !strings.Contains(strings.ToUpper(device), "MI_03") {
				continue
			}

			// Found the device type key, now look for instances
			// Path: USB\<VID&PID>
			deviceKeyPath := fmt.Sprintf(`SYSTEM\CurrentControlSet\Enum\USB\%s`, device)
			dk, err := registry.OpenKey(registry.LOCAL_MACHINE, deviceKeyPath, registry.ENUMERATE_SUB_KEYS|registry.READ)
			if err != nil {
				continue
			}
			defer dk.Close()

			instances, err := dk.ReadSubKeyNames(-1)
			if err != nil {
				continue
			}

			// We iterate all instances to find one with a PortName
			for _, instance := range instances {
				// Path: USB\<VID&PID>\<Instance>\Device Parameters
				paramPath := fmt.Sprintf(`%s\%s\Device Parameters`, deviceKeyPath, instance)
				pk, err := registry.OpenKey(registry.LOCAL_MACHINE, paramPath, registry.QUERY_VALUE)
				if err != nil {
					continue
				}
				portName, _, err := pk.GetStringValue("PortName")
				pk.Close()

				if err == nil && portName != "" {
					// VERIFY: Attempt to open the port. If it fails (e.g. unplugged), skip it.
					// This prevents selecting stale registry entries.
					c := &serial.Config{Name: portName, Baud: 115200, ReadTimeout: time.Millisecond * 100}
					s, err := serial.OpenPort(c)
					if err == nil {
						s.Close()
						return portName, nil
					}
					// Check failed (likely device unplugged but registry entry stuck), continue searching
				}
			}
		}
	}

	return "", fmt.Errorf("quectel modem (MI_03) not active or found")
}
