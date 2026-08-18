"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

const CATS = ["Villa Irvana", "TIM Brasil", "Natural Talks", "HAION", "Antecipação", "Outros"];
const proxMes = (m) => { const [y, mm] = m.split("-").map(Number); return mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, "0")}`; };
const R$ = (v) => "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export default function Receitas() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const [rows, setRows] = useState([]);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState({ data: new Date().toISOString().slice(0, 10), origem: "", valor: "", categoria: "Villa Irvana", obs: "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [editando, setEditando] = useState(null);
  const [ed, setEd] = useState({});

  const carregar = useCallback(async () => {
    const ini = mes + "-01";
    const fim = proxMes(mes) + "-01";
    const { data } = await supabase.from("receitas").select("*").gte("data", ini).lt("data", fim).order("data", { ascending: false });
    setRows(data || []);
  }, [mes]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      let comprovante_url = null;
      if (file) {
        const path = `receitas/${mes}-${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("docs").upload(path, file);
        if (upErr) throw upErr;
        comprovante_url = supabase.storage.from("docs").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("receitas").insert({
        data: form.data, origem: form.origem.trim(),
        valor: Number(String(form.valor).replace(/\./g, "").replace(",", ".")),
        categoria: form.categoria, obs: form.obs.trim() || null, comprovante_url,
        criado_por: session.user.email,
      });
      if (error) throw error;
      setForm({ ...form, origem: "", valor: "", obs: "" }); setFile(null);
      await carregar();
    } catch (e2) { setErr(e2.message || "Erro"); }
    setBusy(false);
  };

  const abrirEdicao = (r) => {
    setEditando(r.id);
    setEd({ data: r.data, origem: r.origem, valor: String(r.valor), categoria: r.categoria, obs: r.obs || "" });
  };
  const salvarEdicao = async (id) => {
    const { error } = await supabase.from("receitas").update({
      data: ed.data, origem: ed.origem.trim(), categoria: ed.categoria,
      valor: Number(String(ed.valor).replace(/\./g, "").replace(",", ".")) || 0,
      obs: ed.obs.trim() || null,
    }).eq("id", id);
    if (error) alert("Erro: " + error.message);
    setEditando(null);
    carregar();
  };

  const anexarComprovante = async (id, file) => {
    if (!file) return;
    const path = `comprovantes/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("docs").upload(path, file);
    if (upErr) { alert("Erro no upload: " + upErr.message); return; }
    const url = supabase.storage.from("docs").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("receitas").update({ comprovante_url: url }).eq("id", id);
    if (error) { alert("Erro: " + error.message); return; }
    carregar();
  };

  const remover = async (id) => {
    if (!confirm("Remover essa receita?")) return;
    await supabase.from("receitas").delete().eq("id", id);
    carregar();
  };

  if (perfil && !["admin", "financeiro"].includes(perfil.role))
    return <div className="container muted">Sem acesso a este módulo.</div>;

  const hojeISO = new Date().toISOString().slice(0, 10);
  const total = rows.reduce((s, r) => s + Number(r.valor), 0);
  const totalRecebido = rows.filter((r) => r.confirmada).reduce((s, r) => s + Number(r.valor), 0);
  const confirmar = async (id) => { await supabase.from("receitas").update({ confirmada: true }).eq("id", id); carregar(); };
  const totalPrevisto = total - totalRecebido;
  const porCat = CATS.map((c) => [c, rows.filter((r) => r.categoria === c).reduce((s, r) => s + Number(r.valor), 0)]).filter(([, v]) => v > 0);

  return (
    <div className="container" style={{ maxWidth: 980 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">Receitas</h1>
      <p className="muted" style={{ fontSize: 14, margin: "4px 0 20px" }}>
        Tudo que entra: reservas da Villa, TIM, Natural Talks. Com comprovante quando houver.
      </p>

      <form onSubmit={salvar} className="card" style={{ display: "grid", gap: 10, marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 150px", gap: 10 }}>
          <input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          <input required placeholder="Origem (ex.: Reserva Villa — hóspede X, ITSFW/TIM...)" value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} />
          <input required placeholder="Valor (R$)" inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr auto", gap: 10, alignItems: "center" }}>
          <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
          <input placeholder="Observação (opcional)" value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} />
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ width: 200, fontSize: 12 }} />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {err && <span style={{ color: "var(--neg)", fontSize: 13 }}>{err}</span>}
          <button className="primary" disabled={busy} style={{ marginLeft: "auto" }}>{busy ? "Salvando…" : "Registrar receita"}</button>
        </div>
      </form>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: 170 }} />
        <span className="muted" style={{ fontSize: 13 }}>{rows.length} entradas ·</span>
        <span>
          <b className="num" style={{ color: "var(--pos)", fontSize: 16 }}>{R$(totalRecebido)}</b>
          {totalPrevisto > 0 && <span className="num muted" style={{ fontSize: 13, marginLeft: 10 }}>+ 🔮 {R$(totalPrevisto)} a confirmar = <b>{R$(total)}</b></span>}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>{porCat.map(([c, v]) => `${c}: ${R$(v)}`).join(" · ")}</span>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data">
          <thead><tr><th>Data</th><th>Origem</th><th style={{ textAlign: "right" }}>Valor</th><th>Categoria</th><th>Obs</th><th>💬</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={!r.confirmada ? { background: "#F6F1FB" } : undefined}>
                <td className="num" style={{ whiteSpace: "nowrap" }}>{r.data?.slice(8, 10)}/{r.data?.slice(5, 7)}
                  {r.confirmada
                    ? <span title="caiu de verdade (confirmada/extrato)" style={{ marginLeft: 4, color: "var(--pos)" }}>✓</span>
                    : r.data <= hojeISO
                      ? <a href="#" title="data passou — caiu? clica pra confirmar" style={{ marginLeft: 4 }} onClick={(e) => { e.preventDefault(); confirmar(r.id); }}>⚠️</a>
                      : <span title="prevista — confirma quando cair" style={{ marginLeft: 4 }}>🔮</span>}
                  {!r.confirmada && <a href="#" className="muted" style={{ marginLeft: 6, fontSize: 10.5 }} onClick={(e) => { e.preventDefault(); confirmar(r.id); }}>caiu✓</a>}
                </td>
                <td>{r.origem} {r.comprovante_url
                    ? <a href={r.comprovante_url} target="_blank" rel="noreferrer">📎</a>
                    : (r.obs === "via conciliação" || r.criado_por === "extrato-import") ? null : <label title="Sem comprovante — clica pra anexar" style={{ cursor: "pointer", color: "var(--neg)", fontSize: 11, border: "1px dashed var(--neg)", borderRadius: 6, padding: "1px 6px", marginLeft: 4, whiteSpace: "nowrap" }}>
                        sem 📎 <input type="file" style={{ display: "none" }} onChange={(e) => anexarComprovante(r.id, e.target.files?.[0])} />
                      </label>}</td>
                <td className="num" style={{ textAlign: "right", color: "var(--pos)", fontWeight: 600 }}>{R$(r.valor)}</td>
                <td><span className="badge">{r.categoria}</span></td>
                <td className="muted" style={{ fontSize: 12, maxWidth: 200 }}>{r.obs}</td>
                <td><input defaultValue={r.comentario || ""} placeholder="💬" title="Comentário — explica o porquê (vai pro briefing)"
                    onBlur={(e) => e.target.value !== (r.comentario || "") && supabase.from("receitas").update({ comentario: e.target.value.trim() || null }).eq("id", r.id)}
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
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 130px 180px 1fr auto", gap: 8, alignItems: "center" }}>
                    <input type="date" value={ed.data} onChange={(e) => setEd({ ...ed, data: e.target.value })} />
                    <input value={ed.origem} onChange={(e) => setEd({ ...ed, origem: e.target.value })} />
                    <input inputMode="decimal" value={ed.valor} onChange={(e) => setEd({ ...ed, valor: e.target.value })} style={{ textAlign: "right" }} />
                    <select value={ed.categoria} onChange={(e) => setEd({ ...ed, categoria: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
                    <input value={ed.obs} onChange={(e) => setEd({ ...ed, obs: e.target.value })} placeholder="Obs" />
                    <button className="primary" onClick={() => salvarEdicao(editando)} style={{ padding: "7px 14px", fontSize: 12 }}>Salvar</button>
                  </div>
                </td>
              </tr>
            )}
            {rows.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 20, fontStyle: "italic" }}>Nenhuma receita nesse mês ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
