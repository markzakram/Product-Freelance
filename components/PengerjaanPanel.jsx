"use client";

// ============================================================================
//  PENGAMBILAN GURU (tim akademik) — pengajuan dari halaman proyek guru:
//  acc (baris log dibuat, status Running) atau tolak (kuota kembali open),
//  lalu pantau yang sedang berjalan & deadline-nya. Data: /api/admin/pengerjaan.
// ============================================================================

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { numberID, rupiah } from "@/lib/format";
import { tautanWa } from "@/lib/tautan";
import { catatWa } from "@/lib/kontakWa";
import { ST, AKTIF, kelasStatus, labelStatus, hitungMundur, tanggalPendek } from "@/lib/pengerjaanOpsi";
import Icon from "./Icon";

const SARING = [
  ["menunggu", "Menunggu acc", (p) => p.status === ST.diajukan],
  ["jalan", "Running", (p) => p.status === ST.running],
  ["selesai", "Ditolak & batal", (p) => p.status === ST.ditolak || p.status === ST.dibatalkan],
  ["semua", "Semua", () => true],
];

async function kirim(body) {
  const res = await fetch("/api/admin/pengerjaan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Gagal (HTTP ${res.status})`);
  return j;
}

const pesanWa = (p, jenis) => {
  const sapa = `Halo ${p.nama || ""}, `;
  if (jenis === "acc")
    return `${sapa}pengajuan proyek *${p.subtes}* (${p.idProyek}, ${p.jumlah} soal) sudah di-ACC dan statusnya Running.${p.deadline ? ` Deadline: ${tanggalPendek(p.deadline)}.` : ""} Selamat mengerjakan!`;
  if (jenis === "tolak") return `${sapa}mohon maaf, pengajuan proyek *${p.subtes}* (${p.idProyek}) belum bisa kami ACC.${p.catatan ? `\nAlasan: ${p.catatan}` : ""}`;
  return `${sapa}pengingat: proyek *${p.subtes}* (${p.idProyek}, ${p.jumlah} soal) deadline-nya ${tanggalPendek(p.deadline)}. Semangat!`;
};

export default function PengerjaanPanel({ data, bulan, namaBulan, projects = [], guruDb = [], muatUlang, setErr, aksiEl, onBerubah }) {
  const [saring, setSaring] = useState("menunggu");
  const [sibuk, setSibuk] = useState("");
  const [tolak, setTolak] = useState(null); // { p, alasan }
  const [maksIsi, setMaksIsi] = useState("");

  const daftar = useMemo(() => data?.pengerjaan || [], [data]);
  const proyek = useMemo(() => new Map(projects.map((p) => [String(p.id).toUpperCase(), p])), [projects]);
  const guruById = useMemo(() => new Map(guruDb.filter((g) => g.idGuru).map((g) => [String(g.idGuru), g])), [guruDb]);
  const maks = data?.maksAktif || 3;
  const bisa = Boolean(data?.canWrite);
  const kini = Date.now();

  const hitung = Object.fromEntries(SARING.map(([k, , f]) => [k, daftar.filter(f).length]));
  const list = daftar.filter(SARING.find(([k]) => k === saring)[2]).sort((a, b) => b.row - a.row);
  const menunggu = daftar.filter((p) => p.status === ST.diajukan);
  const jalan = daftar.filter((p) => p.status === ST.running);
  const lewat = jalan.filter((p) => hitungMundur(p.deadline, kini).lewat).length;

  const jalankan = async (kunci, body, sesudah) => {
    setSibuk(kunci);
    setErr("");
    try {
      const j = await kirim(body);
      await muatUlang();
      sesudah?.(j);
      return j;
    } catch (e) {
      setErr(e.message);
      return null;
    } finally {
      setSibuk("");
    }
  };

  const tombolWa = (p, jenis, label) => {
    const wa = guruById.get(String(p.idGuru))?.wa;
    if (!wa) return null;
    return (
      <a
        className="btn btn-ghost sm"
        href={tautanWa(wa, pesanWa(p, jenis))}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => catatWa({ tujuan: "Info pengambilan", idGuru: p.idGuru, nama: p.nama, email: p.email, wa })}
      >
        <Icon name="send" /> {label}
      </a>
    );
  };

  const aksi = aksiEl
    ? createPortal(
        <>
          <label className="pj-maks" title="Guru tidak bisa mengajukan proyek baru bila proyek aktifnya sudah sebanyak ini">
            <span>Maks. proyek aktif / guru</span>
            <input
              className="input sm"
              type="number"
              min={1}
              max={50}
              value={maksIsi === "" ? maks : maksIsi}
              onChange={(e) => setMaksIsi(e.target.value)}
              disabled={!bisa}
            />
            {maksIsi !== "" && Number(maksIsi) !== maks ? (
              <button type="button" className="btn btn-blue sm" disabled={sibuk === "maks"} onClick={() => jalankan("maks", { action: "maksAktif", nilai: maksIsi }, () => setMaksIsi(""))}>
                Simpan
              </button>
            ) : null}
          </label>
          <button type="button" className="btn btn-ghost sm" onClick={muatUlang} title="Baca ulang pengajuan terbaru">
            <Icon name="refresh" /> Segarkan
          </button>
        </>,
        aksiEl
      )
    : null;

  if (!data) return <div className="card empty">Memuat pengambilan…</div>;

  return (
    <>
      {aksi}
      {data.error ? (
        <div className="banner err">
          <Icon name="alert" />
          <div>Pengambilan belum bisa dibaca: {data.error}</div>
        </div>
      ) : null}

      <div className="grid stat-grid rc-kpi">
        <div className="card stat">
          <span className="label">Menunggu acc</span>
          <span className={"value " + (menunggu.length ? "amber" : "")}>{numberID(menunggu.length)}</span>
          <span className="sub">{numberID(menunggu.reduce((s, p) => s + p.jumlah, 0))} soal dipesan</span>
        </div>
        <div className="card stat">
          <span className="label">Sedang dikerjakan</span>
          <span className="value">{numberID(jalan.length)}</span>
          <span className="sub">{numberID(jalan.reduce((s, p) => s + p.jumlah, 0))} soal · status Running</span>
        </div>
        <div className="card stat">
          <span className="label">Lewat deadline</span>
          <span className={"value " + (lewat ? "red" : "green")}>{numberID(lewat)}</span>
          <span className="sub">masih Running setelah deadline</span>
        </div>
        <div className="card stat">
          <span className="label">Batas proyek aktif</span>
          <span className="value">{numberID(maks)}</span>
          <span className="sub">per guru, berlaku lintas bulan</span>
        </div>
      </div>

      <div className="chips geser" role="group" aria-label="Saring status pengambilan">
        {SARING.map(([k, l]) => (
          <button key={k} type="button" className={"chip" + (saring === k ? " active" : "")} aria-pressed={saring === k} onClick={() => setSaring(k)}>
            {l} <span className="n">{numberID(hitung[k])}</span>
          </button>
        ))}
      </div>

      {!list.length ? (
        <div className="card empty">
          {saring === "menunggu" ? `Tidak ada pengajuan yang menunggu acc untuk ${namaBulan || "bulan ini"}.` : "Tidak ada data."}
        </div>
      ) : (
        <div className="pj-list">
          {list.map((p) => {
            const pr = proyek.get(p.idProyek);
            const dl = hitungMundur(p.deadline, kini);
            const beban = data.aktifPerGuru?.[p.idGuru || p.email] || 0;
            const kurang = p.status === ST.diajukan && pr && pr.sisa < p.jumlah;
            return (
              <article key={p.id} className="card pj-kartu">
                <div className="pj-atas">
                  <div className="pj-siapa">
                    <b>{p.nama || p.email}</b>
                    <span>
                      ID {p.idGuru || "—"} · {numberID(beban)}/{numberID(maks)} proyek aktif
                    </span>
                  </div>
                  <span className={"pill " + kelasStatus(p.status)}>{labelStatus(p.status)}</span>
                </div>
                <div className="pj-proyek">
                  <b>{p.subtes}</b>
                  <span>
                    {p.idProyek} · {p.output || "—"}
                    {pr ? ` · ${rupiah(pr.harga)}/soal` : ""}
                  </span>
                </div>
                <div className="ps-info">
                  <span>
                    <small>Jumlah</small>
                    <b>
                      {numberID(p.jumlah)} soal{pr ? ` · ${rupiah(p.jumlah * pr.harga)}` : ""}
                    </b>
                  </span>
                  <span>
                    <small>Diajukan</small>
                    <b>{p.diajukan || "—"}</b>
                  </span>
                  <span>
                    <small>Deadline</small>
                    <b className={AKTIF.has(p.status) && p.deadline ? "dl-" + dl.kelas : ""}>
                      {p.deadline ? `${tanggalPendek(p.deadline)}${AKTIF.has(p.status) ? " · " + dl.teks : ""}` : "belum diatur di Katalog"}
                    </b>
                  </span>
                  {p.status === ST.diajukan && pr ? (
                    <span>
                      <small>Sisa di sheet</small>
                      <b className={kurang ? "neg" : ""}>{numberID(pr.sisa)} soal</b>
                    </span>
                  ) : null}
                  {p.diputuskan ? (
                    <span>
                      <small>{p.status === ST.running ? "Di-acc" : p.status === ST.ditolak ? "Ditolak" : "Diputuskan"}</small>
                      <b>
                        {p.diputuskan}
                        {p.oleh ? ` · ${p.oleh}` : ""}
                        {p.barisLog ? ` · log baris ${p.barisLog}` : ""}
                      </b>
                    </span>
                  ) : null}
                </div>
                {p.catatan ? <p className={"ps-catatan" + (p.status === ST.ditolak ? " tolak" : "")}>{p.catatan}</p> : null}
                {kurang ? <p className="ps-catatan tolak">Sisa kuota di sheet kurang dari jumlah yang diajukan — acc akan ditolak sistem.</p> : null}
                <div className="pj-aksi">
                  {p.status === ST.diajukan ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-blue sm"
                        disabled={!bisa || Boolean(sibuk) || kurang}
                        title={kurang ? "Sisa kuota di sheet tidak cukup" : undefined}
                        onClick={() =>
                          jalankan(p.id, { action: "putuskan", id: p.id, acc: true, bulan }, () => onBerubah?.())
                        }
                      >
                        <Icon name="check" stroke={2.4} /> {sibuk === p.id ? "Menyimpan…" : "Acc"}
                      </button>
                      <button type="button" className="btn btn-ghost sm" disabled={!bisa || Boolean(sibuk)} onClick={() => setTolak({ p, alasan: "" })}>
                        Tolak
                      </button>
                    </>
                  ) : null}
                  {p.status === ST.running ? tombolWa(p, "acc", "Kabari di-acc") : null}
                  {p.status === ST.running && p.deadline && !dl.lewat && dl.hari <= 1 ? tombolWa(p, "ingat", "Ingatkan deadline") : null}
                  {p.status === ST.ditolak ? tombolWa(p, "tolak", "Kabari ditolak") : null}
                  {p.status === ST.diajukan ? tombolWa(p, "chat", "Chat guru") : null}
                </div>
                {tolak?.p.id === p.id ? (
                  <div className="pj-tolak">
                    <label className="ffield">
                      <span>Alasan penolakan (tampil di Proyek saya guru)</span>
                      <textarea
                        className="input"
                        rows={2}
                        value={tolak.alasan}
                        onChange={(e) => setTolak((t) => ({ ...t, alasan: e.target.value }))}
                        placeholder="mis. kuota proyek ini sudah dialokasikan / bidang belum sesuai"
                        autoFocus
                      />
                    </label>
                    <div className="pj-aksi">
                      <button type="button" className="btn btn-ghost sm" onClick={() => setTolak(null)}>
                        Batal
                      </button>
                      <button
                        type="button"
                        className="btn btn-red sm"
                        disabled={!tolak.alasan.trim() || Boolean(sibuk)}
                        onClick={() => jalankan(p.id, { action: "putuskan", id: p.id, acc: false, catatan: tolak.alasan, bulan }, () => setTolak(null))}
                      >
                        Tolak pengajuan
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
