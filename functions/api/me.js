// GET /api/me  ->  info user + pengaturannya (buat isi halaman awal)
import { currentUser, json } from "../_lib.js";

export async function onRequestGet(context) {
  const u = await currentUser(context);
  if (!u) return json({ error: "Belum masuk" }, 401);
  return json({
    email: u.email,
    nama: u.nama || u.email,
    is_admin: !!u.is_admin,
    setup_ok: !!u.setup_ok,
    // secret TIDAK dikirim balik ke browser — cukup ditandai sudah terisi/belum
    webhook_url: u.webhook_url,
    sheet_id: u.sheet_id,
    has_secret: !!u.secret,
  });
}
