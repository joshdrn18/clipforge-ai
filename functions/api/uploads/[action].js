const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const safeName = (value) => String(value || "video").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "video";
const MAX_PART_BYTES = 32 * 1024 * 1024;

export async function onRequest({ request, env, params }) {
  if (!env.DB || !env.MEDIA) return json({ ok: false, error: "Storage or database binding is unavailable." }, 503);
  if (request.method !== "POST") return json({ ok: false, error: "POST required." }, 405);
  const action = String(params.action || "").toLowerCase();

  try {
    if (action === "init") {
      const body = await request.json();
      const jobId = String(body.job_id || "");
      const fileName = safeName(body.file_name);
      const size = Number(body.file_size || 0);
      if (!jobId || !Number.isSafeInteger(size) || size <= 0) return json({ ok: false, error: "Valid job_id and file_size are required." }, 400);
      const job = await env.DB.prepare("SELECT id, status FROM jobs WHERE id=?").bind(jobId).first();
      if (!job) return json({ ok: false, error: "Job not found." }, 404);
      const key = "sources/" + jobId + "/" + fileName;
      const upload = await env.MEDIA.createMultipartUpload(key, { httpMetadata: { contentType: String(body.content_type || "application/octet-stream") } });
      await env.DB.prepare("UPDATE jobs SET source_key=?, source_name=?, source_size=?, status='uploading', stage='uploading_source', updated_at=? WHERE id=?")
        .bind(key, fileName, size, new Date().toISOString(), jobId).run();
      return json({ ok: true, upload_id: upload.uploadId, key, part_size: MAX_PART_BYTES });
    }

    if (action === "part") {
      const url = new URL(request.url);
      const uploadId = url.searchParams.get("upload_id") || "";
      const key = url.searchParams.get("key") || "";
      const partNumber = Number(url.searchParams.get("part_number"));
      const length = Number(request.headers.get("Content-Length") || 0);
      if (!uploadId || !key.startsWith("sources/") || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) return json({ ok: false, error: "Invalid multipart upload parameters." }, 400);
      if (length > MAX_PART_BYTES) return json({ ok: false, error: "Part exceeds 32 MiB. Split the upload into smaller parts." }, 413);
      const upload = env.MEDIA.resumeMultipartUpload(key, uploadId);
      const result = await upload.uploadPart(partNumber, request.body);
      return json({ ok: true, part_number: partNumber, etag: result.etag });
    }

    if (action === "complete") {
      const body = await request.json();
      const jobId = String(body.job_id || "");
      const key = String(body.key || "");
      const uploadId = String(body.upload_id || "");
      const parts = Array.isArray(body.parts) ? body.parts : [];
      if (!jobId || !key.startsWith("sources/" + jobId + "/") || !uploadId || !parts.length) return json({ ok: false, error: "Invalid completion request." }, 400);
      const normalized = parts.map(p => ({ partNumber: Number(p.part_number), etag: String(p.etag || "") }))
        .filter(p => Number.isInteger(p.partNumber) && p.partNumber > 0 && p.etag);
      if (normalized.length !== parts.length) return json({ ok: false, error: "One or more uploaded parts are invalid." }, 400);
      const upload = env.MEDIA.resumeMultipartUpload(key, uploadId);
      const object = await upload.complete(normalized);
      const now = new Date().toISOString();
      const updated = await env.DB.prepare("UPDATE jobs SET status='queued', progress=0, stage='waiting_for_agent', updated_at=? WHERE id=? AND source_key=?")
        .bind(now, jobId, key).run();
      if (!updated.meta?.changes) return json({ ok: false, error: "Upload finished but the job record could not be updated." }, 409);
      await env.DB.prepare("INSERT INTO job_events (job_id, level, message, created_at) VALUES (?, 'info', ?, ?)")
        .bind(jobId, "Source uploaded successfully (" + object.size + " bytes). Waiting for a processing agent.", now).run();
      return json({ ok: true, job_id: jobId, source_size: object.size, status: "queued" });
    }

    if (action === "abort") {
      const body = await request.json();
      const key = String(body.key || "");
      const uploadId = String(body.upload_id || "");
      if (!key.startsWith("sources/") || !uploadId) return json({ ok: false, error: "Invalid abort request." }, 400);
      await env.MEDIA.resumeMultipartUpload(key, uploadId).abort();
      const jobId = key.split("/")[1] || "";
      if (jobId) {
        const now = new Date().toISOString();
        await env.DB.prepare("UPDATE jobs SET status='failed', stage='upload_aborted', error='Source upload was cancelled or interrupted.', updated_at=? WHERE id=? AND status='uploading'")
          .bind(now, jobId).run();
      }
      return json({ ok: true });
    }

    return json({ ok: false, error: "Unknown upload action." }, 404);
  } catch (error) {
    return json({ ok: false, error: "Upload operation failed.", detail: error.message }, 500);
  }
}
