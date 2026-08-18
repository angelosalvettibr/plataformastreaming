"use client";
import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

const R$ = (v) => (v < 0 ? "–" : "") + "R$ " + Math.abs(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const REGRA = [
  [/itsfw/i, "TIM Brasil"], [/banco inter sa$/i, "Villa (reserva)"], [/ar12|viagens|turismo/i, "Villa (agência)"], [/mauricio canazaro/i, "Mauricio"],
  [/angelo salvetti|genco administracao/i, "interno / mútuo"], [/banco inter s a$/i, "cartão (recarga)"], [/^light/i, "Villa · luz"], [/novo mundo/i, "Villa · condomínio"],
  [/^ceg/i, "gás"], [/jose luiz afonso/i, "Downtown aluguel"], [/denis afonso/i, "HAION reembolso"], [/haion/i, "HAION"], [/receita federal/i, "impostos"],
  [/maria roselange|uilian|daniely|kaiqui|alzenira/i, "Villa · folha"], [/william pinto|priscilla|leticia souza|edson bibiano|pluxee/i, "PJ · folha"],
  [/raissa|washington|tabatha|luiza helena|amil|gpsico|rd saude|fogo de chao|99 food|uber/i, "Angelo PF"], [/verisure|claro|starlink|telefonica/i, "serviços"],
];
const cat = (d) => (REGRA.find(([re]) => re.test(d || "")) || [null, ""])[1];

export default function Banco() { return <AuthGate>{() => <Inner />}</AuthGate>; }
function Inner() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [mes, setMes] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const carregar = async () => {
    const { data } = await supabase.from("extrato_linhas").select("*").order("data", { ascending: false }).order("saldo", { ascending: false }).limit(5000);
    setRows(data || []);
  };
  useEffect(() => { carregar(); }, []);
  const reindexar = async () => {
    setBusy(true); setMsg("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/cerebro", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ acao: "reindexar" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "erro");
      setMsg(`✓ ${(j.arquivos || []).length} arquivos lidos · ${(j.arquivos || []).reduce((a, x) => a + (x.linhas || 0), 0)} linhas`);
      await carregar();
    } catch (e) { setMsg("⚠️ " + e.message); }
    setBusy(false);
  };
  const meses = useMemo(() => [...new Set((rows || []).map((r) => r.data.slice(0, 7)))].sort().reverse(), [rows]);
  const lista = useMemo(() => (rows || []).filter((r) => (!mes || r.data.startsWith(mes)) && (tipo === "todos" || (tipo === "in" ? r.valor > 0 : r.valor < 0)) &&
    (!q || (r.descricao + " " + r.historico + " " + cat(r.descricao)).toLowerCase().includes(q.toLowerCase()))), [rows, mes, tipo, q]);
  const tIn = lista.filter((r) => r.valor > 0).reduce((a, r) => a + Number(r.valor), 0);
  const tOut = lista.filter((r) => r.valor < 0).reduce((a, r) => a + Number(r.valor), 0);
  if (!rows) return <div className="container muted">Abrindo o razão do Inter…</div>;
  return (
    <div className="container" style={{ maxWidth: 1000 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">🏦 Banco Inter — extrato completo</h1>
      <p className="muted" style={{ fontSize: 13, margin: "4px 0 12px" }}>Conta 356318354 (Genco) · todas as linhas de todos os extratos enviados · {rows.length} lançamentos{rows.length ? ` · de ${rows[rows.length - 1].data.slice(8, 10)}/${rows[rows.length - 1].data.slice(5, 7)}/${rows[rows.length - 1].data.slice(0, 4)} a ${rows[0].data.slice(8, 10)}/${rows[0].data.slice(5, 7)}/${rows[0].data.slice(0, 4)}` : ""}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar (nome, categoria)…" style={{ fontSize: 13, minWidth: 220 }} />
        <select value={mes} onChange={(e) => setMes(e.target.value)} style={{ fontSize: 13 }}><option value="">todos os meses</option>{meses.map((m) => <option key={m} value={m}>{m.slice(5)}/{m.slice(0, 4)}</option>)}</select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ fontSize: 13 }}><option value="todos">entradas e saídas</option><option value="in">só entradas</option><option value="out">só saídas</option></select>
        <span style={{ flex: 1 }} />
        <button className="ghost" disabled={busy} onClick={reindexar} style={{ padding: "6px 12px", fontSize: 12 }}>{busy ? "lendo…" : "↻ reindexar todos os extratos do cofre"}</button>
      </div>
      {msg && <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{msg}</div>}
      <div style={{ display: "flex", gap: 16, fontSize: 13, marginBottom: 8 }}>
        <span>💚 entrou <b className="num" style={{ color: "var(--pos)" }}>{R$(tIn)}</b></span>
        <span>🔴 saiu <b className="num" style={{ color: "var(--neg)" }}>{R$(tOut)}</b></span>
        <span>= <b className="num">{R$(tIn + tOut)}</b></span>
        <span className="muted">({lista.length} linhas)</span>
      </div>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data" style={{ width: "100%", fontSize: 12.5 }}>
          <thead><tr><th style={{ padding: "7px 10px" }}>Data</th><th>Descrição</th><th>Categoria</th><th style={{ textAlign: "right" }}>Valor</th><th style={{ textAlign: "right", paddingRight: 10 }}>Saldo</th></tr></thead>
          <tbody>
            {lista.slice(0, 1500).map((r) => (
              <tr key={r.id}>
                <td className="num" style={{ padding: "4px 10px", whiteSpace: "nowrap" }}>{r.data.slice(8, 10)}/{r.data.slice(5, 7)}/{r.data.slice(2, 4)}</td>
                <td>{r.descricao}<span className="muted" style={{ fontSize: 10.5 }}> · {r.historico}</span></td>
                <td className="muted" style={{ fontSize: 11.5 }}>{cat(r.descricao)}</td>
                <td className="num" style={{ textAlign: "right", fontWeight: 600, color: r.valor >= 0 ? "var(--pos)" : "var(--neg)", whiteSpace: "nowrap" }}>{R$(r.valor)}</td>
                <td className="num muted" style={{ textAlign: "right", paddingRight: 10, whiteSpace: "nowrap" }}>{r.saldo != null ? R$(r.saldo) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="muted" style={{ marginTop: 10 }}>Vazio ainda — clica em <b>↻ reindexar</b> pra ler todos os CSVs que já estão em Extratos & Faturas. Daí em diante o ▶ Rodar do Angelito alimenta sozinho.</p>}
    </div>
  );
}
