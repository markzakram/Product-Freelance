// API pendaftaran & akun guru — hanya admin (middleware + cek di dalam route).
// Hash password TIDAK PERNAH dikirim ke browser; password asli hanya muncul
// sekali, di respons pembuatan/reset akun, untuk dikirim admin via WhatsApp.
import { NextResponse } from "next/server";
import { tolakBukanAdmin } from "@/lib/authServer";
import { canWrite } from "@/lib/gauth";
import { getTeachers } from "@/lib/teachers";
import { bacaAkun, akunPublik, buatAkun, resetPassword, setStatusAkun, simpanPengaturan, wajibLoginGuru, rapikanEmail, STATUS, TAB_AKUN } from "@/lib/akun";
import { daftarPerubahan } from "@/lib/perubahanGuru";
import { simpanSeleksi, catatQc } from "@/lib/seleksi";
import { daftarPendaftar, masukkanDataGuru, beriAkses, perluSampel } from "@/lib/pendaftaran";
import { loginGuruSiap } from "@/lib/sesiGuru";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function GET() {
  const bukan = await tolakBukanAdmin();
  if (bukan) return bukan;
  try {
    const [pendaftar, akun, guru, wajib, perubahan] = await Promise.all([
      daftarPendaftar().catch((e) => ({ error: e.message })),
      bacaAkun({ segar: true }),
      getTeachers(),
      wajibLoginGuru(),
      daftarPerubahan({ status: "Menunggu" }).catch(() => []),
    ]);
    return NextResponse.json(
      {
        pendaftar: Array.isArray(pendaftar) ? pendaftar : [],
        errorPendaftar: pendaftar.error || "",
        akun: akun.map(akunPublik),
        guru: (guru.rows || []).map((g) => ({ row: g.row, idGuru: g.idGuru, nama: g.nama, email: g.email, wa: g.wa, status: g.status })),
        wajibLogin: wajib,
        perubahan, // ajuan "Profil saya" yang menunggu persetujuan
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
      // VERIFIKASI 1 — masuk Data guru (tanpa akun). Guru baru lanjut ke tahap
      // Sampel; guru lama langsung "Siap akses".
      case "verifikasi1": {
        const g = await masukkanDataGuru(body.email);
        const tahap = perluSampel(g.statusForm) ? "Sampel" : "";
        await simpanSeleksi(body.email, { nama: g.nama, tahap });
        return NextResponse.json({ ok: true, idGuru: g.idGuru, nama: g.nama, tahap: tahap || "Siap akses" });
      }

      // VERIFIKASI 2 — akses halaman proyek: buat akun login. Guru baru yang
      // sampelnya belum lolos butuh konfirmasi eksplisit (`paksa`).
      case "verifikasi2":
        return NextResponse.json({ ok: true, kredensial: await beriAkses(body.email, { paksa: Boolean(body.paksa) }) });

      case "tolak":
        await simpanSeleksi(body.email, { nama: body.nama, tahap: "Ditolak" });
        return NextResponse.json({ ok: true });

      case "batalTolak":
        await simpanSeleksi(body.email, { tahap: "" });
        return NextResponse.json({ ok: true });

      // Tinjauan berkas: rubrik + catatan, dan (opsional) pindah tahap.
      case "tinjau":
        await simpanSeleksi(body.email, { nama: body.nama, tahap: body.tahap, skor: body.skor, catatan: body.catatan });
        return NextResponse.json({ ok: true });

      // Satu sesi QC sampel.
      case "qc":
        return NextResponse.json({ ok: true, ...(await catatQc(body.email, body.qc || {})) });

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
    if (!e.status) console.error("akun POST:", e);
    return NextResponse.json({ error: e.message || "Gagal menyimpan.", perluKonfirmasi: e.perluKonfirmasi }, { status: e.status || 500 });
  }
}
