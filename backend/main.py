import os, time, serial
from supabase import create_client, Client

# -----------------------------
# CONFIG
# -----------------------------
SUPABASE_URL = ""
SUPABASE_SERVICE_ROLE = ""

DEVICE_ID = "Arduino Nano"       # must match frontend/device rows
PORT, BAUD = "COM3", 115200      # <-- match Arduino Serial.begin(115200)

READY_TOKEN = "READY"
OK_TOKEN = "OK"

# -----------------------------
# INIT
# -----------------------------
sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

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
    for raw in commands or []:
        if not raw:
            continue
        cmd = raw.strip()
        if cmd.upper().startswith("W"):
            parts = cmd.split(",")
            try:
                ms = int(parts[1]) if len(parts) > 1 else 1000
            except:
                ms = 1000
            print(f"[wait] {ms} ms")
            time.sleep(ms / 1000.0)
        else:
            send(ser, cmd)
            if not wait_for(ser, OK_TOKEN, 5.0):
                print("!! No OK; stopping this program")
                return False
    return True

def fetch_next_pending(device_id: str):
    resp = (
        sb.table("programs")
          .select("id,name,n,commands,status")
          .eq("device_id", device_id)
          .eq("status", "pending")
          .order("n", desc=False)
          .limit(1)
          .execute()
    )
    return resp.data[0] if resp.data else None

def set_status(row_id, status, error_msg=None):
    payload = {"status": status, "updated_at": "now()"}
    if status == "done":
        payload["processed_at"] = "now()"
    if status == "error":
        payload["error"] = error_msg or "unknown"
    sb.table("programs").update(payload).eq("id", row_id).execute()

# -----------------------------
# MAIN LOOP
# -----------------------------
def main():
    with serial.Serial(PORT, BAUD, timeout=1, write_timeout=1) as ser:
        # Give the board time to reset on port open
        time.sleep(1.5)
        ser.reset_input_buffer()  # flush any junk
        ser.reset_output_buffer()

        print("Waiting for READY...")
        if not wait_for(ser, READY_TOKEN, 5.0):
            print("!! Did not see READY. Check BAUD, COM port, wiring.")
            # You can still continue, but likely nothing will work:
            # return

        print("Bridge running… (Ctrl+C to stop)")
        try:
            while True:
                row = fetch_next_pending(DEVICE_ID)
                if not row:
                    time.sleep(0.25)
                    continue

                row_id, name, cmds = row["id"], row["name"], row.get("commands", [])
                print(f"Processing {name} ({len(cmds)} commands)")

                set_status(row_id, "processing")
                ok = run_commands(ser, cmds)
                if ok:
                    set_status(row_id, "done")
                    print(f"{name} done")
                else:
                    set_status(row_id, "error", "No OK from device")
                    print(f"{name} error")

        except KeyboardInterrupt:
            print("Stopped.")

if __name__ == "__main__":
    main()
