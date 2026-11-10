const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function onRequestGet({ request, env, params }) {
  if (!env.DB || !env.MEDIA) return json({ ok: false, error: "Storage unavailable" }, 503);
  try {
    const id = String(params.id || "");
    const asset = await env.DB.prepare("SELECT id, object_key, file_name, size_bytes FROM assets WHERE id=? AND kind='clip'").bind(id).first();
    if (!asset || !String(asset.object_key || "").startsWith("outputs/")) return json({ ok: false, error: "Clip not found" }, 404);
    const rangeHeader = request.headers.get("Range");
    let object;
    let status = 200;
    const headers = new Headers({
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${String(asset.file_name || "clip.mp4").replace(/[^a-zA-Z0-9._-]/g, "_")}"`
    });
    if (rangeHeader) {
      const match = /^bytes=(\\d*)-(\\d*)$/.exec(rangeHeader.trim());
      if (!match) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${asset.size_bytes}`, "Accept-Ranges": "bytes" } });
      const size = Number(asset.size_bytes || 0);
      let start = match[1] ? Number(match[1]) : null;
      let end = match[2] ? Number(match[2]) : null;
      if (start === null) {
        const suffix = end || 0;
        if (!suffix || !size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
        start = Math.max(0, size - suffix);
        end = size - 1;
      } else if (end === null || end >= size) end = size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" } });
      }
      object = await env.MEDIA.get(asset.object_key, { range: { offset: start, length: end - start + 1 } });
      if (!object) return json({ ok: false, error: "Clip file is missing from storage" }, 404);
      status = 206;
      headers.set("Content-Length", String(end - start + 1));
      headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    } else {
      object = await env.MEDIA.get(asset.object_key);
      if (!object) return json({ ok: false, error: "Clip file is missing from storage" }, 404);
      headers.set("Content-Length", String(object.size));
    }
    if (object.httpMetadata?.contentType) headers.set("Content-Type", object.httpMetadata.contentType);
    return new Response(object.body, { status, headers });
  } catch (error) {
    return json({ ok: false, error: "Could not stream clip", detail: error.message }, 500);
  }
}
