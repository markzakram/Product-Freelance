"use client";

// ============================================================================
//  PENGAMBILAN GURU (tim akademik) — dari pengajuan sampai selesai:
//    Menunggu acc -> acc (baris log dibuat, Running) / tolak (kuota kembali open)
//    Menunggu review -> review per soal: disetujui / revisi / reject
//    Revisi (batas 3 hari, WA follow-up) -> kirim ulang -> review lagi
//    Selesai (rincian; soal revisi telat dibayar 75%), peringatan & denda.
//  Data: /api/admin/pengerjaan. Hitungan & status: lib/pengerjaanOpsi.js.
// ============================================================================

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { numberID, rupiah } from "@/lib/format";
import { tautanWa } from "@/lib/tautan";
import { catatWa } from "@/lib/kontakWa";
import {
  ST,
  AKTIF,
  PERINGATAN_MULAI,
  DENDA_SETELAH,
  kelasStatus,
  labelStatus,
  hitungMundur,
  tanggalPendek,
  belumSelesai,
  sisaWaktu,
  pengingat,
  statusTitik,
  titikBerikut,
  laporanBaru,
  tanggalHari,
} from "@/lib/pengerjaanOpsi";
import Icon from "./Icon";

const SARING = [
  ["menunggu", "Menunggu acc", (p) => p.status === ST.diajukan],
  ["review", "Menunggu review", (p) => p.status === ST.review],
  ["progres", "Progres baru masuk", (p) => laporanBaru(p).length > 0],
  ["ingat", "Perlu diingatkan", (p) => pengingat(p).length > 0],
  ["revisi", "Revisi", (p) => p.status === ST.revisi],
  ["jalan", "Running", (p) => p.status === ST.running],
  ["selesai", "Selesai", (p) => p.status === ST.selesai],
  ["tolak", "Ditolak & batal", (p) => p.status === ST.ditolak || p.status === ST.dibatalkan],
  ["semua", "Semua", () => true],
];

async function kirim(body) {
  const res = await fetch("/api/admin/pengerjaan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Gagal (HTTP ${res.status})`);
  return j;
}

const asalWeb = () => (typeof window !== "undefined" ? window.location.origin : "");

const pesanWa = (p, jenis) => {
  const sapa = `Halo ${p.nama || ""}, `;
  const proyek = `*${p.subtes}* (${p.idProyek})`;
  switch (jenis) {
    case "acc":
      return `${sapa}pengajuan proyek ${proyek}, ${p.jumlah} soal, sudah di-ACC dan statusnya Running.${p.deadline ? ` Deadline: ${tanggalPendek(p.deadline)}.` : ""} Selamat mengerjakan!`;
    case "tolak":
      return `${sapa}mohon maaf, pengajuan proyek ${proyek} belum bisa kami ACC.${p.catatan ? `\nAlasan: ${p.catatan}` : ""}`;
    case "revisi":
      return (
        `${sapa}hasil review proyek ${proyek}: ${p.tepat + p.telat} soal disetujui, *${belumSelesai(p)} soal perlu revisi*` +
        `${p.tolakBuka + p.tolakHangus ? `, ${p.tolakBuka + p.tolakHangus} soal ditolak` : ""}.\n\n` +
        `${p.catatanRevisi ? `Catatan: ${p.catatanRevisi}\n` : ""}Komentar detail ada di Google Docs-mu${p.link ? ` (${p.link})` : ""}.\n\n` +
        `Batas kirim revisi: *${p.batasRevisi}* (3 hari). Revisi yang dikirim lewat batas dibayar 75% untuk soal itu. Kirim lewat menu Proyek saya ya. Terima kasih!`
      );
    case "progres": {
      const t = titikBerikut(p);
      if (!t) return `${sapa}terima kasih, lapor progres proyek ${proyek} sudah lengkap.`;
      return t.lewat
        ? `${sapa}batas lapor progres ${t.persen}% proyek ${proyek} sudah lewat (*${tanggalHari(t.tanggal)}*, ${t.h}). Mohon segera laporkan minimal ${t.min} dari ${p.jumlah} soal yang sudah selesai + link Google Docs-nya lewat Proyek saya: ${asalWeb()}/open/saya`
        : `${sapa}pengingat: proyek ${proyek} wajib lapor progres ${t.persen}% (minimal ${t.min} dari ${p.jumlah} soal) paling lambat *${tanggalHari(t.tanggal)}* (${t.h}). Laporkan jumlah soal yang sudah selesai + link Google Docs-nya lewat Proyek saya: ${asalWeb()}/open/saya. Terima kasih!`;
    }
    case "progres-terima": {
      const l = laporanBaru(p).slice(-1)[0];
      return `${sapa}laporan progres proyek ${proyek} sudah kami terima${l ? ` (${l.soal}/${p.jumlah} soal)` : ""}. Terima kasih, lanjutkan sampai selesai ya!${p.deadline ? ` Deadline: ${tanggalPendek(p.deadline)}.` : ""}`;
    }
    case "ingat-revisi":
      return `${sapa}pengingat: batas kirim revisi proyek ${proyek} adalah *${p.batasRevisi}*. Revisi yang dikirim lewat batas dibayar 75% untuk soal itu. Kirim lewat Proyek saya: ${asalWeb()}/open/saya`;
    case "lewat":
      return `${sapa}proyek ${proyek}, ${p.jumlah} soal, sudah melewati deadline ${tanggalPendek(p.deadline)}. Mohon kabari kapan hasilnya bisa dikumpulkan lewat Proyek saya: ${asalWeb()}/open/saya`;
    case "peringatan":
      return `${sapa}pekerjaan proyek ${proyek} sudah ${p.gagal}× direview belum lolos. Mohon periksa catatan revisinya dengan teliti — bila lebih dari ${DENDA_SETELAH - 1}×, fee proyek ini dapat dipotong 25%.`;
    case "selesai":
      return (
        `${sapa}review proyek ${proyek} sudah selesai: ${p.tepat} soal disetujui` +
        `${p.telat ? `, ${p.telat} soal disetujui dengan potongan 25% (revisi lewat batas)` : ""}` +
        `${p.tolakBuka + p.tolakHangus ? `, ${p.tolakBuka + p.tolakHangus} soal ditolak` : ""}.` +
        `${p.denda ? " Fee proyek ini dikenai potongan 25% (review gagal lebih dari 3×)." : ""} Fee masuk pembayaran bulan ini. Terima kasih!`
      );
    default:
      return `${sapa}pengingat: proyek ${proyek}, ${p.jumlah} soal, deadline-nya ${tanggalPendek(p.deadline)}. Kumpulkan lewat Proyek saya: ${asalWeb()}/open/saya. Semangat!`;
  }
};

/** Form review satu pengumpulan: jumlah disetujui + revisi + reject harus pas. */
function FormReview({ p, onKirim, onBatal, sibuk }) {
  const n = belumSelesai(p);
  const [v, setV] = useState({ setuju: n, revisi: 0, tolak: 0, tujuanTolak: "buka", catatan: "" });
  const total = (+v.setuju || 0) + (+v.revisi || 0) + (+v.tolak || 0);
  const pas = total === n;
  const telatKirim = Boolean(p.tBatas && p.tDikumpulkan > p.tBatas);
  const angka = (k, label, kelas) => (
    <label className={"rv-angka " + kelas}>
      <span>{label}</span>
      <input className="input sm" type="number" min={0} max={n} value={v[k]} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0) }))} />
    </label>
  );
  return (
    <div className="pj-tolak">
      <b className="rv-judul">
        Review ke-{numberID(p.ronde + 1)} · {numberID(n)} soal dinilai
      </b>
      {telatKirim ? (
        <p className="ps-catatan tolak">
          Revisi ini dikirim lewat batas ({p.batasRevisi}) — soal yang disetujui di review ini dicatat dengan potongan 25%.
        </p>
      ) : null}
      <div className="rv-baris">
        {angka("setuju", "Disetujui", "appr")}
        {angka("revisi", "Revisi", "qc")}
        {angka("tolak", "Reject", "rev")}
        <button type="button" className="btn btn-ghost sm" onClick={() => setV((x) => ({ ...x, setuju: n, revisi: 0, tolak: 0 }))}>
          Semua disetujui
        </button>
      </div>
      {!pas ? <small className="neg">Jumlahnya {numberID(total)} — harus pas {numberID(n)} soal.</small> : null}
      {+v.tolak > 0 ? (
        <div className="rv-tujuan" role="radiogroup" aria-label="Kuota soal reject">
          <span>Kuota {numberID(+v.tolak)} soal reject:</span>
          <label>
            <input type="radio" checked={v.tujuanTolak === "buka"} onChange={() => setV((x) => ({ ...x, tujuanTolak: "buka" }))} /> Buka lagi ke katalog
          </label>
          <label>
            <input type="radio" checked={v.tujuanTolak === "hangus"} onChange={() => setV((x) => ({ ...x, tujuanTolak: "hangus" }))} /> Tidak dibuka (kebutuhan dikurangi)
          </label>
        </div>
      ) : null}
      <label className="ffield">
        <span>Catatan {+v.revisi > 0 ? "revisi (wajib — tampil ke guru)" : "review (opsional)"}</span>
        <textarea
          className="input"
          rows={2}
          value={v.catatan}
          onChange={(e) => setV((x) => ({ ...x, catatan: e.target.value }))}
          placeholder="mis. no 12 & 40: kunci jawaban salah; no 18: pembahasan kurang langkah. Detail di komentar GDoc."
        />
      </label>
      <div className="pj-aksi">
        <button type="button" className="btn btn-ghost sm" onClick={onBatal}>
          Batal
        </button>
        <button
          type="button"
          className="btn btn-blue sm"
          disabled={!pas || sibuk || (+v.revisi > 0 && !v.catatan.trim())}
          onClick={() => onKirim({ setuju: +v.setuju || 0, revisi: +v.revisi || 0, tolak: +v.tolak || 0, tujuanTolak: v.tujuanTolak, catatan: v.catatan })}
        >
          Simpan hasil review
        </button>
      </div>
    </div>
  );
}

export default function PengerjaanPanel({ data, bulan, namaBulan, projects = [], guruDb = [], muatUlang, setErr, aksiEl, onBerubah }) {
  const [saring, setSaring] = useState("menunggu");
  const [sibuk, setSibuk] = useState("");
  const [tolak, setTolak] = useState(null); // { p, alasan }
  const [dinilai, setDinilai] = useState(""); // ID pengerjaan yang sedang direview
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
  const antreReview = daftar.filter((p) => p.status === ST.review);
  const lewat = jalan.filter((p) => hitungMundur(p.deadline, kini).lewat).length;
  const revisiLewat = daftar.filter((p) => p.status === ST.revisi && sisaWaktu(p.tBatas, kini).lewat).length;
  const progresLewat = daftar.filter((p) => pengingat(p, kini).some((i) => i.jenis === "progres" && i.lewat)).length;

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

  const tombolWa = (p, jenis, label, utama = false) => {
    const wa = guruById.get(String(p.idGuru))?.wa;
    if (!wa) return null;
    return (
      <a
        className={"btn sm " + (utama ? "btn-wa" : "btn-ghost")}
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
            <input className="input sm" type="number" min={1} max={50} value={maksIsi === "" ? maks : maksIsi} onChange={(e) => setMaksIsi(e.target.value)} disabled={!bisa} />
            {maksIsi !== "" && Number(maksIsi) !== maks ? (
              <button type="button" className="btn btn-blue sm" disabled={sibuk === "maks"} onClick={() => jalankan("maks", { action: "maksAktif", nilai: maksIsi }, () => setMaksIsi(""))}>
                Simpan
              </button>
            ) : null}
          </label>
          <button type="button" className="btn btn-ghost sm" onClick={muatUlang} title="Baca ulang pengajuan & pengumpulan terbaru">
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
          <span className="label">Menunggu review</span>
          <span className={"value " + (antreReview.length ? "amber" : "")}>{numberID(antreReview.length)}</span>
          <span className="sub">{numberID(antreReview.reduce((s, p) => s + belumSelesai(p), 0))} soal untuk dinilai</span>
        </div>
        <div className="card stat">
          <span className="label">Sedang dikerjakan</span>
          <span className="value">{numberID(jalan.length + hitung.revisi)}</span>
          <span className="sub">
            {numberID(jalan.length)} running · {numberID(hitung.revisi)} revisi
          </span>
        </div>
        <div className="card stat">
          <span className="label">Terlambat</span>
          <span className={"value " + (lewat + revisiLewat + progresLewat ? "red" : "green")}>{numberID(lewat + revisiLewat + progresLewat)}</span>
          <span className="sub">
            {numberID(lewat)} lewat deadline · {numberID(revisiLewat)} revisi lewat 3 hari · {numberID(progresLewat)} belum lapor progres
          </span>
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
          {saring === "menunggu"
            ? `Tidak ada pengajuan yang menunggu acc untuk ${namaBulan || "bulan ini"}.`
            : saring === "review"
              ? "Belum ada pengumpulan yang menunggu review."
              : "Tidak ada data."}
        </div>
      ) : (
        <div className="pj-list">
          {list.map((p) => {
            const pr = proyek.get(p.idProyek);
            const dl = hitungMundur(p.deadline, kini);
            const batas = sisaWaktu(p.tBatas, kini);
            const beban = data.aktifPerGuru?.[p.idGuru || p.email] || 0;
            const kurang = p.status === ST.diajukan && pr && pr.sisa < p.jumlah;
            const sisaSoal = belumSelesai(p);
            const ingat = pengingat(p, kini);
            const titik = statusTitik(p, kini);
            const berikut = p.status === ST.running ? titikBerikut(p, kini) : null;
            const baru = laporanBaru(p);
            return (
              <article key={p.id} className="card pj-kartu">
                <div className="pj-atas">
                  <div className="pj-siapa">
                    <b>{p.nama || p.email}</b>
                    <span>
                      ID {p.idGuru || "—"} · {numberID(beban)}/{numberID(maks)} proyek aktif
                    </span>
                  </div>
                  <div className="pj-pil">
                    {p.gagal >= PERINGATAN_MULAI ? <span className="pill rev">review gagal {numberID(p.gagal)}×</span> : null}
                    {p.denda ? <span className="pill rev">denda 25%</span> : null}
                    <span className={"pill " + kelasStatus(p.status)}>{labelStatus(p.status)}</span>
                  </div>
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
                    <small>Deadline</small>
                    <b className={AKTIF.has(p.status) && p.deadline ? "dl-" + dl.kelas : ""}>
                      {p.deadline ? `${tanggalPendek(p.deadline)}${AKTIF.has(p.status) ? " · " + dl.teks : ""}` : "belum diatur di Katalog"}
                    </b>
                  </span>
                  {p.dikumpulkan ? (
                    <span>
                      <small>Dikumpulkan</small>
                      <b>{p.dikumpulkan}</b>
                    </span>
                  ) : (
                    <span>
                      <small>Diajukan</small>
                      <b>{p.diajukan || "—"}</b>
                    </span>
                  )}
                  {p.status === ST.diajukan && pr ? (
                    <span>
                      <small>Sisa di sheet</small>
                      <b className={kurang ? "neg" : ""}>{numberID(pr.sisa)} soal</b>
                    </span>
                  ) : null}
                  {p.diputuskan && p.status !== ST.diajukan ? (
                    <span>
                      <small>{p.status === ST.ditolak ? "Ditolak" : p.status === ST.dibatalkan ? "Dibatalkan" : "Di-acc"}</small>
                      <b>
                        {p.diputuskan}
                        {p.oleh ? ` · ${p.oleh}` : ""}
                        {p.barisLog ? ` · log baris ${p.barisLog}` : ""}
                      </b>
                    </span>
                  ) : null}
                </div>

                {ingat.length ? (
                  <div className="ps-ingat">
                    {ingat.map((i) => (
                      <span key={i.jenis} className={"pill " + i.kelas}>
                        <Icon name="alert" size={12} /> {i.teks}
                      </span>
                    ))}
                  </div>
                ) : null}
                {titik.length && p.status !== ST.ditolak && p.status !== ST.dibatalkan ? (
                  <div className={"ps-progres" + (baru.length ? " baru" : berikut ? "" : " ok")}>
                    <b>{baru.length ? "Progres baru masuk" : berikut ? `Lapor progres ${berikut.persen}% berikutnya: ${tanggalHari(berikut.tanggal)} (${berikut.h})` : "Lapor progres"}</b>
                    <ul className="jl-list">
                      {titik.map((t) => (
                        <li key={t.persen} className={t.selesai ? (t.telat ? "telat" : "ok") : t.lewat ? "lewat" : ""}>
                          <span className="jl-persen">{t.persen}%</span>
                          {t.selesai ? (
                            <span>
                              <Icon name="check" size={13} stroke={2.4} />{" "}
                              {t.laporan.otomatis ? "terpenuhi lewat pengumpulan hasil akhir" : `${numberID(t.laporan.soal)}/${numberID(p.jumlah)} soal`} · {t.laporan.waktu}
                              {t.telat ? " · telat" : ""}
                              {t.laporan.link && !t.laporan.otomatis ? (
                                <>
                                  {" · "}
                                  <a href={t.laporan.link} target="_blank" rel="noopener noreferrer">
                                    link
                                  </a>
                                </>
                              ) : null}
                              {t.laporan.catatan ? <small> · “{t.laporan.catatan}”</small> : null}
                            </span>
                          ) : (
                            <span>
                              belum lapor · min. {numberID(t.min)} soal · {tanggalHari(t.tanggal)}{" "}
                              {p.status === ST.diajukan ? null : <span className={"pill " + (t.lewat || t.hm.hari === 0 ? "rev" : t.hm.hari <= 2 ? "qc" : "run")}>{t.h}</span>}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {p.dicek && !baru.length ? <small>dicek {p.dicek}{p.dicekOleh ? ` · ${p.dicekOleh}` : ""}</small> : null}
                  </div>
                ) : null}
                {p.ronde ? (
                  <div className="ps-hasil" aria-label="Hasil review">
                    <span className="appr">
                      <b>{numberID(p.tepat)}</b> disetujui
                    </span>
                    {p.telat ? (
                      <span className="qc">
                        <b>{numberID(p.telat)}</b> disetujui −25%
                      </span>
                    ) : null}
                    {p.tolakBuka + p.tolakHangus ? (
                      <span className="rev">
                        <b>{numberID(p.tolakBuka + p.tolakHangus)}</b> reject{p.tolakHangus ? ` (${numberID(p.tolakHangus)} hangus)` : ""}
                      </span>
                    ) : null}
                    {p.status !== ST.selesai && sisaSoal ? (
                      <span>
                        <b>{numberID(sisaSoal)}</b> {p.status === ST.revisi ? "direvisi" : "menunggu review"}
                      </span>
                    ) : null}
                    <small>
                      review ke-{numberID(p.ronde)}
                      {p.reviewer ? ` · ${p.reviewer}` : ""}
                      {p.direview ? ` · ${p.direview}` : ""}
                    </small>
                  </div>
                ) : null}
                {p.status === ST.revisi ? (
                  <div className={"ps-revisi" + (batas.lewat ? " lewat" : "")}>
                    <b>
                      Batas revisi {p.batasRevisi} · {batas.teks}
                    </b>
                    {p.catatanRevisi ? <p>{p.catatanRevisi}</p> : null}
                  </div>
                ) : null}
                {p.catatanGuru && p.status === ST.review ? <p className="ps-catatan">Catatan guru: {p.catatanGuru}</p> : null}
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
                        onClick={() => jalankan(p.id, { action: "putuskan", id: p.id, acc: true, bulan }, () => onBerubah?.())}
                      >
                        <Icon name="check" stroke={2.4} /> {sibuk === p.id ? "Menyimpan…" : "Acc"}
                      </button>
                      <button type="button" className="btn btn-ghost sm" disabled={!bisa || Boolean(sibuk)} onClick={() => setTolak({ p, alasan: "" })}>
                        Tolak
                      </button>
                      {tombolWa(p, "chat", "Chat guru")}
                    </>
                  ) : null}
                  {p.link ? (
                    <a className="btn btn-ghost sm" href={p.link} target="_blank" rel="noopener noreferrer">
                      <Icon name="external" /> Buka GDoc
                    </a>
                  ) : null}
                  {p.status === ST.review ? (
                    <button type="button" className="btn btn-blue sm" disabled={!bisa || Boolean(sibuk)} onClick={() => setDinilai(dinilai === p.id ? "" : p.id)}>
                      <Icon name="clipboard" /> Review {numberID(sisaSoal)} soal
                    </button>
                  ) : null}
                  {p.status === ST.revisi ? tombolWa(p, "revisi", "Kabari revisi", true) : null}
                  {p.gagal >= PERINGATAN_MULAI && p.status !== ST.selesai ? tombolWa(p, "peringatan", "Kirim peringatan") : null}
                  {p.gagal >= DENDA_SETELAH && !p.denda ? (
                    <button
                      type="button"
                      className="btn btn-red sm"
                      disabled={!bisa || Boolean(sibuk)}
                      onClick={() =>
                        window.confirm(`Terapkan potongan 25% untuk fee ${p.subtes} (${p.nama})? Sudah ${p.gagal}× review gagal.`) &&
                        jalankan(p.id, { action: "denda", id: p.id }, () => onBerubah?.())
                      }
                    >
                      Terapkan denda 25%
                    </button>
                  ) : null}
                  {p.status === ST.running ? tombolWa(p, "acc", "Kabari di-acc") : null}
                  {ingat.some((i) => i.jenis === "deadline") ? tombolWa(p, dl.lewat ? "lewat" : "ingat", dl.lewat ? "Tagih (lewat deadline)" : "Ingatkan deadline", true) : null}
                  {baru.length ? (
                    <button type="button" className="btn btn-blue sm" disabled={!bisa || Boolean(sibuk)} onClick={() => jalankan(p.id, { action: "progresDicek", id: p.id })}>
                      <Icon name="check" stroke={2.4} /> {sibuk === p.id ? "Menyimpan…" : "Tandai progres sudah dicek"}
                    </button>
                  ) : null}
                  {baru.length ? tombolWa(p, "progres-terima", "Kabari progres diterima") : null}
                  {berikut ? tombolWa(p, "progres", `Ingatkan lapor ${berikut.persen}% (${berikut.h})`, berikut.lewat || berikut.hm.hari <= 2) : null}
                  {ingat.some((i) => i.jenis === "revisi") ? tombolWa(p, "ingat-revisi", "Ingatkan batas revisi") : null}
                  {p.status === ST.ditolak ? tombolWa(p, "tolak", "Kabari ditolak") : null}
                  {p.status === ST.selesai ? tombolWa(p, "selesai", "Kabari hasil akhir") : null}
                </div>

                {dinilai === p.id && p.status === ST.review ? (
                  <FormReview
                    p={p}
                    sibuk={Boolean(sibuk)}
                    onBatal={() => setDinilai("")}
                    onKirim={(hasil) =>
                      jalankan(p.id, { action: "review", id: p.id, ...hasil }, () => {
                        setDinilai("");
                        onBerubah?.();
                      })
                    }
                  />
                ) : null}
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
