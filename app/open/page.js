import TopBar from "@/components/TopBar";
import DataBanner from "@/components/DataBanner";
import OpenBoard from "@/components/OpenBoard";
import { getOpenProjects, getPanduan } from "@/lib/sheets";

export const revalidate = 300; // refresh from Sheets every 5 minutes
export const metadata = { title: "Open Freelance — Proyek Buka" };

export default async function OpenPage() {
  const [{ source, rows }, panduan] = await Promise.all([
    getOpenProjects(),
    getPanduan(),
  ]);
  const open = rows.filter((r) => r.sisa > 0);
  // Admin Akademik — semua chat WA diarahkan ke nomor ini.
  // Bisa dioverride lewat env var NEXT_PUBLIC_WA_NUMBER di Vercel.
  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || "6285117248323";
  const brand = process.env.NEXT_PUBLIC_BRAND || "Cerebrum";
  return (
    <>
      <TopBar active="open" />
      <div className="hero">
        <div className="container">
          <h1>Open Freelance — Proyek Bulan Ini</h1>
          <p>
            Daftar proyek soal, pembahasan &amp; video yang sedang buka. Pilih
            yang sesuai bidangmu, atur jumlah soal, lalu masukkan ke keranjang.
            Setelah selesai, kirim ringkasannya ke Admin Akademik via WhatsApp.
          </p>
        </div>
      </div>
      <div className="container section">
        <DataBanner source={source} />
        <OpenBoard
          projects={open}
          waNumber={waNumber}
          panduan={panduan.rows}
          brand={brand}
        />
      </div>
      <div className="footer">
        © {new Date().getFullYear()} · Open Freelance · Data diperbarui otomatis
      </div>
    </>
  );
}
