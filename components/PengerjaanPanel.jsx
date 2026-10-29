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

/** Form review satu pengumpulan: jumlah disetujui + revisi + reject harus pas. */
function FormReview({ p, onKirim, onBatal, sibuk }) {
  const n = belumSelesai(p);
  const [v, setV] = useState({ setuju: n, revisi: 0, tolak: 0, tujuanTolak: "buka", catatan: "" });
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

export default function PengerjaanPanel(props) {
  return <PengambilanWorkspace {...props} FormReview={FormReview} pesanWa={pesanWa} />;
}
