import OpenBoard from "@/components/OpenBoard";
import { getPanduan } from "@/lib/sheets";
import { getBoard } from "@/lib/juli";
import { jenisDariId } from "@/lib/jenis";

// Katalog dibaca langsung dari sheet bulan terbaru pada tiap request, supaya
// stok (kolom Sisa) yang dilihat guru selalu sama dengan spreadsheet.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Proyek terbuka" };

export default async function OpenPage() {
  const [board, panduan] = await Promise.all([getBoard(), getPanduan()]);
  const bulan = (board.months || []).find((m) => m.tab === board.tab)?.bulan || "";
  // Guru hanya boleh melihat/apply proyek yang stoknya masih tersisa, dan
  // hanya kolom yang memang untuk guru: platform & tautan master TIDAK ikut
  // dikirim ke browser (bukan sekadar disembunyikan di tampilan).
  // `id` (kode baris) tetap ikut karena dicantumkan di pesan WhatsApp —
  // ada subtes bernama sama di baris berbeda.
  const open = board.projects
    .filter((r) => r.sisa > 0)
    .map((r) => ({
      id: r.id,
      subtes: r.subtes,
      output: r.output,
      harga: r.harga,
      sisa: r.sisa,
      kebutuhan: r.kebutuhan,
      jenis: jenisDariId(r.idSubtes) || "Lainnya",
    }));
  // Admin Akademik — semua chat WA diarahkan ke nomor ini.
  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || "6285117248323";
  const brand = process.env.NEXT_PUBLIC_BRAND || "Cerebrum";
  return (
    <OpenBoard
      projects={open}
      source={board.source}
      bulan={bulan}
      waNumber={waNumber}
      panduan={panduan.rows}
      brand={brand}
    />
  );
}
