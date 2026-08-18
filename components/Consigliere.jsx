"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Consigliere({ compacto = false }) {
  const [nota, setNota] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);       // rodar / nota
  const [pensando, setPensando] = useState(false); // chat
  const [fio, setFio] = useState([]);              // [{q, a, erro}]
  const [erro, setErro] = useState(null);
  const [aberto, setAberto] = useState(false);

  const carregar = async () => {
    const { data } = await supabase.from("cerebro_notas").select("*").eq("tipo", "nota_dia").order("criado_em", { ascending: false }).limit(1);
    setNota(data?.[0] || null);
  };
  useEffect(() => { carregar(); }, []);

  const [relatorio, setRelatorio] = useState(null);
  const rodar = async () => {
    setBusy(true); setErro(null); setRelatorio(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/cerebro", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ acao: "rodar" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "erro");
      setRelatorio(j.processados || []);
      await carregar();
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) { setErro(String(e.message || e)); }
    setBusy(false);
  };
  const chamar = async (pergunta) => {
    if (pergunta) { setPensando(true); setFio((f) => [...f, { q: pergunta, a: null }]); setQ(""); } else { setBusy(true); setErro(null); }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/cerebro", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify(pergunta ? { pergunta, historico: fio.filter((m) => m.a).map((m) => ({ q: m.q, a: m.a })) } : {}) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "erro");
      if (pergunta) setFio((f) => f.map((m, i) => i === f.length - 1 ? { ...m, a: j.texto } : m)); else await carregar();
    } catch (e) {
      if (pergunta) setFio((f) => f.map((m, i) => i === f.length - 1 ? { ...m, erro: String(e.message || e) } : m)); else setErro(String(e.message || e));
    }
    if (pergunta) setPensando(false); else setBusy(false);
  };
  const limpo = (t) => (t || "").replace(/\*\*/g, "").replace(/^#+\s*/gm, "").replace(/^\s*[-*]\s+/gm, "• ").trim();
  const quando = (t) => t ? new Date(t).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

  const naoLida = nota && !aberto;
  return (
    <>
      {/* botão flutuante */}
      {!aberto && (
        <button onClick={() => setAberto(true)} title="Angelito — teu consigliere"
          style={{ position: "fixed", right: 18, bottom: 18, zIndex: 60, borderRadius: 999, padding: "10px 16px", background: "#4E3A78", color: "#fff", border: "none", boxShadow: "0 8px 24px rgba(78,58,120,.35)", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          🧠 Angelito {naoLida && <span style={{ width: 8, height: 8, borderRadius: 4, background: "#E8B84B", display: "inline-block" }} />}
        </button>
      )}
      {/* gaveta lateral */}
      {aberto && (
        <>
          <div onClick={() => setAberto(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.18)", zIndex: 59 }} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(420px, 94vw)", zIndex: 61, background: "#F8F4FC", borderLeft: "2px solid #8A6FB8", boxShadow: "-12px 0 32px rgba(0,0,0,.15)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #E4D9F2", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, color: "#4E3A78" }}>🧠 Angelito</div>
                <div className="muted" style={{ fontSize: 11 }}>{nota ? `nota de ${quando(nota.criado_em)}` : "sem nota ainda"}</div>
              </div>
              <button className="ghost" onClick={() => setAberto(false)} style={{ padding: "4px 10px", fontSize: 12 }}>✕</button>
            </div>
            <div style={{ padding: "10px 16px", display: "flex", gap: 6, borderBottom: "1px solid #E4D9F2" }}>
              <button className="primary" disabled={busy || pensando} onClick={rodar} style={{ padding: "6px 12px", fontSize: 12, flex: 1 }}>{busy ? "trabalhando…" : "▶ Rodar o Companion"}</button>
              <button className="ghost" disabled={busy || pensando} onClick={() => chamar(null)} style={{ padding: "5px 10px", fontSize: 11.5 }}>↻ só a nota</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {relatorio && (
                <div style={{ fontSize: 11.5, marginBottom: 10, padding: "6px 10px", background: "#EFE8F7", borderRadius: 8 }}>
                  {relatorio.length === 0 ? "nada novo no storage — recalculado" : relatorio.map((p, i) => (
                    <div key={i}>📄 <b>{p.nome}</b>: {p.erro ? `⚠️ ${p.erro}` : p.tipo === "extrato" ? `${p.lancadas_saidas} saídas + ${p.lancadas_entradas} entradas · ${p.confirmadas} confirmadas · ${p.contas_pagas?.length || 0} contas pagas · saldo ${p.saldo}` : p.tipo === "fatura" ? `fatura ${p.mes}: ${p.linhas} categorias, R$ ${Math.round(p.total || 0)}` : p.motivo}</div>
                  ))}
                </div>
              )}
              {fio.length === 0 && !relatorio && (
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                  Pergunta o que quiser: <i>"quanto tem em caixa?"</i> · <i>"o que pago agora?"</i> · <i>"a Light da Villa vence quando?"</i> · <i>"me dá o relatório"</i>.<br />
                  {nota && <details style={{ marginTop: 8 }}><summary style={{ cursor: "pointer", fontSize: 12 }}>última nota do dia ({quando(nota.criado_em)})</summary><div style={{ fontSize: 12.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.5, marginTop: 6 }}>{limpo(nota.texto)}</div></details>}
                </div>
              )}
              {fio.map((m, i) => (
                <div key={i} style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12.5, padding: "6px 10px", background: "#E8DFF5", borderRadius: "10px 10px 2px 10px", marginLeft: 40, color: "#3E2E63" }}>{m.q}</div>
                  <div style={{ fontSize: 13, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.55, marginTop: 6, padding: "10px 12px", background: "#fff", borderRadius: "10px 10px 10px 2px", border: "1px solid #E4D9F2", marginRight: 30 }}>
                    {m.erro ? <span style={{ color: "var(--neg)", fontSize: 12 }}>⚠️ {m.erro}</span> : m.a ? limpo(m.a) : <span className="muted">Angelito pensando…</span>}
                  </div>
                </div>
              ))}
              {erro && <div style={{ fontSize: 11.5, color: "var(--neg)", marginTop: 8 }}>⚠️ {erro}</div>}
            </div>
            <div className="muted" style={{ fontSize: 10.5, padding: "4px 16px 0" }}><a href="/angelito" style={{ fontWeight: 700 }}>📓 diário completo →</a> · 🕒 agora {new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · o Angelito diz na nota até quando os dados valem</div>
            {(
              <div style={{ padding: "8px 16px 14px", borderTop: "1px solid #E4D9F2", display: "flex", gap: 6, marginTop: 6 }}>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="pergunta ao Angelito…"
                  onKeyDown={(e) => { if (e.key === "Enter" && q.trim() && !pensando) chamar(q.trim()); }} style={{ flex: 1, fontSize: 12.5 }} />
                <button className="primary" disabled={pensando || !q.trim()} onClick={() => chamar(q.trim())} style={{ padding: "6px 12px", fontSize: 12 }}>{pensando ? "…" : "→"}</button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
