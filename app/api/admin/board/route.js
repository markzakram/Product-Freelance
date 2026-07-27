// ============================================================================
//  API dashboard admin — baca realtime + tulis balik ke Google Sheets.
//  Dilindungi middleware (cookie internal) — lihat middleware.js.
// ============================================================================

import { NextResponse } from "next/server";
import {
  getBoard,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  createProject,
  updateProject,
  deleteProject,
} from "@/lib/juli";
import { canWrite, credsDiagnosis } from "@/lib/gauth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const board = await getBoard();
  // Kalau jatuh ke data contoh, sertakan alasan pastinya untuk ditampilkan di
  // banner admin — supaya masalah konfigurasi Vercel langsung kelihatan.
  const diag = board.source === "sample" ? await credsDiagnosis() : null;
  return NextResponse.json(
    { ...board, canWrite: board.source === "live" && canWrite(), diag, at: Date.now() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

const HANDLERS = {
  "assignments:create": (b) => createAssignment(b.data || {}),
  "assignments:update": (b) => updateAssignment(b.row, b.data || {}),
  "assignments:delete": (b) => deleteAssignment(b.row),
  "projects:create": (b) => createProject(b.data || {}),
  "projects:update": (b) => updateProject(b.row, b.data || {}),
  "projects:delete": (b) => deleteProject(b.row),
};

export async function POST(req) {
  if (!canWrite()) {
    return NextResponse.json(
      {
        error:
          "Mode baca-saja: menyimpan butuh GOOGLE_SERVICE_ACCOUNT_JSON dengan akses Editor ke spreadsheet.",
      },
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
