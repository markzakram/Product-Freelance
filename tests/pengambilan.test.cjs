const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");

async function load(file, overrides = {}, globals = {}) {
  const context = vm.createContext({ console, process: { env: { NODE_ENV: "test" } }, ...globals });
  const cache = new Map();
  function moduleFor(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const values = overrides[filename];
    const module = values ? new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context, identifier: filename }) : filename.startsWith("node:") ? new vm.SyntheticModule(["default"], function () { this.setExport("default", require(filename)); }, { context, identifier: filename }) : new vm.SourceTextModule(fs.readFileSync(filename, "utf8"), { context, identifier: filename });
    cache.set(filename, module);
    return module;
  }
  const entry = moduleFor(path.join(root, file));
  await entry.link((specifier, parent) => moduleFor(specifier.startsWith("node:") || overrides[specifier] ? specifier : path.resolve(specifier.startsWith("@/") ? root : path.dirname(parent.identifier), (specifier.startsWith("@/") ? specifier.slice(2) : specifier) + (path.extname(specifier) ? "" : ".js"))));
  await entry.evaluate();
  return entry.namespace;
}

const time = (day, hour = 9) => Date.UTC(2026, 9, day, hour - 7);
const base = { id: "PJ-1", bulan: "Oktober_", idProyek: "PU-01", idGuru: "1", nama: "Ayu", email: "ayu@test.invalid", jumlah: 20, status: "Running", laporan: [], riwayat: [], tAcc: time(18), titik: [{ persen: 30, tanggal: "2026-10-19" }, { persen: 50, tanggal: "2026-10-22" }] };
const report = (id, day, persen, soal, versi = 1, jenis = "laporan") => ({ id: `${id}-v${versi}`, laporanId: id, noLaporan: persen === 30 ? 1 : 2, versi, jenis, persen, soal, waktu: `${day}/10/2026 09:00`, t: time(day), link: "https://docs.google.com/document/d/test" });

test("CLO notifications separate the inspected revision from the next requested revision", async () => {
  const m = await load("lib/notifikasiClo.js");
  const p = { ...base, status: "Revisi", ronde: 1, riwayat: [report("A", 19, 100, 20, 1, "pengumpulan"),
    { id: "qc1", jenis: "review", persen: 100, versi: 1, t: time(20), oleh: "RAD", meta: { revisi: 20 } }] };
  let n = m.notifikasiClo([p]);
  assert.equal(n[0].judul, "QC kiriman awal selesai");
  assert.equal(n[0].hasil, "Revisi 1 diminta · Hasil akhir");
  assert.equal(n[0].keputusanId, "qc1");
  p.riwayat.push({ id: "k1", jenis: "kabar", t: time(20, 12), meta: { keputusanId: "qc1" } });
  assert.equal(m.notifikasiClo([p]).length, 0);
  p.riwayat.push(report("A", 21, 100, 20, 2, "revisi_akhir"));
  p.status = "Ready to review";
  assert.equal(m.notifikasiClo([p]).length, 0, "new teacher submission is not a finished QC");
  p.status = "Revisi";
  p.riwayat.push({ id: "qc2", jenis: "review", persen: 100, versi: 2, t: time(22), meta: { revisi: 10 } });
  n = m.notifikasiClo([p]);
  assert.equal(n.length, 1);
  assert.equal(n[0].judul, "QC revisi 1 selesai");
  assert.equal(n[0].hasil, "Revisi 2 diminta · Hasil akhir");
  assert.equal(n[0].keputusanId, "qc2", "contact of qc1 never marks qc2 contacted");
  p.riwayat.push(report("A", 23, 100, 20, 3, "revisi_akhir"), { id: "qc3", jenis: "review", persen: 100, versi: 3, t: time(24), meta: { setuju: 10, revisi: 0 } });
  p.status = "Selesai";
  n = m.notifikasiClo([p]);
  assert.equal(n.length, 1, "superseded uncontacted qc2 does not remain actionable");
  assert.equal(n[0].judul, "QC revisi 2 selesai");
  assert.equal(n[0].hasil, "Pekerjaan selesai");
});

test("CLO notifications target separate progress reports, exclude ACC, deduplicate and sort newest first", async () => {
  const m = await load("lib/notifikasiClo.js");
  const p = { ...base, riwayat: [report("L1", 19, 30, 6), { id: "c1", jenis: "dicek", laporanId: "L1", persen: 30, versi: 1, t: time(20) },
    report("L2", 21, 50, 10), { id: "c2", jenis: "minta_revisi", laporanId: "L2", noLaporan: 2, persen: 50, versi: 1, t: time(22) }] };
  const acc = { ...base, id: "ACC", riwayat: [{ id: "a", jenis: "acc", t: time(23) }] };
  let n = m.notifikasiClo([p, p, acc]);
  assert.equal(n.length, 2);
  assert.deepEqual(Array.from(n, (x) => x.keputusanId), ["c2", "c1"]);
  assert.match(n[0].judul, /laporan 2 · 50%/);
  p.riwayat.push({ id: "k", jenis: "kabar", t: time(23), meta: { keputusanId: "c2" } });
  assert.equal(m.notifikasiClo([p])[0].keputusanId, "c1");
  p.riwayat.push(report("L1", 24, 30, 6, 2, "revisi_laporan"));
  assert.equal(m.notifikasiClo([p]).length, 0, "new progress version supersedes the old result");
});

test("legacy final QC uses the recorded round and does not invent results for unknown work", async () => {
  const m = await load("lib/notifikasiClo.js");
  const n = m.notifikasiClo([{ ...base, status: "Revisi", ronde: 3, tepat: 10, direview: "23/10/2026 09:00", reviewer: "RAD", catatanRevisi: "Perbaiki", batasRevisi: "26/10/2026 09:00" }]);
  assert.equal(n.length, 1);
  assert.equal(n[0].judul, "QC revisi 2 selesai");
  assert.match(n[0].hasil, /Revisi 3 diminta/);
  assert.equal(m.notifikasiClo([{ ...base, status: "Selesai" }]).length, 0);
});

test("log cards follow filtered rows while quota remains the actual capacity of related projects", async () => {
  const m = await load("lib/ringkasanLog.js");
  const projects = [{ id: "A", kebutuhan: 100, sisa: 30 }, { id: "B", kebutuhan: 50, sisa: 20 }];
  const rows = [{ idProject: "A", guru: "Ayu", idGuru: "1", jumlah: 20, fee: 200000, status: "Approved" },
    { idProject: "A", guru: "Bima", idGuru: "2", jumlah: 50, fee: 500000, status: "QC Soal" },
    { idProject: "B", guru: "Citra", idGuru: "3", jumlah: 30, fee: 300000, status: "Revisi Soal" }];
  let s = m.ringkasanLog(rows, projects);
  assert.deepEqual([s.diambil, s.feeTotal, s.kebutuhan, s.sisa, s.guruAktif], [100, 1000000, 150, 50, 3]);
  s = m.ringkasanLog(rows.slice(0, 1), projects, true);
  assert.deepEqual([s.diambil, s.feeTotal, s.kebutuhan, s.sisa, s.guruAktif], [20, 200000, 100, 30, 1], "teacher filtering must not free another teacher's quota");
  assert.equal(m.ringkasanLog(rows.slice(0, 2), projects, true).kebutuhan, 100, "one project is never counted twice");
  assert.deepEqual(Object.values(m.ringkasanLog([], projects, true)), [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(m.ringkasanLog([], projects, false).sisa, 50, "no filter retains the whole catalog, even without logs");
});

test("log cards exclude cancellation amounts, handle unknown projects and preserve teacher identities", async () => {
  const m = await load("lib/ringkasanLog.js");
  const rows = [
    { idProject: "a", guru: "Ayu", idGuru: "1", jumlah: 10, fee: 100000, status: "Approved" },
    { idProject: "A", guru: "Ayu", idGuru: "2", jumlah: 5, fee: 50000 },
    { idProject: "A", guru: "Dina", idGuru: "3", jumlah: 5, fee: 50000 },
    { idProject: "A", guru: " dina ", jumlah: 5, fee: 50000 },
    { idProject: "A", guru: "Cancel Guru", jumlah: 100, fee: 9000000, status: " Cancel " },
    { idProject: "A", guru: "Cadangan", jumlah: 0, fee: 0 },
  ];
  const s = m.ringkasanLog(rows, [{ id: "A", kebutuhan: 20, sisa: -5 }], true);
  assert.deepEqual([s.diambil, s.feeTotal, s.sisa, s.pct, s.guruAktif], [25, 250000, -5, 125, 3]);
  const orphan = m.ringkasanLog([{ idProject: "UNKNOWN", jumlah: 10, fee: 100000 }], [], true);
  assert.equal(orphan.diambil, 10);
  assert.equal(orphan.kebutuhan, 0);
  assert.equal(orphan.pct, 0);
});

test("dashboard separates catalog occupancy, final submissions and approved review quantities", async () => {
  const m = await load("lib/pengambilanDashboard.js");
  const projects = [{ id: "PU-01", subtes: "Penalaran Umum", kebutuhan: 100, sisa: 40 }, { id: "PU-02", subtes: " penalaran umum ", kebutuhan: 50, sisa: 30 }];
  const list = [
    { ...base, status: "Revisi", jumlah: 20, tepat: 6, telat: 2, riwayat: [{ ...report("final", 22, 100, 20), jenis: "pengumpulan" }] },
    { ...base, id: "PJ-2", status: "Ready to review", jumlah: 20, riwayat: [{ ...report("final-2", 22, 100, 20), jenis: "pengumpulan" }] },
    { ...base, id: "PJ-3", status: "Dibatalkan", jumlah: 20, tepat: 20 },
  ];
  const s = m.ringkasanPengambilan(projects, list.map((p) => ({ ...p, subtes: "Penalaran Umum" })), time(23));
  assert.equal(s.target, 150);
  assert.equal(s.terisi, 80, "occupancy comes from catalog, not reports");
  assert.equal(s.lolos, 8, "only cumulative approved quantities count, including partial reviews");
  assert.equal(s.subtes.length, 1, "equivalent subtest names combine multiple catalog outputs");
  assert.equal(s.subtes[0].periksa, 1);
  assert.equal(s.subtes[0].revisi, 1);
  assert.equal(m.soalDisetujui({ jumlah: 20, tepat: 30, telat: 5 }), 20);
  assert.equal(projects[0].sisa, 40);
});

test("dashboard clicks and matrix focus share one predicate and exclude closed progress tasks", async () => {
  const m = await load("lib/pengambilanDashboard.js");
  const list = [
    { ...base, id: "pending", status: "Diajukan" },
    { ...base, id: "progress", riwayat: [report("p1", 22, 30, 6)] },
    { ...base, id: "qc1", status: "Ready to review", ronde: 0 },
    { ...base, id: "qc2", status: "Ready to review", ronde: 2 },
    { ...base, id: "closed", status: "Selesai", tepat: 20, riwayat: [report("old", 19, 30, 6)] },
  ];
  const s = m.ringkasanPengambilan([], list, time(23));
  assert.equal(s.counts.tugas, 4);
  assert.equal(s.counts.ulang, 1);
  assert.equal(s.counts.awal, 1);
  assert.equal(s.counts.periksa, 3);
  for (const [key, n] of Object.entries(s.counts)) assert.equal(s.baris.filter((r) => m.cocokFokusKerja(r, key)).length, n);
  assert.equal(m.cocokFokusKerja(s.baris.find((r) => r.p.id === "closed"), "progres"), false);
});

test("dashboard zero and over-capacity states retain real values without inventing completion", async () => {
  const m = await load("lib/pengambilanDashboard.js");
  const empty = m.ringkasanPengambilan([], []);
  assert.equal(empty.target, 0);
  assert.equal(empty.terisi, 0);
  assert.equal(empty.lolos, 0);
  assert.equal(empty.counts.semua, 0);
  const extra = m.ringkasanPengambilan([{ id: "PU-01", subtes: "PU", kebutuhan: 10, sisa: -5 }], []);
  assert.equal(extra.terisi, 15, "actual over-allocation remains visible");
  assert.equal(extra.lolos, 0, "filling catalog quota does not approve work");
});

test("dropdown options preserve teacher identities and merge equivalent subtest names", async () => {
  const m = await load("lib/pengambilanFilter.js");
  const rows = [
    { id: "p1", nama: "Ayu", idGuru: "1", subtes: "Penalaran Umum", idProyek: "PU-01" },
    { id: "p2", nama: "Ayu", idGuru: "1", subtes: "Literasi", idProyek: "LI-02" },
    { id: "p3", nama: "Ayu", idGuru: "2", subtes: " penalaran umum ", idProyek: "PU-02" },
    { id: "p4", nama: "Bima", email: "BIMA@TEST.INVALID", subtes: "Literasi" },
    { id: "p5", nama: "Bima", email: "bima@test.invalid", subtes: "Literasi" },
  ];
  const guru = m.opsiFilterPengambilan(rows, "guru");
  assert.equal(guru.length, 3, "same name with different IDs stays selectable separately");
  assert.equal(m.opsiFilterPengambilan(rows, "subtes").length, 2);
  const counts = m.hitungOpsiPengambilan(guru, rows.filter((p) => m.kunciSubtesPengambilan(p) === "literasi"), "guru");
  assert.equal(counts.find((o) => o.value === "id:1").count, 1);
  assert.equal(counts.find((o) => o.value === "id:2").count, 0, "an excluded teacher remains available with a zero count");
  assert.equal(counts.find((o) => o.value === "email:bima@test.invalid").count, 2);
});

test("text searches narrow dropdowns by multiple words, codes, and email", async () => {
  const m = await load("lib/pengambilanFilter.js");
  assert.equal(m.cocokTeksPengambilan(" UMUM pu-02 ", "Penalaran Umum", "PU-02"), true);
  assert.equal(m.cocokTeksPengambilan("BIMA @test", "Bima Pratama", "bima@test.invalid"), true);
  assert.equal(m.cocokTeksPengambilan("Bima literasi", "Bima Pratama", "Penalaran Umum"), false);
  assert.equal(m.cocokTeksPengambilan("", undefined, null), true);
});

test("RAD and CLO permissions support legacy accounts without granting CLO QC writes", async () => {
  const m = await load("lib/peranTim.js");
  for (const role of ["RAD", "Akademik"]) {
    const p = { peran: [role] };
    assert.equal(m.bolehTim(p, ["Akademik"]), true);
    assert.equal(m.bolehTim(p, ["Seleksi"]), false);
    assert.deepEqual(Array.from(m.timPantauan(p)), ["rad"]);
  }
  for (const role of ["CLO", "Seleksi"]) {
    const p = { peran: [role] };
    assert.equal(m.bolehTim(p, ["Akademik"]), false);
    assert.equal(m.bolehTim(p, ["Seleksi"]), true);
    assert.deepEqual(Array.from(m.timPantauan(p)), ["clo"]);
  }
  assert.deepEqual(Array.from(m.timPantauan({ peran: ["Pemilik"], pemilik: true })), ["rad", "clo"]);
  assert.equal(m.bolehTim(null), false);
});

test("team-role parsing preserves legacy separators and matches complete role names", async () => {
  const full = (name) => path.join(root, "lib", name + ".js");
  const m = await load("lib/akunTim.js", {
    [full("tabSheet")]: { namaTab: (s) => s, pastikanTab: async () => {}, bacaBaris: async () => [], tambahBaris: async () => {}, ubahBaris: async () => {} },
    [full("sandi")]: { hashPassword: async () => "", passwordAcak: () => "" },
    [full("akun")]: { waktuWib: () => "" },
  }, { TextEncoder, TextDecoder });
  assert.deepEqual(Array.from(m.rapikanPeran("Akademik / Seleksi")), ["Seleksi", "Akademik"]);
  assert.deepEqual(Array.from(m.rapikanPeran("RAD & CLO")), ["RAD", "CLO"]);
  assert.deepEqual(Array.from(m.rapikanPeran(["rad", "CLO"])), ["RAD", "CLO"]);
  assert.deepEqual(Array.from(m.rapikanPeran("RADAR")), []);
});

test("notification scope follows the current report version, decision and assignment", async () => {
  const m = await load("lib/pantauanOpsi.js");
  const l1 = report("L1", 19, 30, 6);
  const r1 = { id: "r1", jenis: "minta_revisi", laporanId: "L1", noLaporan: 1, versi: 1, persen: 30, t: time(20) };
  const sent = { id: "sent1", jenis: "kabar", meta: { keputusanId: "r1" }, oleh: "Rani", t: time(20, 10) };
  const p = { ...base, riwayat: [l1, r1, sent] };
  assert.equal(m.barisPantauan(p).siap.length, 0);
  p.riwayat.push(report("L1", 21, 30, 6, 2, "revisi_laporan"));
  assert.equal(m.keputusanPengambilan(p).length, 0, "new delivery awaits its own inspection");
  const r2 = { ...r1, id: "r2", versi: 2, t: time(22) };
  p.riwayat.push(r2);
  assert.equal(m.barisPantauan(p).siap.length, 1);
  assert.match(m.barisPantauan(p).siap[0].judul, /Revisi 2 diminta/);
  assert.equal(m.kabarKeputusan(p, r2), null);
  assert.equal(m.kabarKeputusan({ ...base, id: "PJ-OTHER", riwayat: [] }, r1), null);
  p.riwayat.push(report("L2", 22, 50, 10), { id: "check2", jenis: "dicek", laporanId: "L2", noLaporan: 2, versi: 1, persen: 50, t: time(22, 11) });
  assert.equal(m.barisPantauan(p).siap.length, 2, "30% revision and 50% result remain separate");
  assert.equal(m.kabarKeputusan(p, r1).oleh, "Rani", "prior contact remains in journal");
});

test("new final submission invalidates previous QC contact until review of the new version", async () => {
  const m = await load("lib/pantauanOpsi.js");
  const p = { ...base, status: "Revisi", riwayat: [
    { ...report("A1", 19, 100, 20), jenis: "pengumpulan" },
    { id: "qc1", jenis: "review", laporanId: "A1", versi: 1, persen: 100, t: time(20), meta: { revisi: 20 } },
    { id: "sentqc1", jenis: "kabar", t: time(20, 11), meta: { keputusanId: "qc1" } },
  ] };
  assert.equal(m.barisPantauan(p).sudah.length, 1);
  p.status = "Ready to review";
  p.riwayat.push({ ...report("A1", 21, 100, 20, 2), jenis: "revisi_akhir" });
  assert.equal(m.barisPantauan(p).keputusan.length, 0);
  assert.equal(m.barisPantauan(p).tahap, "qc");
  p.status = "Revisi";
  p.riwayat.push({ id: "qc2", jenis: "review", laporanId: "A1", versi: 2, persen: 100, t: time(22), meta: { revisi: 10, setuju: 10 } });
  assert.equal(m.barisPantauan(p).siap.length, 1);
  assert.match(m.pesanKabar(p, m.keputusanPengambilan(p)[0]), /Revisi 2 diminta/);
});

test("reminder confirmations expire at the next WIB day and when a schedule changes", async () => {
  const m = await load("lib/pantauanOpsi.js");
  const now = time(22, 23);
  const p = { ...base, deadline: "2026-10-22", riwayat: [] };
  const first = m.pengingatPantauan(p, now)[0];
  p.riwayat.push({ id: "rem1", jenis: "reminder", t: now, meta: { pengingatId: first.key } });
  assert.ok(m.pengingatPantauan(p, now)[0].terkirim);
  assert.equal(m.pengingatPantauan(p, time(23, 1))[0].terkirim, null);
  assert.equal(m.pengingatPantauan({ ...p, deadline: "2026-10-23" }, now)[0].terkirim, null);
});

test("older journal snapshots recover their known review round and closed work has no pending progress tasks", async () => {
  const m = await load("lib/pantauanOpsi.js");
  const p = { ...base, status: "Revisi", riwayat: [
    { ...report("AF", 19, 100, 20, 2), jenis: "pengumpulan", lama: true },
    { id: "legacy-qc", jenis: "review", persen: 100, versi: 1, lama: true, meta: { ronde: 2, revisi: 5 }, t: time(22) },
  ] };
  assert.equal(m.keputusanPengambilan(p)[0].versi, 2);
  assert.match(m.judulKeputusan(m.keputusanPengambilan(p)[0]), /Revisi 2/);
  assert.equal(m.progresBelumDiperiksa({ ...base, status: "Selesai", riwayat: [report("old", 19, 30, 6)] }).length, 0);
});

test("recruiting excludes quota already reserved by pending approvals", async () => {
  const m = await load("lib/pantauanOpsi.js");
  const projects = [{ id: "A1", sisa: 30 }, { id: "A2", sisa: 80 }];
  const result = m.proyekButuhGuru(projects, [{ idProyek: "a1", jumlah: 30, status: "Diajukan" }, { idProyek: "A2", jumlah: 20, status: "Diajukan" }, { idProyek: "A2", jumlah: 50, status: "Running" }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "A2");
  assert.equal(result[0].tersedia, 60);
  assert.equal(projects[1].sisa, 80, "catalogue source is not mutated");
});

test("milestones retain separate report states; revision counts are cumulative", async () => {
  const m = await load("lib/pengerjaanOpsi.js");
  const l1 = report("L1", 19, 30, 6);
  const revision = report("L1", 20, 30, 6, 2, "revisi_laporan");
  const p = { ...base, riwayat: [l1, revision, { id: "check", jenis: "dicek", laporanId: "L1", versi: 2, persen: 30, t: time(20, 11) }, report("L2", 22, 50, 10)] };
  assert.equal(m.laporanGuru(p).length, 2);
  assert.equal(m.progresPengambilan(p).soal, 10);
  assert.equal(m.tahapPengambilan(p, 30).label, "Diperiksa");
  assert.equal(m.tahapPengambilan(p, 50).label, "Baru");
  assert.equal(m.laporanBaru(p).length, 1);
  assert.equal(m.tahapAktif(p), 50);
  p.riwayat.push(report("L1", 23, 30, 6, 3, "revisi_laporan"));
  assert.equal(m.tahapAktif(p), 50, "fixing an older report must not regress current milestone");
});

test("100% submission remains distinct from completion and rejections", async () => {
  const m = await load("lib/pengerjaanOpsi.js");
  const p = { ...base, status: "Revisi", riwayat: [{ ...report("A1", 22, 100, 20), jenis: "pengumpulan" }] };
  assert.equal(m.progresPengambilan(p).persen, 100);
  assert.equal(m.tahapAktif(p), 100);
  assert.equal(m.tahapPengambilan(p, 100).label, "Revisi");
  assert.equal(m.tahapAktif({ ...base, status: "Diajukan" }), null);
  assert.equal(m.tahapAktif({ ...base, status: "Ditolak" }), null);
});

test("revision summaries distinguish the last delivered fix from the next requested fix", async () => {
  const m = await load("lib/pengerjaanOpsi.js");
  const p = { ...base, riwayat: [report("L1", 19, 30, 6), report("L1", 20, 30, 6, 2, "revisi_laporan"), { id: "request-2", jenis: "minta_revisi", persen: 30, laporanId: "L1", versi: 2, waktu: "22/10/2026 09:00", t: time(22) }, report("L2", 22, 50, 10)] };
  const siklus = m.siklusRevisi(p, 30, "L1");
  assert.equal(siklus.dikirim, 1);
  assert.equal(siklus.diminta, 2);
  assert.equal(m.labelSiklusRevisi(siklus), "Revisi 2 diminta");
  assert.equal(m.tahapPengambilan(p, 30).waktu, "22/10/2026 09:00", "matrix date follows the request, not the older delivery");
  assert.equal(m.siklusRevisi(p, 50, "L2").diminta, 0, "requests do not spill into another report");
  p.riwayat.push(report("L1", 23, 30, 6, 3, "revisi_laporan"));
  assert.equal(m.labelSiklusRevisi(m.siklusRevisi(p, 30, "L1")), "Revisi 2 dikirim");
  assert.equal(m.tahapAktif(p), 50);
});

async function system(legacy = {}) {
  const store = { at: time(19), history: [], row: Array(44).fill(""), transactions: [], fail: false };
  const full = (name) => path.join(root, "lib", name + ".js");
  const value = (v) => v?.userEnteredValue?.stringValue || "";
  class Clock extends Date { static now() { return store.at; } }
  const waktu = () => { const d = new Date(store.at + 7 * 3600000).toISOString(); return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} ${d.slice(11, 16)}`; };
  const m = await load("lib/pengerjaan.js", {
    [full("tabSheet")]: { namaTab: (name) => name, bacaBaris: async () => [{ row: 2, v: [...store.row] }], tambahBaris: async () => {}, ubahBaris: async () => { throw Error("Unexpected non-atomic write"); }, pastikanTab: async () => {}, kolomAkhir: () => "AR" },
    [full("gauth")]: {
      SHEET_IDS: { master: "isolated-test" }, authParams: async () => ({ write: true }), batchRead: async () => [store.history], batchClear: async () => {},
      sheetMeta: async () => [{ title: "Pengerjaan", sheetId: 1 }, { title: "Riwayat pengerjaan", sheetId: 2 }],
      structuralUpdate: async (id, requests) => {
        if (store.fail) throw Error("Simulated atomic failure");
        assert.equal(id, "isolated-test");
        store.transactions.push(requests);
        for (const req of requests) {
          if (req.updateCells) { assert.equal(req.updateCells.start.sheetId, 1); store.row[req.updateCells.start.columnIndex] = value(req.updateCells.rows[0].values[0]); }
          if (req.appendCells) { assert.equal(req.appendCells.sheetId, 2); store.history.push(...req.appendCells.rows.map((r) => r.values.map(value))); }
        }
      },
    },
    [full("akun")]: { waktuWib: waktu, bacaPengaturan: async () => ({}), simpanPengaturan: async () => {} },
    [full("juli")]: { getBoard: async () => ({ projects: [{ id: "PU-01", harga: 1000 }], assignments: [{ row: 10, idProject: "PU-01", idGuru: "1", guru: "Ayu" }] }), updateAssignment: async () => {}, updateProject: async () => {}, createAssignment: async () => ({ row: 11 }), deleteAssignment: async () => {} },
    [full("months")]: { getAllMonths: async () => ({ log: [] }) },
    [full("aturanProyek")]: { deadlineProyek: async () => "2026-10-25", bacaAturan: async () => new Map([["Oktober_:PU-01", {}]]), kunciAturan: (b, id) => `${b}:${id}`, titikDari: () => base.titik },
  }, { Date: Clock });
  const initial = { ID: "PJ-1", Bulan: "Oktober_", "ID proyek": "PU-01", Subtes: "Penalaran Umum", Output: "Soal", "ID guru": "1", "Nama guru": "Ayu", Email: "ayu@test.invalid", Jumlah: 20, Status: "Running", Diputuskan: "18/10/2026 09:00", "Baris log": 10, Deadline: "2026-10-25", ...legacy };
  m.H.forEach((name, i) => { store.row[i] = initial[name] ?? ""; });
  return { m, store, guru: { idGuru: "1", email: "ayu@test.invalid" }, read: async () => (await m.bacaPengerjaan({ segar: true }))[0], report: (soal, laporanId = "") => ({ soal, laporanId, link: "https://docs.google.com/document/d/test", catatan: "Catatan" }) };
}

test("19 report / 20 revision / 22 second report persist with independent inspection", async () => {
  const { m, store, guru, read, report: body } = await system();
  await m.laporProgres(guru, "PJ-1", body(6));
  let p = await read();
  let l1 = p.riwayat.find((e) => e.jenis === "laporan");
  await m.periksaProgres(p.id, { laporanId: l1.laporanId, versi: 1, revisi: true, catatan: "Perbaiki soal 2" }, "Akademik");
  store.at = time(20);
  await m.laporProgres(guru, p.id, body(6, l1.laporanId));
  await assert.rejects(m.periksaProgres(p.id, { laporanId: l1.laporanId, versi: 1 }, "Akademik"), /Versi laporan sudah berubah/);
  await m.periksaProgres(p.id, { laporanId: l1.laporanId, versi: 2 }, "Akademik");
  store.at = time(22);
  await m.laporProgres(guru, p.id, body(10));
  p = await read();
  assert.equal(p.riwayat.filter((e) => e.jenis === "laporan").length, 2);
  assert.equal(p.riwayat.filter((e) => e.jenis === "revisi_laporan").length, 1);
  assert.equal(p.riwayat.find((e) => e.jenis === "revisi_laporan").laporanId, l1.laporanId);
  const model = await load("lib/pengerjaanOpsi.js");
  assert.equal(model.laporanBaru(p).length, 1);
  assert.equal(model.tahapPengambilan(p, 30).label, "Diperiksa");
  assert.equal(model.tahapPengambilan(p, 50).label, "Baru");
  assert.equal(model.statusTitik({ ...p, titik: base.titik })[0].telat, false, "revision date does not replace first fulfillment date");
  assert.equal(model.progresPengambilan(p).soal, 10);
  for (const transaction of store.transactions) assert.equal(transaction.filter((r) => r.appendCells).length, 1);
});

test("legacy reports are snapshotted before new reports; failed writes do not lose them", async () => {
  const { m, store, guru, read, report: body } = await system({ "Progres (soal)": 6, "Lapor progres": "19/10/2026 09:00", "Link progres": "https://docs.google.com/document/d/old", "Progres dicek": "20/10/2026 10:00", "Dicek oleh": "Akademik" });
  store.at = time(22);
  const before = [...store.row];
  store.fail = true;
  await assert.rejects(m.laporProgres(guru, "PJ-1", body(10)), /Simulated atomic failure/);
  assert.deepEqual(store.row, before);
  assert.equal(store.history.length, 0);
  store.fail = false;
  await m.laporProgres(guru, "PJ-1", body(10));
  const p = await read();
  assert.equal(p.riwayat.filter((e) => e.jenis === "laporan").length, 2);
  assert.equal(p.riwayat[0].link, "https://docs.google.com/document/d/old");
  assert.equal(p.riwayat.at(-1).noLaporan, 2);
  assert.ok(p.riwayat.some((e) => e.jenis === "dicek" && e.lama));
});

test("multiple revision rounds keep every version beyond the two legacy report slots", async () => {
  const { m, guru, store, read, report: body } = await system();
  await m.laporProgres(guru, "PJ-1", body(6));
  const id = (await read()).riwayat[0].laporanId;
  for (let versi = 1; versi <= 4; versi++) {
    await m.periksaProgres("PJ-1", { laporanId: id, versi, revisi: true, catatan: `Perbaikan ronde ${versi}` }, "Akademik");
    store.at += 60000;
    await m.laporProgres(guru, "PJ-1", body(6, id));
  }
  const p = await read();
  assert.equal(p.riwayat.filter((e) => e.jenis === "revisi_laporan").length, 4);
  assert.equal(p.riwayat.find((e) => e.jenis === "laporan").versi, 1);
  const model = await load("lib/pengerjaanOpsi.js");
  assert.equal(model.laporanGuru(p)[0].versi, 5);
  assert.equal(model.progresPengambilan(p).soal, 6);
});

test("final resubmissions and each review preserve earlier versions", async () => {
  const { m, guru, store, read } = await system();
  const submission = { link: "https://docs.google.com/document/d/final-v1", catatan: "Versi awal" };
  await m.kumpulkan(guru, "PJ-1", submission);
  await m.review("PJ-1", { setuju: 16, revisi: 4, tolak: 0, catatan: "Perbaiki 4 soal" }, "Akademik");
  store.at = time(22);
  await m.kumpulkan(guru, "PJ-1", { ...submission, link: "https://docs.google.com/document/d/final-v2" });
  await m.review("PJ-1", { setuju: 4, revisi: 0, tolak: 0 }, "Akademik");
  const p = await read();
  assert.equal(p.status, "Selesai");
  assert.equal(p.tepat, 20);
  assert.equal(p.riwayat.filter((e) => e.jenis === "review").length, 2);
  assert.equal(p.riwayat.find((e) => e.jenis === "pengumpulan").link, submission.link);
  assert.equal(p.riwayat.find((e) => e.jenis === "revisi_akhir").versi, 2);
});

test("a second final revision request shows revision 2 while revision 1 remains delivered", async () => {
  const { m, guru, store, read } = await system();
  const model = await load("lib/pengerjaanOpsi.js");
  const body = { link: "https://docs.google.com/document/d/final-v1" };
  await m.kumpulkan(guru, "PJ-1", body);
  await m.review("PJ-1", { setuju: 16, revisi: 4, tolak: 0, catatan: "Revisi pertama" }, "Akademik");
  store.at = time(20);
  await m.kumpulkan(guru, "PJ-1", { link: "https://docs.google.com/document/d/final-v2" });
  store.at = time(22);
  await m.review("PJ-1", { setuju: 0, revisi: 4, tolak: 0, catatan: "Revisi kedua" }, "Akademik");
  let p = await read();
  const siklus = model.siklusRevisi(p, 100);
  assert.equal(siklus.dikirim, 1);
  assert.equal(siklus.diminta, 2);
  assert.equal(model.tahapPengambilan(p, 100).waktu, "22/10/2026 09:00");
  store.at = time(23, 8);
  await m.kumpulkan(guru, "PJ-1", { link: "https://docs.google.com/document/d/final-v3" });
  p = await read();
  assert.equal(model.labelSiklusRevisi(model.siklusRevisi(p, 100)), "Revisi 2 dikirim");
  assert.equal(p.riwayat.filter((e) => ["pengumpulan", "revisi_akhir"].includes(e.jenis)).length, 3);
});

test("progress authorization, integer counts, and required revision notes are enforced", async () => {
  const { m, guru, read, report: body } = await system();
  await assert.rejects(m.laporProgres({ idGuru: "another", email: "other@test.invalid" }, "PJ-1", body(6)), /tidak ditemukan/);
  await assert.rejects(m.laporProgres(guru, "PJ-1", body(6.5)), /bilangan bulat/);
  await assert.rejects(m.laporProgres(guru, "PJ-1", { ...body(6), link: "https://example.com" }), /Google Docs/);
  await m.laporProgres(guru, "PJ-1", body(6));
  const l = (await read()).riwayat[0];
  await assert.rejects(m.periksaProgres("PJ-1", { laporanId: l.laporanId, versi: 1, revisi: true }, "Akademik"), /catatan revisi/);
  await assert.rejects(m.laporProgres(guru, "PJ-1", body(6, l.laporanId)), /tidak sedang menunggu revisi/);
});

test("contact confirmations persist per revision, reject stale results and are idempotent", async () => {
  const { m, guru, store, read, report: body } = await system();
  const model = await load("lib/pantauanOpsi.js");
  await m.laporProgres(guru, "PJ-1", body(6));
  const l = (await read()).riwayat[0];
  let oldDecision;
  for (let versi = 1; versi <= 3; versi++) {
    await m.periksaProgres("PJ-1", { laporanId: l.laporanId, versi, revisi: true, catatan: `Revisi ${versi}` }, "Nadia RAD");
    let p = await read();
    const decision = model.keputusanPengambilan(p)[0];
    assert.equal(model.barisPantauan(p).siap.length, 1);
    if (oldDecision) await assert.rejects(m.catatKabarPengambilan(p.id, { keputusanId: oldDecision }, "Rani CLO"), /sudah berubah/);
    const beforeRow = [...store.row];
    await m.catatKabarPengambilan(p.id, { keputusanId: decision.id }, "Rani CLO");
    assert.deepEqual(store.row, beforeRow, "communication never changes assignment status or reported totals");
    const before = store.history.length;
    await m.catatKabarPengambilan(p.id, { keputusanId: decision.id }, "Petugas lain");
    assert.equal(store.history.length, before, "retry does not create another contact event");
    p = await read();
    assert.equal(model.barisPantauan(p).siap.length, 0);
    assert.equal(model.kabarKeputusan(p, decision).oleh, "Rani CLO");
    assert.equal(model.kabarKeputusan(p, decision).versi, versi);
    store.at += 60000;
    await m.laporProgres(guru, p.id, body(6, l.laporanId));
    oldDecision = decision.id;
    await assert.rejects(m.catatKabarPengambilan(p.id, { keputusanId: decision.id }, "Rani CLO"), /sudah berubah/);
  }
  const p = await read();
  assert.equal(p.riwayat.filter((e) => e.jenis === "kabar").length, 3);
  assert.equal(p.riwayat.filter((e) => e.jenis === "revisi_laporan").length, 3);
  assert.equal(model.barisPantauan(p).keputusan.length, 0);
});

test("failed contact storage is atomic and legacy final revision remains identifiable", async () => {
  const { m, store, read } = await system({ Status: "Revisi", Link: "https://docs.google.com/document/d/old", Dikumpulkan: "20/10/2026 10:00", "Ronde review": 2, Direview: "22/10/2026 12:00", Reviewer: "RAD", "Catatan revisi": "Revisi kedua", "Batas revisi": "25/10/2026 12:00" });
  const model = await load("lib/pantauanOpsi.js");
  const p = await read();
  const result = model.keputusanPengambilan(p)[0];
  assert.equal(result.versi, 2);
  assert.match(model.judulKeputusan(result), /Revisi 2/);
  store.fail = true;
  await assert.rejects(m.catatKabarPengambilan(p.id, { keputusanId: result.id }, "CLO"), /Simulated atomic failure/);
  assert.equal(store.history.length, 0);
  store.fail = false;
  await m.catatKabarPengambilan(p.id, { keputusanId: result.id }, "CLO");
  const after = await read();
  assert.equal(model.keputusanPengambilan(after)[0].id, result.id);
  assert.equal(model.barisPantauan(after).sudah.length, 1);
  assert.equal(after.riwayat.find((e) => e.jenis === "kabar").meta.keputusanId, result.id);
});

test("concurrent confirmations share one logical event ID", async () => {
  const { m, guru, read, report: body } = await system();
  const model = await load("lib/pantauanOpsi.js");
  await m.laporProgres(guru, "PJ-1", body(6));
  const l = (await read()).riwayat[0];
  await m.periksaProgres("PJ-1", { laporanId: l.laporanId, versi: 1 }, "RAD");
  const decision = model.keputusanPengambilan(await read())[0];
  await Promise.all([m.catatKabarPengambilan("PJ-1", { keputusanId: decision.id }, "CLO A"), m.catatKabarPengambilan("PJ-1", { keputusanId: decision.id }, "CLO B")]);
  assert.equal((await read()).riwayat.filter((e) => e.jenis === "kabar").length, 1);
});

test("reminder storage validates the current schedule and keeps a named audit entry", async () => {
  const { m, store, read } = await system();
  const model = await load("lib/pantauanOpsi.js");
  store.at = time(22, 10);
  const [p] = await m.lengkapiTitik([await read()]);
  const i = model.pengingatPantauan(p, store.at)[0];
  await assert.rejects(m.catatKabarPengambilan(p.id, { pengingatId: "old-schedule" }, "CLO"), /sudah berubah/);
  await assert.rejects(m.catatKabarPengambilan(p.id, { pengingatId: i.key }, ""), /Petugas/);
  await m.catatKabarPengambilan(p.id, { pengingatId: i.key }, "Rani CLO");
  const after = await read();
  assert.equal(after.riwayat.find((e) => e.jenis === "reminder").oleh, "Rani CLO");
  assert.equal(model.pengingatPantauan({ ...after, titik: base.titik }, store.at)[0].terkirim.oleh, "Rani CLO");
  await assert.rejects(m.catatKabarPengambilan(p.id, { keputusanId: "x", pengingatId: i.key }, "CLO"), /Pilih satu/);
});

test("admin API enforces RAD and CLO actions and takes the contact author from the session", async () => {
  const { m, guru, read, report: body } = await system();
  const roles = await load("lib/peranTim.js");
  const model = await load("lib/pantauanOpsi.js");
  await m.laporProgres(guru, "PJ-1", body(6));
  const l = (await read()).riwayat[0];
  await m.periksaProgres("PJ-1", { laporanId: l.laporanId, versi: 1 }, "RAD");
  const decision = model.keputusanPengambilan(await read())[0];
  let session = { peran: ["CLO"], nama: "Rani dari sesi" };
  const full = (f) => path.join(root, "lib", f + ".js");
  const route = await load("app/api/admin/pengerjaan/route.js", {
    "next/server": { NextResponse: { json: (body, opts) => ({ body, status: opts?.status || 200 }) } },
    [full("authServer")]: { izinAdmin: async () => ({ sesi: session }), bolehPeran: roles.bolehTim },
    [full("gauth")]: { canWrite: () => true },
    [full("pengerjaan")]: { ...m },
    [full("juli")]: { getBoard: async () => ({}) },
    [full("aturanProyek")]: Object.fromEntries(["aturanBulan", "aturDeadline", "aturLapor", "aturPaket", "aturTipe", "aturSemua"].map((k) => [k, async () => ({})])),
    [full("akun")]: { bacaAkun: async () => [] },
  });
  const post = (payload) => route.POST({ json: async () => payload });
  assert.equal((await post({ action: "review", id: "PJ-1" })).status, 403);
  assert.equal((await post({ action: "progresDicek", id: "PJ-1" })).status, 403);
  let get = await route.GET({ nextUrl: new URL("https://test.invalid/?bulan=Oktober_") });
  assert.equal(get.body.canWrite, false);
  assert.equal(get.body.canKabari, true);
  session = { peran: ["RAD"], nama: "Nadia" };
  assert.equal((await post({ action: "kabari", id: "PJ-1", keputusanId: decision.id })).status, 403);
  get = await route.GET({ nextUrl: new URL("https://test.invalid/?bulan=Oktober_") });
  assert.equal(get.body.canWrite, true);
  assert.equal(get.body.canKabari, false);
  session = { peran: ["CLO"], nama: "Rani dari sesi" };
  assert.equal((await post({ action: "kabari", id: "PJ-1", keputusanId: decision.id, oleh: "Pemalsu", pic: "Pemalsu" })).status, 200);
  assert.equal((await read()).riwayat.find((e) => e.jenis === "kabar").oleh, "Rani dari sesi");
});

// Data asli: p.laporan diisi dari jurnal (lib/pengerjaan.js); objek dari konteks vm dibandingkan sebagai JSON.
const nyata = (p) => ({ ...p, laporan: (p.riwayat || []).filter((e) => ["laporan", "revisi_laporan"].includes(e.jenis)) });
const polos = (x) => JSON.parse(JSON.stringify(x));

test("work queues put RAD checks and CLO contacts in priority order and skip closed work", async () => {
  const pd = await load("lib/pantauanOpsi.js");
  const m = await load("lib/antreanPengambilan.js");
  const now = time(23);
  const final = (id, day, versi = 1, jenis = "pengumpulan") => ({ ...report(id, day, 100, 20, versi), jenis });
  const list = [
    { ...base, id: "pending", status: "Diajukan", diajukan: "21/10/2026 09:00", riwayat: [] },
    { ...base, id: "progress", riwayat: [report("p1", 22, 30, 6)] },
    { ...base, id: "qc1", status: "Ready to review", ronde: 0, tDikumpulkan: time(22), riwayat: [final("f1", 22)] },
    { ...base, id: "qc2", status: "Ready to review", ronde: 1, tDikumpulkan: time(21), riwayat: [final("f2", 20), { id: "rv", jenis: "review", versi: 1, persen: 100, t: time(20, 12), meta: { revisi: 5 } }, final("f2", 21, 2, "revisi_akhir")] },
    { ...base, id: "done", status: "Selesai", tepat: 20, riwayat: [report("old", 19, 30, 6)] },
  ];
  const rad = m.tugasRad(list.map((p) => pd.barisPantauan(nyata(p), now)));
  assert.deepEqual(polos(rad.map((t) => `${t.jenis}:${t.p.id}`)), ["ulang:qc2", "qc:qc1", "progres:progress", "acc:pending"]);
  assert.equal(rad[2].laporan.laporanId, "p1");

  const accepted = { ...base, id: "acc-ok", riwayat: [{ id: "acc1", jenis: "acc", t: time(18), waktu: "18/10/2026 09:00", oleh: "Nadia" }] };
  let clo = m.tugasClo([pd.barisPantauan(accepted, now)]);
  assert.deepEqual(polos(clo.map((t) => t.jenis)), ["kabar", "reminder"], "result to announce comes before the overdue report reminder");
  accepted.riwayat.push({ id: "k1", jenis: "kabar", t: time(18, 10), meta: { keputusanId: "acc1" } });
  clo = m.tugasClo([pd.barisPantauan(accepted, now)]);
  assert.deepEqual(polos(clo.map((t) => t.jenis)), ["reminder"]);
  assert.ok(clo[0].pengingat.lewat);
});

test("pipeline, single status and due date describe only the current step", async () => {
  const m = await load("lib/antreanPengambilan.js");
  const s = (p, at) => polos(m.alurPengambilan(nyata(p), at).map((a) => a.s));
  const checked = nyata({ ...base, riwayat: [report("L1", 19, 30, 6), { id: "c1", jenis: "dicek", laporanId: "L1", versi: 1, persen: 30, t: time(19, 12) }] });
  assert.deepEqual(s(checked, time(21)), ["ok", "ok", "now", "", ""]);
  assert.deepEqual(s(checked, time(23)), ["ok", "ok", "late", "", ""], "missed 50% date turns the current dot red");
  assert.equal(m.statusRingkas(checked, time(21)).label, "Dikerjakan · lapor 50%");
  assert.deepEqual(polos(m.tenggatPengambilan(checked, time(21))), { ket: "Lapor 50%", teks: "besok", kelas: "qc", lewat: false });

  const fresh = nyata({ ...base, riwayat: [report("N1", 22, 50, 10)] });
  assert.equal(m.statusRingkas(fresh, time(22, 12)).label, "Laporan 50% perlu diperiksa");
  assert.equal(m.alurPengambilan(fresh, time(22, 12))[2].s, "cek", "report waiting for RAD differs from work in progress");

  assert.deepEqual(s({ ...base, status: "Diajukan" }, time(21)), ["now", "", "", "", ""]);
  assert.deepEqual(s({ ...base, status: "Ditolak" }, time(21)), ["x", "", "", "", ""]);
  assert.deepEqual(s({ ...base, titik: [] }, time(21)), ["ok", "skip", "skip", "now", ""], "no report dates: work heads straight to 100%");

  const revisi = { ...base, status: "Revisi", ronde: 1, tepat: 10, tBatas: time(22), batasRevisi: "22/10/2026 09:00", riwayat: [{ ...report("A", 20, 100, 20), jenis: "pengumpulan" }, { id: "q1", jenis: "review", versi: 1, persen: 100, t: time(21), meta: { revisi: 10, setuju: 10 } }] };
  assert.deepEqual(s(revisi, time(21)), ["ok", "ok", "ok", "ok", "rev"]);
  assert.equal(m.statusRingkas(revisi, time(21)).label, "Revisi 1 · 10 soal");
  assert.deepEqual(polos(m.tenggatPengambilan(revisi, time(21))), { ket: "Batas revisi", teks: "1 hari lagi", kelas: "qc", lewat: false });
  assert.equal(m.statusRingkas({ ...base, status: "Selesai", tepat: 17, telat: 1 }, time(21)).label, "Selesai · 18/20 lolos");
  assert.equal(m.tenggatPengambilan({ ...base, status: "Selesai" }, time(21)), null);
});

test("open quota rows summarise this month's offers per teacher", async () => {
  const m = await load("lib/antreanPengambilan.js");
  const offer = (idGuru, t, extra = {}) => ({ tujuan: "Tawaran proyek", bulan: "Oktober_", idProyek: "A2", idGuru, t, ...extra });
  const kontak = [offer("1", time(19)), offer("1", time(19, 12)), offer("2", time(22, 20)), offer("3", time(18), { hasil: "Bersedia" }), offer("4", time(1), { bulan: "September_" })];
  const k = m.kuotaButuhGuru([{ id: "A1", sisa: 0 }, { id: "A2", sisa: 40 }], [{ idProyek: "A2", jumlah: 10, status: "Diajukan" }], kontak, "Oktober_", time(23));
  assert.equal(k.length, 1);
  assert.deepEqual(polos([k[0].tersedia, k[0].dipesan, k[0].ditawari, k[0].menunggu, k[0].bersedia]), [30, 10, 3, 1, 1]);
});

test("table status chips split action, waiting, overdue and closed work", async () => {
  const pd = await load("lib/pantauanOpsi.js");
  const m = await load("lib/antreanPengambilan.js");
  const now = time(23);
  const rows = [
    { ...base, id: "pending", status: "Diajukan" },
    { ...base, id: "progress", riwayat: [report("p1", 22, 30, 6)] },
    { ...base, id: "late", riwayat: [] },
    { ...base, id: "done", status: "Selesai", tepat: 20 },
    { ...base, id: "no", status: "Ditolak" },
  ].map((p) => pd.barisPantauan(nyata(p), now));
  const n = (k) => rows.filter((r) => m.cocokSaringTabel(r, k)).map((r) => r.p.id).join(",");
  assert.equal(n("semua"), "pending,progress,late,done,no");
  assert.equal(n("tindakan"), "pending,progress");
  assert.equal(n("guru"), "late", "teacher's turn excludes rows still waiting on RAD");
  assert.equal(n("lewat"), "progress,late");
  assert.equal(n("selesai"), "done");
  assert.equal(n("tolak"), "no");
  assert.equal(n("tidak-ada"), n("semua"), "unknown key falls back to all");
});

test("finished-work message says the work is complete, uses final totals and leaves optional RAD notes out", async () => {
  const m = await load("lib/pantauanOpsi.js");
  const final = (versi, jenis) => ({ ...report("A", 20 + versi, 100, 20, versi), jenis });
  const p = { ...base, status: "Selesai", ronde: 2, tepat: 15, telat: 3, tolakBuka: 2, tolakHangus: 0, riwayat: [
    final(1, "pengumpulan"),
    { id: "q1", jenis: "review", versi: 1, persen: 100, t: time(21), catatan: "no 3 & 7 perbaiki kunci", meta: { setuju: 15, revisi: 5 } },
    final(2, "revisi_akhir"),
    { id: "q2", jenis: "review", versi: 2, persen: 100, t: time(23), catatan: "rapi, terima kasih", meta: { setuju: 3, revisi: 0, tolak: 2 } },
  ] };
  const e = m.keputusanPengambilan(p)[0];
  assert.equal(e.id, "q2");
  assert.equal(m.judulKeputusan(e), "Pekerjaan selesai");
  assert.equal(m.catatanWajib(e), false);
  const pesan = m.pesanKabar(p, e);
  assert.match(pesan, /telah selesai\. Hasil review akhir: /);
  assert.match(pesan, /18 soal disetujui \(3 di antaranya dibayar 75%/, "totals cover every round, not only the last one");
  assert.match(pesan, /2 soal ditolak/);
  assert.match(pesan, /Fee akan masuk ke pembayaran bulan ini/);
  assert.doesNotMatch(pesan, /Catatan/, "optional note is left out by default");
  assert.match(m.pesanKabar(p, e, { sertakanCatatan: true }), /Catatan: rapi, terima kasih/);

  const revisi = { ...p, status: "Revisi", tepat: 15, telat: 0, tolakBuka: 0, riwayat: p.riwayat.slice(0, 2) };
  const r = m.keputusanPengambilan(revisi)[0];
  assert.equal(m.catatanWajib(r), true);
  assert.match(m.pesanKabar(revisi, r, { sertakanCatatan: false }).replace(/\n/g, " "), /Revisi 1 diminta/);
  assert.match(m.pesanKabar(revisi, r), /Catatan: no 3 & 7 perbaiki kunci/, "revision notes are always sent");

  const ditolak = { ...base, status: "Ditolak", riwayat: [{ id: "t1", jenis: "tolak", t: time(19), catatan: "kuota sudah penuh" }] };
  assert.match(m.pesanKabar(ditolak, m.keputusanPengambilan(ditolak)[0]), /Alasan: kuota sudah penuh/);
  const semuaDitolak = { ...base, status: "Selesai", tepat: 0, telat: 0, tolakBuka: 20, riwayat: [final(1, "pengumpulan"), { id: "q", jenis: "review", versi: 1, persen: 100, t: time(22), meta: { setuju: 0, revisi: 0, tolak: 20 } }] };
  assert.doesNotMatch(m.pesanKabar(semuaDitolak, m.keputusanPengambilan(semuaDitolak)[0]), /Fee akan masuk/);
});
