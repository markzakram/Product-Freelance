"use client";

// ============================================================================
//  Tahap seleksi pendaftar — dua panel samping:
//   TinjauDrawer : baca jawaban form + berkas, isi rubrik 1–5, lalu putuskan
//                  (lanjut ke sampel / verifikasi langsung / tolak).
//   QcDrawer     : catat SATU sesi QC sampel (checklist 8 aspek Panduan
//                  Proyek, hasil, PIC, catatan). Sampel boleh berkali-kali
//                  direvisi — tiap revisi = sesi baru.
// ============================================================================

import { useMemo, useState } from "react";
import { numberID } from "@/lib/format";
import { tautanWa } from "@/lib/tautan";
import { RUBRIK, CHECKLIST, HASIL_QC } from "@/lib/seleksiOpsi";
import Drawer from "./Drawer";
import Combobox from "./Combobox";
import Icon from "./Icon";

const perluSampel = (p) => p.perluSampel ?? !/lama/i.test(p.statusForm || "");

export const kelasTahap = (s) =>
  ({ "Punya akses": "appr", "Lolos sampel": "appr", "Siap akses": "run", Sampel: "run", Tinjau: "qc", Menunggu: "qc", Ditolak: "batal plain" })[s] || "qc";
export const kelasHasil = (h) => (h === "Lolos" ? "appr" : h === "Tidak lolos" ? "rev" : "qc");

export function pesanMintaSampel(p) {
  return (
    `Halo ${p.nama || ""}, terima kasih sudah mendaftar sebagai guru freelance Cerebrum.\n\n` +
    "Sebagai tahap berikutnya, mohon buat *sampel soal* sesuai arahan dari tim (materi, jumlah, dan template akan kami kirimkan). " +
    "Kirim hasilnya berupa tautan Google Drive ke nomor ini ya.\n\nTerima kasih!"
  );
}

export function pesanHasilQc(p, q) {
  const kurang = CHECKLIST.filter((k) => q.checklist?.[k] === false);
  return (
    `Halo ${p.nama || ""}, berikut hasil QC sampel Anda (sesi ${q.sesi}): *${q.hasil}*.\n` +
    (kurang.length ? `\nPerlu diperbaiki: ${kurang.join(", ")}.\n` : "") +
    (q.catatan ? `\nCatatan: ${q.catatan}\n` : "") +
    (q.hasil === "Lolos"
      ? "\nSelamat, sampel Anda lolos. Admin akan segera mengirim akun untuk mulai mengambil proyek."
      : q.hasil === "Perlu revisi"
        ? "\nMohon kirim revisinya ya, nanti kami QC lagi."
        : "\nTerima kasih atas waktu dan usaha Anda.")
  );
}

function Skor({ nilai, onPilih, label }) {
  return (
    <div className="rubrik">
      <span>{label}</span>
      <div className="rubrik-n" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={nilai === n ? "on" : ""} aria-pressed={nilai === n} onClick={() => onPilih(nilai === n ? 0 : n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function Isian({ label, children }) {
  return children ? (
    <div className="pg-baris">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  ) : null;
}

/* ------------------------------------------------------------ tinjau berkas */
export function TinjauDrawer({ p, busy, onClose, onSimpan }) {
  const [skor, setSkor] = useState(() => ({ bidang: 0, pengalaman: 0, berkas: 0, ...(p.seleksi?.skor || {}) }));
  const [catatan, setCatatan] = useState(p.seleksi?.catatan || "");
  const wajib = perluSampel(p);
  const simpan = (keputusan) => onSimpan({ skor, catatan, keputusan });

  return (
    <Drawer
      wide
      title={`Tinjau — ${p.nama || p.email}`}
      sub={`${p.statusForm || "Status form kosong"} · daftar ${p.waktu || "—"}`}
      onClose={onClose}
      busy={busy}
      foot={
        <>
          <small className="muted">
            Verifikasi 1 memasukkan pendaftar ke Data guru. Akses ke halaman proyek diberikan terpisah di verifikasi 2
            {wajib ? " — setelah sampelnya lolos QC (guru baru wajib sampel, Panduan Proyek)." : " (guru lama, tanpa sampel)."}
          </small>
          <div className="drawer-actions tinjau-aksi">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => simpan("tolak")}>
              Tolak
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => simpan("simpan")}>
              Simpan catatan
            </button>
            <button type="button" className="btn btn-blue" disabled={busy} onClick={() => simpan("verifikasi1")}>
              Verifikasi 1 · Masukkan ke Data guru
            </button>
          </div>
        </>
      }
    >
      <div className="pg-grid">
        <Isian label="Kontak">{[p.email, p.wa].filter(Boolean).join(" · ")}</Isian>
        <Isian label="Pendidikan">{[p.pendidikan, p.jurusan, p.universitas].filter(Boolean).join(" · ")}</Isian>
        <Isian label="Pekerjaan">{[p.pekerjaan, p.instansi].filter(Boolean).join(" · ")}</Isian>
        <Isian label="Pengalaman">{p.pengalaman}</Isian>
        <Isian label="Bidang">{p.bidang}</Isian>
        <Isian label="Proyek diminati">{p.jenisProyek}</Isian>
        <Isian label="Live class">{[p.live, p.jadwal].filter(Boolean).join(" · ")}</Isian>
        <Isian label="Kapasitas / minggu">{p.kapasitas}</Isian>
        <Isian label="Kesiapan teknis">{p.teknis}</Isian>
        <Isian label="Catatan pendaftar">{p.catatanForm}</Isian>
      </div>
      <div className="berkas">
        {p.berkas.length ? (
          p.berkas.map((b, i) => (
            <a key={i} href={b.u} target="_blank" rel="noopener noreferrer" className="mini brand">
              Buka {b.label} <Icon name="external" size={11} />
            </a>
          ))
        ) : (
          <span className="pill rev">tanpa berkas</span>
        )}
      </div>

      <div className="rubrik-kotak">
        <b>Rubrik tinjauan (1 = kurang, 5 = sangat baik)</b>
        {RUBRIK.map((r) => (
          <Skor key={r.k} label={r.label} nilai={skor[r.k] || 0} onPilih={(n) => setSkor((s) => ({ ...s, [r.k]: n }))} />
        ))}
        <label className="ffield">
          <span>Catatan tinjauan</span>
          <textarea className="input" rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. pengalaman mengajar TPA 3 tahun, CV rapi" />
        </label>
      </div>
    </Drawer>
  );
}

/* ------------------------------------------------------------ QC satu sesi */
export function QcDrawer({ p, picList, busy, onClose, onSimpan }) {
  const sesi = (p.seleksi?.qc || []).reduce((m, q) => Math.max(m, q.sesi), 0) + 1;
  const terakhir = (p.seleksi?.qc || []).slice(-1)[0];
  const [subtes, setSubtes] = useState(terakhir?.subtes || "");
  const [tautan, setTautan] = useState("");
  const [pic, setPic] = useState(terakhir?.pic || "");
  const [cek, setCek] = useState({});
  const [hasil, setHasil] = useState("");
  const [hasilManual, setHasilManual] = useState(false);
  const [catatan, setCatatan] = useState("");
  const opsiPic = useMemo(() => (picList || []).map((x) => ({ value: x, label: x })), [picList]);

  const nilai = CHECKLIST.filter((k) => k in cek);
  // saran hasil dari checklist, selama admin belum memilih sendiri
  const saran = nilai.length === CHECKLIST.length ? (CHECKLIST.every((k) => cek[k]) ? "Lolos" : "Perlu revisi") : nilai.some((k) => !cek[k]) ? "Perlu revisi" : "";
  const hasilDipakai = hasilManual ? hasil : saran;
  const setCekItem = (k, v) => setCek((c) => ({ ...c, [k]: v }));

  return (
    <Drawer
      wide
      title={`QC sampel sesi ${sesi} — ${p.nama || p.email}`}
      sub={sesi > 1 ? `Sesi sebelumnya: ${terakhir.hasil}${terakhir.pic ? " · " + terakhir.pic : ""}` : "Sesi pertama"}
      onClose={onClose}
      busy={busy}
      foot={
        <div className="drawer-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button
            type="button"
            className="btn btn-blue"
            disabled={busy || !hasilDipakai}
            onClick={() => onSimpan({ nama: p.nama, subtes, tautan, pic, checklist: cek, hasil: hasilDipakai, catatan })}
          >
            {busy ? "Menyimpan…" : `Simpan sesi ${sesi}`}
          </button>
        </div>
      }
    >
      {(p.seleksi?.qc || []).length ? (
        <div className="qc-riwayat">
          {p.seleksi.qc.map((q) => (
            <div key={q.sesi} className="qc-sesi">
              <b>Sesi {q.sesi}</b> <span className={"pill " + kelasHasil(q.hasil)}>{q.hasil}</span>{" "}
              <span className="muted">{[q.waktu, q.pic, q.subtes].filter(Boolean).join(" · ")}</span>
              {q.catatan ? <div className="xs2">{q.catatan}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="form-grid">
        <label className="ffield">
          <span>Subtes sampel</span>
          <input className="input" value={subtes} onChange={(e) => setSubtes(e.target.value)} placeholder="mis. Fisika" />
        </label>
        <div className="ffield">
          <label htmlFor="qc-pic">PIC QC</label>
          <Combobox id="qc-pic" value={pic} onChange={setPic} options={opsiPic} placeholder="mis. Uma" />
        </div>
        <label className="ffield wide">
          <span>Tautan sampel</span>
          <input className="input" type="url" inputMode="url" value={tautan} onChange={(e) => setTautan(e.target.value)} placeholder="https://drive.google.com/…" />
        </label>
      </div>

      <div className="qc-cek">
        <b>Checklist sampel</b>
        {CHECKLIST.map((k) => (
          <div key={k} className="qc-cek-baris">
            <span>{k}</span>
            <div className="qc-cek-pilih" role="group" aria-label={k}>
              <button type="button" className={cek[k] === true ? "on ya" : ""} aria-pressed={cek[k] === true} onClick={() => setCekItem(k, true)}>
                <Icon name="check" size={14} stroke={2.4} /> Sesuai
              </button>
              <button type="button" className={cek[k] === false ? "on tidak" : ""} aria-pressed={cek[k] === false} onClick={() => setCekItem(k, false)}>
                <Icon name="x" size={14} stroke={2.4} /> Perbaiki
              </button>
            </div>
          </div>
        ))}
        <small className="muted">
          {numberID(nilai.length)} dari {CHECKLIST.length} aspek sudah dinilai.
        </small>
      </div>

      <div className="ffield">
        <span>Hasil sesi ini</span>
        <div className="seg" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
          {HASIL_QC.map((h) => (
            <button
              key={h}
              type="button"
              className={"seg-btn" + (hasilDipakai === h ? " on" : "")}
              onClick={() => {
                setHasil(h);
                setHasilManual(true);
              }}
            >
              <b>{h}</b>
              <small>{h === "Lolos" ? "boleh diverifikasi" : h === "Perlu revisi" ? "tunggu sampel revisi" : "tidak dilanjutkan"}</small>
            </button>
          ))}
        </div>
        {!hasilManual && saran ? <small>Disarankan dari checklist — klik untuk mengubah.</small> : null}
      </div>
      <label className="ffield">
        <span>Catatan untuk pendaftar</span>
        <textarea className="input" rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. kunci jawaban nomor 3 keliru; pembahasan perlu langkah hitung" />
      </label>
    </Drawer>
  );
}

/** Tombol WA di kartu pendaftar sesuai tahapnya. */
export function TombolWaSeleksi({ p }) {
  if (!p.wa) return null;
  const qc = (p.seleksi?.qc || []).slice(-1)[0];
  if (p.status === "Sampel" && !qc)
    return (
      <a className="btn btn-ghost sm" href={tautanWa(p.wa, pesanMintaSampel(p))} target="_blank" rel="noopener noreferrer">
        <Icon name="send" /> Minta sampel
      </a>
    );
  if ((p.status === "Sampel" || p.status === "Lolos sampel") && qc)
    return (
      <a className="btn btn-ghost sm" href={tautanWa(p.wa, pesanHasilQc(p, qc))} target="_blank" rel="noopener noreferrer">
        <Icon name="send" /> Kirim hasil QC
      </a>
    );
  return null;
}
