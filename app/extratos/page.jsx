"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

const TIPOS = ["Extrato Genco (conta Inter)", "Fatura cartão Inter", "Extrato Bradesco", "Outro"];

export default function Extratos() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const [rows, setRows] = useState([]);
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [obs, setObs] = useState("");
  const [file, setFile] = useState(null);
  const [colado, setColado] = useState("");
  const [nomeColado, setNomeColado] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("extratos").select("*").order("mes", { ascending: false }).order("created_at", { ascending: false });
    setRows(data || []);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (e) => {
    e.preventDefault(); setErr("");
    const temTexto = colado.trim().length > 20;
    if (!file && !temTexto) { setErr("Escolhe o arquivo OU cola o conteúdo do CSV/TXT na caixa."); return; }
    setBusy(true);
    try {
      let blob, nome, tipoMime;
      if (temTexto) {
        // texto colado → vira arquivo no cofre (não depende do navegador ler o disco)
        const ehCsv = /;/.test(colado) || /\.csv$/i.test(nomeColado);
        nome = (nomeColado.trim() || (ehCsv ? `extrato-${mes}-colado.csv` : `fatura-${mes}-colada.txt`)).replace(/[^\w.\-]/g, "_");
        if (!/\.(csv|txt)$/i.test(nome)) nome += ehCsv ? ".csv" : ".txt";
        tipoMime = ehCsv ? "text/csv" : "text/plain";
        blob = new Blob([colado], { type: tipoMime });
      } else {
        let buf;
        try { buf = await file.arrayBuffer(); } catch (e) { throw new Error("O navegador não conseguiu ler o arquivo do disco (iCloud/Safari). Abre o arquivo, copia tudo (Cmd+A, Cmd+C) e cola na caixa abaixo — funciona sempre."); }
        if (!buf || buf.byteLength === 0) throw new Error("O arquivo chegou vazio (0 bytes). Abre o arquivo, copia tudo e cola na caixa abaixo.");
        tipoMime = file.type || (/\.csv$/i.test(file.name) ? "text/csv" : /\.txt$/i.test(file.name) ? "text/plain" : /\.pdf$/i.test(file.name) ? "application/pdf" : "application/octet-stream");
        blob = new Blob([buf], { type: tipoMime });
        nome = file.name.replace(/[^\w.\-]/g, "_");
      }
      const path = `extratos/${mes}-${Date.now()}-${nome}`;
      const { error: upErr } = await supabase.storage.from("docs").upload(path, blob, { contentType: tipoMime, upsert: false });
      if (upErr) throw upErr;
      const arquivo_url = supabase.storage.from("docs").getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from("extratos").insert({
        tipo, mes, obs: obs.trim() || null, arquivo_url, nome_arquivo: nome, criado_por: session.user.email,
      });
      if (error) throw error;
      setObs(""); setFile(null); setColado(""); setNomeColado("");
      await carregar();
    } catch (e2) { setErr(e2.message || "Erro ao salvar"); }
    setBusy(false);
  };

  const remover = async (id) => {
    if (!confirm("Remover esse extrato do arquivo?")) return;
    await supabase.from("extratos").delete().eq("id", id);
    carregar();
  };

  if (perfil && !["admin", "financeiro"].includes(perfil.role))
    return <div className="container muted">Sem acesso a este módulo.</div>;

  const meses = [...new Set(rows.map((r) => r.mes))];

  return (
    <div className="container">
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">Extratos & Faturas</h1>
      <p className="muted" style={{ fontSize: 14, margin: "4px 0 20px" }}>
        O arquivo oficial do grupo: todo fechamento de mês, sobe aqui o extrato da conta e a fatura do cartão.
        CSV é o formato ideal (o app do Inter exporta) — PDF e print também valem.
      </p>

      <form onSubmit={salvar} className="card" style={{ display: "grid", gap: 10, marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 10 }}>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} title="Mês de referência" />
        </div>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>— ou cola o conteúdo aqui (abre o CSV/TXT, Cmd+A, Cmd+C, Cmd+V) — funciona mesmo quando o navegador não lê o arquivo:</div>
        <textarea value={colado} onChange={(e) => setColado(e.target.value)} rows={4} placeholder="Extrato Conta Corrente&#10;Conta ;356318354&#10;Período ;...&#10;Saldo ;...&#10;Data Lançamento;Histórico;Descrição;Valor;Saldo&#10;..." style={{ fontSize: 11.5, fontFamily: "ui-monospace, monospace" }} />
        {colado.trim() && <input value={nomeColado} onChange={(e) => setNomeColado(e.target.value)} placeholder="nome do arquivo (ex.: extrato-17-08-noite.csv)" style={{ fontSize: 12 }} />}
        <input placeholder="Observação (opcional — ex.: 'mês fechado', 'parcial até dia 15')" value={obs} onChange={(e) => setObs(e.target.value)} />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {err && <span style={{ color: "var(--neg)", fontSize: 13 }}>{err}</span>}
          <button className="primary" disabled={busy} style={{ marginLeft: "auto" }}>{busy ? "Subindo…" : "Arquivar"}</button>
        </div>
      </form>

      {meses.map((m) => (
        <div key={m} style={{ marginBottom: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{m}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.filter((r) => r.mes === m).map((r) => (
              <div key={r.id} className="card" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <span className="badge">{r.tipo}</span>
                  <a href={r.arquivo_url} target="_blank" rel="noreferrer" style={{ marginLeft: 10, fontWeight: 600 }}>📄 {r.nome_arquivo}</a>
                  {r.obs && <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>· {r.obs}</span>}
                </div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {r.criado_por?.split("@")[0]} · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  <a href="#" onClick={(e) => { e.preventDefault(); remover(r.id); }} style={{ color: "var(--neg)", marginLeft: 10 }}>×</a>
                  <div style={{ marginTop: 6 }}>
                    <input defaultValue={r.comentario || ""} placeholder="💬 comentário sobre este arquivo"
                      onBlur={(e) => e.target.value !== (r.comentario || "") && supabase.from("extratos").update({ comentario: e.target.value.trim() || null }).eq("id", r.id)}
                      style={{ fontSize: 11.5, padding: "4px 8px", width: "100%", maxWidth: 400, background: r.comentario ? "#FFFBF0" : "var(--surface)" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {rows.length === 0 && <div className="muted" style={{ fontStyle: "italic" }}>Arquivo vazio — o extrato de agosto vai ser o primeiro morador.</div>}
    </div>
  );
}
