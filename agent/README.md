# ClipForge Local Agent

The Windows launcher installs the Python agent and the upstream AutoClip engine, then connects outbound to ClipForge. It does not open an inbound port.

## Requirements

- Windows 10/11
- Python 3.11 or 3.12 (Python 3.13 is not supported by AutoClip's current reframe dependencies)
- Full FFmpeg build with libass and libx264 (the launcher attempts to install Gyan FFmpeg with winget)
- A working AI provider for highlight selection: Ollama locally, or an API key supported by AutoClip

## Windows quick start

1. Download the ClipForge repository ZIP and extract it.
2. Open the `agent` folder.
3. Double-click `START-CLIPFORGE.bat`. It installs the local agent and AutoClip dependencies.
4. If FFmpeg is installed during the first run, close the window and double-click the launcher again so Windows refreshes PATH.
5. On first run, Notepad opens `.env`. Set `CLIPFORGE_AGENT_SECRET` to the same rotated secret as Cloudflare's `AGENT_SHARED_SECRET`. Do not use a secret that has been shared in chat or committed to GitHub.
6. If the launcher says the renderer is not ready, double-click `CONFIGURE-AI.bat` and add an AI provider key. Then run `CHECK-CLIPFORGE.bat`.
7. Double-click `START-CLIPFORGE.bat` again and keep its window open while the computer is processing.

The launcher installs AutoClip from its upstream GitHub source through `requirements.txt`. This downloads sizeable Python/AI dependencies and may take several minutes.

## Configure AI highlight selection

AutoClip requires an available LLM provider for highlight ranking. A provider can be configured with the AutoClip CLI, for example:

```text
autoclip config set-secret openai
```

The CLI securely prompts for the key. Other supported providers and a fully local Ollama option are documented in the [AutoClip README](https://github.com/artbyjazi/autoclip).

Run `autoclip doctor` to verify Python, FFmpeg, dependencies, and provider readiness. Until the doctor check passes, the agent can appear online but will not claim rendering jobs.

## What the agent does

1. Registers and heartbeats to ClipForge over HTTPS.
2. Claims a queued job only when the local AutoClip pipeline passes its readiness check.
3. Downloads the source video from private R2 storage.
4. Runs AutoClip locally to transcribe, select highlights, reframe to 9:16, and export captioned clips.
5. Uploads each rendered MP4 to R2 in multipart chunks.
6. Reports job progress and completion to the dashboard.

The cloud control plane does not render videos. Cloud processing requires a separate machine/container running the same agent in cloud mode. Clip selection quality depends on the configured model and the source content.
