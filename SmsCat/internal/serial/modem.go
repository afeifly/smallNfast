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

	// Initialization Sequence (Aligned with auto_test.py)
	// 1. Simple Handshake
	if err := g.sendCommand("AT", "OK"); err != nil {
		g.Close()
		return fmt.Errorf("modem check failed: %w", err)
	}
	// 2. Disable Echo
	if err := g.sendCommand("ATE0", "OK"); err != nil {
		g.log("Warning: ATE0 failed")
	}
	// 3. Verbose Errors
	if err := g.sendCommand("AT+CMEE=2", "OK"); err != nil {
		g.log("Warning: CMEE=2 failed")
	}
	// 4. Check SIM
	if err := g.sendCommand("AT+CPIN?", "READY"); err != nil {
		g.Close()
		return fmt.Errorf("SIM not ready: %w", err)
	}
	// 5. Text Mode
	if err := g.sendCommand("AT+CMGF=1", "OK"); err != nil {
		g.Close()
		return fmt.Errorf("failed to set text mode: %w", err)
	}
	// 6. Character Set
	if err := g.sendCommand("AT+CSCS=\"UTF-8\"", "OK"); err != nil {
		g.log("Warning: CSCS=UTF-8 failed")
	}
	// 7. Prefer Packet Domain
	if err := g.sendCommand("AT+CGSMS=2", "OK"); err != nil {
		g.log("Warning: CGSMS=2 failed")
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

// flushInput reads everything currently in the buffer to avoid stale data
func (g *GSMModem) flushInput() {
	if g.port == nil {
		return
	}
	// "flush" is implicit in robust reading loops now
}

// sendCommand helper
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
	time.Sleep(200 * time.Millisecond)

	buf := make([]byte, 1024)
	n, err := g.port.Read(buf)
	if err != nil {
		// Log but don't fail immediately, check if what we got matches
		g.log(fmt.Sprintf("Read Error (or timeout): %v", err))
	}

	// Read Loop (Simple version for commands: just one read is usually enough after sleep)
	// For SendSMS we will do robust loop. Here we keep it simple for Init.
	response := string(buf[:n])

	// Log simplified
	logResp := strings.ReplaceAll(response, "\r", "")
	logResp = strings.ReplaceAll(logResp, "\n", " ")
	if len(logResp) > 100 {
		logResp = logResp[:100] + "..."
	}
	g.log(fmt.Sprintf("RESP: %s", logResp))

	if !strings.Contains(response, expect) {
		return fmt.Errorf("unexpected response: %s", response)
	}
	return nil
}

// SendSMS sends a text message to the specified number with robust reading
func (g *GSMModem) SendSMS(encodedNumber string, text string) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	// Ensure connected
	if g.port == nil {
		if err := g.Connect(); err != nil {
			return err
		}
	}

	// Fail helper
	fail := func(err error) error {
		g.log(fmt.Sprintf("SMS Error: %v", err))
		g.Close()
		return err
	}

	// 1. Send Message Command
	cmd := fmt.Sprintf("AT+CMGS=\"%s\"", encodedNumber)
	g.log(fmt.Sprintf("CMD: %s", cmd))

	// Flush by reading anything pending (hacky but useful if previous err)
	// (Skipped, relying on main loop)

	_, err := g.port.Write([]byte(cmd + "\r"))
	if err != nil {
		return fail(fmt.Errorf("write CMGS failed: %w", err))
	}

	// 2. Wait for Prompt '>'
	// Loop read for up to 3 seconds
	gotPrompt := false
	startTime := time.Now()
	for time.Since(startTime) < 3*time.Second {
		buf := make([]byte, 128)
		n, err := g.port.Read(buf)
		if n > 0 {
			chunk := string(buf[:n])
			// Log chunk?
			// g.log(fmt.Sprintf("DEBUG: %q", chunk))
			if strings.Contains(chunk, ">") {
				gotPrompt = true
				g.log("PROMPT: >")
				break
			}
			// If we see ERROR/CMS ERROR, fail early
			if strings.Contains(chunk, "ERROR") {
				return fail(fmt.Errorf("error before prompt: %s", chunk))
			}
		}
		if err != nil {
			// Timeout expected if waiting
		}
		time.Sleep(100 * time.Millisecond)
	}

	if !gotPrompt {
		return fail(fmt.Errorf("timeout waiting for '>' prompt"))
	}

	// 3. Send Body + Ctrl+Z
	g.log("Sending SMS Body...")
	// Write Text
	_, err = g.port.Write([]byte(text))
	if err != nil {
		return fail(fmt.Errorf("write text failed: %w", err))
	}
	// Write Ctrl+Z
	_, err = g.port.Write([]byte{26})
	if err != nil {
		return fail(fmt.Errorf("write Ctrl+Z failed: %w", err))
	}

	// 4. Wait for Confirmation
	// Loop read for up to 20 seconds
	g.log("Waiting for confirmation...")
	startWait := time.Now()
	for time.Since(startWait) < 20*time.Second {
		buf := make([]byte, 256)
		n, _ := g.port.Read(buf)
		if n > 0 {
			resp := string(buf[:n])
			logResp := strings.ReplaceAll(resp, "\r", "")
			logResp = strings.ReplaceAll(logResp, "\n", " ")
			g.log(fmt.Sprintf("RX: %s", logResp))

			if strings.Contains(resp, "+CMGS:") {
				g.log("SMS Send SUCCESS")
				return nil
			}
			if strings.Contains(resp, "ERROR") {
				return fail(fmt.Errorf("network rejected SMS: %s", resp))
			}
		}
		time.Sleep(200 * time.Millisecond)
	}

	return fail(fmt.Errorf("timeout waiting for SMS confirmation"))
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
			dk, errKey := registry.OpenKey(registry.LOCAL_MACHINE, deviceKeyPath, registry.ENUMERATE_SUB_KEYS|registry.READ)
			if errKey != nil {
				continue
			}
			defer dk.Close()

			instances, errInst := dk.ReadSubKeyNames(-1)
			if errInst != nil {
				continue
			}

			// We iterate all instances to find one with a PortName
			for _, instance := range instances {
				// Path: USB\<VID&PID>\<Instance>\Device Parameters
				paramPath := fmt.Sprintf(`%s\%s\Device Parameters`, deviceKeyPath, instance)
				pk, errPk := registry.OpenKey(registry.LOCAL_MACHINE, paramPath, registry.QUERY_VALUE)
				if errPk != nil {
					continue
				}
				portName, _, errVal := pk.GetStringValue("PortName")
				pk.Close()

				if errVal == nil && portName != "" {
					// VERIFY: Attempt to open the port. If it fails (e.g. unplugged), skip it.
					// This prevents selecting stale registry entries.
					c := &serial.Config{Name: portName, Baud: 115200, ReadTimeout: time.Millisecond * 100}
					s, _ := serial.OpenPort(c)
					if s != nil {
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
