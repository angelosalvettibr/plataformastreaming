"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const entrar = async (e) => {
    e.preventDefault();
    setErr(""); setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) setErr("Email ou senha incorretos.");
  };

  const definirSenha = async () => {
    setErr(""); setMsg("");
    if (!email.trim()) { setErr("Digita teu email primeiro."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset`,
    });
    if (error) setErr(error.message);
    else setMsg("✉️ Link enviado! Abre teu email e clica pra escolher tua senha.");
  };

  if (session === undefined) return <div className="container muted">Abrindo o companion…</div>;

  if (!session)
    return (
      <div className="container" style={{ maxWidth: 420, paddingTop: 80 }}>
        <div className="eyebrow">Angelo's Life Companion</div>
        <h1 className="display">Entrar</h1>
        <form onSubmit={entrar} className="card" style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <input type="email" required placeholder="teu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" required placeholder="senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
          {err && <div style={{ color: "var(--neg)", fontSize: 13 }}>{err}</div>}
          {msg && <div style={{ color: "var(--pos)", fontSize: 13 }}>{msg}</div>}
          <button className="primary" type="submit">Entrar</button>
          <a href="#" onClick={(e) => { e.preventDefault(); definirSenha(); }} style={{ fontSize: 13, textAlign: "center" }}>
            Primeiro acesso ou esqueceu? Definir minha senha
          </a>
        </form>
      </div>
    );

  return children({ session });
}
