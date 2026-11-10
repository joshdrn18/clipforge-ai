export async function onRequestGet({ env }) {
  let database = false;
  let storage = false;
  try { await env.DB.prepare("SELECT 1").first(); database = true; } catch {}
  try { storage = !!env.MEDIA; } catch {}
  return Response.json({
    ok: true,
    service: "ClipForge AI API",
    version: "0.1.0",
    database,
    storage,
    rendering: "external-agent-required",
    timestamp: new Date().toISOString()
  }, { headers: { "Cache-Control": "no-store" } });
}