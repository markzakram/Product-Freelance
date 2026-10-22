const norm = (s) => String(s ?? "").trim().toLocaleLowerCase("id");

export const kunciSubtesPengambilan = (p) => norm(p.subtes || "Tanpa subtes");
export const kunciGuruPengambilan = (p) => p.idGuru ? `id:${p.idGuru}` : p.email ? `email:${norm(p.email)}` : `pengambilan:${p.id}`;

/** Tiap kata mempersempit hasil, termasuk bila urutan nama/kode berbeda. */
export function cocokTeksPengambilan(query, ...values) {
  const hay = norm(values.join(" "));
  return norm(query).split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
}

export function opsiFilterPengambilan(daftar, jenis) {
  const byGuru = jenis === "guru";
  const keyOf = byGuru ? kunciGuruPengambilan : kunciSubtesPengambilan;
  const grup = new Map();
  for (const p of daftar) {
    const value = keyOf(p);
    if (!grup.has(value)) grup.set(value, { value, label: byGuru ? p.nama || p.email || "Guru tanpa nama" : p.subtes || "Tanpa subtes", code: byGuru ? p.idGuru || "" : "", search: [] });
    grup.get(value).search.push(byGuru ? `${p.nama || ""} ${p.idGuru || ""} ${p.email || ""}` : `${p.subtes || ""} ${p.idProyek || ""}`);
  }
  return [...grup.values()].map((o) => ({ ...o, search: o.search.join(" ") })).sort((a, b) => a.label.localeCompare(b.label, "id") || a.value.localeCompare(b.value, "id"));
}

export function hitungOpsiPengambilan(opsi, daftar, jenis) {
  const keyOf = jenis === "guru" ? kunciGuruPengambilan : kunciSubtesPengambilan;
  const counts = new Map();
  for (const p of daftar) counts.set(keyOf(p), (counts.get(keyOf(p)) || 0) + 1);
  return opsi.map((o) => ({ ...o, count: counts.get(o.value) || 0 }));
}
