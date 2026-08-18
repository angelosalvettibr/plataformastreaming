"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

export default function Empresas() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const [rows, setRows] = useState([]);
  const [procs, setProcs] = useState([]);
  const [form, setForm] = useState({ nome: "", cnpj: "", status: "", obs: "" });
  const [err, setErr] = useState("");

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("empresas").select("*").order("nome");
    setRows(data || []);
    const { data: p } = await supabase.from("processos").select("empresa,status");
    setProcs(p || []);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (e) => {
    e.preventDefault(); setErr("");
    const { error } = await supabase.from("empresas").insert({ ...form, nome: form.nome.trim(), criado_por: session.user.email });
    if (error) setErr(error.message);
    else { setForm({ nome: "", cnpj: "", status: "", obs: "" }); carregar(); }
  };
  const remover = async (id) => {
    if (!confirm("Remover empresa?")) return;
    await supabase.from("empresas").delete().eq("id", id);
    carregar();
  };

  if (perfil && !["admin", "financeiro", "juridico"].includes(perfil.role))
    return <div className="container muted">Sem acesso a este módulo.</div>;

  const nProc = (nome) => {
    const chave = nome.split(" ")[0].toUpperCase();
    return procs.filter((p) => (p.empresa || "").toUpperCase().includes(chave) && p.status !== "Encerrado").length;
  };

  return (
    <div className="container" style={{ maxWidth: 920 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">Empresas do Grupo</h1>
      <p className="muted" style={{ fontSize: 14, margin: "4px 0 20px" }}>
        Cada empresa com sua situação — o contador de processos ativos vem do módulo jurídico.
      </p>

      <form onSubmit={salvar} className="card" style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
          <input required placeholder="Nome da empresa *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input placeholder="CNPJ" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
          <input placeholder="Status (ativa, pausada...)" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} />
        </div>
        <input placeholder="Observações (situação, problemas, pendências)" value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {err && <span style={{ color: "var(--neg)", fontSize: 13 }}>{err}</span>}
          <button className="primary" style={{ marginLeft: "auto" }}>Salvar empresa</button>
        </div>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {rows.map((r) => (
          <div key={r.id} className="card" style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600 }}>{r.nome}</div>
              <a href="#" onClick={(e) => { e.preventDefault(); remover(r.id); }} style={{ color: "var(--neg)" }}>×</a>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
              {r.status && <span className="badge">{r.status}</span>}
              {nProc(r.nome) > 0 && (
                <span className="badge" style={{ background: "#FBEAE4", color: "var(--neg)", borderColor: "transparent" }}>
                  ⚖️ {nProc(r.nome)} processo{nProc(r.nome) > 1 ? "s" : ""} ativo{nProc(r.nome) > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {r.cnpj && <div className="muted" style={{ fontSize: 12 }}>CNPJ {r.cnpj}</div>}
            {r.obs && <div className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{r.obs}</div>}
          </div>
        ))}
        {rows.length === 0 && <div className="muted" style={{ fontStyle: "italic" }}>Nenhuma empresa ainda — roda o SQL v5 pro seed entrar.</div>}
      </div>
    </div>
  );
}
