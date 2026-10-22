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
  await entry.link((specifier, parent) => moduleFor(specifier.startsWith("node:") ? specifier : path.resolve(path.dirname(parent.identifier), specifier + (path.extname(specifier) ? "" : ".js"))));
  await entry.evaluate();
  return entry.namespace;
}

const time = (day, hour = 9) => Date.UTC(2026, 9, day, hour - 7);
const base = { id: "PJ-1", bulan: "Oktober_", idProyek: "PU-01", idGuru: "1", nama: "Ayu", email: "ayu@test.invalid", jumlah: 20, status: "Running", laporan: [], riwayat: [], tAcc: time(18), titik: [{ persen: 30, tanggal: "2026-10-19" }, { persen: 50, tanggal: "2026-10-22" }] };
const report = (id, day, persen, soal, versi = 1, jenis = "laporan") => ({ id: `${id}-v${versi}`, laporanId: id, noLaporan: persen === 30 ? 1 : 2, versi, jenis, persen, soal, waktu: `${day}/10/2026 09:00`, t: time(day), link: "https://docs.google.com/document/d/test" });

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
