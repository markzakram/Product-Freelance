"use client";

// ============================================================================
//  AKUN TIM — khusus Pemilik: tambah anggota tim seleksi / akademik, atur
//  perannya, reset password, nonaktifkan. Password sementara tampil sekali
//  untuk diserahkan ke orangnya; ia wajib menggantinya saat masuk pertama.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Drawer from "./Drawer";
import Icon from "./Icon";

const PERAN_UI = [
  ["Seleksi", "Pendaftar, kolam & seleksi, corong rekrutmen"],
  ["Akademik", "Master, katalog, log, pembayaran, pantauan proyek"],
  ["Pemilik", "Semua menu + kelola akun tim"],
];
const kelasPeran = { Pemilik: "run", Seleksi: "qc", Akademik: "appr" };

async function kirim(body) {
  const res = await fetch("/api/admin/tim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Gagal (HTTP ${res.status})`);
  return j;
}

function PilihPeran({ nilai, onUbah }) {
  const ubah = (p) => onUbah(nilai.includes(p) ? nilai.filter((x) => x !== p) : [...nilai, p]);
  return (
    <div className="tim-peran" role="group" aria-label="Peran">
      {PERAN_UI.map(([p, ket]) => (
        <label key={p} className={"tim-peran-opsi" + (nilai.includes(p) ? " on" : "")}>
          <input type="checkbox" checked={nilai.includes(p)} onChange={() => ubah(p)} />
          <span>
            <b>{p}</b>
            <small>{ket}</small>
          </span>
        </label>
      ))}
    </div>
  );
}

function pesanAkun(k) {
  const asal = typeof window !== "undefined" ? window.location.origin : "";
  return (
    `Akun dashboard Product Freelance (${k.peran.join(", ")})\n` +
    `Masuk: ${asal}/admin/login\nEmail: ${k.email}\nPassword sementara: ${k.password}\n\n` +
    "Setelah masuk, Anda diminta membuat password sendiri."
  );
}

export default function TimPanel({ aksiEl, setErr, emailSaya = "" }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tambah, setTambah] = useState(false);
  const [baru, setBaru] = useState({ nama: "", email: "", peran: ["Seleksi"] });
  const [galatForm, setGalatForm] = useState("");
  const [ubah, setUbah] = useState(null); // { email, nama, peran }
  const [kred, setKred] = useState(null); // { …akun, password, reset }
  const [disalin, setDisalin] = useState(false);

  const muat = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/tim", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
      setData(j);
    } catch (e) {
      setData({ anggota: [], error: e.message });
    }
  }, []);
  useEffect(() => {
    muat();
  }, [muat]);

  const jalankan = async (body, sesudah) => {
    setBusy(true);
    setErr("");
    try {
      const j = await kirim(body);
      await muat();
      sesudah?.(j);
      return true;
    } catch (e) {
      setErr(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const simpanBaru = async () => {
    setGalatForm("");
    if (!baru.nama.trim() || !baru.email.trim()) return setGalatForm("Isi nama dan email.");
    if (!baru.peran.length) return setGalatForm("Pilih minimal satu peran.");
    setBusy(true);
    try {
      const j = await kirim({ action: "buat", ...baru });
      await muat();
      setTambah(false);
      setBaru({ nama: "", email: "", peran: ["Seleksi"] });
      setDisalin(false);
      setKred({ ...j.akun, reset: false });
    } catch (e) {
      setGalatForm(e.message);
    } finally {
      setBusy(false);
    }
  };

  const kunci = busy || !data?.canWrite;
  const anggota = data?.anggota || [];

  return (
    <>
      {aksiEl
        ? createPortal(
            <button type="button" className="btn btn-blue fab" disabled={kunci} onClick={() => setTambah(true)}>
              <Icon name="plus" stroke={2.2} /> Tambah anggota
            </button>,
            aksiEl
          )
        : null}

      {data?.error ? (
        <div className="banner err">
          <Icon name="alert" />
          <div>Akun tim belum bisa dibaca: {data.error}</div>
        </div>
      ) : null}
      {data && !data.loginSiap ? (
        <div className="banner sample">
          <Icon name="alert" />
          <div>
            Login tim belum aktif di server: isi <b>GURU_SESSION_SECRET</b> (≥ 32 karakter) di Environment Variables Vercel. Sampai itu, hanya pemilik yang bisa
            masuk.
          </div>
        </div>
      ) : null}
      <div className="banner info">
        <Icon name="info" />
        <div>
          Tiap anggota masuk dengan email & password sendiri di halaman login dashboard, dan hanya melihat menu timnya. Keputusan seleksi dan kontak WA tercatat
          atas nama orangnya. Pemilik tetap bisa masuk dengan password internal (email dikosongkan).
        </div>
      </div>

      {!data ? (
        <div className="card empty">Memuat akun tim…</div>
      ) : !anggota.length ? (
        <div className="card empty">Belum ada anggota tim. Tekan “Tambah anggota” untuk membuat akun pertama.</div>
      ) : (
        <div className="table-wrap fixed">
          <table className="grid-table">
            <colgroup>
              {[17, 21, 17, 13, 12, 20].map((w, i) => (
                <col key={i} style={{ width: w + "%" }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Peran</th>
                <th>Status</th>
                <th>Login terakhir</th>
                <th className="act">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {anggota.map((a) => {
                const nonaktif = a.status === "Nonaktif";
                const saya = a.email === emailSaya;
                return (
                  <tr key={a.email} className={nonaktif ? "row-dim" : ""}>
                    <td className="wrap c-title">
                      <b>{a.nama}</b>
                      {saya ? <small className="ksd-sub">akun Anda</small> : null}
                    </td>
                    <td className="wrap" data-l="Email">
                      {a.email}
                    </td>
                    <td data-l="Peran">
                      <div className="tim-pill">
                        {a.peran.map((p) => (
                          <span key={p} className={"pill " + kelasPeran[p]}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td data-l="Status">
                      <span className={"pill " + (nonaktif ? "batal" : a.terkunci ? "rev" : a.wajibGanti ? "qc" : "appr")}>
                        {nonaktif ? "Nonaktif" : a.terkunci ? "Terkunci" : a.wajibGanti ? "Sandi sementara" : "Aktif"}
                      </span>
                    </td>
                    <td className="xs2" data-l="Login terakhir">
                      {a.loginTerakhir || "—"}
                    </td>
                    <td className="act">
                      <div className="rowmenu">
                        <button type="button" className="btn btn-ghost xs" disabled={kunci} onClick={() => setUbah({ email: a.email, nama: a.nama, peran: a.peran })} title="Ubah peran">
                          Peran
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost xs"
                          disabled={kunci}
                          onClick={() =>
                            window.confirm(`Reset password ${a.nama}? Password lamanya langsung tidak berlaku.`) &&
                            jalankan({ action: "reset", email: a.email }, (j) => {
                              setDisalin(false);
                              setKred({ ...j.akun, reset: true });
                            })
                          }
                          title="Reset password"
                        >
                          Reset
                        </button>
                        {nonaktif ? (
                          <button type="button" className="btn btn-ghost xs" disabled={kunci} onClick={() => jalankan({ action: "atur", email: a.email, status: "Aktif" })}>
                            Aktifkan
                          </button>
                        ) : !saya ? (
                          <button
                            type="button"
                            className="ibtn danger"
                            disabled={kunci}
                            aria-label={`Nonaktifkan akun ${a.nama}`}
                            title="Nonaktifkan akun"
                            onClick={() => window.confirm(`Nonaktifkan akun ${a.nama}? Ia langsung keluar dari dashboard.`) && jalankan({ action: "atur", email: a.email, status: "Nonaktif" })}
                          >
                            <Icon name="lock" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tambah ? (
        <Drawer
          title="Tambah anggota tim"
          sub="Password sementara dibuat otomatis dan tampil sekali."
          onClose={() => setTambah(false)}
          foot={
            <div className="drawer-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setTambah(false)}>
                Batal
              </button>
              <button type="button" className="btn btn-blue" disabled={busy} onClick={simpanBaru}>
                Buat akun
              </button>
            </div>
          }
        >
          {galatForm ? (
            <div className="banner err">
              <Icon name="alert" />
              <div>{galatForm}</div>
            </div>
          ) : null}
          <label className="ffield">
            <span>Nama</span>
            <input className="input" value={baru.nama} onChange={(e) => setBaru((b) => ({ ...b, nama: e.target.value }))} placeholder="mis. Rina (Tim Seleksi)" autoFocus />
          </label>
          <label className="ffield">
            <span>Email</span>
            <input className="input" type="email" value={baru.email} onChange={(e) => setBaru((b) => ({ ...b, email: e.target.value }))} placeholder="nama@cerebrum.id" />
          </label>
          <div className="ffield">
            <span>Peran</span>
            <PilihPeran nilai={baru.peran} onUbah={(peran) => setBaru((b) => ({ ...b, peran }))} />
          </div>
        </Drawer>
      ) : null}

      {ubah ? (
        <Drawer
          title={`Peran ${ubah.nama}`}
          sub={ubah.email}
          onClose={() => setUbah(null)}
          foot={
            <div className="drawer-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setUbah(null)}>
                Batal
              </button>
              <button
                type="button"
                className="btn btn-blue"
                disabled={busy || !ubah.peran.length}
                onClick={() => jalankan({ action: "atur", email: ubah.email, peran: ubah.peran }, () => setUbah(null))}
              >
                Simpan peran
              </button>
            </div>
          }
        >
          <PilihPeran nilai={ubah.peran} onUbah={(peran) => setUbah((u) => ({ ...u, peran }))} />
          <p className="muted">Perubahan peran berlaku paling lambat 20 detik — menu orang itu ikut berubah saat halamannya dimuat ulang.</p>
        </Drawer>
      ) : null}

      {kred ? (
        <Drawer
          title={kred.reset ? "Password baru siap diserahkan" : "Akun siap diserahkan"}
          sub="Password ini hanya tampil sekali."
          onClose={() => window.confirm("Tutup? Password ini tidak bisa dilihat lagi.") && setKred(null)}
          foot={
            <div className="drawer-actions">
              <button type="button" className="btn btn-ghost" onClick={() => window.confirm("Tutup? Password ini tidak bisa dilihat lagi.") && setKred(null)}>
                Selesai
              </button>
            </div>
          }
        >
          <div className="kred">
            <div className="kred-atas">
              <div className="kred-siapa">
                <b>{kred.nama}</b>
                <span>
                  {kred.email} · {kred.peran.join(", ")}
                </span>
              </div>
            </div>
            <div className="kred-pw">
              <span>Password sementara</span>
              <code>{kred.password}</code>
            </div>
            <div className="kred-aksi">
              <button
                type="button"
                className="btn btn-ghost sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(pesanAkun(kred));
                    setDisalin(true);
                  } catch (_) {}
                }}
              >
                <Icon name="salin" /> {disalin ? "Pesan disalin" : "Salin pesan"}
              </button>
            </div>
          </div>
        </Drawer>
      ) : null}
    </>
  );
}
