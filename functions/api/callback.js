// POST /api/callback  ->  dipanggil oleh n8n peserta waktu scraping selesai.
// Endpoint ini TERBUKA (n8n memanggil tanpa cookie), jadi diamankan lewat
// keberadaan jobId yang masih 'running'. Tidak menulis apa pun ke Sheet —
// cuma memindahkan status job dari running -> done/error.
import { json } from "../_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  const jobId = String(b.jobId || "");
  if (!jobId) return json({ error: "jobId wajib" }, 400);

  // Cuma terima kalau job-nya memang ada DAN masih running.
  // Ini yang mencegah orang iseng menyuntik hasil palsu.
  const job = await env.DB.prepare("SELECT id, status FROM jobs WHERE id = ?").bind(jobId).first();
  if (!job) return json({ error: "job tidak dikenal" }, 404);
  if (job.status !== "running") return json({ ok: true, note: "sudah selesai sebelumnya" });

  const status = b.status === "error" ? "error" : "done";

  await env.DB.prepare(
    `UPDATE jobs SET
       status = ?, count = ?, total = ?, summary_text = ?, sheet_url = ?, error_msg = ?,
       finished_at = datetime('now')
     WHERE id = ?`
  ).bind(
    status,
    Number.isFinite(b.count) ? b.count : null,
    Number.isFinite(b.total) ? b.total : null,
    b.summaryText ? String(b.summaryText).slice(0, 2000) : null,
    b.sheetUrl ? String(b.sheetUrl).slice(0, 500) : null,
    b.message ? String(b.message).slice(0, 500) : null,
    jobId
  ).run();

  return json({ ok: true });
}
