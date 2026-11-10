const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const stamp = () => new Date().toISOString();

export async function onRequestPost({ request, env, params }) {
  if (!env.DB || !env.MEDIA) return json({ ok: false, error: "Database or media storage is unavailable." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "A JSON action is required." }, 400); }
  const action = String(body.action || "").toLowerCase();
  const jobId = String(params.id || "");
  if (!jobId || !["retry", "cancel", "delete"].includes(action)) return json({ ok: false, error: "Invalid job action." }, 400);

  try {
    const job = await env.DB.prepare("SELECT id, status, source_key, source_name FROM jobs WHERE id=?").bind(jobId).first();
    if (!job) return json({ ok: false, error: "Job not found." }, 404);
    const now = stamp();

    if (action === "cancel") {
      if (job.status !== "queued") return json({ ok: false, error: job.status === "processing" ? "This job is already processing and cannot be safely cancelled mid-render." : "Only queued jobs can be cancelled." }, 409);
      const result = await env.DB.prepare("UPDATE jobs SET status='cancelled', stage='cancelled_by_user', error=NULL, updated_at=? WHERE id=? AND status='queued'").bind(now, jobId).run();
      if (!result.meta?.changes) return json({ ok: false, error: "Job state changed. Refresh and try again." }, 409);
      await env.DB.prepare("INSERT INTO job_events (job_id, level, message, created_at) VALUES (?, 'warning', 'Job cancelled before processing started.', ?)").bind(jobId, now).run();
      return json({ ok: true, action, status: "cancelled" });
    }

    if (action === "retry") {
      if (job.status !== "failed") return json({ ok: false, error: "Only failed jobs can be retried." }, 409);
      if (!job.source_key || !job.source_key.startsWith("sources/" + jobId + "/")) return json({ ok: false, error: "The original source file is unavailable. Upload the video again as a new job." }, 409);
      const source = await env.MEDIA.head(job.source_key);
      if (!source) return json({ ok: false, error: "The original source file is missing from storage. Upload the video again as a new job." }, 409);
      const oldAssets = await env.DB.prepare("SELECT id, object_key FROM assets WHERE job_id=? AND kind='clip'").bind(jobId).all();
      const outputKeys = (oldAssets.results || []).map(a => a.object_key).filter(k => typeof k === "string" && k.startsWith("outputs/" + jobId + "/"));
      if (outputKeys.length) await env.MEDIA.delete(outputKeys);
      await env.DB.prepare("DELETE FROM assets WHERE job_id=? AND kind='clip'").bind(jobId).run();
      const result = await env.DB.prepare("UPDATE jobs SET status='queued', progress=0, stage='retry_queued', error=NULL, updated_at=? WHERE id=? AND status='failed'").bind(now, jobId).run();
      if (!result.meta?.changes) return json({ ok: false, error: "Job state changed. Refresh and try again." }, 409);
      await env.DB.prepare("INSERT INTO job_events (job_id, level, message, created_at) VALUES (?, 'info', 'Job manually retried. Existing partial clips were cleared.', ?)").bind(jobId, now).run();
      return json({ ok: true, action, status: "queued" });
    }

    if (!["failed", "cancelled"].includes(job.status)) return json({ ok: false, error: "Only failed or cancelled jobs can be deleted. Cancel queued jobs first." }, 409);
    const assets = await env.DB.prepare("SELECT object_key FROM assets WHERE job_id=?").bind(jobId).all();
    const keys = (assets.results || []).map(a => a.object_key).filter(k => typeof k === "string" && (k.startsWith("outputs/" + jobId + "/") || k.startsWith("sources/" + jobId + "/")));
    if (job.source_key && job.source_key.startsWith("sources/" + jobId + "/")) keys.push(job.source_key);
    if (keys.length) await env.MEDIA.delete([...new Set(keys)]);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM assets WHERE job_id=?").bind(jobId),
      env.DB.prepare("DELETE FROM job_events WHERE job_id=?").bind(jobId),
      env.DB.prepare("DELETE FROM jobs WHERE id=? AND status IN ('failed','cancelled')").bind(jobId)
    ]);
    return json({ ok: true, action, status: "deleted" });
  } catch (error) {
    return json({ ok: false, error: "Could not update job.", detail: error.message }, 500);
  }
}
