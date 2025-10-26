import os, time, serial
from supabase import create_client, Client

# -----------------------------
# CONFIG
# -----------------------------
# Supabase project URL and service role key (server-side only).
SUPABASE_URL = "ENTER-URL"
SUPABASE_SERVICE_ROLE = "ENTER-KEY"

# Must match the device_id your frontend inserts into the `programs` table
DEVICE_ID = "Arduino Nano"

# Serial port and baud rate; must match your Arduino sketch's Serial.begin(...)
PORT, BAUD = "COM3", 115200

# Protocol tokens printed by the Arduino sketch
READY_TOKEN = "READY"  # printed once on boot to signal readiness
OK_TOKEN = "OK"        # printed after each command is handled

# -----------------------------
# INIT
# -----------------------------
# Create a Supabase client using the service role key (bypasses RLS)
sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

def wait_for(ser: serial.Serial, token: str = "OK", timeout: float = 5.0) -> bool:
    """
    Read lines from serial until a line equals `token` or timeout elapses.
    Returns True if the token was seen, False otherwise.
    """
    t0 = time.time()
    while time.time() - t0 < timeout:
        line = ser.readline().decode(errors="ignore").strip()
        if line:
            print("<<", line)
            if line == token:
                return True
    return False

def send(ser: serial.Serial, line: str) -> None:
    """
    Write one protocol command (with newline) to the Arduino.
    """
    print(">>", line)
    ser.write((line + "\n").encode("utf-8"))
    ser.flush()

def run_for_duration(ser: serial.Serial, commands: list[str], duration_s: float = 30) -> bool:
    """
    Execute the provided `commands` repeatedly until `duration_s` has elapsed.
    Returns False early if a sent command does not receive an OK within timeout.
    """
    t0 = time.time()
    cmds = commands
    if not cmds:
        return True
    while time.time() - t0 < duration_s:
        ok = run_commands(ser, cmds)
        if not ok:
            return False
    return True

def run_commands(ser: serial.Serial, commands: list[str]) -> bool:
    """
    Execute a single pass of the command list.
    - Lines starting with 'W' are treated as waits: 'W,ms'
    - All other lines are sent to the device; expects an 'OK' response.
    Returns True if all commands succeeded, False on missing OK.
    """
    for raw in commands or []:
        if not raw:
            continue
        cmd = raw.strip()

        # Wait command: W,<ms>
        if cmd.upper().startswith("W"):
            parts = cmd.split(",")
            try:
                ms = int(parts[1]) if len(parts) > 1 else 1000
            except Exception:
                ms = 1000
            print(f"[wait] {ms} ms")
            time.sleep(ms / 1000.0)
            continue

        # Send command and require OK
        send(ser, cmd)
        if not wait_for(ser, OK_TOKEN, 5.0):
            print("!! No OK; stopping this program")
            return False

    return True

def fetch_next_pending(device_id: str):
    """
    Fetch the next 'pending' row for the given device_id, ordered by 'n' ascending.
    Expects `programs` table with columns: id, name, n, commands, status, device_id.
    Returns the first row as a dict, or None if none available.
    """
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

def set_status(row_id, status: str, error_msg: str | None = None) -> None:
    """
    Update a program row's status. If 'done', also set processed_at=now().
    If 'error', record an error message.
    """
    payload = {"status": status, "updated_at": "now()"}
    if status == "done":
        payload["processed_at"] = "now()"
    if status == "error":
        payload["error"] = error_msg or "unknown"
    sb.table("programs").update(payload).eq("id", row_id).execute()

# -----------------------------
# MAIN LOOP
# -----------------------------
def main() -> None:
    """
    Open the serial port, wait for READY from the device, then loop:
      - fetch next pending program for DEVICE_ID
      - mark as processing
      - run its commands for ~30 seconds
      - update status to done or error
    """
    with serial.Serial(PORT, BAUD, timeout=1, write_timeout=1) as ser:
        # Allow board reset-on-open, then clear stale bytes
        time.sleep(1.5)
        ser.reset_input_buffer()
        ser.reset_output_buffer()

        print("Waiting for READY...")
        if not wait_for(ser, READY_TOKEN, 5.0):
            print("!! Did not see READY. Check BAUD, COM port, wiring.")
            # Continuing is possible, but commands may fail without READY

        print("Bridge running… (Ctrl+C to stop)")
        try:
            while True:
                # Poll for the next pending program
                row = fetch_next_pending(DEVICE_ID)
                if not row:
                    time.sleep(0.25)
                    continue

                row_id = row["id"]
                name = row["name"]
                cmds = row.get("commands", []) or []

                print(f"Processing {name} ({len(cmds)} commands)")

                # Mark as processing, then run for ~30 seconds
                set_status(row_id, "processing")
                ok = run_for_duration(ser, cmds, 30)

                # Finalize status
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
