import Brand from "@/components/Brand";
import InputSandi from "@/components/InputSandi";
import { LAMA_KUNCI_MENIT } from "@/lib/akun";

export const metadata = { title: "Masuk" };

const PESAN = {
  1: "Password internal salah. Coba lagi.",
  salah: "Email atau password salah.",
  terkunci: `Terlalu banyak percobaan yang salah. Coba lagi ${LAMA_KUNCI_MENIT} menit lagi, atau minta pemilik mereset password Anda.`,
  server: "Server sedang bermasalah. Coba lagi sebentar lagi.",
  "tim-belum-aktif": "Login tim belum aktif di server (GURU_SESSION_SECRET belum diset). Pemilik masih bisa masuk dengan password internal.",
  sesi: "Sesi Anda berakhir. Silakan masuk lagi.",
};

export default function Login({ searchParams }) {
  const error = searchParams?.error;
  const next = searchParams?.next || "/admin";
  const email = String(searchParams?.email || "").slice(0, 120);
  return (
    <div className="login-wrap">
      <form className="login-card" method="POST" action="/api/login">
        <Brand size={38} />
        <div>
          <h1>Masuk dashboard</h1>
          <p>Untuk tim seleksi dan tim akademik. Halaman ini berisi data honor dan rekening guru.</p>
        </div>
        {error === "belum-diset" ? (
          <div className="banner err" role="alert" style={{ margin: 0 }}>
            <div>
              Area internal dikunci karena password server belum diset. Isi <b>INTERNAL_PASSWORD</b> di Environment
              Variables Vercel, lalu deploy ulang.
            </div>
          </div>
        ) : error ? (
          <div className="banner err" role="alert" style={{ margin: 0 }}>
            <div>{PESAN[error] || PESAN.salah}</div>
          </div>
        ) : null}
        <input type="hidden" name="next" value={next} />
        <label className="ffield">
          <span>Email</span>
          <input className="input" type="email" name="email" defaultValue={email} autoComplete="username" inputMode="email" autoCapitalize="none" autoFocus={!email} />
        </label>
        <InputSandi id="a-pw" name="password" label="Password" autoComplete="current-password" autoFocus={Boolean(email)} />
        <button className="btn btn-blue block" type="submit">
          Masuk
        </button>
        <p className="muted login-catatan">Pemilik: kosongkan email dan pakai password internal.</p>
      </form>
    </div>
  );
}
