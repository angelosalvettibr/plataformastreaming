"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

const CATS = ["Villa fixo", "Materiais e reparos", "HAION", "Angelo PJ", "Angelo PF", "Comissão Mauricio", "Impostos", "Outros"];
const R$ = (v) => "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const hoje = () => new Date().toISOString().slice(0, 10);

export default function Contas() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const [rows, setRows] = useState([]);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState({ descricao: "", categoria: "Villa fixo", valor_previsto: "", vencimento: "", obs: "" });
  const [err, setErr] = useState("");
  const [editando, setEditando] = useState(null);
  const [ed, setEd] = useState({});

  const [anteriores, setAnteriores] = useState([]);
  const carregar = useCallback(async () => {
    const { data } = await supabase.from("contas").select("*").eq("mes", mes)
      .order("pago").order("vencimento", { ascending: true, nullsFirst: false });
    setRows(data || []);
    const { data: ant } = await supabase.from("contas").select("*")
      .lt("mes", mes).eq("pago", false).order("mes");
    setAnteriores(ant || []);
  }, [mes]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (e) => {
    e.preventDefault(); setErr("");
    const { error } = await supabase.from("contas").insert({
      mes, descricao: form.descricao.trim(), categoria: form.categoria,
      valor_previsto: Number(String(form.valor_previsto).replace(/\./g, "").replace(",", ".")) || 0,
      vencimento: form.vencimento || null, obs: form.obs.trim() || null,
      criado_por: session.user.email,
    });
    if (error) setErr(error.message);
    else { setForm({ descricao: "", categoria: "Villa fixo", valor_previsto: "", vencimento: "", obs: "" }); carregar(); }
  };

  const marcarPago = async (r) => {
    const v = prompt(`Valor pago de "${r.descricao}":`, String(r.valor_previsto));
    if (v === null) return;
    await supabase.from("contas").update({
      pago: true, pago_em: hoje(),
      valor_pago: Number(String(v).replace(/\./g, "").replace(",", ".")) || r.valor_previsto,
      pago_por: session.user.email,
    }).eq("id", r.id);
    carregar();
  };
  const toggleStandby = async (r) => {
    await supabase.from("contas").update({ standby: !r.standby }).eq("id", r.id);
    carregar();
  };
  const desfazer = async (id) => {
    await supabase.from("contas").update({ pago: false, pago_em: null, valor_pago: null }).eq("id", id);
    carregar();
  };
  const abrirEdicao = (r) => {
    setEditando(r.id);
    setEd({ descricao: r.descricao, categoria: r.categoria, valor_previsto: String(r.valor_previsto), vencimento: r.vencimento || "", obs: r.obs || "" });
  };
  const salvarEdicao = async (id) => {
    await supabase.from("contas").update({
      descricao: ed.descricao.trim(), categoria: ed.categoria,
      valor_previsto: Number(String(ed.valor_previsto).replace(/\./g, "").replace(",", ".")) || 0,
      vencimento: ed.vencimento || null, obs: ed.obs.trim() || null,
    }).eq("id", id);
    setEditando(null);
    carregar();
  };

  const salvarComentario = async (id, comentario) => {
    await supabase.from("contas").update({ comentario: comentario.trim() || null }).eq("id", id);
  };

  const remover = async (id) => {
    if (!confirm("Remover essa conta do mês?")) return;
    await supabase.from("contas").delete().eq("id", id);
    carregar();
  };

  if (perfil && !["admin", "financeiro"].includes(perfil.role))
    return <div className="container muted">Sem acesso a este módulo.</div>;

  const status = (r) => {
    if (r.standby) return { label: "⏸ stand-by", bg: "#EFEBE2", fg: "#8A7D63" };
    if (r.pago) return { label: "Pago " + (r.pago_em ? r.pago_em.slice(8, 10) + "/" + r.pago_em.slice(5, 7) : ""), bg: "#E7F3EC", fg: "var(--pos)" };
    if (!r.vencimento) return { label: "Sem data ⚠️", bg: "#F3E4C2", fg: "#7A5A10" };
    if (r.vencimento < hoje()) return { label: "ATRASADO", bg: "#FBEAE4", fg: "var(--neg)" };
    return { label: "Vence " + r.vencimento.slice(8, 10) + "/" + r.vencimento.slice(5, 7), bg: "var(--surface2)", fg: "var(--muted)" };
  };

  const abertas = rows.filter((r) => !r.pago);
  const totAberto = abertas.reduce((s, r) => s + Number(r.valor_previsto), 0);
  const totPago = rows.filter((r) => r.pago).reduce((s, r) => s + Number(r.valor_pago ?? r.valor_previsto), 0);
  const atrasadas = abertas.filter((r) => r.vencimento && r.vencimento < hoje());

  return (
    <div className="container" style={{ maxWidth: 980 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">Contas do Mês</h1>
      <p className="muted" style={{ fontSize: 14, margin: "4px 0 16px" }}>
        O que vence, quando, quanto — e o que já foi. Pagou? "Marcar pago" e registra no Caixa com o comprovante.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <button className="ghost" style={{ padding: "8px 12px" }} onClick={() => { const d = new Date(mes + "-15"); d.setMonth(d.getMonth() - 1); setMes(d.toISOString().slice(0, 7)); }}>◀</button>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: 170 }} />
        <button className="ghost" style={{ padding: "8px 12px" }} onClick={() => { const d = new Date(mes + "-15"); d.setMonth(d.getMonth() + 1); setMes(d.toISOString().slice(0, 7)); }}>▶</button>
        <span className="badge" style={{ background: "#FBEAE4", color: "var(--neg)", borderColor: "#EDC7BB" }}>
          {atrasadas.length} atrasada{atrasadas.length !== 1 ? "s" : ""}
        </span>
        <span className="muted" style={{ fontSize: 13 }}>em aberto: <b className="num" style={{ color: "var(--neg)" }}>{R$(totAberto)}</b></span>
        <span className="muted" style={{ fontSize: 13 }}>pago no mês: <b className="num" style={{ color: "var(--pos)" }}>{R$(totPago)}</b></span>
      </div>

      {anteriores.length > 0 && (
        <div className="card" style={{ borderLeft: "4px solid var(--neg)", marginBottom: 16, padding: 14 }}>
          <div style={{ fontWeight: 700, color: "var(--neg)", marginBottom: 8 }}>
            🔴 Pendências de competências anteriores ({anteriores.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {anteriores.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, flexWrap: "wrap" }}>
                <span className="badge">{c.mes}</span>
                <span style={{ flex: 1, fontWeight: 600 }}>{c.descricao}</span>
                <span className="num">{R$(c.valor_previsto)}</span>
                <a href="#" style={{ fontSize: 12, color: "var(--pos)" }} onClick={(e) => { e.preventDefault(); marcarPago(c); }}>marcar pago</a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
        {rows.map((r) => {
          const s = status(r);
          return (
            <div key={r.id}>
            <div className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", opacity: r.pago ? 0.72 : 1 }}>
              <span className="badge" style={{ background: s.bg, color: s.fg, borderColor: "transparent", minWidth: 92, textAlign: "center" }}>{s.label}</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 600 }}>{r.descricao}</div>
                <div className="muted" style={{ fontSize: 12 }}>{r.categoria}{r.obs ? " · " + r.obs : ""}</div>
              </div>
              <div className="num" style={{ fontWeight: 700, fontSize: 15 }}>
                {R$(r.pago ? (r.valor_pago ?? r.valor_previsto) : r.valor_previsto)}
              </div>
              {r.pago ? (
                <a href="#" className="muted" style={{ fontSize: 12 }} onClick={(e) => { e.preventDefault(); desfazer(r.id); }}>desfazer</a>
              ) : (
                <>
                  <a href="#" className="muted" style={{ fontSize: 12 }} onClick={(e) => { e.preventDefault(); editando === r.id ? setEditando(null) : abrirEdicao(r); }}>{editando === r.id ? "fechar" : "editar"}</a>
                  <a href="#" className="muted" style={{ fontSize: 12, marginRight: 8 }} title={r.standby ? "voltar pra fila de pagamento" : "tirar da fila — não pagar por ora"}
                    onClick={(e) => { e.preventDefault(); toggleStandby(r); }}>{r.standby ? "▶ reativar" : "⏸ stand-by"}</a>
                  <button className="ghost" onClick={() => marcarPago(r)} style={{ padding: "6px 12px", fontSize: 12 }}>Marcar pago</button>
                </>
              )}
              <a href="#" onClick={(e) => { e.preventDefault(); remover(r.id); }} style={{ color: "var(--neg)" }}>×</a>
              <div style={{ flexBasis: "100%", display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 13 }}>💬</span>
                <input defaultValue={r.comentario || ""} placeholder="comentário (some pro Angelo e pro Claude no briefing)"
                  onBlur={(e) => e.target.value !== (r.comentario || "") && salvarComentario(r.id, e.target.value)}
                  style={{ fontSize: 12, padding: "5px 9px", background: r.comentario ? "#FFFBF0" : "var(--surface)", flex: 1 }} />
              </div>
            </div>
            {editando === r.id && (
                <div className="card" style={{ padding: 14, display: "grid", gap: 10, background: "var(--surface2)", border: "2px solid var(--gold)", marginTop: 6 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                    <input value={ed.descricao} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} />
                    <select value={ed.categoria} onChange={(e) => setEd({ ...ed, categoria: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 1fr", gap: 10 }}>
                    <input inputMode="decimal" value={ed.valor_previsto} onChange={(e) => setEd({ ...ed, valor_previsto: e.target.value })} placeholder="Valor previsto" />
                    <input type="date" value={ed.vencimento} onChange={(e) => setEd({ ...ed, vencimento: e.target.value })} />
                    <input value={ed.obs} onChange={(e) => setEd({ ...ed, obs: e.target.value })} placeholder="Obs" />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="primary" onClick={() => salvarEdicao(editando)} style={{ padding: "8px 18px", fontSize: 13 }}>Salvar alterações</button>
                    <button className="ghost" onClick={() => setEditando(null)} style={{ padding: "8px 14px", fontSize: 12 }}>cancelar</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <div className="muted" style={{ fontStyle: "italic" }}>Nenhuma conta nesse mês.</div>}
      </div>

      <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, margin: "0 0 8px" }}>+ Nova conta</h3>
      <form onSubmit={salvar} className="card" style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <input required placeholder="Descrição (ex.: Light apto Pepe) *" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 1fr", gap: 10 }}>
          <input required placeholder="Valor previsto (R$)" inputMode="decimal" value={form.valor_previsto} onChange={(e) => setForm({ ...form, valor_previsto: e.target.value })} />
          <input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} title="Vencimento (vazio = sem data)" />
          <input placeholder="Obs" value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {err && <span style={{ color: "var(--neg)", fontSize: 13 }}>{err}</span>}
          <button className="primary" style={{ marginLeft: "auto" }}>Adicionar conta</button>
        </div>
      </form>
    </div>
  );
}
