// Hanya untuk operasi baca dan OAuth. Operasi append/struktur tidak diulang:
// koneksi putus setelah commit bisa berarti tulisan sebenarnya sudah tersimpan.
export function galatBaca(status, code) {
  const pesan = status === 429 ? "Kuota pembacaan Google Sheets sedang penuh. Akan dicoba kembali." : status === 403 ? "Akses membaca spreadsheet ditolak. Periksa izin akun layanan." : status === 401 ? "Autentikasi Google Sheets ditolak." : code === "TIMEOUT" ? "Google Sheets terlalu lama merespons." : code === "NETWORK" ? "Koneksi ke Google Sheets terputus." : status >= 500 ? "Google Sheets sedang mengalami gangguan sementara." : "Data spreadsheet belum dapat dibaca.";
  return Object.assign(new Error(pesan + (status ? ` (HTTP ${status})` : "")), { status, code: code || `HTTP_${status}` });
}

export async function bacaJsonGoogle(url, options = {}, { operasi = "read", timeoutMs = 6000, budgetMs = 22000, attempts = 4, fetcher = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), random = Math.random, now = Date.now, log = (e) => console.warn("[sheets-read]", JSON.stringify(e)) } = {}) {
  const mulai = now();
  let terakhir;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    let timer, retryAfter = 0;
    const sisa = budgetMs - (now() - mulai);
    if (sisa <= 0) break;
    try {
      // Promise.race juga membatasi pembacaan body, bukan hanya header HTTP.
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(galatBaca(0, "TIMEOUT")); }, Math.min(timeoutMs, sisa)); });
      const data = await Promise.race([timeout, (async () => {
        const res = await fetcher(url, { ...options, signal: controller.signal });
        const tunggu = res.headers?.get?.("retry-after");
        if (tunggu) retryAfter = /^\d+(\.\d+)?$/.test(tunggu) ? Number(tunggu) * 1000 : Math.max(0, Date.parse(tunggu) - now()) || 0;
        if (!res.ok) { await res.body?.cancel?.().catch(() => {}); throw galatBaca(res.status); }
        return res.json();
      })()]);
      if (i) log({ operasi, hasil: "pulih", percobaan: i + 1, durasiMs: now() - mulai });
      return data;
    } catch (error) {
      terakhir = error.code?.startsWith("HTTP_") || ["TIMEOUT", "NETWORK"].includes(error.code) ? error : galatBaca(0, error.name === "AbortError" ? "TIMEOUT" : "NETWORK");
      const ulang = !terakhir.status || [429, 500, 502, 503, 504].includes(terakhir.status);
      const jeda = Math.max(retryAfter, 1000 * 2 ** i + Math.floor(random() * 1000));
      // Log tidak berisi URL, token, kunci, isi sel, atau pesan mentah Google.
      log({ operasi, hasil: "gagal", kode: terakhir.code, status: terakhir.status || null, percobaan: i + 1, durasiMs: now() - mulai });
      if (!ulang || i === attempts - 1 || now() - mulai + jeda >= budgetMs) break;
      clearTimeout(timer);
      await sleep(jeda);
    } finally { clearTimeout(timer); }
  }
  throw terakhir || galatBaca(0, "TIMEOUT");
}

/** Gabungkan batchGet dalam jendela singkat; urutan hasil tiap pemanggil tetap. */
export function buatBatchPembaca(kirim, delayMs = 10) {
  const antrean = new Map();
  const berjalan = new Map();
  return (key, ranges, context) => {
    const identik = JSON.stringify([key, ranges]);
    if (berjalan.has(identik)) return berjalan.get(identik);
    const janji = new Promise((resolve, reject) => {
      let grup = antrean.get(key);
      if (!grup) {
        grup = []; antrean.set(key, grup);
        setTimeout(async () => {
          antrean.delete(key);
          const semua = [...new Set(grup.flatMap((r) => r.ranges))];
          try {
            const values = await kirim(semua, context);
            const byRange = new Map(semua.map((r, i) => [r, values[i] || []]));
            grup.forEach((r) => r.resolve(r.ranges.map((s) => byRange.get(s))));
          } catch (e) { grup.forEach((r) => r.reject(e)); }
        }, delayMs);
      }
      grup.push({ ranges, resolve, reject });
    });
    berjalan.set(identik, janji);
    const selesai = () => { if (berjalan.get(identik) === janji) berjalan.delete(identik); };
    janji.then(selesai, selesai);
    return janji;
  };
}
