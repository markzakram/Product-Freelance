# Dashboard Proyek Guru Freelance

Dashboard untuk mengelola proyek guru freelance, dibangun dengan **Next.js** dan siap **deploy ke Vercel**. Data dibaca **langsung (real-time) dari Google Sheets**.

Ada dua area:

| Area | URL | Untuk siapa | Isi |
|------|-----|-------------|-----|
| **Open Freelance** | `/open` | Guru freelance (link publik, boleh dibagikan) | Daftar proyek yang sedang buka + detail + tombol "Ambil via WhatsApp" |
| **Dashboard Internal** | `/admin` | Tim & HR/Akademik (terkunci password) | Ringkasan & progress, Rekap fee per bulan, Database guru |

Halaman depan (`/`) berisi dua pintu masuk tersebut.

---

## Sumber data (3 Google Sheets)

| Data | Spreadsheet | Dipakai di |
|------|-------------|-----------|
| Proyek buka bulan ini | **Project Juli** (`SHEET_ID_JULI`) | Open Freelance |
| Master proyek + log fee | **Proyek Guru Freelance** (`SHEET_ID_MASTER`) | Ringkasan & Database guru |
| Rekap fee per bulan | **Rekapitulasi Fee Freelance Produk** (`SHEET_ID_REKAP`) | Rekap Fee |

ID ketiga sheet sudah diisi default (lihat `.env.example`), jadi tidak perlu diubah kecuali Anda memakai file lain.

> **Sebelum kredensial dipasang**, dashboard otomatis menampilkan **data contoh** (nama guru sudah dianonimkan) supaya tetap bisa dilihat. Setelah kredensial dipasang, data berganti otomatis ke real-time.

---

## Cara deploy ke Vercel (langkah demi langkah)

### 1. Upload kode ke GitHub
1. Buat repository baru di GitHub (mis. `guru-freelance-dashboard`).
2. Upload seluruh isi folder ini (jangan sertakan `node_modules`).

### 2. Import ke Vercel
1. Buka [vercel.com](https://vercel.com) → **Add New… → Project** → pilih repo tadi.
2. Framework otomatis terdeteksi **Next.js**. Biarkan setelan default.
3. **Jangan klik Deploy dulu** — isi Environment Variables (langkah 3).

### 3. Isi Environment Variables
Di halaman import (atau **Project → Settings → Environment Variables**), tambahkan:

| Nama | Wajib | Isi |
|------|:---:|-----|
| `INTERNAL_PASSWORD` | ✅ | Password login area `/admin` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅* | Isi file JSON service account (satu baris) — **cara disarankan** |
| `GOOGLE_SHEETS_API_KEY` | ✅* | Alternatif service account (lihat Cara B) |
| `NEXT_PUBLIC_WA_NUMBER` | ⬜ | Nomor WhatsApp tim, format `62812xxxx` |
| `NEXT_PUBLIC_BRAND` | ⬜ | Nama brand (default `Cerebrum`) |
| `SHEET_ID_MASTER` / `SHEET_ID_REKAP` / `SHEET_ID_JULI` | ⬜ | Hanya jika ID sheet berbeda dari default |

\* Cukup pilih **salah satu**: `GOOGLE_SERVICE_ACCOUNT_JSON` **atau** `GOOGLE_SHEETS_API_KEY`.

### 4. Deploy
Klik **Deploy**. Setelah selesai Anda dapat:
- Bagikan `https://namaapp.vercel.app/open` ke guru.
- Buka `https://namaapp.vercel.app/admin` untuk tim (perlu password).

---

## Menyiapkan kredensial Google Sheets

### Cara A — Service Account (disarankan, works walau sheet privat)
1. Buka [Google Cloud Console](https://console.cloud.google.com/) → buat / pilih project.
2. **APIs & Services → Enable APIs** → aktifkan **Google Sheets API**.
3. **Credentials → Create Credentials → Service account** → buat.
4. Buka service account itu → tab **Keys → Add key → JSON** → unduh file JSON.
5. Buka file JSON, salin **seluruh isinya**, tempel sebagai nilai `GOOGLE_SERVICE_ACCOUNT_JSON`.
   - Boleh ditempel apa adanya (satu baris), atau versi **base64**-nya (keduanya didukung).
6. Di file JSON ada `client_email` (mis. `xxx@yyy.iam.gserviceaccount.com`).
   **Bagikan ketiga Google Sheet** ke email itu dengan akses **Viewer** (klik Share di tiap sheet).

### Cara B — API Key (hanya untuk sheet yang di-share "Anyone with link")
1. Google Cloud Console → aktifkan **Google Sheets API**.
2. **Credentials → Create Credentials → API key** → salin.
3. Tempel sebagai `GOOGLE_SHEETS_API_KEY`.
4. Setiap sheet harus di-set **Share → Anyone with the link → Viewer**.

> Karena API key = sheet harus bisa dibaca siapa saja yang punya link, **Cara A lebih aman** untuk data guru (berisi data pribadi).

---

## Menjalankan di komputer sendiri (opsional)

```bash
npm install
cp .env.example .env.local   # lalu isi nilainya
npm run dev                  # buka http://localhost:3000
```

Tanpa mengisi `.env.local`, aplikasi tetap jalan dengan data contoh.

---

## Catatan teknis

- **Refresh data**: halaman di-cache dan menyegarkan data dari Sheets tiap **5 menit** (`revalidate = 300`). Ubah di `app/open/page.js` & `app/admin/page.js` bila perlu.
- **Nama tab sheet dibaca fleksibel**: parser mencari tab "Detail/Detil proyek", "Master_Proyek", "Data guru freelance", dan tab rekap berpola `Live Class <Bulan>`, `Freelance Soal <Bulan>`, `Freelance Produk <Bulan>`. Bulan baru (mis. `Live Class Juli`) otomatis ikut terbaca — tidak perlu ubah kode.
- **Keamanan**: area `/admin` dilindungi password lewat cookie (12 jam) + `middleware.js`. Kredensial Google & password hanya dipakai di server, tidak pernah terekspos ke browser.
- **Zero dependency data layer**: koneksi Sheets memakai `fetch` + tanda tangan JWT bawaan Node, tanpa library berat.

## Struktur folder

```
app/
  page.js              Landing (2 pintu masuk)
  open/page.js         Open Freelance (publik)
  admin/page.js        Dashboard internal
  admin/login/page.js  Halaman login
  api/login, api/logout
components/             TopBar, OpenBoard, AdminDashboard, DataBanner
lib/
  sheets.js            Koneksi Google Sheets + fallback
  sampleData.json      Data contoh (nama dianonimkan)
  format.js, auth.js
middleware.js          Proteksi /admin
```
