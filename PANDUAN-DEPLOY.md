# Panduan Deploy — Tool CariKlien ke Cloudflare

Ini website tiga-halaman + backend yang dijalankan Cloudflare (Pages + Functions + D1).
Alurnya sama seperti biasa: **push ke GitHub → Cloudflare otomatis deploy**. Bedanya cuma
ada satu database (D1) yang perlu dibuat sekali.

Isi folder `website/`:

```
index.html          ← halaman (login, cari, hasil, admin) — semua di satu file
mesin.json          ← workflow n8n; tombol "Salin Mesin" ngambil dari sini
schema.sql          ← struktur database, dijalankan sekali
functions/
  _lib.js           ← fungsi bersama (hash PIN, sesi, dll)
  api/
    login.js  logout.js  me.js  settings.js
    run.js  callback.js  jobs.js  test.js  admin.js
```

---

## 0. Sebelum mulai — isi 1 baris

Buka `index.html`, cari baris `TEMPLATE_SHEET_COPY` (dekat awal `<script>`).
Ganti dengan link Google Sheet template kamu, **akhiri dengan `/copy`**:

```js
const TEMPLATE_SHEET_COPY = "https://docs.google.com/spreadsheets/d/1ksy.../copy";
```

Ini yang dibuka tombol "Buat Lembar Data Saya".

---

## 1. Push ke GitHub

Bikin repo baru (mis. `cariklien`), isi dengan folder `website/` ini.

```bash
cd website
git init
git add .
git commit -m "Tool CariKlien"
git branch -M main
git remote add origin https://github.com/USERNAME/cariklien.git
git push -u origin main
```

---

## 2. Bikin project Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Pilih repo `cariklien`
3. Build settings — **kosongkan semua** (ini situs statis + Functions, tidak perlu build):
   - Framework preset: **None**
   - Build command: *(kosong)*
   - Build output directory: `/`
4. **Save and Deploy**

Setelah deploy pertama, kamu dapat alamat `https://cariklien.pages.dev`. Belum jalan penuh — lanjut ke database.

---

## 3. Bikin database D1

Di dashboard → **Workers & Pages** → **D1 SQL Database** → **Create** → nama `cariklien-db`.

Buka tab **Console** database itu, tempel seluruh isi `schema.sql`, **Execute**.
Harusnya bikin 2 tabel: `users` dan `jobs`.

Lalu sambungkan database ke Pages:
Pages project `cariklien` → **Settings** → **Bindings** → **Add** → **D1 database**
- Variable name: **`DB`** (harus persis, huruf besar)
- D1 database: `cariklien-db`

---

## 4. Isi 2 rahasia (Environment Variables)

Pages project → **Settings** → **Variables and Secrets** → tambah dua ini
(tipe **Secret**), lalu **Encrypt**:

| Nama | Isi | Buat apa |
|---|---|---|
| `SESSION_SECRET` | teks acak panjang (≥30 karakter) | nandatangani cookie login |
| `PIN_SALT` | teks acak panjang lain | ngamanin PIN di database |

Bikin nilainya sekali, terserah — yang penting acak dan gak dipakai di tempat lain.
Kalau bingung, pakai ini sebagai contoh lalu ubah beberapa hurufnya:
`SESSION_SECRET` = `k9x2mp...` (ketik asal 40 karakter).

> ⚠️ Kalau `PIN_SALT` diganti setelah ada peserta, semua PIN lama jadi tidak cocok
> dan harus di-reset. Set sekali, jangan diutak-atik.

---

## 5. Deploy ulang & bikin admin

1. Pages → **Deployments** → **Retry deployment** (biar binding + variable kebaca)
2. Sekarang perlu bikin akun admin (kamu sendiri). Buka **Console D1** lagi, jalankan
   ini — ganti email dan hash-nya:

Karena PIN disimpan ter-hash, cara paling gampang bikin admin pertama:

**a.** Sementara, tambahkan diri sendiri sebagai user biasa lewat SQL dengan PIN hash.
Hash-nya harus dihitung pakai `PIN_SALT` kamu. Minta aku (Claude) hitungkan: kasih tahu
PIN yang kamu mau + nilai `PIN_SALT`, nanti aku kasih baris SQL-nya. Atau:

**b.** Cara tanpa hitung manual — buka Console D1, jalankan baris ini untuk menandai
user pertama sebagai admin **setelah** kamu daftar lewat website. Tapi halaman daftar
cuma ada di admin… jadi telur-ayam. Maka pakai cara (a) untuk admin pertama.

> Simpelnya: **bilang ke aku "buatkan SQL admin, PIN-ku 1234, PIN_SALT-ku xxx"** —
> aku balas satu baris INSERT siap tempel. Sekali ini saja; peserta berikutnya kamu
> tambah lewat halaman **Peserta** di website.

---

## 6. Coba

1. Buka `https://cariklien.pages.dev`
2. Masuk pakai email + PIN admin
3. Menu **Peserta** muncul → tambah 1 peserta uji
4. Keluar, masuk sebagai peserta itu, jalankan alur Pengaturan → Cari

---

## Kalau mau domain sendiri

Pages → **Custom domains** → **Set up a domain** → ketik domain kamu (mis.
`cariklien.com`). Cloudflare urus SSL-nya otomatis kalau domainnya sudah di Cloudflare.

---

## Ringkasan yang harus benar

- [ ] Binding D1 bernama persis **`DB`**
- [ ] `SESSION_SECRET` dan `PIN_SALT` terisi (Secret)
- [ ] `schema.sql` sudah dijalankan (2 tabel ada)
- [ ] `TEMPLATE_SHEET_COPY` di index.html sudah diganti
- [ ] Admin pertama dibuat lewat SQL (sekali)
- [ ] Deploy ulang setelah semua binding & variable dipasang

Kalau ada yang error, buka Pages → **Deployments** → klik deploy terakhir →
**Functions** → lihat log-nya, atau tempel errornya ke aku.
