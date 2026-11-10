const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

function authorized(request, env) {
  const expected = env.AGENT_SHARED_SECRET;
  const supplied = request.headers.get("Authorization") || "";
  return !!expected && supplied === `Bearer ${expected}`;
}

async function readBody(request) {
  try { return await request.json(); } catch { return null; }
}

export async function onRequest({ request, env, params }) {
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized agent. Configure AGENT_SHARED_SECRET." }, 401);
  if (!env.DB) return json({ ok: false, error: "Database binding unavailable" }, 503);
  const action = String(params.action || "").toLowerCase();
  const body = request.method === "POST" && action !== "asset-part" ? await readBody(request) : {};
  if (request.method !== "POST" || !body) return json({ ok: false, error: "POST with a JSON body is required." }, 400);

  try {
    if (action === "register") {
      const agentId = String(body.agent_id || new URL(request.url).searchParams.get("agent_id") || "").slice(0, 80);
      const label = String(body.label || "Cloud Worker").trim().slice(0, 100);
      const mode = "cloud";
      if (!agentId) return json({ ok: false, error: "agent_id is required" }, 400);
      const timestamp = now();
      await env.DB.prepare(`INSERT INTO processing_agents (id, label, mode, status, capabilities_json, last_seen_at, created_at)
        VALUES (?, ?, ?, 'online', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET label=excluded.label, mode=excluded.mode, status='online',
        capabilities_json=excluded.capabilities_json, last_seen_at=excluded.last_seen_at`)
        .bind(agentId, label, mode, JSON.stringify(body.capabilities || {}), timestamp, timestamp).run();
      return json({ ok: true, agent_id: agentId, status: "online", server_time: timestamp });
    }

    const agentId = String(body.agent_id || "").slice(0, 80);
    if (!agentId) return json({ ok: false, error: "agent_id is required" }, 400);
    const agent = await env.DB.prepare("SELECT id, mode, status FROM processing_agents WHERE id = ?").bind(agentId).first();
    if (!agent) return json({ ok: false, error: "Agent is not registered. Call /register first." }, 404);
    const timestamp = now();

    if (action === "heartbeat") {
      await env.DB.prepare("UPDATE processing_agents SET status='online', last_seen_at=?, capabilities_json=? WHERE id=?")
        .bind(timestamp, JSON.stringify(body.capabilities || {}), agentId).run();
      await env.DB.prepare("UPDATE jobs SET updated_at=? WHERE status='processing' AND claimed_by=?").bind(timestamp, agentId).run();
      return json({ ok: true, status: "online", server_time: timestamp });
    }

    if (action === "claim") {
      if (body.pipeline_ready !== true) return json({ ok: true, job: null, reason: "pipeline_not_ready" });
      const staleCutoff = new Date(Date.now() - 180_000).toISOString();
      await env.DB.prepare("UPDATE jobs SET status='queued', stage='recovered_after_agent_timeout', claimed_by=NULL, progress=0, updated_at=? WHERE status='processing' AND updated_at < ?").bind(timestamp, staleCutoff).run();
      const localCutoff = new Date(Date.now() - 90_000).toISOString();
      const result = await env.DB.prepare(`UPDATE jobs SET status='processing', stage='claimed_by_agent', claimed_by=?, updated_at=?
        WHERE id = (
          SELECT j.id FROM jobs j WHERE j.status='queued'
          AND (
            j.processing_mode=?
            OR (j.processing_mode='auto' AND (
              ?='local'
              OR NOT EXISTS (
                SELECT 1 FROM processing_agents p
                WHERE p.mode='local' AND p.status='online' AND p.last_seen_at > ?
                AND json_extract(p.capabilities_json, '$.pipeline_ready') = 1
              )
            ))
          )
          ORDER BY j.created_at ASC LIMIT 1
        ) AND status='queued' RETURNING id, source_name, source_size, duration_seconds, processing_mode, settings_json`)
        .bind(agentId, timestamp, agent.mode, agent.mode, localCutoff).first();
      if (!result) return json({ ok: true, job: null });
      await env.DB.prepare("INSERT INTO job_events (job_id, level, message, created_at) VALUES (?, 'info', ?, ?)")
        .bind(result.id, `Cloud worker ${agentId} claimed this job.`, timestamp).run();
      return json({ ok: true, job: result });
    }


    if (action === "asset-init") {
      if (!env.MEDIA) return json({ ok: false, error: "R2 storage binding unavailable" }, 503);
      const jobId = String(body.job_id || "");
      const fileName = String(body.file_name || "clip.mp4").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
      const size = Number(body.file_size || 0);
      const job = await env.DB.prepare("SELECT id, status FROM jobs WHERE id=? AND status='processing'").bind(jobId).first();
      if (!job || !Number.isSafeInteger(size) || size <= 0 || size > 5 * 1024 * 1024 * 1024) return json({ ok: false, error: "Active job and valid file_size (up to 5 GiB) are required" }, 400);
      const key = "outputs/" + jobId + "/" + uuid() + "-" + fileName;
      const upload = await env.MEDIA.createMultipartUpload(key, { httpMetadata: { contentType: String(body.content_type || "video/mp4") } });
      return json({ ok: true, upload_id: upload.uploadId, key, part_size: 32 * 1024 * 1024 });
    }

    if (action === "asset-part") {
      if (!env.MEDIA) return json({ ok: false, error: "R2 storage binding unavailable" }, 503);
      const url = new URL(request.url);
      const key = url.searchParams.get("key") || "";
      const uploadId = url.searchParams.get("upload_id") || "";
      const partNumber = Number(url.searchParams.get("part_number"));
      if (!key.startsWith("outputs/") || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) return json({ ok: false, error: "Invalid asset upload parameters" }, 400);
      const result = await env.MEDIA.resumeMultipartUpload(key, uploadId).uploadPart(partNumber, request.body);
      return json({ ok: true, part_number: partNumber, etag: result.etag });
    }


    if (action === "asset-abort") {
      if (!env.MEDIA) return json({ ok: false, error: "R2 storage binding unavailable" }, 503);
      const key = String(body.key || "");
      const uploadId = String(body.upload_id || "");
      if (!key.startsWith("outputs/") || !uploadId) return json({ ok: false, error: "Invalid asset abort request" }, 400);
      await env.MEDIA.resumeMultipartUpload(key, uploadId).abort();
      return json({ ok: true });
    }

    if (action === "asset-complete") {
      if (!env.MEDIA) return json({ ok: false, error: "R2 storage binding unavailable" }, 503);
      const jobId = String(body.job_id || "");
      const key = String(body.key || "");
      const uploadId = String(body.upload_id || "");
      const fileName = String(body.file_name || "clip.mp4").slice(0, 200);
      const size = Number(body.file_size || 0);
      const parts = Array.isArray(body.parts) ? body.parts : [];
      if (!jobId || !key.startsWith("outputs/" + jobId + "/") || !uploadId || !parts.length) return json({ ok: false, error: "Invalid asset completion request" }, 400);
      const activeJob = await env.DB.prepare("SELECT id FROM jobs WHERE id=? AND status='processing'").bind(jobId).first();
      if (!activeJob) return json({ ok: false, error: "Job is no longer processing" }, 409);
      const normalized = parts.map(p => ({ partNumber: Number(p.part_number), etag: String(p.etag || "") })).filter(p => Number.isInteger(p.partNumber) && p.partNumber > 0 && p.etag);
      if (normalized.length !== parts.length || normalized.some((p, i) => p.partNumber !== i + 1)) return json({ ok: false, error: "Uploaded parts must be valid and sequential" }, 400);
      const object = await env.MEDIA.resumeMultipartUpload(key, uploadId).complete(normalized);
      await env.DB.prepare("INSERT INTO assets (id, job_id, kind, object_key, file_name, size_bytes, created_at) VALUES (?, ?, 'clip', ?, ?, ?, ?)")
        .bind(uuid(), jobId, key, fileName, Number(object.size || size), now()).run();
      return json({ ok: true, object_key: key, size_bytes: object.size || size });
    }

    if (action === "progress") {
      const jobId = String(body.job_id || "");
      const progress = Math.max(0, Math.min(99, Number(body.progress || 0)));
      const stage = String(body.stage || "processing").slice(0, 100);
      if (!jobId) return json({ ok: false, error: "job_id is required" }, 400);
      const update = await env.DB.prepare("UPDATE jobs SET progress=?, stage=?, updated_at=? WHERE id=? AND status='processing' AND claimed_by=?")
        .bind(progress, stage, timestamp, jobId, agentId).run();
      if (!update.meta?.changes) return json({ ok: false, error: "Job not found or no longer processing" }, 409);
      return json({ ok: true, progress, stage });
    }

    if (action === "complete" || action === "fail") {
      const jobId = String(body.job_id || "");
      if (!jobId) return json({ ok: false, error: "job_id is required" }, 400);
      if (action === "complete") {
        const clips = await env.DB.prepare("SELECT COUNT(*) AS total FROM assets WHERE job_id=? AND kind='clip'").bind(jobId).first();
        if (!Number(clips?.total || 0)) return json({ ok: false, error: "Cannot complete a job before at least one rendered clip is uploaded." }, 409);
      }
      const status = action === "complete" ? "completed" : "failed";
      const stage = status;
      const error = action === "fail" ? String(body.error || "Agent reported a processing failure").slice(0, 1000) : null;
      const update = await env.DB.prepare("UPDATE jobs SET status=?, progress=?, stage=?, error=?, updated_at=?, claimed_by=NULL WHERE id=? AND status='processing' AND claimed_by=?")
        .bind(status, status === "completed" ? 100 : 0, stage, error, timestamp, jobId, agentId).run();
      if (!update.meta?.changes) return json({ ok: false, error: "Job not found or no longer processing" }, 409);
      await env.DB.prepare("INSERT INTO job_events (job_id, level, message, created_at) VALUES (?, ?, ?, ?)")
        .bind(jobId, status === "completed" ? "info" : "error", status === "completed" ? "Agent marked job complete." : error, timestamp).run();
      return json({ ok: true, job_id: jobId, status });
    }

    return json({ ok: false, error: "Unknown agent action" }, 404);
  } catch (error) {
    return json({ ok: false, error: "Agent API operation failed", detail: error.message }, 500);
  }
}
