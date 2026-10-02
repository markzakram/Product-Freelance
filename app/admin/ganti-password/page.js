import { redirect } from "next/navigation";
import Brand from "@/components/Brand";
import Icon from "@/components/Icon";
import InputSandi from "@/components/InputSandi";
import { sesiAdmin } from "@/lib/authServer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ganti password" };

// Ganti password anggota tim. Wajib saat masuk pertama dengan password
// sementara dari pemilik. Pemilik (password internal) menggantinya di Vercel.
export default async function GantiPasswordTim({ searchParams }) {
  const sesi = await sesiAdmin().catch(() => null);
  if (!sesi) redirect("/admin/login?error=sesi");
  if (!sesi.akunTim) redirect("/admin");
  const error = String(searchParams?.error || "").slice(0, 200);

  return (
    <div className="login-wrap">
      <form className="login-card" method="POST" action="/api/admin/ganti-password">
        <Brand size={38} />
        <div>
          <h1>{sesi.wajibGanti ? "Buat password Anda sendiri" : "Ganti password"}</h1>
          <p>
            {sesi.wajibGanti
              ? "Password dari pemilik hanya untuk masuk pertama kali. Buat password baru yang hanya Anda yang tahu."
              : "Masukkan password saat ini, lalu password baru."}
          </p>
        </div>
        <div className="auth-akun">
          <Icon name="userCheck" size={18} />
          <span>
            <b>{sesi.nama}</b>
            {sesi.email} · {sesi.peran.join(", ")}
          </span>
        </div>
        {error ? (
          <div className="banner err" role="alert" style={{ margin: 0 }}>
            <div>{error}</div>
          </div>
        ) : null}
        <input type="email" name="username" autoComplete="username" defaultValue={sesi.email} hidden readOnly />
        {!sesi.wajibGanti ? <InputSandi id="t-lama" name="lama" label="Password saat ini" autoComplete="current-password" autoFocus /> : null}
        <InputSandi id="t-baru" name="baru" label="Password baru" autoComplete="new-password" autoFocus={sesi.wajibGanti} petunjuk="Minimal 8 karakter, berisi huruf dan angka." />
        <InputSandi id="t-ulang" name="ulang" label="Ulangi password baru" autoComplete="new-password" />
        <button className="btn btn-blue block" type="submit">
          Simpan password baru
        </button>
        {!sesi.wajibGanti ? (
          <a className="login-catatan" href="/admin">
            Batal, kembali ke dashboard
          </a>
        ) : null}
      </form>
    </div>
  );
}
