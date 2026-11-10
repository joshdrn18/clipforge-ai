#!/usr/bin/env python3
"""ClipForge outbound agent client. Registers and heartbeats only; no fake rendering."""
import os
import platform
import socket
import time
import uuid
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))
BASE_URL = os.environ.get("CLIPFORGE_API_URL", "https://clipforge-ai-2c2.pages.dev").rstrip("/")
SECRET = os.environ.get("CLIPFORGE_AGENT_SECRET", "")
AGENT_ID_FILE = Path.home() / ".clipforge-agent-id"
LABEL = os.environ.get("CLIPFORGE_AGENT_LABEL", socket.gethostname())
MODE = os.environ.get("CLIPFORGE_AGENT_MODE", "local").lower()
INTERVAL = max(15, int(os.environ.get("CLIPFORGE_HEARTBEAT_SECONDS", "30")))

if not SECRET:
    raise SystemExit("Missing CLIPFORGE_AGENT_SECRET. Set it in agent/.env and Cloudflare AGENT_SHARED_SECRET.")
if MODE not in ("local", "cloud"):
    raise SystemExit("CLIPFORGE_AGENT_MODE must be local or cloud.")

def agent_id():
    if AGENT_ID_FILE.exists():
        return AGENT_ID_FILE.read_text().strip()
    value = str(uuid.uuid4())
    AGENT_ID_FILE.write_text(value)
    return value

ID = agent_id()
SESSION = requests.Session()
SESSION.headers.update({"Authorization": f"Bearer {SECRET}", "Content-Type": "application/json"})

def call(action, payload):
    response = SESSION.post(f"{BASE_URL}/api/agent/{action}", json=payload, timeout=20)
    response.raise_for_status()
    data = response.json()
    if not data.get("ok"):
        raise RuntimeError(data.get("error", "Agent API rejected request"))
    return data

def main():
    capabilities = {
        "os": platform.system(),
        "architecture": platform.machine(),
        "python": platform.python_version(),
        "pipeline_ready": False,
        "features": ["outbound-heartbeat", "job-claim-disabled-until-renderer-installed"]
    }
    call("register", {"agent_id": ID, "label": LABEL, "mode": MODE, "capabilities": capabilities})
    print(f"ClipForge agent connected: {LABEL} ({MODE})")
    print("Heartbeat active. Job claiming stays disabled until the real FFmpeg/AI renderer is installed.")
    while True:
        try:
            call("heartbeat", {"agent_id": ID, "capabilities": capabilities})
            print("Heartbeat OK")
        except Exception as exc:
            print(f"Connection issue: {exc}")
        time.sleep(INTERVAL)

if __name__ == "__main__":
    main()
