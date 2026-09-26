// API pendaftaran & akun guru — hanya admin (middleware + cek di dalam route).
// Hash password TIDAK PERNAH dikirim ke browser; password asli hanya muncul
// sekali, di respons pembuatan/reset akun, untuk dikirim admin via WhatsApp.
import { NextResponse } from "next/server";
import { tolakBukanAdmin } from "@/lib/authServer";
import { canWrite } from "@/lib/gauth";
import { getTeachers } from "@/lib/teachers";
import { bacaAkun, buatAkun, resetPassword, setStatusAkun, setDitolak, simpanPengaturan, wajibLoginGuru, rapikanEmail, STATUS, TAB_AKUN } from "@/lib/akun";
import { daftarPendaftar, verifikasiPendaftar } from "@/lib/pendaftaran";
import { loginGuruSiap } from "@/lib/sesiGuru";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const tanpaRahasia = (a) => ({
  email: a.email,
  idGuru: a.idGuru,
  nama: a.nama,
  status: a.status,
  punyaPassword: Boolean(a.hash),
  wajibGanti: a.wajibGanti,
  dibuat: a.dibuat,
  diubah: a.diubah,
  loginTerakhir: a.loginTerakhir,
  terkunci: Boolean(a.terkunciSampai && Date.parse(a.terkunciSampai) > Date.now()),
});

export async function GET() {
  const bukan = await tolakBukanAdmin();
  if (bukan) return bukan;
  try {
    const [pendaftar, akun, guru, wajib] = await Promise.all([
      daftarPendaftar().catch((e) => ({ error: e.message })),
      bacaAkun({ segar: true }),
      getTeachers(),
      wajibLoginGuru(),
    ]);
    return NextResponse.json(
      {
        pendaftar: Array.isArray(pendaftar) ? pendaftar : [],
        errorPendaftar: pendaftar.error || "",
        akun: akun.map(tanpaRahasia),
        guru: (guru.rows || []).map((g) => ({ row: g.row, idGuru: g.idGuru, nama: g.nama, email: g.email, wa: g.wa, status: g.status })),
        wajibLogin: wajib,
        loginSiap: loginGuruSiap(),
        tabAkun: TAB_AKUN,
        canWrite: canWrite(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("akun GET:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  const bukan = await tolakBukanAdmin();
  if (bukan) return bukan;
  if (!canWrite()) return NextResponse.json({ error: "Mode baca-saja: butuh service account dengan akses Editor." }, { status: 403 });
  let body;
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json({ error: "Body bukan JSON yang valid." }, { status: 400 });
  }

  try {
    const guruDenganWa = async (kred) => {
      const rows = (await getTeachers()).rows || [];
      return kred.map((k) => ({ ...k, wa: k.wa || rows.find((g) => rapikanEmail(g.email) === k.email)?.wa || "" }));
    };

    switch (body.action) {
      case "verifikasi":
        return NextResponse.json({ ok: true, kredensial: [await verifikasiPendaftar(body.email)] });

      case "tolak":
        await setDitolak(body.email, { nama: body.nama });
        return NextResponse.json({ ok: true });

      case "batalTolak":
        await setDitolak(body.email, { batal: true });
        return NextResponse.json({ ok: true });

      case "buatAkun": {
        // body.idGuru: satu ID, daftar ID, atau "semua" (semua guru ber-email yang belum punya akun)
        const [rows, akun] = await Promise.all([getTeachers().then((t) => t.rows || []), bacaAkun({ segar: true })]);
        const punya = new Set(akun.filter((a) => a.hash).map((a) => a.email));
        const ids = body.idGuru === "semua" ? null : new Set([].concat(body.idGuru).map(String));
        const target = rows.filter(
          (g) => rapikanEmail(g.email) && !punya.has(rapikanEmail(g.email)) && (!ids || ids.has(String(g.idGuru)))
        );
        if (!target.length) return NextResponse.json({ error: "Tidak ada guru ber-email yang belum punya akun." }, { status: 400 });
        const kred = await buatAkun(target.map((g) => ({ email: g.email, idGuru: g.idGuru, nama: g.nama, wa: g.wa })));
        return NextResponse.json({ ok: true, kredensial: kred });
      }

      case "reset":
        return NextResponse.json({ ok: true, kredensial: await guruDenganWa([await resetPassword(body.email)]) });

      case "status":
        await setStatusAkun(body.email, body.status === STATUS.nonaktif ? STATUS.nonaktif : STATUS.aktif);
        return NextResponse.json({ ok: true });

      case "wajibLogin":
        if (body.nilai && !loginGuruSiap()) {
          return NextResponse.json({ error: "GURU_SESSION_SECRET belum diset di Vercel — guru belum bisa login." }, { status: 400 });
        }
        await simpanPengaturan("wajib_login_guru", body.nilai ? "TRUE" : "FALSE", "Halaman proyek guru wajib login (diatur dari dashboard admin)");
        return NextResponse.json({ ok: true });

      default:
        return NextResponse.json({ error: "Aksi tidak dikenal: " + body.action }, { status: 400 });
    }
  } catch (e) {
    console.error("akun POST:", e);
    return NextResponse.json({ error: e.message || "Gagal menyimpan." }, { status: 500 });
  }
}
