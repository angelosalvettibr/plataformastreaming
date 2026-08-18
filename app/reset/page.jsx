"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Reset() {
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setPronto(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((e) => {
      if (e === "PASSWORD_RECOVERY" || e === "SIGNED_IN") setPronto(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const salvar = async (e) => {
    e.preventDefault();
    setErr("");
    if (senha.length < 8) { setErr("Mínimo 8 caracteres."); return; }
    if (senha !== senha2) { setErr("As senhas não conferem."); return; }
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) setErr(error.message);
    else { setOk(true); setTimeout(() => (window.location.href = "/"), 1500); }
  };

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="eyebrow">Angelo's Life Companion</div>
      <h1 className="display">Escolher senha</h1>
      {!pronto ? (
        <p className="muted" style={{ marginTop: 14 }}>Abre essa página pelo link que chegou no teu email.</p>
      ) : ok ? (
        <div className="card" style={{ marginTop: 16 }}>✓ Senha salva! Entrando…</div>
      ) : (
        <form onSubmit={salvar} className="card" style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <input type="password" required placeholder="nova senha (mín. 8)" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <input type="password" required placeholder="repete a senha" value={senha2} onChange={(e) => setSenha2(e.target.value)} />
          {err && <div style={{ color: "var(--neg)", fontSize: 13 }}>{err}</div>}
          <button className="primary" type="submit">Salvar senha</button>
        </form>
      )}
    </div>
  );
}
