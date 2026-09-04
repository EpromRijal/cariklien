// Endpoint admin — hanya untuk user dengan is_admin = 1 (Eprom).
//   GET  /api/admin            -> daftar semua peserta + status setup
//   POST /api/admin  {action}  -> add | resetpin | delete
import { currentUser, hashPin, json } from "../_lib.js";

async function requireAdmin(context) {
  const u = await currentUser(context);
  if (!u || !u.is_admin) return null;
  return u;
}

export async function onRequestGet(context) {
  const { env } = context;
  if (!(await requireAdmin(context))) return json({ error: "Khusus admin" }, 403);

  const { results } = await env.DB.prepare(
    "SELECT id, email, nama, is_admin, setup_ok, " +
    "(SELECT COUNT(*) FROM jobs WHERE jobs.user_id = users.id) AS total_cari, created_at " +
    "FROM users ORDER BY is_admin DESC, created_at DESC"
  ).all();
  return json({ users: results || [] });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await requireAdmin(context))) return json({ error: "Khusus admin" }, 403);

  let b;
  try { b = await request.json(); } catch { return json({ error: "Data tidak valid" }, 400); }
  const action = b.action;

  if (action === "add") {
    const email = String(b.email || "").trim().toLowerCase();
    const nama  = String(b.nama || "").trim();
    const pin   = String(b.pin || "").trim();
    if (!email || !pin) return json({ error: "Email dan PIN wajib." }, 400);
    if (pin.length < 4)  return json({ error: "PIN minimal 4 angka." }, 400);

    const exists = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (exists) return json({ error: "Email itu sudah terdaftar." }, 400);

    await env.DB.prepare(
      "INSERT INTO users (email, nama, pin_hash) VALUES (?, ?, ?)"
    ).bind(email, nama, await hashPin(pin, env.PIN_SALT)).run();
    return json({ ok: true });
  }

  if (action === "resetpin") {
    const id = parseInt(b.id, 10);
    const pin = String(b.pin || "").trim();
    if (!id || pin.length < 4) return json({ error: "PIN minimal 4 angka." }, 400);
    await env.DB.prepare("UPDATE users SET pin_hash = ? WHERE id = ?")
      .bind(await hashPin(pin, env.PIN_SALT), id).run();
    return json({ ok: true });
  }

  if (action === "delete") {
    const id = parseInt(b.id, 10);
    const me = await currentUser(context);
    if (id === me.id) return json({ error: "Tidak bisa menghapus diri sendiri." }, 400);
    await env.DB.prepare("DELETE FROM jobs WHERE user_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  return json({ error: "Aksi tidak dikenal" }, 400);
}
