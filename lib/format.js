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

// ---------------------------------------------------------------------------
//  Harga bisa berupa angka pasti ("13000") ATAU rentang tentatif
//  ("10000-13000"). Rentang disimpan apa adanya di sel — tidak ada formula
//  yang merujuk kolom harga master, jadi teks aman di sana.
// ---------------------------------------------------------------------------
export function parseHarga(v) {
  const s = norm(v);
  if (!s) return { ada: false, min: 0, max: 0, tentatif: false, raw: "" };
  // pemisah: - – — atau "s/d" / "sd"
  const m = s.split(/\s*(?:[-–—]|s\/?d)\s*/i).filter(Boolean);
  if (m.length >= 2) {
    const a = parseNum(m[0]);
    const b = parseNum(m[1]);
    if (a || b) {
      return { ada: true, min: Math.min(a, b), max: Math.max(a, b), tentatif: a !== b, raw: s };
    }
  }
  const n = parseNum(s);
  return n ? { ada: true, min: n, max: n, tentatif: false, raw: s } : { ada: false, min: 0, max: 0, tentatif: false, raw: s };
}

/**
 * Harga untuk BARIS BULANAN wajib satu angka pasti.
 *
 * Kolom Harga di sheet bulanan dipakai formula:
 *   Fee       = Jumlah × XLOOKUP(kode; B:B; F:F)
 *   Total Fee = SUMPRODUCT(F:F; G:G)
 * Kalau diisi teks seperti "5000-7000", Fee jadi #VALUE! dan Total Fee
 * diam-diam jadi 0. Rentang tentatif hanya boleh hidup di Master_Project,
 * yang tidak dirujuk formula mana pun.
 */
export function cekHargaBulanan(v) {
  const s = norm(v);
  if (!s) return { ok: false, kosong: true, pesan: "Harga belum diisi." };
  const h = parseHarga(s);
  if (h.tentatif) {
    return {
      ok: false,
      rentang: h,
      pesan:
        "Harga di baris bulanan harus satu angka pasti — dipakai untuk menghitung Fee. " +
        "Rentang tentatif hanya boleh di Master Subtes.",
    };
  }
  if (!h.ada || !/^\d[\d.,\s]*$/.test(s)) {
    return { ok: false, pesan: "Harga harus berupa angka, mis. 7000." };
  }
  return { ok: true, nilai: h.min };
}

/** Tampilkan harga: angka tunggal atau "Rp10.000 – Rp13.000". */
export function formatHarga(v, { pendek = false } = {}) {
  const h = parseHarga(v);
  if (!h.ada) return "—";
  if (!h.tentatif) return rupiah(h.min);
  return pendek ? `${rupiah(h.min)}–${numberID(h.max)}` : `${rupiah(h.min)} – ${rupiah(h.max)}`;
}
