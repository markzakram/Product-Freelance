import TopBar from "@/components/TopBar";
import OpenBoard from "@/components/OpenBoard";
import { getPanduan } from "@/lib/sheets";
import { getBoard } from "@/lib/juli";

// Katalog dibaca langsung dari tab "Juli_Proyek ASN & Bappenas" pada tiap
// request, supaya stok (kolom Sisa) yang dilihat guru selalu sama dengan
// spreadsheet — bukan hasil cache 5 menit seperti sebelumnya.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Open Freelance — Proyek Buka" };

export default async function OpenPage() {
  const [board, panduan] = await Promise.all([getBoard(), getPanduan()]);
  const source = board.source;
  // Guru hanya boleh melihat/apply proyek yang stoknya masih tersisa.
  const open = board.projects.filter((r) => r.sisa > 0);
  // Admin Akademik — semua chat WA diarahkan ke nomor ini.
  // Bisa dioverride lewat env var NEXT_PUBLIC_WA_NUMBER di Vercel.
  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || "6285117248323";
  const brand = process.env.NEXT_PUBLIC_BRAND || "Cerebrum";
  return (
    <>
      <TopBar active="open" />
      <OpenBoard
        projects={open}
        source={source}
        waNumber={waNumber}
        panduan={panduan.rows}
        brand={brand}
      />
      <div className="footer">
        © {new Date().getFullYear()} · Open Freelance · Data diperbarui otomatis
      </div>
    </>
  );
}
