# ClipForge AI

A unified, local-first + cloud-assisted AI video clipping workspace.

## Processing modes

- **Local Agent** — run the heavy media pipeline on your own computer. Video files stay local unless you explicitly upload them to cloud storage.
- **Cloud Worker** — send jobs to a separately provisioned machine/container with FFmpeg and AI dependencies. Cloudflare Workers are the control plane only; they do not render video.
- **Auto** — prefer an available local agent, otherwise use a configured cloud worker.

## Architecture

- Cloudflare Pages: web app
- Cloudflare Pages Functions / Workers: authenticated job API and R2 upload coordination
- D1: users, jobs, agents, job events, and generated asset metadata
- R2: optional source and output storage
- Local/cloud processing agent: Python + FFmpeg + AutoClip pipeline

## Important

This repository starts with the control-plane UI and API. A real rendering agent must be installed and connected before jobs can be rendered. Do not expose an AutoClip server directly to the public internet; connect agents outbound and authenticate them.

## Development

```bash
npm install
npm run dev
```

## License

The ClipForge AI control-plane code is MIT. AutoClip is a separate upstream project by artbyjazi and retains its own MIT license and notices when integrated.


<!-- Pages CI trigger: source control connected; deployments build from main. -->

<!-- Trigger Pages deployment after repository path filter reset. -->
