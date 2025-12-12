package serial

import (
	"fmt"
	"log"
	"strings"
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
}

func NewGSMModem(port string) *GSMModem {
	return &GSMModem{
		PortName: port,
		BaudRate: 9600, // Standard GSM baud rate
	}
}

// SendSMS sends a text message to the specified number
func (g *GSMModem) SendSMS(encodedNumber string, text string) error {
	c := &serial.Config{Name: g.PortName, Baud: g.BaudRate, ReadTimeout: time.Second * 3}
	s, err := serial.OpenPort(c)
	if err != nil {
		return fmt.Errorf("failed to open port %s: %w", g.PortName, err)
	}
	defer s.Close()

	// Helper to send command and wait for expected response
	sendCommand := func(cmd string, expect string) error {
		_, err := s.Write([]byte(cmd + "\r"))
		if err != nil {
			return err
		}
		time.Sleep(200 * time.Millisecond) // Give modem time to process

		buf := make([]byte, 128)
		n, err := s.Read(buf)
		if err != nil {
			return err
		}
		response := string(buf[:n])
		if !strings.Contains(response, expect) {
			return fmt.Errorf("unexpected response for %s: %s", cmd, response)
		}
		return nil
	}

	// 1. Check AT
	if err := sendCommand("AT", "OK"); err != nil {
		return fmt.Errorf("modem check failed: %w", err)
	}

	// 2. Set Text Mode
	if err := sendCommand("AT+CMGF=1", "OK"); err != nil {
		return fmt.Errorf("failed to set text mode: %w", err)
	}

	// 3. Send Message Command
	_, err = s.Write([]byte(fmt.Sprintf("AT+CMGS=\"%s\"\r", encodedNumber)))
	if err != nil {
		return err
	}
	time.Sleep(500 * time.Millisecond)

	// Wait for prompt '> '
	buf := make([]byte, 128)
	n, err := s.Read(buf)
	if err != nil {
		// Sometimes we might miss reading it if it's too fast, but usually it waits
		log.Printf("Read after CMGS: %s", string(buf[:n]))
	}

	// 4. Send Content + Ctrl+Z (ASCII 26)
	_, err = s.Write([]byte(text + string(26)))
	if err != nil {
		return err
	}

	// 5. Wait for sending confirmation (can take seconds)
	time.Sleep(3 * time.Second)
	// We could read response here to verify "+CMGS: <id>" and "OK"

	return nil
}

// CheckAvailablePorts scans COM1-COM20 to find available serial ports
// Note: This is a basic scanner.
func CheckAvailablePorts() []string {
	var available []string
	for i := 1; i <= 20; i++ {
		port := fmt.Sprintf("COM%d", i)
		// Try to open
		c := &serial.Config{Name: port, Baud: 9600, ReadTimeout: time.Millisecond * 100}
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
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Enum\USB`, registry.ENUM_SUB_KEYS|registry.READ)
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
		if strings.Contains(strings.ToUpper(device), QuectelVIDPID) {
			// Found the device type key, now look for instances
			// Path: USB\<VID&PID>
			deviceKeyPath := fmt.Sprintf(`SYSTEM\CurrentControlSet\Enum\USB\%s`, device)
			dk, err := registry.OpenKey(registry.LOCAL_MACHINE, deviceKeyPath, registry.ENUM_SUB_KEYS|registry.READ)
			if err != nil {
				continue
			}
			defer dk.Close()

			instances, err := dk.ReadSubKeyNames(-1)
			if err != nil {
				continue
			}

			// Check instances (MI_02, MI_03 usually for AT commands on Quectel)
			// User mentioned: USB\VID_2C7C&PID_6002&MI_03 or USB\VID_2C7C&PID_6002&REV_0318&MI_03
			// We iterate all instances to find one with a PortName
			for _, instance := range instances {
				// Path: USB\<VID&PID>\<Instance>\Device Parameters
				paramPath := fmt.Sprintf(`%s\%s\Device Parameters`, deviceKeyPath, instance)
				pk, err := registry.OpenKey(registry.LOCAL_MACHINE, paramPath, registry.QUERY_VALUE)
				if err != nil {
					continue
				}
				defer pk.Close()

				portName, _, err := pk.GetStringValue("PortName")
				if err == nil && portName != "" {
					return portName, nil
				}
			}
		}
	}

	return "", fmt.Errorf("quectel modem not found in registry")
}
