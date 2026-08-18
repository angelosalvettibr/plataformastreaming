"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

const R$ = (v) => "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const hoje = () => new Date().toISOString().slice(0, 10);
const CATS = ["Villa fixo", "Materiais e reparos", "HAION", "Angelo PJ", "Angelo PF", "Comissão Mauricio", "Impostos", "Outros"];

export default function Relatorios() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const [pags, setPags] = useState([]);
  const [contas, setContas] = useState([]);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [editando, setEditando] = useState(null);
  const [ed, setEd] = useState({});

  const carregar = useCallback(async () => {
    const { data: p } = await supabase.from("pagamentos").select("*").eq("estornado", false).order("data");
    setPags(p || []);
    const { data: c } = await supabase.from("contas").select("*").eq("mes", mes);
    setContas(c || []);
  }, [mes]);
  useEffect(() => { carregar(); }, [carregar]);

  const marcarPago = async (c) => {
    const v = prompt(`Valor pago de "${c.descricao}":`, String(c.valor_previsto));
    if (v === null) return;
    await supabase.from("contas").update({
      pago: true, pago_em: hoje(),
      valor_pago: Number(String(v).replace(/\./g, "").replace(",", ".")) || c.valor_previsto,
    }).eq("id", c.id);
    carregar();
  };
  const abrirEdicao = (c) => {
    setEditando(c.id);
    setEd({ descricao: c.descricao, categoria: c.categoria, valor_previsto: String(c.valor_previsto), vencimento: c.vencimento || "", obs: c.obs || "" });
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

  if (perfil && !["admin", "financeiro"].includes(perfil.role))
    return <div className="container muted">Sem acesso a este módulo.</div>;

  // ── 1. Previsto × Realizado do mês selecionado ──
  const pagsMes = pags.filter((r) => r.data?.slice(0, 7) === mes);
  const cats = [...new Set([...contas.map((c) => c.categoria), ...pagsMes.map((p) => p.categoria)])].sort();
  const prev = (c) => contas.filter((x) => x.categoria === c).reduce((s, x) => s + Number(x.valor_previsto), 0);
  const real = (c) => pagsMes.filter((x) => x.categoria === c).reduce((s, x) => s + Number(x.valor), 0);
  const totPrev = cats.reduce((s, c) => s + prev(c), 0);
  const totReal = cats.reduce((s, c) => s + real(c), 0);

  // ── 2. Pendentes e atrasadas ──
  const abertas = contas.filter((c) => !c.pago).sort((a, b) => (a.vencimento || "9999") < (b.vencimento || "9999") ? -1 : 1);
  const atrasadas = abertas.filter((c) => c.vencimento && c.vencimento < hoje());

  // ── 3. Histórico Caixa: mês × categoria ──
  const mesesHist = [...new Set(pags.map((r) => r.data?.slice(0, 7)))].sort().reverse();
  const catsHist = [...new Set(pags.map((r) => r.categoria))].sort();
  const cell = (m, c) => pags.filter((r) => r.data?.slice(0, 7) === m && r.categoria === c).reduce((s, r) => s + Number(r.valor), 0);

  // ── 4. Top favorecidos ──
  const porFav = {};
  pags.forEach((r) => { porFav[r.favorecido] = (porFav[r.favorecido] || 0) + Number(r.valor); });
  const topFav = Object.entries(porFav).sort((a, b) => b[1] - a[1]).slice(0, 15);

  const h3 = { fontFamily: "'Fraunces', serif", fontSize: 18, margin: "22px 0 8px" };

  return (
    <div className="container" style={{ maxWidth: 1000 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">Relatórios</h1>
      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "8px 0 4px" }}>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: 170 }} />
        {atrasadas.length > 0 && (
          <span className="badge" style={{ background: "#FBEAE4", color: "var(--neg)", borderColor: "transparent" }}>
            🔴 {atrasadas.length} conta{atrasadas.length > 1 ? "s" : ""} atrasada{atrasadas.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <h3 style={h3}>Previsto × Realizado — {mes}</h3>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data">
          <thead><tr><th>Categoria</th><th style={{ textAlign: "right" }}>Previsto (contas)</th><th style={{ textAlign: "right" }}>Pago (caixa)</th><th style={{ textAlign: "right" }}>Diferença</th></tr></thead>
          <tbody>
            {cats.map((c) => {
              const d = real(c) - prev(c);
              return (
                <tr key={c}>
                  <td>{c}</td>
                  <td className="num" style={{ textAlign: "right" }}>{prev(c) ? R$(prev(c)) : "·"}</td>
                  <td className="num" style={{ textAlign: "right" }}>{real(c) ? R$(real(c)) : "·"}</td>
                  <td className="num" style={{ textAlign: "right", color: d > 0 ? "var(--neg)" : d < 0 ? "var(--muted)" : "var(--pos)" }}>
                    {prev(c) || real(c) ? R$(d) : "·"}
                  </td>
                </tr>
              );
            })}
            <tr style={{ fontWeight: 700, background: "var(--surface2)" }}>
              <td>Total</td>
              <td className="num" style={{ textAlign: "right" }}>{R$(totPrev)}</td>
              <td className="num" style={{ textAlign: "right" }}>{R$(totReal)}</td>
              <td className="num" style={{ textAlign: "right" }}>{R$(totReal - totPrev)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        Previsto vem das Contas do Mês; Pago vem do Caixa. Registrar cada pagamento no Caixa é o que faz essa tabela contar a verdade.
      </p>

      <h3 style={h3}>Em aberto no mês ({abertas.length})</h3>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data">
          <thead><tr><th>Vencimento</th><th>Conta</th><th>Categoria</th><th style={{ textAlign: "right" }}>Valor</th><th></th></tr></thead>
          <tbody>
            {abertas.map((c) => (
              <>
              <tr key={c.id}>
                <td className="num" style={{ color: c.vencimento && c.vencimento < hoje() ? "var(--neg)" : undefined, fontWeight: c.vencimento && c.vencimento < hoje() ? 700 : 400 }}>
                  {c.vencimento ? c.vencimento.slice(8, 10) + "/" + c.vencimento.slice(5, 7) : "sem data ⚠️"}
                </td>
                <td>{c.descricao}</td>
                <td><span className="badge">{c.categoria}</span></td>
                <td className="num" style={{ textAlign: "right" }}>{R$(c.valor_previsto)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <a href="#" className="muted" style={{ fontSize: 12, marginRight: 10 }} onClick={(e) => { e.preventDefault(); editando === c.id ? setEditando(null) : abrirEdicao(c); }}>{editando === c.id ? "fechar" : "editar"}</a>
                  <a href="#" style={{ fontSize: 12, color: "var(--pos)" }} onClick={(e) => { e.preventDefault(); marcarPago(c); }}>marcar pago</a>
                </td>
              </tr>
              {editando === c.id && (
                <tr key={c.id + "-ed"}>
                  <td colSpan={5} style={{ background: "var(--surface2)", padding: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 120px 150px 1fr auto", gap: 8, alignItems: "center" }}>
                      <input value={ed.descricao} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} />
                      <select value={ed.categoria} onChange={(e) => setEd({ ...ed, categoria: e.target.value })}>{CATS.map((x) => <option key={x}>{x}</option>)}</select>
                      <input inputMode="decimal" value={ed.valor_previsto} onChange={(e) => setEd({ ...ed, valor_previsto: e.target.value })} />
                      <input type="date" value={ed.vencimento} onChange={(e) => setEd({ ...ed, vencimento: e.target.value })} />
                      <input value={ed.obs} onChange={(e) => setEd({ ...ed, obs: e.target.value })} placeholder="Obs" />
                      <button className="primary" onClick={() => salvarEdicao(c.id)} style={{ padding: "7px 14px", fontSize: 12 }}>Salvar</button>
                    </div>
                  </td>
                </tr>
              )}
              </>
            ))}
            {abertas.length === 0 && <tr><td colSpan={4} className="muted" style={{ padding: 16, fontStyle: "italic" }}>Tudo pago nesse mês. 🎉</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 style={h3}>Histórico do Caixa — mês × categoria</h3>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data">
          <thead><tr><th>Mês</th>{catsHist.map((c) => <th key={c} style={{ textAlign: "right" }}>{c}</th>)}<th style={{ textAlign: "right", color: "var(--gold)" }}>Total</th></tr></thead>
          <tbody>
            {mesesHist.map((m) => (
              <tr key={m}>
                <td>{m.slice(5)}/{m.slice(2, 4)}</td>
                {catsHist.map((c) => <td key={c} className="num" style={{ textAlign: "right" }}>{cell(m, c) ? R$(cell(m, c)) : "·"}</td>)}
                <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{R$(catsHist.reduce((s, c) => s + cell(m, c), 0))}</td>
              </tr>
            ))}
            {mesesHist.length === 0 && <tr><td colSpan={catsHist.length + 2} className="muted" style={{ padding: 16, fontStyle: "italic" }}>O histórico nasce quando os pagamentos entrarem no Caixa.</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 style={h3}>Top favorecidos (acumulado)</h3>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data">
          <thead><tr><th>#</th><th>Favorecido</th><th style={{ textAlign: "right" }}>Total pago</th></tr></thead>
          <tbody>
            {topFav.map(([f, v], i) => <tr key={f}><td className="muted">{i + 1}</td><td>{f}</td><td className="num" style={{ textAlign: "right" }}>{R$(v)}</td></tr>)}
            {topFav.length === 0 && <tr><td colSpan={3} className="muted" style={{ padding: 16, fontStyle: "italic" }}>Ainda sem pagamentos registrados.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
