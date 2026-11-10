# ClipForge Local Agent (connection stage)

This lightweight Python client connects outbound to ClipForge. It does not open an inbound port and does not expose your computer to the internet.

## Requirements
- Python 3.10+
- Network access to your ClipForge Pages URL

## Configure
1. In Cloudflare Pages > clipforge-ai > Settings > Variables and Secrets, add the secret `AGENT_SHARED_SECRET`. Generate a long random value and keep it private.
2. Copy `.env.example` to `.env` and set `CLIPFORGE_AGENT_SECRET` to exactly the same value.
3. Install and run:

```bash
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell:
# .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
```

Set the variables from `.env` in your terminal, then run:

```bash
python agent.py
```

The dashboard should show this machine as online after the next refresh.

## Current scope
This release implements authenticated registration and heartbeat only. It intentionally does not claim or render jobs yet. The browser upload path and the actual AutoClip/FFmpeg execution pipeline are separate steps; the agent will not mark a job complete without producing a real output.
