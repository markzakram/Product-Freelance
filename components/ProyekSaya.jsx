"use client";

// ============================================================================
//  "Proyek saya" — status setiap pengambilan proyek guru: menunggu acc,
//  running (dengan hitung mundur deadline), ditolak/dibatalkan (dengan
//  alasan). Pengajuan yang belum di-acc bisa dibatalkan sendiri.
// ============================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { numberID } from "@/lib/format";
import { ST, AKTIF, kelasStatus, labelStatus, hitungMundur, tanggalPendek } from "@/lib/pengerjaanOpsi";
import Brand from "./Brand";
import Icon from "./Icon";
import ThemeToggle from "./ThemeToggle";
import { AlurPengambilan } from "./GuideModal";

const namaBulan = (tab) => String(tab || "").split(/[_\s]/)[0] || tab;

function Kartu({ p, onBatal, sibuk }) {
  const dl = hitungMundur(p.deadline);
  const aktif = AKTIF.has(p.status);
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
      {p.catatan ? <p className={"ps-catatan" + (p.status === ST.ditolak ? " tolak" : "")}>{p.catatan}</p> : null}
      {p.status === ST.diajukan ? (
        <div className="ps-aksi">
          <small className="muted">Kuota sudah dipesan untukmu sambil menunggu acc tim akademik.</small>
          <button type="button" className="btn btn-ghost sm" disabled={sibuk} onClick={() => onBatal(p)}>
            Batalkan pengajuan
          </button>
        </div>
      ) : p.status === ST.running ? (
        <div className="ps-aksi">
          <small className="muted">Kerjakan sebelum deadline. Pengumpulan hasil (link Google Docs) mengikuti arahan tim akademik.</small>
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
  const jalan = aktif.filter((p) => p.status === ST.running).length;

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
            <span>sedang dikerjakan</span>
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
              <Kartu key={p.id} p={p} onBatal={batal} sibuk={sibuk} />
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
                <Kartu key={p.id} p={p} onBatal={batal} sibuk={sibuk} />
              ))}
            </div>
          </>
        ) : null}
      </main>
      <div className="footer">© {new Date().getFullYear()} Product Freelance</div>
    </div>
  );
}
