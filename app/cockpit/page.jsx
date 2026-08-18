"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";
import Consigliere from "@/components/Consigliere";
import { agoraBR, hojeISO } from "@/lib/hoje";

// ── Estrutura calibrada em 11/08/2026 (extrato Genco + faturas Inter) ──
const CUSTOS_DEF = { villaFixo: 91604, reparos: 6000, haion: 3500, pj: 27566, pf: 60559 };
const CUSTOS_META = [
  { id: "villaFixo", nome: "Villa fixo (Bradesco + operação)" },
  { id: "reparos", nome: "Materiais e reparos (pote)" },
  { id: "haion", nome: "HAION" },
  { id: "pj", nome: "Angelo PJ (equipe + Downtown)" },
  { id: "pf", nome: "Angelo PF (cartão 35k + vida)" },
];
const RECEITAS = [
  { id: "villaConf", nome: "Villa confirmado" },
  { id: "villaVender", nome: "Villa novas vendas (meta)", cenario: true },
  { id: "tim", nome: "TIM Brasil" },
  { id: "ntalks", nome: "Natural Talks" },
  { id: "antecip", nome: "Antecipações 50%" },
];
const MAURICIO_CONF = { "2026-08": 22209, "2026-10": 28090 };

const R$ = (v) => "R$ " + Math.round(v).toLocaleString("pt-BR");
const K$ = (v) => Math.round(Number(v) || 0).toLocaleString("pt-BR");
const Chip = ({ bg, cor, children }) => (
  <span style={{ display: "inline-block", fontSize: 10, padding: "1.5px 7px", borderRadius: 9, background: bg, color: cor, fontWeight: 700, marginLeft: 4, whiteSpace: "nowrap" }}>{children}</span>
);
const mesLabel = (m) => ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][+m.slice(5)] + "/" + m.slice(2, 4);

function gerarMeses() {
  const out = [];
  const d = new Date(); d.setDate(1);
  for (let i = 0; i < 9; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

export default function Cockpit() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const meses = gerarMeses();
  const [vals, setVals] = useState({});
  const [cfg, setCfg] = useState({ saldoInicial: 2913, envelopePct: 5, comissaoPct: 15 });
  const [custos, setCustos] = useState(CUSTOS_DEF);
  const [cenario, setCenario] = useState(1);
  const [pronto, setPronto] = useState(false);
  const [real, setReal] = useState({ entrou: 0, pagou: 0, aPagar: 0, sb: 0, atras: 0, rec: {}, recCaiu: {}, recVem: {}, pag: {}, abre: {}, rows: [], hojeD: "" });

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("cockpit_valores").select("*");
    const v = {};
    (data || []).forEach((r) => { v[r.linha] = v[r.linha] || {}; v[r.linha][r.mes] = Number(r.valor); });
    setVals(v);
    const { data: c } = await supabase.from("cockpit_config").select("*").eq("chave", "meta").maybeSingle();
    if (c?.valor) setCfg((old) => ({ ...old, ...c.valor }));
    const { data: cu } = await supabase.from("cockpit_config").select("*").eq("chave", "custos_v2").maybeSingle();
    if (cu?.valor) setCustos((old) => ({ ...old, ...cu.valor }));
    const mesAtual = meses[0];
    const ini = mesAtual + "-01";
    const fim = mesAtual + "-31";
    const [{ data: recs }, { data: pags }, { data: cts }, { data: velhas }] = await Promise.all([
      supabase.from("receitas").select("id,valor,categoria,data,origem,confirmada").gte("data", ini).lte("data", fim).order("data"),
      supabase.from("pagamentos").select("valor,categoria").eq("estornado", false).gte("data", ini).lte("data", fim),
      supabase.from("contas").select("valor_previsto,standby,categoria").eq("mes", mesAtual).eq("pago", false),
      supabase.from("contas").select("valor_previsto").lt("mes", mesAtual).eq("pago", false),
    ]);
    const MAPA_REC = { "Villa Irvana": "villaConf", "TIM Brasil": "tim", "TIM Brasil": "tim", "Natural Talks": "ntalks", "Antecipação": "antecip" };
    const MAPA_PAG = { "Villa fixo": "villaFixo", "Materiais e reparos": "reparos", "HAION": "haion", "Angelo PJ": "pj", "Angelo PF": "pf", "Impostos": "pj", "Comissão Mauricio": "comissao" };
    const hojeD = hojeISO();
    const rec = {}, recCaiu = {}, recVem = {}, pag = {}, abre = {};
    (recs || []).forEach((r) => {
      const k = MAPA_REC[r.categoria] || "outros";
      rec[k] = (rec[k] || 0) + Number(r.valor);
      if (r.confirmada) recCaiu[k] = (recCaiu[k] || 0) + Number(r.valor);
      else recVem[k] = (recVem[k] || 0) + Number(r.valor);
    });
    (pags || []).forEach((p) => { const k = MAPA_PAG[p.categoria] || "outros"; pag[k] = (pag[k] || 0) + Number(p.valor); });
    (cts || []).filter((c) => !c.standby).forEach((c) => { const k = MAPA_PAG[c.categoria] || "outros"; abre[k] = (abre[k] || 0) + Number(c.valor_previsto); });
    setReal({
      entrou: (recs || []).reduce((a, r) => a + Number(r.valor), 0),
      pagou: (pags || []).reduce((a, r) => a + Number(r.valor), 0),
      aPagar: (cts || []).filter((r) => !r.standby).reduce((a, r) => a + Number(r.valor_previsto), 0),
      sb: (cts || []).filter((r) => r.standby).reduce((a, r) => a + Number(r.valor_previsto), 0),
      atras: (velhas || []).reduce((a, r) => a + Number(r.valor_previsto), 0),
      rec, recCaiu, recVem, pag, abre, rows: recs || [], hojeD,
    });
    setPronto(true);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const [sim, setSim] = useState(false);
  const [backup, setBackup] = useState(null);
  const ligarSim = () => { setBackup({ custos: { ...custos }, vals: JSON.parse(JSON.stringify(vals)) }); setSim(true); };
  const desligarSim = () => { if (backup) { setCustos(backup.custos); setVals(backup.vals); } setSim(false); setBackup(null); };
  const aplicarSim = async () => {
    // custos: um upsert só
    await supabase.from("cockpit_config").upsert({ chave: "custos_v2", valor: custos });
    // valores: só as células que mudaram vs backup
    const mudadas = [];
    Object.entries(vals).forEach(([linha, meses]) => {
      Object.entries(meses || {}).forEach(([m, v]) => {
        if ((backup?.vals?.[linha]?.[m] ?? null) !== v) mudadas.push({ linha, mes: m, valor: v });
      });
    });
    if (mudadas.length) await supabase.from("cockpit_valores").upsert(mudadas);
    setSim(false); setBackup(null);
    alert(`Simulação aplicada ao plano real ✓ (${mudadas.length} células + custos)`);
  };

  const setCusto = async (id, raw) => {
    const v = Number(String(raw).replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
    const novo = { ...custos, [id]: v, base: null };
    novo.base = CUSTOS_META.reduce((s, c) => s + (novo[c.id] || 0), 0);
    setCustos(novo);
    if (!sim) await supabase.from("cockpit_config").upsert({ chave: "custos_v2", valor: novo });
  };

  const setVal = async (linha, mes, raw) => {
    const v = Number(String(raw).replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
    setVals((old) => ({ ...old, [linha]: { ...(old[linha] || {}), [mes]: v } }));
    if (!sim) await supabase.from("cockpit_valores").upsert({ linha, mes, valor: v });
  };

  if (perfil && perfil.role !== "admin")
    return <div className="container muted">O Cockpit é só do capo.</div>;
  if (!pronto) return <div className="container muted">Carregando o cockpit…</div>;

  const g = (l, m) => vals[l]?.[m] || 0;
  const entraMes = (m) => g("villaConf", m) + g("villaVender", m) * cenario + g("tim", m) + g("ntalks", m) + g("antecip", m);
  const comissaoMes = (m) => (cfg.comissaoPct / 100) * ((MAURICIO_CONF[m] || 0) + g("villaVender", m) * cenario + g("antecip", m));
  const custosMes = (m) => CUSTOS_META.reduce((s, c) => s + (custos[c.id] || 0), 0) + comissaoMes(m);

  let acc = cfg.saldoInicial;
  const caiu0 = Object.values(real.recCaiu || {}).reduce((a, b) => a + b, 0);
  const linhas = meses.map((m, idx) => {
    let e, s, fluxo;
    if (idx === 0) {
      // MÊS CORRENTE: entra/sai do mês inteiro (informativo)…
      e = real.entrou;
      s = real.pagou + real.aPagar;
      // …mas o ACUMULADO usa só o FUTURO: o saldo de hoje já digeriu o passado
      fluxo = (real.entrou - caiu0) - real.aPagar;
    } else {
      e = entraMes(m); s = custosMes(m);
      fluxo = e - s;
    }
    const l = e - s;
    acc += fluxo;
    return { m, e, s, l, acc, real: idx === 0 };
  });
  const totE = linhas.reduce((x, r) => x + r.e, 0);
  const totS = linhas.reduce((x, r) => x + r.s, 0);
  const envelope = (totE * cfg.envelopePct) / 100;

  const th = { textAlign: "right", whiteSpace: "nowrap" };
  const td = { textAlign: "right", whiteSpace: "nowrap" };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 18px 60px" }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, margin: "10px 0 18px" }}>
        <div>
          <div className="eyebrow">Angelo's Life Companion</div>
          <h1 className="display">Cockpit</h1>
          <div className="muted" style={{ fontSize: 13 }}>{mesLabel(meses[0])} → {mesLabel(meses[8])} · células douradas salvam no banco</div>
          <a href="/mes" className="primary" style={{ display: "inline-block", marginTop: 8, padding: "8px 16px", fontSize: 13, borderRadius: 10, textDecoration: "none" }}>🎛️ Abrir a sala de comando do mês →</a>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["Só confirmado", 0], ["Plano", 1], ["Otimista", 1.25]].map(([nome, mult]) => (
            <button key={nome} onClick={() => setCenario(mult)} className={cenario === mult ? "primary" : "ghost"}>{nome}</button>
          ))}
        </div>
      </div>

      <Consigliere compacto />
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        {!sim ? (
          <button className="ghost" onClick={ligarSim} style={{ padding: "6px 14px", fontSize: 12.5 }}>🧪 Modo simulação</button>
        ) : (
          <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#F3E8FA", border: "1.5px solid #8A6FB8", borderRadius: 12, padding: "8px 14px" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#6B4FA0" }}>🧪 SIMULANDO — nada é salvo no banco</span>
            <span className="muted" style={{ fontSize: 11.5 }}>mexe em custos e células à vontade</span>
            <button className="primary" onClick={aplicarSim} style={{ padding: "5px 12px", fontSize: 12 }}>💾 aplicar no plano real</button>
            <button className="ghost" onClick={desligarSim} style={{ padding: "5px 12px", fontSize: 12 }}>✕ descartar</button>
          </div>
        )}
      </div>
      {/* ═══ PAINEL DE INSTRUMENTOS ═══ */}
      {(() => {
        const mesE = linhas[0].e, mesS = linhas[0].s;
        const pctReceb = Math.min(1, real.entrou / Math.max(1, mesE));
        const pctCob = Math.min(1.5, mesE / Math.max(1, mesS)) / 1.5;
        const pctRota = Math.max(0, Math.min(1, (acc + 200000) / 400000));
        const G = ({ frac, label, valor, sub, zonas }) => {
          const cx = 110, cy = 105, r = 82;
          const ang = (f) => Math.PI * (1 - f);
          const px = (f, rr) => cx + rr * Math.cos(ang(f));
          const py = (f, rr) => cy - rr * Math.sin(ang(f));
          const arco = (f0, f1, cor) => (
            <path d={`M ${px(f0, r)} ${py(f0, r)} A ${r} ${r} 0 0 1 ${px(f1, r)} ${py(f1, r)}`}
              stroke={cor} strokeWidth="11" fill="none" strokeLinecap="butt" opacity="0.9" />
          );
          const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={px(f, r - 9)} y1={py(f, r - 9)} x2={px(f, r + 8)} y2={py(f, r + 8)}
              stroke="#EFE6D2" strokeWidth="2" opacity="0.7" />
          ));
          return (
            <div style={{ textAlign: "center", flex: "1 1 200px", minWidth: 190 }}>
              <svg viewBox="0 0 220 128" style={{ width: "100%", maxWidth: 240, display: "block", margin: "0 auto" }}>
                {zonas.map(([f0, f1, cor], i) => <g key={i}>{arco(f0, f1, cor)}</g>)}
                {ticks}
                <line x1={cx} y1={cy} x2={px(frac, r - 20)} y2={py(frac, r - 20)}
                  stroke="#E8B84B" strokeWidth="3.5" strokeLinecap="round" />
                <circle cx={cx} cy={cy} r="7" fill="#E8B84B" stroke="#2B2620" strokeWidth="2" />
              </svg>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 19, fontWeight: 700, color: "#F3DFA8", marginTop: 2 }}>{valor}</div>
              <div style={{ fontSize: 10.5, letterSpacing: ".12em", color: "#B8A77E", textTransform: "uppercase", marginTop: 2 }}>{label}</div>
              {sub && <div style={{ fontSize: 10.5, color: "#8A7D63", marginTop: 1 }}>{sub}</div>}
            </div>
          );
        };
        return (
          <div style={{ background: "linear-gradient(160deg, #2E2822, #221D18)", border: "1px solid #4A4033", borderRadius: 18, padding: "20px 16px 14px", marginBottom: 12, boxShadow: "inset 0 1px 0 rgba(255,255,255,.05), 0 10px 30px rgba(0,0,0,.18)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-around" }}>
              <G frac={pctReceb} label="Velocidade do mês" valor={R$(real.entrou)} sub={`de ${R$(mesE)} declarados · ${Math.round(pctReceb * 100)}%`}
                zonas={[[0, 0.4, "#A34B36"], [0.4, 0.75, "#C99A3C"], [0.75, 1, "#4E8A66"]]} />
              <G frac={pctCob} label="Cobertura do mês" valor={`${Math.round((mesE / Math.max(1, mesS)) * 100)}%`} sub={`entra ${R$(mesE)} · sai ${R$(mesS)}`}
                zonas={[[0, 0.6, "#A34B36"], [0.6, 0.667, "#C99A3C"], [0.667, 1, "#4E8A66"]]} />
              <G frac={pctRota} label="Rota do caixa (9 meses)" valor={R$(acc)} sub={acc >= 0 ? "chegada no verde" : "chegada no vermelho"}
                zonas={[[0, 0.5, "#A34B36"], [0.5, 0.56, "#C99A3C"], [0.56, 1, "#4E8A66"]]} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-around", marginTop: 14, paddingTop: 12, borderTop: "1px solid #453C30" }}>
              {[
                ["RESULTADO DO PERÍODO", R$(totE - totS), totE - totS >= 0 ? "#7FB894" : "#D98973"],
                ["CAIXA FINAL PROJETADO", R$(acc), acc >= 0 ? "#7FB894" : "#D98973"],
                ["🇮🇹 ENVELOPE VIAREGGIO (" + cfg.envelopePct + "%)", R$(envelope), "#E8B84B"],
              ].map(([l, v, c]) => (
                <div key={l} style={{ textAlign: "center", minWidth: 160 }}>
                  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 17, fontWeight: 700, color: c }}>{v}</div>
                  <div style={{ fontSize: 9.5, letterSpacing: ".1em", color: "#8A7D63", marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ═══ MÊS ATUAL — DEMONSTRATIVO HORIZONTAL ═══ */}
      {(() => {
        const vem0 = real.entrou - caiu0;
        const fecha = linhas[0].acc;
        const L = ({ nome, v, neg, chips }) => (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "5px 0", borderBottom: "1px dashed #E8DFC8" }}>
            <span style={{ fontSize: 13, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome}</span>
            <span className="num" style={{ fontSize: 14, fontWeight: 700, color: neg ? "var(--neg)" : "var(--pos)", whiteSpace: "nowrap" }}>{neg ? "–" : ""}{R$(v)}</span>
            <span style={{ whiteSpace: "nowrap" }}>{chips}</span>
          </div>
        );
        return (
          <div className="card" style={{ border: "2px solid var(--gold)", background: "#FDFAF2", padding: "16px 18px", marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18 }}>⏳ {mesLabel(meses[0]).toUpperCase()} — ao vivo <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>{agoraBR().iso.slice(8, 10)}/{agoraBR().iso.slice(5, 7)} · {agoraBR().hora} Brasília</span></div>
              <div style={{ textAlign: "right" }}>
                <span className="muted" style={{ fontSize: 11, letterSpacing: ".06em" }}>FECHA O MÊS EM </span>
                <span className="num" style={{ fontSize: 22, fontWeight: 900, color: fecha >= 0 ? "var(--pos)" : "var(--neg)" }}>{R$(fecha)}</span>
                <span className="muted" style={{ fontSize: 10.5, display: "block" }}>
                  saldo {R$(cfg.saldoInicial)}{cfg.saldoData && <span title={cfg.saldoFonte || ""}> (extrato até {cfg.saldoData.slice(8, 10)}/{cfg.saldoData.slice(5, 7)}{cfg.saldoData < hojeISO() ? " ⚠️ pode ter mudado" : ""})</span>} + vem {R$(vem0)} − abre {R$(real.aPagar)}
                  {real.sb > 0 && <> · <span style={{ color: "#8A7D63", fontWeight: 700 }}>⏸ {R$(real.sb)} em espera fora</span></>}
                </span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "6px 28px" }}>
              <div>
                <div className="muted" style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", marginBottom: 4 }}>ENTRADAS · {R$(linhas[0].e)}</div>
                {real.rows.filter((r) => r.confirmada).length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#2E6B47", margin: "2px 0" }}>✓ JÁ ENTROU (confirmado) — {R$(caiu0)}</div>
                    {real.rows.filter((r) => r.confirmada).map((r) => (
                      <div key={r.id} style={{ display: "flex", gap: 8, padding: "2px 0", fontSize: 12.5, borderBottom: "1px dashed #E8DFC8" }}>
                        <span className="num muted" style={{ fontSize: 11 }}>{r.data.slice(8, 10)}/{r.data.slice(5, 7)}</span>
                        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.origem}</span>
                        <span className="num" style={{ fontWeight: 700, color: "var(--pos)" }}>{R$(r.valor)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6B4FA0", margin: "2px 0" }}>🔮 A ENTRAR — {R$(linhas[0].e - caiu0)}</div>
                {real.rows.filter((r) => !r.confirmada).map((r) => (
                  <div key={r.id} style={{ display: "flex", gap: 8, padding: "2px 0", fontSize: 12.5, borderBottom: "1px dashed #E8DFC8" }}>
                    <span className="num muted" style={{ fontSize: 11 }}>{r.data.slice(8, 10)}/{r.data.slice(5, 7)}</span>
                    <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.origem}{r.data <= real.hojeD && <span title="data já passou e não foi confirmada — caiu? confirma nas Receitas" style={{ marginLeft: 4 }}>⚠️</span>}
                    </span>
                    <span className="num" style={{ fontWeight: 700, color: "#6B4FA0" }}>{R$(r.valor)}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="muted" style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", marginBottom: 4 }}>SAÍDAS · {R$(linhas[0].s)}</div>
                {CUSTOS_META.map((c) => {
                  const pg = real.pag[c.id] || 0, ab = real.abre[c.id] || 0, t = pg + ab;
                  if (!t) return null;
                  return (
                    <div key={c.id} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "4px 0", borderBottom: "1px dashed #E8DFC8" }}>
                      <span style={{ fontSize: 13, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</span>
                      {pg > 0 && <Chip bg="#E3EFE7" cor="#3D7A5C">✓ pago {K$(pg)}</Chip>}
                      {ab > 0 && <span className="num" style={{ fontSize: 13.5, fontWeight: 800, color: "var(--neg)", whiteSpace: "nowrap" }}>falta {R$(ab)}</span>}
                      <span className="num muted" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>· custo {K$(t)}</span>
                    </div>
                  );
                })}
                {((real.pag.comissao || 0) + (real.abre.comissao || 0)) > 0 && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "4px 0", borderBottom: "1px dashed #E8DFC8" }}>
                    <span style={{ fontSize: 13, flex: 1 }}>Comissão Mauricio</span>
                    {(real.pag.comissao || 0) > 0 && <Chip bg="#E3EFE7" cor="#3D7A5C">✓ pago {K$(real.pag.comissao)}</Chip>}
                    {(real.abre.comissao || 0) > 0 && <span className="num" style={{ fontSize: 13.5, fontWeight: 800, color: "var(--neg)" }}>falta {R$(real.abre.comissao)}</span>}
                    <span className="num muted" style={{ fontSize: 11.5 }}>· custo {K$((real.pag.comissao || 0) + (real.abre.comissao || 0))}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 6, fontWeight: 800, alignItems: "baseline" }}>
                  <Chip bg="#E3EFE7" cor="#3D7A5C">✓ pago {K$(real.pagou)}</Chip>
                  <span className="num" style={{ fontSize: 15, color: "var(--neg)" }}>falta {R$(real.aPagar)}</span>
                  <span className="num muted" style={{ fontSize: 12 }}>· custo do mês {K$(linhas[0].s)}</span>
                </div>
              </div>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 10, textAlign: "right" }}>
              detalhe conta a conta, filme do saldo e triage: <a href="/mes" style={{ fontWeight: 700 }}>sala de comando →</a>
            </div>
          </div>
        );
      })()}

      {/* ═══ PROJEÇÃO — MESES FUTUROS ═══ */}
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, margin: "0 0 8px" }}>Projeção — {mesLabel(meses[1])} → {mesLabel(meses[8])} <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>(células douradas editam)</span></h2>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data">
          <thead>
            <tr>
              <th style={{ minWidth: 200 }}>ENTRA</th>
              {meses.slice(1).map((m) => <th key={m} style={th}>{mesLabel(m)}</th>)}
              <th style={{ ...th, color: "var(--gold)" }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {RECEITAS.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 500 }}>{r.nome}{r.cenario && cenario !== 1 && <span className="muted"> ×{cenario}</span>}</td>
                {meses.slice(1).map((m) => (
                  <td key={m} style={{ padding: 4 }}>
                    <input className="num" key={`${r.id}-${m}-${g(r.id, m)}`}
                      defaultValue={g(r.id, m) ? Math.round(g(r.id, m)).toLocaleString("pt-BR") : ""} placeholder="—"
                      onBlur={(e) => setVal(r.id, m, e.target.value)}
                      style={{ width: 90, textAlign: "right", padding: "5px 7px", fontSize: 12.5, background: "#FFFBF0", borderColor: "#E4CE9B" }} />
                  </td>
                ))}
                <td className="num" style={{ ...td, color: "var(--pos)" }}>{R$(meses.slice(1).reduce((s2, m) => s2 + g(r.id, m) * (r.cenario ? cenario : 1), 0))}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, background: "#F2F8F3" }}>
              <td>Total entra</td>
              {linhas.slice(1).map((r) => <td key={r.m} className="num" style={{ ...td, color: "var(--pos)" }}>{R$(r.e)}</td>)}
              <td className="num" style={{ ...td, color: "var(--pos)" }}>{R$(linhas.slice(1).reduce((a, r) => a + r.e, 0))}</td>
            </tr>
            <tr><td colSpan={meses.length + 1} style={{ background: "var(--surface2)", padding: "6px 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", color: "var(--muted)" }}>SAI</td></tr>
            {CUSTOS_META.map((c) => (
              <tr key={c.id}>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>
                  {c.nome}
                  <input className="num" key={c.id + custos[c.id]} defaultValue={Math.round(custos[c.id] || 0).toLocaleString("pt-BR")}
                    onBlur={(e) => setCusto(c.id, e.target.value)} title="base mensal"
                    style={{ width: 72, textAlign: "right", padding: "2px 6px", fontSize: 11, marginLeft: 8, background: "#FFFBF0", borderColor: "#E4CE9B" }} />
                </td>
                {meses.slice(1).map((m) => <td key={m} className="num muted" style={td}>{R$(custos[c.id] || 0)}</td>)}
                <td className="num muted" style={td}>{R$((custos[c.id] || 0) * (meses.length - 1))}</td>
              </tr>
            ))}
            <tr>
              <td className="muted">Comissão Mauricio ({cfg.comissaoPct}%)</td>
              {meses.slice(1).map((m) => <td key={m} className="num muted" style={td}>{comissaoMes(m) ? R$(comissaoMes(m)) : "—"}</td>)}
              <td className="num muted" style={td}>{R$(meses.slice(1).reduce((s2, m) => s2 + comissaoMes(m), 0))}</td>
            </tr>
            <tr style={{ fontWeight: 700, background: "#FBF1EC" }}>
              <td>Total sai</td>
              {linhas.slice(1).map((r) => <td key={r.m} className="num" style={{ ...td, color: "var(--neg)" }}>{R$(r.s)}</td>)}
              <td className="num" style={{ ...td, color: "var(--neg)" }}>{R$(linhas.slice(1).reduce((a, r) => a + r.s, 0))}</td>
            </tr>
            <tr style={{ fontWeight: 700 }}>
              <td>Líquido do mês</td>
              {linhas.slice(1).map((r) => <td key={r.m} className="num" style={{ ...td, color: r.l >= 0 ? "var(--pos)" : "var(--neg)" }}>{R$(r.l)}</td>)}
              <td></td>
            </tr>
            <tr style={{ fontWeight: 800 }}>
              <td>Caixa acumulado <span className="muted" style={{ fontWeight: 400, fontSize: 10 }}>(parte do fecha-o-mês de {mesLabel(meses[0])}: {R$(linhas[0].acc)})</span></td>
              {linhas.slice(1).map((r) => <td key={r.m} className="num" style={{ ...td, background: r.acc >= 0 ? "#EAF3EC" : "#FBF0EC", color: r.acc >= 0 ? "var(--pos)" : "var(--neg)" }}>{R$(r.acc)}</td>)}
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
{(real.atras > 0 || real.sb > 0) && (() => {
        const chegada = linhas[linhas.length - 1].acc;
        const mochila = real.atras + real.sb;
        return (
          <div className="card" style={{ marginTop: 12, padding: "12px 16px", background: "#F7F1E4", border: "1.5px dashed #B8A77E" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 22px", alignItems: "baseline", justifyContent: "space-between" }}>
              <div style={{ fontSize: 13 }}>
                🎒 <b>Mochila fora do fluxo:</b>
                {real.atras > 0 && <> 🔴 atrasados de meses anteriores <b className="num" style={{ color: "var(--neg)" }}>{R$(real.atras)}</b></>}
                {real.atras > 0 && real.sb > 0 && " · "}
                {real.sb > 0 && <> ⏸ em espera <b className="num">{R$(real.sb)}</b></>}
              </div>
              <div className="num" style={{ fontSize: 13 }}>
                chegada em {mesLabel(meses[8])}: <b style={{ color: chegada >= 0 ? "var(--pos)" : "var(--neg)" }}>{R$(chegada)}</b>
                <span className="muted"> → pagando a mochila: </span>
                <b style={{ color: (chegada - mochila) >= 0 ? "var(--pos)" : "var(--neg)" }}>{R$(chegada - mochila)}</b>
              </div>
            </div>
            <div className="muted" style={{ fontSize: 10.5, marginTop: 4 }}>
              Dívidas velhas e stand-by não têm data — não entram no filme mensal, mas são reais: quando pagar, saem do caixa do mês do pagamento. Detalhe: Contas (🔴 pendências) e Villa Business (dívida).
            </div>
          </div>
        );
      })()}
      <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
        ⏳ Caixa acumulado do mês corrente = saldo de hoje + o que AINDA vem − o que AINDA sai (o passado já está dentro do saldo — não conta duas vezes; bate com o filme da sala de comando). Agosto AO VIVO vem dos módulos: entradas do Receitas (caídas + 🔮 declaradas), saídas do Caixa + Contas (stand-by fora). A projeção set→abr é modelo — células douradas salvam no banco. Base de custo edita ao lado do nome (vale pra todos os meses).</p>
    </div>
  );
}
