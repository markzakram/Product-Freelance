// Pengambilan proyek oleh guru — dashboard tim akademik.
import { NextResponse } from "next/server";
import { izinAdmin } from "@/lib/authServer";
import { canWrite } from "@/lib/gauth";
import { getBoard } from "@/lib/juli";
import { bacaPengerjaan, putuskan, maksAktif, aturMaksAktif, review, terapkanDenda, lengkapiTitik, tandaiProgresDicek } from "@/lib/pengerjaan";
import { aturanBulan, aturDeadline, aturLapor, aturPaket, aturTipe, aturSemua } from "@/lib/aturanProyek";
import { AKTIF } from "@/lib/pengerjaanOpsi";
import { bacaAkun } from "@/lib/akun";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { tolak } = await izinAdmin(["Akademik"]);
  if (tolak) return tolak;
  const bulan = req.nextUrl.searchParams.get("bulan") || "";
  try {
    const [semua, aturan, maks, akun] = await Promise.all([bacaPengerjaan(), bulan ? aturanBulan(bulan) : {}, maksAktif(), bacaAkun().catch(() => [])]);
    const uji = akun.filter((a) => a.uji);
    const akunUji = (p) => uji.some((a) => (a.idGuru && p.idGuru === a.idGuru) || p.email === a.email);
    // beban tiap guru dihitung lintas bulan — batasnya berlaku untuk semua proyek aktif
    const aktifPerGuru = {};
    semua.forEach((p) => AKTIF.has(p.status) && (aktifPerGuru[p.idGuru || p.email] = (aktifPerGuru[p.idGuru || p.email] || 0) + 1));
    return NextResponse.json({
      pengerjaan: (await lengkapiTitik(semua.filter((p) => !bulan || p.bulan === bulan))).map((p) => (akunUji(p) ? { ...p, uji: true } : p)),
      aturan,
      maksAktif: maks,
      aktifPerGuru,
      canWrite: canWrite(),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Gagal membaca pengerjaan." }, { status: 500 });
  }
}

export async function POST(req) {
  const { sesi, tolak } = await izinAdmin(["Akademik"]);
  if (tolak) return tolak;
  if (!canWrite()) return NextResponse.json({ error: "Mode baca-saja: butuh service account dengan akses Editor." }, { status: 403 });
  try {
    const body = await req.json();
    switch (body.action) {
      case "putuskan": {
        const board = await getBoard(body.bulan);
        return NextResponse.json({ ok: true, pengerjaan: await putuskan(body.id, { acc: Boolean(body.acc), catatan: body.catatan }, sesi.nama, board) });
      }
      case "review":
        return NextResponse.json({
          ok: true,
          hasil: await review(body.id, { setuju: body.setuju, revisi: body.revisi, tolak: body.tolak, tujuanTolak: body.tujuanTolak, catatan: body.catatan }, sesi.nama),
        });
      case "denda":
        return NextResponse.json({ ok: true, hasil: await terapkanDenda(body.id, sesi.nama) });
      case "deadline":
        return NextResponse.json({ ok: true, ...(await aturDeadline(body.bulan, body.idProyek, body.deadline, sesi.nama)) });
      case "lapor":
        return NextResponse.json({ ok: true, ...(await aturLapor(body.bulan, body.idProyek, body.persen, body.tanggal, sesi.nama)) });
      case "aturan": // panel "Atur" di Katalog — semua aturan satu proyek sekaligus
        return NextResponse.json({ ok: true, ...(await aturSemua(body.bulan, body.idProyek, body.aturan || {}, sesi.nama)) });
      case "tipe":
        return NextResponse.json({ ok: true, ...(await aturTipe(body.bulan, body.idProyek, body.tipe, sesi.nama)) });
      case "paket":
        return NextResponse.json({ ok: true, ...(await aturPaket(body.bulan, body.idProyek, body.isi, sesi.nama)) });
      case "progresDicek":
        return NextResponse.json({ ok: true, ...(await tandaiProgresDicek(body.id, sesi.nama)) });
      case "maksAktif":
        return NextResponse.json({ ok: true, maksAktif: await aturMaksAktif(body.nilai) });
      default:
        return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
    }
  } catch (e) {
    if (!e.status) console.error("pengerjaan POST:", e);
    return NextResponse.json({ error: e.message || "Gagal menyimpan." }, { status: e.status || 500 });
  }
}
