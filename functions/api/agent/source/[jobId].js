const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

function authorized(request, env) {
  const expected = env.AGENT_SHARED_SECRET;
  return !!expected && request.headers.get("Authorization") === `Bearer ${expected}`;
}

export async function onRequestGet({ request, env, params }) {
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized agent" }, 401);
  if (!env.DB || !env.MEDIA) return json({ ok: false, error: "Storage unavailable" }, 503);
  try {
    const jobId = String(params.jobId || "");
    const job = await env.DB.prepare("SELECT source_key, source_name, source_size, status FROM jobs WHERE id=? AND status='processing'")
      .bind(jobId).first();
    if (!job?.source_key || !job.source_key.startsWith("sources/" + jobId + "/")) {
      return json({ ok: false, error: "Active job source not found" }, 404);
    }
    const object = await env.MEDIA.get(job.source_key);
    if (!object) return json({ ok: false, error: "Source object missing from storage" }, 404);
    const filename = String(job.source_name || "source.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
        "Content-Length": String(object.size),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return json({ ok: false, error: "Could not download source", detail: error.message }, 500);
  }
}
