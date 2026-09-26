// ============================================================================
//  API dashboard admin — baca realtime + tulis balik ke Google Sheets.
//  Dilindungi middleware (cookie internal) — lihat middleware.js.
//
//  Semua operasi menerima parameter `bulan` supaya admin bisa mengelola bulan
//  mana pun dari dashboard, bukan hanya bulan terbaru.
// ============================================================================

import { NextResponse } from "next/server";
import { tolakBukanAdmin } from "@/lib/authServer";
import {
  getBoard,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  createProject,
  updateProject,
  deleteProject,
} from "@/lib/juli";
import { canWrite, credsDiagnosis, probeWriteAccess, getCreds } from "@/lib/gauth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req) {
  const bukan = await tolakBukanAdmin();
  if (bukan) return bukan;
  const bulan = req.nextUrl.searchParams.get("bulan") || "";
  const board = await getBoard(bulan);
  const diag = board.source === "sample" ? await credsDiagnosis() : null;

  // Kredensial bisa saja ada tapi spreadsheet hanya dibagikan sebagai Viewer.
  // Diperiksa di muka supaya admin diberi tahu sebelum mengisi form panjang.
  let sheetWritable = true;
  if (board.source === "live" && canWrite()) sheetWritable = await probeWriteAccess();

  return NextResponse.json(
    {
      ...board,
      canWrite: board.source === "live" && canWrite() && sheetWritable,
      sheetWritable,
      serviceAccount: getCreds()?.client_email || "",
      diag,
      at: Date.now(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

const HANDLERS = {
  "assignments:create": (b) => createAssignment(b.data || {}, b.bulan),
  "assignments:update": (b) => updateAssignment(b.row, b.data || {}, b.bulan),
  "assignments:delete": (b) => deleteAssignment(b.row, b.bulan),
  "projects:create": (b) => createProject(b.data || {}, b.bulan),
  "projects:update": (b) => updateProject(b.row, b.data || {}, b.bulan),
  "projects:delete": (b) => deleteProject(b.row, b.bulan),
};

export async function POST(req) {
  const bukan = await tolakBukanAdmin();
  if (bukan) return bukan;
  if (!canWrite()) {
    return NextResponse.json(
      { error: "Mode baca-saja: menyimpan butuh GOOGLE_SERVICE_ACCOUNT_JSON dengan akses Editor." },
      { status: 403 }
    );
  }
  let body;
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json({ error: "Body bukan JSON yang valid." }, { status: 400 });
  }
  const key = `${body.table}:${body.action}`;
  const handler = HANDLERS[key];
  if (!handler) {
    return NextResponse.json({ error: `Aksi tidak dikenal: ${key}` }, { status: 400 });
  }
  try {
    const result = await handler(body);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("admin write error:", e);
    return NextResponse.json({ error: e.message || "Gagal menyimpan ke spreadsheet." }, { status: 500 });
  }
}
