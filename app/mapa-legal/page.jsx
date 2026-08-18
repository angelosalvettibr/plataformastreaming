"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

const hoje = () => new Date().toISOString().slice(0, 10);

export default function MapaLegal() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const [procs, setProcs] = useState([]);
  const [empresas, setEmpresas] = useState([]);

  const carregar = useCallback(async () => {
    const { data: p } = await supabase.from("processos").select("*");
    setProcs(p || []);
    const { data: e } = await supabase.from("empresas").select("nome");
    setEmpresas(e || []);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  if (perfil && !["admin", "juridico"].includes(perfil.role))
    return <div className="container muted">Sem acesso a este módulo.</div>;

  const ativos = procs.filter((p) => p.status !== "Encerrado");
  const emDias = (p, d) => p.proximo_prazo && p.proximo_prazo >= hoje() && (new Date(p.proximo_prazo) - new Date(hoje())) / 86400000 <= d;
  const vencidos = ativos.filter((p) => p.proximo_prazo && p.proximo_prazo < hoje());
  const prox7 = ativos.filter((p) => emDias(p, 7));
  const prox30 = ativos.filter((p) => emDias(p, 30));
  const semPrazo = ativos.filter((p) => !p.proximo_prazo);

  const grupo = (lista, chave) => {
    const g = {};
    lista.forEach((p) => { const k = p[chave] || "—"; g[k] = (g[k] || 0) + 1; });
    return Object.entries(g).sort((a, b) => b[1] - a[1]);
  };
  const porEmpresa = grupo(ativos, "empresa");
  const porStatus = grupo(procs, "status");
  const porAdv = grupo(ativos, "advogado");
  const tipoDe = (t) => (t?.match(/^\[(\w+)\]/) || [])[1] || "OUTRO";
  const porTipo = {};
  ativos.forEach((p) => { const k = tipoDe(p.titulo); porTipo[k] = (porTipo[k] || 0) + 1; });

  const card = (label, valor, cor, sub) => (
    <div className="card" style={{ borderTop: `4px solid ${cor}` }}>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div className="num" style={{ fontSize: 24, fontWeight: 700, color: cor }}>{valor}</div>
      {sub && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
  const h3 = { fontFamily: "'Fraunces', serif", fontSize: 18, margin: "22px 0 8px" };
  const tabelinha = (titulo, dados) => (
    <div style={{ flex: 1, minWidth: 240 }}>
      <h3 style={h3}>{titulo}</h3>
      <div className="card" style={{ padding: 0 }}>
        <table className="data">
          <tbody>
            {dados.map(([k, n]) => (
              <tr key={k}><td>{k}</td><td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{n}</td></tr>
            ))}
            {dados.length === 0 && <tr><td className="muted" style={{ padding: 12, fontStyle: "italic" }}>—</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="container" style={{ maxWidth: 1000 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">Mapa Legal</h1>
      <p className="muted" style={{ fontSize: 14, margin: "4px 0 16px" }}>
        A situação total do contencioso — {empresas.length} empresas, {procs.length} processos no sistema.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 8 }}>
        {card("Processos ativos", String(ativos.length), "var(--text)", procs.length - ativos.length + " encerrados")}
        {card("Prazos vencidos", String(vencidos.length), vencidos.length ? "var(--neg)" : "var(--pos)", vencidos.length ? "resolver JÁ" : "nenhum 🎉")}
        {card("Próximos 7 dias", String(prox7.length), prox7.length ? "#B8860B" : "var(--pos)")}
        {card("Próximos 30 dias", String(prox30.length), "var(--text)")}
        {card("Sem prazo cadastrado", String(semPrazo.length), semPrazo.length ? "#B8860B" : "var(--pos)", "cadastrar é a tarefa nº 1")}
      </div>

      {(vencidos.length > 0 || prox7.length > 0) && (
        <>
          <h3 style={h3}>🚨 Atenção imediata</h3>
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="data">
              <thead><tr><th>Prazo</th><th>Processo</th><th>Empresa</th><th>Advogado</th><th>Nota</th></tr></thead>
              <tbody>
                {[...vencidos, ...prox7].map((p) => (
                  <tr key={p.id}>
                    <td className="num" style={{ color: "var(--neg)", fontWeight: 700 }}>{p.proximo_prazo?.slice(8, 10)}/{p.proximo_prazo?.slice(5, 7)}</td>
                    <td style={{ fontWeight: 600 }}>{p.titulo}</td>
                    <td>{p.empresa && <span className="badge">{p.empresa}</span>}</td>
                    <td>{p.advogado}</td>
                    <td className="muted" style={{ fontSize: 12, maxWidth: 220 }}>{p.nota}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {tabelinha("Por empresa (ativos)", porEmpresa)}
        {tabelinha("Por tipo (ativos)", Object.entries(porTipo).sort((a, b) => b[1] - a[1]))}
        {tabelinha("Por advogado (ativos)", porAdv)}
        {tabelinha("Por status (todos)", porStatus)}
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
        Detalhe e edição de cada processo: <a href="/advogados">Advogados & Processos</a>. Situação por empresa: <a href="/empresas">Empresas do Grupo</a>.
      </p>
    </div>
  );
}
