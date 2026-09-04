// POST /api/run  { source, keyword, location, country, limit, role }
// Bikin jobId, catat "running", tembak webhook n8n peserta, balas cepat.
import { currentUser, json } from "../_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const u = await currentUser(context);
  if (!u) return json({ error: "Belum masuk" }, 401);
  if (!u.webhook_url || !u.secret || !u.sheet_id)
    return json({ error: "Pengaturan belum lengkap. Buka menu Pengaturan dulu." }, 400);

  let b;
  try { b = await request.json(); } catch { return json({ error: "Data tidak valid" }, 400); }

  const source  = ["google_maps", "instagram", "linkedin"].includes(b.source) ? b.source : "google_maps";
  const keyword = String(b.keyword || "").trim();
  if (!keyword) return json({ error: "Kata kunci wajib diisi." }, 400);
  const location = String(b.location || "").trim();
  const country  = String(b.country || "ID").toUpperCase().slice(0, 2);
  const role     = String(b.role || "").trim();
  let lim = parseInt(b.limit, 10); if (!lim || lim < 1) lim = 25; lim = Math.min(50, lim);

  const jobId = crypto.randomUUID();
  const origin = new URL(request.url).origin;

  await env.DB.prepare(
    `INSERT INTO jobs (id, user_id, source, keyword, location, country, lim, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'running')`
  ).bind(jobId, u.id, source, keyword, location, country, lim).run();

  const payload = {
    jobId,
    callbackUrl: origin + "/api/callback",
    sheetId: u.sheet_id,
    source, keyword, location, country, limit: lim, role,
  };
  const auth = "Basic " + btoa("website:" + u.secret);

  try {
    const r = await fetch(u.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": auth },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error("status " + r.status);
  } catch (e) {
    await env.DB.prepare("UPDATE jobs SET status='error', error_msg=?, finished_at=datetime('now') WHERE id=?")
      .bind("Tidak bisa memulai pencarian: " + e.message, jobId).run();
    return json({ error: "Gagal menghubungi mesin. Cek pengaturan atau coba lagi." }, 502);
  }

  return json({ ok: true, jobId });
}
