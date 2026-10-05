import { notFound } from "next/navigation";
import Brand from "@/components/Brand";
import { MODE_DEMO } from "@/lib/demo";

export const metadata = { title: "Pendaftaran (demo)" };

export default function DaftarDemo() {
  if (!MODE_DEMO) notFound();
  return (
    <div className="login-wrap">
      <div className="login-card">
        <Brand size={34} />
        <div>
          <h1>Pendaftaran tidak dibuka di mode demo</h1>
          <p>
            Di situs asli, tombol ini membuka Google Form pendataan freelance. Di mode demo, contoh pendaftar sudah tersedia di dashboard tim seleksi
            (menu Pendaftaran &amp; akun) supaya alur seleksi bisa dicoba tanpa mengisi form sungguhan.
          </p>
        </div>
        <a className="btn btn-blue block" href="/open/masuk">
          Masuk sebagai guru contoh
        </a>
        <a className="btn btn-ghost block" href="/admin/login">
          Masuk sebagai tim (dashboard)
        </a>
      </div>
    </div>
  );
}
