import Icon from "./Icon";

// Hanya bersuara bila ada masalah. Banner hijau "data real-time" dulu tampil
// terus di setiap halaman — informasi yang selalu benar tidak perlu diumumkan;
// status sinkron sekarang ada di kaki sidebar.
export default function DataBanner({ source }) {
  if (source === "live") return null;
  return (
    <div className="banner sample">
      <Icon name="alert" />
      <div>
        Menampilkan data contoh, bukan isi spreadsheet.
        <div className="banner-detail">Atur kredensial Google Sheets di Environment Variables agar data tampil langsung.</div>
      </div>
    </div>
  );
}
