// ============================================================
// Fungsi bersama: hash PIN, sesi (cookie bertanda tangan), helper.
// Dipakai semua endpoint di /functions/api/.
// Hanya pakai Web Crypto API — tersedia native di Cloudflare, tanpa library.
// ============================================================

const enc = new TextEncoder();

// ---------- Hash ----------
async function sha256hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// PIN di-hash bareng garam per-instalasi (env.PIN_SALT) supaya kalau
// database bocor, PIN-nya tetap tidak kebaca.
export async function hashPin(pin, salt) {
  return sha256hex("pin:" + salt + ":" + String(pin));
}

// ---------- Sesi ----------
// Token = base64(payload) . base64(HMAC). Tidak perlu tabel sesi.
async function hmac(data, key) {
  const k = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function makeToken(userId, key) {
  const payload = btoa(JSON.stringify({ uid: userId, t: Date.now() }));
  return payload + "." + (await hmac(payload, key));
}

export async function readToken(token, key) {
  if (!token || token.indexOf(".") < 0) return null;
  const [payload, sig] = token.split(".");
  if ((await hmac(payload, key)) !== sig) return null;      // tanda tangan palsu
  try {
    const o = JSON.parse(atob(payload));
    if (Date.now() - o.t > 30 * 24 * 3600 * 1000) return null; // kedaluwarsa 30 hari
    return o.uid;
  } catch { return null; }
}

// ---------- Cookie ----------
export function cookie(name, value, days = 30) {
  const exp = new Date(Date.now() + days * 864e5).toUTCString();
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${exp}`;
}
export function readCookie(req, name) {
  const c = req.headers.get("Cookie") || "";
  const m = c.match(new RegExp("(?:^|; )" + name + "=([^;]+)"));
  return m ? m[1] : null;
}

// ---------- Ambil user yang login ----------
export async function currentUser(context) {
  const { request, env } = context;
  const tok = readCookie(request, "sesi");
  const uid = await readToken(tok, env.SESSION_SECRET);
  if (!uid) return null;
  return await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(uid).first();
}

// ---------- Balasan JSON ----------
export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

// ---------- Sheet ID dari URL penuh ATAU id telanjang ----------
// Pelajaran gladi bersih: jangan pernah minta peserta memotong sendiri.
export function extractSheetId(input) {
  const s = String(input || "").trim();
  const m = s.match(/\/d\/([a-zA-Z0-9-_]{20,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;  // sudah berupa id
  return "";
}
