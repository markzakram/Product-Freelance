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

## 3.0.0 — Akun tim & dua dashboard: Seleksi dan Akademik (2 Oktober 2026)

Perubahan besar: dashboard admin kini dipakai dua tim dengan akun masing-masing.

- **Akun per orang** (tab baru **Akun tim** di spreadsheet PROYEK GURU FREELANCE):
  email + password sendiri, dengan peran **Seleksi**, **Akademik**, dan/atau **Pemilik**.
  Password hanya disimpan sebagai hash; password sementara wajib diganti saat masuk
  pertama; 5× salah = terkunci 15 menit; akun nonaktif atau password yang di-reset
  langsung mengeluarkan sesi lama.
- **Login**: halaman masuk kini meminta email + password. **Pemilik** tetap bisa masuk
  dengan password internal lama (email dikosongkan) — tidak ada yang terkunci saat
  transisi.
- **Dua dashboard** dari satu alamat /admin — menu, menu bawah di HP, dan izin API
  mengikuti peran:
  - **Tim Seleksi**: Pendaftaran & akun, Corong rekrutmen, Database guru.
  - **Tim Akademik**: Master, Proyek bulan baru, Katalog, Log, Pembayaran, Ringkasan,
    Analisis, Pantau reachout, Database guru.
  - **Pemilik**: semua menu + halaman baru **Akun tim** (tambah anggota, ubah peran,
    reset password, nonaktifkan).
  Server menolak aksi di luar peran (mis. tim seleksi tidak bisa mengubah katalog/log,
  tim akademik tidak bisa memverifikasi pendaftar).
- **Tercatat atas nama orangnya**: kontak WA (kolom PIC di tab Reachout) diisi otomatis
  dari yang login — pilihan "Dicatat atas nama" manual dihapus; keputusan seleksi
  mendapat kolom baru **Oleh** di tab Seleksi guru; PIC QC sampel terisi otomatis.
- Sidebar menampilkan nama yang login, timnya, dan tautan **Ganti password**.
- Ketahanan: pembacaan & penulisan Google Sheets kini diulang otomatis saat Google
  membalas galat sementara (500/502/503) selain batas kuota (429); bila Sheets sedang
  sibuk, dashboard menampilkan "server sibuk" — bukan mengeluarkan anggota tim.
- Hemat kuota: daftar tab dibaca sekali untuk semua tab kecil, dan pemeriksaan sesi
  tim yang bersamaan berbagi satu pembacaan.
- Tim seleksi tidak lagi ikut memperbarui katalog/log tiap 45 detik (tidak dipakai),
  supaya kuota baca Sheets tidak terbuang.

## 2.7.0 — Corong rekrutmen & aktivasi (1 Oktober 2026)

- Menu baru **Pantauan → Corong rekrutmen**:
  - **Corong rekrutmen** (bisa disaring pendaftar 30 hari / 90 hari / semua):
    mendaftar → ditinjau → masuk Data guru → lolos sampel → punya akses → mengambil
    proyek, dengan jumlah dan **% dari tahap sebelumnya**, plus ringkasan sampel (berapa
    yang masuk tahap sampel, mengirim, lolos, dan median sesi QC sampai lolos).
  - **Corong aktivasi akun** (seluruh Data guru): punya email → akun dibuat → pernah
    login → sudah ganti password → mengambil proyek sejak punya akun.
  - Angka utama: jumlah pendaftar, % daftar → punya akses, **median lama daftar →
    akses** (hari), dan % akun yang pernah dipakai login.
  - **Pendaftar tertahan**: belum ditinjau > 3 hari, belum diputuskan > 3 hari, belum
    mengirim sampel / revisi > 5 hari, lolos sampel atau siap akses tapi belum diberi
    akses > 2 hari. Tombol **Tinjau / Putuskan / Beri akses** langsung membuka orang itu
    di Pendaftaran & akun (panel Tinjau terbuka otomatis); **Ingatkan sampel/revisi**
    lewat WA.
  - **Akun belum aktif dipakai**: terkunci, belum login > 3 hari setelah akun dibuat,
    login tapi belum ganti password, atau belum mengambil proyek 14 hari sejak punya
    akun — dengan tombol **Ingatkan login / Ingatkan / Ajak ambil proyek** dan **Reset
    password**.
  - Setiap baris menampilkan kapan terakhir orang itu dihubungi (dari tab Reachout).
    Pengingat WA menunda baris itu sampai batas harinya lewat lagi, jadi daftar tidak
    mendorong untuk mengirim pesan berulang.
- Tujuan kontak baru di tab Reachout: **Ingatkan aktivasi**.
- Guru yang sudah ada di Data guru sebelum alur seleksi dibuat tidak dihitung sebagai
  pendaftar tertahan — mereka masuk corong aktivasi ("belum punya akun").

## 2.6.0 — Pantau reachout (1 Oktober 2026)

- Menu baru **Pantauan → Pantau reachout** (per bulan, ikut pemilih bulan):
  - **Kuota terisi** bulan itu (soal terisi ÷ kebutuhan), **guru ditawari** dan berapa
    yang berakhir mengambil, **tingkat balasan**, dan jumlah yang **perlu tindak lanjut**.
  - **Tindak lanjut**: guru yang belum membalas ≥ 2 hari (tombol **Chat ulang** dengan
    pesan susulan), yang sudah 3× dihubungi tanpa balasan (sarankan **Tandai tak ada
    kabar**), yang **bersedia tapi belum mengambil** (tombol **Ingatkan ambil**), proyek
    yang semua calonnya menolak, dan ringkasan proyek yang belum ditawarkan sama sekali.
  - **Progres per proyek**: bar kuota + corong *ditawari → dibalas → bersedia →
    mengambil*, status (Terpenuhi / Kurang N soal / Perlu calon baru / Belum
    ditawarkan), daftar guru yang ditawari, dan tombol **Cari guru**.
  - **Aktivitas terbaru**: semua kontak WA dari dashboard, bisa disaring per tujuan.
- **Setiap tombol WhatsApp admin kini tercatat otomatis** di tab baru **Reachout**
  (spreadsheet PROYEK GURU FREELANCE, dibuat otomatis): Tawarkan via WA (Cari guru),
  Chat via WhatsApp di Tinjau, Minta sampel, Kirim hasil QC, Kirim akun (password TIDAK
  ikut dicatat), dan WhatsApp di profil guru. Hasilnya ditandai satu ketukan: Dibalas,
  Bersedia, Menolak, Tak ada kabar. **Mengambil** dihitung otomatis dari Log pengambilan.
- **Cari guru**: tanda "Ditawari" sekarang dari tab Reachout (sama di semua perangkat
  admin, bukan lagi hanya di browser ini), lengkap dengan status balasan dan kapan
  terakhir ditawari.
- Pilihan **Dicatat atas nama** (PIC) di halaman Pantau reachout — tersimpan di perangkat
  itu dan ikut tercatat di setiap kontak.
- Catatan: dashboard hanya tahu admin membuka WhatsApp, bukan apakah pesannya terkirim
  atau dibaca; karena itu balasan ditandai manual.

## 2.5.0 — Ketersediaan guru per keahlian (1 Oktober 2026)

- Di **Pendaftaran & akun** ada panel baru **Ketersediaan guru per keahlian**: saring
  per **bidang** (Matematika & Kuantitatif, Bahasa Inggris, Psikotes, …; angka di tiap
  chip = jumlah guru di Data guru), **jenjang** (D3–S1 / S2 / S3), atau ketik
  **jurusan / universitas** (mis. "matematika UPI").
- Untuk saringan itu langsung terlihat tiga angka:
  - **Siap mengerjakan** — sudah punya akses proyek;
  - **Di Data guru, belum diberi akses** — bisa diaktifkan saat itu juga lewat tombol
    **Beri akses ke N** (hanya guru yang tersaring; yang belum punya email ikut dihitung
    terpisah supaya dilengkapi dulu);
  - **Cadangan dari pendaftar** — pendaftar yang belum masuk Data guru dan tidak ditolak;
    tombol **Lihat N pendaftar** membuka daftar itu (chip baru **Cadangan**) untuk
    ditinjau dan diverifikasi.
- Saringan keahlian ikut berlaku di daftar Pendaftar dan Akun guru (termasuk angka di tab,
  chip status, dan tombol massal "Beri akses ke N guru (sesuai saringan)"). Saat saringan
  aktif, baris Akun guru menampilkan jenjang · jurusan · universitas di bawah nama.
- Guru yang belum mengisi bidang tidak ikut saringan bidang — jumlahnya ditampilkan agar
  bisa dicari lewat jurusan.

## 2.4.1 — Chat WA di panel Tinjau; nama dari pertanyaan kembar (28 September 2026)

- Panel **Tinjau** punya tombol **Chat via WhatsApp** (dengan sapaan awal siap dilanjutkan)
  dan tombol Email di bagian atas.
- Perbaikan: form pendaftaran punya pertanyaan kembar ("Nama Lengkap (beserta gelar)",
  "Jenis Kelamin", "Tanggal Lahir" di kolom E–G **dan** AD–AF, dari bagian form yang
  ditambahkan belakangan). Pendaftar yang hanya mengisi salinannya tampil "(tanpa nama)", dan
  verifikasi 1 akan menyalin nama kosong ke Data guru. Sekarang diambil isian pertama yang
  terisi dari semua kolom berjudul sama (1 nama, 3 jenis kelamin, 3 tanggal lahir terselamatkan).

---

## 2.4.0 — Dua verifikasi: masuk Data guru, lalu akses proyek (28 September 2026)

Verifikasi pendaftar kini dipecah dua. Sebelumnya satu tombol "Verifikasi & buat akun"
sekaligus memasukkan ke Data guru DAN memberi akses halaman proyek.

1. **Verifikasi 1 — Masuk Data guru**: jawaban form disalin ke "Data guru freelance" dengan
   ID guru baru. Calon sudah tercatat di sistem, tapi **belum** bisa membuka halaman proyek.
   Dilakukan dari panel Tinjau (atau langsung di kartu).
2. **Sampel** (guru baru saja): QC per sesi seperti di 2.3.0, sekarang SETELAH masuk Data
   guru. Guru lama langsung berstatus **Siap akses**.
3. **Verifikasi 2 — Akses proyek**: dibuatkan akun (email + password acak via WhatsApp).
   Untuk guru baru yang sampelnya belum lolos, admin harus mengonfirmasi dengan peringatan
   jelas; pendaftar yang ditolak tidak bisa diberi akses sama sekali; guru yang sudah punya
   akses diarahkan ke Reset password.

- Status pendaftar: Menunggu → Tinjau → Sampel → Lolos sampel / Siap akses → **Punya
  akses**, atau Ditolak. Tiap kartu menampilkan penanda langkah (Form · Data guru ·
  Sampel · Akses proyek).
- Tab Akun guru: tombol "Buat akun" kini bernama **Beri akses** (verifikasi 2 untuk guru yang
  sudah ada di Data guru).
- Pendaftar yang sudah sampai tahap sampel lewat alur 2.3.0 (sebelum masuk Data guru) tetap
  tampil di tahapnya dan mendapat tombol Verifikasi 1.

### Kuota Google Sheets

Batas Google 60 pembacaan per menit dipakai bersama admin, halaman guru, dan halaman depan.
Satu muat halaman admin sempat membaca Data guru, akun, dan seleksi berulang kali.

- Pembacaan yang terkena batas kuota (HTTP 429) diulang otomatis setelah 1, 2, lalu 4 detik.
- Cache singkat: Data guru & seleksi 10 detik, jawaban form 30 detik — permintaan yang
  datang bersamaan menunggu pembacaan yang sama. Cache dikosongkan setiap kali data itu
  ditulis, jadi setelah menyimpan data langsung terbaru.

---

## 2.3.0 — Tahap sampel, Profil guru, Profil saya, dan logo asli (28 September 2026)

### Seleksi pendaftar dengan tahap Sampel (admin → Pendaftaran & akun)

Panduan Proyek mewajibkan guru baru membuat sampel sebelum produksi penuh. Pendaftar kini
melewati: **Menunggu → Tinjau → Sampel → Lolos sampel → Verifikasi** (Ditolak bisa dari
tahap mana pun; bisa dibatalkan).

- **Tinjau**: semua jawaban form + berkas (CV, portofolio, video) dalam satu panel, rubrik
  1–5 (kesesuaian bidang, pendidikan & pengalaman, berkas) dan catatan. Keputusan: lanjut ke
  sampel, verifikasi langsung (disarankan hanya untuk "Guru Lama"), atau tolak.
- **QC sampel per sesi**: tiap sesi mencatat subtes, tautan sampel, PIC QC, **checklist 8
  aspek** dari Panduan (kesesuaian materi, bentuk soal, tingkat kesulitan, pilihan jawaban,
  kunci, pembahasan, template, karakter soal), hasil (Lolos / Perlu revisi / Tidak lolos)
  dan catatan. Hasil disarankan otomatis dari checklist. Revisi = sesi baru; riwayat semua
  sesi terlihat di kartu. "Lolos" → tahap Lolos sampel → tombol Verifikasi & buat akun.
- Tombol WA sesuai tahap: **Minta sampel** dan **Kirim hasil QC** (berisi hasil, aspek yang
  perlu diperbaiki, dan catatan).
- Status form (Guru Lama / Guru Baru) tampil di kartu; badge sidebar menghitung semua
  pendaftar yang masih dalam proses.
- Tab baru di spreadsheet (dibuat otomatis): **"Seleksi guru"** dan **"QC sampel"**.
  Penolakan kini dicatat di sini (dulu di tab Akun guru).

### Profil guru (admin)

- Klik nama guru di **Database guru** atau di tab Akun guru, atau "Lihat profil" pada
  pendaftar terverifikasi.
- Isi: kontak (tombol WA), status akun, total soal & fee, bulan aktif, soal yang sedang
  berjalan vs kapasitas, rekap status pekerjaan, **riwayat proyek semua bulan termasuk
  Juni–Agustus**, data form (bidang, minat, live class), rekening + bank, NPWP, NIK
  (tersamar, bisa ditampilkan), tautan KTP/CV/portofolio, hasil seleksi & sesi QC, riwayat
  perubahan data.

### Profil saya (guru yang login — menu akun → "Profil saya")

- **Riwayat & fee saya**: fee dan soal bulan terakhir, total semua bulan, daftar pekerjaan
  per bulan dengan statusnya.
- **Ubah data**: kapasitas, kesediaan & jadwal live class, bidang, dan minat **langsung
  tersimpan** (format sama persis dengan form, jadi "Cari guru" ikut memakainya). **WA,
  bank + rekening, pemilik rekening, NPWP menunggu persetujuan admin** — kalau akun guru
  dibobol, rekeningnya tidak bisa diganti diam-diam.
- Ajuan tampil di Database guru (kotak kuning, Setujui/Tolak) dan di Profil guru; badge di
  sidebar. Tab baru: **"Perubahan data guru"**.
- NIK, KTP, dan catatan admin tidak pernah dikirim ke halaman guru.

### Logo & halaman depan

- Logo memakai berkas **asli** dari folder `logo/`, dibersihkan otomatis dari sisa hapus
  latar (tepi magenta & bintik biru) dan dipaksa ke dua warna logo. Ikon aplikasi HP (guru &
  admin), ikon iPhone, dan favicon dibuat ulang dari logo ini (`public/icon.svg` dihapus).
- Halaman depan & halaman masuk: "guru freelance" → **"freelance"** (mis. "Program
  Freelance", "Daftar jadi freelance").

### Teknis

- `lib/tabSheet.js`: pembuat/pembaca tab kecil dashboard (dipakai Akun guru, Seleksi guru,
  QC sampel, Perubahan data guru). Nama tab bisa diarahkan ke tab uji hanya di luar
  produksi.
- Data guru kini membawa NIK, tautan KTP, CV, portofolio (area admin saja).

---

## 2.2.0 — Cari guru untuk proyek (28 September 2026)

Di **Katalog bulan ini**, setiap proyek yang masih punya sisa kuota kini punya tombol
**"Cari guru"**. Panel yang terbuka memakai jawaban form pendataan di Database guru untuk
menunjukkan siapa yang paling pas ditawari, lengkap dengan tombol **Tawarkan via WA**.

- **Bidang**: ditebak dari nama subtes, kategori Master, dan platform (mis. Fisika →
  IPA/Saintek, Matematika → Matematika & Kuantitatif, LPDP → Beasiswa & wawancara), lalu
  dicocokkan dengan kolom "Bidang materi yang dikuasai". Tebakan hanya pilihan awal — bidang
  bisa ditambah/dikurangi lewat chip. Istilah form memang beda dengan kategori Master
  ("Matematika & Kuantitatif" vs Numerik/Hitung Berhitung/…), jadi padanannya diatur di
  `lib/cocokGuru.js`.
- **Minat**: dicocokkan dengan "Jenis proyek yang ingin diambil" sesuai output proyek (soal &
  pembahasan, video, paket lengkap, live class, proyek lainnya). Proyek live class juga
  memakai kesediaan dan **jadwal** live class (filter per slot).
- **Beban**: soal yang masih berjalan (bukan Approved/Cancel) di log bulan ini; guru yang
  paling longgar tampil lebih dulu. Juga ditandai: pernah mengerjakan subtes yang sama,
  sudah mengambil proyek ini, guru baru (perlu sampel), kapasitas per minggu.
- **Tawarkan via WA**: pesan siap kirim berisi subtes, output, fee per soal, sisa kuota, dan
  tautan halaman proyek. Tombol berubah jadi "Ditawari" (tanda tersimpan di browser admin).
- Label "belum punya akun" hanya muncul bila halaman proyek sudah wajib login.
- 14 guru lama belum punya data bidang di form — bisa disertakan lewat centang "Sertakan guru
  tanpa data bidang".
- Data guru kini juga membawa kesediaan & jadwal live class (kolom S/T Database guru).

---

## 2.1.3 — Isian WA berisi beberapa nomor (28 September 2026)

- Sebagian pendaftar menulis lebih dari satu nomor di kolom WhatsApp, mis.
  "+66935396803/+6285867…". Dulu semua digitnya tergabung jadi satu nomor yang tidak ada,
  sehingga tombol **Kirim WhatsApp** (panel kredensial akun) dan kolom **NO TELEPON** di rekap
  fee salah. Sekarang dipakai **nomor pertama** (pemisah: / , ; baris baru, "atau").
- Nomor luar negeri di rekap ditulis dengan "+" (mis. +66935396803); nomor Indonesia tetap
  08….

---

## 2.1.2 — Judul rekap fee dipersingkat (28 September 2026)

- Judul rekap (Unduh Excel & Salin rekap) kini **"REKAP FEE PROYEK BULAN {BULAN} {TAHUN}"**,
  mis. "REKAP FEE PROYEK BULAN AGUSTUS 2026" — sebelumnya "REKAP FEE PROYEK SOAL DAN VIDEO
  PEMBAHASAN BULAN …", padahal proyeknya juga mencakup live class dan laporan.

---

## 2.1.1 — Perbaikan format saat "Salin rekap" ditempel (28 September 2026)

- Kolom **NO** tertempel sebagai "Rp1", "Rp2": sel NO ikut memakai format Rp milik FEE.
  Sekarang angka biasa.
- **JUMLAH** tertempel sebagai "1710000": nilainya angka tapi tanpa format. Sekarang
  berformat Rp dengan titik ribuan seperti kolom FEE (Rp1.710.000).
- Lebar kolom ikut disalin supaya nama, NIK, dan NPWP tidak terpotong (bila tab tujuan
  mempertahankan lebarnya sendiri: pilih kolom → *Ubah ukuran kolom → Sesuaikan dengan
  data*).
- File Excel (Unduh Excel) tidak terdampak — formatnya sudah benar sejak 2.1.0.

---

## 2.1.0 — Rekap fee: unduh Excel & salin ke Google Sheets (28 September 2026)

Di **Pembayaran & kwitansi** ada dua tombol baru yang menghasilkan rekap dengan format
"Rekapitulasi Fee Freelance Produk": judul *REKAP FEE PROYEK SOAL DAN VIDEO PEMBAHASAN
BULAN …*, kolom NO · NAMA GURU · FEE · NO TELEPON · NIK · FOTO KTP · NO REKENING · BANK ·
NPWP, dan baris JUMLAH.

- **Unduh Excel** — file `.xlsx` dengan tab "Freelance {Bulan}" (sama seperti nama tab di
  rekap), judul & kepala berwarna gelap, FEE berformat Rp, foto KTP sebagai tautan.
  Bisa diimpor ke Google Sheets lewat *File → Impor → Sisipkan sheet baru*.
- **Salin rekap** — tabel lengkap ke papan klip untuk ditempel (Ctrl+V) di sel A1 tab
  kosong Google Sheets.
- NIK, telepon, rekening, dan NPWP selalu **teks**: sebagai angka, "0856…" kehilangan nol di
  depan dan NIK 16 digit bisa berubah digit terakhirnya. Telepon dirapikan ke format 08….
- **Bank** dibaca dari isian rekening di Database guru: angka saja = BSI (form hanya
  menanyakan rekening BSI); bank lain ditulis bersama nomornya, mis. "BCA 2332597583".
  Kolom rekening di tabel pembayaran kini menampilkan banknya.
- Peringatan bila guru di log tidak cocok dengan Database guru, bank tidak dikenali, atau
  NIK belum ada. Filter yang aktif ikut berlaku; bila ada filter tanggal, periode ditulis di
  judul.
- Data guru di papan admin kini ikut membawa NIK, tautan foto KTP, dan NPWP (hanya di
  area admin).
- ExcelJS dimuat hanya saat tombol Unduh diklik, jadi dashboard tidak bertambah berat.
- Isian nomor rekening di form guru tidak lagi memaksa papan ketik angka di HP (supaya nama
  bank bisa diketik).

---

## 2.0.1 — Sisa kuota ikut berkurang saat guru mengambil (28 September 2026)

- Di kartu proyek halaman guru, **Sisa kuota** kini dikurangi jumlah yang sedang diambil
  guru itu (mis. 60/150 → ambil 20 → 40/150), dengan bagian yang diambil tampil bergaris
  ungu di bilah kuota dan baris "Kamu ambil −20 soal". Diambil semua → "SEMUA KAMU AMBIL".
- Angka "soal masih tersedia" di atas ikut berkurang.
- Ini hanya tampilan di layar guru tersebut — spreadsheet baru berubah setelah admin
  mencatat pengajuannya di Log. Urutan "Sisa terbanyak" tetap memakai sisa asli supaya
  kartu tidak melompat-lompat saat jumlahnya diubah.
- Perbaikan: tombol "Maks" di HP tidak lagi terjepit selebar tombol +/−.

---

## 2.0.0 — Halaman depan, pendaftaran & login guru (26 September 2026)

MAJOR karena cara guru masuk berubah: halaman proyek kini bisa dikunci dengan akun
pribadi, dan alamat utama (`/`) bukan lagi langsung ke halaman proyek.

### Halaman depan (`/`)

- Pengenalan program guru freelance PT Cerebrum Edukanesia Nusantara (ringkasan dari
  cerebrumcorp.id): angka perusahaan, jenis proyek (soal & pembahasan, video pembahasan,
  live class, report FR & editor), alasan bergabung, empat langkah bergabung, berkas yang
  perlu disiapkan, alur pengerjaan dari Panduan Proyek, dan FAQ.
- Tombol **Daftar** menuju Google Form pendaftaran; **Masuk** untuk guru terverifikasi.
- Papan "Proyek bulan ini" menampilkan jumlah proyek terbuka & soal tersedia langsung dari
  sheet (disegarkan tiap 5 menit). Detail & harga proyek tetap hanya untuk guru yang login.

### Pendaftaran & akun (admin → Data pendukung → Pendaftaran & akun)

- Membaca jawaban form "Pendataan Guru Freelance PT.Cerebrum" (spreadsheet terpisah, hanya
  dibaca). Status tiap pendaftar: Menunggu / Terverifikasi / Ditolak; satu kartu per email
  (jawaban terbaru), lengkap dengan tautan CV, portofolio, dan video.
- **Verifikasi & buat akun**: jawaban disalin ke "Data guru freelance" dengan ID guru baru
  (kolom dicocokkan lewat judul; NIK, WA, rekening, NPWP ditulis sebagai teks), lalu akun
  dibuat. **Tolak** bisa dibatalkan.
- **Akun guru**: buat akun satuan atau sekaligus untuk semua guru ber-email, reset password,
  nonaktifkan/aktifkan. Status: belum punya akun, tanpa email, belum ganti password, aktif,
  terkunci, nonaktif.
- Password sementara = 10 karakter acak (tanpa huruf yang mudah tertukar), tampil **sekali**
  di panel kredensial dengan tombol "Kirim WhatsApp" berisi pesan siap kirim.
- Saklar **Wajibkan login** untuk halaman proyek. Bawaannya terbuka (masa peralihan): akun
  guru lama disiapkan dulu, baru dikunci.
- Badge jumlah pendaftar baru di sidebar, titik merah di menu "Lainnya" (HP).

### Login guru (`/open/masuk`)

- Email + password; wajib membuat password sendiri saat pertama masuk dan setelah reset.
- Password disimpan sebagai **hash scrypt bergaram** di tab baru **"Akun guru"** — tidak ada
  password asli di spreadsheet. Pengaturan disimpan di tab **"Pengaturan"**. Keduanya
  dibuat otomatis.
- Sesi = cookie bertanda tangan HMAC (30 hari). Reset atau ganti password langsung
  mematikan sesi lama di semua perangkat; akun nonaktif langsung keluar.
- 5 kali salah → akun terkunci 15 menit. Pesan salah sama untuk email terdaftar maupun
  tidak (tidak membocorkan siapa yang terdaftar).
- Menu akun di header (ganti password, keluar); nama & WA terisi otomatis di pengajuan.
- Admin yang sedang login tetap bisa membuka halaman guru tanpa akun guru.

### Keamanan

- Next.js 14.2.5 → **14.2.35**: menutup celah "authorization bypass" di middleware.
- Setiap route API admin & halaman admin kini memeriksa sesi sendiri, tidak hanya lewat
  middleware.
- Env var baru **`GURU_SESSION_SECRET`** (acak, ≥32 karakter). Tanpa itu login guru tidak
  aktif dan saklar "Wajibkan login" tidak bisa dinyalakan.
- Keluar dari admin kini kembali ke halaman login admin, bukan ke halaman depan.

---

## 1.3.0 — Aplikasi HP: bisa dipasang ke layar utama (24 September 2026)

Halaman guru dan dashboard admin kini bisa **dipasang di HP seperti aplikasi** (PWA):
ikon sendiri di layar utama, terbuka layar penuh tanpa bilah alamat. Tidak lewat Play
Store/App Store — satu kode yang sama, jadi tiap push ke master otomatis ter-update di HP.

### Dua aplikasi terpisah

- **Proyek Guru** (ikon putih, dari `/open`) dan **PF Admin** (ikon indigo, dari
  `/admin`) punya manifest sendiri, jadi bisa sama-sama terpasang di satu HP tanpa
  tertukar.
- Android/Chrome: tombol **Pasang** memakai tawaran pasang bawaan browser. iPhone: tombol
  yang sama membuka petunjuk "Bagikan → Tambah ke Layar Utama" (Safari tidak punya tombol
  pasang otomatis).
- Halaman guru di HP menampilkan kartu ajakan "Pasang Proyek Guru di HP" yang bisa
  ditutup. Admin: menu **Pasang aplikasi** di sidebar / "Lainnya".
- Tombol pasang tidak tampil bila aplikasi sudah terpasang atau browser tidak mendukung.

### Tampilan admin di HP

- Sidebar diganti **menu bawah**: Ringkasan · Katalog · Log · Bayar · **Lainnya**.
  Master & Proyek bulan baru (sebulan sekali, biasanya di laptop) ada di Lainnya, yang
  muncul sebagai lembar dari bawah.
- Pemilih bulan pindah ke bilah atas, hanya di halaman yang memang per bulan.
- Tombol tambah (log, proyek, subtes, guru) jadi **tombol mengambang** di atas menu bawah.
- **Tabel jadi kartu**: Log (guru, status, fee sekilas), Katalog, dan Master punya kartu
  rancangan khusus; tabel lain berubah jadi kartu berlabel.
- Form tambah/edit layar penuh; konfirmasi jadi lembar dari bawah; angka ringkasan dua
  kolom; chip status bisa digeser ke samping.
- Isian 16px di layar sentuh supaya iPhone tidak memperbesar halaman saat mengetik.

### Perilaku aplikasi

- **Tidak ada data yang disimpan di HP.** Service worker (`public/sw.js`) hanya
  menampilkan halaman "Tidak ada koneksi" saat offline; katalog, sisa kuota, dan fee selalu
  diambil langsung dari spreadsheet — angka basi bisa membuat proyek yang sudah habis tetap
  diajukan.
- Aplikasi yang dibuka lagi setelah >1 menit di latar belakang mengambil ulang sisa kuota
  (halaman guru) atau menyegarkan papan (admin).
- Warna bilah status HP mengikuti tema terang/gelap yang dipilih di aplikasi.
- Jarak aman untuk notch & garis beranda iPhone di bilah atas, menu bawah, dan bilah
  pengajuan guru.

### Teknis

- Favicon pindah dari `app/icon.svg` ke `public/icon.svg` + metadata: ikon berbasis berkas
  menimpa ikon iPhone (apple-touch-icon) yang diset di layout guru/admin.
- Tampilan desktop tidak berubah.

---

## 1.2.0 — Slicer saat memilih subtes dari master (24 September 2026)

Saat menambah proyek ke **Katalog bulan ini**, subtes dulu dipilih dari satu kotak
pencarian — admin harus menebak kata kuncinya. Sekarang pemilihnya dilengkapi slicer.

### Pemilih subtes baru (`components/MasterPicker.jsx`)

- **Slicer Jenis / Kategori / Platform** dengan jumlah di tiap chip. Jumlahnya dihitung
  terhadap slicer lain yang aktif (seperti slicer Excel), jadi chip yang tak akan
  menghasilkan apa-apa ikut hilang dan admin tidak buntu.
- **Daftar hasil selalu tampil** (bukan dropdown tersembunyi): kode, nama, jenis ·
  kategori · platform, dan harga — nama yang mirip bisa dibandingkan sebelum memilih.
- Pencarian menyorot huruf yang cocok; "Hapus filter" mengembalikan semuanya.
- **Termasuk arsip**: subtes bulan-bulan lalu (diarsipkan di 1.1.0) tetap bisa dipakai
  lagi. Subtes itu **diaktifkan kembali** di master — setelah proyeknya tersimpan,
  supaya gagal mengaktifkan tidak menggagalkan proyek.
- Panel samping melebar saat memilih, lalu kembali normal setelah subtes dipilih.

### Juga di Proyek bulan baru

- Pemilih yang sama menggantikan kotak pencarian lama; subtes yang sudah masuk daftar
  anggaran diberi tanda "sudah ditambahkan".

---

## 1.1.0 — Dashboard dimulai dari September (24 September 2026)

Revisi dari manajer: data dibersihkan, master hanya berisi yang relevan, katalog
September dilengkapi. "Dibersihkan" dijalankan sebagai **menyembunyikan & mengarsipkan**,
bukan menghapus — Juni–Agustus memuat Rp23.319.000 fee yang sudah dibayar.

### Juni–Agustus disembunyikan

- Pemilih bulan, Analisis, halaman guru, saran PIC, dan fee per guru kini hanya memakai
  **September** (daftar di `BULAN_DISEMBUNYIKAN`, `lib/juli.js`).
- Sheet Juni–Agustus **tetap utuh** di spreadsheet sebagai arsip pembayaran.
- Yang disaring hanya tampilan. Pengaman hapus master dan ganti jenis tetap memindai
  semua bulan — kalau tidak, subtes yang hanya dipakai bulan lama bisa terhapus dan
  tautan arsipnya putus.
- "Proyek bulan baru" tetap tahu Juni–Agustus sudah ada, jadi tidak menawarkan membuatnya
  ulang.

### Master diarsipkan (perubahan data, langsung di spreadsheet)

- 86 subtes yang tidak dipakai September diarsipkan; **15 tetap aktif** (Soal 12,
  Liveclass 2, Laporan FR 1). Hanya kolom Status yang berubah — ID, nama, harga, dan
  tautan bulan lama utuh. Subtes arsip bisa diaktifkan lagi dari Master subtes.
- ID tetap mengikuti 4 jenis proyek (SOL / LAP / LIV / EDI) seperti di 1.0.0.

### Tidak berubah

- Katalog September (17 baris, 33 log, Rp8.050.000) dipertahankan untuk dilengkapi.
- Kolom Kategori materi (Figural, Verbal, …) tetap.

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
