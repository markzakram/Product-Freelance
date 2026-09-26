// API data guru freelance — dilindungi middleware (cookie internal).
import { NextResponse } from "next/server";
import { tolakBukanAdmin } from "@/lib/authServer";
import { getTeachers, createTeacher, updateTeacher } from "@/lib/teachers";
import { pindahkanEmail } from "@/lib/akun";
import { canWrite } from "@/lib/gauth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const bukan = await tolakBukanAdmin();
  if (bukan) return bukan;
  const t = await getTeachers();
  return NextResponse.json(
    { ...t, canWrite: t.source === "live" && canWrite() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req) {
  const bukan = await tolakBukanAdmin();
  if (bukan) return bukan;
  if (!canWrite()) {
    return NextResponse.json({ error: "Mode baca-saja: butuh service account dengan akses Editor." }, { status: 403 });
  }
  let body;
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json({ error: "Body bukan JSON yang valid." }, { status: 400 });
  }
  try {
    if (body.action === "create") {
      return NextResponse.json({ ok: true, ...(await createTeacher({ ...(body.data || {}), force: body.force })) });
    }
    if (body.action === "update") {
      const hasil = await updateTeacher(body.row, body.data || {});
      // Email = nama login guru: kalau diganti di sini, akunnya ikut pindah.
      let peringatan = "";
      if ("email" in (body.data || {})) {
        const g = ((await getTeachers()).rows || []).find((x) => x.row === Number(body.row));
        if (g) await pindahkanEmail(g.idGuru, body.data.email).catch((e) => (peringatan = "Data guru tersimpan, tapi email akun tidak ikut diganti: " + e.message));
      }
      return NextResponse.json({ ok: true, ...hasil, peringatan });
    }
    return NextResponse.json({ error: "Aksi tidak dikenal: " + body.action }, { status: 400 });
  } catch (e) {
    if (e.duplicate) return NextResponse.json({ error: e.message, duplicate: e.duplicate }, { status: 409 });
    console.error("teachers write:", e);
    return NextResponse.json({ error: e.message || "Gagal menyimpan." }, { status: 500 });
  }
}
