"use client";

// ============================================================================
//  Panel PROFIL GURU (admin): data form, kontak, rekening, riwayat proyek di
//  SEMUA bulan (termasuk yang disembunyikan dari dashboard), ringkasan status
//  pekerjaan, beban vs kapasitas, hasil seleksi/QC sampel, dan ajuan
//  perubahan data dari "Profil saya" (setujui / tolak di sini).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { rupiah, numberID } from "@/lib/format";
import { tautanWa } from "@/lib/tautan";
import { bankDanRekening } from "@/lib/rekapFee";
import Drawer from "./Drawer";
import Icon from "./Icon";

const SELESAI = /appro|paid|dibayar|selesai/i;
const BATAL = /cancel|batal/i;
const pillStatus = (s) => {
  const t = String(s || "").toLowerCase();
  const c = BATAL.test(t) ? "batal" : /appro|paid/.test(t) ? "appr" : /revisi/.test(t) ? "rev" : /qc/.test(t) ? "qc" : "run";
  return <span className={"pill " + c}>{s || "—"}</span>;
};
const samarkan = (nik) => (nik && nik.length > 8 ? `${nik.slice(0, 4)}••••••••${nik.slice(-4)}` : nik || "—");
const tautan = (v) => (/^https?:/i.test(String(v || "")) ? String(v).split(/[\s,]+/).filter((x) => /^https?:/i.test(x)) : []);

export async function putuskan(row, setuju) {
  const res = await fetch("/api/admin/perubahan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ row, setuju }),
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Gagal (HTTP ${res.status})`);
  return j;
}

function Baris({ label, children }) {
  return (
    <div className="pg-baris">
      <span>{label}</span>
      <div>{children || "—"}</div>
    </div>
  );
}

export default function ProfilGuru({ idGuru, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState("");
  const [lihatNik, setLihatNik] = useState(false);
  const [semuaRiwayat, setSemuaRiwayat] = useState(false);
  const [sibuk, setSibuk] = useState(0);

  const muat = useCallback(async () => {
    setGalat("");
    try {
      const res = await fetch("/api/admin/profil-guru?id=" + encodeURIComponent(idGuru), { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "HTTP " + res.status);
      setData(j);
    } catch (e) {
      setGalat(e.message);
    }
  }, [idGuru]);
  useEffect(() => {
    muat();
  }, [muat]);

  const r = useMemo(() => {
    const rw = data?.riwayat || [];
    const aktif = rw.filter((x) => !BATAL.test(x.status || ""));
    const st = {};
    rw.forEach((x) => (st[x.status || "(tanpa status)"] = (st[x.status || "(tanpa status)"] || 0) + 1));
    const perBulan = {};
    aktif.forEach((x) => {
      perBulan[x.bulan] = perBulan[x.bulan] || { soal: 0, fee: 0 };
      perBulan[x.bulan].soal += x.jumlah || 0;
      perBulan[x.bulan].fee += x.fee || 0;
    });
    return {
      soal: aktif.reduce((a, x) => a + (x.jumlah || 0), 0),
      fee: aktif.reduce((a, x) => a + (x.fee || 0), 0),
      bulan: Object.keys(perBulan).length,
      berjalan: aktif.filter((x) => !SELESAI.test(x.status || "")).reduce((a, x) => a + (x.jumlah || 0), 0),
      status: Object.entries(st).sort((a, b) => b[1] - a[1]),
      perBulan,
    };
  }, [data]);

  const g = data?.guru;
  const bank = g ? bankDanRekening(g.rekening) : {};
  const tunda = (data?.perubahan || []).filter((p) => p.status === "Menunggu");

  const aksi = async (p, setuju) => {
    setSibuk(p.row);
    try {
      await putuskan(p.row, setuju);
      await muat();
      await onChanged?.();
    } catch (e) {
      setGalat(e.message);
    } finally {
      setSibuk(0);
    }
  };

  return (
    <Drawer wide title={g ? g.nama : "Profil guru"} sub={g ? `ID ${g.idGuru} · ${g.status || "status form kosong"}` : "Memuat…"} onClose={onClose}>
      {galat ? (
        <div className="banner err">
          <Icon name="alert" />
          <div>{galat}</div>
        </div>
      ) : null}
      {!data && !galat ? <div className="card empty">Memuat profil…</div> : null}
      {g ? (
        <>
          <div className="pg-kontak">
            {g.wa ? (
              <a className="btn btn-wa sm" href={tautanWa(g.wa)} target="_blank" rel="noopener noreferrer">
                <Icon name="send" /> WhatsApp
              </a>
            ) : null}
            {g.email ? (
              <a className="btn btn-ghost sm" href={"mailto:" + g.email}>
                {g.email}
              </a>
            ) : (
              <span className="pill rev">email belum ada</span>
            )}
            <span className={"pill " + (data.akun?.status === "Aktif" ? (data.akun.wajibGanti ? "qc" : "appr") : "batal plain")}>
              {data.akun ? (data.akun.status === "Aktif" ? (data.akun.wajibGanti ? "akun: belum ganti password" : "akun aktif") : "akun nonaktif") : "belum punya akun"}
            </span>
          </div>

          {tunda.length ? (
            <div className="pg-ajuan">
              <b>
                <Icon name="alert" size={14} /> {numberID(tunda.length)} perubahan data menunggu persetujuan
              </b>
              {tunda.map((p) => (
                <div key={p.row} className="pg-ajuan-item">
                  <div>
                    <span>{p.label}</span>
                    <div>
                      <s>{p.lama || "(kosong)"}</s> → <b>{p.baru}</b>
                    </div>
                    <small>diajukan {p.waktu}</small>
                  </div>
                  <div className="rowmenu">
                    <button type="button" className="btn btn-ghost xs" disabled={Boolean(sibuk)} onClick={() => aksi(p, false)}>
                      Tolak
                    </button>
                    <button type="button" className="btn btn-blue xs" disabled={Boolean(sibuk)} onClick={() => aksi(p, true)}>
                      {sibuk === p.row ? "…" : "Setujui"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="pg-angka">
            <div>
              <b>{numberID(r.soal)}</b>
              <span>soal dikerjakan</span>
            </div>
            <div>
              <b>{rupiah(r.fee)}</b>
              <span>total fee</span>
            </div>
            <div>
              <b>{numberID(r.bulan)}</b>
              <span>bulan aktif</span>
            </div>
            <div className={g.kapasitas && r.berjalan > g.kapasitas * 10 ? "padat" : ""}>
              <b>{numberID(r.berjalan)}</b>
              <span>soal sedang berjalan{g.kapasitas ? ` · kapasitas ${numberID(g.kapasitas)}/minggu` : ""}</span>
            </div>
          </div>
          {r.status.length ? (
            <div className="pg-status">
              {r.status.map(([s, n]) => (
                <span key={s}>
                  {pillStatus(s)} <b>{numberID(n)}</b>
                </span>
              ))}
            </div>
          ) : null}

          <section className="pg-sec">
            <h3>Riwayat proyek</h3>
            {data.riwayat.length === 0 ? (
              <p className="muted">
                Belum ada baris log yang tercatat atas nama guru ini. (Log yang ditulis dengan nama berbeda dari Database guru tidak ikut terbaca.)
              </p>
            ) : (
              <>
                <div className="pg-bulan">
                  {Object.entries(r.perBulan).map(([b, v]) => (
                    <span key={b}>
                      <b>{b}</b> {numberID(v.soal)} soal · {rupiah(v.fee)}
                    </span>
                  ))}
                </div>
                <div className="table-wrap fixed">
                  <table className="grid-table">
                    <colgroup>
                      {[14, 12, 34, 10, 16, 14].map((w, i) => (
                        <col key={i} style={{ width: w + "%" }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Bulan</th>
                        <th>Proyek</th>
                        <th>Subtes</th>
                        <th className="num">Jml</th>
                        <th>Status</th>
                        <th className="num">Fee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(semuaRiwayat ? data.riwayat : data.riwayat.slice(0, 12)).map((x, i) => (
                        <tr key={i} className={BATAL.test(x.status || "") ? "row-dim" : ""}>
                          <td data-l="Bulan">{x.bulan}</td>
                          <td className="mono" data-l="Proyek">
                            {x.kode || "—"}
                          </td>
                          <td className="wrap c-title">{x.subtes || "—"}</td>
                          <td className="num" data-l="Jumlah">
                            {numberID(x.jumlah)}
                          </td>
                          <td data-l="Status">{pillStatus(x.status)}</td>
                          <td className="num" data-l="Fee">
                            {rupiah(x.fee)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.riwayat.length > 12 ? (
                  <button type="button" className="btn-link" onClick={() => setSemuaRiwayat((v) => !v)}>
                    {semuaRiwayat ? "Ringkas" : `Tampilkan semua ${numberID(data.riwayat.length)} baris`}
                  </button>
                ) : null}
              </>
            )}
          </section>

          <section className="pg-sec">
            <h3>Data dari form pendataan</h3>
            <div className="pg-grid">
              <Baris label="Pendidikan">{[g.pendidikan, g.jurusan].filter(Boolean).join(" · ")}</Baris>
              <Baris label="Universitas">{g.universitas}</Baris>
              <Baris label="Pekerjaan">{g.pekerjaan}</Baris>
              <Baris label="Kapasitas / minggu">{g.kapasitas ? numberID(g.kapasitas) : ""}</Baris>
              <Baris label="Bidang">{g.bidang}</Baris>
              <Baris label="Proyek diminati">{g.jenisProyek}</Baris>
              <Baris label="Live class">{[g.liveclass, g.jadwalLive].filter(Boolean).join(" · ")}</Baris>
              <Baris label="Catatan">{g.catatan}</Baris>
            </div>
          </section>

          <section className="pg-sec">
            <h3>Pembayaran & identitas</h3>
            <div className="pg-grid">
              <Baris label="Rekening">{bank.nomor ? `${bank.bank || "bank tidak dikenali"} · ${bank.nomor}` : <span className="neg">belum ada</span>}</Baris>
              <Baris label="Atas nama">{g.pemilikRekening}</Baris>
              <Baris label="NPWP">{g.npwp}</Baris>
              <Baris label="NIK">
                {g.nik ? (
                  <>
                    <span className="mono">{lihatNik ? g.nik : samarkan(g.nik)}</span>{" "}
                    <button type="button" className="btn-link" onClick={() => setLihatNik((v) => !v)}>
                      {lihatNik ? "sembunyikan" : "tampilkan"}
                    </button>
                  </>
                ) : null}
              </Baris>
              <Baris label="Berkas">
                <div className="berkas">
                  {[
                    ...tautan(g.fotoKtp).map((u) => ["KTP", u]),
                    ...tautan(g.cv).map((u) => ["CV", u]),
                    ...tautan(g.portofolio).map((u) => ["Portofolio", u]),
                  ].map(([l, u], i) => (
                    <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="mini brand">
                      {l} <Icon name="external" size={11} />
                    </a>
                  ))}
                </div>
              </Baris>
            </div>
          </section>

          {data.seleksi ? (
            <section className="pg-sec">
              <h3>Seleksi & QC sampel</h3>
              {data.seleksi.skor?.bidang ? (
                <p className="muted">
                  Rubrik tinjauan: bidang {data.seleksi.skor.bidang}/5 · pengalaman {data.seleksi.skor.pengalaman || "–"}/5 · berkas {data.seleksi.skor.berkas || "–"}/5
                  {data.seleksi.catatan ? ` — ${data.seleksi.catatan}` : ""}
                </p>
              ) : null}
              {(data.seleksi.qc || []).map((q) => (
                <div key={q.sesi} className="qc-sesi">
                  <b>Sesi {q.sesi}</b> <span className={"pill " + (q.hasil === "Lolos" ? "appr" : q.hasil === "Tidak lolos" ? "rev" : "qc")}>{q.hasil}</span> <span className="muted">{[q.waktu, q.pic, q.subtes].filter(Boolean).join(" · ")}</span>
                  {q.catatan ? <div className="xs2">{q.catatan}</div> : null}
                </div>
              ))}
            </section>
          ) : null}

          {(data.perubahan || []).some((p) => p.status !== "Menunggu") ? (
            <section className="pg-sec">
              <h3>Riwayat perubahan data</h3>
              {data.perubahan
                .filter((p) => p.status !== "Menunggu")
                .slice(0, 8)
                .map((p) => (
                  <div key={p.row} className="xs2 pg-riwayat-ubah">
                    {p.waktu} · {p.label}: {p.lama || "(kosong)"} → {p.baru} · <b>{p.status}</b>
                  </div>
                ))}
            </section>
          ) : null}
        </>
      ) : null}
    </Drawer>
  );
}
