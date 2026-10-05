import { redirect } from "next/navigation";
import { sesiGuru } from "@/lib/sesiGuru";
import { bacaPengerjaan, maksAktif } from "@/lib/pengerjaan";
import { AKTIF } from "@/lib/pengerjaanOpsi";
import ProyekSaya from "@/components/ProyekSaya";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proyek saya" };

// Daftar pengambilan proyek milik guru yang sedang masuk (semua bulan).
export default async function ProyekSayaPage() {
  const sesi = await sesiGuru();
  if (!sesi) redirect("/open/masuk");
  if (sesi.wajibGanti) redirect("/open/ganti-password");
  const { akun } = sesi;
  const [semua, maks] = await Promise.all([bacaPengerjaan().catch(() => null), maksAktif()]);
  const punyaku = (semua || []).filter((p) => (akun.idGuru && p.idGuru === akun.idGuru) || p.email === akun.email);
  const urut = [...punyaku].sort((a, b) => Number(AKTIF.has(b.status)) - Number(AKTIF.has(a.status)) || b.row - a.row);
  return (
    <ProyekSaya
      daftar={urut.map(({ row, email, ...p }) => p)}
      gagalMuat={semua === null}
      maks={maks}
      guru={{ nama: akun.nama, email: akun.email }}
    />
  );
}
