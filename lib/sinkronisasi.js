// Satu pembacaan per kunci. Permintaan segar sesudah menyimpan wajib menunggu
// pembacaan lama selesai lalu mengambil ulang; tidak ikut hasil sebelum simpan.
export function buatAntrianSinkron() {
  const aktif = new Map();
  return function baca(key, ambil, segar = false) {
    const lama = aktif.get(key);
    if (lama) {
      if (lama.berikut) return lama.berikut;
      if (!segar) return lama.janji;
      lama.berikut = lama.janji.catch(() => {}).then(() => baca(key, ambil, true));
      return lama.berikut;
    }
    const entri = { segar, janji: Promise.resolve().then(ambil) };
    aktif.set(key, entri);
    const selesai = () => { if (aktif.get(key) === entri) aktif.delete(key); };
    entri.janji.then(selesai, selesai);
    return entri.janji;
  };
}

export async function bacaApi(url, { timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Waktu tunggu pembaruan habis. Data terakhir tetap ditampilkan.")); }, timeoutMs); }),
      (async () => {
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j || j.error || j.source === "error") throw Object.assign(new Error(j?.error || `Gagal membaca data (HTTP ${res.status}).`), { status: res.status, expired: res.status === 401 });
        return j;
      })(),
    ]);
  } catch (e) {
    if (e instanceof TypeError) throw new Error("Koneksi pembaruan terputus. Data terakhir tetap ditampilkan.");
    throw e;
  } finally { clearTimeout(timer); }
}

/** Focus + visibility yang berdekatan hanya memicu satu sinkronisasi. */
export function jadwalkanSinkron(ambil, { doc = document, win = window, interval = 45000, debounce = 250, now = Date.now, random = Math.random } = {}) {
  let timer, cepat, berjalan = false, selesai = false, terakhir = 0, gagal = 0;
  const jadwal = () => {
    clearTimeout(timer);
    if (!selesai && doc.visibilityState !== "hidden" && win.navigator?.onLine !== false) timer = setTimeout(jalankan, Math.min(180000, interval * 2 ** gagal) + Math.floor(random() * 3000));
  };
  const jalankan = async () => {
    if (selesai || berjalan || doc.visibilityState === "hidden" || win.navigator?.onLine === false) return;
    berjalan = true;
    try { const ok = await ambil(); gagal = ok === false ? Math.min(gagal + 1, 2) : 0; }
    catch { gagal = Math.min(gagal + 1, 2); }
    finally { berjalan = false; terakhir = now(); jadwal(); }
  };
  const bangun = () => {
    clearTimeout(cepat);
    if (doc.visibilityState === "hidden" || win.navigator?.onLine === false) { clearTimeout(timer); return; }
    // Kembali ke aplikasi memicu sinkron, tapi tidak bila baru saja sinkron
    // (bolak-balik WhatsApp ↔ dashboard tidak boleh menghabiskan kuota baca).
    if (!berjalan && now() - terakhir > Math.min(15000, interval / 3)) cepat = setTimeout(jalankan, debounce);
    else jadwal();
  };
  doc.addEventListener("visibilitychange", bangun);
  for (const e of ["focus", "online", "offline"]) win.addEventListener(e, bangun);
  jadwal();
  return () => { selesai = true; clearTimeout(timer); clearTimeout(cepat); doc.removeEventListener("visibilitychange", bangun); for (const e of ["focus", "online", "offline"]) win.removeEventListener(e, bangun); };
}
