import { redirect } from "next/navigation";
import ProfilSaya from "@/components/ProfilSaya";
import { sesiGuru } from "@/lib/sesiGuru";
import { getTeachers } from "@/lib/teachers";
import { riwayatGuru } from "@/lib/profilGuru";
import { daftarPerubahan, isianAwal } from "@/lib/perubahanGuru";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profil saya" };

// Hanya data milik guru yang login (akun.idGuru). NIK, KTP, dan catatan
// admin sengaja tidak dikirim ke halaman ini.
export default async function HalamanProfil() {
  const sesi = await sesiGuru();
  if (!sesi) redirect("/open/masuk?error=sesi");
  if (sesi.wajibGanti) redirect("/open/ganti-password");
  const { rows = [] } = await getTeachers();
  const g = rows.find((x) => x.idGuru && x.idGuru === sesi.akun.idGuru);
  if (!g) {
    return (
      <ProfilSaya
        guru={{ nama: sesi.akun.nama, email: sesi.akun.email }}
        kosong
      />
    );
  }
  const [riwayat, ajuan] = await Promise.all([riwayatGuru(g, rows), daftarPerubahan({ idGuru: g.idGuru })]);
  return (
    <ProfilSaya
      guru={{ nama: g.nama, email: sesi.akun.email, idGuru: g.idGuru, status: g.status }}
      isian={isianAwal(g)}
      riwayat={riwayat}
      ajuan={ajuan.filter((a) => a.status === "Menunggu").map((a) => ({ kolom: a.kolom, label: a.label, baru: a.baru, waktu: a.waktu }))}
    />
  );
}
