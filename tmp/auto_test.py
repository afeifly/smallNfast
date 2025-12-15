import serial
import time
import datetime
import sys

# ================= CONFIGURATION =================
# Update this to your EC200A-CN port (e.g., COM4, /dev/ttyUSB2)
PORT = 'COM14'   
BAUDRATE = 115200

TARGET_NUMBER = '+8618922803837'
INTERVAL_SECONDS = 600  # 10 Minutes

# =================================================

def log(msg):
    """Helper to print timestamped logs"""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {msg}")

def get_serial():
    """Opens the serial port with safe error handling"""
    try:
        ser = serial.Serial(PORT, BAUDRATE, timeout=5)
        log(f"🔌 Connected to {PORT} successfully.")
        return ser
    except serial.SerialException as e:
        log(f"❌ Critical Error: Could not open port {PORT}. Details: {e}")
        sys.exit(1)

def send_at(ser, cmd, wait=1, verbose=True):
    """Sends an AT command and returns the response"""
    try:
        if verbose:
            log(f"➡️ Sending: {cmd.strip()}")
        
        ser.write(cmd.encode() + b'\r\n')
        time.sleep(wait)
        
        response = ""
        while ser.in_waiting:
            try:
                response += ser.read(ser.in_waiting).decode(errors='ignore')
            except:
                pass
            time.sleep(0.1)
        
        if verbose and response.strip():
            log(f"⬅️ Response: {response.strip()}")
        return response.strip()
    except Exception as e:
        log(f"❌ Serial Communication Error: {e}")
        return ""

def initialize_modem(ser):
    """Basic setup for EC200A-CN"""
    log("⚙️ Initializing Modem...")
    
    # 1. Simple Handshake
    send_at(ser, "AT")
    
    # 2. Disable Echo (Optional, makes output cleaner)
    send_at(ser, "ATE0")
    
    # 3. Enable Verbose Errors (Important for debugging SMS failures)
    send_at(ser, "AT+CMEE=2")
    
    # 4. Check SIM Card Status
    resp = send_at(ser, "AT+CPIN?")
    if "READY" not in resp:
        log("❌ SIM Card not ready! Please check hardware.")
        return False

    # 5. Set SMS to Text Mode (Standard)
    send_at(ser, "AT+CMGF=1")
    
    # 6. Set Character Set to GSM (Best for English/Numbers)
    send_at(ser, 'AT+CSCS="GSM"')
    
    # 7. Ensure Packet Domain preferred for SMS (Helps with Telecom 4G)
    # 2 = Prefer Packet Domain (LTE/IMS), try Circuit Switched if fails
    send_at(ser, "AT+CGSMS=2")
    
    return True

def wait_for_network(ser):
    """
    Blocks until the modem is registered to a network.
    Supports China Mobile/Unicom/Telecom.
    """
    log("⏳ Checking Network Registration...")
    
    while True:
        # Check EPS (4G) Registration
        cereg = send_at(ser, "AT+CEREG?", wait=0.5, verbose=False)
        # Check standard Registration
        creg = send_at(ser, "AT+CREG?", wait=0.5, verbose=False)
        
        # Check for registered status (1=Home, 5=Roaming)
        registered = False
        if ",1" in cereg or ",5" in cereg:
            registered = True
        elif ",1" in creg or ",5" in creg:
            registered = True
            
        if registered:
            # Query Operator Name
            cops = send_at(ser, "AT+COPS?", wait=0.5, verbose=False)
            
            operator = "Unknown"
            if "CHN-CT" in cops or "46011" in cops or "Telecom" in cops:
                operator = "China Telecom (中国电信)"
            elif "UNICOM" in cops or "46001" in cops:
                operator = "China Unicom (中国联通)"
            elif "CMCC" in cops or "Mobile" in cops or "46000" in cops:
                operator = "China Mobile (中国移动)"
            
            # Check Signal Quality
            csq = send_at(ser, "AT+CSQ", wait=0.5, verbose=False)
            
            log(f"✅ Network Ready! Operator: {operator} | Signal: {csq.strip()}")
            return True
        
        log("⚠️ Not registered yet. Retrying in 5 seconds...")
        time.sleep(5)

def send_sms(ser, number, text):
    """Sends the actual SMS"""
    log(f"✉️ Attempting to send SMS to {number}...")
    
    # 1. Send Command
    ser.write(f'AT+CMGS="{number}"\r'.encode())
    time.sleep(1)
    
    # 2. Wait for Prompt '>'
    if ser.in_waiting:
        prompt = ser.read(ser.in_waiting).decode(errors='ignore')
        if ">" in prompt:
            # 3. Send Body + Ctrl+Z
            log("✍️  Sending Message Body...")
            ser.write(text.encode())
            ser.write(bytes([26])) # Hex 0x1A is Ctrl+Z
            
            # 4. Wait for Network Confirmation
            # LTE SMS can take up to 10-15 seconds
            start_wait = time.time()
            while time.time() - start_wait < 30:
                if ser.in_waiting:
                    response = ser.read(ser.in_waiting).decode(errors='ignore')
                    print(response, end="") # Print raw output
                    
                    if "+CMGS:" in response:
                        log(f"\n✅ SMS SENT SUCCESSFULLY! Message: '{text}'")
                        return True
                    if "ERROR" in response:
                        log(f"\n❌ SMS FAILED. Network rejected it.")
                        return False
                time.sleep(0.1)
            
            log("\n❌ Timeout waiting for SMS confirmation.")
            return False
        else:
            log(f"❌ Failed to get '>' prompt. Modem said: {prompt}")
            return False
    return False

def main():
    ser = get_serial()
    
    # Initial Configuration
    if not initialize_modem(ser):
        ser.close()
        return

    # Main Loop
    message_count = 1
    
    while True:
        # 1. Ensure we are connected
        wait_for_network(ser)
        
        # 2. Prepare dynamic message
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        msg_body = f"Test #{message_count} from EC200A. Time: {timestamp}. Freq: 10mins."
        
        # 3. Send
        send_sms(ser, TARGET_NUMBER, msg_body)
        
        # 4. Wait
        log(f"💤 Sleeping for {INTERVAL_SECONDS} seconds (10 Minutes)...")
        log("   (Press Ctrl+C to stop script)")
        
        # We perform a small check loop to allow Ctrl+C interrupt and show "alive" status
        for i in range(INTERVAL_SECONDS // 10):
            time.sleep(10)
            # Optional: Every minute, check if serial is still open
            if not ser.is_open:
                log("❌ Port closed unexpectedly. Reconnecting...")
                ser = get_serial()
                
        message_count += 1

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("\n🛑 Script stopped by user.")
