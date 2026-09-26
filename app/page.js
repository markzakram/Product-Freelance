import { unstable_cache } from "next/cache";
import Landing from "@/components/Landing";
import { getBoard } from "@/lib/juli";
import { jenisDariId } from "@/lib/jenis";

export const metadata = {
  title: { absolute: "Guru Freelance Cerebrum — buat soal, live class & konten belajar" },
  description:
    "Bergabung sebagai guru freelance PT Cerebrum Edukanesia Nusantara: susun soal & pembahasan, video pembahasan, live class, dan laporan untuk 3 juta+ pengguna bimbel online. Daftar lewat form, masuk setelah diverifikasi.",
};

// Halaman depan cukup disegarkan tiap 5 menit — angkanya hanya ringkasan.
export const revalidate = 300;

// Hanya angka ringkas bulan berjalan; detail & harga proyek tetap khusus
// guru yang sudah login.
const ringkasPapan = unstable_cache(
  async () => {
    const board = await getBoard();
    if (board.source !== "live") return null; // jangan pamerkan data contoh
    const buka = (board.projects || []).filter((p) => p.sisa > 0);
    if (!buka.length) return null;
    const c = {};
    buka.forEach((p) => {
      const k = jenisDariId(p.idSubtes) || "Lainnya";
      c[k] = (c[k] || 0) + 1;
    });
    return {
      bulan: (board.months || []).find((m) => m.tab === board.tab)?.bulan || "bulan ini",
      proyek: buka.length,
      soal: buka.reduce((a, p) => a + p.sisa, 0),
      // Rincian per jenis hanya bila jenisnya diketahui (baris katalog yang
      // tidak tertaut ke Master jatuh ke "Lainnya" — tidak informatif).
      jenis: Object.keys(c).some((k) => k !== "Lainnya")
        ? Object.entries(c)
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => ({ k, n }))
        : [],
    };
  },
  ["landing-papan"],
  { revalidate: 300 }
);

export default async function Beranda() {
  const papan = await ringkasPapan().catch(() => null);
  return <Landing papan={papan} />;
}
