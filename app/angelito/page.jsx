"use client";
import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";
import Consigliere from "@/components/Consigliere";

const limpo = (t) => (t || "").replace(/\*\*/g, "").replace(/^#+\s*/gm, "").replace(/^\s*[-*]\s+/gm, "• ").trim();
const quando = (t) => new Date(t).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function Angelito() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}
function Inner() {
  const [notas, setNotas] = useState(null);
  const [arqs, setArqs] = useState([]);
  const [filtro, setFiltro] = useState("todas");
  useEffect(() => {
    supabase.from("cerebro_notas").select("*").order("criado_em", { ascending: false }).limit(200).then(({ data }) => setNotas(data || []));
    supabase.from("cerebro_arquivos").select("*").order("processado_em", { ascending: false }).limit(50).then(({ data }) => setArqs(data || []));
  }, []);
  if (!notas) return <div className="container muted">Abrindo o diário do Angelito…</div>;
  const lista = notas.filter((n) => filtro === "todas" || n.tipo === filtro);
  return (
    <div className="container" style={{ maxWidth: 820 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">🧠 Diário do Angelito</h1>
      <p className="muted" style={{ fontSize: 13, margin: "4px 0 14px" }}>Tudo que ele escreveu e processou — notas do dia, respostas às tuas perguntas e os arquivos que rodou. Pra conversar, usa o botão 🧠 no canto.</p>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["todas", "tudo"], ["nota_dia", "📋 notas do dia"], ["resposta", "💬 conversas"]].map(([v, l]) => (
          <button key={v} className={filtro === v ? "primary" : "ghost"} onClick={() => setFiltro(v)} style={{ padding: "5px 12px", fontSize: 12 }}>{l}</button>
        ))}
      </div>

      {arqs.length > 0 && (
        <details className="card" style={{ marginBottom: 14, padding: "10px 14px" }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700 }}>📄 Arquivos processados pelo Companion ({arqs.length})</summary>
          <div style={{ marginTop: 8 }}>
            {arqs.map((a) => (
              <div key={a.nome} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px dashed #E8DFC8" }}>
                <span className="muted">{quando(a.processado_em)}</span> · <b>{a.nome}</b>
                {a.resumo && <span className="muted"> — {a.resumo.tipo === "extrato" ? `${a.resumo.lancadas_saidas || 0} saídas · ${a.resumo.lancadas_entradas || 0} entradas · ${a.resumo.confirmadas || 0} confirmadas · ${(a.resumo.contas_pagas || []).length} contas pagas${a.resumo.saldo != null ? ` · saldo ${a.resumo.saldo}` : ""}` : a.resumo.tipo === "fatura" ? `fatura ${a.resumo.mes} · R$ ${Math.round(a.resumo.total || 0)}` : a.resumo.motivo || a.resumo.tipo}</span>}
              </div>
            ))}
          </div>
        </details>
      )}

      {lista.length === 0 && <p className="muted">Nada ainda nesse filtro.</p>}
      {lista.map((n) => (
        <div key={n.id} className="card" style={{ marginBottom: 10, padding: "12px 16px", borderLeft: `4px solid ${n.tipo === "resposta" ? "#8A6FB8" : "var(--gold)"}` }}>
          <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{n.tipo === "resposta" ? "💬 conversa" : "📋 nota do dia"} · {quando(n.criado_em)}</div>
          {n.pergunta && <div style={{ fontSize: 12.5, fontWeight: 700, color: "#3E2E63", marginBottom: 4 }}>Angelo: {n.pergunta}</div>}
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.5 }}>{limpo(n.texto)}</div>
        </div>
      ))}
      <Consigliere />
    </div>
  );
}
