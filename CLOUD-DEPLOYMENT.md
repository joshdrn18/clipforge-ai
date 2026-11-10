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

## Serverless renderer target: Modal Starter

The selected alternative to a permanently running VPS is Modal serverless compute. A render container starts only when a source upload completes, processes one queued job, then exits. It does not sit idle and bill continuously.

Modal Starter currently includes US$30/month in compute credits. To keep this project at RM0 out-of-pocket, configure both billing guardrails before deploying:
- Workspace usage budget: US$30 per billing cycle (this caps total usage before credits).
- Workspace spend limit: US$0 (Modal stops workloads that would create out-of-pocket charges; remaining applicable credits can still be used).

Modal documents workspace budgets as hard caps and spend limits as hard caps on net charges after credits. Do not raise either limit. When the free allowance is exhausted, rendering should stop until the next billing cycle rather than incur a charge.

### One-time account setup

1. Create/sign in to a Modal account on the Starter plan: https://modal.com/
2. In Usage & Billing, set the workspace usage budget to US$30 and the spend limit to US$0. Confirm both values before proceeding.
3. In Modal Dashboard → Secrets, create a secret named `clipforge-cloud-secrets` with:
   - `CLIPFORGE_API_URL=https://clipforge-ai-2c2.pages.dev`
   - `CLIPFORGE_AGENT_SECRET=<new-long-random-secret>`
   - `CLIPFORGE_AGENT_LABEL=ClipForge Modal Worker`
   - `CLIPFORGE_DISPATCH_SECRET=<a-different-long-random-secret>`
4. In GitHub repository Settings → Secrets and variables → Actions, add:
   - `MODAL_TOKEN_ID`
   - `MODAL_TOKEN_SECRET`
5. Run GitHub Actions → Deploy ClipForge cloud renderer → Run workflow. This deploys from GitHub's hosted runner; nothing is installed on the user's laptop.
6. Copy the deployed `dispatch` web endpoint URL from the Modal dashboard.
7. In Cloudflare Pages project settings, add these runtime secrets:
   - `AGENT_SHARED_SECRET` = the same value as Modal's `CLIPFORGE_AGENT_SECRET`
   - `MODAL_DISPATCH_URL` = the deployed Modal `dispatch` endpoint URL
   - `MODAL_DISPATCH_SECRET` = the same value as Modal's `CLIPFORGE_DISPATCH_SECRET`
8. Redeploy the Pages project so the upload-complete API receives the new bindings.

### How jobs run

- Browser uploads the source video to Cloudflare R2 using multipart upload.
- After upload completion, the Pages API securely dispatches a small job notification to Modal.
- Modal starts one remote container, claims one queued job from D1, downloads the source through the authenticated Cloudflare agent API, runs AutoClip + FFmpeg, and uploads finished MP4 clips to R2.
- The container exits after one job. The next upload starts another serverless execution.
- Only one render container runs at a time to limit resource usage. A dispatch failure leaves the job queued and records a warning event.

### Free-tier limitations

- The included US$30 is a monthly compute credit, not unlimited rendering.
- When the US$30 usage budget is reached, new renders stop. Do not increase the spend limit to force jobs through.
- This initial configuration is CPU-only (2 Modal CPU units, 8 GiB RAM), one job at a time, with a six-hour task timeout.
- Model downloads and cold starts can make the first render slower. The worker does not use paid persistent volumes or paid GPU hardware.
- A successful deployment is not proof of a successful render. Verify with a real source video and confirm an MP4 appears in the Clip library.

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
