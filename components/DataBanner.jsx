export default function DataBanner({ source }) {
  if (source === "live") {
    return (
      <div className="banner live">
        <span>●</span> Data langsung dari Google Sheets (real-time).
      </div>
    );
  }
  return (
    <div className="banner sample">
      <span>●</span> Menampilkan data contoh. Atur kredensial Google Sheets di
      Environment Variables agar data tampil real-time (lihat README).
    </div>
  );
}
