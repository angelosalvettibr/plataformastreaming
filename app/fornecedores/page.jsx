"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

export default function Fornecedores() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", pix_ou_conta: "", categoria: "", obs: "" });
  const [err, setErr] = useState("");
  const [editando, setEditando] = useState(null);
  const [ed, setEd] = useState({});

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("fornecedores").select("*").order("nome");
    setRows(data || []);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (e) => {
    e.preventDefault(); setErr("");
    const { error } = await supabase.from("fornecedores").insert({ ...form, nome: form.nome.trim(), criado_por: session.user.email });
    if (error) setErr(error.message);
    else { setForm({ nome: "", email: "", telefone: "", pix_ou_conta: "", categoria: "", obs: "" }); carregar(); }
  };
  const abrirEdicao = (r) => {
    setEditando(r.id);
    setEd({ nome: r.nome, categoria: r.categoria || "", email: r.email || "", telefone: r.telefone || "", pix_ou_conta: r.pix_ou_conta || "", obs: r.obs || "" });
  };
  const salvarEdicao = async (id) => {
    const { error } = await supabase.from("fornecedores").update({
      nome: ed.nome.trim(), categoria: ed.categoria.trim() || null, email: ed.email.trim() || null,
      telefone: ed.telefone.trim() || null, pix_ou_conta: ed.pix_ou_conta.trim() || null, obs: ed.obs.trim() || null,
    }).eq("id", id);
    if (error) alert("Erro: " + error.message);
    setEditando(null);
    carregar();
  };

  const remover = async (id) => {
    if (!confirm("Remover fornecedor?")) return;
    await supabase.from("fornecedores").delete().eq("id", id);
    carregar();
  };

  if (perfil && !["admin", "financeiro"].includes(perfil.role))
    return <div className="container muted">Sem acesso a este módulo.</div>;

  return (
    <div className="container" style={{ maxWidth: 980 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">Fornecedores</h1>
      <p className="muted" style={{ fontSize: 14, margin: "4px 0 20px" }}>Nome, contato e conta de cada um — vira autocomplete no Caixa.</p>

      <form onSubmit={salvar} className="card" style={{ display: "grid", gap: 10, marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input required placeholder="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input placeholder="Categoria (ex.: Villa, PJ, PF...)" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Telefone/WhatsApp" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
        </div>
        <input placeholder="PIX ou conta (banco/ag/cc)" value={form.pix_ou_conta} onChange={(e) => setForm({ ...form, pix_ou_conta: e.target.value })} />
        <input placeholder="Observações" value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {err && <span style={{ color: "var(--neg)", fontSize: 13 }}>{err}</span>}
          <button className="primary" style={{ marginLeft: "auto" }}>Salvar fornecedor</button>
        </div>
      </form>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data">
          <thead><tr><th>Nome</th><th>Categoria</th><th>Contato</th><th>PIX / Conta</th><th>Obs</th><th>💬</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><b>{r.nome}</b></td>
                <td>{r.categoria && <span className="badge">{r.categoria}</span>}</td>
                <td className="muted" style={{ fontSize: 12 }}>{[r.email, r.telefone].filter(Boolean).join(" · ")}</td>
                <td className="muted" style={{ fontSize: 12 }}>{r.pix_ou_conta}</td>
                <td className="muted" style={{ fontSize: 12, maxWidth: 200 }}>{r.obs}</td>
                <td><input defaultValue={r.comentario || ""} placeholder="💬" title="Comentário — explica o porquê (vai pro briefing)"
                    onBlur={(e) => e.target.value !== (r.comentario || "") && supabase.from("fornecedores").update({ comentario: e.target.value.trim() || null }).eq("id", r.id)}
                    style={{ fontSize: 11.5, padding: "4px 7px", width: 130, background: r.comentario ? "#FFFBF0" : "var(--surface)" }} /></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <a href="#" className="muted" onClick={(e) => { e.preventDefault(); editando === r.id ? setEditando(null) : abrirEdicao(r); }} style={{ fontSize: 12, marginRight: 8 }}>{editando === r.id ? "fechar" : "editar"}</a>
                  <a href="#" onClick={(e) => { e.preventDefault(); remover(r.id); }} style={{ color: "var(--neg)" }}>×</a>
                </td>
              </tr>
            ))}
            {editando && rows.find((r) => r.id === editando) && (
              <tr>
                <td colSpan={6} style={{ background: "var(--surface2)", padding: 12 }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8 }}>
                      <input value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} placeholder="Nome" />
                      <input value={ed.categoria} onChange={(e) => setEd({ ...ed, categoria: e.target.value })} placeholder="Categoria" />
                      <input value={ed.email} onChange={(e) => setEd({ ...ed, email: e.target.value })} placeholder="Email" />
                      <input value={ed.telefone} onChange={(e) => setEd({ ...ed, telefone: e.target.value })} placeholder="Telefone" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 8 }}>
                      <input value={ed.pix_ou_conta} onChange={(e) => setEd({ ...ed, pix_ou_conta: e.target.value })} placeholder="PIX / conta" />
                      <input value={ed.obs} onChange={(e) => setEd({ ...ed, obs: e.target.value })} placeholder="Obs" />
                      <button className="primary" onClick={() => salvarEdicao(editando)} style={{ padding: "7px 14px", fontSize: 12 }}>Salvar</button>
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {rows.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 20, fontStyle: "italic" }}>Nenhum fornecedor cadastrado ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
