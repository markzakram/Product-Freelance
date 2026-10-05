import { notFound } from "next/navigation";
import Brand from "@/components/Brand";
import Icon from "@/components/Icon";
import { MODE_DEMO } from "@/lib/demo";

export const metadata = { title: "Pratinjau WhatsApp (demo)" };

// Mode demo: tombol WhatsApp di seluruh aplikasi membuka halaman ini, bukan
// wa.me — pesan contoh tidak boleh sampai ke nomor sungguhan.
export default function PratinjauWa({ searchParams }) {
  if (!MODE_DEMO) notFound();
  const ke = String(searchParams?.ke || "").slice(0, 20);
  const pesan = String(searchParams?.pesan || "").slice(0, 4000);
  return (
    <div className="login-wrap">
      <div className="login-card demo-wa">
        <Brand size={34} />
        <div>
          <h1>Pratinjau pesan WhatsApp</h1>
          <p>
            Ini <b>mode demo</b> — pesan tidak dikirim ke mana pun. Di situs asli, tombol yang sama membuka WhatsApp dengan pesan ini siap kirim
            {ke ? ` ke +${ke}` : ""}.
          </p>
        </div>
        {pesan ? <div className="demo-gelembung">{pesan}</div> : <div className="muted">(tanpa pesan awal — membuka chat kosong)</div>}
        <p className="muted login-catatan">
          <Icon name="info" size={14} /> Tutup tab ini untuk kembali.
        </p>
      </div>
    </div>
  );
}
