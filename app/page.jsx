"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

const MODULOS = [
  { href: "/briefing", titulo: "📰 Briefing pro Claude", desc: "Compila tudo que a equipe colocou — copiar e colar no Claude.", roles: ["admin"] },
  { href: "/atividade", titulo: "Atividade", desc: "Quem fez o quê, dia a dia — o diário de bordo automático.", roles: ["admin"] },
  { href: "/cockpit", titulo: "Cockpit", desc: "Fluxo de caixa 9 meses, cenários, envelope Viareggio.", roles: ["admin"] },
  { href: "/tarefas", titulo: "Tarefas do Mês", desc: "Criar e acompanhar o que o sistema pede de cada um.", roles: ["admin"] },
  { href: "/mes", titulo: "Mapa do Mês", desc: "A foto inteira: previsto, pago, falta, atrasadas.", roles: ["admin", "financeiro"] },
  { href: "/contas", titulo: "Contas do Mês", desc: "O que vence, quando, quanto — pago, pendente, atrasado.", roles: ["admin", "financeiro"] },
  { href: "/villa", titulo: "🏛 Villa Irvana Business", desc: "O negócio Villa: competência, caixa, comissões e forecast 2026-27.", roles: ["admin", "financeiro", "parceiro"] },
  { href: "/cartao", titulo: "💳 Cartões", desc: "Fatura Inter por pessoa e categoria, mês a mês.", roles: ["admin"] },
  { href: "/banco", titulo: "🏦 Banco Inter", desc: "Extrato completo, todos os meses, com busca e categoria.", roles: ["admin", "financeiro"] },
  { href: "/angelito", titulo: "🧠 Diário do Angelito", desc: "Notas do dia, conversas e arquivos processados.", roles: ["admin", "financeiro"] },
  { href: "/receitas", titulo: "Receitas", desc: "Tudo que entra: reservas, TIM, NTalks — com comprovante.", roles: ["admin", "financeiro"] },
  { href: "/conciliacao", titulo: "Conciliação", desc: "Extrato do banco × sistema: o que falta lançar, em 1 clique.", roles: ["admin", "financeiro"] },
  { href: "/caixa", titulo: "Caixa", desc: "Registrar pagamentos com comprovante. Estorno auditável.", roles: ["admin", "financeiro"] },
  { href: "/relatorios", titulo: "Relatórios", desc: "Mês a mês, por categoria e por favorecido.", roles: ["admin", "financeiro"] },
  { href: "/fornecedores", titulo: "Fornecedores", desc: "Cadastro: nome, contato, PIX/conta, categoria.", roles: ["admin", "financeiro"] },
  { href: "/extratos", titulo: "Extratos & Faturas", desc: "Arquivo mensal: extrato da conta e fatura do cartão.", roles: ["admin", "financeiro"] },
  { href: "/empresas", titulo: "Empresas do Grupo", desc: "Todas as empresas, situação e processos ativos de cada uma.", roles: ["admin", "financeiro", "juridico"] },
  { href: "/mapa-legal", titulo: "Mapa Legal", desc: "Situação total: prazos, empresas, advogados, urgências.", roles: ["admin", "juridico"] },
  { href: "/mesa", titulo: "Mesa Legal", desc: "Registros, documentos e comentários do jurídico.", roles: ["admin", "juridico"] },
  { href: "/advogados", titulo: "Advogados & Processos", desc: "Quem cuida do quê, status e próximos prazos.", roles: ["admin", "juridico"] },
  { href: "/ajuda", titulo: "❓ Como funciona", desc: "O guia de bordo: o que é cada coisa e como usar.", roles: ["admin", "financeiro", "juridico"] },
];
const PRIO = { 1: { bg: "#FBEAE4", fg: "var(--neg)" }, 2: { bg: "#F3E4C2", fg: "#7A5A10" }, 3: { bg: "var(--surface2)", fg: "var(--muted)" } };

export default function Home() {
  return <AuthGate>{({ session }) => <HomeInner session={session} />}</AuthGate>;
}

function HomeInner({ session }) {
  const perfil = useRole(session);
  const [verComo, setVerComo] = useState(null); // admin: null=eu, "financeiro", "juridico"
  const [tarefas, setTarefas] = useState([]);
  const [aberta, setAberta] = useState(null);      // tarefa expandida p/ entrega
  const [respostaTxt, setRespostaTxt] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [entregando, setEntregando] = useState(false);
  const [erroT, setErroT] = useState("");
  const mes = new Date().toISOString().slice(0, 7);

  const carregar = useCallback(async () => {
    if (!perfil || perfil.role === "none") return;
    const roleVisao = perfil.role === "admin" && verComo ? verComo : perfil.role;
    let q = supabase.from("tarefas").select("*").eq("mes", mes).order("prioridade").order("created_at");
    if (roleVisao !== "admin") q = q.eq("para", roleVisao);
    const { data } = await q;
    setTarefas(data || []);
  }, [perfil, mes, verComo]);
  useEffect(() => { carregar(); }, [carregar]);

  const toggle = async (t) => {
    if (t.feito) { // desfazer mantém a entrega registrada
      await supabase.from("tarefas").update({ feito: false, feito_por: null, feito_em: null }).eq("id", t.id);
      setAberta(null); carregar(); return;
    }
    if (t.exige && t.exige !== "nenhum") { // pede a entrega antes de completar
      setAberta(t.id); setRespostaTxt(""); setArquivo(null); setErroT("");
      return;
    }
    await supabase.from("tarefas").update({
      feito: true, feito_por: session.user.email, feito_em: new Date().toISOString(),
    }).eq("id", t.id);
    carregar();
  };

  const concluirComEntrega = async (t) => {
    setErroT(""); setEntregando(true);
    try {
      const upd = { feito: true, feito_por: session.user.email, feito_em: new Date().toISOString() };
      if (t.exige === "resposta") {
        if (!respostaTxt.trim()) { setErroT("Escreve a resposta pra concluir."); setEntregando(false); return; }
        upd.resposta = respostaTxt.trim();
      }
      if (t.exige === "arquivo") {
        if (!arquivo) { setErroT("Anexa o arquivo pra concluir."); setEntregando(false); return; }
        const path = `tarefas/${t.mes}-${Date.now()}-${arquivo.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("docs").upload(path, arquivo);
        if (upErr) throw upErr;
        upd.arquivo_url = supabase.storage.from("docs").getPublicUrl(path).data.publicUrl;
        if (respostaTxt.trim()) upd.resposta = respostaTxt.trim();
      }
      const { error } = await supabase.from("tarefas").update(upd).eq("id", t.id);
      if (error) throw error;
      setAberta(null); setArquivo(null); setRespostaTxt("");
      carregar();
    } catch (e2) { setErroT(e2.message || "Erro ao concluir"); }
    setEntregando(false);
  };

  if (!perfil) return <div className="container muted">Carregando teu perfil…</div>;
  const roleVisao = perfil.role === "admin" && verComo ? verComo : perfil.role;
  const meus = MODULOS.filter((m) => m.roles.includes(roleVisao));
  const abertas = tarefas.filter((t) => !t.feito);
  const feitas = tarefas.filter((t) => t.feito);

  return (
    <div className="container" style={{ maxWidth: 920 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div className="eyebrow">Angelo's Life Companion</div>
          <h1 className="display">Ciao, {perfil.nome}</h1>
        </div>
        <div style={{ fontSize: 12, display: "flex", gap: 10, alignItems: "center" }} className="muted">
          {perfil.role === "admin" && (
            <select value={verComo || ""} onChange={(e) => setVerComo(e.target.value || null)}
              style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}>
              <option value="">👁 minha visão</option>
              <option value="financeiro">👁 ver como Letícia</option>
              <option value="juridico">👁 ver como Priscilla</option>
            </select>
          )}
          <span>{perfil.role}</span> · <a href="#" onClick={(e) => { e.preventDefault(); supabase.auth.signOut(); }}>sair</a>
        </div>
      </div>

      {perfil.role === "none" ? (
        <p className="muted" style={{ marginTop: 24 }}>Teu email ainda não tem perfil — fala com o Angelo.</p>
      ) : (
        <>
          {(abertas.length > 0 || feitas.length > 0) && (
            <div className="card" style={{ margin: "20px 0 6px", borderLeft: "4px solid var(--gold)" }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, marginBottom: 4 }}>
                O que preciso de você — {["", "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][+mes.slice(5)]}
              </div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
                {abertas.length} pendente{abertas.length !== 1 ? "s" : ""} · {feitas.length} feita{feitas.length !== 1 ? "s" : ""}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...abertas, ...feitas].map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, opacity: t.feito ? 0.55 : 1 }}>
                    <input type="checkbox" checked={t.feito} onChange={() => toggle(t)} style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--gold)", cursor: "pointer" }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, textDecoration: t.feito ? "line-through" : "none" }}>{t.titulo}</span>
                      {perfil.role === "admin" && !verComo && <span className="badge" style={{ marginLeft: 8 }}>{t.para}</span>}
                      {!t.feito && <span className="badge" style={{ marginLeft: 8, background: PRIO[t.prioridade]?.bg, color: PRIO[t.prioridade]?.fg, borderColor: "transparent" }}>{t.prioridade === 1 ? "urgente" : t.prioridade === 2 ? "no mês" : "quando der"}</span>}
                      {t.detalhe && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t.detalhe}</div>}
                    {t.feito && (t.resposta || t.arquivo_url) && (
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          {t.resposta && <div style={{ color: "var(--pos)" }}>💬 {t.resposta}</div>}
                          {t.arquivo_url && <a href={t.arquivo_url} target="_blank" rel="noreferrer">📎 entrega anexada</a>}
                        </div>
                      )}
                      {aberta === t.id && !t.feito && (
                        <div className="card" style={{ marginTop: 8, padding: 12, display: "grid", gap: 8, background: "var(--surface2)" }}>
                          {t.exige === "arquivo" && <input type="file" onChange={(e) => setArquivo(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />}
                          <textarea rows={2} placeholder={t.exige === "arquivo" ? "Comentário (opcional)" : "Tua resposta *"} value={respostaTxt} onChange={(e) => setRespostaTxt(e.target.value)} style={{ resize: "vertical", fontSize: 13 }} />
                          {erroT && <span style={{ color: "var(--neg)", fontSize: 12 }}>{erroT}</span>}
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="primary" disabled={entregando} onClick={() => concluirComEntrega(t)} style={{ padding: "7px 16px", fontSize: 13 }}>
                              {entregando ? "Enviando…" : "✓ Concluir com entrega"}
                            </button>
                            <button className="ghost" onClick={() => setAberta(null)} style={{ padding: "7px 12px", fontSize: 12 }}>cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                    {t.link && !t.feito && aberta !== t.id && <a href={t.link} className="ghost" style={{ padding: "4px 12px", fontSize: 12, whiteSpace: "nowrap", borderRadius: 8 }}>ir lá →</a>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 20 }}>
            {meus.map((m) => (
              <a key={m.href} href={m.href} className="card" style={{ display: "block" }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "var(--text)" }}>{m.titulo}</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{m.desc}</div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
