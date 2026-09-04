// POST /api/login  { email, pin }  ->  set cookie sesi
import { hashPin, makeToken, cookie, json } from "../_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return json({ error: "Data tidak valid" }, 400); }

  const email = String(body.email || "").trim().toLowerCase();
  const pin   = String(body.pin   || "").trim();
  if (!email || !pin) return json({ error: "Email dan PIN wajib diisi" }, 400);

  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  const hash = await hashPin(pin, env.PIN_SALT);

  // Pesan sengaja disamakan supaya tidak membocorkan email mana yang terdaftar.
  if (!user || user.pin_hash !== hash) {
    return json({ error: "Email atau PIN salah. Coba lagi, atau hubungi Eprom." }, 401);
  }

  const token = await makeToken(user.id, env.SESSION_SECRET);
  return json(
    { ok: true, nama: user.nama || email, is_admin: !!user.is_admin, setup_ok: !!user.setup_ok },
    200,
    { "Set-Cookie": cookie("sesi", token) }
  );
}
