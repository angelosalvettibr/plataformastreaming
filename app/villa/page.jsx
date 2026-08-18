"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

const R$ = (v) => "R$ " + Math.round(Number(v) || 0).toLocaleString("pt-BR");
const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const SEED = {
  r26: [124584,222999,119605,234166,95702,93600,141336,96455,111037,128534,77312,121217],
  c26: [18688,33450,17941,35125,14355,14040,21200,14468,16656,19280,11597,18183],
  r27: [36747,159110,36451,0,0,0,81333,0,0,0,0,0],
};

export default function Villa() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const [cfg, setCfg] = useState(null);
  const [caixa, setCaixa] = useState({});
  const [custoFixo, setCustoFixo] = useState(91604);
  const [custoReal, setCustoReal] = useState({});
  const [comissaoReal, setComissaoReal] = useState({});
  const [mauricio, setMauricio] = useState(null);
  const [pagoMauricio, setPagoMauricio] = useState(0);
  const [pagsVilla, setPagsVilla] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [mesAberto, setMesAberto] = useState(null);

  const carregar = useCallback(async () => {
    const { data: c } = await supabase.from("cockpit_config").select("*").eq("chave", "villa_biz").maybeSingle();
    setCfg(c?.valor || SEED);
    const { data: cu } = await supabase.from("cockpit_config").select("*").eq("chave", "custos_v2").maybeSingle();
    if (cu?.valor?.villaFixo) setCustoFixo(cu.valor.villaFixo);
    const { data: recs } = await supabase.from("receitas").select("*").eq("categoria", "Villa Irvana").gte("data", "2026-01-01");
    const porMes = {};
    (recs || []).forEach((r) => { const m = r.data.slice(0, 7); porMes[m] = (porMes[m] || 0) + Number(r.valor); });
    setCaixa(porMes);
    const { data: pags } = await supabase.from("pagamentos").select("data,valor,categoria,favorecido").eq("estornado", false).gte("data", "2026-01-01").in("categoria", ["Villa fixo", "Comissão Mauricio", "Materiais e reparos"]);
    const cReal = {}, comReal = {};
    (pags || []).forEach((p) => {
      const m = p.data.slice(0, 7);
      if (p.categoria === "Comissão Mauricio") comReal[m] = (comReal[m] || 0) + Number(p.valor);
      else cReal[m] = (cReal[m] || 0) + Number(p.valor);
    });
    setCustoReal(cReal); setComissaoReal(comReal);
    setPagsVilla((pags || []).filter((p) => p.categoria !== "Comissão Mauricio"));
    const { data: mb } = await supabase.from("cockpit_config").select("*").eq("chave", "mauricio_balanco").maybeSingle();
    if (mb?.valor) setMauricio(mb.valor);
    const { data: pm } = await supabase.from("pagamentos").select("valor").eq("estornado", false).eq("categoria", "Comissão Mauricio").gte("data", "2026-01-01");
    setPagoMauricio((pm || []).reduce((a, b) => a + Number(b.valor), 0));
    const { data: cts } = await supabase.from("contas").select("*").eq("pago", false).in("categoria", ["Villa fixo", "Materiais e reparos", "Impostos"]);
    setPendentes((cts || []).filter((c) => !c.standby));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (novo) => { setCfg(novo); await supabase.from("cockpit_config").upsert({ chave: "villa_biz", valor: novo }); };

  if (perfil && !["admin", "financeiro", "parceiro"].includes(perfil.role))
    return <div className="container muted">Sem acesso a este módulo.</div>;
  if (!cfg) return <div className="container muted">Carregando…</div>;

  const ro = perfil?.role === "parceiro";
  const hoje = new Date().toISOString().slice(0, 10);
  const mesIdx = new Date().getMonth();
  const mkey = (i) => `2026-${String(i + 1).padStart(2, "0")}`;
  const f26 = cfg.f26 || [0,0,0,0,0,0,0,0,0,0,0,0];
  const cc26 = cfg.cc26 || [124500,111900,116200,115700,97900,36500,44000,107000,106000,106000,106000,106000];
  const m26 = cfg.m26 || [0,0,0,0,0,0,0,0,0,0,0,0];
  const eff = { r26: cfg.r26, c26: cfg.c26, r27: cfg.r27, f26, cc26, m26 };
  const setCell = (campo, i, raw) => {
    const v = Number(String(raw).replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
    salvar({ ...cfg, [campo]: eff[campo].map((x, j) => (j === i ? v : x)) });
  };
  const custoMes = (i) => (custoReal[mkey(i)] != null && i <= mesIdx) ? custoReal[mkey(i)] : custoFixo;
  const comMes = (i) => (comissaoReal[mkey(i)] != null && i <= mesIdx) ? comissaoReal[mkey(i)] : cfg.c26[i];
  const ehReal = (i) => custoReal[mkey(i)] != null && i <= mesIdx;
  const ehParcial = (i) => i === mesIdx && ehReal(i);

  const totR = cfg.r26.reduce((a, b) => a + b, 0);
  const totF = f26.reduce((a, b) => a + b, 0);
  const fatTot = totR + totF;
  const totComPL = Math.round(fatTot * 0.15);
  const totCC = cc26.reduce((a, b) => a + b, 0);
  const totMel = m26.reduce((a, b) => a + b, 0);
  const resultadoPL = fatTot - totComPL - totCC - totMel;
  const totC = MESES.reduce((s, _, i) => s + comMes(i), 0);
  const parcialAtual = custoReal[mkey(mesIdx)] || 0;
  const custoYTD = MESES.reduce((sum, _, i) => sum + (i < mesIdx ? (custoReal[mkey(i)] ?? custoFixo) : 0), 0) + parcialAtual;
  const custoRestante = Math.max(0, custoFixo - parcialAtual) + custoFixo * (11 - mesIdx);
  const custoAno = custoYTD + custoRestante;
  const resultado = totR - totC - custoAno;
  const caixaYTD = Object.values(caixa).reduce((a, b) => a + b, 0);
  const tot27 = cfg.r27.reduce((a, b) => a + b, 0);

  const pendMes = (m) => pendentes.filter((c) => c.mes === m);
  const atrasadas = pendentes.filter((c) => c.vencimento && c.vencimento < hoje);
  const totAtras = atrasadas.reduce((a, c) => a + Number(c.valor_previsto), 0);
  const breakeven = Math.round(custoFixo / 0.85);
  const mesesVerm = MESES.filter((_, i) => i > mesIdx && cfg.r26[i] + f26[i] < breakeven).map((m) => m.toUpperCase());

  const card = (t, v, cor, sub) => (
    <div className="card" style={{ borderTop: `4px solid ${cor}` }}>
      <div className="muted" style={{ fontSize: 11.5 }}>{t}</div>
      <div className="num" style={{ fontSize: 20, fontWeight: 700, color: cor }}>{v}</div>
      {sub && <div className="muted" style={{ fontSize: 10.5 }}>{sub}</div>}
    </div>
  );
  const inp = (campo, i, destaque) => ro
    ? <span className="num" style={{ fontSize: 12.5, display: "inline-block", minWidth: 68, textAlign: "right" }}>{(eff[campo]?.[i] ?? 0).toLocaleString("pt-BR")}</span>
    : <input className="num" key={campo + i + (eff[campo]?.[i] ?? 0)} defaultValue={(eff[campo]?.[i] ?? 0).toLocaleString("pt-BR")}
        onBlur={(e) => setCell(campo, i, e.target.value)}
        style={{ width: 76, textAlign: "right", padding: "4px 6px", fontSize: 12, background: destaque ? "#FFFBF0" : "var(--surface)", borderColor: destaque ? "#E4CE9B" : undefined }} />;



  return (
    <div className="container" style={{ maxWidth: 1080 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">🏛 Villa Irvana Business</h1>

      {/* ═══ VEREDITO ═══ */}
      <div className="card" style={{ borderLeft: "5px solid var(--gold)", padding: "14px 18px", margin: "10px 0 16px" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16.5, marginBottom: 6 }}>Onde a Villa está agora</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.65 }}>
          P&L: fatura <b>{R$(fatTot)}</b> no ano (conf.+forecast), custa <b>{R$(totCC + totComPL + totMel)}</b> (estrutura + comissão 15% + melhorias) → resultado{" "}
          <b style={{ color: resultadoPL >= 0 ? "var(--pos)" : "var(--neg)" }}>{R$(resultadoPL)}</b>.
          O breakeven é <b>~{R$(breakeven)}/mês</b> de faturamento{mesesVerm.length > 0 && <> — e <b style={{ color: "var(--neg)" }}>{mesesVerm.join(", ")}</b> estão abaixo dele (venda ou vermelho)</>}.
          {totAtras > 0 && <> Há <b style={{ color: "var(--neg)" }}>{R$(totAtras)} de contas vencidas</b> acumuladas (IPTU, condomínio, elevador) que precisam de plano.</>}
          {" "}Bradesco voltou da carência este mês.
        </div>
      </div>

      {/* ═══ KPIs ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
        {card("Receita 2026", R$(totR), "var(--pos)", "competência (check-in)")}
        {card("Entrou no caixa", R$(caixaYTD), "var(--gold)", "jan → hoje")}
        {card("Custo até agora", R$(custoYTD), "var(--neg)", "real do Caixa")}
        {card("Custo ano (competência)", R$(totCC + totMel), "var(--neg)", `estrutura ${R$(totCC)} + melhorias ${R$(totMel)}`)}
        {card("🔴 Atrasado", R$(totAtras), "var(--neg)", `${atrasadas.length} contas vencidas`)}
        {card("Resultado P&L 2026", R$(resultadoPL), resultadoPL >= 0 ? "var(--pos)" : "var(--neg)", "competência: fat − 15% − custo − melhorias")}
      </div>

      {/* ═══ P&L MÊS A MÊS ═══ */}
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 19, margin: "0 0 8px" }}>📊 P&L — competência (visão CEO)</h2>
      <div className="card" style={{ padding: 0, marginBottom: 6, overflowX: "auto" }}>
        <table className="data" style={{ width: "100%", minWidth: 780 }}>
          <thead><tr>
            <th style={{ padding: "8px 10px" }}>2026</th>
            <th style={{ textAlign: "right" }}>Reservas<br/><span style={{ fontWeight: 400, fontSize: 10 }}>check-in no mês</span></th>
            <th style={{ textAlign: "right" }}>A vender<br/><span style={{ fontWeight: 400, fontSize: 10 }}>forecast</span></th>
            <th style={{ textAlign: "right" }}>Custo do mês<br/><span style={{ fontWeight: 400, fontSize: 10 }}>competência</span></th>
            <th style={{ textAlign: "right" }}>Melhorias<br/><span style={{ fontWeight: 400, fontSize: 10 }}>capex</span></th>
            <th style={{ textAlign: "right" }}>Comissão<br/><span style={{ fontWeight: 400, fontSize: 10 }}>15% auto</span></th>
            <th style={{ textAlign: "right" }}>Resultado</th>
            <th style={{ textAlign: "right", paddingRight: 12 }}>Acumulado</th>
          </tr></thead>
          <tbody>
            {(() => { let acc = 0; return MESES.map((m, i) => {
              const fat = cfg.r26[i] + f26[i];
              const com = Math.round(fat * 0.15);
              const res = fat - com - cc26[i] - m26[i];
              acc += res; const acum = acc;
              const atual = i === mesIdx;
              const R = { textAlign: "right", padding: "5px 10px", whiteSpace: "nowrap", fontSize: 12.5 };
              return (
                <tr key={m} style={atual ? { background: "#FBF3DF" } : undefined}>
                  <td style={{ padding: "5px 10px", fontWeight: atual ? 800 : 500, textTransform: "uppercase", fontSize: 11.5 }}>{m}{atual ? " ◂" : ""}</td>
                  <td style={R}>{inp("r26", i, true)}</td>
                  <td style={R}>{i >= mesIdx ? inp("f26", i, true) : <span className="muted">·</span>}</td>
                  <td style={R}>{inp("cc26", i, true)}</td>
                  <td style={R}>{inp("m26", i, true)}</td>
                  <td className="num" style={{ ...R, color: "#B8860B" }}>–{R$(com)}</td>
                  <td className="num" style={{ ...R, fontWeight: 800, color: res >= 0 ? "var(--pos)" : "var(--neg)" }}>{R$(res)}</td>
                  <td className="num" style={{ ...R, paddingRight: 12, fontWeight: 700, color: acum >= 0 ? "var(--pos)" : "var(--neg)", background: "#FCF9F1" }}>{R$(acum)}</td>
                </tr>
              );
            }); })()}
            <tr style={{ borderTop: "2px solid var(--gold)", background: "#FAF6EC" }}>
              <td style={{ padding: "7px 10px", fontWeight: 800 }}>ANO</td>
              <td className="num" style={{ textAlign: "right", padding: "7px 10px", fontWeight: 800, color: "var(--pos)" }}>{R$(totR)}</td>
              <td className="num" style={{ textAlign: "right", padding: "7px 10px", color: "#7A6C4F" }}>{R$(totF)}</td>
              <td className="num" style={{ textAlign: "right", padding: "7px 10px", color: "var(--neg)" }}>–{R$(totCC)}</td>
              <td className="num" style={{ textAlign: "right", padding: "7px 10px", color: "var(--neg)" }}>–{R$(totMel)}</td>
              <td className="num" style={{ textAlign: "right", padding: "7px 10px", color: "#B8860B" }}>–{R$(totComPL)}</td>
              <td className="num" style={{ textAlign: "right", padding: "7px 10px", fontWeight: 900, color: resultadoPL >= 0 ? "var(--pos)" : "var(--neg)" }}>{R$(resultadoPL)}</td>
              <td className="num" style={{ textAlign: "right", padding: "7px 12px", fontWeight: 900, fontSize: 14, color: resultadoPL >= 0 ? "var(--pos)" : "var(--neg)" }}>{R$(resultadoPL)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 11, margin: "0 0 22px" }}>
        Tudo por competência: receita = check-in do mês · custo = consumo do mês (Bradesco na parcela devida, Light no mês da luz) · melhorias = capex separado (piscina aquecida é investimento, não custo) · comissão 15% automática sobre o faturamento. Células claras editam.
      </p>

      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 19, margin: "0 0 8px" }}>💰 Caixa — o que entrou × o que saiu (visão CFO)</h2>
      <div className="card" style={{ padding: 0, marginBottom: 6, maxWidth: 640 }}>
        <table className="data" style={{ width: "100%" }}>
          <thead><tr>
            <th style={{ padding: "8px 10px" }}>Mês</th>
            <th style={{ textAlign: "right" }}>Entrou</th>
            <th style={{ textAlign: "right" }}>Saiu<br/><span style={{ fontWeight: 400, fontSize: 10 }}>custo + comissão</span></th>
            <th style={{ textAlign: "right" }}>Fluxo</th>
            <th style={{ textAlign: "right", paddingRight: 12 }}>Acumulado</th>
          </tr></thead>
          <tbody>
            {(() => { let acc = 0; return MESES.map((m, i) => {
              if (i > mesIdx) return null;
              const ent = caixa[mkey(i)] || 0;
              const sai = (custoReal[mkey(i)] || 0) + (comissaoReal[mkey(i)] || 0);
              const fluxo = ent - sai;
              acc += fluxo; const acum = acc;
              const atual = i === mesIdx;
              const R = { textAlign: "right", padding: "5px 10px", whiteSpace: "nowrap", fontSize: 12.5 };
              return (
                <tr key={m} style={atual ? { background: "#FBF3DF" } : undefined}>
                  <td style={{ padding: "5px 10px", fontWeight: atual ? 800 : 500, textTransform: "uppercase", fontSize: 11.5 }}>{m}{atual ? " ◂" : ""}</td>
                  <td className="num" style={{ ...R, color: "var(--pos)" }}>{ent ? R$(ent) : "·"}</td>
                  <td className="num" style={{ ...R, color: "var(--neg)" }}>–{R$(sai)}</td>
                  <td className="num" style={{ ...R, fontWeight: 800, color: fluxo >= 0 ? "var(--pos)" : "var(--neg)" }}>{R$(fluxo)}</td>
                  <td className="num" style={{ ...R, paddingRight: 12, fontWeight: 700, color: acum >= 0 ? "var(--pos)" : "var(--neg)", background: "#FCF9F1" }}>{R$(acum)}</td>
                </tr>
              );
            }); })()}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 11, margin: "0 0 22px" }}>
        Caixa cru: dinheiro que ENTROU na Genco (categoria Villa) × dinheiro que SAIU (custo real + comissão paga), no mês em que se moveu. Fevereiro tem reserva paga ano passado? Aqui não aparece — e é assim mesmo: caixa é caixa.
      </p>

      {/* ═══ CUSTOS & PENDÊNCIAS ═══ */}
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 19, margin: "0 0 8px" }}>💸 O que foi pago × o que ainda cobra — jan → hoje</h2>
      <div className="card" style={{ padding: 0, marginBottom: 6 }}>
        <table className="data" style={{ width: "100%" }}>
          <thead><tr>
            <th style={{ padding: "8px 10px" }}>Mês</th>
            <th style={{ textAlign: "right" }}>Pago (real)</th>
            <th style={{ textAlign: "right" }}>Ainda a pagar</th>
            <th style={{ textAlign: "right" }}>🔴 Vencido</th>
            <th style={{ textAlign: "right" }}>Dívida acum.</th>
            <th style={{ textAlign: "right", paddingRight: 12 }}></th>
          </tr></thead>
          <tbody>
            {(() => { let dAcc = 0; return MESES.map((m, i) => {
              if (i > mesIdx) return null;
              const mk = mkey(i);
              const pago = custoReal[mk] || 0;
              const pend = pendMes(mk);
              const totP = pend.reduce((a, c) => a + Number(c.valor_previsto), 0);
              const atr = pend.filter((c) => c.vencimento && c.vencimento < hoje);
              const totA = atr.reduce((a, c) => a + Number(c.valor_previsto), 0);
              dAcc += totA; const dAcum = dAcc;
              const aberto = mesAberto === mk;
              return (
                <MesDetalhe key={m} m={m} pago={pago} totP={totP} totA={totA} dAcum={dAcum} pend={pend} aberto={aberto}
                  toggle={() => setMesAberto(aberto ? null : mk)}
                  pags={pagsVilla.filter((p) => p.data.slice(0, 7) === mk)} atual={i === mesIdx} hoje={hoje} />
              );
            }); })()}
            <tr style={{ borderTop: "2px solid var(--neg)", background: "#FBF2EF" }}>
              <td style={{ padding: "8px 10px", fontWeight: 800 }}>DÍVIDA VILLA HOJE</td>
              <td className="num" style={{ textAlign: "right", padding: "8px 10px", color: "var(--gold)" }}>{R$(custoYTD)}</td>
              <td></td>
              <td className="num" style={{ textAlign: "right", padding: "8px 10px", fontWeight: 800, color: "var(--neg)" }}>{R$(totAtras)}</td>
              <td className="num" style={{ textAlign: "right", padding: "8px 10px", fontWeight: 900, fontSize: 13.5, color: "var(--neg)" }}>{R$(totAtras + (mauricio?.saldo || 0))}</td>
              <td className="muted" style={{ fontSize: 10.5, paddingRight: 12, textAlign: "right" }}>vencidos {R$(totAtras)}<br/>+ Mauricio {R$(mauricio?.saldo || 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 11, margin: "0 0 22px" }}>Toca no mês (ou em "detalhe") pra abrir tudo: cada conta vencida com nome, cada pagamento feito.</p>

      {/* ═══ BALANÇO MAURICIO ═══ */}
      {mauricio && (() => {
        const comGeradas = cfg.r26.reduce((s, r, i) => s + (i <= mesIdx ? r * 0.15 : 0), 0);
        const comVemConf = cfg.r26.reduce((s, r, i) => s + (i > mesIdx ? r * 0.15 : 0), 0);
        const comVemFore = f26.reduce((s, r, i) => s + (i >= mesIdx ? r * 0.15 : 0), 0);
        return (
          <>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 19, margin: "0 0 8px" }}>🤝 Conta Corrente Mauricio</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 10, marginBottom: 10 }}>
              {card("SALDO DEVIDO A ELE HOJE", R$(mauricio.saldo), mauricio.saldo > 0 ? "var(--neg)" : "var(--pos)", `planilha ${mauricio.ref}`)}
              {card("Comissões geradas no ano", R$(comGeradas), "#B8860B", "15% da competência jan→hoje")}
              {card("Reembolsos de despesas", R$(mauricio.despAno || 0), "var(--neg)", "encerrados em 13/08")}
              {card("Recebido via Pix", R$(pagoMauricio), "var(--gold)", "Genco → ele, 2026")}
              {card("Retido na fonte", R$(mauricio.retido || 0), "#7A6C4F", "reservas recebidas direto")}
              {card("Comissão a vir + forecast", R$(comVemConf + comVemFore), "var(--pos)", `${R$(comVemConf)} confirmado`)}
            </div>
          </>
        );
      })()}

      {/* ═══ 2027 ═══ */}
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 19, margin: "16px 0 8px" }}>Forecast 2027 — {R$(tot27)} já vendidos</h2>
      <div className="card" style={{ padding: 0, marginBottom: 20, maxWidth: 540 }}>
        <table className="data" style={{ width: "100%" }}>
          <thead><tr><th style={{ padding: "8px 10px" }}>2027</th><th style={{ textAlign: "right" }}>Confirmado</th><th style={{ textAlign: "right", paddingRight: 12 }}>Resultado est.</th></tr></thead>
          <tbody>
            {MESES.map((m, i) => {
              const r = cfg.r27[i] * 0.85 - custoFixo;
              return (
                <tr key={m}>
                  <td style={{ padding: "4px 10px", textTransform: "uppercase", fontSize: 11.5 }}>{m}</td>
                  <td style={{ textAlign: "right", padding: "4px 10px" }}>{inp("r27", i, true)}</td>
                  <td className="num" style={{ textAlign: "right", padding: "4px 12px", fontSize: 12, color: r >= 0 ? "var(--pos)" : "var(--neg)" }}>{R$(r)}</td>
                </tr>
              );
            })}
            <tr style={{ borderTop: "2px solid var(--gold)" }}>
              <td style={{ padding: "6px 10px", fontWeight: 800 }}>ANO</td>
              <td className="num" style={{ textAlign: "right", padding: "6px 10px", fontWeight: 800, color: "var(--pos)" }}>{R$(tot27)}</td>
              <td className="num" style={{ textAlign: "right", padding: "6px 12px", fontWeight: 800 }}>{R$(tot27 * 0.85 - custoFixo * 12)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {ro && <CanalObservacao session={session} />}
    </div>
  );
}

function MesDetalhe({ m, pago, totP, totA, dAcum, pend, aberto, toggle, pags, atual, hoje }) {
  const R$ = (v) => "R$ " + Math.round(Number(v) || 0).toLocaleString("pt-BR");
  const R = { textAlign: "right", padding: "7px 10px", whiteSpace: "nowrap", fontSize: 12.5 };
  return (
    <>
      <tr onClick={toggle} style={{ cursor: "pointer", background: atual ? "#FBF3DF" : undefined }}>
        <td style={{ padding: "7px 10px", fontWeight: atual ? 800 : 500, textTransform: "uppercase", fontSize: 11.5 }}>{aberto ? "▾" : "▸"} {m}{atual ? " ◂" : ""}</td>
        <td className="num" style={{ ...R, color: pago ? "var(--gold)" : "#C8BFAA" }}>{pago ? R$(pago) : "·"}</td>
        <td className="num" style={{ ...R, color: totP ? "#B8860B" : "#C8BFAA" }}>{totP ? R$(totP) : "—"}</td>
        <td className="num" style={{ ...R, fontWeight: totA ? 800 : 400, color: totA ? "var(--neg)" : "#C8BFAA" }}>{totA ? R$(totA) : "—"}</td>
        <td className="num" style={{ ...R, fontWeight: 700, color: dAcum ? "var(--neg)" : "#C8BFAA", background: "#FCF6F3" }}>{dAcum ? R$(dAcum) : "—"}</td>
        <td style={{ ...R, paddingRight: 12 }}><a href="#" onClick={(e) => { e.preventDefault(); toggle(); }} style={{ fontSize: 11.5 }}>{aberto ? "fechar" : "detalhe"}</a></td>
      </tr>
      {aberto && (
        <tr>
          <td colSpan={6} style={{ padding: "6px 16px 14px", background: "#FCFAF4" }}>
            {pend.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, margin: "6px 0 5px", color: "#7A6C4F" }}>AINDA A PAGAR — {m.toUpperCase()}:</div>
                {[...pend].sort((a, b) => (a.vencimento || "9") < (b.vencimento || "9") ? -1 : 1).map((c) => {
                  const venc = c.vencimento && c.vencimento < hoje;
                  return (
                    <div key={c.id} style={{ fontSize: 13, padding: "3px 0", fontWeight: venc ? 700 : 400, color: venc ? "var(--neg)" : undefined }}>
                      {venc ? "🔴" : "○"} {c.descricao} — <span className="num">{R$(c.valor_previsto)}</span>
                      {c.vencimento && <span className="muted" style={{ fontWeight: 400 }}> · {venc ? "VENCEU" : "vence"} {c.vencimento.slice(8, 10)}/{c.vencimento.slice(5, 7)}</span>}
                      {c.obs && <div className="muted" style={{ fontSize: 11, fontWeight: 400, marginLeft: 20 }}>{c.obs}</div>}
                    </div>
                  );
                })}
              </div>
            )}
            {pags.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, margin: "6px 0 5px", color: "#7A6C4F" }}>PAGO NO MÊS ({pags.length} lançamentos — maiores):</div>
                {[...pags].sort((a, b) => b.valor - a.valor).slice(0, 12).map((p, i) => (
                  <div key={i} className="muted" style={{ fontSize: 12, padding: "1px 0" }}>
                    ✓ {p.data.slice(8, 10)}/{p.data.slice(5, 7)} · {p.favorecido} — <span className="num">{R$(p.valor)}</span>
                  </div>
                ))}
                {pags.length > 12 && <div className="muted" style={{ fontSize: 11 }}>… +{pags.length - 12} no Caixa</div>}
              </div>
            )}
            {pend.length === 0 && pags.length === 0 && <span className="muted" style={{ fontSize: 12 }}>Nada registrado.</span>}
          </td>
        </tr>
      )}
    </>
  );
}

function CanalObservacao({ session }) {
  const [obs, setObs] = useState("");
  const [ok, setOk] = useState(false);
  const enviar = async () => {
    if (!obs.trim()) return;
    const { error } = await supabase.from("registros").insert({
      categoria: "Mauricio", texto: "OBSERVAÇÃO DO MAURICIO (via sistema): " + obs.trim(), criado_por: session.user.email });
    if (error) { alert("Erro: " + error.message); return; }
    setObs(""); setOk(true); setTimeout(() => setOk(false), 4000);
  };
  return (
    <div className="card" style={{ padding: 16, marginTop: 8 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>💬 Viu algo errado ou diferente da sua planilha? Fala aqui</div>
      <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3}
        placeholder="Ex.: a comissão do hóspede X não entrou / o valor Y está diferente…"
        style={{ width: "100%", fontSize: 13.5, padding: 10 }} />
      <button className="primary" style={{ marginTop: 8 }} onClick={enviar}>Enviar pro Angelo</button>
      {ok && <span style={{ color: "var(--pos)", marginLeft: 10, fontSize: 13 }}>✓ Enviado — o Angelo vê no próximo briefing</span>}
    </div>
  );
}
