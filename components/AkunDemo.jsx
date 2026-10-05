"use client";

// Kotak akun contoh di halaman login MODE DEMO: satu klik mengisi email &
// password lalu masuk. Akun ini hanya ada di spreadsheet demo.
import Icon from "./Icon";

export default function AkunDemo({ akun = [], password, judul = "Akun contoh untuk mencoba" }) {
  const masuk = (email) => {
    const f = document.querySelector("form input[name=email]")?.form;
    if (!f) return;
    f.querySelector("input[name=email]").value = email;
    f.querySelector("input[name=password]").value = password;
    f.requestSubmit();
  };
  return (
    <div className="akun-demo">
      <b>
        <Icon name="info" size={15} /> {judul}
      </b>
      <ul>
        {akun.map((a) => (
          <li key={a.email}>
            <span>
              <b>{a.nama}</b>
              <small>
                {a.email}
                {a.ket ? ` · ${a.ket}` : ""}
              </small>
            </span>
            <button type="button" className="btn btn-ghost sm" onClick={() => masuk(a.email)}>
              Masuk
            </button>
          </li>
        ))}
      </ul>
      <small className="muted">
        Password semua akun contoh: <code>{password}</code>
      </small>
    </div>
  );
}
