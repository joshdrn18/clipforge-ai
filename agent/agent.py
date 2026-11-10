#!/usr/bin/env python3
"""ClipForge local processing agent.

The agent connects outbound, claims jobs only when AutoClip and FFmpeg are installed,
runs the upstream AutoClip pipeline locally, and streams finished clips back to R2.
"""
import os
import platform
import re
import shutil
import socket
import subprocess
import tempfile
import threading
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
CHUNK_SIZE = 32 * 1024 * 1024
MAX_CLIPS = max(1, min(20, int(os.environ.get("CLIPFORGE_MAX_CLIPS", "5"))))

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
SESSION.headers.update({"Authorization": f"Bearer {SECRET}"})

def call(action, payload=None, method="POST", stream=False):
    response = SESSION.request(method, f"{BASE_URL}/api/agent/{action}", json=payload if method == "POST" else None, timeout=(20, 180), stream=stream)
    response.raise_for_status()
    if stream:
        return response
    data = response.json()
    if not data.get("ok"):
        raise RuntimeError(data.get("error", "Agent API rejected request"))
    return data

def renderer_ready():
    return bool(shutil.which("autoclip") and shutil.which("ffmpeg") and shutil.which("ffprobe"))

def capabilities():
    return {
        "os": platform.system(),
        "architecture": platform.machine(),
        "python": platform.python_version(),
        "pipeline_ready": renderer_ready(),
        "features": ["autoclip-cli", "ffmpeg", "whisper-highlights", "vertical-export"] if renderer_ready() else ["outbound-heartbeat", "renderer-not-installed"]
    }

def heartbeat_loop(stop_event):
    while not stop_event.wait(INTERVAL):
        try:
            call("heartbeat", {"agent_id": ID, "capabilities": capabilities()})
            print("Heartbeat OK")
        except Exception as exc:
            print(f"Heartbeat issue: {exc}")

def set_progress(job_id, value, stage):
    call("progress", {"agent_id": ID, "job_id": job_id, "progress": value, "stage": stage})

def download_source(job_id, destination):
    response = call(f"source/{job_id}", method="GET", stream=True)
    total = int(response.headers.get("Content-Length") or 0)
    written = 0
    with response, destination.open("wb") as target:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                target.write(chunk)
                written += len(chunk)
    if total and written != total:
        raise RuntimeError(f"Source download incomplete ({written} of {total} bytes).")
    if written == 0:
        raise RuntimeError("Downloaded source file is empty.")

def upload_asset(job_id, path):
    size = path.stat().st_size
    init = call("asset-init", {"agent_id": ID, "job_id": job_id, "file_name": path.name, "file_size": size, "content_type": "video/mp4"})
    upload_id, key = init["upload_id"], init["key"]
    parts = []
    try:
        with path.open("rb") as source:
            part_number = 1
            while True:
                chunk = source.read(CHUNK_SIZE)
                if not chunk:
                    break
                response = SESSION.post(
                    f"{BASE_URL}/api/agent/asset-part",
                    params={"upload_id": upload_id, "key": key, "part_number": part_number},
                    data=chunk,
                    headers={"Authorization": f"Bearer {SECRET}", "Content-Type": "application/octet-stream"},
                    timeout=(30, 300),
                )
                response.raise_for_status()
                result = response.json()
                if not result.get("ok"):
                    raise RuntimeError(result.get("error", "Clip part upload failed"))
                parts.append({"part_number": part_number, "etag": result["etag"]})
                part_number += 1
        call("asset-complete", {"agent_id": ID, "job_id": job_id, "key": key, "upload_id": upload_id, "file_name": path.name, "file_size": size, "parts": parts})
    except Exception:
        try:
            call("asset-abort", {"agent_id": ID, "key": key, "upload_id": upload_id})
        except Exception:
            pass
        raise

def run_autoclip(job, source_path):
    exports = Path(os.environ.get("AUTOCLIP_HOME", Path.home() / ".autoclip")) / "exports"
    exports.mkdir(parents=True, exist_ok=True)
    before = {p.resolve() for p in exports.rglob("*.mp4")}
    started = time.time()
    command = ["autoclip", "clip", str(source_path), "--ratio", "9:16", "--max-clips", str(MAX_CLIPS)]
    print("Running:", " ".join(command))
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "AutoClip exited without an error message")[-2500:]
        raise RuntimeError("AutoClip pipeline failed. Check its provider setup and FFmpeg installation. " + detail)
    candidates = [p for p in exports.rglob("*.mp4") if p.is_file() and p.resolve() not in before and p.stat().st_mtime >= started - 5]
    if not candidates:
        match = re.search(r"Exported to\\s+(.+)", result.stdout + "\\n" + result.stderr)
        if match:
            output_dir = Path(match.group(1).strip().strip('"'))
            candidates = list(output_dir.rglob("*.mp4")) if output_dir.exists() else []
    if not candidates:
        raise RuntimeError("AutoClip finished but no exported MP4 clips were found in " + str(exports))
    return sorted(candidates, key=lambda p: p.stat().st_mtime)

def process_job(job):
    job_id = job["id"]
    with tempfile.TemporaryDirectory(prefix="clipforge-") as temp:
        source_name = Path(job.get("source_name") or "source.mp4").name
        source_path = Path(temp) / source_name
        set_progress(job_id, 3, "downloading_source")
        download_source(job_id, source_path)
        set_progress(job_id, 12, "transcribing_and_finding_highlights")
        clips = run_autoclip(job, source_path)
        for index, clip in enumerate(clips, 1):
            progress = 70 + int((index - 1) / max(1, len(clips)) * 25)
            set_progress(job_id, progress, f"uploading_clip_{index}_of_{len(clips)}")
            upload_asset(job_id, clip)
        set_progress(job_id, 98, "finalizing")
    call("complete", {"agent_id": ID, "job_id": job_id})

def main():
    caps = capabilities()
    call("register", {"agent_id": ID, "label": LABEL, "mode": MODE, "capabilities": caps})
    print(f"ClipForge agent connected: {LABEL} ({MODE})")
    if not caps["pipeline_ready"]:
        print("Agent is online, but rendering is disabled until AutoClip + FFmpeg are installed.")
    else:
        print("AutoClip renderer detected. Waiting for jobs.")
    stop_event = threading.Event()
    heartbeat = threading.Thread(target=heartbeat_loop, args=(stop_event,), daemon=True)
    heartbeat.start()
    try:
        while True:
            try:
                if not renderer_ready():
                    time.sleep(INTERVAL)
                    continue
                claimed = call("claim", {"agent_id": ID, "pipeline_ready": True})
                job = claimed.get("job")
                if not job:
                    time.sleep(8)
                    continue
                print(f"Claimed job {job['id']}: {job.get('source_name', 'video')}")
                try:
                    process_job(job)
                    print(f"Job completed: {job['id']}")
                except Exception as exc:
                    print(f"Job failed: {exc}")
                    try:
                        call("fail", {"agent_id": ID, "job_id": job["id"], "error": str(exc)[:1000]})
                    except Exception as api_error:
                        print(f"Could not report job failure: {api_error}")
            except Exception as exc:
                print(f"Agent loop issue: {exc}")
                time.sleep(10)
    except KeyboardInterrupt:
        print("Stopping ClipForge agent...")
    finally:
        stop_event.set()

if __name__ == "__main__":
    main()
