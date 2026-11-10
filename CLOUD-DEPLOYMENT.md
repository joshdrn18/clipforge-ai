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

## Oracle Cloud Always Free target

The first deployment target is an OCI Ampere A1 ARM64 VM, using only the published Always Free allowance. Do not upgrade the tenancy or create paid resources without the user's explicit approval.

The worker image uses Python 3.12 and pins MediaPipe 0.10.18 because that release publishes Linux ARM64 wheels. MediaPipe 0.10.20/0.10.21 dropped those Linux ARM64 wheels, so leaving the dependency unpinned would make an ARM build fail. CTranslate2 publishes Linux AArch64 CPU wheels. The complete AutoClip dependency installation and real render still require a build/smoke test on the actual ARM VM before declaring compatibility.

## Remote cloud worker deployment

The `agent/` directory contains the Docker image and Compose service for deployment to a Linux cloud server. Deploy it through the provider's server-side Git/container workflow. Do not install it on the user's laptop.

Required environment variables on the remote server:

- `CLIPFORGE_API_URL=https://clipforge-ai-2c2.pages.dev`
- `CLIPFORGE_AGENT_SECRET=<new-long-random-secret>`
- `CLIPFORGE_AGENT_LABEL=ClipForge Cloud Worker`
- `CLIPFORGE_AGENT_MODE=cloud`
- `AUTOCLIP_HOME=/data/autoclip`

The Compose file persists AutoClip cache/model state and worker identity in separate named volumes.

Set the exact same newly rotated secret in Cloudflare Pages as `AGENT_SHARED_SECRET`. Never put this secret in frontend code, GitHub commits, screenshots, or public logs. The previous agent secret must be considered compromised and rotated before deployment.

The container requires persistent storage for the AutoClip model/cache directory at `/data/autoclip`. For reliable long-form video processing, choose a server with enough disk, memory, CPU, and temporary storage for the source plus generated clips. Free server plans may sleep, have short execution limits, or prohibit sustained video workloads; do not assume unlimited free rendering.

## Current deployment boundary

The Cloudflare dashboard, D1, and R2 resources are already provisioned. The remote rendering server still needs to be provisioned and connected. No real end-to-end render should be considered verified until a cloud worker reports `pipeline_ready=true` and a real source video successfully produces an MP4 in the Clip library.

## Security status

Workspace authentication and per-user authorization are not yet implemented. Do not expose this workspace publicly with private or valuable media until access controls are added.
