"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";
import Consigliere from "@/components/Consigliere";
import { agoraBR, hojeISO } from "@/lib/hoje";

const R$ = (v) => "R$ " + Math.round(Number(v) || 0).toLocaleString("pt-BR");
const MESES_N = ["", "Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function Mes() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const hoje = hojeISO();
  const mesAtual = hoje.slice(0, 7);
  const [mes, setMes] = useState(mesAtual);
  const proximos = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
    const d = new Date(mesAtual + "-15"); d.setMonth(d.getMonth() + i);
    return d.toISOString().slice(0, 7);
  });
  const ehAtual = mes === mesAtual;
  const [recs, setRecs] = useState([]);
  const [pagou, setPagou] = useState(0);
  const [contas, setContas] = useState([]);
  const [saldo, setSaldo] = useState(0);
  const [saldoData, setSaldoData] = useState(null);
  const [pronto, setPronto] = useState(false);

  const carregar = useCallback(async () => {
    const ini = mes + "-01", fim = mes + "-31";
    const [{ data: r }, { data: p }, { data: c }, { data: m }] = await Promise.all([
      supabase.from("receitas").select("*").gte("data", ini).lte("data", fim).order("data"),
      supabase.from("pagamentos").select("valor").eq("estornado", false).gte("data", ini).lte("data", fim),
      supabase.from("contas").select("*").eq("mes", mes).eq("pago", false).order("vencimento", { ascending: true, nullsFirst: false }),
      supabase.from("cockpit_config").select("*").eq("chave", "meta").maybeSingle(),
    ]);
    setRecs(r || []);
    setPagou((p || []).reduce((a, x) => a + Number(x.valor), 0));
    setContas(c || []);
    setSaldo(m?.valor?.saldoInicial ?? 0);
    setSaldoData(m?.valor?.saldoData || null);
    setPronto(true);
  }, [mes]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvarConta = async (id, campo, raw) => {
    let v = raw;
    if (campo === "valor_previsto") v = Number(String(raw).replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
    if (campo === "vencimento" && !raw) v = null;
    await supabase.from("contas").update({ [campo]: v }).eq("id", id);
    carregar();
  };
  const toggleStandby = async (ct) => {
    await supabase.from("contas").update({ standby: !ct.standby }).eq("id", ct.id);
    carregar();
  };
  const salvarSaldo = async (raw) => {
    const v = Number(String(raw).replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
    setSaldo(v);
    const { data: m } = await supabase.from("cockpit_config").select("*").eq("chave", "meta").maybeSingle();
    await supabase.from("cockpit_config").upsert({ chave: "meta", valor: { ...(m?.valor || {}), saldoInicial: v } });
  };

  if (perfil && !["admin", "financeiro"].includes(perfil.role)) return <div className="container muted">Sem acesso a esta página.</div>;
  const podeEditar = !perfil || perfil.role === "admin";
  if (!pronto) return <div className="container muted">Carregando o mês…</div>;

  const caidas = recs.filter((r) => r.confirmada);
  const previstas = recs.filter((r) => !r.confirmada);
  const entrou = caidas.reduce((a, r) => a + Number(r.valor), 0);
  const vem = previstas.reduce((a, r) => a + Number(r.valor), 0);
  const vivas = contas.filter((c) => !c.standby);
  const emStandby = contas.filter((c) => c.standby);
  const abre = vivas.reduce((a, c) => a + Number(c.valor_previsto), 0);
  const totSb = emStandby.reduce((a, c) => a + Number(c.valor_previsto), 0);
  const saldoBase = ehAtual ? saldo : 0;
  const gap = abre - vem - saldoBase;

  // ═══ O FILME: eventos futuros em ordem de data, saldo correndo ═══
  const eventos = [
    ...previstas.map((r) => ({ d: r.data, nome: r.origem + (r.data <= hoje ? " ⚠️" : ""), v: Number(r.valor), tipo: "+" })),
    ...vivas.filter((c) => c.vencimento).map((c) => ({ d: c.vencimento, nome: c.descricao, v: -Number(c.valor_previsto), tipo: "-", venc: c.vencimento < hoje })),
  ].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : b.v - a.v));
  const semData = vivas.filter((c) => !c.vencimento);
  let run = saldoBase;
  const filme = eventos.map((e) => { run += e.v; return { ...e, saldo: run }; });

  const box = (t, v, cor, sub) => (
    <div className="card" style={{ borderTop: `4px solid ${cor}`, textAlign: "center", flex: "1 1 150px", minWidth: 150 }}>
      <div className="muted" style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase" }}>{t}</div>
      <div className="num" style={{ fontSize: 21, fontWeight: 800, color: cor }}>{v}</div>
      {sub && <div className="muted" style={{ fontSize: 10.5 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <a href="/cockpit" className="muted" style={{ fontSize: 13 }}>← cockpit</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">{ehAtual ? "⏳ " : "🔭 "}{MESES_N[+mes.slice(5)]} — sala de comando</h1>
      <p className="muted" style={{ fontSize: 13, margin: "4px 0 10px" }}>
        {ehAtual ? `${hoje.slice(8, 10)}/${hoje.slice(5, 7)}/${hoje.slice(0, 4)} · ${agoraBR().hora} (Brasília) · tudo aqui grava no banco — Cockpit, Contas e Villa refletem na hora.` : "Mês futuro — entradas declaradas + contas já cadastradas (custos-modelo vivem no Cockpit)."}
      </p>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {proximos.map((m) => (
          <button key={m} className={m === mes ? "primary" : "ghost"} onClick={() => setMes(m)}
            style={{ padding: "6px 14px", fontSize: 12.5 }}>
            {m === mesAtual ? "⏳ " : ""}{MESES_N[+m.slice(5)].slice(0, 3)}/{m.slice(2, 4)}
          </button>
        ))}
      </div>

      <Consigliere compacto={!podeEditar} />
      {/* ═══ AS 5 RÉGUAS ═══ */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        {box("💚 Já entrou", R$(entrou), "var(--pos)")}
        {box("🔮 Ainda entra", R$(vem), "#8A6FB8", `${previstas.length} previstas`)}
        {box("✓ Já paguei", R$(pagou), "#B5533C")}
        {box("○ Falta pagar", R$(abre), "var(--neg)", `${vivas.length} contas vivas`)}
        {emStandby.length > 0 && box("⏸ Em espera", R$(totSb), "#8A7D63", `${emStandby.length} fora dos totais`)}
      </div>
      <div className="card" style={{ background: gap > 0 ? "#FBF0EC" : "#EAF3EC", border: `2px solid ${gap > 0 ? "var(--neg)" : "var(--pos)"}`, padding: "12px 18px", marginBottom: 20, textAlign: "center" }}>
        <span style={{ fontSize: 14 }}>
          {ehAtual ? <>Saldo em conta{saldoData ? <span className="muted" style={{ fontSize: 11 }}> (extrato até {saldoData.slice(8, 10)}/{saldoData.slice(5, 7)}{saldoData < hoje ? " ⚠️ pode ter mudado" : ""})</span> : ""}:</> : "Fluxo do mês (sem saldo de partida):"} {ehAtual && <input className="num" key={"s" + saldo} defaultValue={saldo.toLocaleString("pt-BR")} onBlur={(e) => podeEditar && salvarSaldo(e.target.value)} readOnly={!podeEditar}
            style={{ width: 90, textAlign: "right", padding: "3px 6px", fontSize: 13, background: "#FFFBF0", borderColor: "#E4CE9B" }} />}
          {" "}{ehAtual ? "+" : ""} o que vem ({R$(vem)}) − contas vivas ({R$(abre)}) ={" "}
          <b className="num" style={{ fontSize: 18, color: gap > 0 ? "var(--neg)" : "var(--pos)" }}>
            {gap > 0 ? `faltam ${R$(gap)}` : `sobra ${R$(-gap)}`}
          </b>
        </span>
        {gap > 0 && <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>é o que precisa aparecer (venda nova, aporte, remarcação) pra fechar o mês sem atrasar nada vivo{totSb > 0 && <> · <b>⏸ {R$(totSb)} em espera FORA dessa conta</b> — reativando tudo, o buraco vira {R$(gap + totSb)}</>}</div>}
      </div>

      {/* ═══ O FILME DO MÊS ═══ */}
      {/* ═══ 🎯 SUGESTÃO DE PAGAMENTO ═══ */}
      {ehAtual && vivas.length > 0 && (() => {
        const prio = (c) => {
          const n = (c.descricao || "").toLowerCase();
          if (c.vencimento && c.vencimento < hoje) return 0;
          if (/light|luz|água|agua|gás|gas|verisure|claro|internet|starlink|vivo|tim /.test(n)) return 1;
          if (/salário|salario|folha|rescis|pluxee|complemento|extra|diarista|faxina/.test(n)) return 2;
          if (/amil|seguro|psic|médic|medic|escola/.test(n)) return 3;
          if (/bradesco|financiamento|banco/.test(n)) return 5;
          return 4;
        };
        const ord = [...vivas].sort((a, b) => prio(a) - prio(b) || (a.vencimento || "9").localeCompare(b.vencimento || "9"));
        const em3d = new Date(hoje + "T12:00:00"); em3d.setDate(em3d.getDate() + 3);
        const ate = em3d.toISOString().slice(0, 10);
        const proxEntradas = previstas.filter((r) => r.data <= ate);
        const disp1 = saldoBase;
        const disp2 = saldoBase + proxEntradas.reduce((a, r) => a + Number(r.valor), 0);
        const simular = (dinheiro) => {
          let resto = dinheiro; const paga = [], espera = [];
          ord.forEach((c) => { const v = Number(c.valor_previsto); if (v <= resto) { paga.push(c); resto -= v; } else espera.push(c); });
          return { paga, espera, resto };
        };
        const A = simular(disp1), B = simular(disp2);
        const rot = ["🔴 vencida", "⚡ serviço (corta)", "👥 pessoas", "🩺 saúde/seguro", "📦 demais", "🏦 banco"];
        const Lista = ({ r, titulo, dinheiro }) => (
          <div style={{ flex: "1 1 280px", minWidth: 260 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>{titulo} <span className="num muted" style={{ fontWeight: 400 }}>· {R$(dinheiro)}</span></div>
            {r.paga.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "2px 0", borderBottom: "1px dashed #E8DFC8" }}>
                <span>✓ {c.descricao} <span className="muted" style={{ fontSize: 10 }}>{rot[prio(c)]}</span></span>
                <span className="num" style={{ fontWeight: 600, color: "var(--pos)" }}>{R$(c.valor_previsto)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", fontWeight: 700 }}>
              <span>sobra</span><span className="num" style={{ color: r.resto >= 0 ? "var(--pos)" : "var(--neg)" }}>{R$(r.resto)}</span>
            </div>
            {r.espera.length > 0 && (
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                ainda sem cobertura: {r.espera.map((c) => `${c.descricao} ${R$(c.valor_previsto)}`).join(" · ")}
              </div>
            )}
          </div>
        );
        return (
          <div className="card" style={{ border: "2px solid var(--gold)", background: "#FDFAF2", padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, marginBottom: 8 }}>🎯 Sugestão de pagamento <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>ordem: vencidas → serviços que cortam → pessoas → saúde → demais → banco</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
              <Lista r={A} titulo="Com o saldo de hoje" dinheiro={disp1} />
              {proxEntradas.length > 0 && <Lista r={B} titulo={`Quando cair ${proxEntradas.map((r) => r.origem).join(" + ")} (até ${ate.slice(8, 10)}/${ate.slice(5, 7)})`} dinheiro={disp2} />}
            </div>
            <div className="muted" style={{ fontSize: 10.5, marginTop: 8 }}>É sugestão mecânica por prioridade e valor — você decide. ⏸ tira da lista; editar valor/data muda a ordem. Reativa contas em espera pra elas entrarem na conta.</div>
          </div>
        );
      })()}

      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, margin: "0 0 8px" }}>🎬 O filme do resto do mês</h2>
      <div className="card" style={{ padding: 0, marginBottom: 6 }}>
        <table className="data" style={{ width: "100%" }}>
          <thead><tr>
            <th style={{ padding: "7px 10px" }}>Dia</th><th>Evento</th>
            <th style={{ textAlign: "right" }}>R$</th>
            <th style={{ textAlign: "right", paddingRight: 12 }}>Saldo projetado</th>
          </tr></thead>
          <tbody>
            <tr style={{ background: "#FAF6EC" }}>
              <td style={{ padding: "5px 10px", fontWeight: 700 }}>hoje</td>
              <td className="muted">{ehAtual ? "saldo em conta" : "partida (saldo desconhecido — vem da corrente do Cockpit)"}</td><td></td>
              <td className="num" style={{ textAlign: "right", paddingRight: 12, fontWeight: 700 }}>{R$(saldoBase)}</td>
            </tr>
            {filme.map((e, i) => (
              <tr key={i} style={e.saldo < 0 ? { background: "#FBF0EC" } : undefined}>
                <td className="num" style={{ padding: "5px 10px", fontWeight: e.venc ? 700 : 400, color: e.venc ? "var(--neg)" : undefined }}>
                  {e.d.slice(8, 10)}/{e.d.slice(5, 7)}{e.venc ? " 🔴" : ""}
                </td>
                <td style={{ fontSize: 13 }}>{e.tipo === "+" ? "💚 " : ""}{e.nome}</td>
                <td className="num" style={{ textAlign: "right", color: e.v >= 0 ? "var(--pos)" : "var(--neg)", fontWeight: 600 }}>{e.v >= 0 ? "+" : "–"}{R$(Math.abs(e.v))}</td>
                <td className="num" style={{ textAlign: "right", paddingRight: 12, fontWeight: 700, color: e.saldo >= 0 ? "var(--pos)" : "var(--neg)" }}>{R$(e.saldo)}</td>
              </tr>
            ))}
            {semData.length > 0 && (
              <tr>
                <td className="muted" style={{ padding: "5px 10px" }}>s/ data</td>
                <td className="muted" style={{ fontSize: 12 }}>{semData.map((c) => c.descricao).join(" · ")}</td>
                <td className="num" style={{ textAlign: "right", color: "var(--neg)" }}>–{R$(semData.reduce((a, c) => a + Number(c.valor_previsto), 0))}</td>
                <td className="num" style={{ textAlign: "right", paddingRight: 12, fontWeight: 700, color: (run - semData.reduce((a, c) => a + Number(c.valor_previsto), 0)) >= 0 ? "var(--pos)" : "var(--neg)" }}>
                  {R$(run - semData.reduce((a, c) => a + Number(c.valor_previsto), 0))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 11, margin: "0 0 20px" }}>Linha vermelha = saldo projetado negativo naquele dia — é onde o caixa quebra se nada mudar. 🔴 = conta já vencida.</p>

      {/* ═══ CONTAS: triage ═══ */}
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, margin: "0 0 8px" }}>📋 Triage das contas — pagar ou esperar</h2>
      <div className="card" style={{ padding: 0, marginBottom: 6 }}>
        <table className="data" style={{ width: "100%" }}>
          <tbody>
            {vivas.map((c) => {
              const venc = c.vencimento && c.vencimento < hoje;
              return (
                <tr key={c.id}>
                  <td style={{ padding: "6px 10px", fontSize: 13, fontWeight: venc ? 700 : 400, color: venc ? "var(--neg)" : undefined }}>
                    {venc ? "🔴 " : "○ "}{c.descricao}
                    {c.obs && <div className="muted" style={{ fontSize: 10.5, fontWeight: 400 }}>{c.obs}</div>}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <input className="num" key={"v" + c.id + c.valor_previsto} defaultValue={Number(c.valor_previsto).toLocaleString("pt-BR")}
                      onBlur={(e) => podeEditar && salvarConta(c.id, "valor_previsto", e.target.value)} readOnly={!podeEditar}
                      style={{ width: 84, textAlign: "right", padding: "3px 6px", fontSize: 12.5, fontWeight: 600, background: "#FFFBF0", borderColor: "#E4CE9B" }} />
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <input type="date" key={"d" + c.id + (c.vencimento || "")} defaultValue={c.vencimento || ""}
                      onBlur={(e) => podeEditar && salvarConta(c.id, "vencimento", e.target.value)} readOnly={!podeEditar}
                      style={{ padding: "3px 4px", fontSize: 11.5, background: "#FFFBF0", border: "1px solid #E4CE9B", borderRadius: 6, color: "var(--ink)" }} />
                  </td>
                  <td style={{ textAlign: "right", paddingRight: 10, whiteSpace: "nowrap" }}>
                    {podeEditar ? <a href="#" className="muted" style={{ fontSize: 12 }} onClick={(e) => { e.preventDefault(); toggleStandby(c); }}>⏸ esperar</a> : <a href="/contas" className="muted" style={{ fontSize: 12 }}>marcar pago →</a>}
                  </td>
                </tr>
              );
            })}
            {emStandby.length > 0 && (
              <tr><td colSpan={4} style={{ background: "var(--surface2)", padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                ⏸ EM ESPERA — {R$(totSb)} (fora de todos os totais)
              </td></tr>
            )}
            {emStandby.map((c) => (
              <tr key={c.id} style={{ opacity: 0.55 }}>
                <td style={{ padding: "6px 10px", fontSize: 13 }}>⏸ {c.descricao}</td>
                <td style={{ textAlign: "right" }}>
                  <input className="num" key={"v" + c.id + c.valor_previsto} defaultValue={Number(c.valor_previsto).toLocaleString("pt-BR")}
                    onBlur={(e) => podeEditar && salvarConta(c.id, "valor_previsto", e.target.value)} readOnly={!podeEditar}
                    style={{ width: 84, textAlign: "right", padding: "3px 6px", fontSize: 12.5, background: "#FFFBF0", borderColor: "#E4CE9B" }} />
                </td>
                <td style={{ textAlign: "right" }}>
                  <input type="date" key={"d" + c.id + (c.vencimento || "")} defaultValue={c.vencimento || ""}
                    onBlur={(e) => podeEditar && salvarConta(c.id, "vencimento", e.target.value)} readOnly={!podeEditar}
                    style={{ padding: "3px 4px", fontSize: 11.5, background: "#FFFBF0", border: "1px solid #E4CE9B", borderRadius: 6, color: "var(--ink)" }} />
                </td>
                <td style={{ textAlign: "right", paddingRight: 10 }}>
                  {podeEditar && <a href="#" style={{ fontSize: 12, color: "var(--pos)" }} onClick={(e) => { e.preventDefault(); toggleStandby(c); }}>▶ reativar</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 11.5 }}>
        Valor e data editam AQUI mesmo — salvam ao sair do campo e refletem em tudo (filme, Cockpit, Villa, Contas). ⏸ tira do filme e dos totais. Marcar como paga: <a href="/contas">Contas do Mês →</a>
      </p>
    </div>
  );
}
