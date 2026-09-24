import Brand from "@/components/Brand";

export const metadata = { title: "Masuk" };

export default function Login({ searchParams }) {
  const error = searchParams?.error;
  const next = searchParams?.next || "/admin";
  return (
    <div className="login-wrap">
      <form className="login-card" method="POST" action="/api/login">
        <Brand size={38} />
        <div>
          <h1>Masuk dashboard admin</h1>
          <p>Halaman ini berisi data honor dan rekening guru. Masukkan password tim.</p>
        </div>
        {error === "belum-diset" ? (
          <div className="banner err" role="alert" style={{ margin: 0 }}>
            <div>
              Area internal dikunci karena password server belum diset. Isi <b>INTERNAL_PASSWORD</b> di Environment
              Variables Vercel, lalu deploy ulang.
            </div>
          </div>
        ) : error ? (
          <div className="banner err" role="alert" style={{ margin: 0 }}>
            <div>Password salah. Coba lagi.</div>
          </div>
        ) : null}
        <input type="hidden" name="next" value={next} />
        <label className="ffield">
          <span>Password internal</span>
          <input className="input" type="password" name="password" autoComplete="current-password" autoFocus required />
        </label>
        <button className="btn btn-blue block" type="submit">
          Masuk
        </button>
      </form>
    </div>
  );
}
