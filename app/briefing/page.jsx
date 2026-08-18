"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

const R$ = (v) => "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export default function Briefing() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const [desde, setDesde] = useState(ontem);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const gerar = useCallback(async () => {
    setCarregando(true);
    const iso = desde + "T00:00:00";
    const L = [];
    L.push(`BRIEFING — Angelo's Life Companion`);
    L.push(`Período: desde ${desde.split("-").reverse().join("/")} · gerado ${new Date().toLocaleString("pt-BR")}`);

    const { data: pags } = await supabase.from("pagamentos").select("*").gte("created_at", iso).order("created_at");
    L.push(`\n═══ CAIXA — pagamentos lançados (${(pags || []).length}) ═══`);
    (pags || []).forEach((p) => L.push(
      `• ${p.data?.slice(8,10)}/${p.data?.slice(5,7)} · ${p.favorecido} · ${R$(p.valor)} · ${p.categoria}${p.estornado ? " · ESTORNADO" : ""}${p.obs ? " · " + p.obs : ""}${p.comprovante_url ? "\n  comprovante: " + p.comprovante_url : ""} [por ${p.criado_por?.split("@")[0]}]`
    ));

    const { data: rcs } = await supabase.from("receitas").select("*").gte("created_at", iso).order("created_at");
    L.push(`\n═══ RECEITAS — entradas lançadas (${(rcs || []).length}) ═══`);
    (rcs || []).forEach((r) => L.push(`• ${r.data?.slice(8,10)}/${r.data?.slice(5,7)} · ${r.origem} · ${R$(r.valor)} · ${r.categoria}${r.obs ? " · " + r.obs : ""} [por ${r.criado_por?.split("@")[0]}]`));

    const { data: regs } = await supabase.from("registros").select("*").gte("created_at", iso).order("created_at");
    L.push(`\n═══ MESA LEGAL — registros (${(regs || []).length}) ═══`);
    (regs || []).forEach((r) => L.push(
      `• [${r.categoria}] ${r.texto}${r.doc_url ? "\n  documento: " + r.doc_url : ""} [por ${r.criado_por?.split("@")[0]}, ${new Date(r.created_at).toLocaleDateString("pt-BR")}]`
    ));

    const { data: tars } = await supabase.from("tarefas").select("*").gte("feito_em", iso).eq("feito", true).order("feito_em");
    L.push(`\n═══ TAREFAS CONCLUÍDAS (${(tars || []).length}) ═══`);
    (tars || []).forEach((t) => L.push(
      `• ✓ ${t.titulo} [${t.para}, por ${t.feito_por?.split("@")[0]}]${t.resposta ? "\n  resposta: " + t.resposta : ""}${t.arquivo_url ? "\n  entrega: " + t.arquivo_url : ""}`
    ));

    const { data: contas } = await supabase.from("contas").select("*").eq("pago", true).gte("pago_em", desde).order("pago_em");
    L.push(`\n═══ CONTAS MARCADAS COMO PAGAS (${(contas || []).length}) ═══`);
    (contas || []).forEach((c) => L.push(
      `• ${c.descricao} · previsto ${R$(c.valor_previsto)} · pago ${R$(c.valor_pago ?? c.valor_previsto)} em ${c.pago_em?.split("-").reverse().join("/")}`
    ));

    const { data: comsP } = await supabase.from("pagamentos").select("*").not("comentario", "is", null).gte("data", new Date(Date.now() - 40*86400000).toISOString().slice(0,10));
    (comsP || []).forEach((p) => L.push(`• [Caixa ${p.data?.slice(8,10)}/${p.data?.slice(5,7)}] ${p.favorecido} (${R$(p.valor)}): "${p.comentario}"`));
    const { data: comsR } = await supabase.from("receitas").select("*").not("comentario", "is", null).gte("data", new Date(Date.now() - 40*86400000).toISOString().slice(0,10));
    (comsR || []).forEach((p) => L.push(`• [Receita ${p.data?.slice(8,10)}/${p.data?.slice(5,7)}] ${p.origem} (${R$(p.valor)}): "${p.comentario}"`));
    const { data: coms } = await supabase.from("contas").select("*").not("comentario", "is", null).gte("mes", new Date(Date.now() - 40*86400000).toISOString().slice(0,7)).order("mes");
    L.push(`\n═══ 💬 COMENTÁRIOS NAS CONTAS (${(coms || []).length}) ═══`);
    (coms || []).forEach((c) => L.push(`• [${c.mes}] ${c.descricao} (${R$(c.valor_previsto)}${c.pago ? ", paga" : ", em aberto"}): "${c.comentario}"`));

    const { data: exts } = await supabase.from("extratos").select("*").gte("created_at", iso).order("created_at");
    L.push(`\n═══ EXTRATOS/FATURAS SUBIDOS (${(exts || []).length}) ═══`);
    (exts || []).forEach((e) => L.push(`• [${e.tipo}] ${e.mes} · ${e.nome_arquivo}\n  arquivo: ${e.arquivo_url} [por ${e.criado_por?.split("@")[0]}]`));

    const { data: pend } = await supabase.from("tarefas").select("*").eq("mes", new Date().toISOString().slice(0, 7)).eq("feito", false).order("prioridade");
    L.push(`\n═══ AINDA PENDENTE NO MÊS (${(pend || []).length}) ═══`);
    (pend || []).forEach((t) => L.push(`• [${t.para}] ${t.titulo}${t.prioridade === 1 ? " 🔴" : ""}`));

    L.push(`\n— fim do briefing. Claude: elabora, aponta o que vira dado (SQL) e o que vira ação.`);
    setTexto(L.join("\n"));
    setCarregando(false);
  }, [desde]);

  useEffect(() => { if (perfil?.role === "admin") gerar(); }, [perfil, gerar]);

  const copiar = async () => {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (perfil && perfil.role !== "admin")
    return <div className="container muted">O Briefing é só do capo.</div>;

  return (
    <div className="container" style={{ maxWidth: 920 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">📰 Briefing pro Claude</h1>
      <p className="muted" style={{ fontSize: 14, margin: "4px 0 16px" }}>
        Tudo que a equipe colocou no sistema, compilado. Copia → cola no Claude → "elabora".
      </p>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <label className="muted" style={{ fontSize: 13 }}>Desde:</label>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ width: 160 }} />
        <button className="ghost" onClick={gerar} disabled={carregando}>{carregando ? "Gerando…" : "↻ Regenerar"}</button>
        <button className="primary" onClick={copiar} style={{ marginLeft: "auto" }}>
          {copiado ? "✓ Copiado!" : "📋 Copiar briefing"}
        </button>
      </div>
      <textarea readOnly value={texto} rows={24} style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, lineHeight: 1.5, resize: "vertical" }} />
    </div>
  );
}
