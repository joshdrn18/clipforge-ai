# ClipForge AI

Cloud-only AI video clipping workspace. The user's laptop is used only to open the website and upload source videos in a browser. Video analysis, FFmpeg rendering, and AI processing run on a separate remote cloud server.

## Architecture

- Cloudflare Pages: dashboard and API
- D1: jobs, cloud worker status, events, and clip metadata
- R2: multipart source uploads and rendered MP4 outputs
- Remote cloud container: Python worker, AutoClip, FFmpeg, and AI pipeline

**There is no supported local rendering mode. Do not run the worker on a personal laptop.** Cloudflare Workers handle control-plane requests and storage coordination; long-running FFmpeg/AI work runs in the remote container.

## Dashboard

- https://clipforge-ai-2c2.pages.dev
- Uploads use R2 multipart transfer in 32 MiB chunks.
- Jobs are always created in cloud mode.
- The dashboard can be closed after the upload has completed; the remote worker continues independently.

## Remote cloud worker deployment

The `agent/` directory contains the Docker image and Compose service for deployment to a Linux VPS or remote container host. Deploy it through that provider's Git integration or server-side container build. Do not install it on the user's laptop.

Required environment variables on the remote server:

- `CLIPFORGE_API_URL=https://clipforge-ai-2c2.pages.dev`
- `CLIPFORGE_AGENT_SECRET=<new-long-random-secret>`
- `CLIPFORGE_AGENT_LABEL=ClipForge Cloud Worker`
- `CLIPFORGE_AGENT_MODE=cloud`
- `AUTOCLIP_HOME=/data/autoclip`

Set the exact same newly rotated secret in Cloudflare Pages as `AGENT_SHARED_SECRET`. Never put this secret in frontend code, GitHub commits, screenshots, or public logs. The previous agent secret must be considered compromised and rotated before deployment.

The container requires persistent storage for the AutoClip model/cache directory at `/data/autoclip`. For reliable long-form video processing, choose a server with enough disk, memory, CPU, and temporary storage for the source plus generated clips. Free server plans may sleep, have short execution limits, or prohibit sustained video workloads; do not assume unlimited free rendering.

## Current deployment boundary

The Cloudflare dashboard, D1, and R2 resources are already provisioned. The remote rendering server still needs to be provisioned and connected. No real end-to-end render should be considered verified until a cloud worker reports `pipeline_ready=true` and a real source video successfully produces an MP4 in the Clip library.

## Security status

Workspace authentication and per-user authorization are not yet implemented. Do not expose this workspace publicly with private or valuable media until access controls are added.
