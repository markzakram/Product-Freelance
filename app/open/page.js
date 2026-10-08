import { redirect } from "next/navigation";
import OpenBoard from "@/components/OpenBoard";
import { getPanduan } from "@/lib/sheets";
import { getBoard } from "@/lib/juli";
import { jenisDariId } from "@/lib/jenis";
import { getTeachers } from "@/lib/teachers";
import { wajibLoginGuru } from "@/lib/akun";
import { sesiGuru, loginGuruSiap } from "@/lib/sesiGuru";
import { WA_ADMIN } from "@/lib/tautan";
import { adminSah } from "@/lib/authServer";
import { bacaPengerjaan, dipesanPerProyek, maksAktif, lengkapiTitik } from "@/lib/pengerjaan";
import { aturanBulan } from "@/lib/aturanProyek";
import { AKTIF, ST, hitungMundur, titikBerikut } from "@/lib/pengerjaanOpsi";

// Katalog dibaca langsung dari sheet bulan terbaru pada tiap request, supaya
// stok (kolom Sisa) yang dilihat guru selalu sama dengan spreadsheet.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Proyek terbuka" };

export default async function OpenPage({ searchParams }) {
  // Gerbang login: aktif setelah admin menekan "Wajibkan login" (masa
  // peralihan: akun semua guru disiapkan dulu). Sesi yang baru dibuat dengan
  // password dari admin wajib ganti password sebelum melihat proyek.
  const [sesi, wajib, admin] = await Promise.all([sesiGuru(), wajibLoginGuru(), adminSah()]);
  if (sesi?.wajibGanti) redirect("/open/ganti-password");
  // Admin yang sedang login tetap bisa melihat halaman guru (tautan
  // "Halaman guru" di sidebar) tanpa perlu punya akun guru.
  if (wajib && !sesi && !admin) redirect("/open/masuk");

  const [board, panduan, guruDb] = await Promise.all([getBoard(), getPanduan(), sesi ? getTeachers() : null]);
  const bulan = (board.months || []).find((m) => m.tab === board.tab)?.bulan || "";
  // Pengajuan yang menunggu acc memesan kuota: Sisa yang dilihat guru = Sisa
  // sheet − pesanan itu. Deadline per proyek dari tab "Aturan proyek".
  // Gagal membaca keduanya tidak boleh mematikan halaman proyek.
  const [semuaPj, aturan, maks] = await Promise.all([
    bacaPengerjaan().catch(() => []),
    board.source === "live" ? aturanBulan(board.tab).catch(() => ({})) : {},
    maksAktif(),
  ]);
  const dipesan = dipesanPerProyek(semuaPj, board.tab);
  const milikku = {};
  let aktifku = 0;
  let laporku = []; // titik lapor progres berikutnya untuk proyek guru ini yang sedang Running
  if (sesi) {
    const punyaku = (p) => (sesi.akun.idGuru && p.idGuru === sesi.akun.idGuru) || p.email === sesi.akun.email;
    const jalan = [];
    semuaPj.forEach((p) => {
      if (!punyaku(p) || !AKTIF.has(p.status)) return;
      aktifku++;
      if (p.bulan === board.tab) milikku[p.idProyek] = p.status;
      if (p.status === ST.running) jalan.push(p);
    });
    laporku = (await lengkapiTitik(jalan))
      .map((p) => ({ p, t: titikBerikut(p) }))
      .filter((x) => x.t)
      .map(({ p, t }) => ({ id: p.id, subtes: p.subtes, persen: t.persen, tanggal: t.tanggal, min: t.min, jumlah: p.jumlah, hari: t.hm.hari }))
      .sort((a, b) => a.hari - b.hari);
  }
  // Guru hanya boleh melihat/apply proyek yang stoknya masih tersisa, dan
  // hanya kolom yang memang untuk guru: platform & tautan master TIDAK ikut
  // dikirim ke browser (bukan sekadar disembunyikan di tampilan).
  // `id` (kode baris) tetap ikut karena dicantumkan di pesan WhatsApp —
  // ada subtes bernama sama di baris berbeda.
  const open = board.projects
    .map((r) => {
      const id = String(r.id).toUpperCase();
      return {
        id: r.id,
        subtes: r.subtes,
        output: r.output,
        harga: r.harga,
        sisa: r.sisa - (dipesan[id] || 0),
        kebutuhan: r.kebutuhan,
        jenis: jenisDariId(r.idSubtes) || "Lainnya",
        deadline: aturan[id]?.deadline || "",
        titik: aturan[id]?.titik || [],
      };
    })
    // tetap tampil bila guru ini sendiri sedang mengambilnya (supaya statusnya terlihat)
    .filter((r) => (r.sisa > 0 && !hitungMundur(r.deadline).lewat) || milikku[String(r.id).toUpperCase()]);

  let guru = null;
  if (sesi) {
    const g = (guruDb?.rows || []).find((x) => x.idGuru && x.idGuru === sesi.akun.idGuru);
    guru = { nama: g?.nama || sesi.akun.nama, email: sesi.akun.email, wa: g?.wa || "" };
  }

  const brand = process.env.NEXT_PUBLIC_BRAND || "Cerebrum";
  return (
    <OpenBoard
      projects={open}
      source={board.source}
      bulan={bulan}
      waNumber={WA_ADMIN}
      panduan={panduan.rows}
      brand={brand}
      guru={guru}
      bisaMasuk={loginGuruSiap()}
      milikku={milikku}
      aktif={aktifku}
      maks={maks}
      laporku={laporku}
      pesan={searchParams?.password === "diganti" ? "Password berhasil diganti. Gunakan password baru ini untuk masuk berikutnya." : ""}
    />
  );
}
