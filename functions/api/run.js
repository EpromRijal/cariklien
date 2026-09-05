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
  const country     = String(b.country || "ID").toUpperCase().slice(0, 2);
  const countryName = String(b.countryName || "").trim();   // dari peta 197 negara di website
  const language    = String(b.language || "").trim();
  const role        = String(b.role || "").trim();
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
    source, keyword, location, country, countryName, language, limit: lim, role,
  };
  const auth = "Basic " + btoa("website:" + u.secret);

  // n8n baru "menjawab" setelah scraping selesai (bisa 2-3 menit). Kita TIDAK
  // menunggu selama itu — cukup pastikan request masuk & kunci lolos, lalu lepas.
  // Hasil datang belakangan lewat /api/callback; browser polling yang menampilkannya.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);   // 12 detik cukup buat cek awal

  try {
    const r = await fetch(u.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": auth },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    // Cuma error yang benar-benar bikin gagal:
    if (r.status === 401 || r.status === 403) {
      await failJob(env, jobId, "Kunci rahasia beda dengan yang di n8n.");
      return json({ error: "Kunci rahasia beda dengan yang di n8n. Cek Pengaturan." }, 400);
    }
    if (r.status === 404) {
      await failJob(env, jobId, "Webhook belum aktif di n8n.");
      return json({ error: "Mesin belum aktif di n8n. Nyalakan tombol Active dulu." }, 400);
    }
    // status lain (200 / 500 / dll) = request masuk & kunci lolos → jalan.
    return json({ ok: true, jobId });
  } catch (e) {
    clearTimeout(timer);
    // Timeout = n8n nampung request tapi masih sibuk scraping. Itu normal, bukan gagal.
    if (e.name === "AbortError") return json({ ok: true, jobId });
    // Selain itu: beneran gak bisa dihubungi.
    await failJob(env, jobId, "Tidak bisa memulai: " + e.message);
    return json({ error: "Gagal menghubungi mesin. Cek alamat mesin di Pengaturan." }, 502);
  }
}

async function failJob(env, jobId, msg) {
  await env.DB.prepare("UPDATE jobs SET status='error', error_msg=?, finished_at=datetime('now') WHERE id=?")
    .bind(msg, jobId).run();
}
