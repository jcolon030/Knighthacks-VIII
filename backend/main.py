import time, serial, os
from supabase import create_client, Client

# --- Supabase (use Service Role on server side) ---
SUPABASE_URL = "ENTER_API_URL"
SUPABASE_KEY = "ENTER_API_KEY"
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Serial config ---
PORT, BAUD = "COM3", 115200
READY_TOKEN = "READY"
OK_TOKEN = "OK"

def wait_for(ser, token="OK", timeout=5.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        line = ser.readline().decode(errors="ignore").strip()
        if line:
            print("<<", line)
            if line == token:
                return True
    return False

def send(ser, line):
    print(">>", line)
    ser.write((line + "\n").encode("utf-8"))
    ser.flush()

def run_commands(ser, commands):
    """commands is an array of strings like ['C 0 0 8 8 7','W,1000','F,4,4,0,255,0']"""
    for raw in commands or []:
        if not raw:
            continue
        cmd = raw.strip()
        if cmd.upper().startswith("W"):
            # handle W or W,ms
            parts = cmd.split(",")
            ms = 1000
            if len(parts) > 1:
                try: ms = int(parts[1])
                except: pass
            print(f"[wait] {ms} ms")
            time.sleep(ms/1000.0)
        else:
            send(ser, cmd)
            if not wait_for(ser, OK_TOKEN, 5.0):
                print("!! No OK from device; stopping")
                break

def fetch_program_commands(device_id: str, name: str = "commands_1"):
    """Fetch the commands array from your existing 'programs' table."""
    resp = (
        sb.table("programs")
          .select("commands")
          .eq("device_id", device_id)
          .eq("name", name)        # change if your identifier differs
          .single()
          .execute()
    )
    if not resp.data:
        print("[!] No program row found")
        return []
    return resp.data.get("commands", [])

def main():
    DEVICE_ID = "Arduino Nano"     # must match what you saved from the frontend
    PROGRAM_NAME = "commands_1"    # the field you already use

    with serial.Serial(PORT, BAUD, timeout=1, write_timeout=1) as ser:
        time.sleep(0.5)
        _ = wait_for(ser, READY_TOKEN, 3.0)  # optional handshake

        cmds = fetch_program_commands(DEVICE_ID, PROGRAM_NAME)
        print(f"Fetched {len(cmds)} commands")
        run_commands(ser, cmds)

if __name__ == "__main__":
    main()
