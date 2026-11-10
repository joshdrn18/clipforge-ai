import hmac
import os
import subprocess
from uuid import UUID

import modal
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

app = modal.App("clipforge-ai-renderer")
cloud_secret = modal.Secret.from_name("clipforge-cloud-secrets")

# Build the exact same FFmpeg + AutoClip image used by the remote worker.
renderer_image = modal.Image.from_dockerfile(
    "agent/Dockerfile",
    context_dir="agent",
)

@app.function(
    image=renderer_image,
    secrets=[cloud_secret],
    cpu=2,
    memory=8192,
    timeout=6 * 60 * 60,
    max_containers=1,
    retries=0,
)
def process_one_job():
    """Claim and render one queued job, then release the container."""
    subprocess.run(
        ["python", "/app/agent.py", "--once"],
        cwd="/app",
        check=True,
        timeout=6 * 60 * 60,
    )

@app.function(
    secrets=[cloud_secret],
    timeout=60,
    max_containers=1,
)
@modal.fastapi_endpoint(method="POST")
async def dispatch(request: Request):
    """Authenticated webhook called by the Cloudflare upload-complete route."""
    expected = os.environ.get("CLIPFORGE_DISPATCH_SECRET", "")
    supplied = request.headers.get("Authorization", "")
    if not expected or not hmac.compare_digest(supplied, "Bearer " + expected):
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        payload = await request.json()
        UUID(str(payload.get("job_id", "")))
    except Exception:
        raise HTTPException(status_code=400, detail="A valid job_id is required")

    try:
        process_one_job.spawn()
    except Exception:
        raise HTTPException(status_code=503, detail="Could not enqueue cloud render job")

    return JSONResponse({"ok": True, "accepted": True}, status_code=202)
