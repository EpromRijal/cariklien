// POST /api/test  ->  cek koneksi ke n8n peserta (tombol "Cek Semua Sudah Benar")
// Menembak webhook dengan payload penanda; kita cuma peduli auth-nya lolos.
import { currentUser, json } from "../_lib.js";

export async function onRequestPost(context) {
  const { env } = context;
  const u = await currentUser(context);
  if (!u) return json({ error: "Belum masuk" }, 401);

  if (!u.webhook_url) return json({ ok: false, error: "Alamat mesin (n8n) belum diisi." }, 200);
  if (!u.secret)      return json({ ok: false, error: "Kunci rahasia belum diisi." }, 200);
  if (!u.sheet_id)    return json({ ok: false, error: "Alamat lembar data belum diisi." }, 200);

  const auth = "Basic " + btoa("website:" + u.secret);
  try {
    const r = await fetch(u.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": auth },
      body: JSON.stringify({ jobId: "cek-koneksi", keyword: "", ping: true }),
    });

    if (r.status === 401 || r.status === 403)
      return json({ ok: false, error: "Kunci rahasia di sini beda dengan yang di n8n." }, 200);
    if (r.status === 404)
      return json({ ok: false, error: "Mesin belum aktif di n8n. Nyalakan tombol Active dulu." }, 200);
    if (false)
      return json({ ok: false, error: "n8n membalas kode " + r.status + ". Coba cek lagi." }, 200);

    // Sampai sini: auth lolos, mesin hidup. Tandai setup selesai.
    await env.DB.prepare("UPDATE users SET setup_ok = 1 WHERE id = ?").bind(u.id).run();
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "Tidak bisa menghubungi mesin. Cek alamatnya sudah benar." }, 200);
  }
}
