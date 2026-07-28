// ============================================================================
//  DATA LAYER — tab "Data guru freelance"
//
//  Sheet ini aslinya keluaran Google Form (29 kolom), jadi kolomnya dipetakan
//  lewat huruf tetap, bukan urutan. Yang dipakai dashboard hanya sebagian;
//  kolom lain (KTP, CV, pernyataan, dll) tidak pernah disentuh saat mengedit.
//
//  Nomor rekening / WA / NPWP ditulis sebagai TEKS — angka berawalan 0 akan
//  kehilangan nolnya kalau disimpan sebagai bilangan.
// ============================================================================

import { SHEET_IDS, authParams, batchRead, batchWrite } from "./gauth";
import { norm, parseNum } from "./format";

export const TAB_GURU = "Data guru freelance";
const ID = SHEET_IDS.master;
const FIRST_ROW = 2; // baris 1 = header
const SCAN_TO = 500;

const q = (a1) => `'${TAB_GURU}'!${a1}`;

// field dashboard -> kolom sheet
export const COL = {
  idGuru: "A",
  email: "C",
  wa: "D",
  status: "E",
  nama: "F",
  jenisKelamin: "G",
  pendidikan: "K",
  jurusan: "L",
  universitas: "M",
  pekerjaan: "N",
  bidang: "Q",
  jenisProyek: "R",
  kapasitas: "U",
  catatan: "V",
  rekening: "Z",
  pemilikRekening: "AA",
  npwp: "AB",
};
const IDX = { A:0,B:1,C:2,D:3,E:4,F:5,G:6,H:7,I:8,J:9,K:10,L:11,M:12,N:13,O:14,P:15,Q:16,R:17,S:18,T:19,U:20,V:21,W:22,X:23,Y:24,Z:25,AA:26,AB:27,AC:28 };

// Nilai penanda "belum ada" yang dipakai di sheet.
const KOSONG = /^([-–—.]+|n\/?a|belum(\s+ada)?|tidak\s+ada)$/i;
const bersih = (v) => {
  const s = norm(v);
  return KOSONG.test(s) ? "" : s;
};
// identitas: selalu teks agar nol di depan tidak hilang
const TEKS = new Set(["wa", "rekening", "npwp", "email"]);
const asText = (v) => {
  const s = norm(v);
  return s === "" ? "" : "'" + s;
};

function mapRows(rows) {
  const out = [];
  rows.forEach((row, i) => {
    const get = (f) => norm(row[IDX[COL[f]]]);
    const id = get("idGuru");
    const nama = get("nama");
    if (!id && !nama) return;
    out.push({
      row: FIRST_ROW + i,
      idGuru: id,
      nama,
      status: get("status"),
      email: get("email"),
      wa: get("wa"),
      jenisKelamin: get("jenisKelamin"),
      pendidikan: get("pendidikan"),
      jurusan: get("jurusan"),
      universitas: get("universitas"),
      pekerjaan: get("pekerjaan"),
      bidang: get("bidang"),
      jenisProyek: get("jenisProyek"),
      kapasitas: parseNum(get("kapasitas")),
      catatan: get("catatan"),
      rekening: bersih(get("rekening")),
      pemilikRekening: get("pemilikRekening"),
      npwp: bersih(get("npwp")),
    });
  });
  return out;
}

export async function getTeachers() {
  const ap = await authParams();
  if (!ap) return { source: "sample", rows: [] };
  try {
    const [rows] = await batchRead(ID, [q(`A${FIRST_ROW}:AC${SCAN_TO}`)], ap);
    return { source: "live", rows: mapRows(rows || []), canWrite: ap.write };
  } catch (e) {
    console.error("getTeachers:", e.message);
    return { source: "error", rows: [], error: e.message };
  }
}

/** ID guru berikutnya = angka tertinggi + 1; nomor tidak pernah dipakai ulang. */
export function nextIdGuru(rows) {
  let max = 0;
  rows.forEach((r) => {
    const n = parseInt(String(r.idGuru).replace(/\D/g, ""), 10);
    if (!isNaN(n)) max = Math.max(max, n);
  });
  return String(max + 1);
}

const cell = (f, v) => {
  if (v === null || v === undefined || v === "") return "";
  if (f === "kapasitas") return parseNum(v);
  if (TEKS.has(f)) return asText(v);
  return String(v);
};

/** Tambah guru baru. ID ditentukan sistem, bukan pemanggil. */
export async function createTeacher(data) {
  const nama = norm(data.nama);
  if (!nama) throw new Error("Nama guru wajib diisi.");
  const { rows } = await getTeachers();

  const sama = rows.find((r) => r.nama.toLowerCase() === nama.toLowerCase());
  if (sama && !data.force) {
    const err = new Error(`Guru "${sama.nama}" (ID ${sama.idGuru}) sudah terdaftar.`);
    err.duplicate = [{ idGuru: sama.idGuru, nama: sama.nama }];
    throw err;
  }

  const id = nextIdGuru(rows);
  const r = (rows.length ? Math.max(...rows.map((x) => x.row)) : FIRST_ROW - 1) + 1;

  // tulis per kolom supaya kolom lain (KTP, CV, pernyataan) tidak tersentuh
  const data2 = [{ range: q(`A${r}`), values: [[asText(id)]] }];
  for (const [f, col] of Object.entries(COL)) {
    if (f === "idGuru") continue;
    if (!(f in data)) continue;
    data2.push({ range: q(`${col}${r}`), values: [[cell(f, data[f])]] });
  }
  await batchWrite(ID, data2);
  return { idGuru: id, row: r };
}

/** Ubah sebagian kolom. ID guru tidak pernah ikut berubah. */
export async function updateTeacher(row, patch) {
  const r = Number(row);
  if (!Number.isInteger(r) || r < FIRST_ROW) throw new Error("Nomor baris tidak valid: " + row);
  const data = [];
  for (const [f, col] of Object.entries(COL)) {
    if (f === "idGuru") continue; // ID permanen
    if (!(f in patch)) continue;
    data.push({ range: q(`${col}${r}`), values: [[cell(f, patch[f])]] });
  }
  if (!data.length) return { updated: 0 };
  await batchWrite(ID, data);
  return { updated: data.length, row: r };
}
