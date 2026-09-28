"use client";

// ============================================================================
//  PROFIL SAYA (guru yang login): riwayat & fee sendiri, dan ubah data.
//  WA, rekening, pemilik rekening, NPWP -> menunggu persetujuan admin.
//  Kapasitas, live class, jadwal, bidang, minat -> langsung tersimpan.
// ============================================================================

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah, numberID } from "@/lib/format";
import { NAMA_BANK } from "@/lib/rekapFee";
import { BIDANG, JADWAL, MINAT_FORM, LIVE_FORM } from "@/lib/cocokGuru";
import Brand from "./Brand";
import Icon from "./Icon";
import ThemeToggle from "./ThemeToggle";

const BATAL = /cancel|batal/i;
const pill = (s) => {
  const t = String(s || "").toLowerCase();
  const c = BATAL.test(t) ? "batal" : /appro|paid/.test(t) ? "appr" : /revisi/.test(t) ? "rev" : /qc/.test(t) ? "qc" : "run";
  return <span className={"pill " + c}>{s || "—"}</span>;
};

function Centang({ daftar, nilai, onUbah, label }) {
  return (
    <div className="ffield">
      <span>{label}</span>
      <div className="ps-centang">
        {daftar.map((o) => {
          const on = nilai.includes(o);
          return (
            <button key={o} type="button" className={"chip" + (on ? " active" : "")} aria-pressed={on} onClick={() => onUbah(on ? nilai.filter((x) => x !== o) : [...nilai, o])}>
              {on ? <Icon name="check" size={13} stroke={2.4} /> : null}
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ProfilSaya({ guru, isian: awal, riwayat = [], ajuan = [], kosong = false }) {
  const router = useRouter();
  const [isian, setIsian] = useState(awal || {});
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState(null); // { jenis, teks }
  const set = (k) => (v) => setIsian((s) => ({ ...s, [k]: v }));
  const tunda = Object.fromEntries(ajuan.map((a) => [a.kolom, a]));

  const ringkas = useMemo(() => {
    const aktif = riwayat.filter((r) => !BATAL.test(r.status || ""));
    const perBulan = [];
    aktif.forEach((r) => {
      let b = perBulan.find((x) => x.bulan === r.bulan);
      if (!b) perBulan.push((b = { bulan: r.bulan, soal: 0, fee: 0, baris: [] }));
      b.soal += r.jumlah || 0;
      b.fee += r.fee || 0;
    });
    riwayat.forEach((r) => {
      let b = perBulan.find((x) => x.bulan === r.bulan);
      if (!b) perBulan.push((b = { bulan: r.bulan, soal: 0, fee: 0, baris: [] }));
      b.baris.push(r);
    });
    return { perBulan, totalFee: aktif.reduce((a, r) => a + (r.fee || 0), 0), totalSoal: aktif.reduce((a, r) => a + (r.jumlah || 0), 0) };
  }, [riwayat]);
  const terbaru = ringkas.perBulan[0];

  const simpan = async (e) => {
    e.preventDefault();
    setSibuk(true);
    setPesan(null);
    try {
      const res = await fetch("/api/guru/profil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isian }),
        cache: "no-store",
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) return router.push("/open/masuk?error=sesi");
      if (!res.ok) throw new Error(j.error || "Gagal menyimpan.");
      const bagian = [];
      if (j.langsung?.length) bagian.push("Preferensi kerja tersimpan.");
      if (j.menunggu?.length) bagian.push("Perubahan data pembayaran/kontak dikirim ke admin dan menunggu persetujuan.");
      setPesan({ jenis: "live", teks: bagian.join(" ") || "Tidak ada yang berubah." });
      router.refresh();
    } catch (err) {
      setPesan({ jenis: "err", teks: err.message });
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="pub">
      <header className="pub-head">
        <div className="in">
          <a href="/open" aria-label="Kembali ke proyek">
            <Brand size={30} row />
          </a>
          <div className="pub-actions">
            <ThemeToggle className="sq" />
            <a className="btn btn-ghost" href="/open">
              <Icon name="chevronLeft" />
              <span className="lbl">Proyek</span>
            </a>
          </div>
        </div>
      </header>

      <main className="pub-body ps">
        <div className="pub-title">
          <span className="pub-ico">
            <Icon name="userCheck" size={20} />
          </span>
          <div>
            <h1>Profil saya</h1>
            <p>
              {guru.nama}
              {guru.idGuru ? ` · ID ${guru.idGuru}` : ""} · {guru.email}
            </p>
          </div>
        </div>

        {kosong ? (
          <div className="banner sample">
            <Icon name="info" />
            <div>Data Anda belum tertaut ke Database guru. Hubungi admin supaya riwayat dan data pembayaran bisa ditampilkan.</div>
          </div>
        ) : (
          <>
            {/* ------------------------------------------------ riwayat & fee */}
            <div className="kpis">
              <div className="kpi">
                <span className="kpi-ico i3">
                  <Icon name="wallet" size={18} />
                </span>
                <b>{rupiah(terbaru?.fee || 0)}</b>
                <span>fee {terbaru?.bulan || "bulan ini"}</span>
              </div>
              <div className="kpi">
                <span className="kpi-ico i1">
                  <Icon name="layers" size={18} />
                </span>
                <b>{numberID(terbaru?.soal || 0)}</b>
                <span>soal {terbaru?.bulan || "bulan ini"}</span>
              </div>
              <div className="kpi">
                <span className="kpi-ico i2">
                  <Icon name="check" size={18} stroke={2.2} />
                </span>
                <b>{rupiah(ringkas.totalFee)}</b>
                <span>
                  total fee · {numberID(ringkas.totalSoal)} soal di {numberID(ringkas.perBulan.length)} bulan
                </span>
              </div>
            </div>

            <section className="ps-kartu">
              <h2>Riwayat & fee saya</h2>
              {ringkas.perBulan.length === 0 ? (
                <p className="muted">Belum ada pekerjaan yang tercatat atas nama Anda.</p>
              ) : (
                ringkas.perBulan.map((b) => (
                  <div key={b.bulan} className="ps-bulan">
                    <div className="ps-bulan-kepala">
                      <b>{b.bulan}</b>
                      <span>
                        {numberID(b.soal)} soal · {rupiah(b.fee)}
                      </span>
                    </div>
                    {b.baris.map((r, i) => (
                      <div key={i} className={"ps-baris" + (BATAL.test(r.status || "") ? " batal" : "")}>
                        <div>
                          <b>{r.subtes || r.kode}</b>
                          <small>
                            {r.kode} · {numberID(r.jumlah)} soal
                          </small>
                        </div>
                        {pill(r.status)}
                        <span className="ps-fee">{rupiah(r.fee)}</span>
                      </div>
                    ))}
                  </div>
                ))
              )}
              <small className="muted">Fee mengikuti catatan admin; status "Cancel" tidak dibayar.</small>
            </section>

            {/* ------------------------------------------------------ ubah data */}
            <form onSubmit={simpan} className="ps-form">
              <section className="ps-kartu">
                <h2>Data pembayaran & kontak</h2>
                <p className="muted">Perubahan di bagian ini diperiksa admin dulu sebelum berlaku — supaya rekening pembayaran Anda aman.</p>
                <div className="form-grid">
                  <label className="ffield">
                    <span>Nomor WhatsApp</span>
                    <input className="input" inputMode="tel" value={isian.wa || ""} onChange={(e) => set("wa")(e.target.value)} placeholder="08…" />
                    {tunda.wa ? <small className="warn-text">Menunggu persetujuan: {tunda.wa.baru}</small> : null}
                  </label>
                  <label className="ffield">
                    <span>NPWP (bila ada)</span>
                    <input className="input" value={isian.npwp || ""} onChange={(e) => set("npwp")(e.target.value)} />
                    {tunda.npwp ? <small className="warn-text">Menunggu persetujuan: {tunda.npwp.baru}</small> : null}
                  </label>
                  <label className="ffield">
                    <span>Bank</span>
                    <select className="select" value={isian.rekening?.bank || "BSI"} onChange={(e) => set("rekening")({ ...isian.rekening, bank: e.target.value })}>
                      {NAMA_BANK.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ffield">
                    <span>Nomor rekening</span>
                    <input className="input" inputMode="numeric" value={isian.rekening?.nomor || ""} onChange={(e) => set("rekening")({ ...isian.rekening, nomor: e.target.value })} />
                    {tunda.rekening ? <small className="warn-text">Menunggu persetujuan: {tunda.rekening.baru}</small> : null}
                  </label>
                  <label className="ffield wide">
                    <span>Nama pemilik rekening</span>
                    <input className="input" value={isian.pemilikRekening || ""} onChange={(e) => set("pemilikRekening")(e.target.value)} />
                    {tunda.pemilikRekening ? <small className="warn-text">Menunggu persetujuan: {tunda.pemilikRekening.baru}</small> : null}
                  </label>
                </div>
              </section>

              <section className="ps-kartu">
                <h2>Preferensi kerja</h2>
                <p className="muted">Langsung tersimpan — dipakai admin saat menawarkan proyek yang sesuai.</p>
                <Centang label="Bidang yang dikuasai" daftar={BIDANG.map((b) => b.form)} nilai={isian.bidang || []} onUbah={set("bidang")} />
                <Centang label="Jenis proyek yang diminati" daftar={MINAT_FORM} nilai={isian.jenisProyek || []} onUbah={set("jenisProyek")} />
                <div className="form-grid">
                  <label className="ffield">
                    <span>Kapasitas per minggu</span>
                    <input className="input" type="number" min={0} max={500} inputMode="numeric" value={isian.kapasitas || ""} onChange={(e) => set("kapasitas")(e.target.value)} />
                  </label>
                  <div className="ffield">
                    <span>Bersedia mengisi live class?</span>
                    <div className="seg" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
                      {LIVE_FORM.map((o) => (
                        <button key={o} type="button" className={"seg-btn" + (isian.liveclass === o ? " on" : "")} onClick={() => set("liveclass")(o)}>
                          <b>{o}</b>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {isian.liveclass && isian.liveclass !== "Tidak" ? (
                  <Centang label="Jadwal live class" daftar={JADWAL.map((j) => j.form)} nilai={isian.jadwalLive || []} onUbah={set("jadwalLive")} />
                ) : null}
              </section>

              {pesan ? (
                <div className={"banner " + pesan.jenis} role="status">
                  <Icon name={pesan.jenis === "err" ? "alert" : "check"} />
                  <div>{pesan.teks}</div>
                </div>
              ) : null}
              <button type="submit" className="btn btn-blue block ps-simpan" disabled={sibuk}>
                {sibuk ? "Menyimpan…" : "Simpan perubahan"}
              </button>
            </form>

            <div className="auth-links">
              <a href="/open/ganti-password">Ganti password</a>
              <form method="POST" action="/api/guru/keluar">
                <button type="submit" className="btn-link">
                  Keluar
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
