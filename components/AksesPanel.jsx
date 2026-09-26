"use client";

// ============================================================================
//  PENDAFTARAN & AKUN GURU
//
//  1. Pendaftar dari Google Form -> Verifikasi (masuk Database guru + akun)
//     atau Tolak.
//  2. Akun login per guru: buat (satuan / sekaligus), reset password,
//     nonaktifkan.
//  3. Saklar "Wajibkan login" untuk halaman proyek — dinyalakan setelah
//     akun semua guru siap, supaya tidak ada guru yang tiba-tiba terkunci.
//
//  Password asli hanya tampil SEKALI, di panel Kredensial, untuk dikirim
//  lewat WhatsApp. Yang tersimpan di spreadsheet hanya hash-nya.
// ============================================================================

import { useMemo, useState } from "react";
import { numberID } from "@/lib/format";
import { tautanWa } from "@/lib/tautan";
import Icon from "./Icon";
import Drawer, { Dialog } from "./Drawer";
import PageActions from "./PageActions";

const lower = (s) => String(s ?? "").toLowerCase();

async function kirim(payload) {
  const res = await fetch("/api/admin/akun", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Gagal (HTTP ${res.status})`);
  return j;
}

/** Status akun satu guru dari gabungan Database guru + tab Akun guru. */
function statusAkun(g, a) {
  if (!g.email) return { k: "tanpaEmail", label: "Tanpa email", cls: "rev" };
  if (!a || !a.punyaPassword) return { k: "belum", label: "Belum punya akun", cls: "batal plain" };
  if (a.status === "Nonaktif") return { k: "nonaktif", label: "Nonaktif", cls: "batal" };
  if (a.terkunci) return { k: "terkunci", label: "Terkunci sementara", cls: "rev" };
  if (a.wajibGanti) return { k: "ganti", label: "Belum ganti password", cls: "qc" };
  return { k: "aktif", label: "Aktif", cls: "appr" };
}

function pesanWa(k, reset) {
  const asal = typeof window !== "undefined" ? window.location.origin : "";
  return (
    `Halo ${k.nama || ""}, ` +
    (reset ? "password akun Proyek Guru Freelance Cerebrum Anda sudah direset." : "akun Proyek Guru Freelance Cerebrum Anda sudah aktif.") +
    `\n\nMasuk di: ${asal}/open/masuk\nEmail: ${k.email}\nPassword sementara: ${k.password}\n\n` +
    "Setelah masuk, Anda akan diminta membuat password baru. Jangan bagikan password ini ke siapa pun."
  );
}

async function salin(teks) {
  try {
    await navigator.clipboard.writeText(teks);
    return true;
  } catch (_) {
    return false;
  }
}

/* ------------------------------------------------ panel kredensial (sekali tampil) */
function Kredensial({ daftar, reset, onClose }) {
  const [terkirim, setTerkirim] = useState({});
  const [disalin, setDisalin] = useState("");
  const sisa = daftar.filter((k) => !terkirim[k.email]).length;
  // Password tidak bisa dilihat lagi setelah panel tertutup — jangan sampai
  // tertutup karena salah ketuk di luar panel.
  const tutup = () => {
    if (!sisa || window.confirm(`${sisa} password belum ditandai terkirim dan tidak bisa dilihat lagi setelah panel ditutup. Tutup sekarang?`)) onClose();
  };
  return (
    <Drawer
      wide={daftar.length > 1}
      title={daftar.length > 1 ? `${numberID(daftar.length)} akun siap dikirim` : reset ? "Password baru siap dikirim" : "Akun siap dikirim"}
      sub="Kirim ke masing-masing guru lewat WhatsApp"
      onClose={tutup}
      foot={
        <>
          <small className="muted">
            {sisa ? `${numberID(sisa)} belum ditandai terkirim.` : "Semua sudah dikirim."} Setelah panel ini ditutup password tidak bisa dilihat lagi — kalau
            terlewat, cukup reset password guru itu.
          </small>
          <div className="drawer-actions">
            <button type="button" className="btn btn-blue" onClick={tutup}>
              Selesai
            </button>
          </div>
        </>
      }
    >
      <div className="banner sample">
        <Icon name="lock" />
        <div>Password ini hanya tampil sekali. Yang disimpan di spreadsheet hanya hash-nya, jadi admin pun tidak bisa melihatnya lagi.</div>
      </div>
      <div className="kred-list">
        {daftar.map((k) => (
          <div key={k.email} className={"kred" + (terkirim[k.email] ? " kirim" : "")}>
            <div className="kred-atas">
              <div className="kred-siapa">
                <b>{k.nama || k.email}</b>
                <span>
                  {k.email}
                  {k.idGuru ? ` · ID ${k.idGuru}` : ""}
                </span>
              </div>
              {terkirim[k.email] ? (
                <span className="pill appr">
                  <Icon name="check" size={12} stroke={2.4} /> terkirim
                </span>
              ) : null}
            </div>
            <div className="kred-pw">
              <span>Password sementara</span>
              <code>{k.password}</code>
            </div>
            <div className="kred-aksi">
              <button
                type="button"
                className="btn btn-ghost sm"
                onClick={async () => {
                  if (await salin(pesanWa(k, reset))) setDisalin(k.email);
                }}
              >
                <Icon name="salin" />
                {disalin === k.email ? "Pesan disalin" : "Salin pesan"}
              </button>
              {k.wa ? (
                <a className="btn btn-wa sm" href={tautanWa(k.wa, pesanWa(k, reset))} target="_blank" rel="noopener noreferrer" onClick={() => setTerkirim((t) => ({ ...t, [k.email]: true }))}>
                  <Icon name="send" />
                  Kirim WhatsApp
                </a>
              ) : (
                <span className="muted xs2">Nomor WA belum ada — salin pesannya.</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ panel */
export default function AksesPanel({ data, busy, setBusy, setErr, onChanged, aksiEl, keDatabaseGuru }) {
  const [tampil, setTampil] = useState("pendaftar");
  const [saringP, setSaringP] = useState("Menunggu");
  const [saringA, setSaringA] = useState("semua");
  const [q, setQ] = useState("");
  const [konfirmasi, setKonfirmasi] = useState(null); // { judul, isi, tombol, bahaya, jalan }
  const [kred, setKred] = useState(null); // { daftar, reset }

  const pendaftar = data?.pendaftar || [];
  const akunByEmail = useMemo(() => new Map((data?.akun || []).map((a) => [a.email, a])), [data]);
  const guru = useMemo(
    () =>
      (data?.guru || []).map((g) => {
        const a = g.email ? akunByEmail.get(lower(g.email)) : null;
        return { ...g, akun: a, st: statusAkun(g, a) };
      }),
    [data, akunByEmail]
  );

  const hitungP = useMemo(() => {
    const c = { Menunggu: 0, Terverifikasi: 0, Ditolak: 0 };
    pendaftar.forEach((p) => (c[p.status] = (c[p.status] || 0) + 1));
    return c;
  }, [pendaftar]);
  const hitungA = useMemo(() => {
    const c = {};
    guru.forEach((g) => (c[g.st.k] = (c[g.st.k] || 0) + 1));
    return c;
  }, [guru]);
  const punyaAkun = guru.length - (hitungA.belum || 0) - (hitungA.tanpaEmail || 0);
  const bisaDibuat = hitungA.belum || 0;

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const cocok = (...xs) => words.every((w) => lower(xs.join(" ")).includes(w));
  const listP = pendaftar.filter((p) => (saringP === "Semua" || p.status === saringP) && cocok(p.nama, p.email, p.wa, p.bidang, p.universitas));
  const listA = guru.filter(
    (g) => (saringA === "semua" || g.st.k === saringA || (saringA === "belum" && g.st.k === "belum")) && cocok(g.nama, g.email, g.idGuru, g.wa)
  );

  const jalankan = async (fn) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
      setKonfirmasi(null);
    }
  };

  const verifikasi = (p) =>
    setKonfirmasi({
      judul: `Verifikasi ${p.nama || p.email}?`,
      isi: (
        <>
          <p className="modal-sub">
            Jawaban form-nya disalin ke <b>Database guru</b> dengan ID guru baru, lalu dibuatkan akun dengan password acak. Setelah itu Anda
            tinggal mengirim email & password-nya lewat WhatsApp.
          </p>
          <p className="modal-sub xs2">
            {p.email} · {p.wa || "WA kosong"}
          </p>
        </>
      ),
      tombol: "Verifikasi & buat akun",
      jalan: () =>
        jalankan(async () => {
          const j = await kirim({ action: "verifikasi", email: p.email });
          setKred({ daftar: j.kredensial, reset: false });
        }),
    });

  const buatAkun = (idGuru, n) =>
    setKonfirmasi({
      judul: n > 1 ? `Buat akun untuk ${numberID(n)} guru?` : "Buat akun untuk guru ini?",
      isi: (
        <p className="modal-sub">
          Setiap guru mendapat password acak yang wajib diganti saat pertama masuk.
          {n > 1 ? ` Siapkan waktu untuk mengirim ${numberID(n)} pesan WhatsApp — password hanya tampil sekali.` : ""}
        </p>
      ),
      tombol: n > 1 ? `Buat ${numberID(n)} akun` : "Buat akun",
      jalan: () =>
        jalankan(async () => {
          const j = await kirim({ action: "buatAkun", idGuru });
          setKred({ daftar: j.kredensial, reset: false });
        }),
    });

  const reset = (g) =>
    setKonfirmasi({
      judul: `Reset password ${g.nama}?`,
      isi: (
        <p className="modal-sub">
          Password lama langsung tidak berlaku dan guru otomatis keluar dari semua perangkat. Ia masuk dengan password acak baru, lalu wajib
          membuat password sendiri.
        </p>
      ),
      tombol: "Reset password",
      bahaya: true,
      jalan: () =>
        jalankan(async () => {
          const j = await kirim({ action: "reset", email: lower(g.email) });
          setKred({ daftar: j.kredensial, reset: true });
        }),
    });

  const ubahStatus = (g, status) =>
    status === "Nonaktif"
      ? setKonfirmasi({
          judul: `Nonaktifkan akun ${g.nama}?`,
          isi: <p className="modal-sub">Guru ini langsung keluar dan tidak bisa masuk sampai akunnya diaktifkan lagi. Data gurunya tidak berubah.</p>,
          tombol: "Nonaktifkan",
          bahaya: true,
          jalan: () => jalankan(() => kirim({ action: "status", email: lower(g.email), status })),
        })
      : jalankan(() => kirim({ action: "status", email: lower(g.email), status }));

  const tolak = (p) =>
    setKonfirmasi({
      judul: `Tolak pendaftaran ${p.nama || p.email}?`,
      isi: <p className="modal-sub">Pendaftar ini tidak dibuatkan akun dan pindah ke daftar Ditolak. Keputusan bisa dibatalkan kapan saja.</p>,
      tombol: "Tolak",
      bahaya: true,
      jalan: () => jalankan(() => kirim({ action: "tolak", email: p.email, nama: p.nama })),
    });

  const aturWajib = (nilai) =>
    nilai
      ? setKonfirmasi({
          judul: "Wajibkan login untuk halaman proyek?",
          isi: (
            <>
              <p className="modal-sub">Mulai sekarang hanya guru dengan akun aktif yang bisa melihat dan mengajukan proyek.</p>
              {guru.length - punyaAkun > 0 ? (
                <div className="banner sample" style={{ margin: 0 }}>
                  <Icon name="alert" />
                  <div>
                    <b>{numberID(guru.length - punyaAkun)} guru belum punya akun</b> ({numberID(hitungA.tanpaEmail || 0)} di antaranya tanpa email) dan
                    tidak akan bisa melihat proyek.
                  </div>
                </div>
              ) : null}
            </>
          ),
          tombol: "Wajibkan login",
          jalan: () => jalankan(() => kirim({ action: "wajibLogin", nilai: true })),
        })
      : jalankan(() => kirim({ action: "wajibLogin", nilai: false }));

  const chip = (aktif, label, n, onClick) => (
    <button key={label} type="button" className={"chip" + (aktif ? " active" : "")} aria-pressed={aktif} onClick={onClick}>
      {label} {n !== undefined ? <span className="n">{numberID(n)}</span> : null}
    </button>
  );

  if (!data) return <div className="card empty">Memuat pendaftaran & akun…</div>;
  const kunciTulis = busy || !data.canWrite;

  return (
    <>
      <PageActions el={aksiEl}>
        <label className="search">
          <Icon name="search" />
          <input type="search" placeholder="Cari nama, email, WA" aria-label="Cari pendaftar atau guru" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {tampil === "akun" && bisaDibuat ? (
          <button type="button" className="btn btn-blue fab" disabled={kunciTulis} onClick={() => buatAkun("semua", bisaDibuat)}>
            <Icon name="plus" stroke={2.2} />
            Buat akun untuk {numberID(bisaDibuat)} guru
          </button>
        ) : null}
      </PageActions>

      {/* ---------------------------------------------------- saklar akses */}
      <div className={"card akses-card" + (data.wajibLogin ? " kunci" : "")}>
        <span className="akses-ico">
          <Icon name={data.wajibLogin ? "lock" : "external"} size={20} />
        </span>
        <div className="akses-isi">
          <div className="akses-judul">
            <b>Halaman proyek guru</b>
            <span className={"pill " + (data.wajibLogin ? "appr" : "qc")}>{data.wajibLogin ? "Wajib login" : "Terbuka tanpa login"}</span>
          </div>
          <p>
            {data.wajibLogin
              ? "Hanya guru dengan akun aktif yang bisa melihat dan mengajukan proyek."
              : "Masa peralihan: siapa pun yang punya tautannya masih bisa melihat proyek. Siapkan akun semua guru, lalu wajibkan login."}
          </p>
          <div className="akses-meter">
            <div className="meter">
              <i style={{ width: guru.length ? Math.round((punyaAkun / guru.length) * 100) + "%" : 0 }} />
            </div>
            <span>
              <b>{numberID(punyaAkun)}</b> dari {numberID(guru.length)} guru punya akun
              {hitungA.tanpaEmail ? ` · ${numberID(hitungA.tanpaEmail)} tanpa email` : ""}
              {hitungA.ganti ? ` · ${numberID(hitungA.ganti)} belum ganti password` : ""}
            </span>
          </div>
        </div>
        <div className="akses-aksi">
          {data.wajibLogin ? (
            <button type="button" className="btn btn-ghost" disabled={kunciTulis} onClick={() => aturWajib(false)}>
              Buka lagi tanpa login
            </button>
          ) : (
            <button type="button" className="btn btn-blue" disabled={kunciTulis || !data.loginSiap} onClick={() => aturWajib(true)}>
              <Icon name="lock" />
              Wajibkan login
            </button>
          )}
        </div>
      </div>

      {!data.loginSiap ? (
        <div className="banner err">
          <Icon name="alert" />
          <div>
            <b>Login guru belum aktif di server.</b> Tambahkan environment variable <b>GURU_SESSION_SECRET</b> (acak, minimal 32 karakter) di Vercel
            lalu redeploy. Akun tetap bisa disiapkan sekarang.
          </div>
        </div>
      ) : null}
      {data.errorPendaftar ? (
        <div className="banner err">
          <Icon name="alert" />
          <div>
            Jawaban form pendaftaran tidak terbaca: {data.errorPendaftar}. Pastikan spreadsheet jawaban dibagikan ke service account.
          </div>
        </div>
      ) : null}

      <div className="seg-tab" role="tablist" aria-label="Tampilan">
        <button type="button" role="tab" aria-selected={tampil === "pendaftar"} className={tampil === "pendaftar" ? "on" : ""} onClick={() => setTampil("pendaftar")}>
          Pendaftar
          {hitungP.Menunggu ? <span className="badge-n">{numberID(hitungP.Menunggu)}</span> : null}
        </button>
        <button type="button" role="tab" aria-selected={tampil === "akun"} className={tampil === "akun" ? "on" : ""} onClick={() => setTampil("akun")}>
          Akun guru
          <span className="n">{numberID(guru.length)}</span>
        </button>
      </div>

      {tampil === "pendaftar" ? (
        <>
          <div className="chips geser" role="group" aria-label="Saring status pendaftar">
            {["Menunggu", "Terverifikasi", "Ditolak"].map((s) => chip(saringP === s, s, hitungP[s] || 0, () => setSaringP(s)))}
            {chip(saringP === "Semua", "Semua", pendaftar.length, () => setSaringP("Semua"))}
          </div>
          {listP.length === 0 ? (
            <div className="card empty">
              {saringP === "Menunggu" && !q ? "Tidak ada pendaftar yang menunggu verifikasi." : "Tidak ada pendaftar yang cocok."}
            </div>
          ) : (
            <div className="daftar-list">
              {listP.map((p) => (
                <article key={p.email} className="daftar">
                  <div className="daftar-atas">
                    <div>
                      <h3>{p.nama || "(tanpa nama)"}</h3>
                      <span className="muted">
                        Daftar {p.waktu || "—"}
                        {p.jumlahKirim > 1 ? ` · mengisi form ${p.jumlahKirim}×, yang tampil jawaban terbaru` : ""}
                      </span>
                    </div>
                    <span className={"pill " + (p.status === "Terverifikasi" ? "appr" : p.status === "Ditolak" ? "batal plain" : "qc")}>{p.status}</span>
                  </div>
                  <div className="daftar-grid">
                    <div>
                      <span>Kontak</span>
                      <b>{p.email}</b>
                      <small>{p.wa || "WA kosong"}</small>
                    </div>
                    <div>
                      <span>Pendidikan</span>
                      <b>{[p.pendidikan, p.jurusan].filter(Boolean).join(" · ") || "—"}</b>
                      <small>{p.universitas || ""}</small>
                    </div>
                    <div>
                      <span>Bidang</span>
                      <b className="clamp">{p.bidang || "—"}</b>
                    </div>
                    <div>
                      <span>Proyek diminati</span>
                      <b className="clamp">{p.jenisProyek || "—"}</b>
                      <small>{p.kapasitas ? `Kapasitas ${p.kapasitas}` : ""}</small>
                    </div>
                  </div>
                  <div className="daftar-bawah">
                    <div className="berkas">
                      {p.berkas.length ? (
                        p.berkas.map((b, i) => (
                          <a key={i} href={b.u} target="_blank" rel="noopener noreferrer" className="mini brand">
                            {b.label}
                            <Icon name="external" size={11} />
                          </a>
                        ))
                      ) : (
                        <span className="muted xs2">Tanpa berkas</span>
                      )}
                    </div>
                    <div className="daftar-aksi">
                      {p.status === "Menunggu" ? (
                        <>
                          <button type="button" className="btn btn-ghost sm" disabled={kunciTulis} onClick={() => tolak(p)}>
                            Tolak
                          </button>
                          <button type="button" className="btn btn-blue sm" disabled={kunciTulis} onClick={() => verifikasi(p)}>
                            <Icon name="userCheck" />
                            Verifikasi & buat akun
                          </button>
                        </>
                      ) : p.status === "Ditolak" ? (
                        <button type="button" className="btn btn-ghost sm" disabled={kunciTulis} onClick={() => jalankan(() => kirim({ action: "batalTolak", email: p.email }))}>
                          Batalkan penolakan
                        </button>
                      ) : (
                        <span className="muted xs2">ID guru {p.idGuru}</span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="chips geser" role="group" aria-label="Saring status akun">
            {chip(saringA === "semua", "Semua", guru.length, () => setSaringA("semua"))}
            {[
              ["belum", "Belum punya akun"],
              ["tanpaEmail", "Tanpa email"],
              ["ganti", "Belum ganti password"],
              ["aktif", "Aktif"],
              ["terkunci", "Terkunci"],
              ["nonaktif", "Nonaktif"],
            ]
              .filter(([k]) => hitungA[k] || saringA === k)
              .map(([k, l]) => chip(saringA === k, l, hitungA[k] || 0, () => setSaringA(k)))}
          </div>
          {saringA === "tanpaEmail" && hitungA.tanpaEmail ? (
            <div className="banner info">
              <Icon name="info" />
              <div>
                Email dipakai sebagai nama login. Lengkapi dulu email guru-guru ini di{" "}
                <button type="button" className="btn-link" onClick={keDatabaseGuru}>
                  Database guru
                </button>
                , lalu buat akunnya.
              </div>
            </div>
          ) : null}
          <div className="table-wrap fixed">
            <table className="grid-table">
              <colgroup>
                {[7, 22, 24, 17, 15, 15].map((w, i) => (
                  <col key={i} style={{ width: w + "%" }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nama</th>
                  <th>Email login</th>
                  <th>Status akun</th>
                  <th>Login terakhir</th>
                  <th className="act">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {listA.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty">
                      Tidak ada guru yang cocok.
                    </td>
                  </tr>
                ) : null}
                {listA.map((g) => (
                  <tr key={g.row} className={g.st.k === "nonaktif" ? "row-dim" : ""}>
                    <td className="mono" data-l="ID">
                      {g.idGuru}
                    </td>
                    <td className="wrap c-title">
                      <b style={{ fontWeight: 600, color: "var(--text)" }}>{g.nama}</b>
                    </td>
                    <td className="wrap" data-l="Email login">
                      {g.email || <span className="neg">belum ada</span>}
                    </td>
                    <td data-l="Status akun">
                      <span className={"pill " + g.st.cls}>{g.st.label}</span>
                    </td>
                    <td className="xs2" data-l="Login terakhir">
                      {g.akun?.loginTerakhir || "—"}
                    </td>
                    <td className="act">
                      <div className="rowmenu">
                        {g.st.k === "belum" ? (
                          <button type="button" className="btn btn-ghost xs" disabled={kunciTulis} onClick={() => buatAkun(g.idGuru, 1)}>
                            Buat akun
                          </button>
                        ) : g.st.k === "tanpaEmail" ? (
                          <button type="button" className="btn btn-ghost xs" onClick={keDatabaseGuru}>
                            Isi email
                          </button>
                        ) : (
                          <>
                            <button type="button" className="btn btn-ghost xs" disabled={kunciTulis} onClick={() => reset(g)}>
                              Reset password
                            </button>
                            {g.st.k === "nonaktif" ? (
                              <button type="button" className="btn btn-ghost xs" disabled={kunciTulis} onClick={() => ubahStatus(g, "Aktif")}>
                                Aktifkan
                              </button>
                            ) : (
                              <button type="button" className="ibtn danger" disabled={kunciTulis} onClick={() => ubahStatus(g, "Nonaktif")} aria-label={`Nonaktifkan akun ${g.nama}`} title="Nonaktifkan akun">
                                <Icon name="lock" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {konfirmasi ? (
        <Dialog
          title={konfirmasi.judul}
          onClose={() => setKonfirmasi(null)}
          busy={busy}
          foot={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setKonfirmasi(null)} disabled={busy}>
                Batal
              </button>
              <button type="button" className={"btn " + (konfirmasi.bahaya ? "btn-red solid" : "btn-blue")} onClick={konfirmasi.jalan} disabled={busy}>
                {busy ? "Memproses…" : konfirmasi.tombol}
              </button>
            </>
          }
        >
          {konfirmasi.isi}
        </Dialog>
      ) : null}

      {kred ? <Kredensial daftar={kred.daftar} reset={kred.reset} onClose={() => setKred(null)} /> : null}
    </>
  );
}
