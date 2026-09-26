import { redirect } from "next/navigation";
import Brand from "@/components/Brand";
import Icon from "@/components/Icon";
import InputSandi from "@/components/InputSandi";
import { sesiGuru } from "@/lib/sesiGuru";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ganti password" };

export default async function GantiPassword({ searchParams }) {
  const sesi = await sesiGuru();
  if (!sesi) redirect("/open/masuk?error=sesi");
  const { akun, wajibGanti } = sesi;
  const error = String(searchParams?.error || "").slice(0, 200);

  return (
    <div className="pub auth-wrap">
      <main className="auth-card">
        <span className="auth-brand">
          <Brand size={32} row />
        </span>
        <div>
          <h1>{wajibGanti ? "Buat password Anda sendiri" : "Ganti password"}</h1>
          <p>
            {wajibGanti
              ? "Password dari admin hanya untuk masuk pertama kali. Buat password baru yang hanya Anda yang tahu sebelum melihat proyek."
              : "Masukkan password saat ini, lalu password baru."}
          </p>
        </div>
        <div className="auth-akun">
          <Icon name="userCheck" size={18} />
          <span>
            {akun.nama ? <b>{akun.nama}</b> : null}
            {akun.email}
          </span>
        </div>

        {error ? (
          <div className="banner err" role="alert">
            <Icon name="alert" />
            <div>{error}</div>
          </div>
        ) : null}

        <form method="POST" action="/api/guru/ganti-password" className="auth-form">
          {/* kolom email tersembunyi: supaya pengelola password di HP menyimpan pasangan email + password baru */}
          <input type="email" name="username" autoComplete="username" defaultValue={akun.email} hidden readOnly />
          {!wajibGanti ? <InputSandi id="g-lama" name="lama" label="Password saat ini" autoComplete="current-password" autoFocus /> : null}
          <InputSandi id="g-baru" name="baru" label="Password baru" autoComplete="new-password" autoFocus={wajibGanti} petunjuk="Minimal 8 karakter, berisi huruf dan angka." />
          <InputSandi id="g-ulang" name="ulang" label="Ulangi password baru" autoComplete="new-password" />
          <button type="submit" className="btn btn-blue block">
            Simpan password baru
          </button>
        </form>

        <div className="auth-links">
          {!wajibGanti ? <a href="/open">Batal, kembali ke proyek</a> : <span />}
          <form method="POST" action="/api/guru/keluar">
            <button type="submit" className="btn-link">
              Keluar
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
