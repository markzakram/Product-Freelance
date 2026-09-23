// Jenis proyek di Master_Project. Awalan ID mengikuti jenisnya (SOL-001,
// LAP-001, …) dan nomornya berurutan per jenis. Berkas ini sengaja tanpa
// impor server supaya bisa dipakai di browser (form master) maupun di server.

// Urutan ini juga urutan tampilnya di layar.
export const JENIS = [
  { kode: "SOL", nama: "Soal" },
  { kode: "LAP", nama: "Laporan FR" },
  { kode: "LIV", nama: "Liveclass" },
  { kode: "EDI", nama: "Editor" },
];

const bersih = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

export const jenisByNama = (nama) => JENIS.find((j) => j.nama.toLowerCase() === bersih(nama).toLowerCase());
export const jenisByKode = (kode) => JENIS.find((j) => j.kode === bersih(kode).toUpperCase());

/** Jenis dari awalan ID, mis. "LAP-003" -> "Laporan FR". */
export const jenisDariId = (id) => jenisByKode(/^([A-Z]{3})-\d+$/i.exec(bersih(id))?.[1])?.nama || "";

/** ID berikutnya untuk satu jenis = nomor tertinggi jenis itu + 1. */
export function nextId(rows, jenis) {
  const j = jenisByNama(jenis) || jenisByKode(jenis);
  if (!j) throw new Error(`Jenis "${jenis}" tidak dikenal. Pilih: ${JENIS.map((x) => x.nama).join(", ")}.`);
  const re = new RegExp(`^${j.kode}-(\\d+)$`, "i");
  let max = 0;
  for (const r of rows) {
    const m = re.exec(r.id || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${j.kode}-${String(max + 1).padStart(3, "0")}`;
}
