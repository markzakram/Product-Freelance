// Utility helpers shared across the app.

export function parseNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[^0-9,-]/g, "").replace(/,/g, "");
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? 0 : n;
}

export function rupiah(v) {
  const n = typeof v === "number" ? v : parseNum(v);
  return "Rp" + n.toLocaleString("id-ID");
}

export function numberID(v) {
  const n = typeof v === "number" ? v : parseNum(v);
  return n.toLocaleString("id-ID");
}

// Normalise a cell/string for comparison (trim, collapse whitespace, lower).
export function norm(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}
