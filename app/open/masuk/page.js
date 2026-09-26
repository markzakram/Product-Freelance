import { redirect } from "next/navigation";
import Brand from "@/components/Brand";
import Icon from "@/components/Icon";
import InputSandi from "@/components/InputSandi";
import { sesiGuru, loginGuruSiap } from "@/lib/sesiGuru";
import { wajibLoginGuru, LAMA_KUNCI_MENIT } from "@/lib/akun";
import { FORM_DAFTAR, WA_ADMIN, tautanWa } from "@/lib/tautan";

export const dynamic = "force-dynamic";
export const metadata = { title: "Masuk" };

const PESAN = {
  salah: "Email atau password salah.",
  kosong: "Isi email dan password dulu.",
  terkunci: `Terlalu banyak percobaan yang salah. Coba lagi ${LAMA_KUNCI_MENIT} menit lagi, atau minta admin mereset password.`,
  server: "Server sedang bermasalah. Coba lagi sebentar lagi.",
  "belum-aktif": "Login guru belum diaktifkan. Hubungi admin.",
  sesi: "Sesi Anda berakhir. Silakan masuk lagi.",
};

export default async function MasukGuru({ searchParams }) {
  const sesi = await sesiGuru();
  if (sesi) redirect(sesi.wajibGanti ? "/open/ganti-password" : "/open");
  const wajib = await wajibLoginGuru();
  const error = PESAN[searchParams?.error] || "";
  const email = String(searchParams?.email || "").slice(0, 120);

  return (
    <div className="pub auth-wrap">
      <main className="auth-card">
        <a href="/" className="auth-brand" aria-label="Ke beranda">
          <Brand size={32} row />
        </a>
        <div>
          <h1>Masuk ke Proyek Guru</h1>
          <p>Pakai email dan password yang dikirim admin lewat WhatsApp setelah pendaftaran Anda diverifikasi.</p>
        </div>

        {searchParams?.keluar ? (
          <div className="banner live" role="status">
            <Icon name="check" />
            <div>Anda sudah keluar.</div>
          </div>
        ) : null}
        {error ? (
          <div className="banner err" role="alert">
            <Icon name="alert" />
            <div>{error}</div>
          </div>
        ) : null}

        {loginGuruSiap() ? (
          <form method="POST" action="/api/guru/masuk" className="auth-form">
            <div className="ffield">
              <label htmlFor="m-email">Email</label>
              <input id="m-email" name="email" type="email" className="input" defaultValue={email} autoComplete="username" inputMode="email" autoCapitalize="none" required autoFocus={!email} />
            </div>
            <InputSandi id="m-pw" name="password" label="Password" autoComplete="current-password" autoFocus={Boolean(email)} />
            <button type="submit" className="btn btn-blue block">
              Masuk
            </button>
          </form>
        ) : null}

        <div className="auth-links">
          <a href={tautanWa(WA_ADMIN, "Halo kak, saya lupa password akun Proyek Guru. Email saya: ")} target="_blank" rel="noopener noreferrer">
            Lupa password? Hubungi admin
          </a>
          {!wajib ? <a href="/open">Lihat proyek tanpa masuk</a> : null}
        </div>

        <div className="auth-daftar">
          <span>Belum terdaftar sebagai guru freelance?</span>
          <a className="btn btn-ghost block" href={FORM_DAFTAR} target="_blank" rel="noopener noreferrer">
            <Icon name="file" />
            Daftar lewat form pendaftaran
          </a>
        </div>
      </main>
    </div>
  );
}
