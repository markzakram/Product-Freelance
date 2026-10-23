"use client";

// Antrean tugas di atas halaman Pengambilan Guru. Satu baris = satu pekerjaan,
// urut dari yang paling mendesak. Tombol utama langsung menjalankan pekerjaan
// (ACC, tandai diperiksa, catat sudah dikabari); yang butuh isian (tolak,
// minta revisi, review) membuka panel detail dengan formnya sudah terbuka.

import { useState } from "react";
import { numberID } from "@/lib/format";
import { teksJumlah } from "@/lib/paket";
import { tautanWa } from "@/lib/tautan";
import { sejak } from "@/lib/reachoutOpsi";
import { ST, belumSelesai, linkSah, siklusRevisi } from "@/lib/pengerjaanOpsi";
import { pesanKabar, pesanReminder } from "@/lib/pantauanOpsi";
import { tenggatPengambilan } from "@/lib/antreanPengambilan";
import Icon from "./Icon";

const TAMPIL_AWAL = 6;
const proyekDari = (p) => `${p.subtes || "—"} (${p.idProyek})`;

function Baris({ ikon, kelas, judul, sub, catatan, due, onBuka, children }) {
  return (
    <li className="pk-q-item">
      <span className={"pk-q-ic " + kelas} aria-hidden="true">{ikon}</span>
      <button type="button" className="pk-q-text" onClick={onBuka}>
        <b>{judul}</b>
        <small>{sub}</small>
        {catatan ? <small className="pk-q-note">“{catatan}”</small> : null}
      </button>
      <div className="pk-q-aksi">
        {due}
        {children}
      </div>
    </li>
  );
}

const Due = ({ p, kini }) => {
  const tg = tenggatPengambilan(p, kini);
  return tg && tg.kelas ? <span className={"pk-due " + tg.kelas}>{tg.ket} · {tg.teks}</span> : null;
};

export default function AntreanTugas({ tim, tugas, kuota, kini, tabClo, setTabClo, bisa, bisaKabari, sibuk, kontakGuru, infoAcc, onAcc, onBuka, onDicek, onKabari, onReminder, onCariGuru }) {
  const [semua, setSemua] = useState(false);
  const daftarKuota = tim === "clo" && tabClo === "kuota";
  const isi = daftarKuota ? kuota : tugas;
  const tampil = semua ? isi : isi.slice(0, TAMPIL_AWAL);
  const hitung = (j) => tugas.filter((t) => j.includes(t.jenis)).length;
  const rincianRad = [["QC", hitung(["qc", "ulang"])], ["laporan progres", hitung(["progres"])], ["ACC", hitung(["acc"])]].filter(([, n]) => n).map(([l, n]) => `${n} ${l}`).join(" · ");

  const item = (t) => {
    const p = t.p;
    const wa = kontakGuru(p)?.wa;
    const buka = (opsi) => () => onBuka(p, opsi);
    switch (t.jenis) {
      case "acc": {
        const a = infoAcc(p);
        return (
          <Baris key={t.key} ikon="ACC" kelas="acc" judul={`ACC pengajuan · ${proyekDari(p)}`} sub={`${p.nama || p.email} · ${teksJumlah(p.jumlah, p.isiPaket)}${p.tipe ? ` · ${p.tipe}` : ""} · ${a.aktif}/${a.maks} proyek aktif · diajukan ${sejak(t.t, kini)}`} due={a.kurang ? <span className="pk-due rev">kuota kurang</span> : null} onBuka={buka({})}>
            <button type="button" className="btn btn-ghost sm" disabled={!bisa || sibuk} onClick={buka({ aksi: "tolak" })}>Tolak</button>
            <button type="button" className="btn btn-blue sm" disabled={!bisa || sibuk || a.kurang} onClick={() => onAcc(p)}><Icon name="check" />ACC</button>
          </Baris>
        );
      }
      case "progres": {
        const l = t.laporan;
        return (
          <Baris key={t.key} ikon={`${l.persen}%`} kelas="lap" judul={`Periksa laporan ${l.persen}% · ${proyekDari(p)}`} sub={`${p.nama || p.email} · ${numberID(l.soal)}/${numberID(p.jumlah)} soal${l.versi > 1 ? ` · revisi ${l.versi - 1}` : ""} · masuk ${sejak(l.t, kini)}`} catatan={l.catatan} onBuka={buka({ tab: "laporan" })}>
            {l.link ? <a className="btn btn-ghost sm" href={l.link} target="_blank" rel="noopener noreferrer"><Icon name="external" />Buka progres</a> : null}
            {p.status === ST.running ? <button type="button" className="btn btn-ghost sm" disabled={!bisa || sibuk} onClick={buka({ tab: "laporan", aksi: { revisi: l } })}>Minta revisi</button> : null}
            <button type="button" className="btn btn-blue sm" disabled={!bisa || sibuk} onClick={() => onDicek(p, l)}><Icon name="check" />Sudah diperiksa</button>
          </Baris>
        );
      }
      case "qc":
      case "ulang": {
        const ulang = t.jenis === "ulang";
        return (
          <Baris key={t.key} ikon="QC" kelas={ulang ? "ulang" : "qc"} judul={`${ulang ? `QC ulang revisi ${siklusRevisi(p, 100).dikirim || p.ronde}` : "QC hasil akhir"} · ${proyekDari(p)}`} sub={`${p.nama || p.email} · ${numberID(belumSelesai(p))} soal dinilai · dikumpulkan ${sejak(t.t, kini)}${p.tipe ? ` · ${p.tipe}` : ""}`} catatan={p.catatanGuru} onBuka={buka({})}>
            {linkSah(p.link) ? <a className="btn btn-ghost sm" href={p.link} target="_blank" rel="noopener noreferrer"><Icon name="external" />Buka hasil</a> : null}
            <button type="button" className="btn btn-blue sm" disabled={!bisa || sibuk} onClick={buka({ aksi: "review" })}><Icon name="clipboard" />Review {numberID(belumSelesai(p))} soal</button>
          </Baris>
        );
      }
      case "kabar": {
        const e = t.keputusan;
        return (
          <Baris key={t.key} ikon={<Icon name="send" size={15} />} kelas="kab" judul={`Kabari: ${e.judul} · ${proyekDari(p)}`} sub={`${p.nama || p.email} · hasil RAD ${e.waktu || "—"} WIB${e.oleh ? ` · ${e.oleh}` : ""}`} onBuka={buka({ tab: "kabar" })}>
            {wa ? <a className="btn btn-ghost sm" href={tautanWa(wa, pesanKabar(p, e))} target="_blank" rel="noopener noreferrer"><Icon name="send" />WhatsApp</a> : <button type="button" className="btn btn-ghost sm" onClick={buka({ tab: "kabar", draf: e.id })}>Lihat draf</button>}
            <button type="button" className="btn btn-blue sm" disabled={!bisaKabari || sibuk} title="Tekan setelah pesan terkirim" onClick={() => onKabari(p, e)}><Icon name="check" />Sudah dikabari</button>
          </Baris>
        );
      }
      case "reminder": {
        const i = t.pengingat;
        return (
          <Baris key={t.key} ikon={<Icon name="alert" size={15} />} kelas={i.lewat ? "rem" : "lap"} judul={`Reminder: ${i.teks} · ${proyekDari(p)}`} sub={`${p.nama || p.email} · belum dikirim hari ini`} onBuka={buka({ tab: "kabar" })}>
            {wa ? <a className="btn btn-ghost sm" href={tautanWa(wa, pesanReminder(p, i))} target="_blank" rel="noopener noreferrer"><Icon name="send" />WhatsApp</a> : null}
            <button type="button" className="btn btn-blue sm" disabled={!bisaKabari || sibuk} title="Tekan setelah reminder terkirim" onClick={() => onReminder(p, i)}><Icon name="check" />Reminder dikirim</button>
          </Baris>
        );
      }
      default:
        return null;
    }
  };

  const itemKuota = (k) => (
    <Baris
      key={k.id}
      ikon={<Icon name="users" size={15} />}
      kelas="acc"
      judul={`Butuh guru · ${k.subtes} (${k.id})`}
      sub={`${numberID(k.tersedia)} soal belum ada guru${k.dipesan ? ` · ${numberID(k.dipesan)} menunggu ACC` : ""} · ${k.ditawari ? `${k.ditawari} guru ditawari${k.bersedia ? `, ${k.bersedia} bersedia` : ""}${k.menunggu ? `, ${k.menunggu} belum membalas` : ""}` : "belum ada tawaran"}`}
      due={k.menunggu ? <span className="pk-due qc">{k.menunggu} perlu ditindaklanjuti</span> : null}
      onBuka={() => onCariGuru(k)}
    >
      <button type="button" className="btn btn-blue sm" onClick={() => onCariGuru(k)}><Icon name="users" />Cari guru</button>
    </Baris>
  );

  return (
    <section className="pk-antrean" aria-label={`Antrean tugas ${tim.toUpperCase()}`}>
      <div className="pk-sec-head">
        <h2>Antrean tugas {tim.toUpperCase()}</h2>
        {tim === "clo" ? (
          <div className="pk-tabs" role="tablist" aria-label="Jenis tugas CLO">
            {[["kabar", "Kabar & reminder", tugas.length], ["kuota", "Butuh guru", kuota.length]].map(([k, l, n]) => (
              <button key={k} type="button" role="tab" aria-selected={tabClo === k} className={tabClo === k ? "on" : ""} onClick={() => { setTabClo(k); setSemua(false); }}>
                {l}<em>{numberID(n)}</em>
              </button>
            ))}
          </div>
        ) : (
          <span className="muted">{rincianRad || "kosong"}</span>
        )}
      </div>
      {isi.length ? (
        <ul className="pk-q">{tampil.map((t) => (daftarKuota ? itemKuota(t) : item(t)))}</ul>
      ) : (
        <div className="pk-q-empty">
          <Icon name="check" size={18} />
          {daftarKuota ? "Semua kuota katalog bulan ini sudah ada guru." : tim === "rad" ? "Tidak ada tugas RAD. Pengajuan, laporan progres, dan hasil akhir sudah diperiksa semua." : "Semua hasil RAD sudah dikabari dan tidak ada reminder yang perlu dikirim hari ini."}
        </div>
      )}
      {isi.length > TAMPIL_AWAL ? (
        <button type="button" className="btn-link pk-q-more" onClick={() => setSemua(!semua)}>
          {semua ? "Tampilkan lebih sedikit" : `Tampilkan semua ${numberID(isi.length)} ${daftarKuota ? "proyek" : "tugas"}`}
          <Icon name="chevronDown" size={14} />
        </button>
      ) : null}
    </section>
  );
}
