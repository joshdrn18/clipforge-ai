export async function onRequestGet({ env }) {
  try {
    const cutoff = new Date(Date.now() - 90_000).toISOString();
    await env.DB.prepare(
      "UPDATE processing_agents SET status='offline' WHERE status='online' AND (last_seen_at IS NULL OR last_seen_at < ?)"
    ).bind(cutoff).run();
    const result = await env.DB.prepare(
      "SELECT id, label, mode, status, capabilities_json, last_seen_at FROM processing_agents ORDER BY created_at DESC"
    ).all();
    return Response.json({ ok: true, agents: result.results || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: "Database unavailable", detail: error.message }, { status: 503 });
  }
}