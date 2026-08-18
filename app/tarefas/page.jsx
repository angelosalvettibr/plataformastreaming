"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

const PARA = [["financeiro", "Letícia (financeiro)"], ["juridico", "Priscilla (jurídico)"], ["admin", "Angelo (eu)"]];
const LINKS = [["", "— sem link —"], ["/caixa", "Caixa"], ["/contas", "Contas do Mês"], ["/extratos", "Extratos & Faturas"], ["/fornecedores", "Fornecedores"], ["/mesa", "Mesa Legal"], ["/advogados", "Advogados & Processos"], ["/empresas", "Empresas"], ["/cockpit", "Cockpit"]];

export default function Tarefas() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const mes = new Date().toISOString().slice(0, 7);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ para: "financeiro", titulo: "", detalhe: "", link: "", prioridade: 2, exige: "nenhum" });
  const [err, setErr] = useState("");

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("tarefas").select("*").eq("mes", mes)
      .order("para").order("feito").order("prioridade");
    setRows(data || []);
  }, [mes]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (e) => {
    e.preventDefault(); setErr("");
    const { error } = await supabase.from("tarefas").insert({
      mes, para: form.para, titulo: form.titulo.trim(), detalhe: form.detalhe.trim() || null,
      link: form.link || null, prioridade: Number(form.prioridade), exige: form.exige, criado_por: session.user.email,
    });
    if (error) setErr(error.message);
    else { setForm({ ...form, titulo: "", detalhe: "" }); carregar(); }
  };
  const remover = async (id) => {
    if (!confirm("Remover tarefa?")) return;
    await supabase.from("tarefas").delete().eq("id", id);
    carregar();
  };

  if (perfil && perfil.role !== "admin")
    return <div className="container muted">Só o Angelo gerencia as tarefas — as tuas aparecem na página inicial.</div>;

  return (
    <div className="container" style={{ maxWidth: 920 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">Tarefas do Mês</h1>
      <p className="muted" style={{ fontSize: 14, margin: "4px 0 20px" }}>
        O que o sistema pede de cada um em {mes}. Cria aqui — aparece guiado na entrada de quem for.
      </p>

      <form onSubmit={salvar} className="card" style={{ display: "grid", gap: 10, marginBottom: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 130px", gap: 10 }}>
          <select value={form.para} onChange={(e) => setForm({ ...form, para: e.target.value })}>
            {PARA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })}>
            {LINKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}>
            <option value={1}>🔴 urgente</option><option value={2}>🟡 no mês</option><option value={3}>⚪ quando der</option>
          </select>
          <select value={form.exige} onChange={(e) => setForm({ ...form, exige: e.target.value })} style={{ gridColumn: "1 / -1" }}>
            <option value="nenhum">Concluir: só marcar ✓</option>
            <option value="resposta">Concluir exige: responder por escrito 💬</option>
            <option value="arquivo">Concluir exige: anexar arquivo 📎</option>
          </select>
        </div>
        <input required placeholder="O que precisa ser feito *" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
        <input placeholder="Detalhe (opcional)" value={form.detalhe} onChange={(e) => setForm({ ...form, detalhe: e.target.value })} />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {err && <span style={{ color: "var(--neg)", fontSize: 13 }}>{err}</span>}
          <button className="primary" style={{ marginLeft: "auto" }}>Criar tarefa</button>
        </div>
      </form>

      {PARA.map(([role, label]) => {
        const doRole = rows.filter((t) => t.para === role);
        if (doRole.length === 0) return null;
        return (
          <div key={role} style={{ marginBottom: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>{label} · {doRole.filter((t) => !t.feito).length} pendentes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {doRole.map((t) => (
                <div key={t.id} className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, opacity: t.feito ? 0.55 : 1 }}>
                  <span>{t.feito ? "✅" : t.prioridade === 1 ? "🔴" : t.prioridade === 2 ? "🟡" : "⚪"}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, textDecoration: t.feito ? "line-through" : "none" }}>{t.titulo}</span>
                    {t.detalhe && <div className="muted" style={{ fontSize: 12 }}>{t.detalhe}</div>}
                    {t.feito && t.feito_por && <div className="muted" style={{ fontSize: 11 }}>feita por {t.feito_por.split("@")[0]}</div>}
                    {t.resposta && <div style={{ fontSize: 12, color: "var(--pos)" }}>💬 {t.resposta}</div>}
                    {t.arquivo_url && <a href={t.arquivo_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>📎 entrega</a>}
                    {!t.feito && t.exige !== "nenhum" && <span className="badge" style={{ fontSize: 10 }}>{t.exige === "arquivo" ? "exige 📎" : "exige 💬"}</span>}
                  </div>
                  <a href="#" onClick={(e) => { e.preventDefault(); remover(t.id); }} style={{ color: "var(--neg)" }}>×</a>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
