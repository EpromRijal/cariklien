// GET /api/jobs           -> riwayat pencarian user (buat halaman Hasil)
// GET /api/jobs?id=xxx     -> satu job (buat polling status waktu "sedang mencari")
import { currentUser, json } from "../_lib.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const u = await currentUser(context);
  if (!u) return json({ error: "Belum masuk" }, 401);

  const id = new URL(request.url).searchParams.get("id");

  if (id) {
    const j = await env.DB.prepare("SELECT * FROM jobs WHERE id = ? AND user_id = ?")
      .bind(id, u.id).first();
    if (!j) return json({ error: "Tidak ditemukan" }, 404);
    return json(j);
  }

  const { results } = await env.DB.prepare(
    "SELECT id, source, keyword, location, status, count, total, sheet_url, error_msg, created_at " +
    "FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
  ).bind(u.id).all();

  return json({ jobs: results || [] });
}
