import TopBar from "@/components/TopBar";
import DataBanner from "@/components/DataBanner";
import OpenBoard from "@/components/OpenBoard";
import { getOpenProjects } from "@/lib/sheets";

export const revalidate = 300; // refresh from Sheets every 5 minutes
export const metadata = { title: "Open Freelance — Proyek Buka" };

export default async function OpenPage() {
  const { source, rows } = await getOpenProjects();
  const open = rows.filter((r) => r.sisa > 0);
  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || "";
  return (
    <>
      <TopBar active="open" />
      <div className="hero">
        <div className="container">
          <h1>Open Freelance — Proyek Bulan Ini</h1>
          <p>
            Daftar proyek soal, pembahasan &amp; video yang sedang buka. Pilih
            yang sesuai bidangmu, lalu tekan “Ambil” untuk menghubungi tim via
            WhatsApp.
          </p>
        </div>
      </div>
      <div className="container section">
        <DataBanner source={source} />
        <OpenBoard projects={open} waNumber={waNumber} />
      </div>
      <div className="footer">
        © {new Date().getFullYear()} · Open Freelance · Data diperbarui otomatis
      </div>
    </>
  );
}
