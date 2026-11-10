const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ ok: false, error: "Database unavailable" }, 503);
  try {
    const result = await env.DB.prepare(`
      SELECT a.id, a.job_id, a.kind, a.file_name, a.size_bytes, a.created_at,
             j.source_name, j.status AS job_status
      FROM assets a
      LEFT JOIN jobs j ON j.id = a.job_id
      WHERE a.kind = 'clip'
      ORDER BY a.created_at DESC
      LIMIT 100
    `).all();
    return json({ ok: true, assets: result.results || [] });
  } catch (error) {
    return json({ ok: false, error: "Could not load clip library", detail: error.message }, 503);
  }
}
