// ============================================================================
//  HALAMAN DEPAN (/) — pintu masuk publik program guru freelance.
//  Server component: tanpa JavaScript di browser selain tombol tema.
//
//  Isi perusahaan diringkas dari cerebrumcorp.id; isi program dari Panduan
//  Proyek Freelance. Detail & harga tiap proyek SENGAJA tidak ditampilkan di
//  sini — itu hanya untuk guru terverifikasi; yang publik cukup angka
//  ringkasnya.
// ============================================================================

import Brand from "./Brand";
import Icon from "./Icon";
import ThemeToggle from "./ThemeToggle";
import { numberID } from "@/lib/format";
import { FORM_DAFTAR, WA_ADMIN, tautanWa } from "@/lib/tautan";

const UJIAN = ["CPNS", "PPPK", "BUMN", "Sekolah Kedinasan", "TNI–Polri", "TOEFL", "Beasiswa", "TPA", "UTBK", "Persiapan kerja"];

const PERAN = [
  {
    ikon: "file",
    judul: "Pembuat soal & pembahasan",
    isi: "Menyusun soal sesuai materi, tingkat kesulitan, dan template — lengkap dengan kunci, pembahasan tertulis, dan input ke sistem SIADU.",
    tag: "Soal",
  },
  {
    ikon: "play",
    judul: "Video pembahasan",
    isi: "Merekam video pembahasan untuk soal yang sudah lolos QC, lalu memasangnya ke soal yang tepat di sistem.",
    tag: "Soal · output video",
  },
  {
    ikon: "users",
    judul: "Pengajar live class",
    isi: "Mengisi kelas daring secara langsung sesuai materi dan jadwal program persiapan seleksi.",
    tag: "Liveclass",
  },
  {
    ikon: "clipboard",
    judul: "Report FR & editor",
    isi: "Menyusun laporan sesuai format program, serta menyunting konten belajar agar rapi dan siap dipakai pengguna.",
    tag: "Laporan FR · Editor",
  },
];

const ALASAN = [
  { ikon: "layers", judul: "Pilih proyek sendiri", isi: "Ambil proyek yang sesuai bidang dan kapasitas mingguan Anda — jumlah soalnya Anda yang atur." },
  { ikon: "home", judul: "Kerja dari mana saja", isi: "Seluruh proses berjalan daring: panduan, template, contoh soal, dan sistem input disiapkan tim." },
  { ikon: "wallet", judul: "Fee per soal yang jelas", isi: "Harga per soal dan sisa kuota tiap proyek terlihat sebelum Anda mengambilnya." },
  { ikon: "check", judul: "Didampingi tim produk", isi: "Setiap pekerjaan melewati QC dengan catatan revisi yang jelas, plus video tutorial sistem SIADU." },
];

const LANGKAH = [
  { judul: "Isi form pendaftaran", isi: "Data diri, pendidikan, bidang yang dikuasai, CV, portofolio, dan video mengajar." },
  { judul: "Verifikasi oleh tim", isi: "Tim meninjau data dan berkas yang Anda kirim." },
  { judul: "Terima akun lewat WhatsApp", isi: "Admin mengirim email dan password sementara ke nomor WhatsApp Anda." },
  { judul: "Masuk & ambil proyek", isi: "Buat password sendiri, pilih proyek, atur jumlah soal, lalu ajukan." },
];

const ALUR = ["Pelajari panduan", "Buat sampel (guru baru)", "Produksi soal & pembahasan", "Input ke SIADU", "QC & revisi", "Video pembahasan", "Selesai"];

const SIAPKAN = ["Foto KTP & NIK", "CV terbaru", "Portofolio", "Video mengajar (mock-up)", "Nomor rekening BSI", "NPWP"];

const FAQ = [
  {
    t: "Siapa yang bisa mendaftar?",
    j: "Siapa pun yang menguasai materi dan siap mengikuti panduan produksi. Tim meninjau pendidikan, pengalaman, dan berkas yang Anda isi di form pendaftaran.",
  },
  {
    t: "Bagaimana fee dihitung?",
    j: "Dibayar per soal. Harga tiap proyek tercantum di halaman proyek bersama sisa kuotanya, dan bisa berbeda antar proyek maupun jenis output (mis. lengkap dengan video atau tidak).",
  },
  { t: "Apakah harus datang ke kantor?", j: "Tidak. Pengerjaan, input ke sistem, QC, dan komunikasi dengan tim berlangsung daring." },
  {
    t: "Sudah mendaftar, kapan dapat akun?",
    j: "Setelah pendaftaran diverifikasi, admin mengirim email dan password sementara lewat WhatsApp ke nomor yang Anda isi di form. Saat pertama masuk, Anda diminta membuat password sendiri.",
  },
  { t: "Saya sudah pernah mengerjakan proyek. Perlu daftar ulang?", j: "Tidak perlu. Guru yang sudah terdaftar akan dikirimi akun oleh admin." },
  { t: "Lupa password?", j: "Hubungi admin lewat WhatsApp. Admin akan mereset akun Anda dan mengirim password sementara yang baru." },
];

function TombolDaftar({ besar, teks = "Daftar jadi guru freelance" }) {
  return (
    <a className={"btn btn-blue" + (besar ? " lg" : "")} href={FORM_DAFTAR} target="_blank" rel="noopener noreferrer">
      {teks}
      <Icon name="chevronRight" />
    </a>
  );
}

export default function Landing({ papan }) {
  const tanyaAdmin = tautanWa(WA_ADMIN, "Halo kak, saya mau tanya tentang program guru freelance Cerebrum.");
  return (
    <div className="pub ld">
      <header className="pub-head ld-head">
        <div className="in">
          <a href="/" aria-label="Beranda">
            <Brand size={30} row />
          </a>
          <nav className="ld-nav" aria-label="Bagian halaman">
            <a href="#tentang">Tentang</a>
            <a href="#peran">Jenis proyek</a>
            <a href="#bergabung">Cara bergabung</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="pub-actions">
            <ThemeToggle className="sq" />
            <a className="btn btn-ghost" href="/open/masuk">
              Masuk
            </a>
            <a className="btn btn-blue ld-daftar-kecil" href={FORM_DAFTAR} target="_blank" rel="noopener noreferrer">
              Daftar
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* ------------------------------------------------------------ hero */}
        <section className="ld-hero">
          <div className="ld-wrap ld-hero-in">
            <div className="ld-hero-teks">
              <span className="ld-eyebrow">
                <i />
                Program Guru Freelance · PT Cerebrum Edukanesia Nusantara
              </span>
              <h1>
                Jadikan keahlian Anda <em>soal & kelas</em> yang dipakai jutaan pejuang seleksi.
              </h1>
              <p>
                Bergabung sebagai guru freelance Cerebrum: susun soal dan pembahasan, rekam video pembahasan, isi live class, atau kerjakan
                laporan — dari mana saja, dengan fee per soal yang jelas.
              </p>
              <div className="ld-cta">
                <TombolDaftar besar />
                <a className="btn btn-ghost lg" href="/open/masuk">
                  Sudah terverifikasi? Masuk
                </a>
              </div>
              <ul className="ld-cek">
                <li>
                  <Icon name="check" size={14} stroke={2.4} /> Pilih proyek sesuai bidang
                </li>
                <li>
                  <Icon name="check" size={14} stroke={2.4} /> Kerja daring
                </li>
                <li>
                  <Icon name="check" size={14} stroke={2.4} /> Didampingi tim QC
                </li>
              </ul>
            </div>

            <aside className="ld-papan" aria-label="Proyek bulan ini">
              <div className="ld-papan-kepala">
                <span className="pub-ico">
                  <Icon name="layers" size={18} />
                </span>
                <div>
                  <b>{papan ? `Proyek ${papan.bulan}` : "Papan proyek"}</b>
                  <span>diperbarui langsung dari tim produk</span>
                </div>
              </div>
              {papan ? (
                <>
                  <div className="ld-papan-angka">
                    <div>
                      <b>{numberID(papan.proyek)}</b>
                      <span>proyek terbuka</span>
                    </div>
                    <div>
                      <b>{numberID(papan.soal)}</b>
                      <span>soal menunggu dikerjakan</span>
                    </div>
                  </div>
                  {papan.jenis.length ? (
                  <div className="ld-papan-jenis">
                    {papan.jenis.map((j) => (
                      <div key={j.k}>
                        <span>{j.k}</span>
                        <div className="meter">
                          <i style={{ width: Math.max(6, Math.round((j.n / papan.proyek) * 100)) + "%" }} />
                        </div>
                        <b>{numberID(j.n)}</b>
                      </div>
                    ))}
                  </div>
                  ) : null}
                </>
              ) : (
                <p className="muted">Proyek dibuka setiap bulan untuk soal, video pembahasan, live class, dan laporan.</p>
              )}
              <div className="ld-papan-kunci">
                <Icon name="lock" size={14} />
                Detail & harga tiap proyek terbuka setelah akun Anda diverifikasi.
              </div>
            </aside>
          </div>
        </section>

        {/* ---------------------------------------------------------- angka */}
        <section className="ld-wrap ld-angka" aria-label="Cerebrum dalam angka">
          <div>
            <b>2018</b>
            <span>mulai membimbing siswa</span>
          </div>
          <div>
            <b>16+</b>
            <span>aplikasi bimbel online</span>
          </div>
          <div>
            <b>3 juta+</b>
            <span>siswa & pengguna</span>
          </div>
          <div>
            <b>200+</b>
            <span>tim, tutor & kontributor</span>
          </div>
        </section>

        {/* --------------------------------------------------------- tentang */}
        <section id="tentang" className="ld-wrap ld-sec ld-tentang">
          <div>
            <span className="eyebrow">Tentang Cerebrum</span>
            <h2>Bimbel online berbasis teknologi untuk setiap target seleksi</h2>
            <p>
              PT Cerebrum Edukanesia Nusantara membangun platform bimbel online sejak 2018 — lengkap dengan materi, latihan soal, tryout,
              pembahasan, dan live class — supaya masyarakat Indonesia bisa mempersiapkan pendidikan dan seleksi dengan lebih terarah.
            </p>
            <p>
              Soal, pembahasan, dan kelas yang Anda buat sebagai guru freelance dipakai langsung oleh pengguna aplikasi-aplikasi ini.
            </p>
            <a className="ld-tautan" href="https://cerebrumcorp.id/" target="_blank" rel="noopener noreferrer">
              Kenali Cerebrum lebih jauh
              <Icon name="external" size={14} />
            </a>
          </div>
          <div className="ld-ujian" aria-label="Persiapan seleksi yang dilayani">
            {UJIAN.map((u) => (
              <span key={u}>{u}</span>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------------------- peran */}
        <section id="peran" className="ld-sec ld-alt">
          <div className="ld-wrap">
            <div className="ld-judul">
              <span className="eyebrow">Jenis proyek</span>
              <h2>Pilih peran yang sesuai keahlian Anda</h2>
              <p>Setiap bulan tim produk membuka proyek baru. Anda boleh mengambil lebih dari satu jenis.</p>
            </div>
            <div className="ld-peran">
              {PERAN.map((p) => (
                <article key={p.judul}>
                  <span className="ld-ikon">
                    <Icon name={p.ikon} size={20} />
                  </span>
                  <h3>{p.judul}</h3>
                  <p>{p.isi}</p>
                  <span className="mini">{p.tag}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- alasan */}
        <section className="ld-wrap ld-sec">
          <div className="ld-judul">
            <span className="eyebrow">Kenapa bergabung</span>
            <h2>Fleksibel, jelas, dan berdampak</h2>
          </div>
          <div className="ld-alasan">
            {ALASAN.map((a) => (
              <div key={a.judul}>
                <span className="ld-ikon kecil">
                  <Icon name={a.ikon} size={18} />
                </span>
                <div>
                  <h3>{a.judul}</h3>
                  <p>{a.isi}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------- bergabung */}
        <section id="bergabung" className="ld-sec ld-alt">
          <div className="ld-wrap">
            <div className="ld-judul">
              <span className="eyebrow">Cara bergabung</span>
              <h2>Empat langkah sampai proyek pertama</h2>
            </div>
            <ol className="ld-langkah">
              {LANGKAH.map((l, i) => (
                <li key={l.judul}>
                  <span className="ld-no">{i + 1}</span>
                  <h3>{l.judul}</h3>
                  <p>{l.isi}</p>
                </li>
              ))}
            </ol>
            <div className="ld-siapkan">
              <div>
                <b>Siapkan sebelum mengisi form</b>
                <div className="ld-siapkan-list">
                  {SIAPKAN.map((s) => (
                    <span key={s}>
                      <Icon name="check" size={13} stroke={2.4} />
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <TombolDaftar teks="Isi form pendaftaran" />
            </div>

            <div className="ld-alur">
              <span className="eyebrow">Alur pengerjaan proyek</span>
              <ol>
                {ALUR.map((a, i) => (
                  <li key={a}>
                    <span>{i + 1}</span>
                    {a}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- faq */}
        <section id="faq" className="ld-wrap ld-sec ld-faq-wrap">
          <div className="ld-judul">
            <span className="eyebrow">FAQ</span>
            <h2>Pertanyaan yang sering diajukan</h2>
            <p>
              Belum terjawab?{" "}
              <a className="ld-tautan" href={tanyaAdmin} target="_blank" rel="noopener noreferrer">
                Tanya Admin Akademik lewat WhatsApp
              </a>
            </p>
          </div>
          <div className="ld-faq">
            {FAQ.map((f) => (
              <details key={f.t}>
                <summary>
                  {f.t}
                  <Icon name="chevronDown" />
                </summary>
                <p>{f.j}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------- cta */}
        <section className="ld-wrap">
          <div className="ld-akhir">
            <div>
              <h2>Siap membuat soal yang dipakai jutaan orang?</h2>
              <p>Isi form pendaftaran — tim akan meninjau dan mengabari Anda lewat WhatsApp.</p>
            </div>
            <div className="ld-cta">
              <TombolDaftar besar teks="Daftar sekarang" />
              <a className="btn btn-ghost lg" href="/open/masuk">
                Masuk
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="ld-foot">
        <div className="ld-wrap">
          <Brand size={24} row />
          <span>
            © {new Date().getFullYear()} PT Cerebrum Edukanesia Nusantara ·{" "}
            <a href="https://cerebrumcorp.id/" target="_blank" rel="noopener noreferrer">
              cerebrumcorp.id
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
