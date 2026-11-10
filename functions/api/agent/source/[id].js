const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function onRequest({ request, env, params }) {
  const expected = env.AGENT_SHARED_SECRET;
  if (!expected || request.headers.get("Authorization") !== "Bearer " + expected) return json({ ok: false, error: "Unauthorized agent." }, 401);
  if (request.method !== "GET") return json({ ok: false, error: "GET required." }, 405);
  if (!env.DB || !env.MEDIA) return json({ ok: false, error: "Storage unavailable." }, 503);
  try {
    const jobId = String(params.id || "");
    const job = await env.DB.prepare("SELECT source_key, source_name FROM jobs WHERE id=?").bind(jobId).first();
    if (!job || !job.source_key) return json({ ok: false, error: "Source file not found for this job." }, 404);
    const object = await env.MEDIA.get(job.source_key);
    if (!object) return json({ ok: false, error: "Source object is missing from R2." }, 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Length", String(object.size));
    headers.set("Content-Disposition", 'attachment; filename="' + String(job.source_name || "source.mp4").replace(/["\\r\\n]/g, "_") + '"');
    headers.set("Cache-Control", "private, no-store");
    return new Response(object.body, { headers });
  } catch (error) {
    return json({ ok: false, error: "Could not read source object.", detail: error.message }, 500);
  }
}
