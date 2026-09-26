"use client";

// Isian password dengan tombol lihat/sembunyikan — password sementara dari
// admin berupa karakter acak, jadi guru perlu bisa memeriksa ketikannya.
import { useState } from "react";
import Icon from "./Icon";

export default function InputSandi({ id, name, label, autoComplete, autoFocus, petunjuk }) {
  const [lihat, setLihat] = useState(false);
  return (
    <div className="ffield">
      <label htmlFor={id}>{label}</label>
      <div className="sandi">
        <input
          id={id}
          name={name}
          type={lihat ? "text" : "password"}
          className="input"
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
        <button type="button" className="sandi-lihat" onClick={() => setLihat((v) => !v)} aria-label={lihat ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={lihat}>
          <Icon name={lihat ? "mataTutup" : "mata"} size={18} />
        </button>
      </div>
      {petunjuk ? <small>{petunjuk}</small> : null}
    </div>
  );
}
