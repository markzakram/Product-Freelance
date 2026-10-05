"use client";

// ============================================================================
//  Panel "Cari guru" untuk satu proyek katalog: guru yang bidangnya cocok,
//  berminat pada jenis proyeknya, dan tidak sedang kebanjiran pekerjaan —
//  lengkap dengan tombol "Tawarkan via WA". Logika pencocokan: lib/cocokGuru.js.
//  Setiap tawaran tercatat di tab Reachout (lib/kontakWa.js), jadi tanda
//  "ditawari" sama di semua perangkat admin dan masuk Pantau reachout.
// ============================================================================

import { useMemo, useState } from "react";
import { rupiah, numberID } from "@/lib/format";
import { tautanWa } from "@/lib/tautan";
import { BIDANG, JADWAL, bidangProyek, kandidatGuru, minatDibutuhkan, labelMinat, pesanTawaran } from "@/lib/cocokGuru";
import { TAWARAN, MENUNGGU, kelasHasil, kelompokkan, kunciTawaran, sejak } from "@/lib/reachoutOpsi";
import { catatWa } from "@/lib/kontakWa";
import Drawer from "./Drawer";
import Icon from "./Icon";

const low = (s) => String(s ?? "").toLowerCase();
const LABEL_PENDEK = Object.fromEntries(BIDANG.map((b) => [b.k, b.label.replace(/\s*\(.*\)$/, "")]));

// `wajibLogin`: label "belum punya akun" hanya berarti bila halaman proyek sudah dikunci.
// `bulan` = tab bulan katalog; `kontak` = catatan Reachout (untuk tanda "ditawari").
// `penanda`: { idGuru: { liveclass } } — guru yang sudah dipastikan tim bisa live class.
export default function CariGuru({ proyek: p, bulan, kontak = [], penanda = {}, master, guru, log, riwayat, akun, wajibLogin, onClose }) {
  const m = master.find((x) => x.id === p.idSubtes);
  const tebakan = useMemo(() => bidangProyek(p, m), [p, m]);
  const perlu = minatDibutuhkan(p, m);
  const live = perlu === "live";

  const [bidang, setBidang] = useState(() => new Set(tebakan));
  const [tanpaBidang, setTanpaBidang] = useState(false);
  const [hanyaMinat, setHanyaMinat] = useState(true);
  const [hanyaTanda, setHanyaTanda] = useState(false); // proyek live: hanya yang ditandai bisa liveclass
  const [sembunyiSudah, setSembunyiSudah] = useState(false);
  const [jadwal, setJadwal] = useState(() => new Set());
  const [q, setQ] = useState("");

  // Tawaran proyek ini yang sudah tercatat: kunci pasangan -> { kontak, hasil, terakhir }
  const ditawari = useMemo(
    () => new Map(kelompokkan(kontak.filter((k) => k.tujuan === TAWARAN && k.bulan === bulan && k.idProyek === p.id)).map((x) => [x.key, x])),
    [kontak, bulan, p.id]
  );

  const akunMap = useMemo(() => new Map((akun || []).map((a) => [low(a.email), a])), [akun]);
  const semua = useMemo(
    () =>
      kandidatGuru({ proyek: p, master: m, guru, log, riwayat, akun: akunMap }).map((x) => {
        const tanda = Boolean(penanda?.[x.g.idGuru]?.liveclass);
        // proyek live: penanda tim lebih dipercaya daripada jawaban form -> naik ke atas
        return live && tanda ? { ...x, tandaLive: true, minatSesuai: true, skor: x.skor + 3 } : { ...x, tandaLive: tanda };
      }),
    [p, m, guru, log, riwayat, akunMap, penanda, live]
  );
  const nTanda = semua.filter((x) => x.tandaLive).length;

  const jumlahBidang = useMemo(() => {
    const c = {};
    semua.forEach((x) => x.bidang.forEach((b) => (c[b] = (c[b] || 0) + 1)));
    return c;
  }, [semua]);
  const nTanpaBidang = semua.filter((x) => x.tanpaBidang).length;

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const daftar = semua
    .filter((x) => {
      if (bidang.size) {
        const kena = x.bidang.some((b) => bidang.has(b));
        if (!kena && !(tanpaBidang && x.tanpaBidang)) return false;
      }
      if (hanyaMinat && !x.minatSesuai && !x.tanpaBidang) return false;
      if (sembunyiSudah && x.sudahAmbil) return false;
      if (live && hanyaTanda && !x.tandaLive) return false;
      if (live && jadwal.size && !x.jadwal.some((j) => jadwal.has(j) || j === "fleksibel")) return false;
      if (words.length && !words.every((w) => low(`${x.g.nama} ${x.g.email} ${x.g.idGuru}`).includes(w))) return false;
      return true;
    })
    .sort((a, b) => b.skor - a.skor || a.beban - b.beban || a.g.nama.localeCompare(b.g.nama));

  const ubahSet = (set, setter, k) => {
    const n = new Set(set);
    n.has(k) ? n.delete(k) : n.add(k);
    setter(n);
  };
  const asal = typeof window !== "undefined" ? window.location.origin : "";
  const kunci = (x) => x.g.idGuru || x.g.nama;
  const tawaranKe = (x) => ditawari.get(kunciTawaran(bulan, p.id, x.g));
  const nDitawari = daftar.filter(tawaranKe).length;

  return (
    <Drawer
      wide
      title={`Cari guru — ${p.subtes}`}
      sub={`${p.id} · ${p.output || "—"} · ${rupiah(p.harga)}/soal · sisa ${numberID(p.sisa)} soal`}
      onClose={onClose}
      foot={
        <>
          <small className="muted">
            {numberID(daftar.length)} guru ditampilkan{nDitawari ? ` · ${numberID(nDitawari)} sudah ditawari` : ""}. Setiap tawaran tercatat di Pantau
            reachout.
          </small>
          <div className="drawer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Tutup
            </button>
          </div>
        </>
      }
    >
      <div className={"banner " + (tebakan.length ? "info" : "sample")}>
        <Icon name="info" />
        <div>
          {tebakan.length ? (
            <>
              Bidang ditebak dari nama subtes: <b>{tebakan.map((k) => LABEL_PENDEK[k]).join(", ")}</b>. Proyek ini butuh guru yang mau{" "}
              <b>{labelMinat(perlu)}</b>.
            </>
          ) : (
            <>
              Bidang tidak terdeteksi dari nama subtes — pilih bidangnya di bawah. Proyek ini butuh guru yang mau <b>{labelMinat(perlu)}</b>.
            </>
          )}
        </div>
      </div>

      <div className="cg-saring">
        <span className="mpick-lbl">Bidang</span>
        <div className="chips geser">
          {BIDANG.filter((b) => jumlahBidang[b.k] || bidang.has(b.k)).map((b) => (
            <button key={b.k} type="button" className={"chip sm" + (bidang.has(b.k) ? " active" : "")} aria-pressed={bidang.has(b.k)} onClick={() => ubahSet(bidang, setBidang, b.k)}>
              {LABEL_PENDEK[b.k]} <span className="n">{numberID(jumlahBidang[b.k] || 0)}</span>
            </button>
          ))}
        </div>
      </div>
      {live ? (
        <div className="cg-saring">
          <span className="mpick-lbl">Jadwal</span>
          <div className="chips geser">
            {JADWAL.filter((j) => j.k !== "fleksibel").map((j) => (
              <button key={j.k} type="button" className={"chip sm" + (jadwal.has(j.k) ? " active" : "")} aria-pressed={jadwal.has(j.k)} onClick={() => ubahSet(jadwal, setJadwal, j.k)}>
                {j.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="cg-opsi">
        <label className="mpick-arsip">
          <input type="checkbox" checked={hanyaMinat} onChange={(e) => setHanyaMinat(e.target.checked)} />
          Hanya yang berminat
        </label>
        <label className="mpick-arsip">
          <input type="checkbox" checked={sembunyiSudah} onChange={(e) => setSembunyiSudah(e.target.checked)} />
          Sembunyikan yang sudah ambil proyek ini
        </label>
        {live ? (
          <label className="mpick-arsip">
            <input type="checkbox" checked={hanyaTanda} onChange={(e) => setHanyaTanda(e.target.checked)} />
            Hanya yang sudah ditandai bisa liveclass <span className="muted">({numberID(nTanda)})</span>
          </label>
        ) : null}
        {bidang.size && nTanpaBidang ? (
          <label className="mpick-arsip">
            <input type="checkbox" checked={tanpaBidang} onChange={(e) => setTanpaBidang(e.target.checked)} />
            Sertakan guru tanpa data bidang <span className="muted">({numberID(nTanpaBidang)})</span>
          </label>
        ) : null}
      </div>
      <label className="search sm">
        <Icon name="search" />
        <input type="search" placeholder="Cari nama, email, ID" aria-label="Cari guru" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      {daftar.length === 0 ? (
        <div className="card empty">Tidak ada guru yang cocok. Coba tambah bidang atau matikan "Hanya yang berminat".</div>
      ) : (
        <div className="cg-list">
          {daftar.map((x) => {
            const k = kunci(x);
            const tw = tawaranKe(x);
            const sudah = Boolean(tw);
            return (
              <article key={k} className={"cg-item" + (sudah ? " ditawari" : "")}>
                <div className="cg-atas">
                  <div className="cg-nama">
                    <b>{x.g.nama}</b>
                    <span>
                      ID {x.g.idGuru || "—"}
                      {x.kapasitas ? ` · kapasitas ${numberID(x.kapasitas)}/minggu` : ""}
                    </span>
                  </div>
                  {x.g.wa ? (
                    <a
                      className={"btn sm " + (sudah ? "btn-ghost" : "btn-wa")}
                      href={tautanWa(x.g.wa, pesanTawaran(x, p, asal))}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        catatWa({ tujuan: TAWARAN, bulan, idProyek: p.id, subtes: p.subtes, idGuru: x.g.idGuru, nama: x.g.nama, email: x.g.email, wa: x.g.wa })
                      }
                      title={sudah ? "Kirim lagi — tercatat sebagai kontak berikutnya" : undefined}
                    >
                      <Icon name={sudah ? "check" : "send"} />
                      {sudah ? `Ditawari ${tw.kontak.length > 1 ? tw.kontak.length + "×" : ""}`.trim() : "Tawarkan via WA"}
                    </a>
                  ) : (
                    <span className="muted xs2">WA belum ada</span>
                  )}
                </div>
                <div className="cg-lencana">
                  {x.tandaLive ? <span className="pill run">✓ bisa liveclass</span> : null}
                  {x.minatSesuai ? <span className="pill appr">berminat</span> : x.tanpaBidang ? <span className="pill batal plain">data form kosong</span> : <span className="pill batal plain">minat lain</span>}
                  {x.pernah ? <span className="pill run">pernah {numberID(x.pernah)} soal subtes ini</span> : null}
                  {x.sudahAmbil ? <span className="pill qc">sudah ambil {numberID(x.sudahAmbil)} soal</span> : null}
                  {x.baru ? <span className="pill qc">guru baru · perlu sampel</span> : null}
                  {wajibLogin && !x.punyaAkun ? <span className="pill rev">belum punya akun</span> : null}
                  {tw ? (
                    <span className={"pill " + kelasHasil(tw.hasil)}>
                      {(tw.hasil || MENUNGGU).toLowerCase()} · ditawari {sejak(tw.terakhir)}
                    </span>
                  ) : null}
                </div>
                <div className="cg-info">
                  <span>
                    <b>{numberID(x.beban)}</b> soal sedang berjalan
                  </span>
                  {x.bidang.length ? <span>{x.bidang.map((b) => LABEL_PENDEK[b]).join(" · ")}</span> : null}
                  {live ? (
                    <span>
                      Live class: {x.g.liveclass || "—"}
                      {x.g.jadwalLive ? ` · ${x.g.jadwalLive}` : ""}
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Drawer>
  );
}
