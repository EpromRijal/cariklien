// POST /api/settings  { webhook_url, secret, sheet_url }  ->  simpan pengaturan n8n peserta
import { currentUser, extractSheetId, json } from "../_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const u = await currentUser(context);
  if (!u) return json({ error: "Belum masuk" }, 401);

  let b;
  try { b = await request.json(); } catch { return json({ error: "Data tidak valid" }, 400); }

  const webhook = String(b.webhook_url || "").trim();
  const secret  = String(b.secret || "").trim();
  const sheetId = extractSheetId(b.sheet_url);

  if (webhook && !/^https:\/\/.+\/webhook\/scraping-leads\/?$/.test(webhook)) {
    return json({ error: "Alamat mesin belum benar. Pastikan disalin dari Production URL di n8n." }, 400);
  }
  if (b.sheet_url && !sheetId) {
    return json({ error: "Alamat lembar data belum benar. Salin dari kotak alamat browser." }, 400);
  }

  // Field kosong tidak menimpa yang lama (mis. secret dibiarkan kosong = tetap yang lama).
  await env.DB.prepare(
    `UPDATE users SET
       webhook_url = COALESCE(NULLIF(?, ''), webhook_url),
       secret      = COALESCE(NULLIF(?, ''), secret),
       sheet_id    = COALESCE(NULLIF(?, ''), sheet_id)
     WHERE id = ?`
  ).bind(webhook, secret, sheetId, u.id).run();

  return json({ ok: true });
}
