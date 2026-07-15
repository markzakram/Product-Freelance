"use client";

// ============================================================================
//  Kwitansi pembayaran guru freelance.
//  Dirender tersembunyi di layar dan hanya tampil saat window.print()
//  (lihat blok @media print di globals.css) -> "Cetak / Simpan PDF" di browser.
// ============================================================================

import { rupiah, numberID } from "@/lib/format";

const TGL_ID = (iso) => {
  if (!iso) return "-";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

function today() {
  return new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/** Satu lembar kwitansi untuk satu guru. */
export function ReceiptSheet({ group, brand, periode }) {
  const { guru, teacher, items, total, soal } = group;
  const rek = teacher?.rekening || "";
  const owner = teacher?.pemilikRekening || "";

  return (
    <section className="receipt">
      <header className="rc-head">
        <div>
          <div className="rc-brand">{brand}</div>
          <div className="rc-title">Kwitansi Pembayaran Guru Freelance</div>
        </div>
        <div className="rc-meta">
          <div>
            <span>Periode</span>
            <b>{periode}</b>
          </div>
          <div>
            <span>Dicetak</span>
            <b>{today()}</b>
          </div>
        </div>
      </header>

      <div className="rc-to">
        <div className="rc-to-col">
          <span>Dibayarkan kepada</span>
          <b>{teacher?.nama || guru}</b>
          {teacher?.wa ? <div className="rc-sub">WA: {teacher.wa}</div> : null}
        </div>
        <div className="rc-to-col">
          {/* Label sengaja netral: kolom "Nomor rekening BSI" di sheet berisi
              sebagian rekening bank lain (mis. BCA/BRI) lengkap dengan namanya. */}
          <span>Nomor Rekening</span>
          {rek ? (
            <>
              <b className="rc-rek">{rek}</b>
              {owner ? <div className="rc-sub">a.n. {owner}</div> : null}
            </>
          ) : (
            <b className="rc-warn">⚠ Nomor rekening belum terisi di sheet</b>
          )}
        </div>
      </div>

      <table className="rc-table">
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>ID Project</th>
            <th>Submateri</th>
            <th className="num">Jumlah</th>
            <th>Status</th>
            <th className="num">Fee</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.row}>
              <td>{TGL_ID(it.tanggal)}</td>
              <td>{it.idProject || "-"}</td>
              <td>{it.subtes}</td>
              <td className="num">{numberID(it.jumlah)}</td>
              <td>{it.status || "-"}</td>
              <td className="num">{rupiah(it.fee)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              <b>TOTAL</b>
            </td>
            <td className="num">
              <b>{numberID(soal)}</b>
            </td>
            <td />
            <td className="num">
              <b>{rupiah(total)}</b>
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="rc-sign">
        <div>
          <span>Dibuat oleh</span>
          <div className="rc-line" />
          <small>Admin Akademik</small>
        </div>
        <div>
          <span>Diterima oleh</span>
          <div className="rc-line" />
          <small>{teacher?.nama || guru}</small>
        </div>
      </div>
    </section>
  );
}

/** Rekap semua guru dalam satu halaman — untuk proses transfer massal. */
export function ReceiptSummary({ groups, brand, periode }) {
  const total = groups.reduce((a, g) => a + g.total, 0);
  const soal = groups.reduce((a, g) => a + g.soal, 0);
  const tanpaRek = groups.filter((g) => !g.teacher?.rekening);

  return (
    <section className="receipt">
      <header className="rc-head">
        <div>
          <div className="rc-brand">{brand}</div>
          <div className="rc-title">Rekap Pembayaran Guru Freelance</div>
        </div>
        <div className="rc-meta">
          <div>
            <span>Periode</span>
            <b>{periode}</b>
          </div>
          <div>
            <span>Dicetak</span>
            <b>{today()}</b>
          </div>
        </div>
      </header>

      <table className="rc-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Nama Guru</th>
            <th>Nomor Rekening</th>
            <th>a.n.</th>
            <th className="num">Baris</th>
            <th className="num">Soal</th>
            <th className="num">Total Fee</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => (
            <tr key={g.guru}>
              <td>{i + 1}</td>
              <td>{g.teacher?.nama || g.guru}</td>
              <td>{g.teacher?.rekening || <span className="rc-warn">— belum ada —</span>}</td>
              <td>{g.teacher?.pemilikRekening || "-"}</td>
              <td className="num">{numberID(g.items.length)}</td>
              <td className="num">{numberID(g.soal)}</td>
              <td className="num">{rupiah(g.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>
              <b>TOTAL {groups.length} GURU</b>
            </td>
            <td className="num">
              <b>{numberID(groups.reduce((a, g) => a + g.items.length, 0))}</b>
            </td>
            <td className="num">
              <b>{numberID(soal)}</b>
            </td>
            <td className="num">
              <b>{rupiah(total)}</b>
            </td>
          </tr>
        </tfoot>
      </table>

      {tanpaRek.length ? (
        <p className="rc-warn rc-note">
          ⚠ {tanpaRek.length} guru belum punya nomor rekening di sheet “Data guru freelance”:{" "}
          {tanpaRek.map((g) => g.teacher?.nama || g.guru).join(", ")}. Lengkapi dulu sebelum transfer.
        </p>
      ) : null}
    </section>
  );
}

/** Wrapper yang menampung apa pun yang sedang dicetak. */
export default function PrintArea({ groups, brand, periode, mode }) {
  if (!groups || !groups.length) return null;
  return (
    <div className="print-only">
      {mode === "summary" ? (
        <ReceiptSummary groups={groups} brand={brand} periode={periode} />
      ) : (
        groups.map((g) => <ReceiptSheet key={g.guru} group={g} brand={brand} periode={periode} />)
      )}
    </div>
  );
}
