# ClipForge Cloud Worker

This container is designed to run on a separate Linux cloud server/container host only. It must not be run on a personal laptop.

## Deployment

Deploy this directory using your cloud provider's server-side Docker/Compose integration. The dashboard repository is the source of truth; no local installation is required on the user's computer.

Set these environment variables as provider secrets/configuration:

- `CLIPFORGE_API_URL=https://clipforge-ai-2c2.pages.dev`
- `CLIPFORGE_AGENT_SECRET` — long random secret, also set as Cloudflare Pages `AGENT_SHARED_SECRET`
- `CLIPFORGE_AGENT_LABEL=ClipForge Cloud Worker`
- `CLIPFORGE_AGENT_MODE=cloud`
- `AUTOCLIP_HOME=/data/autoclip`

Persist the `/data/autoclip` volume so model downloads and AutoClip state survive container restarts.

The worker makes outbound HTTPS requests to the ClipForge control plane, claims queued jobs, downloads source videos, runs AutoClip/FFmpeg, and uploads generated MP4 files to R2.

## Health/readiness

The worker registers its renderer capabilities. A worker is ready only when AutoClip, FFmpeg, ffprobe, and the configured AI provider pass `autoclip doctor`. The dashboard reports the worker as ready only after the API receives `pipeline_ready=true`.

Do not expose the worker's API secret in client-side code or public repositories.
