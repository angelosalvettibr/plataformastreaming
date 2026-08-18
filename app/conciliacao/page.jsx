"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

const proxMes = (m) => { const [y, mm] = m.split("-").map(Number); return mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, "0")}`; };
const R$ = (v) => "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const CATS_OUT = ["Villa fixo", "Materiais e reparos", "HAION", "Angelo PJ", "Angelo PF", "Comissão Mauricio", "Impostos", "Outros"];
const CATS_IN = ["Villa Irvana", "TIM Brasil", "Natural Talks", "HAION", "Antecipação", "Outros"];

function chuteSaida(desc) {
  const n = (desc || "").toUpperCase();
  const regras = [
    ["Comissão Mauricio", ["MAURICIO CANAZARO"]],
    ["Angelo PJ", ["EDSON BIBIANO", "JOSE LUIZ", "LETICIA SOUZA", "WILLIAM PINTO", "PRISCILLA", "PLUXEE"]],
    ["Villa fixo", ["UILIAN", "ROSELANGE", "LIGHT", "STARLINK", "VERISURE", "NOVO MUNDO", "BRADESCO", "AGUAS", "CLARO", "KAIQUI", "ALZENIRA", "SEGURO"]],
    ["Impostos", ["RECEITA FEDERAL", "DARF", "GRERJ", "IPTU"]],
    ["HAION", ["HAION", "WOOBA", "DENIS AFONSO"]],
    ["Materiais e reparos", ["MATERIAL", "TINTAS", "OBRA", "REFRIGERACAO", "DESENTUPIDORA", "CONSTRUCOES"]],
    ["Angelo PF", ["BANCO INTER", "LUCIANA", "GPSICOTERAPIA", "CEG", "AMIL", "RAISSA", "DANIELY", "TABATHA", "GIULIA", "MELYSSA", "LUIZA HELENA"]],
  ];
  for (const [c, keys] of regras) if (keys.some((k) => n.includes(k))) return c;
  return "Outros";
}
function chuteEntrada(desc) {
  const n = (desc || "").toUpperCase();
  if (n.includes("ITSFW") || n.includes("TIM")) return "TIM Brasil";
  if (n.includes("NATURAL") || n.includes("NTALKS")) return "Natural Talks";
  if (n.includes("HAION") || n.includes("WOOBA")) return "HAION";
  if (n.includes("INTER") || n.includes("AIRBNB") || n.includes("BOOKING")) return "Villa Irvana";
  return "Villa Irvana";
}

export default function Conciliacao() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const [extratos, setExtratos] = useState([]);
  const [extratoId, setExtratoId] = useState("");
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [resultado, setResultado] = useState(null);
  const [rodando, setRodando] = useState(false);
  const [err, setErr] = useState("");
  const [cats, setCats] = useState({}); // categoria escolhida por linha (chave data|valor|desc)
  const [verCasadas, setVerCasadas] = useState(false);
  const [motivos, setMotivos] = useState({});

  useEffect(() => {
    supabase.from("extratos").select("*").ilike("nome_arquivo", "%.csv").order("created_at", { ascending: false })
      .then(({ data }) => { setExtratos(data || []); if (data?.[0]) setExtratoId(data[0].id); });
  }, []);

  const conciliar = useCallback(async () => {
    setErr(""); setRodando(true); setResultado(null);
    try {
      const ext = extratos.find((e) => e.id === extratoId);
      if (!ext) throw new Error("Escolhe um extrato CSV arquivado.");
      const resp = await fetch(ext.arquivo_url);
      const texto = await resp.text();
      const linhas = texto.split(/\r?\n/);
      const hi = linhas.findIndex((l) => l.startsWith("Data Lançamento"));
      if (hi < 0) throw new Error("CSV não reconhecido (esperado formato Inter).");
      const movs = [];
      for (const l of linhas.slice(hi + 1)) {
        const p = l.split(";");
        if (p.length < 4 || !p[0].trim()) continue;
        const [dd, mm, yyyy] = p[0].trim().split("/");
        const iso = `${yyyy}-${mm}-${dd}`;
        if (iso.slice(0, 7) !== mes) continue;
        const valor = parseFloat(p[3].replace(/\./g, "").replace(",", "."));
        if (!valor) continue;
        movs.push({ data: iso, desc: (p[2] || p[1] || "").trim(), valor });
      }
      const ini = mes + "-01";
      const fim = proxMes(mes) + "-01";
      const { data: pags } = await supabase.from("pagamentos").select("*").eq("estornado", false).gte("data", ini).lt("data", fim);
      const { data: recs } = await supabase.from("receitas").select("*").gte("data", ini).lt("data", fim);
      const { data: igns } = await supabase.from("conciliacao_ignorados").select("*").gte("data", ini).lt("data", fim);
      const ignorado = (tipo, m) => (igns || []).some((i) => i.tipo === tipo && i.data === m.data && Math.abs(Number(i.valor) - Math.abs(m.valor)) < 0.01 && i.descricao === (m.desc || ""));

      const usadosP = new Set(), usadosR = new Set();
      const perto = (a, b) => Math.abs(new Date(a) - new Date(b)) <= 3 * 86400000;
      const soSaidas = movs.filter((m) => m.valor < 0);
      const soEntradas = movs.filter((m) => m.valor > 0);

      let nIgnorados = 0;
      const casadasS = [], casadasE = [];
      const faltamCaixa = [];
      for (const m of soSaidas) {
        const hit = (pags || []).find((p) => !usadosP.has(p.id) && Math.abs(Number(p.valor) - (-m.valor)) < 0.01 && perto(p.data, m.data));
        if (hit) { usadosP.add(hit.id); casadasS.push({ m, reg: hit }); continue; }
        if (ignorado("saida", m)) { nIgnorados++; continue; }
        faltamCaixa.push(m);
      }
      const faltamReceitas = [];
      for (const m of soEntradas) {
        const hit = (recs || []).find((r) => !usadosR.has(r.id) && Math.abs(Number(r.valor) - m.valor) < 0.01 && perto(r.data, m.data));
        if (hit) { usadosR.add(hit.id); casadasE.push({ m, reg: hit }); continue; }
        if (ignorado("entrada", m)) { nIgnorados++; continue; }
        faltamReceitas.push(m);
      }
      const sobraCaixa = (pags || []).filter((p) => !usadosP.has(p.id));
      const sobraReceitas = (recs || []).filter((r) => !usadosR.has(r.id) && r.confirmada);
      const previstasAguardando = (recs || []).filter((r) => !usadosR.has(r.id) && !r.confirmada);

      setResultado({
        totalMov: movs.length,
        okSaidas: soSaidas.length - faltamCaixa.length, faltamCaixa,
        okEntradas: soEntradas.length - faltamReceitas.length, faltamReceitas,
        sobraCaixa, sobraReceitas, previstasAguardando, nIgnorados, casadasS, casadasE,
      });
    } catch (e2) { setErr(e2.message || "Erro na conciliação"); }
    setRodando(false);
  }, [extratos, extratoId, mes]);

  const chave = (m) => `${m.data}|${m.valor}|${m.desc}`;
  const lancarSaida = async (m) => {
    setErr("");
    const cat = cats[chave(m)] || chuteSaida(m.desc);
    const { error } = await supabase.from("pagamentos").insert({
      data: m.data, favorecido: m.desc || "Não identificado", valor: -m.valor,
      categoria: cat, obs: "via conciliação", criado_por: session.user.email,
    });
    if (error) { setErr(`Não gravou "${m.desc}": ${error.message}`); alert("Erro ao lançar: " + error.message); return; }
    setResultado((r) => r && ({ ...r, okSaidas: r.okSaidas + 1, faltamCaixa: r.faltamCaixa.filter((x) => chave(x) !== chave(m)).concat(r.faltamCaixa.filter((x) => chave(x) === chave(m)).slice(1)) }));
  };
  const lancarEntrada = async (m) => {
    setErr("");
    const cat = cats[chave(m)] || chuteEntrada(m.desc);
    const { error } = await supabase.from("receitas").insert({ confirmada: true,
      data: m.data, origem: m.desc || "Não identificado", valor: m.valor,
      categoria: cat, obs: "via conciliação", criado_por: session.user.email,
    });
    if (error) { setErr(`Não gravou "${m.desc}": ${error.message}`); alert("Erro ao lançar: " + error.message); return; }
    setResultado((r) => r && ({ ...r, okEntradas: r.okEntradas + 1, faltamReceitas: r.faltamReceitas.filter((x) => chave(x) !== chave(m)).concat(r.faltamReceitas.filter((x) => chave(x) === chave(m)).slice(1)) }));
  };

  const ignorarSaida = async (m) => {
    const { error } = await supabase.from("conciliacao_ignorados").insert({
      tipo: "saida", data: m.data, valor: -m.valor, descricao: m.desc || "", comentario: motivos[chave(m)] || null, criado_por: session.user.email,
    });
    if (error && !error.message.includes("duplicate")) { alert("Erro: " + error.message); return; }
    setResultado((r) => r && ({ ...r, nIgnorados: (r.nIgnorados || 0) + 1, faltamCaixa: r.faltamCaixa.filter((x) => chave(x) !== chave(m)).concat(r.faltamCaixa.filter((x) => chave(x) === chave(m)).slice(1)) }));
  };
  const ignorarEntrada = async (m) => {
    const { error } = await supabase.from("conciliacao_ignorados").insert({
      tipo: "entrada", data: m.data, valor: m.valor, descricao: m.desc || "", comentario: motivos[chave(m)] || null, criado_por: session.user.email,
    });
    if (error && !error.message.includes("duplicate")) { alert("Erro: " + error.message); return; }
    setResultado((r) => r && ({ ...r, nIgnorados: (r.nIgnorados || 0) + 1, faltamReceitas: r.faltamReceitas.filter((x) => chave(x) !== chave(m)).concat(r.faltamReceitas.filter((x) => chave(x) === chave(m)).slice(1)) }));
  };

  if (perfil && !["admin", "financeiro"].includes(perfil.role))
    return <div className="container muted">Sem acesso a este módulo.</div>;

  const h3 = { fontFamily: "'Fraunces', serif", fontSize: 17, margin: "18px 0 8px" };

  return (
    <div className="container" style={{ maxWidth: 980 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">Conciliação</h1>
      <p className="muted" style={{ fontSize: 14, margin: "4px 0 16px" }}>
        O extrato do banco contra o que foi registrado. O que o banco viu e o sistema não tem, aparece aqui — com botão pra lançar na hora.
      </p>

      <div className="card" style={{ display: "grid", gap: 10, marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 140px", gap: 10, alignItems: "center" }}>
          <select value={extratoId} onChange={(e) => setExtratoId(e.target.value)}>
            {extratos.length === 0 && <option value="">— nenhum CSV arquivado ainda —</option>}
            {extratos.map((e) => <option key={e.id} value={e.id}>[{e.mes}] {e.nome_arquivo}</option>)}
          </select>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          <button className="primary" onClick={conciliar} disabled={rodando || !extratoId}>{rodando ? "Conferindo…" : "Conciliar"}</button>
        </div>
        {err && <span style={{ color: "var(--neg)", fontSize: 13 }}>{err}</span>}
        <span className="muted" style={{ fontSize: 12 }}>Usa o CSV do extrato arquivado em Extratos & Faturas. Casa por valor exato + data (±3 dias).</span>
      </div>

      {resultado && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 6 }}>
            <div className="card" style={{ borderTop: "4px solid var(--pos)" }}>
              <div className="muted" style={{ fontSize: 12 }}>Saídas casadas</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: "var(--pos)" }}>{resultado.okSaidas}</div>
            </div>
            <div className="card" style={{ borderTop: `4px solid ${resultado.faltamCaixa.length ? "var(--neg)" : "var(--pos)"}` }}>
              <div className="muted" style={{ fontSize: 12 }}>Saídas fora do Caixa</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: resultado.faltamCaixa.length ? "var(--neg)" : "var(--pos)" }}>{resultado.faltamCaixa.length}</div>
            </div>
            <div className="card" style={{ borderTop: "4px solid var(--pos)" }}>
              <div className="muted" style={{ fontSize: 12 }}>Entradas casadas</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: "var(--pos)" }}>{resultado.okEntradas}</div>
            </div>
            <div className="card" style={{ borderTop: `4px solid ${resultado.faltamReceitas.length ? "#B8860B" : "var(--pos)"}` }}>
              <div className="muted" style={{ fontSize: 12 }}>Entradas fora de Receitas</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: resultado.faltamReceitas.length ? "#B8860B" : "var(--pos)" }}>{resultado.faltamReceitas.length}</div>
            </div>
          </div>

          {resultado.faltamCaixa.length > 0 && (
            <>
              <h3 style={h3}>🔴 No banco, mas não no Caixa ({resultado.faltamCaixa.length})</h3>
              <div className="card" style={{ padding: 0, overflowX: "auto" }}>
                <table className="data"><tbody>
                  {resultado.faltamCaixa.map((m, i) => (
                    <tr key={i}>
                      <td className="num">{m.data.slice(8, 10)}/{m.data.slice(5, 7)}</td>
                      <td>{m.desc}</td>
                      <td className="num" style={{ textAlign: "right", color: "var(--neg)" }}>{R$(-m.valor)}</td>
                      <td>
                        <select value={cats[chave(m)] || chuteSaida(m.desc)} onChange={(e) => setCats({ ...cats, [chave(m)]: e.target.value })}
                          style={{ padding: "4px 8px", fontSize: 12, width: "auto" }}>
                          {CATS_OUT.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="ghost" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => lancarSaida(m)}>+ lançar</button>
                        <input value={motivos[chave(m)] || ""} onChange={(e) => setMotivos({ ...motivos, [chave(m)]: e.target.value })} placeholder="💬 motivo" style={{ fontSize: 11, padding: "3px 6px", width: 90, marginLeft: 8, marginRight: 6 }} />
                        <a href="#" className="muted" style={{ fontSize: 12, marginLeft: 8 }} onClick={(e) => { e.preventDefault(); ignorarSaida(m); }} title="Não é pra lançar — nunca mais mostrar">ignorar</a>
                      </td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            </>
          )}

          {resultado.faltamReceitas.length > 0 && (
            <>
              <h3 style={h3}>🟡 No banco, mas não em Receitas ({resultado.faltamReceitas.length})</h3>
              <div className="card" style={{ padding: 0, overflowX: "auto" }}>
                <table className="data"><tbody>
                  {resultado.faltamReceitas.map((m, i) => (
                    <tr key={i}>
                      <td className="num">{m.data.slice(8, 10)}/{m.data.slice(5, 7)}</td>
                      <td>{m.desc}</td>
                      <td className="num" style={{ textAlign: "right", color: "var(--pos)" }}>{R$(m.valor)}</td>
                      <td>
                        <select value={cats[chave(m)] || chuteEntrada(m.desc)} onChange={(e) => setCats({ ...cats, [chave(m)]: e.target.value })}
                          style={{ padding: "4px 8px", fontSize: 12, width: "auto" }}>
                          {CATS_IN.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="ghost" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => lancarEntrada(m)}>+ lançar</button>
                        <input value={motivos[chave(m)] || ""} onChange={(e) => setMotivos({ ...motivos, [chave(m)]: e.target.value })} placeholder="💬 motivo" style={{ fontSize: 11, padding: "3px 6px", width: 90, marginLeft: 8, marginRight: 6 }} />
                        <a href="#" className="muted" style={{ fontSize: 12, marginLeft: 8 }} onClick={(e) => { e.preventDefault(); ignorarEntrada(m); }} title="Não é pra lançar — nunca mais mostrar">ignorar</a>
                      </td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            </>
          )}

          {(resultado.previstasAguardando || []).length > 0 && (
            <>
              <h3 style={h3}>🔮 Previstas aguardando cair (tudo certo — ainda não é divergência)</h3>
              <div className="card" style={{ padding: 0 }}>
                <table className="data"><tbody>
                  {resultado.previstasAguardando.map((r) => (
                    <tr key={r.id} style={{ background: "#F6F1FB" }}>
                      <td className="num">{r.data?.slice(8, 10)}/{r.data?.slice(5, 7)}</td><td>{r.origem}</td>
                      <td className="num" style={{ textAlign: "right", color: "#6B4FA0", fontWeight: 600 }}>{R$(r.valor)}</td>
                      <td className="muted" style={{ fontSize: 12 }}>quando cair: aparece no próximo extrato e casa sozinha</td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            </>
          )}

          {(resultado.sobraCaixa.length > 0 || resultado.sobraReceitas.length > 0) && (
            <>
              <h3 style={h3}>⚠️ Registrado no sistema, mas não achado no extrato</h3>
              <div className="card" style={{ padding: 0, overflowX: "auto" }}>
                <table className="data"><tbody>
                  {resultado.sobraCaixa.map((p) => (
                    <tr key={p.id}><td className="num">{p.data?.slice(8, 10)}/{p.data?.slice(5, 7)}</td><td>{p.favorecido}</td>
                    <td className="num" style={{ textAlign: "right" }}>{R$(p.valor)}</td><td className="muted" style={{ fontSize: 12 }}>saída (checar: pago por outra conta? duplicado?)</td></tr>
                  ))}
                  {resultado.sobraReceitas.map((r) => (
                    <tr key={r.id}><td className="num">{r.data?.slice(8, 10)}/{r.data?.slice(5, 7)}</td><td>{r.origem}</td>
                    <td className="num" style={{ textAlign: "right", color: "var(--pos)" }}>{R$(r.valor)}</td><td className="muted" style={{ fontSize: 12 }}>entrada (caiu em outra conta?)</td></tr>
                  ))}
                </tbody></table>
              </div>
            </>
          )}

          {(resultado.casadasS?.length > 0 || resultado.casadasE?.length > 0) && (
            <>
              <h3 style={{ ...h3, cursor: "pointer" }} onClick={() => setVerCasadas(!verCasadas)}>
                ✅ Casadas — extrato ↔ sistema ({(resultado.casadasS?.length || 0) + (resultado.casadasE?.length || 0)}) <span className="muted" style={{ fontSize: 13 }}>{verCasadas ? "▲ esconder" : "▼ mostrar"}</span>
              </h3>
              {verCasadas && (
                <div className="card" style={{ padding: 0, overflowX: "auto" }}>
                  <table className="data">
                    <thead><tr><th>Data</th><th>No extrato (banco)</th><th style={{ textAlign: "right" }}>Valor</th><th>No sistema (registro)</th><th>Origem</th></tr></thead>
                    <tbody>
                      {resultado.casadasS.map(({ m, reg }, i) => (
                        <tr key={"s" + i}>
                          <td className="num">{m.data.slice(8, 10)}/{m.data.slice(5, 7)}</td>
                          <td className="muted" style={{ fontSize: 12 }}>{m.desc}</td>
                          <td className="num" style={{ textAlign: "right", color: "var(--neg)" }}>{R$(-m.valor)}</td>
                          <td>{reg.favorecido} <span className="badge">{reg.categoria}</span></td>
                          <td className="muted" style={{ fontSize: 11 }}>{reg.criado_por?.split("@")[0]}</td>
                        </tr>
                      ))}
                      {resultado.casadasE.map(({ m, reg }, i) => (
                        <tr key={"e" + i}>
                          <td className="num">{m.data.slice(8, 10)}/{m.data.slice(5, 7)}</td>
                          <td className="muted" style={{ fontSize: 12 }}>{m.desc}</td>
                          <td className="num" style={{ textAlign: "right", color: "var(--pos)" }}>{R$(m.valor)}</td>
                          <td>{reg.origem} <span className="badge">{reg.categoria}</span></td>
                          <td className="muted" style={{ fontSize: 11 }}>{reg.criado_por?.split("@")[0]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {(resultado.nIgnorados || 0) > 0 && (
            <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
              {resultado.nIgnorados} linha{resultado.nIgnorados > 1 ? "s" : ""} ignorada{resultado.nIgnorados > 1 ? "s" : ""} (memória permanente — não voltam mais).
            </p>
          )}

          {resultado.faltamCaixa.length === 0 && resultado.faltamReceitas.length === 0 && resultado.sobraCaixa.length === 0 && resultado.sobraReceitas.length === 0 && (
            <div className="card" style={{ borderTop: "4px solid var(--pos)", textAlign: "center", padding: 24 }}>
              🎉 <b>Conciliação perfeita:</b> banco e sistema contam a mesma história em {mes}.
            </div>
          )}
        </>
      )}
    </div>
  );
}
