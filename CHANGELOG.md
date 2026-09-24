# Changelog — Product Freelance

Format versi: **MAJOR.MINOR.PATCH**
- PATCH naik untuk perbaikan kecil (mis. 1.2.0 → 1.2.1)
- MINOR naik untuk fitur baru (mis. 1.2.0 → 1.3.0)
- MAJOR naik untuk perubahan besar yang mengubah cara kerja lama

Versi terpasang ditampilkan di **sidebar admin**, di samping logo.
Sumber versi: konstanta `APP_VERSION` di `lib/versi.js`.
Setiap update: naikkan `APP_VERSION`, tambahkan entri di atas, dan sebut versinya di
pesan commit — supaya versi di layar, di berkas ini, dan di riwayat git selalu sama.

---

## 1.0.0 — Rilis bernomor pertama (24 September 2026)

Titik awal pencatatan versi. Semua yang sudah berjalan di produksi dihitung sebagai 1.0.0.

### Tampilan versi & divisi

- Sidebar admin menampilkan **v1.0.0** di samping nama aplikasi dan **DIVISI PRODUK** di
  bawahnya, meniru ProductTrack — supaya jelas build mana yang sedang terpasang.

### Isi rilis ini

**Merek & desain**
- Merek baru **Product Freelance**; logo digambar ulang sebagai SVG (PNG aslinya bertepi
  magenta sisa hapus-latar).
- Admin memakai desain *A · Ruang Kerja*: sidebar alur kerja 1–5, form tambah/edit di
  panel samping, kotak pencarian dengan saran (kode, sisa kuota, sorotan huruf) sebagai
  pengganti `<datalist>`, tarif Normal/Terlambat sebagai pilihan tersegmen.
- Halaman guru (`/open`) bergaya Product Task Tracker: KPI berikon, kartu proyek ala kartu
  task, tombol terang/gelap.

**Data**
- ID master per jenis: **SOL** (Soal), **LAP** (Laporan FR), **LIV** (Liveclass),
  **EDI** (Editor). Mengganti jenis memindahkan semua tautan bulanan sekaligus.
- Status **Cancel** tidak dihitung — dipasang di rumus sheet (Fee 0, kuota kembali ke
  Sisa), bukan hanya disaring di dashboard.
- Sheet bulanan dikenali dari header baris 9, bukan nama tab.
- Subtes yang diarsipkan bisa dihapus permanen, dengan pengaman pemakaian lintas bulan.
- Kwitansi & "Guru aktif" tidak lagi menghitung baris cadangan 0 soal.

**Keamanan**
- Area admin **tertutup** bila `INTERNAL_PASSWORD` kosong di produksi (sebelumnya justru
  terbuka ke publik).
- `.gitignore` menutup semua pola nama berkas kunci service account.
- Dashboard memakai service account sendiri (`product-freelance@…`), terpisah dari kunci
  lama yang pernah bocor.

---

## Sebelum pencatatan versi

Ringkasan dari riwayat git, sebelum versi mulai dinomori.

| Tanggal | Perubahan |
|---|---|
| 6–7 Jul 2026 | Dashboard awal: katalog guru, keranjang WhatsApp, panduan + PDF, form pendataan, mode gelap |
| 15 Jul 2026 | Perbaikan cookie login |
| 24 Jul 2026 | Kunci service account yang ter-commit dihapus dari repo |
| 27–28 Jul 2026 | Master_Project, proyek bulan baru, analisis lintas bulan, CRUD guru, sidebar berkelompok, kode ID seragam |
| 29–31 Jul 2026 | Katalog mengambil dari master, harga rentang tentatif, konfirmasi arsip, pesan 403 yang jelas |
| 12–13 Agu 2026 | Tarif Normal/Terlambat per baris log, ID proyek & PIC bisa diketik dengan saran, sidebar urut alur kerja, hapus permanen subtes arsip |
| 23 Sep 2026 | Agustus & September kembali terbaca, ID per jenis, Cancel tidak dihitung, desain ulang A |
| 24 Sep 2026 | Admin tertutup tanpa password, halaman guru bergaya Task Tracker |
