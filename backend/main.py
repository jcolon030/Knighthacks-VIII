"""
bridge.py — Firestore → Arduino serial bridge

What it does
------------
- Watches Firestore collection: devices/{DEVICE_ID}/outbox
- For each document with { status: "pending", seq: N, line: "..." }
  it sends the 'line' to the Arduino over serial.
- If the Arduino replies "OK", the doc is updated to { status: "acked" }.
- If there's no OK within timeout, it marks { status: "error" }.

Requirements
------------
pip install google-cloud-firestore pyserial

Auth
----
Set the environment variable to your Firebase service account JSON:
Windows (PowerShell):  $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\service.json"
macOS/Linux:           export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service.json
"""

import time
import threading
import serial
import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate("secure/knighthack8-firebase-adminsdk-fbsvc-09a9b5b073.json")
firebase_admin.initialize_app(cred)

# -----------------------------
# CONFIG — UPDATE THESE
# -----------------------------
PORT = "COM3"          # e.g. "COM3" on Windows, "/dev/ttyUSB0" or "/dev/ttyACM0" on Linux/Mac
BAUD = 115200
DEVICE_ID = "Arduino Nano"   # must match what your frontend uses
READY_TOKEN = "READY"        # what your Arduino prints when it's ready
OK_TOKEN = "OK"              # what your Arduino prints after each command
OK_TIMEOUT_S = 5.0           # how long to wait for OK after a send
READY_TIMEOUT_S = 3.0        # how long to wait for READY on startup

# If True, the listener uses Firestore query (status=="pending" ordered by seq)
# If you run into an "index required" error, set this to False to listen to
# the whole outbox and filter in code.
USE_FILTERED_QUERY = True

# -----------------------------
# SERIAL HELPERS
# -----------------------------
def wait_for(ser: serial.Serial, token: str, timeout: float) -> bool:
    """Read lines until token (exact match) or timeout."""
    t0 = time.time()
    while time.time() - t0 < timeout:
        line = ser.readline().decode(errors="ignore").strip()
        if line:
            print("<<", line)
            if line == token:
                return True
    return False

def send_line(ser: serial.Serial, line: str) -> None:
    """Write one protocol line + newline."""
    print(">>", line)
    ser.write((line + "\n").encode("utf-8"))
    ser.flush()

# -----------------------------
# FIRESTORE SETUP
# -----------------------------
db = firestore.client()
outbox_ref = db.collection("devices").document(DEVICE_ID).collection("outbox")

# We enforce in-order delivery using a simple expected sequence counter.
# If it's None at startup, we'll auto-initialize to the smallest pending seq we see.
expected_seq = None
lock = threading.Lock()

def _init_expected_seq_if_needed(pending_docs):
    """Set expected_seq to the smallest pending seq if not set yet."""
    global expected_seq
    if expected_seq is not None:
        return
    seqs = []
    for d in pending_docs:
        data = d.to_dict() or {}
        if data.get("status") == "pending" and "seq" in data:
            seqs.append(int(data["seq"]))
    if seqs:
        with lock:
            # Start from the smallest pending number
            expected_seq = min(seqs)
            print(f"[init] expected_seq set to {expected_seq}")

def process_pending_batch(ser: serial.Serial, docs):
    """
    Consume as many consecutive (expected_seq, expected_seq+1, ...) as available.
    Only sends when doc.seq == expected_seq to keep strict order.
    """
    global expected_seq
    # Build quick lookup by seq
    by_seq = {}
    for doc in docs:
        data = doc.to_dict() or {}
        if data.get("status") == "pending" and "seq" in data and "line" in data:
            try:
                seq_num = int(data["seq"])
            except Exception:
                continue
            by_seq[seq_num] = (doc.reference, data)

    _init_expected_seq_if_needed(docs)

    while True:
        with lock:
            seq = expected_seq
        if seq is None or seq not in by_seq:
            break  # nothing next in order

        doc_ref, data = by_seq[seq]
        line = data["line"]

        try:
            # Optional: mark as sent before delivery (good for monitoring)
            doc_ref.update({"status": "sent", "sentAt": firestore.SERVER_TIMESTAMP})

            # Push to Arduino
            send_line(ser, line)
            ok = wait_for(ser, OK_TOKEN, timeout=OK_TIMEOUT_S)

            if ok:
                doc_ref.update({"status": "acked", "ackedAt": firestore.SERVER_TIMESTAMP})
                with lock:
                    expected_seq = (expected_seq or 0) + 1
            else:
                doc_ref.update({
                    "status": "error",
                    "error": f"No {OK_TOKEN} from device within {OK_TIMEOUT_S}s",
                    "errorAt": firestore.SERVER_TIMESTAMP
                })
                # Stop here; user can flip back to pending to retry
                break

        except Exception as e:
            doc_ref.update({
                "status": "error",
                "error": f"{type(e).__name__}: {e}",
                "errorAt": firestore.SERVER_TIMESTAMP
            })
            break

def on_snapshot(col_snapshot, changes, read_time, ser: serial.Serial):
    """
    Firestore realtime callback. We gather all pending docs visible in this tick,
    then try to deliver any in-order commands.
    """
    # Aggregate all pending docs we can see now
    candidates = []

    # On initial attach, col_snapshot contains current matching documents.
    for d in col_snapshot:
        data = d.to_dict() or {}
        if data.get("status") == "pending":
            candidates.append(d)

    # On changes, we get individual document changes
    for ch in changes:
        d = ch.document
        data = d.to_dict() or {}
        if data.get("status") == "pending" and d not in candidates:
            candidates.append(d)

    if candidates:
        process_pending_batch(ser, candidates)

def main():
    # Open serial first so we can handshake before listening
    with serial.Serial(PORT, BAUD, timeout=1, write_timeout=1) as ser:
        time.sleep(0.5)
        # Wait for your device's READY signal
        _ = wait_for(ser, READY_TOKEN, READY_TIMEOUT_S)

        # Choose a query style
        if USE_FILTERED_QUERY:
            # Listen only to pending docs, ordered by seq (may require creating the composite index Firestore suggests)
            query = outbox_ref.where("status", "==", "pending").order_by("seq")
        else:
            # Listen to entire outbox, we'll filter in code (no index needed)
            query = outbox_ref

        # Wrap the callback to pass the serial handle
        def _callback(col_snapshot, changes, read_time):
            return on_snapshot(col_snapshot, changes, read_time, ser)

        watch = query.on_snapshot(_callback)
        print(f"Listening on Firestore: devices/{DEVICE_ID}/outbox ... Ctrl+C to exit.")

        try:
            while True:
                time.sleep(0.2)  # keep main thread alive
        except KeyboardInterrupt:
            watch.unsubscribe()
            print("Stopped.")

if __name__ == "__main__":
    main()