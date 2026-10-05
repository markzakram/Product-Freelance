// MODE DEMO: pulihkan data contoh di spreadsheet demo (lib/demoSeed.js).
// Situs asli selalu 404 — pengaman spreadsheet ada di pastikanDemo().
import { NextResponse } from "next/server";
import { izinAdmin } from "@/lib/authServer";
import { MODE_DEMO } from "@/lib/demo";
import { pulihkanDataContoh } from "@/lib/demoSeed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

let berjalan = false; // dua klik bersamaan di satu instans tidak saling timpa

export async function POST() {
  if (!MODE_DEMO) return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
  // semua anggota tim boleh: ini situs coba-coba, data aslinya tidak ikut
  const { tolak } = await izinAdmin([]);
  if (tolak) return tolak;
  if (berjalan) return NextResponse.json({ error: "Pemulihan data contoh sedang berjalan — tunggu sebentar." }, { status: 409 });
  berjalan = true;
  try {
    return NextResponse.json({ ok: true, hasil: await pulihkanDataContoh() });
  } catch (e) {
    console.error("demo:", e.message);
    return NextResponse.json({ error: e.message || "Gagal memulihkan data contoh." }, { status: e.status || 500 });
  } finally {
    berjalan = false;
  }
}
