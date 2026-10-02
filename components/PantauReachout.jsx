"use client";

// ============================================================================
//  PANTAU REACHOUT — seberapa jauh kuota bulan ini terisi, siapa saja yang
//  sudah ditawari, dan siapa yang perlu ditindaklanjuti. Kontak dibaca dari
//  tab "Reachout" (lib/reachout.js); setiap tombol WA admin mencatat lewat
//  lib/kontakWa.js. "Mengambil" dihitung dari Log pengambilan bulan ini.
// ============================================================================

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { numberID } from "@/lib/format";
import { tautanWa } from "@/lib/tautan";
import { pemetaLog } from "@/lib/cocokGuru";
import {
  TAWARAN,
  TUJUAN_REKRUT,
  HASIL,
  MENUNGGU,
  AMBIL,
  BATAS_HARI,
  MAKS_KONTAK,
  kelasHasil,
  kelompokkan,
  kunciGuru,
  kunciPasangan,
  kunciTawaran,
  sejak,
  pesanTindakLanjut,
  pesanIngatkanAmbil,
} from "@/lib/reachoutOpsi";
import { catatWa, tandaiHasilWa } from "@/lib/kontakWa";
import CariGuru from "./CariGuru";
import Icon from "./Icon";

const HARI = 86400000;
const BATAL = /cancel|batal/i;
const persen = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const dibalas = (s) => s !== MENUNGGU && s !== "Tak ada kabar";
const masihJalan = (s) => s === MENUNGGU || s === "Dibalas" || s === "Bersedia";

/** Pilihan hasil satu kontak; `nilai` = hasil pasangan bila berbeda dari baris terakhirnya. */
export function PilihHasil({ kontak, nilai, bisa, label }) {
  return (
    <select
      className="select sm rc-hasil"
      aria-label={label || "Hasil kontak"}
      value={nilai ?? kontak.hasil ?? ""}
      disabled={!bisa || kontak.sementara}
      onChange={(e) => tandaiHasilWa(kontak, e.target.value)}
    >
      <option value="">{MENUNGGU}</option>
      {HASIL.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  );
}

const SARING_AKT = [
  ["semua", "Semua", () => true],
  ["tawaran", "Tawaran proyek", (k) => k.tujuan === TAWARAN],
  ["rekrut", "Rekrutmen & akun", (k) => TUJUAN_REKRUT.has(k.tujuan)],
  ["langsung", "Chat langsung", (k) => k.tujuan === "Chat langsung"],
];

// Kontak dicatat atas nama anggota tim yang login (`namaSaya`) — diisi server dari sesi.
export default function PantauReachout({ data, projects, assignments, bulan, namaBulan, guruDb, master, riwayat, akun, wajibLogin, namaSaya = "", aksiEl, muatUlang }) {
  const [saringP, setSaringP] = useState("kurang");
  const [buka, setBuka] = useState(() => new Set());
  const [saringA, setSaringA] = useState("semua");
  const [nAkt, setNAkt] = useState(15);
  const [nTindak, setNTindak] = useState(8);
  const [cari, setCari] = useState(null);

  const kontak = useMemo(() => data?.kontak || [], [data]);
  const bisa = Boolean(data?.canWrite);
  const kini = Date.now();
  const asal = typeof window !== "undefined" ? window.location.origin : "";

  const guruById = useMemo(() => new Map(guruDb.filter((g) => g.idGuru).map((g) => [String(g.idGuru), g])), [guruDb]);
  const waDari = (x) => guruById.get(String(x.idGuru))?.wa || x.wa;
  const projById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // soal yang diambil per (proyek × guru) bulan ini, dan berapa guru per proyek
  const { ambil, pengambil } = useMemo(() => {
    const peta = pemetaLog(guruDb);
    const ambil = new Map();
    const pengambil = new Map();
    assignments.forEach((a) => {
      if (!a.idProject || BATAL.test(a.status || "")) return;
      const g = peta(a);
      if (g) {
        const k = kunciTawaran(bulan, a.idProject, g);
        ambil.set(k, (ambil.get(k) || 0) + (a.jumlah || 0));
      }
      const s = pengambil.get(a.idProject) || new Set();
      s.add(g ? kunciGuru(g) : a.guru);
      pengambil.set(a.idProject, s);
    });
    return { ambil, pengambil };
  }, [assignments, guruDb, bulan]);

  const pasang = useMemo(() => kelompokkan(kontak), [kontak]);
  const tawaran = useMemo(
    () =>
      pasang
        .filter((x) => x.tujuan === TAWARAN && x.bulan === bulan)
        .map((x) => {
          const soal = ambil.get(x.key) || 0;
          return { ...x, soal, status: soal ? AMBIL : x.hasil || MENUNGGU };
        }),
    [pasang, ambil, bulan]
  );
  const tawaranByKey = useMemo(() => new Map(tawaran.map((x) => [x.key, x])), [tawaran]);

  const daftarProyek = useMemo(
    () =>
      projects
        .filter((p) => p.kebutuhan > 0)
        .map((p) => {
          const ps = tawaran.filter((x) => x.idProyek === p.id).sort((a, b) => b.terakhir - a.terakhir);
          const sisa = Math.max(0, Math.min(p.kebutuhan, p.sisa));
          const terisi = p.kebutuhan - sisa;
          const c = {
            ditawari: ps.length,
            dibalas: ps.filter((x) => dibalas(x.status)).length,
            bersedia: ps.filter((x) => x.status === "Bersedia" || x.status === AMBIL).length,
            ambil: ps.filter((x) => x.status === AMBIL).length,
          };
          const aktif = ps.filter((x) => masihJalan(x.status)).length;
          const st =
            sisa <= 0
              ? { label: "Terpenuhi", cls: "appr" }
              : !ps.length
                ? { label: "Belum ditawarkan", cls: "rev" }
                : !aktif && !c.ambil
                  ? { label: "Perlu calon baru", cls: "rev" }
                  : { label: `Kurang ${numberID(sisa)} soal`, cls: aktif ? "qc" : "rev" };
          return { p, ps, sisa, terisi, pct: persen(terisi, p.kebutuhan), c, aktif, st, pengambil: pengambil.get(p.id)?.size || 0 };
        })
        .sort((a, b) => ((a.sisa > 0) === (b.sisa > 0) ? a.pct - b.pct : a.sisa > 0 ? -1 : 1)),
    [projects, tawaran, pengambil]
  );

  // ---------------------------------------------------------------- angka
  const totKeb = daftarProyek.reduce((s, d) => s + d.p.kebutuhan, 0);
  const totIsi = daftarProyek.reduce((s, d) => s + d.terisi, 0);
  const nKurang = daftarProyek.filter((d) => d.sisa > 0).length;
  const nGuru = new Set(tawaran.map((x) => kunciGuru(x))).size;
  const nAmbil = tawaran.filter((x) => x.status === AMBIL).length;
  const nBalas = tawaran.filter((x) => dibalas(x.status)).length;

  // ------------------------------------------------------- tindak lanjut
  // Orang yang perlu di-chat dulu (paling lama menunggu di atas), lalu proyek
  // yang semua calonnya sudah selesai tapi kuotanya masih kurang. Proyek yang
  // belum ditawarkan sama sekali cukup diringkas satu baris — di awal bulan
  // jumlahnya bisa belasan dan akan menenggelamkan yang lain.
  const tindak = [];
  const belumDitawarkan = daftarProyek.filter((d) => d.sisa > 0 && !d.ps.length);
  daftarProyek.forEach((d) => d.sisa > 0 && d.ps.length && !d.aktif && tindak.push({ jenis: "tawarkan", key: "p:" + d.p.id, d, urut: 3 }));
  tawaran.forEach((x) => {
    const p = projById.get(x.idProyek);
    if (!p || p.sisa <= 0) return;
    const umur = kini - x.terakhir;
    if (x.status === MENUNGGU && umur >= BATAS_HARI * HARI) tindak.push({ jenis: x.kontak.length >= MAKS_KONTAK ? "berhenti" : "ulang", key: x.key, x, p, urut: 1, umur });
    else if (x.status === "Bersedia" && kini - (x.tHasil || x.terakhir) >= HARI) tindak.push({ jenis: "ingatkan", key: x.key, x, p, urut: 2, umur: kini - (x.tHasil || x.terakhir) });
  });
  tindak.sort((a, b) => a.urut - b.urut || (b.umur || 0) - (a.umur || 0));

  // ----------------------------------------------------------- aktivitas
  const urutAkt = useMemo(() => [...kontak].sort((a, b) => b.t - a.t), [kontak]);
  const hitungA = Object.fromEntries(SARING_AKT.map(([k, , f]) => [k, urutAkt.filter(f).length]));
  const aktivitas = urutAkt.filter(SARING_AKT.find(([k]) => k === saringA)[2]);

  const nTindakTotal = tindak.length + belumDitawarkan.length;
  const listP = daftarProyek.filter((d) =>
    saringP === "kurang" ? d.sisa > 0 : saringP === "belum" ? d.sisa > 0 && !d.ps.length : saringP === "penuh" ? d.sisa <= 0 : true
  );
  const lihatBelum = () => {
    setSaringP("belum");
    document.getElementById("rc-proyek")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const ubahBuka = (id) =>
    setBuka((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const tombolWa = ({ x, p, pesan, label, ghost }) => {
    const wa = waDari(x);
    if (!wa) return <span className="muted xs2">WA belum ada</span>;
    return (
      <a
        className={"btn sm " + (ghost ? "btn-ghost" : "btn-wa")}
        href={tautanWa(wa, pesan)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => catatWa({ tujuan: TAWARAN, bulan, idProyek: p.id, subtes: p.subtes, idGuru: x.idGuru, nama: x.nama, email: x.email, wa })}
      >
        <Icon name="send" /> {label}
      </a>
    );
  };

  const aksi = aksiEl
    ? createPortal(
        <>
          {namaSaya ? (
            <span className="rc-pic">
              <Icon name="userCheck" size={16} /> Dicatat atas nama <b>{namaSaya}</b>
            </span>
          ) : null}
          <button type="button" className="btn btn-ghost sm" onClick={muatUlang} title="Baca ulang tab Reachout (kontak dari admin lain)">
            <Icon name="refresh" /> Segarkan
          </button>
        </>,
        aksiEl
      )
    : null;

  if (!data) return <div className="card empty">Memuat reachout…</div>;

  return (
    <>
      {aksi}
      {data.error ? (
        <div className="banner err">
          <Icon name="alert" />
          <div>Tab Reachout belum bisa dibaca: {data.error}</div>
        </div>
      ) : null}
      {!kontak.length && !data.error ? (
        <div className="banner info">
          <Icon name="info" />
          <div>
            Belum ada kontak tercatat. Mulai dari <b>Katalog bulan ini → Cari guru → Tawarkan via WA</b>: setiap klik tombol WhatsApp di dashboard (tawaran, Tinjau
            pendaftar, minta sampel, kirim akun, profil guru) otomatis tercatat di sini dan di tab <b>{data.tab || "Reachout"}</b>.
          </div>
        </div>
      ) : null}

      <div className="grid stat-grid rc-kpi">
        <div className="card stat">
          <span className="label">Kuota {namaBulan || "bulan ini"} terisi</span>
          <span className="value">{persen(totIsi, totKeb)}%</span>
          <div className="meter">
            <i style={{ width: Math.min(100, persen(totIsi, totKeb)) + "%" }} />
          </div>
          <span className="sub">
            {numberID(totIsi)} dari {numberID(totKeb)} soal · {numberID(nKurang)} proyek masih kurang
          </span>
        </div>
        <div className="card stat">
          <span className="label">Guru ditawari</span>
          <span className="value">{numberID(nGuru)}</span>
          <span className="sub">
            {numberID(tawaran.length)} tawaran · {numberID(nAmbil)} berakhir mengambil ({persen(nAmbil, tawaran.length)}%)
          </span>
        </div>
        <div className="card stat">
          <span className="label">Tingkat balasan</span>
          <span className="value">{tawaran.length ? persen(nBalas, tawaran.length) + "%" : "—"}</span>
          <span className="sub">
            {numberID(nBalas)} dari {numberID(tawaran.length)} tawaran dibalas
          </span>
        </div>
        <div className="card stat">
          <span className="label">Perlu tindak lanjut</span>
          <span className={"value " + (nTindakTotal ? "amber" : "green")}>{numberID(nTindakTotal)}</span>
          <span className="sub">
            {numberID(tindak.length)} kontak/proyek · {numberID(belumDitawarkan.length)} proyek belum ditawarkan
          </span>
        </div>
      </div>

      {/* ------------------------------------------------ tindak lanjut */}
      <section className="card card-p rc-sec">
        <div className="section-head">
          <h2>Tindak lanjut</h2>
          <span className="muted">proyek {namaBulan} yang kuotanya belum penuh</span>
        </div>
        {!nTindakTotal ? (
          <p className="muted rc-kosong">Tidak ada yang perlu ditindaklanjuti sekarang.</p>
        ) : (
          <div className="rc-list">
            {belumDitawarkan.length ? (
              <div className="rc-t">
                <span className="rc-ikon rev">
                  <Icon name="layers" />
                </span>
                <div className="rc-t-isi">
                  <b>{numberID(belumDitawarkan.length)} proyek belum ditawarkan ke siapa pun</b>
                  <span>
                    kurang {numberID(belumDitawarkan.reduce((n, d) => n + d.sisa, 0))} soal ·{" "}
                    {belumDitawarkan
                      .slice(0, 3)
                      .map((d) => d.p.subtes)
                      .join(", ")}
                    {belumDitawarkan.length > 3 ? `, +${numberID(belumDitawarkan.length - 3)} lagi` : ""}
                  </span>
                </div>
                <div className="rc-t-aksi">
                  <button type="button" className="btn btn-ghost sm" onClick={lihatBelum}>
                    Lihat proyeknya
                  </button>
                </div>
              </div>
            ) : null}
            {tindak.slice(0, nTindak).map((t) =>
              t.jenis === "tawarkan" ? (
                <div key={t.key} className="rc-t">
                  <span className="rc-ikon rev">
                    <Icon name="users" />
                  </span>
                  <div className="rc-t-isi">
                    <b>{t.d.p.subtes}</b>
                    <span>
                      kurang {numberID(t.d.sisa)} soal ·{" "}
                      {t.d.c.ambil ? "yang ditawari sudah mengambil, kuota masih kurang — tawarkan ke guru lain" : "semua yang ditawari menolak atau tak ada kabar"}
                    </span>
                  </div>
                  <div className="rc-t-aksi">
                    <button type="button" className="btn btn-blue sm" onClick={() => setCari(t.d.p)} disabled={!guruDb.length}>
                      <Icon name="search" /> Cari guru
                    </button>
                  </div>
                </div>
              ) : (
                <div key={t.key} className="rc-t">
                  <span className={"rc-ikon " + (t.jenis === "ingatkan" ? "appr" : t.jenis === "berhenti" ? "rev" : "qc")}>
                    <Icon name={t.jenis === "ingatkan" ? "bag" : "send"} />
                  </span>
                  <div className="rc-t-isi">
                    <b>
                      {t.x.nama} · {t.p.subtes}
                    </b>
                    <span>
                      {t.jenis === "ingatkan"
                        ? `bersedia ${sejak(t.x.tHasil || t.x.terakhir, kini)}, tapi belum mengambil kuota`
                        : t.jenis === "berhenti"
                          ? `sudah ${t.x.kontak.length}× dihubungi tanpa balasan — tandai tak ada kabar lalu tawarkan ke guru lain`
                          : `belum dibalas · ${t.x.kontak.length}× dihubungi · terakhir ${sejak(t.x.terakhir, kini)}`}
                    </span>
                  </div>
                  <div className="rc-t-aksi">
                    {t.jenis === "berhenti" ? (
                      <button type="button" className="btn btn-ghost sm" disabled={!bisa || t.x.akhir.sementara} onClick={() => tandaiHasilWa(t.x.akhir, "Tak ada kabar")}>
                        Tandai tak ada kabar
                      </button>
                    ) : (
                      tombolWa({ x: t.x, p: t.p, label: t.jenis === "ingatkan" ? "Ingatkan ambil" : "Chat ulang", pesan: t.jenis === "ingatkan" ? pesanIngatkanAmbil(t.x.nama, t.p, asal) : pesanTindakLanjut(t.x.nama, t.p, asal) })
                    )}
                    <PilihHasil kontak={t.x.akhir} nilai={t.x.hasil} bisa={bisa} label={`Hasil tawaran ke ${t.x.nama}`} />
                  </div>
                </div>
              )
            )}
          </div>
        )}
        {tindak.length > nTindak ? (
          <button type="button" className="btn-link rc-lagi" onClick={() => setNTindak(tindak.length)}>
            Tampilkan semua ({numberID(tindak.length)})
          </button>
        ) : null}
      </section>

      {/* --------------------------------------------- progres per proyek */}
      <section className="rc-sec" id="rc-proyek">
        <div className="section-head">
          <h2>Progres per proyek</h2>
          <div className="chips" role="group" aria-label="Saring proyek">
            {[
              ["kurang", "Masih kurang", nKurang],
              ["belum", "Belum ditawarkan", belumDitawarkan.length],
              ["penuh", "Terpenuhi", daftarProyek.length - nKurang],
              ["semua", "Semua", daftarProyek.length],
            ].map(([k, l, n]) => (
              <button key={k} type="button" className={"chip sm" + (saringP === k ? " active" : "")} aria-pressed={saringP === k} onClick={() => setSaringP(k)}>
                {l} <span className="n">{numberID(n)}</span>
              </button>
            ))}
          </div>
        </div>
        {!listP.length ? (
          <div className="card empty">
            {saringP === "kurang" ? "Semua kuota proyek bulan ini sudah terpenuhi." : saringP === "belum" ? "Semua proyek yang masih kurang sudah ditawarkan." : "Tidak ada proyek."}
          </div>
        ) : (
          <div className="rc-list-p">
            {listP.map((d) => {
              const terbuka = buka.has(d.p.id);
              return (
                <article key={d.p.id} className="card rc-proyek">
                  <div className="rc-p-atas">
                    <div className="rc-p-nama">
                      <b>{d.p.subtes}</b>
                      <span>
                        {d.p.id} · {d.p.output || "—"}
                        {d.p.platform ? ` · ${d.p.platform}` : ""}
                      </span>
                    </div>
                    <span className={"pill " + d.st.cls}>{d.st.label}</span>
                  </div>
                  <div className="rc-p-isi">
                    <div className="rc-kuota">
                      <div className={"meter" + (d.sisa > 0 && d.pct < 50 ? " warn" : "")} aria-label={`${d.pct}% kuota terisi`}>
                        <i style={{ width: d.pct + "%" }} />
                      </div>
                      <small>
                        <b>{numberID(d.terisi)}</b>/{numberID(d.p.kebutuhan)} soal · {d.pct}%{d.pengambil ? ` · ${numberID(d.pengambil)} guru mengambil` : ""}
                      </small>
                    </div>
                    {!d.c.ditawari ? (
                      <span className="muted rc-corong-kosong">belum ada tawaran tercatat</span>
                    ) : (
                    <ol className="rc-corong" aria-label="Corong tawaran">
                      <li>
                        <b>{numberID(d.c.ditawari)}</b>
                        <span>ditawari</span>
                      </li>
                      <li>
                        <b>{numberID(d.c.dibalas)}</b>
                        <span>dibalas</span>
                      </li>
                      <li>
                        <b>{numberID(d.c.bersedia)}</b>
                        <span>bersedia</span>
                      </li>
                      <li>
                        <b>{numberID(d.c.ambil)}</b>
                        <span>mengambil</span>
                      </li>
                    </ol>
                    )}
                    <div className="rc-p-aksi">
                      {d.ps.length ? (
                        <button type="button" className="btn btn-ghost sm" aria-expanded={terbuka} onClick={() => ubahBuka(d.p.id)}>
                          {terbuka ? "Tutup" : `${numberID(d.ps.length)} guru`}
                          <Icon name="chevronDown" />
                        </button>
                      ) : null}
                      {d.sisa > 0 ? (
                        <button type="button" className="btn btn-ghost sm" onClick={() => setCari(d.p)} disabled={!guruDb.length}>
                          <Icon name="search" /> Cari guru
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {terbuka ? (
                    <div className="rc-guru">
                      {d.ps.map((x) => (
                        <div key={x.key} className="rc-g">
                          <div className="rc-g-nama">
                            <b>{x.nama}</b>
                            <span>
                              {x.kontak.length}× dihubungi · terakhir {sejak(x.terakhir, kini)}
                              {x.akhir.pic ? ` · ${x.akhir.pic}` : ""}
                            </span>
                          </div>
                          <div className="rc-t-aksi">
                            {x.status === AMBIL ? (
                              <span className="pill appr">mengambil {numberID(x.soal)} soal</span>
                            ) : (
                              <>
                                {d.sisa > 0 && x.status === MENUNGGU && x.kontak.length < MAKS_KONTAK ? (
                                  tombolWa({ x: x, p: d.p, ghost: true, label: "Chat ulang", pesan: pesanTindakLanjut(x.nama, d.p, asal) })
                                ) : d.sisa > 0 && x.status === "Bersedia" ? (
                                  tombolWa({ x: x, p: d.p, ghost: true, label: "Ingatkan ambil", pesan: pesanIngatkanAmbil(x.nama, d.p, asal) })
                                ) : null}
                                <PilihHasil kontak={x.akhir} nilai={x.hasil} bisa={bisa} label={`Hasil tawaran ke ${x.nama}`} />
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------------ aktivitas */}
      <section className="card card-p rc-sec">
        <div className="section-head">
          <h2>Aktivitas terbaru</h2>
          <span className="muted">semua kontak WA dari dashboard</span>
        </div>
        <div className="chips geser" role="group" aria-label="Saring tujuan kontak">
          {SARING_AKT.filter(([k]) => k === "semua" || hitungA[k] || saringA === k).map(([k, l]) => (
            <button key={k} type="button" className={"chip sm" + (saringA === k ? " active" : "")} aria-pressed={saringA === k} onClick={() => setSaringA(k)}>
              {l} <span className="n">{numberID(hitungA[k])}</span>
            </button>
          ))}
        </div>
        {!aktivitas.length ? (
          <p className="muted rc-kosong">Belum ada kontak.</p>
        ) : (
          <div className="rc-list">
            {aktivitas.slice(0, nAkt).map((k) => {
              const ps = k.tujuan === TAWARAN ? tawaranByKey.get(kunciPasangan(k)) : null;
              return (
                <div key={k.kid} className="rc-a">
                  <span className="rc-a-w" title={k.waktu}>
                    {sejak(k.t, kini)}
                  </span>
                  <div className="rc-t-isi">
                    <b>{k.nama || k.email || "—"}</b>
                    <span>
                      {k.tujuan}
                      {k.tujuan === TAWARAN ? ` · ${k.subtes || k.idProyek}` : ""}
                      {k.tujuan === TAWARAN && k.bulan !== bulan ? ` (${k.bulan})` : ""}
                      {k.pic ? ` · ${k.pic}` : ""}
                    </span>
                  </div>
                  <div className="rc-t-aksi">
                    {k.sementara ? <span className="muted xs2">menyimpan…</span> : null}
                    {ps?.status === AMBIL ? <span className={"pill " + kelasHasil(AMBIL)}>{AMBIL}</span> : <PilihHasil kontak={k} bisa={bisa} label={`Hasil kontak ke ${k.nama}`} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {aktivitas.length > nAkt ? (
          <button type="button" className="btn-link rc-lagi" onClick={() => setNAkt((n) => n + 30)}>
            Tampilkan lebih banyak ({numberID(aktivitas.length - nAkt)} lagi)
          </button>
        ) : null}
      </section>

      {cari ? (
        <CariGuru
          proyek={cari}
          bulan={bulan}
          kontak={kontak}
          master={master}
          guru={guruDb}
          log={assignments}
          riwayat={riwayat}
          akun={akun}
          wajibLogin={wajibLogin}
          onClose={() => setCari(null)}
        />
      ) : null}
    </>
  );
}
