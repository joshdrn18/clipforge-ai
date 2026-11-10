const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const id = () => crypto.randomUUID();

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 30)));
    const result = await env.DB.prepare(
      "SELECT id, source_name, source_size, duration_seconds, processing_mode, status, progress, stage, error, created_at, updated_at FROM jobs ORDER BY created_at DESC LIMIT ?"
    ).bind(limit).all();
    return json({ ok: true, jobs: result.results || [] });
  } catch (error) { return json({ ok: false, error: "Database unavailable", detail: error.message }, 503); }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const sourceName = String(body.source_name || "").trim().slice(0, 240);
    const mode = ["auto", "local", "cloud"].includes(body.processing_mode) ? body.processing_mode : "auto";
    const size = Math.max(0, Number(body.source_size || 0));
    const duration = Math.max(0, Number(body.duration_seconds || 0));
    if (!sourceName) return json({ ok: false, error: "source_name is required" }, 400);
    const jobId = id();
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO jobs (id, source_name, source_size, duration_seconds, processing_mode, status, progress, stage, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'queued', 0, 'waiting_for_agent', ?, ?, ?)"
    ).bind(jobId, sourceName, size, duration, mode, JSON.stringify(body.settings || {}), now, now).run();
    await env.DB.prepare(
      "INSERT INTO job_events (job_id, level, message, created_at) VALUES (?, 'info', 'Job created; waiting for a connected processing agent.', ?)"
    ).bind(jobId, now).run();
    return json({ ok: true, job: { id: jobId, source_name: sourceName, status: "queued", stage: "waiting_for_agent", processing_mode: mode, created_at: now } }, 201);
  } catch (error) { return json({ ok: false, error: "Could not create job", detail: error.message }, 500); }
}
