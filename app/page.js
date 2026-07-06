import Link from "next/link";
import TopBar from "@/components/TopBar";

export const metadata = { title: "Proyek Guru Freelance" };

export default function Home() {
  return (
    <>
      <TopBar />
      <div className="hero">
        <div className="container">
          <h1>Proyek Guru Freelance</h1>
          <p>
            Satu tempat untuk melihat proyek yang sedang buka dan memantau
            progres, fee, serta data guru freelance.
          </p>
          <div className="hero-cards">
            <Link href="/open" className="entry">
              <div className="ico" style={{ background: "var(--blue-50)" }}>
                📋
              </div>
              <h3>Open Freelance</h3>
              <p>
                Untuk guru: lihat daftar proyek soal &amp; pembahasan yang
                sedang buka bulan ini, lengkap dengan harga dan sisa kebutuhan.
                Bisa langsung ambil via WhatsApp.
              </p>
              <span className="go">Lihat proyek buka →</span>
            </Link>
            <Link href="/admin" className="entry">
              <div className="ico" style={{ background: "var(--green-50)" }}>
                📊
              </div>
              <h3>Dashboard Internal</h3>
              <p>
                Untuk tim &amp; HR/Akademik: ringkasan progres proyek, rekap fee
                per bulan, dan database guru freelance. Area terkunci.
              </p>
              <span className="go">Masuk area internal →</span>
            </Link>
          </div>
        </div>
      </div>
      <div className="footer">
        © {new Date().getFullYear()} · Dashboard Proyek Guru Freelance
      </div>
    </>
  );
}
