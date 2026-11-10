# ClipForge AI

A unified local + cloud-assisted AI video clipping workspace.

## Processing modes

- **Local** — run the heavy media pipeline on your own computer.
- **Cloud** — send work to a separately provisioned machine/container with FFmpeg and AI dependencies.
- **Auto** — select an available agent based on the job mode and agent availability.

## Architecture

- Cloudflare Pages: web app
- Pages Functions: job API and upload coordination
- D1: jobs, agents, job events, and generated asset metadata
- R2: source media and generated clips
- Python processing agent: connects outbound to the control plane

Cloudflare Workers are the control plane, not the video-rendering runtime. Heavy FFmpeg/AI work must run on a local computer or a separate cloud server.

## Current implementation status

- [x] Dashboard scaffold and job queue
- [x] Local/cloud/auto agent registration and heartbeat API
- [x] R2 multipart source upload in 32 MiB chunks
- [x] Authenticated agent source-download endpoint
- [x] Local agent can claim jobs when AutoClip doctor passes
- [x] Local agent runs AutoClip and uploads rendered MP4 assets to R2
- [ ] Dashboard clip library playback and downloads
- [x] Docker image and Compose template for a dedicated cloud agent
- [ ] Cloud server provisioning and lifecycle management
- [ ] Workspace authentication and per-user authorization

**Important:** the local rendering path is wired to AutoClip, but has not yet been end-to-end tested on your computer with a real source video and configured AI provider. The cloud agent still needs a separately provisioned server. Do not expose this unfinished workspace publicly with valuable/private media until authentication and authorization are implemented.

## Local development

```bash
npm install
npm run dev
```

## Upstream engine

The planned media pipeline uses [AutoClip](https://github.com/artbyjazi/autoclip), a separate MIT-licensed project. It requires Python 3.11 or 3.12, a full FFmpeg build with libass and libx264, and a configured LLM provider (or Ollama) for highlight selection.

## License

ClipForge AI control-plane code: MIT. AutoClip retains its own upstream license and notices when integrated.
