export const metadata = { title: "Login Internal" };

export default function Login({ searchParams }) {
  const error = searchParams?.error;
  const next = searchParams?.next || "/admin";
  return (
    <div className="login-wrap">
      <form className="login-card" method="POST" action="/api/login">
        <div className="brand" style={{ marginBottom: 18 }}>
          <span className="brand-badge">C</span>
          <span>Dashboard Internal</span>
        </div>
        <h1>Masuk area internal</h1>
        <p>Halaman ini berisi data sensitif. Masukkan password tim.</p>
        {error ? <div className="err">Password salah. Coba lagi.</div> : null}
        <input type="hidden" name="next" value={next} />
        <input
          className="input"
          type="password"
          name="password"
          placeholder="Password internal"
          autoFocus
          required
        />
        <button className="btn btn-blue" style={{ width: "100%" }} type="submit">
          Masuk
        </button>
      </form>
    </div>
  );
}
