"use client";

// ============================================================================
//  CORONG REKRUTMEN & AKTIVASI — dari pendaftar sampai guru benar-benar
//  mengambil proyek, dengan persentase tiap tahap dan daftar yang tertahan
//  terlalu lama (lengkap dengan tombol WA pengingat yang ikut tercatat di tab
//  Reachout). Hitungan: lib/corong.js.
// ============================================================================

import { useMemo, useState } from "react";
import { numberID } from "@/lib/format";
import { tautanWa } from "@/lib/tautan";
import { sejak } from "@/lib/reachoutOpsi";
import { catatWa } from "@/lib/kontakWa";
import {
  corongRekrutmen,
  tertahanRekrutmen,
  corongAktivasi,
  tertahanAktivasi,
  persen,
  pesanIngatkanSampel,
  pesanIngatkanRevisi,
  pesanIngatkanLogin,
  pesanIngatkanGanti,
  pesanAjakProyek,
} from "@/lib/corong";
import { kelasTahap } from "./SeleksiDrawer";
import Icon from "./Icon";

const HARI = 86400000;
const PERIODE = [
  ["30", "30 hari"],
  ["90", "90 hari"],
  ["semua", "Semua"],
];
const satuDesimal = (x) => (x == null ? "—" : (Math.round(x * 10) / 10).toLocaleString("id-ID"));

function Corong({ tahap, label }) {
  const total = tahap[0]?.n || 0;
  return (
    <ol className="cr-corong" aria-label={label}>
      {tahap.map((t, i) => (
        <li key={t.k}>
          <div className="cr-l">
            <b>{t.label}</b>
            <span>{t.ket}</span>
          </div>
          <div className="cr-bar" aria-hidden="true">
            <i style={{ width: (total ? (t.n / total) * 100 : 0) + "%" }} />
          </div>
          <div className="cr-n">
            <b>{numberID(t.n)}</b>
            <span>{i ? `${persen(t.n, tahap[i - 1].n)}% dari sebelumnya` : total ? "100%" : "—"}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

const infoKontak = (k, kini) => (k ? ` · dihubungi ${sejak(k.t, kini)} (${k.tujuan.toLowerCase()})` : "");

export default function CorongRekrutmen({ akses, log = [], kontak = [], projects = [], bukaAkses }) {
  const [periode, setPeriode] = useState("semua");
  const [nR, setNR] = useState(8);
  const [nA, setNA] = useState(8);

  const pendaftar = useMemo(() => akses?.pendaftar || [], [akses]);
  const akun = useMemo(() => akses?.akun || [], [akses]);
  const guru = useMemo(() => akses?.guru || [], [akses]);
  const kini = Date.now();
  const asal = typeof window !== "undefined" ? window.location.origin : "";
  const sejakMs = periode === "semua" ? 0 : kini - Number(periode) * HARI;

  const rek = useMemo(() => corongRekrutmen(pendaftar, { log, guru, akun, sejakMs }), [pendaftar, log, guru, akun, sejakMs]);
  const akt = useMemo(() => corongAktivasi(guru, { akun, log }), [guru, akun, log]);
  const tRek = tertahanRekrutmen(pendaftar, { kontak, kini });
  const tAkt = tertahanAktivasi(akt.baris, { kontak, kini });
  const nTerbuka = projects.filter((p) => p.sisa > 0).length;

  if (!akses) return <div className="card empty">Memuat pendaftar & akun…</div>;

  const nAkses = rek.tahap[4]?.n || 0;
  const nAkun = akt.tahap[2]?.n || 0;
  const nLogin = akt.tahap[3]?.n || 0;

  // Tombol WA pengingat — ikut tercatat di Reachout seperti tombol WA lain.
  const tombolWa = ({ siapa, tujuan, pesan, label }) =>
    siapa.wa ? (
      <a
        className="btn btn-wa sm"
        href={tautanWa(siapa.wa, pesan)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => catatWa({ tujuan, idGuru: siapa.idGuru || "", nama: siapa.nama, email: siapa.email, wa: siapa.wa })}
      >
        <Icon name="send" /> {label}
      </a>
    ) : (
      <span className="muted xs2">WA belum ada</span>
    );

  return (
    <>
      {akses.errorPendaftar ? (
        <div className="banner err">
          <Icon name="alert" />
          <div>Data pendaftar belum terbaca: {akses.errorPendaftar}</div>
        </div>
      ) : null}

      <div className="chips" role="group" aria-label="Periode pendaftar">
        <span className="mpick-lbl">Pendaftar yang masuk</span>
        {PERIODE.map(([k, l]) => (
          <button key={k} type="button" className={"chip sm" + (periode === k ? " active" : "")} aria-pressed={periode === k} onClick={() => setPeriode(k)}>
            {l}
          </button>
        ))}
      </div>

      <div className="grid stat-grid rc-kpi">
        <div className="card stat">
          <span className="label">Pendaftar</span>
          <span className="value">{numberID(rek.kohort)}</span>
          <span className="sub">
            {numberID(rek.diproses)} masih diproses · {numberID(rek.ditolak)} ditolak
          </span>
        </div>
        <div className="card stat">
          <span className="label">Daftar → punya akses</span>
          <span className="value">{rek.kohort ? persen(nAkses, rek.kohort) + "%" : "—"}</span>
          <div className="meter">
            <i style={{ width: persen(nAkses, rek.kohort) + "%" }} />
          </div>
          <span className="sub">
            {numberID(nAkses)} dari {numberID(rek.kohort)} pendaftar
          </span>
        </div>
        <div className="card stat">
          <span className="label">Lama daftar → akses</span>
          <span className="value">
            {satuDesimal(rek.hariSampaiAkses)} <small>hari</small>
          </span>
          <span className="sub">{rek.nHariSampaiAkses ? `median dari ${numberID(rek.nHariSampaiAkses)} guru` : "belum ada yang sampai punya akses"}</span>
        </div>
        <div className="card stat">
          <span className="label">Akun dipakai</span>
          <span className="value">{nAkun ? persen(nLogin, nAkun) + "%" : "—"}</span>
          <span className="sub">
            {numberID(nLogin)} dari {numberID(nAkun)} akun pernah login
          </span>
        </div>
      </div>

      {/* ------------------------------------------------ rekrutmen */}
      <div className="cr-dua">
        <section className="card card-p rc-sec">
          <div className="section-head">
            <h2>Corong rekrutmen</h2>
            <span className="muted">{periode === "semua" ? "semua pendaftar" : `pendaftar ${PERIODE.find(([k]) => k === periode)[1]} terakhir`}</span>
          </div>
          <Corong tahap={rek.tahap} label="Corong rekrutmen" />
          <div className="cr-catatan">
            <span>
              <b>Sampel:</b> {numberID(rek.sampel.diminta)} wajib sampel · {numberID(rek.sampel.kirim)} sudah mengirim · {numberID(rek.sampel.lolos)} lolos
              {rek.sampel.sesiSampaiLolos ? ` (median ${satuDesimal(rek.sampel.sesiSampaiLolos)} sesi QC)` : ""}
            </span>
            {rek.ambilTanpaAkun ? <span>{numberID(rek.ambilTanpaAkun)} pendaftar lain sudah mengambil proyek tanpa akun (halaman proyek belum wajib login).</span> : null}
          </div>
        </section>

        <section className="card card-p rc-sec">
          <div className="section-head">
            <h2>Pendaftar tertahan</h2>
            <span className="muted">{numberID(tRek.length)} perlu didorong</span>
          </div>
          {!tRek.length ? (
            <p className="muted rc-kosong">Tidak ada pendaftar yang tertahan terlalu lama.</p>
          ) : (
            <div className="rc-list">
              {tRek.slice(0, nR).map((x) => (
                <div key={x.p.email} className="rc-t polos">
                  <div className="rc-t-isi">
                    <b>
                      {x.p.nama || x.p.email} <span className={"pill " + kelasTahap(x.p.status)}>{x.p.status}</span>
                    </b>
                    <span>
                      {x.alasan} · {numberID(x.hari)} hari{infoKontak(x.kontak, kini)}
                    </span>
                  </div>
                  <div className="rc-t-aksi">
                    {x.jenis === "sampel"
                      ? tombolWa({ siapa: x.p, tujuan: "Minta sampel", label: "Ingatkan sampel", pesan: pesanIngatkanSampel(x.p) })
                      : x.jenis === "revisi"
                        ? tombolWa({ siapa: x.p, tujuan: "Minta sampel", label: "Ingatkan revisi", pesan: pesanIngatkanRevisi(x.p, x.p.seleksi.qc.slice(-1)[0].sesi) })
                        : null}
                    <button
                      type="button"
                      className={"btn sm " + (x.jenis === "sampel" || x.jenis === "revisi" ? "btn-ghost" : "btn-blue")}
                      onClick={() => bukaAkses({ email: x.p.email, tampil: "pendaftar", tinjau: x.jenis === "tinjau" || x.jenis === "putuskan" })}
                    >
                      {x.jenis === "tinjau" ? "Tinjau" : x.jenis === "putuskan" ? "Putuskan" : x.jenis === "akses" ? "Beri akses" : x.jenis === "data" ? "Verifikasi" : "Buka"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tRek.length > nR ? (
            <button type="button" className="btn-link rc-lagi" onClick={() => setNR(tRek.length)}>
              Tampilkan semua ({numberID(tRek.length)})
            </button>
          ) : null}
        </section>
      </div>

      {/* ------------------------------------------------ aktivasi */}
      <div className="cr-dua">
        <section className="card card-p rc-sec">
          <div className="section-head">
            <h2>Corong aktivasi akun</h2>
            <span className="muted">seluruh Data guru</span>
          </div>
          {!akses.wajibLogin ? (
            <div className="banner info">
              <Icon name="info" />
              <div>Halaman proyek masih terbuka tanpa login, jadi guru bisa mengambil proyek tanpa akun — tahap login belum mencerminkan aktivitas sebenarnya.</div>
            </div>
          ) : null}
          <Corong tahap={akt.tahap} label="Corong aktivasi akun" />
          <div className="cr-catatan">
            <span>
              {numberID(akt.belumAkun)} guru ber-email belum punya akun · {numberID(akt.tanpaEmail)} tanpa email
              {akt.nonaktif ? ` · ${numberID(akt.nonaktif)} akun nonaktif` : ""}
            </span>
            {akt.belumAkun ? (
              <button type="button" className="btn-link" onClick={() => bukaAkses({ tampil: "akun", saringA: "belum" })}>
                Beri akses di Pendaftaran & akun
              </button>
            ) : null}
          </div>
        </section>

        <section className="card card-p rc-sec">
          <div className="section-head">
            <h2>Akun belum aktif dipakai</h2>
            <span className="muted">{numberID(tAkt.length)} perlu didorong</span>
          </div>
          {!tAkt.length ? (
            <p className="muted rc-kosong">Semua akun sudah dipakai.</p>
          ) : (
            <div className="rc-list">
              {tAkt.slice(0, nA).map((x) => (
                <div key={x.g.idGuru + x.jenis} className="rc-t polos">
                  <div className="rc-t-isi">
                    <b>{x.g.nama}</b>
                    <span>
                      {x.alasan}
                      {x.hari && x.jenis !== "login" ? ` · ${numberID(x.hari)} hari` : ""}
                      {x.jenis === "login" ? ` · akun dibuat ${numberID(x.hari)} hari lalu` : ""}
                      {infoKontak(x.kontak, kini)}
                    </span>
                  </div>
                  <div className="rc-t-aksi">
                    {x.jenis === "login"
                      ? tombolWa({ siapa: x.g, tujuan: "Ingatkan aktivasi", label: "Ingatkan login", pesan: pesanIngatkanLogin(x.g, asal) })
                      : x.jenis === "ganti"
                        ? tombolWa({ siapa: x.g, tujuan: "Ingatkan aktivasi", label: "Ingatkan", pesan: pesanIngatkanGanti(x.g, asal) })
                        : x.jenis === "proyek"
                          ? tombolWa({ siapa: x.g, tujuan: "Ingatkan aktivasi", label: "Ajak ambil proyek", pesan: pesanAjakProyek(x.g, asal, nTerbuka) })
                          : null}
                    <button type="button" className="btn btn-ghost sm" onClick={() => bukaAkses({ email: x.g.email, tampil: "akun" })}>
                      {x.jenis === "terkunci" || x.jenis === "login" ? "Reset password" : "Buka akun"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tAkt.length > nA ? (
            <button type="button" className="btn-link rc-lagi" onClick={() => setNA(tAkt.length)}>
              Tampilkan semua ({numberID(tAkt.length)})
            </button>
          ) : null}
        </section>
      </div>
    </>
  );
}
