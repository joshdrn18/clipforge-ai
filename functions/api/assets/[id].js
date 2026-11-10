const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function onRequestGet({ env, params }) {
  if (!env.DB || !env.MEDIA) return json({ ok: false, error: "Storage unavailable" }, 503);
  try {
    const id = String(params.id || "");
    const asset = await env.DB.prepare("SELECT id, object_key, file_name, size_bytes FROM assets WHERE id=? AND kind='clip'").bind(id).first();
    if (!asset || !String(asset.object_key || "").startsWith("outputs/")) return json({ ok: false, error: "Clip not found" }, 404);
    const object = await env.MEDIA.get(asset.object_key);
    if (!object) return json({ ok: false, error: "Clip file is missing from storage" }, 404);
    const filename = String(asset.file_name || "clip.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "video/mp4",
        "Content-Length": String(object.size),
        "Content-Disposition": `inline; filename="${filename}"`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return json({ ok: false, error: "Could not stream clip", detail: error.message }, 500);
  }
}
