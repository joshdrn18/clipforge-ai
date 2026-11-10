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
  const body = request.method === "POST" ? await readBody(request) : {};
  if (request.method !== "POST" || !body) return json({ ok: false, error: "POST with a JSON body is required." }, 400);

  try {
    if (action === "register") {
      const agentId = String(body.agent_id || "").slice(0, 80);
      const label = String(body.label || "Local Agent").trim().slice(0, 100);
      const mode = body.mode === "cloud" ? "cloud" : "local";
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
      return json({ ok: true, status: "online", server_time: timestamp });
    }

    if (action === "claim") {
      if (body.pipeline_ready !== true) return json({ ok: true, job: null, reason: "pipeline_not_ready" });
      const result = await env.DB.prepare(`UPDATE jobs SET status='processing', stage='claimed_by_agent', updated_at=?
        WHERE id = (
          SELECT id FROM jobs WHERE status='queued'
          AND (processing_mode='auto' OR processing_mode=?)
          ORDER BY created_at ASC LIMIT 1
        ) AND status='queued' RETURNING id, source_name, source_size, duration_seconds, processing_mode, settings_json`)
        .bind(timestamp, agent.mode).first();
      if (!result) return json({ ok: true, job: null });
      await env.DB.prepare("INSERT INTO job_events (job_id, level, message, created_at) VALUES (?, 'info', ?, ?)")
        .bind(result.id, `Job claimed by ${agent.mode} agent ${agentId}.`, timestamp).run();
      return json({ ok: true, job: result });
    }

    if (action === "progress") {
      const jobId = String(body.job_id || "");
      const progress = Math.max(0, Math.min(99, Number(body.progress || 0)));
      const stage = String(body.stage || "processing").slice(0, 100);
      if (!jobId) return json({ ok: false, error: "job_id is required" }, 400);
      const update = await env.DB.prepare("UPDATE jobs SET progress=?, stage=?, updated_at=? WHERE id=? AND status='processing'")
        .bind(progress, stage, timestamp, jobId).run();
      if (!update.meta?.changes) return json({ ok: false, error: "Job not found or no longer processing" }, 409);
      return json({ ok: true, progress, stage });
    }

    if (action === "complete" || action === "fail") {
      const jobId = String(body.job_id || "");
      if (!jobId) return json({ ok: false, error: "job_id is required" }, 400);
      const status = action === "complete" ? "completed" : "failed";
      const stage = status;
      const error = action === "fail" ? String(body.error || "Agent reported a processing failure").slice(0, 1000) : null;
      const update = await env.DB.prepare("UPDATE jobs SET status=?, progress=?, stage=?, error=?, updated_at=? WHERE id=? AND status='processing'")
        .bind(status, status === "completed" ? 100 : 0, stage, error, timestamp, jobId).run();
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
