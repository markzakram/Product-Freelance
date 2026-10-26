# Dashboard Proyek Guru Freelance

Dashboard untuk mengelola proyek guru freelance, dibangun dengan **Next.js** dan siap **deploy ke Vercel**. Data bersumber dari **Google Sheets**, dengan sinkronisasi berkala dan tombol Segarkan.

Ada dua area:

| Area | URL | Untuk siapa | Isi |
|------|-----|-------------|-----|
| **Open Freelance** | `/open` | Guru freelance (link publik, boleh dibagikan) | Daftar proyek yang sedang buka + detail + tombol "Ambil via WhatsApp" |
| **Dashboard Internal** | `/admin` | Tim & HR/Akademik (terkunci password) | Ringkasan & progress, Rekap fee per bulan, Database guru |

Halaman depan (`/`) berisi dua pintu masuk tersebut.

### Notifikasi CLO dan ringkasan log (v3.15.0)

- CLO/Seleksi dan Pemilik melihat lonceng **Hasil RAD** di header setiap halaman.
  Isinya hasil QC dan pemeriksaan progres yang belum dikabari pada bulan aktif.
  Contoh: **QC revisi 1 selesai → Revisi 2 diminta**. Klik hasil untuk membuka
  panel kanan pada pengambilan dan hasil pemeriksaan yang sama.
- Hasil baru menampilkan pemberitahuan saat sinkronisasi berikutnya (aplikasi
  mengecek tiap 60 detik, saat kembali aktif, atau melalui Segarkan). Daftar
  tetap tersedia setelah memuat ulang; membuka notifikasi tidak mencatat kabar.
  Setelah pesan dikirim, CLO memilih **Catat sudah dikabari**. Hasil revisi
  berikutnya memiliki status kabarnya sendiri. Ini notifikasi dalam aplikasi,
  tanpa pengiriman WhatsApp atau push di luar aplikasi secara otomatis.
- Kartu Log Pengambilan mengikuti filter tanggal, platform, guru, PIC, subtes,
  status, dan pencarian. Fee/soal/guru dihitung dari baris tampil tanpa Cancel;
  target dan sisa kuota berasal dari katalog proyek yang terkait dengan hasil
  filter. Sisa kuota tetap memperhitungkan pengambilan guru lain pada proyek itu.

### Gangguan spreadsheet dan sinkronisasi (v3.16.0)

Dashboard mempertahankan data terakhir saat refresh gagal, dengan banner
**Sinkronisasi tertunda**, nama bagian yang gagal, dan waktu sinkronisasi terakhir
dalam WIB. **Coba lagi** membaca ulang data; kegagalan tidak berarti tabel kosong.
Data contoh hanya tampil ketika aplikasi belum diberi kredensial.

Polling aktif sekitar 60 detik (v3.16.1), berhenti saat tab tersembunyi atau offline, lalu
melambat hingga 180 detik saat gagal. Kembali ke aplikasi < 15 detik setelah sinkron
terakhir tidak memicu sinkron baru. Pemicu fokus/visibility digabung. Hasil RAD
baru tetap muncul sebagai notifikasi setelah sinkronisasi berikutnya berhasil.

GET tampilan memakai **Data Cache Next.js** dengan umur per jenis data (v3.16.1):
katalog/log & Pengambilan Guru 30 detik, reachout 1 menit, master/lintas bulan/data guru/
pendaftaran & akun/panduan 5 menit, serta timestamp snapshot. Penyimpanan hanya
menghapus cache kelompok tab yang ditulis (`lib/grupCache.js`). Ketersediaan cache lintas instans mengikuti penyedia hosting (Vercel/Data
Cache); tidak perlu layanan Redis baru. Cache bukan penyimpanan permanen: pada
pembukaan pertama tanpa cache dan tanpa koneksi, aplikasi menampilkan keadaan gagal
memuat, bukan mengarang data. Cache tampilan diinvalidasi saat penyimpanan; validasi
transaksi tetap membaca langsung. Baca yang gagal karena jaringan/5xx dicoba ulang sampai 4 percobaan; 429 (kuota
menit itu habis) tidak dicoba ulang dan tampilan memakai data terakhir,
maksimum 6 detik per percobaan dan anggaran 22 detik per panggilan Google. Retry-After
yang melampaui anggaran dihormati dengan mengakhiri panggilan, bukan mencoba terlalu dini.
Log server `[sheets-read]` membantu membedakan `HTTP_429`, `HTTP_503`, `NETWORK`, dan
`TIMEOUT` tanpa mencatat kredensial atau isi sel, plus ringkasan per menit (jumlah
permintaan per tab dan yang ditolak kuota) untuk melihat sumber pembacaan terbesar. Keberhasilan tulis hanya mengikuti
respons server; append/struktur tidak diulang otomatis setelah koneksi terputus.

---

## Sumber data (3 Google Sheets)

| Data | Spreadsheet | Dipakai di |
|------|-------------|-----------|
| Proyek buka bulan ini | **Project Juli** (`SHEET_ID_JULI`) | Open Freelance |
| Master proyek + log fee | **Proyek Guru Freelance** (`SHEET_ID_MASTER`) | Ringkasan & Database guru |
| Rekap fee per bulan | **Rekapitulasi Fee Freelance Produk** (`SHEET_ID_REKAP`) | Rekap Fee |

ID ketiga sheet sudah diisi default (lihat `.env.example`), jadi tidak perlu diubah kecuali Anda memakai file lain.

> **Sebelum kredensial dipasang**, dashboard otomatis menampilkan **data contoh** (nama guru sudah dianonimkan) supaya tetap bisa dilihat. Setelah kredensial dipasang, data bersumber dari spreadsheet.

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
| `INTERNAL_PASSWORD` | ✅ | Password **pemilik** untuk `/admin` (masuk dengan email dikosongkan). Anggota tim seleksi/akademik masuk dengan akun masing-masing yang dibuat pemilik di menu **Akun tim** |
| `GURU_SESSION_SECRET` | ✅ | Rahasia acak ≥ 32 karakter untuk menandatangani sesi login guru (`/open`) **dan** anggota tim (`/admin`) |
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

- **Refresh data**: GET tampilan memakai Data Cache dengan umur per jenis data (`UMUR` di `lib/cacheTampilan.js`: 30 detik / 1 menit / 5 menit). Admin menyinkronkan data sekitar **60 detik** saat halaman aktif; saat gagal, interval bertambah. Tombol Segarkan dan pembacaan setelah penyimpanan melewati cache bagian itu saja.
- **Nama tab sheet dibaca fleksibel**: parser mencari tab "Detail/Detil proyek", "Master_Proyek", "Data guru freelance", dan tab rekap berpola `Live Class <Bulan>`, `Freelance Soal <Bulan>`, `Freelance Produk <Bulan>`. Bulan baru (mis. `Live Class Juli`) otomatis ikut terbaca — tidak perlu ubah kode.
- **Keamanan**: area `/admin` dilindungi password lewat cookie (12 jam) + `middleware.js`. Kredensial Google & password hanya dipakai di server, tidak pernah terekspos ke browser.
- **Zero dependency data layer**: koneksi Sheets memakai `fetch` + tanda tangan JWT bawaan Node, tanpa library berat.

## Ruang kerja RAD & CLO (v3.14.0)

- Semua akun tim membuka **Pengambilan Guru** setelah login — satu-satunya ruang
  kerja RAD & CLO. Urutan halaman: empat angka ringkas → **antrean tugas** tim →
  satu tabel semua pengambilan → produksi per subtes (dilipat).
  RAD: antrean QC ulang, QC hasil akhir, laporan progres 30%/50% baru, dan ACC.
  CLO: hasil RAD yang belum dikabari, reminder hari ini, dan tab **Butuh guru**
  (kuota terbuka + ringkasan tawaran) dengan **Cari guru**. Tombol utama (ACC,
  Sudah diperiksa, Sudah dikabari, Reminder dikirim) jalan langsung dari antrean;
  tolak/minta revisi/review membuka panel **Detail pengambilan** di kanan.
  Kuota pengajuan yang masih menunggu ACC diperhitungkan sebelum menawarkan
  pekerjaan kepada guru lain. Hitungan antrean, alur, status, dan tenggat ada di
  `lib/antreanPengambilan.js`.
- Analisis lintas bulan, Reachout, dan Corong rekrutmen tidak ada di menu RAD/CLO;
  ketiganya ada di halaman **Laporan & analisis** khusus Pemilik.
- Pemilik mengatur **RAD / CLO** pada **Akun tim → Peran**. Akun lama tetap
  didukung: **Akademik → RAD**, **Seleksi → CLO**. Untuk anggota lama dengan
  pekerjaan berbeda dari perannya sekarang, ubah perannya di Akun tim; tidak ada
  perubahan akun otomatis berdasarkan nama atau email. Satu anggota bisa
  memiliki kedua peran, dengan pilihan fokus tim di Pengambilan Guru.
- Dashboard menghitung kuota terisi dari katalog dan soal lolos QC dari jumlah
  disetujui pada review pengambilan, termasuk persetujuan parsial. Angka QC ini
  tidak menganggap pengumpulan 100% atau baris log manual tanpa review sebagai
  hasil yang sudah disetujui. Tabel memakai alur titik ACC → 30% → 50% → 100% → QC
  dan satu label status; kolom Kabar CLO menunjukkan status hasil terbaru tanpa
  perlu membuka panel.
- **Sudah dikabari** adalah konfirmasi manual untuk satu hasil pemeriksaan dan
  versi tertentu, sesudah pesan dikirim. Membuka draf/WhatsApp belum berarti
  mengirim. Revisi berikutnya memerlukan konfirmasi baru; nama petugas dan waktu
  WIB setiap kabar tetap ada dalam riwayat. Catatan WhatsApp lama yang tidak
  menyebut hasil/versi tertentu tidak diperlakukan sebagai bukti kabar hasil QC.
- Catatan tersimpan pada tab **Riwayat pengerjaan**, mengikuti penyimpanan jurnal
  sebelumnya. Pengingat dicatat per jadwal dan hari WIB. Jalankan `npm test`
  untuk pemeriksaan lingkup versi, penyimpanan, dan izin RAD/CLO.

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
