"use client";

// ============================================================================
//  "Proyek saya" — status setiap pengambilan proyek guru: menunggu acc,
//  running (dengan hitung mundur deadline), ditolak/dibatalkan (dengan
//  alasan). Pengajuan yang belum di-acc bisa dibatalkan sendiri.
// ============================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { numberID } from "@/lib/format";
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
  linkSah,
  sisaWaktu,
  pengingat,
  statusTitik,
  titikBerikut,
  tanggalHari,
} from "@/lib/pengerjaanOpsi";
import Brand from "./Brand";
import Icon from "./Icon";
import ThemeToggle from "./ThemeToggle";
import { AlurPengambilan } from "./GuideModal";

const namaBulan = (tab) => String(tab || "").split(/[_\s]/)[0] || tab;

function FormKumpul({ p, onKumpul, sibuk }) {
  const [link, setLink] = useState(p.link || "");
  const [catatan, setCatatan] = useState("");
  const [galat, setGalat] = useState("");
  const kirim = (e) => {
    e.preventDefault();
    if (!linkSah(link)) return setGalat("Pakai link Google Docs / Drive (diawali https://docs.google.com/ atau https://drive.google.com/).");
    setGalat("");
    onKumpul(p, link.trim(), catatan.trim());
  };
  return (
    <form className="ps-kumpul" onSubmit={kirim}>
      <label className="ffield">
        <span>{p.status === ST.revisi ? "Link hasil revisi (boleh link yang sama)" : "Link hasil pekerjaan (Google Docs dari Drive-mu)"}</span>
        <input className="input" type="url" inputMode="url" placeholder="https://docs.google.com/document/d/…" value={link} onChange={(e) => setLink(e.target.value)} required />
        <small>Pastikan aksesnya "Siapa saja yang memiliki link" bisa melihat/mengomentari.</small>
      </label>
      <label className="ffield">
        <span>Catatan untuk tim akademik (opsional)</span>
        <input className="input" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. nomor 12 & 40 sudah diperbaiki" />
      </label>
      {galat ? <small className="neg">{galat}</small> : null}
      <button type="submit" className="btn btn-blue" disabled={sibuk}>
        <Icon name="send" /> {p.status === ST.revisi ? "Kirim revisi" : "Kumpulkan untuk direview"}
      </button>
    </form>
  );
}

/** Jadwal titik lapor progres satu pengambilan: yang sudah masuk (✓) dan yang menunggu (H-x). */
function JadwalLapor({ titik, jumlah, info = false }) {
  if (!titik.length) return null;
  return (
    <ul className="jl-list" aria-label="Jadwal lapor progres">
      {titik.map((t) => (
        <li key={t.persen} className={t.selesai ? (t.telat ? "telat" : "ok") : t.lewat ? "lewat" : ""}>
          <span className="jl-persen">{t.persen}%</span>
          {t.selesai ? (
            <span>
              <Icon name="check" size={13} stroke={2.4} /> {t.laporan.otomatis ? "Terpenuhi lewat pengumpulan hasil akhir" : `${numberID(t.laporan.soal)}/${numberID(jumlah)} soal dilaporkan`} ·{" "}
              {t.laporan.waktu}
              {t.telat ? " · telat" : ""}
            </span>
          ) : (
            <span>
              min. {numberID(t.min)} soal · paling lambat <b>{tanggalHari(t.tanggal)}</b>
              {info ? "" : <span className={"pill " + (t.lewat || t.hm.hari === 0 ? "rev" : t.hm.hari <= 2 ? "qc" : "run")}>{t.h}</span>}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function FormProgres({ p, t, onLapor, sibuk }) {
  const min = t.min;
  const [soal, setSoal] = useState(String(min || ""));
  const [link, setLink] = useState(p.link || "");
  const [catatan, setCatatan] = useState("");
  const [galat, setGalat] = useState("");
  const kirim = (e) => {
    e.preventDefault();
    const n = parseInt(soal, 10) || 0;
    if (n < min) return setGalat(`Minimal ${min} soal (${t.persen}%) untuk lapor progres.`);
    if (n > p.jumlah) return setGalat(`Maksimal ${p.jumlah} soal.`);
    if (!linkSah(link)) return setGalat("Pakai link Google Docs / Drive.");
    setGalat("");
    onLapor(p, n, link.trim(), catatan.trim());
  };
  return (
    <form className="ps-kumpul" onSubmit={kirim}>
      <div className="ps-dua">
        <label className="ffield">
          <span>Soal yang sudah selesai</span>
          <input className="input" type="number" min={min} max={p.jumlah} value={soal} onChange={(e) => setSoal(e.target.value)} required />
        </label>
        <label className="ffield">
          <span>Link Google Docs pekerjaanmu</span>
          <input className="input" type="url" inputMode="url" placeholder="https://docs.google.com/document/d/…" value={link} onChange={(e) => setLink(e.target.value)} required />
        </label>
      </div>
      <label className="ffield">
        <span>Catatan (opsional)</span>
        <input className="input" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. sisa soal selesai Kamis" />
      </label>
      {galat ? <small className="neg">{galat}</small> : null}
      <button type="submit" className="btn btn-blue" disabled={sibuk}>
        <Icon name="check" stroke={2.4} /> Lapor progres {t.persen}%
      </button>
    </form>
  );
}

function Kartu({ p, onBatal, onKumpul, onLapor, sibuk }) {
  const dl = hitungMundur(p.deadline);
  const aktif = AKTIF.has(p.status);
  const sisa = belumSelesai(p);
  const batas = sisaWaktu(p.tBatas);
  const ingat = pengingat(p);
  const titik = statusTitik(p);
  const berikut = p.status === ST.running ? titikBerikut(p) : null;
  return (
    <article className={"ps-kartu" + (aktif ? "" : " selesai")}>
      <div className="ps-atas">
        <div className="ps-judul">
          <b>{p.subtes}</b>
          <span>
            {p.idProyek} · {p.output || "—"} · {namaBulan(p.bulan)}
          </span>
        </div>
        <span className={"pill " + kelasStatus(p.status)}>{labelStatus(p.status)}</span>
      </div>
      <div className="ps-info">
        <span>
          <small>Jumlah</small>
          <b>{numberID(p.jumlah)} soal</b>
        </span>
        <span>
          <small>Diajukan</small>
          <b>{p.diajukan || "—"}</b>
        </span>
        <span>
          <small>Deadline</small>
          <b className={aktif && p.deadline ? "dl-" + dl.kelas : ""}>
            {p.deadline ? `${tanggalPendek(p.deadline)}${aktif ? " · " + dl.teks : ""}` : "belum ditentukan"}
          </b>
        </span>
        {p.diputuskan ? (
          <span>
            <small>{p.status === ST.ditolak ? "Ditolak" : p.status === ST.dibatalkan ? "Dibatalkan" : "Di-acc"}</small>
            <b>
              {p.diputuskan}
              {p.oleh ? ` · ${p.oleh}` : ""}
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
        <div className={"ps-progres" + (berikut ? "" : " ok")}>
          <b>
            {p.status === ST.diajukan
              ? "Bila di-acc, wajib lapor progres:"
              : berikut
                ? `Wajib lapor progres ${berikut.persen}% — ${berikut.lewat ? berikut.h : `paling lambat ${tanggalHari(berikut.tanggal)} (${berikut.h})`}`
                : "Lapor progres"}
          </b>
          <JadwalLapor titik={titik} jumlah={p.jumlah} info={p.status === ST.diajukan} />
          {berikut ? (
            <>
              <small>
                Laporkan jumlah soal yang sudah selesai + link Google Docs-mu. Satu laporan bisa sekaligus memenuhi 30% dan 50% bila soalnya sudah cukup.
              </small>
              <FormProgres key={berikut.persen} p={p} t={berikut} onLapor={onLapor} sibuk={sibuk} />
            </>
          ) : null}
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
              <b>{numberID(p.tolakBuka + p.tolakHangus)}</b> ditolak
            </span>
          ) : null}
          {p.status !== ST.selesai && sisa ? (
            <span>
              <b>{numberID(sisa)}</b> {p.status === ST.revisi ? "perlu revisi" : "sedang direview"}
            </span>
          ) : null}
          <small>review ke-{numberID(p.ronde)}{p.reviewer ? ` · ${p.reviewer}` : ""}</small>
        </div>
      ) : null}
      {p.status === ST.revisi ? (
        <div className={"ps-revisi" + (batas.lewat ? " lewat" : "")}>
          <b>
            {numberID(sisa)} soal perlu revisi · batas {p.batasRevisi} ({batas.teks})
          </b>
          {p.catatanRevisi ? <p>{p.catatanRevisi}</p> : null}
          <small>Komentar detail ada di Google Docs-mu. Revisi yang dikirim lewat batas tetap dinilai, tetapi soal yang disetujui dibayar 75%.</small>
        </div>
      ) : null}
      {p.gagal >= PERINGATAN_MULAI && p.status !== ST.selesai ? (
        <p className="ps-catatan tolak">
          Peringatan: pekerjaan ini sudah {numberID(p.gagal)}× direview belum lolos. Lebih dari {DENDA_SETELAH - 1}× dapat dikenai potongan 25% dari fee proyek ini.
        </p>
      ) : null}
      {p.denda ? <p className="ps-catatan tolak">Potongan 25% diterapkan pada fee proyek ini (review gagal lebih dari 3×).</p> : null}
      {p.catatan ? <p className={"ps-catatan" + (p.status === ST.ditolak ? " tolak" : "")}>{p.catatan}</p> : null}
      {p.link ? (
        <a className="ps-link" href={p.link} target="_blank" rel="noopener noreferrer">
          <Icon name="external" size={14} /> Link yang dikumpulkan{p.dikumpulkan ? ` · ${p.dikumpulkan}` : ""}
        </a>
      ) : null}
      {berikut ? (
        <details className="ps-kumpul-lain">
          <summary>Sudah selesai semua? Kumpulkan hasil akhir</summary>
          <small className="muted">Lapor progres yang belum masuk dianggap terpenuhi saat hasil akhir dikumpulkan.</small>
          <FormKumpul p={p} onKumpul={onKumpul} sibuk={sibuk} />
        </details>
      ) : p.status === ST.running || p.status === ST.revisi ? (
        <FormKumpul p={p} onKumpul={onKumpul} sibuk={sibuk} />
      ) : null}
      {p.status === ST.review ? (
        <div className="ps-aksi">
          <small className="muted">Menunggu review tim akademik ({numberID(sisa)} soal). Hasilnya muncul di sini.</small>
        </div>
      ) : null}
      {p.status === ST.diajukan ? (
        <div className="ps-aksi">
          <small className="muted">Kuota sudah dipesan untukmu sambil menunggu acc tim akademik.</small>
          <button type="button" className="btn btn-ghost sm" disabled={sibuk} onClick={() => onBatal(p)}>
            Batalkan pengajuan
          </button>
        </div>
      ) : null}
    </article>
  );
}

export default function ProyekSaya({ daftar = [], gagalMuat = false, maks = 3, guru }) {
  const router = useRouter();
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const aktif = daftar.filter((p) => AKTIF.has(p.status));
  const riwayat = daftar.filter((p) => !AKTIF.has(p.status));
  const menunggu = aktif.filter((p) => p.status === ST.diajukan).length;
  const jalan = aktif.filter((p) => p.status === ST.running || p.status === ST.revisi).length;
  const direview = aktif.filter((p) => p.status === ST.review).length;
  const perhatian = aktif.map((p) => ({ p, ingat: pengingat(p) })).filter((x) => x.ingat.length);

  const kumpul = async (p, link, catatan) => {
    setSibuk(true);
    setGalat("");
    try {
      const res = await fetch("/api/guru/kumpul", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, link, catatan }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Gagal (HTTP ${res.status})`);
      router.refresh();
    } catch (e) {
      setGalat(e.message);
      window.scrollTo(0, 0);
    } finally {
      setSibuk(false);
    }
  };

  const lapor = async (p, soal, link, catatan) => {
    setSibuk(true);
    setGalat("");
    try {
      const res = await fetch("/api/guru/progres", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, soal, link, catatan }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Gagal (HTTP ${res.status})`);
      router.refresh();
    } catch (e) {
      setGalat(e.message);
      window.scrollTo(0, 0);
    } finally {
      setSibuk(false);
    }
  };

  const batal = async (p) => {
    if (!window.confirm(`Batalkan pengajuan ${p.subtes} (${p.jumlah} soal)? Kuotanya dibuka lagi untuk guru lain.`)) return;
    setSibuk(true);
    setGalat("");
    try {
      const res = await fetch("/api/guru/batal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Gagal (HTTP ${res.status})`);
      router.refresh();
    } catch (e) {
      setGalat(e.message);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="pub">
      <header className="pub-head">
        <div className="in">
          <a href="/open" aria-label="Ke daftar proyek">
            <Brand size={30} row />
          </a>
          <div className="pub-actions">
            <a className="btn btn-ghost" href="/open">
              <Icon name="layers" />
              <span className="lbl">Proyek terbuka</span>
            </a>
            <ThemeToggle className="sq" />
          </div>
        </div>
      </header>

      <main className="pub-body">
        <div className="pub-title">
          <span className="pub-ico">
            <Icon name="clipboard" size={20} />
          </span>
          <div>
            <h1>Proyek saya</h1>
            <p>
              {guru?.nama ? `${guru.nama} · ` : ""}status setiap proyek yang kamu ajukan.
            </p>
          </div>
        </div>

        {gagalMuat ? (
          <div className="banner err" role="alert">
            <Icon name="alert" />
            <div>Data pengambilan belum bisa dimuat. Coba muat ulang sebentar lagi.</div>
          </div>
        ) : null}
        {galat ? (
          <div className="banner err" role="alert">
            <Icon name="alert" />
            <div>{galat}</div>
          </div>
        ) : null}

        {perhatian.length ? (
          <div className="banner sample ps-perhatian" role="status">
            <Icon name="alert" />
            <div>
              <b>Perlu perhatian</b>
              <ul>
                {perhatian.map(({ p, ingat }) => (
                  <li key={p.id}>
                    {p.subtes}: {ingat.map((i) => i.teks).join(" · ")}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <div className="kpis">
          <div className="kpi">
            <span className="kpi-ico i1">
              <Icon name="layers" size={18} />
            </span>
            <b>
              {numberID(aktif.length)} <small>/ {numberID(maks)}</small>
            </b>
            <span>proyek aktif (batas bersamaan)</span>
          </div>
          <div className="kpi">
            <span className="kpi-ico i2">
              <Icon name="clipboard" size={18} />
            </span>
            <b>{numberID(menunggu)}</b>
            <span>menunggu acc</span>
          </div>
          <div className="kpi">
            <span className="kpi-ico i3">
              <Icon name="check" size={18} stroke={2.2} />
            </span>
            <b>{numberID(jalan)}</b>
            <span>{direview ? `dikerjakan · ${numberID(direview)} menunggu review` : "sedang dikerjakan / revisi"}</span>
          </div>
        </div>

        <details className="card card-p ps-alur">
          <summary>
            <Icon name="book" /> Cara kerja pengambilan proyek
          </summary>
          <AlurPengambilan />
        </details>

        <div className="eyebrow">Aktif · {numberID(aktif.length)}</div>
        {aktif.length ? (
          <div className="ps-list">
            {aktif.map((p) => (
              <Kartu key={p.id} p={p} onBatal={batal} onKumpul={kumpul} onLapor={lapor} sibuk={sibuk} />
            ))}
          </div>
        ) : (
          <div className="card empty">
            Belum ada proyek aktif.{" "}
            <a className="btn-link" href="/open">
              Lihat proyek terbuka
            </a>
          </div>
        )}

        {riwayat.length ? (
          <>
            <div className="eyebrow">Riwayat · {numberID(riwayat.length)}</div>
            <div className="ps-list">
              {riwayat.map((p) => (
                <Kartu key={p.id} p={p} onBatal={batal} onKumpul={kumpul} sibuk={sibuk} />
              ))}
            </div>
          </>
        ) : null}
      </main>
      <div className="footer">© {new Date().getFullYear()} Product Freelance</div>
    </div>
  );
}
