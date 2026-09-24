// Service worker Product Freelance — sengaja minimal.
//
// Katalog, sisa kuota, dan fee harus selalu segar dari spreadsheet, jadi
// TIDAK ADA halaman atau data API yang disimpan di cache: angka basi di HP
// guru bisa membuat proyek yang sudah habis tetap diajukan. Tugasnya hanya
// satu: saat koneksi putus, tampilkan halaman offline yang jelas, bukan
// halaman error bawaan browser.
const CACHE = "pf-offline-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([OFFLINE, "/icons/guru-192.png"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      // Preload: permintaan halaman jalan paralel dengan menyalakan SW,
      // jadi adanya SW tidak memperlambat buka halaman.
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (e) => {
  // Hanya pindah halaman (GET). API, aset, dan form POST (login/logout)
  // dibiarkan lewat apa adanya.
  if (e.request.mode !== "navigate" || e.request.method !== "GET") return;
  e.respondWith(
    (async () => {
      try {
        return (await e.preloadResponse) || (await fetch(e.request));
      } catch (_) {
        return (await caches.match(OFFLINE)) || Response.error();
      }
    })()
  );
});
