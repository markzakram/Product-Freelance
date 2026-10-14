// ============================================================================
//  Pembacaan tab "Panduan" (dipakai popup Tata Cara di halaman guru).
//
//  Katalog proyek, log fee, dan data guru TIDAK lagi dibaca di sini — semuanya
//  pindah ke lib/juli.js yang membaca tab "Juli_Proyek ASN & Bappenas".
//  Auth & helper REST ada di lib/gauth.js.
// ============================================================================

import { SHEET_IDS, authParams, tabTitles, readTab } from "./gauth";
import { parseNum, norm } from "./format";

export { isLiveConfigured } from "./gauth";

// Cadangan bila tab "Panduan" tidak terbaca — samakan dengan isi tab itu.
const PANDUAN_FALLBACK = [
  { no: 1, keterangan: "Pengenalan Website", url: "https://youtu.be/z_1lBJZeR8A" },
  { no: 2, keterangan: "Tata Cara Pengerjaan", url: "https://youtu.be/0UEGFNyD7gg" },
];

function findCol(row, label, from = 0, mode = "eq") {
  const target = norm(label).toLowerCase();
  for (let i = from; i < row.length; i++) {
    const cell = norm(row[i]).toLowerCase();
    if (!cell) continue;
    if (mode === "eq" && cell === target) return i;
    if (mode === "includes" && cell.includes(target)) return i;
    if (mode === "starts" && cell.startsWith(target)) return i;
  }
  return -1;
}

function findHeaderRow(rows, label, mode = "eq") {
  for (let r = 0; r < rows.length; r++) {
    if (findCol(rows[r] || [], label, 0, mode) !== -1) return r;
  }
  return -1;
}

function mapPanduanRows(rows) {
  const hr = findHeaderRow(rows, "Keterangan", "includes");
  if (hr === -1) return [];
  const h = rows[hr];
  const cNo = findCol(h, "#", 0, "eq");
  const cKet = findCol(h, "Keterangan", 0, "includes");
  const cUrl = findCol(h, "Pranala", 0, "includes");
  if (cKet === -1 || cUrl === -1) return [];
  const out = [];
  for (let r = hr + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const keterangan = norm(row[cKet]);
    const url = norm(row[cUrl]);
    if (!keterangan && !url) continue;
    out.push({
      no: cNo !== -1 && parseNum(row[cNo]) ? parseNum(row[cNo]) : out.length + 1,
      keterangan,
      url,
    });
  }
  return out;
}

export async function getPanduan() {
  try {
    const ap = await authParams();
    if (!ap) return { source: "sample", rows: PANDUAN_FALLBACK };
    // Tab "Panduan" ada di spreadsheet master; spreadsheet juli lama dicoba juga.
    for (const sid of [SHEET_IDS.master, SHEET_IDS.juli]) {
      try {
        const titles = await tabTitles(sid, ap);
        const title = titles.find((t) => /panduan/i.test(t));
        if (!title) continue;
        const rows = await readTab(sid, title, ap);
        const mapped = mapPanduanRows(rows);
        if (mapped.length) return { source: "live", rows: mapped };
      } catch (_) {
        /* coba spreadsheet berikutnya */
      }
    }
    return { source: "sample", rows: PANDUAN_FALLBACK };
  } catch (e) {
    console.error("getPanduan fallback:", e.message);
    return { source: "sample", rows: PANDUAN_FALLBACK };
  }
}
