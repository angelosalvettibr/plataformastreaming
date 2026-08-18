"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

const STATUS = ["Em andamento", "Aguardando", "Urgente", "Suspenso", "Encerrado"];

export default function Advogados() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const [advs, setAdvs] = useState([]);
  const [procs, setProcs] = useState([]);
  const [fa, setFa] = useState({ nome: "", escritorio: "", email: "", telefone: "", area: "", obs: "" });
  const [fp, setFp] = useState({ titulo: "", numero: "", advogado: "", empresa: "", status: "Em andamento", proximo_prazo: "", nota: "" });
  const [err, setErr] = useState("");

  const carregar = useCallback(async () => {
    const { data: a } = await supabase.from("advogados").select("*").order("nome");
    setAdvs(a || []);
    const { data: p } = await supabase.from("processos").select("*").order("proximo_prazo", { ascending: true, nullsFirst: false });
    setProcs(p || []);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const salvarAdv = async (e) => {
    e.preventDefault(); setErr("");
    const { error } = await supabase.from("advogados").insert({ ...fa, nome: fa.nome.trim(), criado_por: session.user.email });
    if (error) setErr(error.message);
    else { setFa({ nome: "", escritorio: "", email: "", telefone: "", area: "", obs: "" }); carregar(); }
  };
  const salvarProc = async (e) => {
    e.preventDefault(); setErr("");
    const { error } = await supabase.from("processos").insert({
      ...fp, titulo: fp.titulo.trim(), proximo_prazo: fp.proximo_prazo || null, criado_por: session.user.email,
    });
    if (error) setErr(error.message);
    else { setFp({ titulo: "", numero: "", advogado: "", empresa: "", status: "Em andamento", proximo_prazo: "", nota: "" }); carregar(); }
  };
  const del = async (tabela, id) => {
    if (!confirm("Remover?")) return;
    await supabase.from(tabela).delete().eq("id", id);
    carregar();
  };
  const mudaStatus = async (id, status) => {
    await supabase.from("processos").update({ status }).eq("id", id);
    carregar();
  };

  if (perfil && !["admin", "juridico"].includes(perfil.role))
    return <div className="container muted">Sem acesso a este módulo.</div>;

  const hoje = new Date().toISOString().slice(0, 10);
  const cor = (p) => {
    if (!p.proximo_prazo || p.status === "Encerrado") return undefined;
    const dias = (new Date(p.proximo_prazo) - new Date(hoje)) / 86400000;
    if (dias < 0) return "var(--neg)";
    if (dias <= 7) return "var(--gold)";
    return undefined;
  };

  return (
    <div className="container" style={{ maxWidth: 980 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">Advogados & Processos</h1>
      <p className="muted" style={{ fontSize: 14, margin: "4px 0 20px" }}>Quem cuida do quê, status e próximos prazos — vermelho = vencido, dourado = próximos 7 dias.</p>

      <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, margin: "10px 0" }}>Processos</h3>
      <form onSubmit={salvarProc} className="card" style={{ display: "grid", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <input required placeholder="Título do processo/assunto *" value={fp.titulo} onChange={(e) => setFp({ ...fp, titulo: e.target.value })} />
          <input placeholder="Número (CNJ...)" value={fp.numero} onChange={(e) => setFp({ ...fp, numero: e.target.value })} />
          <input placeholder="Empresa" value={fp.empresa} onChange={(e) => setFp({ ...fp, empresa: e.target.value })} style={{ gridColumn: "1 / -1" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 160px", gap: 10 }}>
          <input list="advs" placeholder="Advogado responsável" value={fp.advogado} onChange={(e) => setFp({ ...fp, advogado: e.target.value })} />
          <datalist id="advs">{advs.map((a) => <option key={a.id} value={a.nome} />)}</datalist>
          <select value={fp.status} onChange={(e) => setFp({ ...fp, status: e.target.value })}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select>
          <input type="date" value={fp.proximo_prazo} onChange={(e) => setFp({ ...fp, proximo_prazo: e.target.value })} title="Próximo prazo" />
        </div>
        <input placeholder="Nota (o que está acontecendo)" value={fp.nota} onChange={(e) => setFp({ ...fp, nota: e.target.value })} />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {err && <span style={{ color: "var(--neg)", fontSize: 13 }}>{err}</span>}
          <button className="primary" style={{ marginLeft: "auto" }}>Salvar processo</button>
        </div>
      </form>
      <div className="card" style={{ padding: 0, overflowX: "auto", marginBottom: 30 }}>
        <table className="data">
          <thead><tr><th>Prazo</th><th>Título</th><th>Empresa</th><th>Número</th><th>Advogado</th><th>Status</th><th>Nota</th><th>💬</th><th></th></tr></thead>
          <tbody>
            {procs.map((p) => (
              <tr key={p.id}>
                <td className="num" style={{ color: cor(p), fontWeight: cor(p) ? 700 : 400 }}>
                  {p.proximo_prazo ? `${p.proximo_prazo.slice(8, 10)}/${p.proximo_prazo.slice(5, 7)}` : "—"}
                </td>
                <td><b>{p.titulo}</b></td>
                <td>{p.empresa && <span className="badge">{p.empresa}</span>}</td>
                <td className="muted" style={{ fontSize: 11 }}>{p.numero}</td>
                <td>{p.advogado}</td>
                <td>
                  <select value={p.status} onChange={(e) => mudaStatus(p.id, e.target.value)} style={{ padding: "4px 8px", fontSize: 12, width: "auto" }}>
                    {STATUS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="muted" style={{ fontSize: 12, maxWidth: 220 }}>{p.nota}</td>
                <td><input defaultValue={p.comentario || ""} placeholder="💬" title="Comentário — vai pro briefing"
                  onBlur={(e) => e.target.value !== (p.comentario || "") && supabase.from("processos").update({ comentario: e.target.value.trim() || null }).eq("id", p.id)}
                  style={{ fontSize: 11.5, padding: "4px 7px", width: 110, background: p.comentario ? "#FFFBF0" : "var(--surface)" }} /></td>
                <td><a href="#" onClick={(e) => { e.preventDefault(); del("processos", p.id); }} style={{ color: "var(--neg)" }}>×</a></td>
              </tr>
            ))}
            {procs.length === 0 && <tr><td colSpan={9} className="muted" style={{ padding: 20, fontStyle: "italic" }}>Nenhum processo cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, margin: "10px 0" }}>Advogados</h3>
      <form onSubmit={salvarAdv} className="card" style={{ display: "grid", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input required placeholder="Nome *" value={fa.nome} onChange={(e) => setFa({ ...fa, nome: e.target.value })} />
          <input placeholder="Escritório" value={fa.escritorio} onChange={(e) => setFa({ ...fa, escritorio: e.target.value })} />
          <input placeholder="Email" value={fa.email} onChange={(e) => setFa({ ...fa, email: e.target.value })} />
          <input placeholder="Telefone/WhatsApp" value={fa.telefone} onChange={(e) => setFa({ ...fa, telefone: e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
          <input placeholder="Área (trabalhista, tributário...)" value={fa.area} onChange={(e) => setFa({ ...fa, area: e.target.value })} />
          <input placeholder="Observações" value={fa.obs} onChange={(e) => setFa({ ...fa, obs: e.target.value })} />
        </div>
        <button className="primary" style={{ justifySelf: "end" }}>Salvar advogado</button>
      </form>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data">
          <thead><tr><th>Nome</th><th>Escritório</th><th>Área</th><th>Contato</th><th>Obs</th><th></th></tr></thead>
          <tbody>
            {advs.map((a) => (
              <tr key={a.id}>
                <td><b>{a.nome}</b></td>
                <td>{a.escritorio}</td>
                <td>{a.area && <span className="badge">{a.area}</span>}</td>
                <td className="muted" style={{ fontSize: 12 }}>{[a.email, a.telefone].filter(Boolean).join(" · ")}</td>
                <td className="muted" style={{ fontSize: 12, maxWidth: 200 }}>{a.obs}</td>
                <td><a href="#" onClick={(e) => { e.preventDefault(); del("advogados", a.id); }} style={{ color: "var(--neg)" }}>×</a></td>
              </tr>
            ))}
            {advs.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 20, fontStyle: "italic" }}>Nenhum advogado cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
