// Alias menjaga akun lama tetap berlaku; izin tulis pemeriksaan tetap khusus RAD.
export const PERAN_TIM = ["Pemilik", "RAD", "CLO", "Seleksi", "Akademik"];
export function bolehTim(sesi, peran = []) {
  if (!sesi) return false;
  const punya = sesi.peran || [];
  if (sesi.pemilik || punya.includes("Pemilik")) return true;
  const efektif = new Set(punya);
  if (punya.includes("RAD")) efektif.add("Akademik");
  if (punya.includes("CLO")) efektif.add("Seleksi");
  return !peran.length || peran.some((p) => efektif.has(p));
}
export const timPantauan = (sesi) => [
  ...(bolehTim(sesi, ["Akademik"]) ? ["rad"] : []),
  ...(bolehTim(sesi, ["Seleksi"]) ? ["clo"] : []),
];
