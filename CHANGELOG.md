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

## 3.16.2 — Batas revisi tidak melewati deadline proyek (29 Oktober 2026)

- Batas kirim revisi hasil akhir kini **3 hari sejak review atau akhir hari deadline
  proyek (23.59 WIB), mana yang lebih dulu**. Deadline dibaca dari Aturan proyek terbaru
  (bila diubah setelah ACC), dengan salinan saat ACC sebagai cadangan.
- Bila review dilakukan setelah/menjelang deadline sehingga sisa waktunya kurang dari
  24 jam, guru tetap diberi **minimal 24 jam** (tidak langsung terhitung telat 75%).
- Form review RAD menampilkan pratinjau **Batas kirim revisi** begitu ada soal revisi,
  lengkap dengan alasannya (3 hari / mengikuti deadline / minimal 24 jam).
- Pesan WA revisi tidak lagi menulis "(3 hari)"; panduan alur guru menjelaskan aturan baru.
- Revisi yang sudah berjalan sebelum versi ini (batas yang sudah dikabarkan) tidak diubah.

## 3.16.1 — Hemat kuota baca Google Sheets (26 Oktober 2026)

Google membatasi **60 pembacaan per menit** untuk satu service account, dipakai bersama
seluruh tim, halaman guru, dan pengecekan akun. Versi ini mengurangi pembacaan:

- **Umur cache per jenis data**: master subtes, data lintas bulan, database guru,
  pendaftaran & akun, dan panduan 5 menit; katalog/log dan Pengambilan Guru 30 detik;
  reachout 1 menit. Simpan lewat dashboard tetap langsung terlihat; umur cache hanya
  memengaruhi perubahan yang diketik langsung di spreadsheet.
- **Invalidasi per kelompok tab**: penyimpanan hanya menghapus cache tab yang ditulis
  (mis. mencatat klik WA hanya menyegarkan Reachout), bukan seluruh cache. Perubahan
  struktur atau tab yang tidak dikenali tetap menghapus semua. **Segarkan** hanya
  membaca ulang bagian yang diminta.
- **Pendaftaran & akun** (6–7 pembacaan, dibaca tiap dashboard dibuka) kini lewat cache.
- **Halaman guru**: panduan (sebelumnya 2 pembacaan tiap kunjungan), data guru,
  pengambilan, dan aturan proyek memakai cache bersama.
- **Pengecekan akun** tim & guru disimpan 2 menit per server (sebelumnya 20–30 detik).
  Akun yang tidak cocok di cache dibaca ulang sekali sebelum sesi ditolak (maks. sekali
  per menit per email), jadi akun/sandi baru langsung bisa dipakai. Penonaktifan dari
  dashboard berlaku paling lambat 2 menit di server lain.
- **Kuota penuh (429) tidak dicoba ulang** dalam hitungan detik; tampilan memakai data
  terakhir yang berhasil dibaca (banner Sinkronisasi tertunda) dan mencoba lagi pada
  sinkron berikutnya. Gangguan jaringan / 5xx tetap dicoba ulang.
- **Sinkron berkala 60 detik** (sebelumnya 45). Reachout tidak ikut setiap sinkron —
  dibaca saat Katalog, tab Butuh guru, atau Laporan reachout/corong dibuka. Kembali ke
  aplikasi tidak memicu sinkron bila sinkron terakhir < 15 detik lalu.
- Log Vercel `[sheets-read]` kini menulis **ringkasan per menit** per server: jumlah
  permintaan ke Google per bagian/tab dan berapa yang ditolak kuota.

## 3.16.0 — Pembacaan spreadsheet & sinkronisasi tahan gangguan (26 Oktober 2026)

- Refresh yang gagal mempertahankan katalog, log, Pengambilan Guru, panel detail,
  reachout, dan data pendukung terakhir yang berhasil dibaca. Banner **Sinkronisasi
  tertunda** menampilkan bagian yang gagal, waktu berhasil terakhir (WIB), dan tombol
  **Coba lagi**; keberhasilan bagian lain tidak menghapus peringatan yang belum pulih.
- Koneksi produksi yang gagal tidak lagi diganti data contoh. Bulan dengan data
  kosong tetap dianggap bulan live yang sah. Data contoh hanya untuk konfigurasi
  tanpa kredensial. Gagal berpindah bulan tetap menampilkan nama bulan data yang ada.
- Satu penjadwal refresh menggantikan dua interval. Polling berhenti ketika tab
  tersembunyi/offline, menggabungkan focus + visibility, tidak bertumpuk, dan
  memperpanjang interval saat gagal (45 → 90 → 180 detik, ditambah jeda acak).
  Data pendukung yang gagal ikut dicoba ulang; tombol Segarkan tetap tersedia.
- Pembacaan Google/OAuth memakai batas waktu, retry bertahap dengan jeda acak,
  dan Retry-After untuk gangguan jaringan, 429, serta 5xx sementara. HTTP 400/401/403/404
  tidak diulang oleh transport. Log `[sheets-read]` berisi jenis operasi, kode error,
  percobaan dan durasi, tanpa URL, token, kredensial atau isi spreadsheet.
- Pembacaan range yang bersamaan digabung melalui batchGet dan permintaan identik
  memakai pembacaan yang sama. Data Cache Next.js menyimpan hasil GET tampilan
  selama 15 detik dengan waktu snapshot, dipisahkan per sumber/bulan. Cache tampilan
  diinvalidasi saat menulis; refresh setelah simpan melewati cache dan menunggu
  pembacaan sebelumnya selesai. Snapshot lama tidak menimpa data yang lebih baru.
- Cache tampilan tidak dipakai untuk validasi ACC, QC, atau kuota. Izin pengguna
  diperiksa di luar cache. Operasi append/struktur tetap tidak dicoba ulang otomatis
  agar hasil yang sebenarnya sudah tersimpan tidak tercatat dua kali.
- Pemeriksaan izin menulis membedakan gangguan koneksi dari akses Viewer;
  respons gangguan tidak lagi disimpan sebagai hasil pemeriksaan izin.

## 3.15.0 — Notifikasi hasil RAD untuk CLO & ringkasan log dinamis (26 Oktober 2026)

- Lonceng **Hasil RAD** tersedia di setiap halaman admin untuk CLO, Seleksi, dan
  Pemilik. Daftar berisi hasil QC/pemeriksaan progres yang masih perlu dikabari
  pada bulan aktif, lengkap nama guru, proyek, waktu, dan pemeriksa.
- Nomor kiriman yang diperiksa dibedakan dari revisi yang diminta: misalnya
  **QC revisi 1 selesai** dengan hasil **Revisi 2 diminta**. Hasil baru yang
  terdeteksi melalui sinkronisasi memunculkan pemberitahuan yang bisa diklik.
- Klik notifikasi membuka **Detail pengambilan** di kanan, langsung ke Kabar ke
  guru dan hasil yang dituju. Membuka notifikasi/draf tidak menandai sudah dikabari;
  konfirmasi CLO tetap dicatat per hasil. Kiriman revisi baru menunggu QC ulang,
  dan hasil QC berikutnya masuk kembali sebagai notifikasi tersendiri.
- Notifikasi mengikuti sinkronisasi aplikasi (45 detik, saat kembali ke aplikasi,
  atau Segarkan); tersedia selama aplikasi dibuka. Tidak mengirim pesan WA otomatis.
- Kartu **Log Pengambilan** mengikuti seluruh filter dan pencarian: fee, jumlah
  soal, dan guru aktif dihitung dari baris tampil, tanpa Cancel. Target dan sisa
  kuota memakai katalog proyek terkait (setiap proyek dihitung sekali), sehingga
  menyaring seorang guru tidak membuat sisa kuota proyek menjadi lebih besar.
  Label menunjukkan lingkup filter; hasil kosong menampilkan nol dan reset
  mengembalikan ringkasan seluruh bulan.

## 3.14.1 — Catatan opsional & kabar "telah selesai" untuk CLO (23 Oktober 2026)

- Kabar **pekerjaan selesai** kini berbunyi "pekerjaan … telah selesai. Hasil review
  akhir: N soal disetujui …" dengan jumlah akhir semua ronde (termasuk soal yang dibayar
  75% dan yang ditolak), lalu info fee masuk pembayaran bulan ini. Judulnya di antrean CLO
  menjadi **Pekerjaan selesai** (sebelumnya "QC selesai · hasil diputuskan").
- Draf kabar lain juga ditulis ulang per jenis hasil: pengajuan disetujui (dengan
  deadline), ditolak (dengan alasan), laporan progres sudah diperiksa, revisi diminta.
- Catatan RAD hanya **wajib** ikut di pesan untuk penolakan dan revisi. Untuk hasil yang
  beres (ACC, laporan diperiksa, pekerjaan selesai) catatan tidak otomatis ikut; CLO bisa
  mencentang **Sertakan catatan RAD**. Draf pesan sekarang bisa diedit sebelum dikirim.
- Form review RAD: bila tidak ada soal revisi, kolom catatan disembunyikan di balik
  **Tambah catatan (opsional)**; bila ada revisi, catatan tetap wajib.

## 3.14.0 — Pengambilan Guru jadi satu ruang kerja; menu Pantauan diringkas (23 Oktober 2026)

- **Antrean tugas** di atas halaman Pengambilan Guru, urut dari yang paling mendesak.
  RAD: QC ulang kiriman revisi, QC hasil akhir, laporan progres baru, ACC pengajuan.
  CLO: hasil RAD yang belum dikabari, reminder yang belum dikirim hari ini, dan tab
  **Butuh guru** (kuota terbuka + ringkasan tawaran: sudah ditawari, bersedia, belum
  membalas lebih dari 2 hari) dengan tombol **Cari guru**.
- Tombol utama langsung dari antrean: **ACC**, **Sudah diperiksa**, **Sudah dikabari**,
  **Reminder dikirim**, serta tautan WhatsApp/hasil/progres. Tolak, minta revisi, dan
  review membuka panel detail dengan formnya sudah terbuka.
- Empat angka ringkas (kuota terisi, lolos QC, tugas tim, lewat tenggat / butuh guru)
  menggantikan dashboard panjang. Produksi per subtes dipindah ke bawah dan dilipat.
- **Satu tabel** semua pengambilan (per subtes / per guru) menggantikan tabel berulang
  per subtes: alur titik ACC → 30% → 50% → 100% → QC, satu label status, tenggat
  terdekat, dan kabar CLO. Saringan cukup pencarian, Subtes, Guru, dan satu baris status
  (Perlu tindakan RAD, Belum dikabari, Menunggu guru, Lewat tenggat, Selesai, Ditolak).
  Di HP tabel menjadi kartu.
- Panel kanan berganti nama **Detail pengambilan**: kotak **Langkah berikutnya** sesuai
  tim yang sedang dibuka, lalu tab Riwayat · Laporan progres (dengan jadwal lapor) ·
  Kabar ke guru · Tindakan lain.
- Menu **Pantauan** dihapus dari menu RAD/CLO. Analisis lintas bulan, Reachout, dan
  Corong rekrutmen disatukan di halaman **Laporan & analisis** khusus Pemilik
  (tautan lama otomatis diarahkan ke sana). Menu bawah HP untuk CLO: Pengambilan ·
  Pendaftar · Guru · Katalog.
- Tidak ada perubahan data, API, atau izin: ACC/pemeriksaan/review tetap butuh peran RAD,
  pencatatan kabar tetap peran CLO.

## 3.13.0 — Dashboard dan matriks dalam satu Pengambilan Guru (23 Oktober 2026)

- **Pengambilan Guru** menjadi halaman awal dan ruang kerja bersama RAD/CLO.
  Menu **Pantauan RAD & CLO** mengarah ke halaman yang sama, sehingga matriks,
  sudut pandang dan filter yang sedang dipakai tidak hilang saat memilih menu itu.
- Dashboard menampilkan kuota terisi dari katalog, soal yang disetujui melalui
  review pengambilan (termasuk persetujuan parsial), capaian per subtes, serta
  prioritas RAD/CLO. Soal dilaporkan atau dikumpulkan 100% tidak dianggap otomatis
  lolos QC. Label menjelaskan sumber dan lingkup angka.
- Kartu, grafik per subtes, dan prioritas dapat diklik untuk menyaring matriks
  secara langsung. Fokus dapat digabung dengan dropdown Guru/Subtes/Status yang
  mendukung pencarian dan tahap 30%/50%/100%; **Reset filter** melepas semuanya.
  Tampilan awal tetap memperlihatkan seluruh pengambilan untuk kedua tim.
- Matriks **per subtes / per guru** menampilkan kolom **Kabar CLO** tersendiri:
  siap dikabari, sudah dikabari beserta waktu/petugas, atau perlu reminder.
  Status QC, jumlah soal disetujui, nomor revisi, dan tanggal tiap tahap tetap
  terlihat. Semua tombol membuka panel detail yang sama di kanan.
- Pencarian guru dan reachout kuota terbuka tersedia dalam ruang kerja yang sama
  tanpa menggantikan matriks. Kuota pengajuan menunggu ACC tetap diperhitungkan.
- Rincian grafik/prioritas dapat dilipat; pada ponsel awalnya ringkas agar matriks
  lebih cepat dicapai. Izin RAD/CLO serta catatan kabar per revisi tetap memakai
  pemeriksaan server dan jurnal sebelumnya; tidak ada migrasi data manual.

## 3.12.0 — Pantauan RAD & CLO dan kabar per revisi (23 Oktober 2026)

- Halaman awal **Pantauan** menyesuaikan akun: RAD mendapat antrean ACC,
  pemeriksaan progres, QC/QC ulang dan revisi, dengan pintasan proyek baru dan
  katalog. CLO mendapat progres seluruh RAD, antrean kabar, reminder, serta
  proyek yang masih memerlukan guru dan akses langsung ke Cari guru/reachout.
  Kuota yang sudah dipesan pengajuan menunggu ACC tidak ditawarkan kembali.
- Peran **RAD** dan **CLO** tersedia di Akun tim. Akun lama **Akademik** tetap
  membuka tugas RAD; **Seleksi** membuka tugas CLO. Pemilik atau anggota dengan
  kedua peran dapat berpindah tampilan. CLO dapat membaca katalog/pengambilan,
  sedangkan pemeriksaan, ACC dan pengaturan proyek tetap membutuhkan izin RAD.
- **Siap dikabari / Sudah dikabari** merujuk satu hasil pemeriksaan, laporan,
  versi, dan pengambilan. Catatan menyimpan petugas dari sesi login dan waktu WIB.
  Kiriman revisi baru menunggu QC ulang; hasil QC baru kembali siap dikabari,
  tanpa menghapus kabar untuk revisi sebelumnya. Permintaan untuk hasil yang
  sudah berubah ditolak; pengulangan pencatatan hasil yang sama tidak menggandakan
  riwayat. Riwayat lama yang masih tersimpan disertakan saat pencatatan pertama.
- Draf pesan dan tombol WhatsApp tidak otomatis menandai terkirim. CLO menekan
  **Catat sudah dikabari** sesudah mengirim pesan. Reminder juga dikonfirmasi
  secara eksplisit, per jadwal dan hari WIB, sehingga dapat muncul lagi esok hari
  jika tugas belum selesai.
- Tindakan membuka panel detail **di kanan** yang sama dengan Pengambilan Guru.
  Riwayat laporan, revisi, hasil QC dan kabar tampil bersama. Pantauan diperbarui
  berkala dan saat kembali ke aplikasi; pergantian bulan membersihkan detail lama.
- Data disimpan pada tab **Riwayat pengerjaan** yang sudah digunakan sebelumnya;
  tidak perlu menambah kolom atau memindahkan data secara manual.

## 3.11.0 — Dropdown Subtes dan Guru dengan pencarian teks (22 Oktober 2026)

- Filter **Subtes**, **Guru**, dan **Status** memiliki pencarian teks di dalam
  dropdown. Nama, ID guru, email, atau ID proyek dapat mempersempit pilihan;
  jumlah hasil tampil pada tiap opsi dan kondisi kosong ditampilkan dengan jelas.
- Filter Subtes dan Guru bisa digabung dengan pencarian umum, status, serta tahap
  30% / 50% / 100%, pada tampilan per subtes maupun per guru. Reset menghapus semua
  pilihan filter. Guru dengan nama sama tetap dibedakan melalui ID/email.
- Panel Riwayat tetap di sebelah kanan. Penomoran revisi progres dan hasil akhir
  diperiksa kembali, termasuk perbedaan kiriman revisi terakhir dan revisi berikutnya
  yang sedang ditunggu.

## 3.10.2 — Panel riwayat di sebelah kanan (22 Oktober 2026)

- Tombol **Riwayat** dan kolom tahap membuka panel detail dari **sebelah kanan**.
  Ikon arah pada tombol Riwayat ikut menunjuk ke kanan.

## 3.10.1 — Panel riwayat kiri, filter, dan penanda revisi berulang (22 Oktober 2026)

- **Riwayat** dan kolom tahap membuka panel detail dari sebelah kiri setelah
  diklik. Detail tidak terbuka otomatis; panel bisa ditutup dengan tombol,
  klik di luar, atau Escape, dengan fokus keyboard kembali ke tombol asal.
- Pencarian dan pilihan status menjadi toolbar ringkas dengan menu status,
  jumlah hasil per pilihan, slicer tahap dengan hitungan, serta reset filter.
- Matriks, riwayat, dan form guru membedakan **Revisi 1 dikirim** dari
  **Revisi 2 diminta**, dan seterusnya. Ringkasan memperlihatkan perbaikan
  terakhir yang diterima serta nomor revisi yang masih ditunggu, per laporan.
- Tanggal status di matriks mengikuti pemeriksaan atau permintaan revisi terbaru;
  tanggal kiriman awal dan setiap perbaikan tetap tersedia dalam riwayat.

## 3.10.0 — Matriks Pengambilan Guru & riwayat laporan (22 Oktober 2026)

- Pengambilan Guru memakai tampilan **per subtes** atau **per guru**, pencarian,
  pilihan status, dan filter tahap aktif **30% / 50% / 100%**.
- Setiap pengambilan menampilkan tahapan, tanggal, status pemeriksaan, dan riwayat
  laporan, revisi, pengumpulan akhir, serta hasil review dengan tautan per versi.
- Pemeriksaan dan permintaan revisi progres berlaku per laporan dan versi. Guru
  mengirim perbaikannya melalui Proyek saya; laporan berikutnya tetap terpisah.
- Riwayat baru ditambahkan ke tab **Riwayat pengerjaan**, bersama perubahan status
  dalam satu batch. Data lama yang masih ada disertakan saat pembaruan pertama;
  versi lama yang sudah tertimpa tidak dapat dipulihkan.
- Pengumpulan 100% tetap dibedakan dari hasil review selesai. Alur acc, review
  per soal, kuota, pengingat, dan potongan biaya tetap tersedia di detail.

## 3.9.0 — Laporan pengambilan per guru (Excel) (19 Oktober 2026)

- Tombol **Laporan Excel** di halaman **Log pengambilan**: unduh laporan per guru dengan
  kolom **NO · NAMA · YANG DIAMBIL · JUMLAH PAKET · SOAL PER PAKET · TOTAL SOAL · TOTAL
  SEMUA**. Contoh: Adinda mengambil PBM 1 paket @20 soal dan PPU 2 paket @20 soal → PBM 20,
  PPU 40, total semua 60. Nama & total semua satu sel untuk semua proyek guru itu; baris
  JUMLAH di bawah (jumlah guru, pengambilan, paket, dan soal).
- Sumbernya baris log yang **sedang tampil** (ikut saringan; judul & nama berkas diberi
  "(sesuai saringan)" bila ada saringan aktif). Baris **Cancel** (soal ditolak) tidak
  dihitung; beberapa baris untuk proyek yang sama (mis. baris tarif telat) dijumlah jadi satu.
- Isi paket memakai salinan saat guru mengajukan (bila ada), selain itu aturan proyek saat
  ini; proyek per soal tampil "-" di kolom paket. Bila paket terakhir lebih kecil, kolom soal
  per paket menulis mis. "20 (terakhir 5)".

## 3.8.2 — Link laporan progres guru jelas terlihat di dashboard (19 Oktober 2026)

- **Pengambilan guru**: tiap kartu kini punya daftar **Laporan progres** — Laporan 1, 2, …
  dengan jumlah soal & persentase, waktu lapor, catatan guru, tanda **BARU** (belum dicek), dan
  tombol **Buka progres** yang membuka link Google Docs yang dilaporkan guru. Sebelumnya link
  hanya berupa tulisan kecil "link" di sela daftar 30%/50%. Daftar ini juga tampil walau
  titik lapor proyeknya sudah diubah/dihapus.
- Saringan baru **Ada laporan progres** untuk melihat semua pengambilan yang sudah mengirim
  laporan (di samping *Progres baru masuk*).
- **Proyek saya** (guru): link progres yang sudah dilaporkan bisa dibuka lagi ("buka link").

## 3.8.1 — Baris baru tidak lagi jatuh di bawah rumus templat (16 Oktober 2026)

- Tab bulan yang dibuat dengan menduplikasi tab lain membawa rumus **Sisa / Fee / Bulan**
  yang sudah disalin jauh ke bawah (sampai baris 96–98). Dashboard dulu menganggap baris
  templat itu terisi, sehingga **Tambah proyek** dan **acc pengajuan** menaruh baris baru di
  baris 97–98. Kini kolom turunan itu diabaikan saat mencari baris kosong berikutnya —
  baris baru langsung menyambung di bawah data (berlaku juga untuk hapus baris).
- Perbaikan data 16 Okt (langsung di spreadsheet, bukan kode): tab `Oktober_` dan
  `Oktober_Freelance` bentrok (dashboard hanya membaca satu tab per bulan). 7 proyek UTBK
  dari `Oktober_Freelance` dipindah ke `Oktober_` sebagai P10-12…P10-18 beserta aturan &
  pengajuannya; tab lama diganti nama "Arsip UTBK Okt (digabung)".

## 3.8.0 — Pengambilan per soal / per paket + tipe Latsol / TO (15 Oktober 2026)

- **Panel "Atur" per proyek** di Katalog: kolom *Deadline & lapor* kini *Aturan proyek* berisi
  ringkasan (tipe, satuan, deadline + H-x, lapor + H-x, harga paket & sisa paket) dan tombol
  **Atur**. Panelnya memuat tipe pembuatan, satuan pengambilan, deadline, dan tanggal lapor
  30%/50% — disimpan sekali dan divalidasi bersama (lapor 30% ≤ lapor 50% ≤ deadline), jadi
  deadline dan tanggal lapor bisa digeser bersamaan tanpa masalah urutan.
- **Satuan pengambilan per proyek**: **Per soal** (bawaan, guru bebas memilih jumlah) atau
  **Per paket** — admin wajib mengisi isi paketnya (2–500 soal). Tersimpan di tab Aturan proyek
  kolom "Soal per paket".
- Proyek per paket di halaman guru: harga tampil **per paket** (harga per soal × isi paket;
  harga di sheet & rumus Fee tetap per soal), baris **Paket tersedia**, dan stepper menghitung
  **paket**, bukan soal — di kartu maupun di Periksa pengajuan. Bila sisa kuota bukan
  kelipatan isi paket, **paket terakhir lebih kecil** (mis. sisa 25, isi 10 → 2 paket @10 +
  1 paket 5 soal). Server menolak jumlah yang bukan kelipatan paket (kecuali seluruh sisa).
- Jumlah pengambilan tetap disimpan dalam **soal**; isi paket saat diajukan ikut dicatat
  (tab Pengerjaan kolom "Soal per paket") sehingga Proyek saya & Pengambilan guru
  menampilkan "2 paket (20 soal)". **Review tetap per soal** seperti sebelumnya.
- **Tipe pembuatan per proyek: Latsol (latihan soal) / TO (tryout)** — dipilih di panel Atur
  (tab Aturan proyek kolom "Tipe"). Tampil sebagai label di kartu katalog guru, Periksa
  pengajuan, Proyek saya, Pengambilan guru, dan pesan WA acc; guru bisa menyaring katalog
  per tipe. Tipe tidak mengubah aturan lain.
- **Template soal diperbarui** (`template-soal.pdf`): pembahasan berstruktur (Konsep, Kata
  Kunci, alasan jawaban benar, Pembahasan Opsi Lain, Cara Cepat) dan halaman baru **Tipe soal
  lainnya** (perbandingan Kolom 1 / Kolom 2). Alamatnya sama, popup panduan langsung membuka
  versi baru.
- Situs demo: 6 proyek Latsol per soal + 2 proyek TO per paket 10 soal (salah satunya
  dengan paket terakhir 5 soal).

## 3.7.0 — Akun uji & bersihkan data uji (14 Oktober 2026)

- **Akun uji** (khusus Pemilik, menu Pendaftaran & akun → Akun guru): akun guru yang
  dipakai tim untuk mencoba alur bisa ditandai **Akun uji** (kolom baru "Akun uji" di tab
  Akun guru). Akun ini diberi label **AKUN UJI**, dan pengambilannya berlabel **UJI** di
  Pengambilan guru.
- Tombol **Bersihkan data uji** (khusus Pemilik, hanya untuk akun bertanda uji): menghapus
  semua pengambilan akun itu beserta baris log-nya di semua bulan, sehingga kuota proyek
  kembali terbuka. Soal reject "hangus" dikembalikan ke kebutuhan katalog, dan penunjuk
  baris log pengambilan guru lain ikut disesuaikan saat barisnya bergeser. Akunnya tetap
  ada untuk uji berikutnya. Guru sungguhan tidak bisa dihapus massal.

## 3.6.1 — Template soal & video panduan baru (14 Oktober 2026)

- Popup **Sebelum mengambil proyek** (halaman guru): dokumen diganti **Template soal (PDF)**
  — struktur wajib + contoh pilihan ganda, MCMA, isian singkat, dan tabel Benar/Salah
  (`/template-soal.pdf`, menggantikan briefing lama `/panduan-kerja-guru-freelance.pdf`).
- Video panduan cukup dua: **Pengenalan Website** dan **Tata Cara Pengerjaan**. Daftar
  video tetap dibaca dari tab **Panduan** di spreadsheet (sudah diperbarui); cadangan di
  kode ikut disamakan.

## 3.6.0 — Tanggal lapor progres 30% & 50% + pemberitahuan (8 Oktober 2026)

- **Tanggal lapor diatur admin per proyek** (Katalog, kolom *Deadline & lapor*): dua
  tanggal terpisah **Lapor 30%** dan **Lapor 50%** — boleh salah satu, keduanya, atau
  kosong (tidak wajib). Tanggalnya sama untuk semua guru yang mengambil proyek itu, dengan
  label **H-x** di sampingnya. Tidak boleh setelah deadline, dan lapor 30% ≤ lapor 50%.
  Menggantikan aturan v3.4.0 (satu persen dengan batas dihitung otomatis).
- **Guru melihat H-x di mana-mana**: kartu katalog (*Lapor 30% · 9 Okt 2026 · H-1*),
  banner **Wajib lapor progres** di halaman proyek setelah masuk, dan jadwal per titik di
  Proyek saya (✓ sudah lapor / min. N soal · paling lambat Jum, 9 Okt · H-1). Pengingat
  *Perlu perhatian* muncul saat H-1, Hari H, atau lewat.
- **Lapor progres per titik**: guru melaporkan jumlah soal selesai + link Google Docs.
  Satu laporan bisa sekaligus memenuhi 30% dan 50% bila soalnya cukup. Titik yang
  tanggalnya sudah lewat saat guru di-acc tidak berlaku untuknya.
- **Hasil akhir boleh langsung dikumpulkan** walau belum lapor progres — titik yang belum
  terpenuhi dianggap terpenuhi saat itu (tetap ditandai telat bila tanggalnya lewat).
  Sebelumnya pengumpulan diblokir sampai lapor progres.
- **Telat lapor hanya ditandai** (merah "lewat N hari"), tanpa potongan.
- **Tim akademik (Pengambilan guru)**: saringan **Progres baru masuk** (juga dihitung di
  angka menu), jadwal titik di tiap kartu dengan link laporannya, tombol **Tandai progres
  sudah dicek**, WA **Kabari progres diterima** dan **Ingatkan lapor 30%/50% (H-x)** yang
  pesannya sudah berisi tanggal, H-x, dan jumlah soal minimal.
- Situs demo: data contoh memakai tanggal lapor baru (Ayu lapor 30% besok, Bima progres
  baru masuk + lapor 50% hari ini). Cache aturan ikut dikosongkan setelah pemulihan.
- Notifikasi push ke HP menyusul di tahap berikutnya.

## 3.5.0 — Situs demo dengan data contoh (5 Oktober 2026)

- **Mode demo** untuk mencoba program tanpa menyentuh data asli: proyek Vercel kedua dari
  repo yang sama dengan env `NEXT_PUBLIC_DEMO_MODE=1` dan keempat `SHEET_ID_*` menunjuk
  **spreadsheet demo** terpisah. Situs asli tidak berubah.
- **Pengaman spreadsheet**: di mode demo tidak ada jatuh-balik ke spreadsheet asli —
  bila `SHEET_ID_*` kosong atau sama dengan ID asli, seluruh akses Google Sheets ditolak.
  Pemulihan data hanya menulis ke spreadsheet yang punya tab penanda **MODE DEMO**.
- **Akun contoh di halaman login** (`/admin/login` dan `/open/masuk`): Tim Seleksi, Tim
  Akademik, Pemilik, dan 3 guru — satu klik untuk masuk, password sama untuk semua.
  Password akun contoh tidak bisa diganti (dipakai bersama).
- **Data contoh lengkap**: 8 guru + 4 pendaftar di setiap tahap seleksi, katalog 8 proyek
  bulan berjalan dengan deadline & wajib lapor, pengambilan di setiap status (menunggu
  acc, running, menunggu review, revisi, selesai, ditolak), log & pembayaran, reachout
  yang perlu ditindaklanjuti, serta pengingat yang langsung terlihat.
- **Menu Data demo** (semua anggota tim, hanya di situs demo): penjelasan skenario, daftar
  akun, dan tombol **Pulihkan data contoh** — mengembalikan semua data ke kondisi awal
  dengan tanggal disesuaikan ke hari ini.
- Di situs demo, tombol WhatsApp membuka **pratinjau pesan** (tidak terkirim ke nomor
  mana pun) dan tautan pendaftaran tidak membuka Google Form asli. Bar **MODE DEMO**
  tampil di atas setiap halaman.

## 3.4.0 — Lapor progres 30/50% & pengingat (5 Oktober 2026)

- **Lapor progres per proyek**: di Katalog, kolom *Deadline & lapor* punya pilihan
  **tidak wajib / wajib lapor 30% / wajib lapor 50%** (disimpan di tab Aturan proyek;
  disalin ke pengambilan saat di-acc). Kartu proyek di halaman guru menampilkan
  kewajibannya.
- **Guru (Proyek saya)**: form **Lapor progres** — jumlah soal selesai (minimal sesuai
  persen), link Google Docs, catatan. **Hasil akhir baru bisa dikumpulkan setelah lapor
  progres** (juga dijaga di server). Batas lapor dihitung sebanding waktu kerja: acc +
  (deadline − acc) × persen — mis. acc 1 Okt, deadline 11 Okt, wajib 30% → ±4 Okt.
- **Pengingat & tanda terlambat** (guru dan tim akademik): deadline besok / hari ini /
  lewat, lapor progres yang jatuh tempo ≤ 24 jam atau lewat, batas revisi ≤ 24 jam
  atau lewat. Guru melihat banner **Perlu perhatian** di Proyek saya; tiap kartu diberi
  penanda.
- **Tim akademik (Pengambilan guru)**: saringan **Perlu diingatkan**, blok progres di
  tiap kartu (sudah lapor berapa soal + link, atau belum lapor + batasnya), tombol WA
  **Ingatkan deadline** (H-1/hari ini), **Tagih (lewat deadline)**, **Ingatkan lapor
  progres**, **Ingatkan batas revisi** — pesan berisi tautan Proyek saya, tercatat di
  Reachout. KPI *Terlambat* kini merinci lewat deadline, revisi lewat 3 hari, dan belum
  lapor progres.
- Langkah 3 di panduan alur guru diperbarui: kerjakan & lapor progres.

## 3.3.0 — Pengumpulan & review per soal (5 Oktober 2026)

- **Guru (Proyek saya)**: proyek Running punya form **Kumpulkan untuk direview** — link
  Google Docs/Drive (link lain ditolak) + catatan opsional. Status jadi *Menunggu review*
  (log: QC Soal/Video). Saat **Revisi**: tampil jumlah soal yang direvisi, catatan tim,
  **batas revisi 3 hari** dengan hitung mundur, dan tombol **Kirim revisi** (link lama
  terisi otomatis). Rincian tiap review (disetujui, disetujui −25%, ditolak) dan
  peringatan bila review sudah gagal 2× atau lebih.
- **Tim akademik (Pengambilan guru)**: saringan baru *Menunggu review*, *Revisi*,
  *Selesai*; tombol **Buka GDoc** dan **Review N soal** — isi jumlah **disetujui / revisi /
  reject** (harus pas), pilih kuota soal reject **dibuka lagi ke katalog** atau **tidak
  dibuka** (kebutuhan dikurangi), dan catatan revisi (wajib bila ada revisi, tampil ke
  guru). Tombol WA **Kabari revisi** (berisi jumlah soal, catatan, link, batas & aturan
  25%), **Kirim peringatan**, **Kabari hasil akhir** — semua tercatat di Reachout.
- **Aturan yang dijalankan sistem**:
  - Revisi maks **3×24 jam** sejak status Revisi. Soal revisi yang **dikirim guru lewat
    batas** dan kemudian disetujui dibayar **75%** (potongan hanya untuk soal itu) —
    dihitung dari waktu kirim guru, bukan waktu review, supaya review yang lambat tidak
    merugikan guru.
  - Soal **reject** langsung keluar dari baris log utama ke baris *Cancel* (fee 0).
  - Setelah semua soal diputuskan: baris log utama jadi **Approved** (soal tepat waktu),
    soal telat di baris **Approved terpisah dengan tarif 75%** (Ket. Tarif menjelaskan).
  - Review gagal ke-2 & ke-3 → peringatan; gagal ke-4 → tombol **Terapkan denda 25%**
    (diputuskan tim; tidak ditumpuk dengan potongan revisi telat).
- KPI baru: menunggu review, sedang dikerjakan (running + revisi), terlambat (lewat
  deadline / revisi lewat 3 hari). Angka di menu Pengambilan guru = pengajuan baru +
  pengumpulan yang belum direview.
- Tab **Pengerjaan** bertambah kolom (link, waktu kumpul, ronde review, jumlah per hasil,
  batas & catatan revisi, review gagal, denda, baris log tambahan, reviewer) — judul
  kolomnya ditambahkan otomatis.

## 3.2.0 — Pengambilan proyek lewat dashboard (5 Oktober 2026)

Guru kini mengambil proyek langsung dari halaman proyek; chat WA hanya pemberitahuan
opsional. Halaman proyek wajib login (hanya guru ber-akun yang bisa mengambil).

- **Halaman guru (/open)**: tombol **Ajukan pengambilan** menyimpan pengajuan langsung
  (status *Menunggu acc*) dan **memesan kuotanya** — Sisa yang dilihat guru lain
  berkurang seketika. Kartu proyek menampilkan **deadline** + hitung mundur, dan status
  bila guru itu sudah mengambilnya. Proyek yang deadline-nya lewat tidak bisa diambil.
- **Proyek saya** (/open/saya, dari tombol di header & menu akun): semua pengambilan
  guru dengan status, deadline, siapa yang meng-acc/menolak beserta alasannya;
  pengajuan yang belum di-acc bisa dibatalkan sendiri.
- **Panduan alur** di popup Panduan dan di Proyek saya: ajukan → acc → kerjakan
  sebelum deadline → kumpulkan link GDoc → review (approved/revisi/reject) → revisi
  maks 3 hari (−25% untuk soal yang telat), plus aturan batas proyek aktif & denda.
- **Batas proyek aktif per guru** (bawaan 3, diatur tim akademik): pengajuan baru
  ditolak bila guru sudah mencapai batas.
- **Dashboard akademik → Pengambilan guru** (langkah 4 alur kerja, juga di menu bawah
  HP): pengajuan yang menunggu (dengan beban guru, sisa di sheet, perkiraan fee),
  **Acc** (baris log dibuat otomatis berstatus Running Soal/Video) atau **Tolak** dengan
  alasan (kuota kembali open), daftar yang sedang Running + tanda lewat deadline, dan
  tombol WA ke guru (kabari di-acc/ditolak, ingatkan deadline — tercatat di Reachout).
- **Katalog**: kolom baru **Deadline** (tanggal tetap per proyek, disimpan di tab baru
  *Aturan proyek*) dan keterangan "N menunggu acc" di kolom Sisa.
- Pengajuan disimpan di tab baru **Pengerjaan**; yang belum di-acc tidak ditulis ke log
  (kolom Status log memakai dropdown ketat), sehingga sheet bulanan tidak diubah
  strukturnya. Dua guru yang mengajukan kuota terakhir bersamaan: yang lebih dulu
  tercatat yang dapat, yang lain dibatalkan otomatis dengan pesan.

## 3.1.0 — Penanda "Bisa liveclass" untuk guru (5 Oktober 2026)

- Tab **Akun guru** (Pendaftaran & akun) punya kolom baru **Liveclass**: tombol
  **Tandai** / **✓ Bisa liveclass** untuk guru di Data guru freelance yang sudah
  dipastikan tim bisa mengajar live class (mis. setelah microteaching). Di bawahnya
  tampil jawaban form guru sendiri ("form: Ya / Mungkin / Tidak") sebagai petunjuk.
- Saringan baru **Liveclass**: *Bisa liveclass* (sudah ditandai) dan *Bersedia di form,
  belum ditandai* (menjawab Ya/Mungkin tapi belum dicek tim) — bisa digabung dengan
  saringan status akun dan keahlian.
- **Cari guru** untuk proyek live class (tim akademik): guru yang ditandai mendapat
  lencana **✓ bisa liveclass**, naik ke urutan atas, dan ada pilihan *Hanya yang sudah
  ditandai bisa liveclass*.
- Penanda disimpan di tab baru **Penanda guru** (ID guru, nama, bisa liveclass, diubah,
  oleh) — dibuat otomatis; Data guru tidak diubah. Bisa dipasang/dilepas oleh tim
  Seleksi dan Akademik; nama yang menandai tercatat.

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
