"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

const R$ = (v) => "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const quem = (e) => (e || "sistema").split("@")[0];

export default function Atividade() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const [eventos, setEventos] = useState([]);
  const [dias, setDias] = useState(7);
  const [aba, setAba] = useState("equipe"); // equipe | sistema
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const iso = new Date(Date.now() - dias * 86400000).toISOString();
    const evs = [];

    const { data: pags } = await supabase.from("pagamentos").select("*").gte("created_at", iso).order("created_at", { ascending: false }).limit(150);
    (pags || []).forEach((p) => {
      evs.push({ t: p.created_at, quem: quem(p.criado_por), icone: "💸", txt: `lançou no Caixa: ${p.favorecido} · ${R$(p.valor)} · ${p.categoria}` });
      if (p.estornado && p.estornado_em >= iso) evs.push({ t: p.estornado_em, quem: quem(p.estornado_por), icone: "↩️", txt: `estornou: ${p.favorecido} · ${R$(p.valor)}` });
    });

    const { data: regs } = await supabase.from("registros").select("*").gte("created_at", iso).limit(100);
    (regs || []).forEach((r) => evs.push({ t: r.created_at, quem: quem(r.criado_por), icone: "⚖️", txt: `registrou na Mesa [${r.categoria}]: ${r.texto.slice(0, 90)}${r.doc_url ? " 📎" : ""}` }));

    const { data: tars } = await supabase.from("tarefas").select("*").eq("feito", true).gte("feito_em", iso).limit(100);
    (tars || []).forEach((t) => evs.push({ t: t.feito_em, quem: quem(t.feito_por), icone: "✅", txt: `concluiu: ${t.titulo}${t.resposta ? ` — "${t.resposta.slice(0, 70)}"` : ""}${t.arquivo_url ? " 📎" : ""}` }));

    const { data: contas } = await supabase.from("contas").select("*").eq("pago", true).gte("pago_em", iso.slice(0, 10)).limit(100);
    (contas || []).forEach((c) => evs.push({ t: c.pago_em + "T12:00:00", quem: quem(c.pago_por || "financeiro"), icone: "🧾", txt: `marcou paga: ${c.descricao} · ${R$(c.valor_pago ?? c.valor_previsto)}` }));

    const { data: exts } = await supabase.from("extratos").select("*").gte("created_at", iso).limit(50);
    (exts || []).forEach((e) => evs.push({ t: e.created_at, quem: quem(e.criado_por), icone: "📄", txt: `arquivou [${e.tipo}] ${e.mes}: ${e.nome_arquivo}` }));

    const { data: forns } = await supabase.from("fornecedores").select("*").gte("created_at", iso).limit(50);
    (forns || []).forEach((f) => evs.push({ t: f.created_at, quem: quem(f.criado_por), icone: "🏷️", txt: `cadastrou fornecedor: ${f.nome}` }));

    const { data: procs } = await supabase.from("processos").select("*").gte("created_at", iso).limit(50);
    (procs || []).filter((p) => p.criado_por !== "seed").forEach((p) => evs.push({ t: p.created_at, quem: quem(p.criado_por), icone: "📁", txt: `cadastrou processo: ${p.titulo.slice(0, 80)}` }));

    const NAO_HUMANOS = ["claude", "extrato-import", "seed", "sistema"];
    evs.forEach((e) => { e.humano = !NAO_HUMANOS.includes((e.quem || "").toLowerCase()); });
    evs.sort((a, b) => (a.t < b.t ? 1 : -1));
    setEventos(evs);
    setCarregando(false);
  }, [dias]);
  useEffect(() => { carregar(); }, [carregar]);

  if (perfil && perfil.role !== "admin")
    return <div className="container muted">A Atividade é só do capo.</div>;

  const visiveis = eventos.filter((e) => (aba === "equipe" ? e.humano : !e.humano));
  const porDia = {};
  visiveis.forEach((e) => {
    const d = new Date(e.t).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
    (porDia[d] = porDia[d] || []).push(e);
  });

  return (
    <div className="container" style={{ maxWidth: 820 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">Atividade</h1>
      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <button className={aba === "equipe" ? "primary" : ""} onClick={() => setAba("equipe")} style={{ fontSize: 13 }}>
          👥 Equipe (Angelo · Letícia · Priscilla)
        </button>
        <button className={aba === "sistema" ? "primary" : ""} onClick={() => setAba("sistema")} style={{ fontSize: 13 }}>
          🤖 Sistema (Claude · imports)
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0 18px" }}>
        <span className="muted" style={{ fontSize: 13 }}>Quem fez o quê nos últimos</span>
        {[3, 7, 30].map((d) => (
          <button key={d} className={dias === d ? "primary" : "ghost"} onClick={() => setDias(d)} style={{ padding: "6px 14px", fontSize: 13 }}>{d} dias</button>
        ))}
      </div>

      {carregando && <div className="muted">Reunindo os rastros…</div>}
      {!carregando && eventos.length === 0 && <div className="muted" style={{ fontStyle: "italic" }}>Silêncio no período — ninguém mexeu em nada.</div>}

      {Object.entries(porDia).map(([dia, evs]) => (
        <div key={dia} style={{ marginBottom: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{dia} · {evs.length} ações</div>
          <div className="card" style={{ padding: "6px 16px" }}>
            {evs.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "7px 0", borderBottom: i < evs.length - 1 ? "1px solid #F0E8D5" : "none", fontSize: 13.5 }}>
                <span>{e.icone}</span>
                <span className="muted num" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                  {new Date(e.t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span><b style={{ color: "var(--gold)" }}>{e.quem}</b> {e.txt}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
