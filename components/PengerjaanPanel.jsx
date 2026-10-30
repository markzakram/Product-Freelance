"use client";

// ============================================================================
//  PENGAMBILAN GURU (tim akademik) — dari pengajuan sampai selesai:
//    Menunggu acc -> acc (baris log dibuat, Running) / tolak (kuota kembali open)
//    Menunggu review -> review per soal: disetujui / revisi / reject
//    Revisi (batas 3 hari, tidak melewati deadline proyek, min. 24 jam; WA follow-up) -> kirim ulang -> review lagi
//    Selesai (rincian; soal revisi telat dibayar 75%), peringatan & denda.
//  Data: /api/admin/pengerjaan. Hitungan & status: lib/pengerjaanOpsi.js.
// ============================================================================

import { useState } from "react";
import { numberID } from "@/lib/format";
import PengambilanWorkspace from "./PengambilanWorkspace";
import { msKeWaktu } from "@/lib/reachoutOpsi";
import {
  ST,
  DENDA_SETELAH,
  BATAS_REVISI_JAM,
  batasRevisiMs,
  akhirHari,
  tanggalPendek,
  belumSelesai,
  titikBerikut,
  laporanBaru,
  tanggalHari,
} from "@/lib/pengerjaanOpsi";
import Icon from "./Icon";
import { teksJumlah } from "@/lib/paket";

const asalWeb = () => (typeof window !== "undefined" ? window.location.origin : "");

const pesanWa = (p, jenis) => {
  const sapa = `Halo ${p.nama || ""}, `;
  const proyek = `*${p.subtes}* (${p.idProyek})`;
  switch (jenis) {
    case "acc":
      return `${sapa}pengajuan proyek ${proyek}${p.tipe ? ` (${p.tipe})` : ""}, ${teksJumlah(p.jumlah, p.isiPaket)}, sudah di-ACC dan statusnya Running.${p.deadline ? ` Deadline: ${tanggalPendek(p.deadline)}.` : ""} Selamat mengerjakan!`;
    case "tolak":
      return `${sapa}mohon maaf, pengajuan proyek ${proyek} belum bisa kami ACC.${p.catatan ? `\nAlasan: ${p.catatan}` : ""}`;
    case "revisi":
      return (
        `${sapa}hasil review proyek ${proyek}: ${p.tepat + p.telat} soal disetujui, *${belumSelesai(p)} soal perlu revisi*` +
        `${p.tolakBuka + p.tolakHangus ? `, ${p.tolakBuka + p.tolakHangus} soal ditolak` : ""}.\n\n` +
        `${p.catatanRevisi ? `Catatan: ${p.catatanRevisi}\n` : ""}Komentar detail ada di Google Docs-mu${p.link ? ` (${p.link})` : ""}.\n\n` +
        `Batas kirim revisi: *${p.batasRevisi}*. Revisi yang dikirim lewat batas dibayar 75% untuk soal itu. Kirim lewat menu Proyek saya ya. Terima kasih!`
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

// Ke mana kuota soal yang ditolak (v3.19.0: dua pilihan, bawaan arsip):
// [nilai, label, ringkasan untuk konfirmasi]. Menghanguskan dilakukan nanti
// dari Katalog → Kuota diarsipkan.
const TUJUAN_TOLAK = [
  ["arsip", "Kembali ke akademik (arsip) — belum tampil di katalog; tim akademik memutuskan nanti di Katalog → Kuota diarsipkan", "kembali ke akademik (arsip)"],
  ["buka", "Kembali ke publik — langsung dibuka lagi di katalog bulan ini", "kembali ke publik (katalog)"],
];

function PilihTujuanTolak({ n, label, nilai, onPilih }) {
  return (
    <div className="rv-tujuan" role="radiogroup" aria-label={`Kuota soal ${label}`}>
      <span>Kuota {numberID(n)} soal {label}:</span>
      {TUJUAN_TOLAK.map(([k, teks]) => (
        <label key={k}>
          <input type="radio" checked={nilai === k} onChange={() => onPilih(k)} /> {teks}
        </label>
      ))}
    </div>
  );
}

/** Form review satu pengumpulan: jumlah disetujui + revisi + reject harus pas. */
function FormReview({ p, onKirim, onBatal, sibuk }) {
  const n = belumSelesai(p);
  const [v, setV] = useState({ setuju: n, revisi: 0, tolak: 0, tujuanTolak: "arsip", catatan: "" });
  // Catatan hanya wajib bila ada soal revisi; selain itu disembunyikan sampai diminta.
  const [tambahCatatan, setTambahCatatan] = useState(false);
  const perluCatatan = +v.revisi > 0;
  // Pratinjau batas revisi yang akan dicatat server bila ada soal revisi.
  const deadline = p.deadlineProyek || p.deadline;
  const kini = Date.now();
  const batas = batasRevisiMs(deadline, kini);
  const batasTeks = msKeWaktu(batas);
  const dipotong = akhirHari(deadline) && batas < kini + BATAS_REVISI_JAM * 3600000;
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
      {+v.tolak > 0 ? <PilihTujuanTolak n={+v.tolak} label="reject" nilai={v.tujuanTolak} onPilih={(t) => setV((x) => ({ ...x, tujuanTolak: t }))} /> : null}
      {perluCatatan ? (
        <p className="rv-batas">
          <Icon name="calendar" size={14} />
          Batas kirim revisi: <b>{batasTeks} WIB</b>
          <small className="muted">{dipotong ? (akhirHari(deadline) < batas ? `deadline ${tanggalPendek(deadline)} sudah lewat/terlalu dekat · minimal 24 jam` : `mengikuti deadline ${tanggalPendek(deadline)}`) : "3 hari sejak review"}</small>
        </p>
      ) : null}
      {perluCatatan || tambahCatatan || v.catatan ? (
        <label className="ffield">
          <span>{perluCatatan ? "Catatan revisi (wajib — tampil ke guru)" : "Catatan review (opsional — tidak otomatis ikut di kabar ke guru)"}</span>
          <textarea
            className="input"
            rows={2}
            value={v.catatan}
            onChange={(e) => setV((x) => ({ ...x, catatan: e.target.value }))}
            placeholder={perluCatatan ? "mis. no 12 & 40: kunci jawaban salah; no 18: pembahasan kurang langkah. Detail di komentar GDoc." : "Boleh dikosongkan"}
          />
        </label>
      ) : (
        <button type="button" className="btn-link rv-tambah" onClick={() => setTambahCatatan(true)}>
          <Icon name="plus" size={14} />
          Tambah catatan (opsional)
        </button>
      )}
      <div className="pj-aksi">
        <button type="button" className="btn btn-ghost sm" onClick={onBatal}>
          Batal
        </button>
        <button
          type="button"
          className="btn btn-blue sm"
          disabled={!pas || sibuk || (perluCatatan && !v.catatan.trim())}
          onClick={() => onKirim({ setuju: +v.setuju || 0, revisi: +v.revisi || 0, tolak: +v.tolak || 0, tujuanTolak: v.tujuanTolak, catatan: v.catatan })}
        >
          Simpan hasil review
        </button>
      </div>
    </div>
  );
}

/**
 * Hentikan pengambilan yang masih berjalan (guru mundur, dll.): semua soal yang
 * belum diputuskan dibagi jadi diterima (dibayar) dan ditolak, lalu ditutup.
 */
function FormHentikan({ p, onKirim, onBatal, sibuk }) {
  const n = belumSelesai(p);
  const [v, setV] = useState({ setuju: 0, tolak: n, tujuanTolak: "arsip", alasan: "" });
  const pas = (+v.setuju || 0) + (+v.tolak || 0) === n;
  const angka = (k, label, kelas) => (
    <label className={"rv-angka " + kelas}>
      <span>{label}</span>
      <input className="input sm" type="number" min={0} max={n} value={v[k]} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0) }))} />
    </label>
  );
  const kirim = () => {
    const ringkas = `Hentikan ${p.subtes} (${p.idProyek}) — ${p.nama || p.email}?\n\nDiterima & dibayar: ${+v.setuju || 0} soal\nDitolak: ${+v.tolak || 0} soal (${TUJUAN_TOLAK.find(([k]) => k === v.tujuanTolak)?.[2] || ""})\n\nPengambilan langsung selesai dan tidak bisa dibuka lagi dari dashboard.`;
    if (window.confirm(ringkas)) onKirim({ setuju: +v.setuju || 0, tolak: +v.tolak || 0, tujuanTolak: v.tujuanTolak, alasan: v.alasan.trim() });
  };
  return (
    <div className="pj-tolak pj-henti">
      <b className="rv-judul">Hentikan pengambilan · {numberID(n)} soal belum diputuskan</b>
      <p className="muted">
        Untuk guru yang mengundurkan diri atau pengambilan yang tidak dilanjutkan, di tahap mana pun (dikerjakan, menunggu QC, atau revisi).
        Soal yang diterima dibayar penuh; sisanya ditolak.
        {p.tepat + p.telat ? ` ${numberID(p.tepat + p.telat)} soal yang sudah disetujui sebelumnya tetap dibayar.` : ""}
      </p>
      <div className="rv-baris">
        {angka("setuju", "Diterima", "appr")}
        {angka("tolak", "Ditolak", "rev")}
        <button type="button" className="btn btn-ghost sm" onClick={() => setV((x) => ({ ...x, setuju: 0, tolak: n }))}>
          Tolak semua
        </button>
      </div>
      {!pas ? <small className="neg">Jumlahnya {numberID((+v.setuju || 0) + (+v.tolak || 0))} — harus pas {numberID(n)} soal.</small> : null}
      {+v.tolak > 0 ? <PilihTujuanTolak n={+v.tolak} label="ditolak" nilai={v.tujuanTolak} onPilih={(t) => setV((x) => ({ ...x, tujuanTolak: t }))} /> : null}
      <label className="ffield">
        <span>Alasan (wajib — tampil ke guru)</span>
        <textarea className="input" rows={2} value={v.alasan} maxLength={300} onChange={(e) => setV((x) => ({ ...x, alasan: e.target.value }))} placeholder="mis. guru mengundurkan diri" />
      </label>
      <div className="pj-aksi">
        <button type="button" className="btn btn-ghost sm" onClick={onBatal}>
          Batal
        </button>
        <button type="button" className="btn btn-red sm" disabled={!pas || sibuk || !v.alasan.trim()} onClick={kirim}>
          Hentikan pengambilan
        </button>
      </div>
    </div>
  );
}

/**
 * Ubah tujuan kuota soal yang sudah ditolak (mis. terlanjur dibuka lagi / hangus
 * padahal seharusnya diarsipkan). `diarsipkan` = soal pengambilan ini di Arsip kuota.
 */
function FormUbahTolak({ p, diarsipkan = 0, onKirim, onBatal, sibuk }) {
  const hangus = Math.max(0, (p.tolakHangus || 0) - diarsipkan);
  const asal = [["buka", "Dibuka lagi ke katalog", p.tolakBuka || 0], ["hangus", "Hangus (kebutuhan dikurangi)", hangus]].filter(([, , n]) => n > 0);
  const [v, setV] = useState({ dari: asal[0]?.[0] || "buka", ke: "arsip", jumlah: asal[0]?.[2] || 0, alasan: "" });
  const maks = asal.find(([k]) => k === v.dari)?.[2] || 0;
  const tujuan = TUJUAN_TOLAK.filter(([k]) => k !== v.dari);
  const sah = +v.jumlah >= 1 && +v.jumlah <= maks && v.ke !== v.dari;
  const label = (k) => ({ buka: "dibuka lagi", hangus: "hangus", arsip: "diarsipkan" })[k];
  if (!asal.length) return <p className="muted">Semua soal yang ditolak pengambilan ini sudah diarsipkan — kelola dari Katalog → Kuota diarsipkan.</p>;
  return (
    <div className="pj-tolak pj-ubah-tolak">
      <b className="rv-judul">Ubah tujuan kuota soal ditolak</b>
      <div className="rv-tujuan" role="radiogroup" aria-label="Asal kuota">
        <span>Dari:</span>
        {asal.map(([k, teks, n]) => (
          <label key={k}>
            <input type="radio" checked={v.dari === k} onChange={() => setV((x) => ({ ...x, dari: k, jumlah: n, ke: x.ke === k ? "arsip" : x.ke }))} /> {teks} · {numberID(n)} soal
          </label>
        ))}
      </div>
      <div className="rv-tujuan" role="radiogroup" aria-label="Tujuan baru">
        <span>Menjadi:</span>
        {tujuan.map(([k, teks]) => (
          <label key={k}>
            <input type="radio" checked={v.ke === k} onChange={() => setV((x) => ({ ...x, ke: k }))} /> {teks}
          </label>
        ))}
      </div>
      <div className="rv-baris">
        <label className="rv-angka">
          <span>Jumlah soal</span>
          <input className="input sm" type="number" min={1} max={maks} value={v.jumlah} onChange={(e) => setV((x) => ({ ...x, jumlah: e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0) }))} />
        </label>
        <small className="muted">dari {numberID(maks)} soal</small>
      </div>
      {v.dari === "buka" ? <small className="muted">Soal yang sudah terlanjur diambil guru lain tidak bisa ditarik lagi; server menolak bila sisa katalog proyek ini kurang.</small> : null}
      <label className="ffield">
        <span>Alasan (opsional)</span>
        <input className="input" value={v.alasan} maxLength={300} onChange={(e) => setV((x) => ({ ...x, alasan: e.target.value }))} placeholder="mis. seharusnya diarsipkan" />
      </label>
      <div className="pj-aksi">
        <button type="button" className="btn btn-ghost sm" onClick={onBatal}>
          Batal
        </button>
        <button
          type="button"
          className="btn btn-blue sm"
          disabled={!sah || sibuk}
          onClick={() => window.confirm(`Ubah ${+v.jumlah} soal ditolak ${p.subtes} (${p.idProyek}) dari "${label(v.dari)}" menjadi "${label(v.ke)}"?`) && onKirim({ dari: v.dari, ke: v.ke, jumlah: +v.jumlah, alasan: v.alasan.trim() })}
        >
          Simpan perubahan
        </button>
      </div>
    </div>
  );
}

/**
 * Koreksi hasil akhir pengambilan yang sudah Selesai: jumlah diterima (tarif penuh /
 * potongan 25%) dan ditolak ditetapkan ulang. Server menyesuaikan log, katalog, arsip.
 */
function FormKoreksi({ p, onKirim, onBatal, sibuk }) {
  const tolakLama = (p.tolakBuka || 0) + (p.tolakHangus || 0);
  const adaTelat = (p.telat || 0) > 0;
  const [v, setV] = useState({ tepat: p.tepat || 0, telat: p.telat || 0, tolak: tolakLama, tujuanTolak: "arsip", alasan: "" });
  const total = (+v.tepat || 0) + (+v.telat || 0) + (+v.tolak || 0);
  const pas = total === p.jumlah;
  const dA = (+v.tepat || 0) + (+v.telat || 0) - ((p.tepat || 0) + (p.telat || 0));
  const berubah = (+v.tepat || 0) !== (p.tepat || 0) || (+v.telat || 0) !== (p.telat || 0);
  const angka = (k, label, kelas) => (
    <label className={"rv-angka " + kelas}>
      <span>{label}</span>
      <input className="input sm" type="number" min={0} max={p.jumlah} value={v[k]} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0) }))} />
    </label>
  );
  const kirim = () => {
    const pesan = `Koreksi hasil akhir ${p.subtes} (${p.idProyek}) — ${p.nama || p.email}?\n\nSebelum: ${(p.tepat || 0) + (p.telat || 0)} diterima, ${tolakLama} ditolak\nSesudah: ${(+v.tepat || 0) + (+v.telat || 0)} diterima${adaTelat ? ` (${+v.telat || 0} dengan potongan 25%)` : ""}, ${+v.tolak || 0} ditolak\n\nBaris log, kuota katalog, dan arsip ikut disesuaikan; CLO akan mendapat tugas kabar baru.`;
    if (window.confirm(pesan)) onKirim({ tepat: +v.tepat || 0, telat: +v.telat || 0, tolak: +v.tolak || 0, tujuanTolak: v.tujuanTolak, alasan: v.alasan.trim() });
  };
  return (
    <div className="pj-tolak pj-koreksi">
      <b className="rv-judul">Koreksi hasil akhir · {numberID(p.jumlah)} soal</b>
      <p className="muted">
        Sekarang: {numberID((p.tepat || 0) + (p.telat || 0))} diterima{adaTelat ? ` (${numberID(p.telat)} dengan potongan 25%)` : ""}, {numberID(tolakLama)} ditolak.
      </p>
      <div className="rv-baris">
        {angka("tepat", adaTelat ? "Diterima (tarif penuh)" : "Diterima", "appr")}
        {adaTelat ? angka("telat", "Diterima (potongan 25%)", "qc") : null}
        {angka("tolak", "Ditolak", "rev")}
      </div>
      {!pas ? <small className="neg">Jumlahnya {numberID(total)} — harus pas {numberID(p.jumlah)} soal.</small> : null}
      {pas && dA > 0 ? <small className="muted">{numberID(dA)} soal ditolak akan jadi diterima — diambil dari arsip pengambilan ini dulu, lalu yang hangus, lalu yang dibuka lagi di katalog (selama belum diambil guru lain).</small> : null}
      {pas && dA < 0 ? <PilihTujuanTolak n={-dA} label="yang jadi ditolak" nilai={v.tujuanTolak} onPilih={(t) => setV((x) => ({ ...x, tujuanTolak: t }))} /> : null}
      <label className="ffield">
        <span>Alasan koreksi (wajib — ikut di kabar ke guru)</span>
        <textarea className="input" rows={2} value={v.alasan} maxLength={500} onChange={(e) => setV((x) => ({ ...x, alasan: e.target.value }))} placeholder="mis. salah input — 10 soal lagi ternyata sudah benar" />
      </label>
      <div className="pj-aksi">
        <button type="button" className="btn btn-ghost sm" onClick={onBatal}>
          Batal
        </button>
        <button type="button" className="btn btn-blue sm" disabled={!pas || !berubah || sibuk || !v.alasan.trim()} onClick={kirim}>
          Simpan koreksi
        </button>
      </div>
    </div>
  );
}

export default function PengerjaanPanel(props) {
  return <PengambilanWorkspace {...props} FormReview={FormReview} FormHentikan={FormHentikan} FormUbahTolak={FormUbahTolak} FormKoreksi={FormKoreksi} pesanWa={pesanWa} />;
}
