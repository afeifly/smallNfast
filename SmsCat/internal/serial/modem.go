package serial

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"
	"unicode/utf16"

	"github.com/tarm/serial"
	"golang.org/x/sys/windows/registry"
)

const (
	QuectelVID = "VID_2C7C"
)

type GSMModem struct {
	PortName string
	BaudRate int
	port     *serial.Port
	mu       sync.Mutex
	LogFunc  func(string, bool)
}

func NewGSMModem(port string, logFunc func(string, bool)) *GSMModem {
	return &GSMModem{
		PortName: port,
		BaudRate: 115200,
		LogFunc:  logFunc,
	}
}

func (g *GSMModem) log(msg string, verbose bool) {
	if g.LogFunc != nil {
		g.LogFunc(msg, verbose)
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

	g.log(fmt.Sprintf("Connecting to port %s...", g.PortName), false)
	c := &serial.Config{Name: g.PortName, Baud: g.BaudRate, ReadTimeout: time.Second * 3}
	s, err := serial.OpenPort(c)
	if err != nil {
		g.log(fmt.Sprintf("Failed to open port: %v", err), false)
		return fmt.Errorf("failed to open port %s: %w", g.PortName, err)
	}
	g.port = s
	g.log("Port opened successfully.", false)

	// Initialization Sequence (Aligned with auto_test.py)
	// 1. Simple Handshake
	if err := g.sendCommand("AT", "OK"); err != nil {
		g.Close()
		return fmt.Errorf("modem check failed: %w", err)
	}
	// 2. Disable Echo
	if err := g.sendCommand("ATE0", "OK"); err != nil {
		g.log("Warning: ATE0 failed", true)
	}
	// 3. Verbose Errors
	if err := g.sendCommand("AT+CMEE=2", "OK"); err != nil {
		g.log("Warning: CMEE=2 failed", true)
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
	if err := g.sendCommand("AT+CSCS=\"UCS2\"", "OK"); err != nil {
		g.log("Warning: CSCS=UCS2 failed", true)
	}
	// 7. Text Mode Parameters (Unicode/Class 0)
	if err := g.sendCommand("AT+CSMP=17,167,0,8", "OK"); err != nil {
		g.log("Warning: CSMP=17,167,0,8 failed", true)
	}
	// 8. Prefer Packet Domain
	if err := g.sendCommand("AT+CGSMS=2", "OK"); err != nil {
		g.log("Warning: CGSMS=2 failed", true)
	}

	return nil
}

// Close closes the serial port
func (g *GSMModem) Close() {
	if g.port != nil {
		g.log("Closing modem port.", false)
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

	g.log(fmt.Sprintf("CMD: %s", cmd), true)
	_, err := g.port.Write([]byte(cmd + "\r"))
	if err != nil {
		g.log(fmt.Sprintf("Write Error: %v", err), false)
		return err
	}
	time.Sleep(200 * time.Millisecond)

	buf := make([]byte, 1024)
	n, err := g.port.Read(buf)
	if err != nil {
		// Log but don't fail immediately, check if what we got matches
		g.log(fmt.Sprintf("Read Error (or timeout): %v", err), true)
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
	g.log(fmt.Sprintf("RESP: %s", logResp), true)

	if !strings.Contains(response, expect) {
		return fmt.Errorf("unexpected response: %s", response)
	}
	return nil
}

// encodeUCS2 converts a string to UCS2 Hex string (Big Endian)
func encodeUCS2(s string) string {
	runes := []rune(s)
	var sb strings.Builder
	for _, r := range runes {
		sb.WriteString(fmt.Sprintf("%04X", r))
	}
	return sb.String()
}

// encodeAddress formats phone number for GSM PDU destination address field.
func encodeAddress(number string) (string, error) {
	// Strip spaces, dashes, parentheses
	number = strings.ReplaceAll(number, " ", "")
	number = strings.ReplaceAll(number, "-", "")
	number = strings.ReplaceAll(number, "(", "")
	number = strings.ReplaceAll(number, ")", "")

	isInternational := strings.HasPrefix(number, "+")
	if isInternational {
		number = number[1:]
	}

	// Ensure all characters are digits
	for _, r := range number {
		if r < '0' || r > '9' {
			return "", fmt.Errorf("invalid characters in phone number: %s", number)
		}
	}

	length := len(number)
	lengthHex := fmt.Sprintf("%02X", length)

	typeOfAddress := "81"
	if isInternational {
		typeOfAddress = "91"
	}

	// Pad if odd length
	padded := number
	if length%2 != 0 {
		padded += "F"
	}

	// Swap nibbles
	var sb strings.Builder
	for i := 0; i < len(padded); i += 2 {
		sb.WriteByte(padded[i+1])
		sb.WriteByte(padded[i])
	}

	return lengthHex + typeOfAddress + sb.String(), nil
}

type pduSegment struct {
	pduString string
	length    int
}

// textToPDUSegments prepares raw PDU segments for sending long or short SMS using UCS2.
// It uses First Octet 11 (single) / 51 (concatenated) with Relative Validity Period C1 (27 days).
func textToPDUSegments(number string, text string) ([]pduSegment, error) {
	addrPDU, err := encodeAddress(number)
	if err != nil {
		return nil, err
	}

	utf16Vals := utf16.Encode([]rune(text))
	totalRunes := len(utf16Vals)

	// If it fits in a single SMS (<= 70 characters)
	if totalRunes <= 70 {
		var udStrings []string
		for _, val := range utf16Vals {
			udStrings = append(udStrings, fmt.Sprintf("%04X", val))
		}
		udHex := strings.Join(udStrings, "")
		udl := len(udHex) / 2 // number of bytes

		// PDU = SMSC(00) + FirstOctet(11) + MR(00) + DestAddr + PID(00) + DCS(08) + VP(C1) + UDL(hex) + UD(hex)
		pdu := fmt.Sprintf("001100%s0008C1%02X%s", addrPDU, udl, udHex)
		atLength := (len(pdu) / 2) - 1

		return []pduSegment{{pduString: pdu, length: atLength}}, nil
	}

	// Concatenated SMS: max 67 characters per segment (leaves 6 bytes for UDH in the 140 bytes limit)
	var segments []pduSegment
	refNum := uint8(time.Now().Unix() & 0xFF) // Random reference number between 0 and 255

	chunkSize := 67
	var chunks [][]uint16
	for i := 0; i < len(utf16Vals); i += chunkSize {
		end := i + chunkSize
		if end > len(utf16Vals) {
			end = len(utf16Vals)
		}
		chunks = append(chunks, utf16Vals[i:end])
	}

	totalParts := len(chunks)

	for idx, chunk := range chunks {
		partNum := idx + 1
		// Construct UDH: 05 00 03 XX YY ZZ
		// XX = refNum, YY = totalParts, ZZ = partNum
		udh := fmt.Sprintf("050003%02X%02X%02X", refNum, totalParts, partNum)

		var udStrings []string
		for _, val := range chunk {
			udStrings = append(udStrings, fmt.Sprintf("%04X", val))
		}
		udHex := udh + strings.Join(udStrings, "")
		udl := len(udHex) / 2 // number of bytes, including UDH

		// PDU = SMSC(00) + FirstOctet(51) [with TP-UDHI set] + MR(00) + DestAddr + PID(00) + DCS(08) + VP(C1) + UDL(hex) + UD(hex)
		pdu := fmt.Sprintf("005100%s0008C1%02X%s", addrPDU, udl, udHex)
		atLength := (len(pdu) / 2) - 1

		segments = append(segments, pduSegment{pduString: pdu, length: atLength})
	}

	return segments, nil
}

// SendSMS sends a text message to the specified number.
// It automatically handles message encoding and splitting/concatenation via PDU Mode.
func (g *GSMModem) SendSMS(number string, text string) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	// Ensure connected
	if g.port == nil {
		g.log("SMS: modem not connected, connecting...", false)
		if err := g.Connect(); err != nil {
			return err
		}
	}

	// Fail helper — closes port so next call reconnects fresh
	fail := func(err error) error {
		g.log(fmt.Sprintf("SMS FAILED: %v", err), false)
		g.Close()
		return err
	}

	// Prepare PDU segments (concatenated or single)
	segments, err := textToPDUSegments(number, text)
	if err != nil {
		return fail(fmt.Errorf("failed to prepare PDU: %w", err))
	}

	msgLen := len([]rune(text))
	g.log(fmt.Sprintf("SMS → %s | %d chars | %d PDU segment(s)", number, msgLen, len(segments)), false)

	// Set modem to PDU mode (0)
	if err := g.sendCommand("AT+CMGF=0", "OK"); err != nil {
		return fail(fmt.Errorf("failed to set PDU mode: %w", err))
	}

	for i, seg := range segments {
		partLabel := ""
		if len(segments) > 1 {
			partLabel = fmt.Sprintf(" [part %d/%d]", i+1, len(segments))
		}

		g.log(fmt.Sprintf("SMS%s: PDU hex = %s (Length parameter = %d)", partLabel, seg.pduString, seg.length), false)

		// Send CMGS command with length in octets excluding SMSC byte
		cmd := fmt.Sprintf("AT+CMGS=%d", seg.length)
		g.log(fmt.Sprintf("CMD: %s", cmd), true)
		if _, err := g.port.Write([]byte(cmd + "\r")); err != nil {
			return fail(fmt.Errorf("write CMGS%s failed: %w", partLabel, err))
		}

		// Wait for '>' prompt
		gotPrompt := false
		start := time.Now()
		for time.Since(start) < 5*time.Second {
			buf := make([]byte, 128)
			n, _ := g.port.Read(buf)
			if n > 0 {
				chunk := string(buf[:n])
				if strings.Contains(chunk, ">") {
					gotPrompt = true
					g.log(fmt.Sprintf("SMS%s: got '>' prompt, sending PDU data...", partLabel), false)
					break
				}
				if strings.Contains(chunk, "ERROR") {
					return fail(fmt.Errorf("error before prompt%s: %s", partLabel, chunk))
				}
			}
			time.Sleep(100 * time.Millisecond)
		}
		if !gotPrompt {
			return fail(fmt.Errorf("timeout waiting for '>' prompt%s", partLabel))
		}

		// Send PDU hex string
		if _, err := g.port.Write([]byte(seg.pduString)); err != nil {
			return fail(fmt.Errorf("write PDU data%s failed: %w", partLabel, err))
		}
		// Send Ctrl+Z
		if _, err := g.port.Write([]byte{26}); err != nil {
			return fail(fmt.Errorf("write Ctrl+Z%s failed: %w", partLabel, err))
		}

		// Wait for +CMGS confirmation
		g.log(fmt.Sprintf("SMS%s: waiting for network confirmation...", partLabel), false)
		startWait := time.Now()
		sentOk := false
		for time.Since(startWait) < 30*time.Second {
			buf := make([]byte, 256)
			n, _ := g.port.Read(buf)
			if n > 0 {
				resp := string(buf[:n])
				logResp := strings.ReplaceAll(strings.ReplaceAll(resp, "\r", ""), "\n", " ")
				g.log(fmt.Sprintf("SMS RX%s: %s", partLabel, logResp), false)
				if strings.Contains(resp, "+CMGS:") {
					g.log(fmt.Sprintf("SMS%s: sent OK ✓", partLabel), false)
					sentOk = true
					break
				}
				if strings.Contains(resp, "ERROR") {
					return fail(fmt.Errorf("modem rejected SMS%s: %s", partLabel, resp))
				}
			}
			time.Sleep(200 * time.Millisecond)
		}

		if !sentOk {
			return fail(fmt.Errorf("timeout waiting for SMS confirmation%s", partLabel))
		}

		// Delay between segments
		if i < len(segments)-1 {
			g.log("SMS: waiting 2s before next part...", false)
			time.Sleep(2 * time.Second)
		}
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
		if strings.Contains(strings.ToUpper(device), QuectelVID) {

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
